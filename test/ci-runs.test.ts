import { afterEach, describe, expect, it } from 'bun:test'
import { GitHubProvider } from '../src/git/github-provider'
import { GitLabProvider } from '../src/git/gitlab-provider'
import { Logger } from '../src/utils/logger'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/** Record every request and answer each with a canned body. */
function stub(body: unknown, status = 200): { urls: string[], methods: string[] } {
  const urls: string[] = []
  const methods: string[] = []

  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    urls.push(String(input))
    methods.push(init?.method ?? 'GET')
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch

  return { urls, methods }
}

function github(): GitHubProvider {
  return new GitHubProvider('token', 'owner', 'repo', false, undefined, 'https://api.github.test', Logger.silent())
}

function gitlab(): GitLabProvider {
  return new GitLabProvider('token', 'group', 'repo', 'https://gitlab.test/api/v4', Logger.silent())
}

describe('listing workflow runs', () => {
  describe('github', () => {
    it('success case - maps a run onto the shared shape', async () => {
      stub({
        workflow_runs: [{
          id: 42,
          name: 'CI',
          head_sha: 'abc123',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'failure',
          created_at: '2026-01-01T00:00:00Z',
        }],
      })

      const [run] = await github().listWorkflowRuns('main')

      expect(run).toEqual({
        id: 42,
        name: 'CI',
        headSha: 'abc123',
        headBranch: 'main',
        status: 'completed',
        conclusion: 'failure',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
    })

    it('success case - asks for the branch and the state requested', async () => {
      const { urls } = stub({ workflow_runs: [] })
      await github().listWorkflowRuns('release/v2', { status: 'completed', limit: 5 })

      expect(urls[0]).toContain('branch=release%2Fv2')
      expect(urls[0]).toContain('status=completed')
      expect(urls[0]).toContain('per_page=5')
    })

    it('success case - a timed-out run reads as a failure', async () => {
      // `getPullRequestChecksState` already treats these as failures, and a
      // caller reasoning about red builds should see the same thing here.
      stub({ workflow_runs: [{ id: 1, status: 'completed', conclusion: 'timed_out' }] })

      expect((await github().listWorkflowRuns('main'))[0].conclusion).toBe('failure')
    })

    it('success case - a run still going has no conclusion', async () => {
      stub({ workflow_runs: [{ id: 1, status: 'in_progress', conclusion: null }] })
      const [run] = await github().listWorkflowRuns('main')

      expect(run.status).toBe('in_progress')
      expect(run.conclusion).toBeNull()
    })

    it('edge case - an unknown status is not mistaken for a finished one', async () => {
      stub({ workflow_runs: [{ id: 1, status: 'requested', conclusion: null }] })

      expect((await github().listWorkflowRuns('main'))[0].status).toBe('queued')
    })

    it('failure case - an unreadable history is no evidence rather than an error', async () => {
      // The caller is deciding whether a failure is pre-existing. Throwing
      // would fail a repair run over a question it only asked in passing.
      stub({ message: 'Not Found' }, 404)

      expect(await github().listWorkflowRuns('main')).toEqual([])
    })
  })

  describe('gitlab', () => {
    it('success case - returns jobs, whose ids getWorkflowRunLogs accepts', async () => {
      // Pipelines would be the obvious mapping and the wrong one: the log read
      // on GitLab is a job trace, so a pipeline id here would be an `id` that
      // looks interchangeable and is not.
      const { urls } = stub([{
        id: 77,
        name: 'test',
        status: 'failed',
        ref: 'main',
        created_at: '2026-01-01T00:00:00Z',
        commit: { id: 'abc123' },
      }])

      const [run] = await gitlab().listWorkflowRuns('main')

      expect(urls[0]).toContain('/jobs')
      expect(run.id).toBe(77)
      expect(run.conclusion).toBe('failure')
      expect(run.headSha).toBe('abc123')
    })

    it('success case - filters to the branch asked for', async () => {
      // GitLab cannot filter `/jobs` by ref, so it has to happen here.
      stub([
        { id: 1, status: 'failed', ref: 'other' },
        { id: 2, status: 'failed', ref: 'main' },
      ])

      const runs = await gitlab().listWorkflowRuns('main')

      expect(runs.map(run => run.id)).toEqual([2])
    })

    it('success case - a manual job counts as finished', async () => {
      // Nothing further happens to it without a person, so treating it as
      // pending would leave a caller waiting forever.
      stub([{ id: 1, status: 'manual', ref: 'main' }])
      const [run] = await gitlab().listWorkflowRuns('main')

      expect(run.status).toBe('completed')
      expect(run.conclusion).toBe('skipped')
    })

    it('success case - honours the state filter', async () => {
      stub([
        { id: 1, status: 'running', ref: 'main' },
        { id: 2, status: 'success', ref: 'main' },
      ])

      const runs = await gitlab().listWorkflowRuns('main', { status: 'completed' })

      expect(runs.map(run => run.id)).toEqual([2])
    })

    it('failure case - an unreadable history is no evidence rather than an error', async () => {
      stub({ message: '500' }, 500)

      expect(await gitlab().listWorkflowRuns('main')).toEqual([])
    })
  })
})

describe('re-running a failed run', () => {
  it('success case - github re-runs only the failed jobs by default', async () => {
    const { urls, methods } = stub({}, 201)

    expect(await github().rerunWorkflowRun(99)).toBe(true)
    expect(methods[0]).toBe('POST')
    expect(urls[0]).toContain('/actions/runs/99/rerun-failed-jobs')
  })

  it('success case - github can be asked for the whole run', async () => {
    const { urls } = stub({}, 201)
    await github().rerunWorkflowRun(99, false)

    expect(urls[0]).toEndWith('/actions/runs/99/rerun')
  })

  it('failure case - a refusal is reported rather than thrown', async () => {
    // `actions: write` is the usual reason, and losing the repair run over a
    // permission it only wanted opportunistically would be worse.
    stub({ message: 'Resource not accessible by integration' }, 403)

    expect(await github().rerunWorkflowRun(99)).toBe(false)
  })

  it('edge case - an empty 201 body is a success, not a parse error', async () => {
    globalThis.fetch = (async () => new Response('', { status: 201 })) as unknown as typeof fetch

    expect(await github().rerunWorkflowRun(99)).toBe(true)
  })

  it('success case - gitlab retries the job', async () => {
    const { urls, methods } = stub({}, 201)

    expect(await gitlab().rerunWorkflowRun(77)).toBe(true)
    expect(methods[0]).toBe('POST')
    expect(urls[0]).toContain('/jobs/77/retry')
  })

  it('failure case - gitlab reports a refusal rather than throwing', async () => {
    stub({ message: 'forbidden' }, 403)

    expect(await gitlab().rerunWorkflowRun(77)).toBe(false)
  })
})
