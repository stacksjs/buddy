import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it } from 'bun:test'
import { GitHubProvider } from '../src/git/github-provider'
import { GitHubApiError } from '../src/utils/errors'
import { FileChangeValidationError } from '../src/utils/file-changes'
import { Logger } from '../src/utils/logger'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

/**
 * Replace fetch with a router keyed off the recorded call, recording every
 * request so tests can assert on URLs, methods, headers and bodies.
 */
function stubFetch(route: (call: RecordedCall) => Response | Promise<Response>): RecordedCall[] {
  const calls: RecordedCall[] = []
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
    }
    calls.push(call)
    return route(call)
  }) as unknown as typeof fetch
  return calls
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function github(token = 'token'): GitHubProvider {
  return new GitHubProvider(token, 'owner', 'repo', false, undefined, 'https://api.github.test', Logger.silent())
}

function prResponse(number: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number,
    title: `chore(deps): update #${number}`,
    body: 'pr body',
    head: { ref: 'buddy/update-x' },
    base: { ref: 'main' },
    state: 'open',
    html_url: `https://github.com/owner/repo/pull/${number}`,
    created_at: '2026-01-02T03:04:05Z',
    updated_at: '2026-01-02T03:04:06Z',
    merged_at: null,
    draft: false,
    user: { login: 'github-actions[bot]' },
    ...overrides,
  }
}

function issueResponse(number: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number,
    title: `issue #${number}`,
    body: 'issue body',
    state: 'open',
    html_url: `https://github.com/owner/repo/issues/${number}`,
    created_at: '2026-01-02T03:04:05Z',
    updated_at: '2026-01-02T03:04:06Z',
    closed_at: null,
    user: { login: 'octocat' },
    assignees: [],
    labels: [],
    ...overrides,
  }
}

describe('gitHubProvider API surface', () => {
  describe('runCommand', () => {
    it('success case - resolves accumulated stdout on exit 0', async () => {
      const output = await github().runCommand('sh', ['-c', 'echo hello'])
      expect(output).toContain('hello')
    })

    it('failure case - a failed command redacts the token and token-shaped strings from stderr', async () => {
      const prov = github('supersecrettoken1234')
      const error = await prov
        .runCommand('sh', ['-c', '>&2 echo "auth supersecrettoken1234 ghp_ABCDEFGHIJKLMNOPQRST12345"; exit 3'])
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(message).toContain('code 3')
      expect(message).toContain('[REDACTED]')
      expect(message).not.toContain('supersecrettoken1234')
      expect(message).not.toContain('ghp_ABCDEFGHIJKLMNOPQRST12345')
    })
  })

  describe('createPullRequest', () => {
    const options = { title: 't', body: 'b', head: 'buddy/x', base: 'main' }

    it('failure case - falls back to the API when the gh CLI is missing', async () => {
      const prov = github()
      ;(prov as any).runCommand = async () => {
        throw new Error('gh: not found')
      }
      const calls = stubFetch(() => json(prResponse(55), 201))

      const pr = await prov.createPullRequest(options)

      expect(pr.number).toBe(55)
      expect(pr.head).toBe('buddy/update-x')
      expect(pr.url).toBe('https://github.com/owner/repo/pull/55')
      expect(pr.createdAt).toEqual(new Date('2026-01-02T03:04:05Z'))
      expect(calls.filter(c => c.method === 'POST' && c.url.endsWith('/pulls'))).toHaveLength(1)
    })

    it('failure case - falls back to the API when gh prints no PR URL', async () => {
      const prov = github()
      ;(prov as any).runCommand = async () => 'no url in this output\n'
      const calls = stubFetch(() => json(prResponse(56), 201))

      const pr = await prov.createPullRequest(options)

      expect(pr.number).toBe(56)
      expect(calls.filter(c => c.method === 'POST' && c.url.endsWith('/pulls'))).toHaveLength(1)
    })

    it('success case - parses the PR number from gh output and adds labels via API afterwards', async () => {
      const prov = github()
      const commands: Array<{ command: string, args: string[] }> = []
      ;(prov as any).runCommand = async (command: string, args: string[]) => {
        commands.push({ command, args })
        return 'https://github.com/owner/repo/pull/123\n'
      }
      const apiCalls: Array<{ endpoint: string, data: unknown }> = []
      ;(prov as any).apiRequest = async (endpoint: string, data?: unknown) => {
        apiCalls.push({ endpoint, data })
        return {}
      }

      const pr = await prov.createPullRequest({
        ...options,
        labels: ['dependencies'],
        reviewers: ['alice'],
      })

      expect(pr.number).toBe(123)
      expect(pr.url).toBe('https://github.com/owner/repo/pull/123')
      expect(commands[0].command).toBe('gh')
      expect(commands[0].args).toContain('--reviewer')
      const labelCall = apiCalls.find(c => c.endpoint === 'POST /repos/owner/repo/issues/123/labels')
      expect(labelCall?.data).toEqual({ labels: ['dependencies'] })
    })

    it('failure case - the API path survives a reviewer-add failure and retries labels one-by-one', async () => {
      const prov = github()
      ;(prov as any).runCommand = async () => {
        throw new Error('gh missing')
      }
      const labelBodies: string[] = []
      stubFetch((call) => {
        if (call.url.includes('/requested_reviewers'))
          return json({ message: 'Validation Failed' }, 422)
        if (call.url.includes('/labels')) {
          labelBodies.push(call.body ?? '')
          const labels = JSON.parse(call.body ?? '{}').labels ?? []
          return labels.length > 1 ? json({ message: 'Validation Failed' }, 422) : json({})
        }
        return json(prResponse(9), 201)
      })

      const pr = await prov.createPullRequest({
        ...options,
        reviewers: ['alice'],
        labels: ['a', 'b'],
      })

      expect(pr.number).toBe(9)
      expect(labelBodies.map(body => JSON.parse(body).labels)).toEqual([['a', 'b'], ['a'], ['b']])
    })
  })

  describe('updatePullRequest', () => {
    it('success case - PATCHes only the provided fields and falls back per label', async () => {
      const calls = stubFetch((call) => {
        if (call.method === 'PATCH')
          return json(prResponse(7))
        if (call.method === 'PUT')
          return json({ message: 'Forbidden' }, 403)
        return json({})
      })

      const pr = await github().updatePullRequest(7, { title: 'x', labels: ['a'] })

      const patch = calls.find(c => c.method === 'PATCH')
      expect(JSON.parse(patch?.body ?? '')).toEqual({ title: 'x' })
      const put = calls.find(c => c.method === 'PUT')
      expect(put?.url).toContain('/issues/7/labels')
      const post = calls.find(c => c.method === 'POST')
      expect(JSON.parse(post?.body ?? '')).toEqual({ labels: ['a'] })
      expect(pr.number).toBe(7)
      expect(pr.title).toBe('chore(deps): update #7')
      expect(pr.labels).toEqual(['a'])
    })
  })

  describe('closePullRequest', () => {
    it('edge case - tolerates a non-JSON success response', async () => {
      const calls = stubFetch(() =>
        new Response('', { status: 200, headers: { 'content-type': 'text/plain' } }))

      await github().closePullRequest(7)

      expect(calls[0].method).toBe('PATCH')
      expect(JSON.parse(calls[0].body ?? '')).toEqual({ state: 'closed' })
    })
  })

  describe('mergePullRequest', () => {
    it('success case - maps the strategy, deletes the head branch, and swallows cleanup failure', async () => {
      const prov = github()
      const apiCalls: Array<{ endpoint: string, data: unknown }> = []
      ;(prov as any).apiRequest = async (endpoint: string, data?: unknown) => {
        apiCalls.push({ endpoint, data })
        if (endpoint.startsWith('GET'))
          return { head: { ref: 'buddy/x' } }
        return {}
      }
      const deleted: string[] = []
      ;(prov as any).deleteBranch = async (name: string) => {
        deleted.push(name)
        throw new Error('branch is protected')
      }

      await prov.mergePullRequest(9, 'squash')

      const merge = apiCalls.find(c => c.endpoint === 'PUT /repos/owner/repo/pulls/9/merge')
      expect(merge?.data).toEqual({ merge_method: 'squash' })
      expect(deleted).toEqual(['buddy/x'])
    })
  })

  describe('hasWriteAccess', () => {
    it('success case - grants admin access', async () => {
      stubFetch(() => json({ permission: 'admin' }))
      expect(await github().hasWriteAccess('alice')).toBe(true)
    })

    it('success case - denies read-only collaborators', async () => {
      stubFetch(() => json({ permission: 'read' }))
      expect(await github().hasWriteAccess('alice')).toBe(false)
    })

    it('failure case - a 404 (not a collaborator) is a definitive no', async () => {
      stubFetch(() => json({ message: 'Not Found' }, 404))
      expect(await github().hasWriteAccess('stranger')).toBe(false)
    })

    it('failure case - an unknown error must not grant access', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      expect(await github().hasWriteAccess('alice')).toBe(false)
    })

    it('edge case - the username is URL-encoded', async () => {
      const calls = stubFetch(() => json({ permission: 'admin' }))
      await github().hasWriteAccess('a b')
      expect(calls[0].url).toContain('/collaborators/a%20b/permission')
    })
  })

  describe('getWorkflowRunLogs', () => {
    it('success case - collapses non-printable bytes to spaces but keeps tabs and newlines', async () => {
      stubFetch(() => new Response(new Uint8Array([...Buffer.from('ok\x00\x01text\tend\n')])))

      const logs = await github().getWorkflowRunLogs(5)

      expect(logs).toBe('ok text\tend\n')
    })

    it('failure case - unavailable logs read as null', async () => {
      stubFetch(() => json({ message: 'Not Found' }, 404))
      expect(await github().getWorkflowRunLogs(5)).toBeNull()
    })

    it('failure case - an unreadable body reads as null rather than throwing', async () => {
      stubFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: () => Promise.reject(new Error('corrupt archive')),
      }) as unknown as Response)

      expect(await github().getWorkflowRunLogs(5)).toBeNull()
    })
  })

  describe('createCheckRun', () => {
    it('failure case - logs instead of throwing when checks:write is missing', async () => {
      stubFetch(() => json({ message: 'Resource not accessible by integration' }, 403))

      await expect(
        github().createCheckRun('buddy gate', 'abc', { conclusion: 'failure', title: 't', summary: 's' }),
      ).resolves.toBeUndefined()
    })

    it('success case - posts a completed check run with the result output', async () => {
      const calls = stubFetch(() => json({}, 201))

      await github().createCheckRun('buddy gate', 'abc123', {
        conclusion: 'success',
        title: 'All gates passed',
        summary: 'details',
      })

      expect(calls[0].url).toBe('https://api.github.test/repos/owner/repo/check-runs')
      const body = JSON.parse(calls[0].body ?? '')
      expect(body.name).toBe('buddy gate')
      expect(body.head_sha).toBe('abc123')
      expect(body.status).toBe('completed')
      expect(body.conclusion).toBe('success')
      expect(body.output).toEqual({ title: 'All gates passed', summary: 'details' })
    })
  })

  describe('getFileContent', () => {
    it('success case - decodes base64 content', async () => {
      const calls = stubFetch(() => json({
        content: Buffer.from('hello').toString('base64'),
        encoding: 'base64',
      }))

      const content = await github().getFileContent('docs/read me.md', 'feat/x')

      expect(content).toBe('hello')
      expect(calls[0].url).toContain('/contents/docs%2Fread%20me.md?ref=feat%2Fx')
    })

    it('edge case - a response with no content reads as null', async () => {
      stubFetch(() => json({}))
      expect(await github().getFileContent('a.txt', 'main')).toBeNull()
    })

    it('failure case - a 404 reads as null', async () => {
      stubFetch(() => json({ message: 'Not Found' }, 404))
      expect(await github().getFileContent('missing.txt', 'main')).toBeNull()
    })

    it('failure case - other failures rethrow as typed errors', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      const error = await github().getFileContent('a.txt', 'main').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(GitHubApiError)
      expect((error as GitHubApiError).status).toBe(500)
    })
  })

  describe('getPullRequestDiff', () => {
    it('success case - asks for the diff media type and returns the text verbatim', async () => {
      const calls = stubFetch(() => new Response('diff --git a/x b/x'))

      const diff = await github().getPullRequestDiff(3)

      expect(diff).toBe('diff --git a/x b/x')
      expect(calls[0].headers.Accept).toBe('application/vnd.github.v3.diff')
    })

    it('failure case - throws a typed error on failure', async () => {
      stubFetch(() => json({ message: 'Not Found' }, 404))
      const error = await github().getPullRequestDiff(3).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(GitHubApiError)
      expect((error as GitHubApiError).status).toBe(404)
    })
  })

  describe('createReview', () => {
    it('failure case - reposts the summary alone when inline anchors are rejected', async () => {
      const calls = stubFetch((call) => {
        const body = JSON.parse(call.body ?? '{}')
        return Array.isArray(body.comments)
          ? json({ message: 'Validation Failed' }, 422)
          : json({})
      })

      const result = await github().createReview(4, {
        body: 'summary',
        event: 'COMMENT',
        comments: [{ path: 'a.ts', line: 1, side: 'RIGHT', body: 'finding' }],
      })

      expect(result).toEqual({ posted: true, inlineComments: 0 })
      expect(calls).toHaveLength(2)
    })

    it('failure case - a rejected review with no comments is not silently retried', async () => {
      const calls = stubFetch(() => json({ message: 'Validation Failed' }, 422))
      const error = await github()
        .createReview(4, { body: 'summary', event: 'COMMENT' })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GitHubApiError)
      expect(calls).toHaveLength(1)
    })
  })

  describe('enableAutoMerge', () => {
    it('failure case - treats GraphQL errors as a fallback signal', async () => {
      stubFetch(call => call.url.includes('/graphql')
        ? json({ errors: [{ message: 'Pull request is in clean status' }] })
        : json({ node_id: 'PR_abc' }))

      expect(await github().enableAutoMerge(5)).toBe(false)
    })

    it('success case - uppercases the merge method in the mutation variables', async () => {
      const calls = stubFetch(call => call.url.includes('/graphql')
        ? json({ data: {} })
        : json({ node_id: 'PR_abc' }))

      expect(await github().enableAutoMerge(5, 'squash')).toBe(true)

      const gql = calls.find(c => c.url.includes('/graphql'))
      expect(JSON.parse(gql?.body ?? '').variables).toEqual({
        pullRequestId: 'PR_abc',
        mergeMethod: 'SQUASH',
      })
    })
  })

  describe('listReviewThreads', () => {
    it('success case - maps thread nodes and drops the unusable ones', async () => {
      stubFetch(() => json({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: 'T1',
                    isResolved: true,
                    path: 'src/a.ts',
                    comments: { nodes: [{ author: { login: 'alice' } }, { author: null }] },
                  },
                  null,
                  { id: 'T2', isResolved: false, comments: { nodes: [] } },
                ],
              },
            },
          },
        },
      }))

      const threads = await github().listReviewThreads(8)

      expect(threads).toHaveLength(2)
      expect(threads[0]).toEqual({ id: 'T1', isResolved: true, path: 'src/a.ts', authorLogins: ['alice'] })
      expect(threads[1]).toEqual({ id: 'T2', isResolved: false, authorLogins: [] })
      expect('path' in threads[1]).toBe(false)
    })

    it('failure case - GraphQL errors read as no threads', async () => {
      stubFetch(() => json({ errors: [{ message: 'boom' }] }))
      expect(await github().listReviewThreads(8)).toEqual([])
    })

    it('failure case - an unreadable conversation reads as nothing to tidy', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      expect(await github().listReviewThreads(8)).toEqual([])
    })
  })

  describe('getPullRequestChecksState', () => {
    function stubChecks(checkRuns: unknown, status: unknown): void {
      stubFetch((call) => {
        if (call.url.includes('/check-runs'))
          return json(checkRuns)
        if (call.url.includes('/status'))
          return json(status)
        return json({ head: { sha: 'abc' } })
      })
    }

    it('edge case - no runs and no statuses read as none', async () => {
      stubChecks({ check_runs: [] }, { statuses: [], state: 'pending' })
      expect(await github().getPullRequestChecksState(9)).toBe('none')
    })

    it('failure case - a timed-out run reads as failure', async () => {
      stubChecks(
        { check_runs: [{ status: 'completed', conclusion: 'timed_out' }] },
        { statuses: [], state: 'success' },
      )
      expect(await github().getPullRequestChecksState(9)).toBe('failure')
    })

    it('edge case - green runs with a pending legacy status read as pending', async () => {
      stubChecks(
        { check_runs: [{ status: 'completed', conclusion: 'success' }] },
        { statuses: [{ state: 'pending' }], state: 'pending' },
      )
      expect(await github().getPullRequestChecksState(9)).toBe('pending')
    })

    it('success case - everything green reads as success', async () => {
      stubChecks(
        { check_runs: [{ status: 'completed', conclusion: 'success' }] },
        { statuses: [{ state: 'success' }], state: 'success' },
      )
      expect(await github().getPullRequestChecksState(9)).toBe('success')
    })

    it('failure case - an unreadable check state reads as pending, never success', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      expect(await github().getPullRequestChecksState(9)).toBe('pending')
    })
  })

  describe('getBuddyBranches API fallback', () => {
    it('success case - paginates branches and epoch-falls-back on commit-date failures', async () => {
      const prov = github()
      ;(prov as any).runCommand = async () => {
        throw new Error('git missing')
      }
      ;(prov as any).apiRequest = async (endpoint: string) => {
        if (endpoint.includes('/branches?')) {
          return [
            { name: 'buddy/a', commit: { sha: 'sha-a' } },
            { name: 'buddy/b', commit: { sha: 'sha-b' } },
            { name: 'feature/c', commit: { sha: 'sha-c' } },
          ]
        }
        if (endpoint.includes('/commits/sha-a'))
          return { commit: { committer: { date: '2026-01-01T00:00:00Z' } } }
        throw new Error('commit lookup failed')
      }

      const branches = await prov.getBuddyBranches()

      expect(branches).toEqual([
        { name: 'buddy/a', sha: 'sha-a', lastCommitDate: new Date('2026-01-01T00:00:00Z') },
        { name: 'buddy/b', sha: 'sha-b', lastCommitDate: new Date(0) },
      ])
    })

    it('failure case - an unlistable repository reads as no buddy branches', async () => {
      const prov = github()
      ;(prov as any).runCommand = async () => {
        throw new Error('git missing')
      }
      ;(prov as any).apiRequest = async () => {
        throw new Error('branch listing failed')
      }

      expect(await prov.getBuddyBranches()).toEqual([])
    })
  })

  describe('commitChanges via API', () => {
    function providerForCommit(contentsError: Error): { prov: GitHubProvider, endpoints: string[] } {
      const prov = github()
      ;(prov as any).runCommand = async () => {
        throw new Error('git unavailable')
      }
      const endpoints: string[] = []
      ;(prov as any).apiRequest = async (endpoint: string) => {
        endpoints.push(endpoint)
        if (endpoint.includes('/git/ref/heads/'))
          return { object: { sha: 'base-sha' } }
        if (endpoint.includes('/git/commits/'))
          return { tree: { sha: 'tree-sha' } }
        if (endpoint.includes('/contents/'))
          throw contentsError
        return {}
      }
      return { prov, endpoints }
    }

    it('failure case - refuses an update target missing from base', async () => {
      const { prov, endpoints } = providerForCommit(new Error('404 not found'))

      const error = await prov
        .commitChanges('buddy/x', 'msg', [{ path: 'package.json', content: '{"name":"y"}', type: 'update' }])
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(FileChangeValidationError)
      expect((error as Error).message).toContain('Refusing to create missing update target')
      expect(endpoints.some(e => e.includes('/git/blobs'))).toBe(false)
    })

    it('failure case - a non-404 lookup failure rethrows instead of masquerading as missing', async () => {
      const { prov } = providerForCommit(new Error('500 server error'))

      const error = await prov
        .commitChanges('buddy/x', 'msg', [{ path: 'package.json', content: '{"name":"y"}', type: 'update' }])
        .catch((e: unknown) => e)

      expect(error).not.toBeInstanceOf(FileChangeValidationError)
      expect((error as Error).message).toContain('500 server error')
    })
  })

  describe('getIssues', () => {
    it('success case - filters out pull requests, walks pages, and serves the cache on the second call', async () => {
      const prov = github()
      const calls = stubFetch((call) => {
        if (call.url.includes('&page=1')) {
          const items = Array.from({ length: 100 }, (_, i) =>
            issueResponse(i + 1, i === 0 ? { pull_request: { url: 'x' } } : {}))
          return json(items)
        }
        return json([issueResponse(101)])
      })

      const issues = await prov.getIssues('open')

      expect(issues).toHaveLength(100)
      expect(issues.some(issue => issue.number === 1)).toBe(false)
      expect(issues.some(issue => issue.number === 101)).toBe(true)
      expect(calls.some(c => c.url.includes('&page=1'))).toBe(true)
      expect(calls.some(c => c.url.includes('&page=2'))).toBe(true)

      const callCount = calls.length
      const again = await prov.getIssues('open')
      expect(again).toHaveLength(100)
      expect(calls).toHaveLength(callCount)
    })
  })

  describe('updateIssue', () => {
    it('edge case - passes explicit empty arrays through so labels can be cleared', async () => {
      const calls = stubFetch(() => json(issueResponse(3)))

      const issue = await github().updateIssue(3, { labels: [], assignees: [] })

      expect(calls[0].method).toBe('PATCH')
      expect(JSON.parse(calls[0].body ?? '')).toEqual({ labels: [], assignees: [] })
      expect(issue.number).toBe(3)
      expect(issue.author).toBe('octocat')
    })
  })

  describe('rate-limit retry', () => {
    it('failure case - a rate-limited list retries through the transport with zero delay', async () => {
      let attempt = 0
      const calls = stubFetch(() => {
        attempt++
        return attempt === 1
          ? new Response('', { status: 429, headers: { 'retry-after': '0' } })
          : json([])
      })

      const prs = await github().getPullRequests('open')

      expect(prs).toEqual([])
      expect(calls).toHaveLength(2)
    })
  })

  describe('issue pinning', () => {
    it('failure case - returns false on GraphQL refusal and never throws', async () => {
      stubFetch(call => call.url.includes('/graphql')
        ? json({ errors: [{ message: 'Only 3 issues can be pinned' }] })
        : json({ node_id: 'I_x' }))

      expect(await github().pinIssue(11)).toBe(false)
    })

    it('success case - pins and unpins with the matching mutation', async () => {
      const prov = github()
      const calls = stubFetch(call => call.url.includes('/graphql')
        ? json({ data: {} })
        : json({ node_id: 'I_x' }))

      expect(await prov.pinIssue(11)).toBe(true)
      expect(await prov.unpinIssue(11)).toBe(true)

      const bodies = calls.filter(c => c.url.includes('/graphql')).map(c => c.body ?? '')
      expect(bodies[0]).toContain('pinIssue(input')
      expect(bodies[0]).not.toContain('unpinIssue')
      expect(bodies[1]).toContain('unpinIssue(input')
    })

    it('failure case - an unreadable issue reads as not pinned rather than a thrown error', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      expect(await github().pinIssue(11)).toBe(false)
    })
  })

  describe('branchExists', () => {
    it('success case - an existing ref reads as true', async () => {
      stubFetch(() => json({ ref: 'refs/heads/main' }))
      expect(await github().branchExists('main')).toBe(true)
    })

    it('success case - a 404 reads as absent', async () => {
      stubFetch(() => json({ message: 'Not Found' }, 404))
      expect(await github().branchExists('gone')).toBe(false)
    })

    it('failure case - any other failure reads as conservative false', async () => {
      stubFetch(() => json({ message: 'boom' }, 500))
      expect(await github().branchExists('main')).toBe(false)
    })
  })

  describe('createBranch', () => {
    it('success case - creates the ref from the base branch SHA', async () => {
      const calls = stubFetch(call => call.method === 'POST'
        ? json({}, 201)
        : json({ object: { sha: 'abc' } }))

      await github().createBranch('buddy/new', 'main')

      const post = calls.find(c => c.method === 'POST')
      expect(post?.url).toBe('https://api.github.test/repos/owner/repo/git/refs')
      expect(JSON.parse(post?.body ?? '')).toEqual({ ref: 'refs/heads/buddy/new', sha: 'abc' })
    })

    it('failure case - a failing ref creation rejects', async () => {
      stubFetch(call => call.method === 'POST'
        ? json({ message: 'Reference already exists' }, 400)
        : json({ object: { sha: 'abc' } }))

      const error = await github().createBranch('buddy/new', 'main').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(GitHubApiError)
    })
  })
})
