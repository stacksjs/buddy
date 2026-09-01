import type { BuddyConfig, Issue, PackageFile, PackageUpdate, PullRequest, UpdateScanResult } from '../src/types'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Buddy } from '../src/buddy'
import { serializeManifest } from '../src/pr/pr-manifest'

/**
 * Orchestration-layer coverage for src/buddy.ts: the auto-merge fallback loop,
 * the satisfied-PR auto-close verifier, the dashboard pipeline driven through
 * the real GitHub provider against a stubbed fetch, and the pure grouping and
 * dedup helpers. Everything runs offline — the preload fetch guard stays armed
 * except where a test installs its own stub, and every global touched here
 * (env tokens, fetch, prototype spies) is restored in afterEach.
 */

const DASHBOARD_MARKER = 'This issue lists Buddy updates and detected dependencies'

const MANAGED_ENV_VARS = [
  'GITHUB_TOKEN',
  'BUDDY_TOKEN',
  'GH_TOKEN',
  'GITHUB_REPOSITORY',
  'GITHUB_API_URL',
  'CI_PROJECT_PATH',
  'BITBUCKET_REPO_FULL_NAME',
] as const

let savedEnv: Record<string, string | undefined> = {}
let originalFetch: typeof globalThis.fetch
const restorers: Array<() => void> = []

beforeEach(() => {
  savedEnv = {}
  for (const name of MANAGED_ENV_VARS) {
    savedEnv[name] = process.env[name]
    delete process.env[name]
  }
  originalFetch = globalThis.fetch
})

afterEach(() => {
  for (const name of MANAGED_ENV_VARS) {
    const value = savedEnv[name]
    if (value === undefined)
      delete process.env[name]
    else
      process.env[name] = value
  }
  globalThis.fetch = originalFetch
  while (restorers.length > 0) {
    const restore = restorers.pop()
    restore?.()
  }
})

function makeUpdate(overrides: Partial<PackageUpdate> = {}): PackageUpdate {
  return {
    name: 'lodash',
    currentVersion: '4.17.20',
    newVersion: '4.17.21',
    updateType: 'patch',
    dependencyType: 'dependencies',
    file: 'package.json',
    ...overrides,
  }
}

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 101,
    title: 'chore(deps): update all non-major dependencies',
    body: `updates${serializeManifest([makeUpdate()])}`,
    head: 'buddy/update-non-major',
    base: 'main',
    state: 'open',
    url: 'https://github.com/test-owner/test-repo/pull/101',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    author: 'github-actions[bot]',
    reviewers: [],
    assignees: [],
    labels: ['dependencies'],
    draft: false,
    ...overrides,
  }
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    number: 1,
    title: 'Some issue',
    body: 'body',
    state: 'open',
    url: 'https://github.com/test-owner/test-repo/issues/1',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    author: 'someone',
    assignees: [],
    labels: [],
    ...overrides,
  }
}

function makeScanResult(updates: PackageUpdate[]): UpdateScanResult {
  return {
    totalPackages: updates.length,
    updates,
    groups: [],
    scannedAt: new Date(0),
    duration: 1,
  }
}

function baseConfig(overrides: Record<string, unknown> = {}): BuddyConfig {
  return {
    logLevel: 'silent',
    repository: { provider: 'github', owner: 'test-owner', name: 'test-repo' },
    security: { enabled: false },
    ...overrides,
  } as BuddyConfig
}

function autoMergeConfig(overrides: Record<string, unknown> = {}): BuddyConfig {
  return baseConfig({
    pullRequest: { autoMerge: { enabled: true, strategy: 'squash', conditions: ['patch-only'] } },
    ...overrides,
  })
}

/** Spy on the private logger without letting output reach the console. */
function loggerSpy(buddy: Buddy, method: 'error' | 'warn'): any {
  const spy = spyOn((buddy as any).logger, method).mockImplementation(() => {})
  restorers.push(() => spy.mockRestore())
  return spy
}

/** Mock the inner scan `checkAndCloseSatisfiedPRs` performs, restorably. */
function stubScan(updates: PackageUpdate[]): void {
  const spy = spyOn(Buddy.prototype, 'scanForUpdates').mockResolvedValue(makeScanResult(updates))
  restorers.push(() => spy.mockRestore())
}

interface RecordedCall {
  method: string
  url: string
  body?: string
}

let fetchCalls: RecordedCall[] = []

/**
 * Replace the preload fetch guard with a URL-routed stub for one test.
 *
 * Unrouted requests come back as 400 — a non-transient status, so the
 * provider fails fast with the URL in the error instead of retrying.
 */
function stubFetch(route: (method: string, url: string) => unknown): void {
  fetchCalls = []
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input)
    const method = String(init?.method ?? 'GET').toUpperCase()
    fetchCalls.push({ method, url, body: typeof init?.body === 'string' ? init.body : undefined })
    const payload = route(method, url)
    if (payload === undefined)
      return new Response(JSON.stringify({ message: `Unrouted test request: ${method} ${url}` }), { status: 400 })
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof globalThis.fetch
}

function issueJson(number: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number,
    title: 'Dependency Dashboard',
    body: 'existing body',
    state: 'open',
    html_url: `https://github.com/test-owner/test-repo/issues/${number}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    closed_at: null,
    user: { login: 'github-actions[bot]' },
    assignees: [],
    labels: [],
    ...overrides,
  }
}

describe('buddy orchestration', () => {
  describe('mergeEligiblePullRequests', () => {
    function makeMergeProvider(prs: PullRequest[], checksState?: string): any {
      const provider: any = {
        capabilities: () => ({ nativeAutoMerge: true }),
        getPullRequests: mock(() => Promise.resolve(prs)),
        mergePullRequest: mock(() => Promise.resolve()),
      }
      if (checksState !== undefined)
        provider.getPullRequestChecksState = mock(() => Promise.resolve(checksState))
      return provider
    }

    it('success case - merges a green patch-only buddy PR and reports its number', async () => {
      const provider = makeMergeProvider([makePR()], 'success')
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider

      const merged = await buddy.mergeEligiblePullRequests()

      expect(merged).toEqual([101])
      expect(provider.mergePullRequest).toHaveBeenCalledWith(101, 'squash')
    })

    it('failure case - refuses a PR whose checks are failing', async () => {
      const provider = makeMergeProvider([makePR()], 'failure')
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider

      expect(await buddy.mergeEligiblePullRequests()).toEqual([])
      expect(provider.mergePullRequest).not.toHaveBeenCalled()
    })

    it('failure case - refuses a PR whose checks are still pending', async () => {
      const provider = makeMergeProvider([makePR()], 'pending')
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider

      expect(await buddy.mergeEligiblePullRequests()).toEqual([])
      expect(provider.mergePullRequest).not.toHaveBeenCalled()
    })

    it('edge case - a repository with no checks at all still merges', async () => {
      // No getPullRequestChecksState on the provider means checks === 'none':
      // nothing to wait for, only an explicit failure blocks the merge.
      const provider = makeMergeProvider([makePR()])
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider

      expect(await buddy.mergeEligiblePullRequests()).toEqual([101])
      expect(provider.mergePullRequest).toHaveBeenCalledWith(101, 'squash')
    })

    it('success case - dry run lists would-merge PRs without touching the provider', async () => {
      const provider = makeMergeProvider([makePR()], 'success')
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider

      expect(await buddy.mergeEligiblePullRequests(true)).toEqual([101])
      expect(provider.mergePullRequest).not.toHaveBeenCalled()
    })

    it('failure case - swallows a provider merge failure and continues to the next PR', async () => {
      const prs = [
        makePR({ number: 101, head: 'buddy/update-a' }),
        makePR({ number: 102, head: 'buddy/update-b' }),
      ]
      const provider = makeMergeProvider(prs, 'success')
      provider.mergePullRequest = mock((prNumber: number) =>
        prNumber === 101 ? Promise.reject(new Error('merge conflict')) : Promise.resolve())
      const buddy = new Buddy(autoMergeConfig())
      ;(buddy as any).createGitProvider = async () => provider
      loggerSpy(buddy, 'warn')

      const merged = await buddy.mergeEligiblePullRequests()

      expect(merged).toEqual([102])
      expect(provider.mergePullRequest).toHaveBeenCalledTimes(2)
    })

    it('edge case - returns empty when auto-merge is disabled, without building a provider', async () => {
      const buddy = new Buddy(baseConfig())
      const factory = mock(() => Promise.resolve(makeMergeProvider([makePR()], 'success')))
      ;(buddy as any).createGitProvider = factory

      expect(await buddy.mergeEligiblePullRequests()).toEqual([])
      expect(factory).not.toHaveBeenCalled()
    })

    it('edge case - returns empty when no provider can be built', async () => {
      // Auto-merge enabled but no repository configured and no env tokens:
      // createGitProvider degrades to null and the run reports nothing merged.
      const buddy = new Buddy(autoMergeConfig({ repository: undefined }))
      loggerSpy(buddy, 'warn')

      expect(await buddy.mergeEligiblePullRequests()).toEqual([])
    })
  })

  describe('queueAutoMerge', () => {
    const pr = { number: 7, title: 't', body: 'b', head: 'buddy/update-x', labels: [], draft: false }

    it('failure case - respects the nativeAutoMerge capability gate', async () => {
      const provider: any = {
        capabilities: () => ({ nativeAutoMerge: false }),
        enableAutoMerge: mock(() => Promise.resolve(true)),
      }
      const buddy = new Buddy(autoMergeConfig())

      await (buddy as any).queueAutoMerge(provider, pr, [makeUpdate()], [])

      expect(provider.enableAutoMerge).not.toHaveBeenCalled()
    })

    it('edge case - a refused queue request does not throw', async () => {
      const provider: any = {
        capabilities: () => ({ nativeAutoMerge: true }),
        enableAutoMerge: mock(() => Promise.resolve(false)),
      }
      const buddy = new Buddy(autoMergeConfig())

      await (buddy as any).queueAutoMerge(provider, pr, [makeUpdate()], [])

      expect(provider.enableAutoMerge).toHaveBeenCalledWith(7, 'squash')
    })

    it('failure case - swallows an enableAutoMerge rejection', async () => {
      // A PR that could not be queued is still a perfectly good PR.
      const provider: any = {
        capabilities: () => ({ nativeAutoMerge: true }),
        enableAutoMerge: mock(() => Promise.reject(new Error('no required checks'))),
      }
      const buddy = new Buddy(autoMergeConfig())
      loggerSpy(buddy, 'warn')

      await (buddy as any).queueAutoMerge(provider, pr, [makeUpdate()], [])

      expect(provider.enableAutoMerge).toHaveBeenCalledTimes(1)
    })
  })

  describe('checkAndCloseSatisfiedPRs', () => {
    function makeCloseProvider(prs: PullRequest[]): any {
      return {
        getPullRequests: mock(() => Promise.resolve(prs)),
        createComment: mock(() => Promise.resolve()),
        closePullRequest: mock(() => Promise.resolve()),
        deleteBranch: mock(() => Promise.resolve()),
      }
    }

    function lodashPR(): PullRequest {
      return makePR({
        number: 123,
        head: 'buddy/update-lodash',
        body: `updates${serializeManifest([makeUpdate({ name: 'lodash', currentVersion: '4.17.20', newVersion: '4.17.21' })])}`,
      })
    }

    it('success case - closes a PR whose every package is verifiably at or beyond target', async () => {
      stubScan([makeUpdate({ name: 'lodash', currentVersion: '4.17.21', newVersion: '4.17.22' })])
      const provider = makeCloseProvider([lodashPR()])
      const buddy = new Buddy(baseConfig())

      await buddy.checkAndCloseSatisfiedPRs(provider, false)

      expect(provider.createComment).toHaveBeenCalledTimes(1)
      const [prNumber, comment] = provider.createComment.mock.calls[0]
      expect(prNumber).toBe(123)
      expect(comment).toContain('lodash')
      expect(provider.closePullRequest).toHaveBeenCalledWith(123)
      expect(provider.deleteBranch).toHaveBeenCalledWith('buddy/update-lodash')
    })

    it('failure case - never closes on an empty scan (mass-closure guard)', async () => {
      // A scan returning nothing may mean bun outdated failed or the registry
      // rate-limited — closing every PR on that evidence would wipe them out.
      stubScan([])
      const provider = makeCloseProvider([lodashPR()])
      const buddy = new Buddy(baseConfig())
      loggerSpy(buddy, 'warn')

      await buddy.checkAndCloseSatisfiedPRs(provider, false)

      expect(provider.createComment).not.toHaveBeenCalled()
      expect(provider.closePullRequest).not.toHaveBeenCalled()
    })

    it('failure case - keeps a PR open when its package is absent from the scan (unverifiable)', async () => {
      stubScan([makeUpdate({ name: 'react', currentVersion: '18.0.0', newVersion: '18.2.0' })])
      const provider = makeCloseProvider([lodashPR()])
      const buddy = new Buddy(baseConfig())

      await buddy.checkAndCloseSatisfiedPRs(provider, false)

      expect(provider.closePullRequest).not.toHaveBeenCalled()
    })

    it('failure case - keeps a PR open when the scan still wants the same target version', async () => {
      stubScan([makeUpdate({ name: 'lodash', currentVersion: '4.17.20', newVersion: '4.17.21' })])
      const provider = makeCloseProvider([lodashPR()])
      const buddy = new Buddy(baseConfig())

      await buddy.checkAndCloseSatisfiedPRs(provider, false)

      expect(provider.closePullRequest).not.toHaveBeenCalled()
    })

    it('failure case - one unverifiable package keeps a multi-package PR open', async () => {
      const twoPackagePR = makePR({
        number: 124,
        head: 'buddy/update-two',
        body: `updates${serializeManifest([
          makeUpdate({ name: 'lodash', currentVersion: '4.17.20', newVersion: '4.17.21' }),
          makeUpdate({ name: 'express', currentVersion: '4.18.0', newVersion: '4.18.2' }),
        ])}`,
      })
      // lodash is verifiably satisfied, express is absent from the scan: the
      // zero-unverifiable rule must keep the PR open.
      stubScan([makeUpdate({ name: 'lodash', currentVersion: '4.17.21', newVersion: '4.17.22' })])
      const provider = makeCloseProvider([twoPackagePR])
      const buddy = new Buddy(baseConfig())

      await buddy.checkAndCloseSatisfiedPRs(provider, false)

      expect(provider.closePullRequest).not.toHaveBeenCalled()
    })

    it('edge case - dry run counts closures without performing them', async () => {
      stubScan([makeUpdate({ name: 'lodash', currentVersion: '4.17.21', newVersion: '4.17.22' })])
      const provider = makeCloseProvider([lodashPR()])
      const buddy = new Buddy(baseConfig())

      await buddy.checkAndCloseSatisfiedPRs(provider, true)

      expect(provider.createComment).not.toHaveBeenCalled()
      expect(provider.closePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('compareVersionsSafe', () => {
    it('distinguishes at-or-beyond, behind, and failed', () => {
      const buddy = new Buddy(baseConfig()) as any

      expect(buddy.compareVersionsSafe('4.17.21', '4.17.21')).toBe('at-or-beyond')
      expect(buddy.compareVersionsSafe('4.17.22', '4.17.21')).toBe('at-or-beyond')
      expect(buddy.compareVersionsSafe('4.17.20', '4.17.21')).toBe('behind')
      // GH-Actions-style short versions must fail the comparison rather than
      // report a verdict — a false 'at-or-beyond' would close a live PR.
      expect(buddy.compareVersionsSafe('v4', '4.2.2')).toBe('failed')
      expect(buddy.compareVersionsSafe('garbage', '1.0.0')).toBe('failed')
    })
  })

  describe('createOrUpdateDashboard', () => {
    let projectDir: string

    beforeEach(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-test-'))
      fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'dash-fixture', version: '1.0.0' }),
      )
    })

    afterEach(() => {
      fs.rmSync(projectDir, { recursive: true, force: true })
    })

    function dashboardConfig(overrides: Record<string, unknown> = {}): BuddyConfig {
      return {
        logLevel: 'silent',
        repository: { provider: 'github', owner: 'test-owner', name: 'test-repo', token: 'test-token' },
        security: { enabled: false },
        packages: { detectResolutionDrift: false },
        dashboard: {},
        ...overrides,
      } as BuddyConfig
    }

    it('success case - creates a fresh issue through the real GitHub provider offline', async () => {
      stubFetch((method, url) => {
        if (method === 'GET' && url.includes('/pulls?'))
          return []
        if (method === 'GET' && url.includes('/issues?'))
          return []
        if (method === 'POST' && url.endsWith('/issues'))
          return issueJson(42)
        return undefined
      })

      const buddy = new Buddy(dashboardConfig(), projectDir)
      const issue = await buddy.createOrUpdateDashboard()

      expect(issue.number).toBe(42)

      const post = fetchCalls.find(call => call.method === 'POST' && call.url.endsWith('/issues'))
      expect(post).toBeDefined()
      expect(post?.url).toContain('/repos/test-owner/test-repo/issues')
      const payload = JSON.parse(post?.body ?? '{}')
      expect(payload.title).toBe('Dependency Dashboard')
      expect(payload.body).toContain(DASHBOARD_MARKER)
      expect(payload.labels).toEqual(['dependencies', 'dashboard'])
      // pin was not configured, so no pin/unpin GraphQL traffic happens.
      expect(fetchCalls.some(call => call.url.includes('/graphql'))).toBe(false)
    })

    it('success case - unpins the dashboard only when config says pin false', async () => {
      stubFetch((method, url) => {
        if (method === 'GET' && url.includes('/pulls?'))
          return []
        if (method === 'GET' && url.includes('/issues?'))
          return []
        if (method === 'POST' && url.endsWith('/issues'))
          return issueJson(42)
        if (method === 'GET' && url.includes('/issues/42'))
          return { ...issueJson(42), node_id: 'node-42' }
        if (method === 'POST' && url.endsWith('/graphql'))
          return { data: { unpinIssue: { issue: { number: 42 } } } }
        return undefined
      })

      const buddy = new Buddy(dashboardConfig({ dashboard: { pin: false } }), projectDir)
      await buddy.createOrUpdateDashboard()

      const graphql = fetchCalls.find(call => call.url.endsWith('/graphql'))
      expect(graphql).toBeDefined()
      expect(graphql?.body).toContain('unpinIssue')
    })

    it('success case - updates an existing marker-bearing issue instead of creating a duplicate', async () => {
      stubFetch((method, url) => {
        if (method === 'GET' && url.includes('/pulls?'))
          return []
        if (method === 'GET' && url.includes('/issues?'))
          return [issueJson(7, { title: 'Anything', body: `intro\n\n${DASHBOARD_MARKER}. Read the docs.` })]
        if (method === 'PATCH' && url.includes('/issues/7'))
          return issueJson(7)
        return undefined
      })

      const buddy = new Buddy(dashboardConfig(), projectDir)
      const issue = await buddy.createOrUpdateDashboard()

      expect(issue.number).toBe(7)
      expect(fetchCalls.some(call => call.method === 'PATCH' && call.url.includes('/issues/7'))).toBe(true)
      expect(fetchCalls.some(call => call.method === 'POST' && call.url.endsWith('/issues'))).toBe(false)
    })

    it('failure case - rejects non-GitHub providers with a clear error', async () => {
      const buddy = new Buddy(
        { logLevel: 'silent', repository: { provider: 'gitlab', owner: 'o', name: 'r' } } as BuddyConfig,
        projectDir,
      )

      await expect(buddy.createOrUpdateDashboard()).rejects.toThrow('only supported for GitHub')
    })

    it('failure case - rejects a repository missing owner and name', async () => {
      const buddy = new Buddy(
        { logLevel: 'silent', repository: { provider: 'github' } } as unknown as BuddyConfig,
        projectDir,
      )

      await expect(buddy.createOrUpdateDashboard()).rejects.toThrow('owner and name are required')
    })
  })

  describe('findExistingDashboard', () => {
    function findDashboard(provider: unknown, issueNumber?: number): Promise<Issue | null> {
      const buddy = new Buddy(baseConfig())
      return (buddy as any).findExistingDashboard(provider, issueNumber)
    }

    it('success case - the body marker alone identifies a dashboard', async () => {
      const dashboard = makeIssue({ number: 9, title: 'Renamed by hand', body: `${DASHBOARD_MARKER}.`, labels: [] })
      const provider = { getIssues: mock(() => Promise.resolve([dashboard])) }

      const found = await findDashboard(provider)

      expect(found?.number).toBe(9)
    })

    it('success case - labels plus title still match a pre-marker dashboard', async () => {
      const dashboard = makeIssue({
        number: 10,
        title: 'Dependency Dashboard',
        body: 'older body',
        labels: ['dashboard', 'dependencies'],
      })
      const provider = { getIssues: mock(() => Promise.resolve([dashboard])) }

      const found = await findDashboard(provider)

      expect(found?.number).toBe(10)
    })

    it('failure case - never adopts a foreign title-only dashboard', async () => {
      // Renovate's dashboard has the same title; adopting it would overwrite
      // a different tool's issue.
      const foreign = makeIssue({ number: 11, title: 'Dependency Dashboard', body: 'not ours', labels: [] })
      const provider = { getIssues: mock(() => Promise.resolve([foreign])) }

      expect(await findDashboard(provider)).toBeNull()
    })

    it('failure case - a getIssues failure degrades to null instead of throwing', async () => {
      const provider = { getIssues: mock(() => Promise.reject(new Error('api down'))) }

      expect(await findDashboard(provider)).toBeNull()
    })

    it('success case - honors an explicit issueNumber even without marker or labels', async () => {
      const plain = makeIssue({ number: 42, title: 'My deps', body: 'plain', labels: [] })
      const provider = { getIssues: mock(() => Promise.resolve([plain])) }

      const found = await findDashboard(provider, 42)

      expect(found?.number).toBe(42)
    })

    it('failure case - reports a configured issueNumber that no longer exists as null', async () => {
      const provider = { getIssues: mock(() => Promise.resolve([makeIssue({ number: 1 })])) }
      const buddy = new Buddy(baseConfig())
      loggerSpy(buddy, 'warn')

      expect(await (buddy as any).findExistingDashboard(provider, 42)).toBeNull()
    })
  })

  describe('createPullRequests guard clauses', () => {
    it('failure case - returns early when no repository is configured', async () => {
      const buddy = new Buddy({ logLevel: 'silent' } as BuddyConfig)
      const errorSpy = loggerSpy(buddy, 'error')

      await buddy.createPullRequests(makeScanResult([]))

      expect(errorSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('Repository configuration required'))).toBe(true)
    })

    it('failure case - returns early when owner or name is missing', async () => {
      const buddy = new Buddy({ logLevel: 'silent', repository: { provider: 'github' } } as unknown as BuddyConfig)
      const errorSpy = loggerSpy(buddy, 'error')

      await buddy.createPullRequests(makeScanResult([]))

      expect(errorSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('owner and name are required'))).toBe(true)
    })

    it('failure case - returns early when no token is in the environment', async () => {
      const buddy = new Buddy(baseConfig())
      const errorSpy = loggerSpy(buddy, 'error')

      await buddy.createPullRequests(makeScanResult([]))

      expect(errorSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('GITHUB_TOKEN or BUDDY_TOKEN'))).toBe(true)
    })

    it('edge case - skips a workflow-file-only group when BUDDY_TOKEN is absent (#1359)', async () => {
      // GITHUB_TOKEN cannot push workflow files; without the skip, the run
      // would create a branch plus empty commit and fail to open the PR,
      // leaving an orphan branch every run.
      process.env.GITHUB_TOKEN = 'test-token'
      const buddy = new Buddy(baseConfig())
      const warnSpy = loggerSpy(buddy, 'warn')

      const update = makeUpdate({
        name: 'actions/checkout',
        currentVersion: 'v4',
        newVersion: 'v4.2.2',
        updateType: 'minor',
        dependencyType: 'github-actions',
        file: '.github/workflows/ci.yml',
      })
      const scanResult: UpdateScanResult = {
        ...makeScanResult([update]),
        groups: [{
          name: 'GitHub Actions',
          updates: [update],
          updateType: 'minor',
          title: 'chore(deps): update github actions',
          body: 'x',
        }],
      }

      await buddy.createPullRequests(scanResult)

      expect(warnSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('workflow-file updates require BUDDY_TOKEN'))).toBe(true)
    })
  })

  describe('run', () => {
    it('edge case - does not create PRs when no updates exist', async () => {
      const buddy = new Buddy(baseConfig({ pullRequest: {} }))
      const scanSpy = spyOn(buddy, 'scanForUpdates').mockResolvedValue(makeScanResult([]))
      const createSpy = spyOn(buddy, 'createPullRequests').mockResolvedValue(undefined)
      restorers.push(() => scanSpy.mockRestore(), () => createSpy.mockRestore())

      const result = await buddy.run()

      expect(result.updates).toEqual([])
      expect(createSpy).not.toHaveBeenCalled()
    })

    it('success case - creates PRs when updates exist and pullRequest is configured', async () => {
      const buddy = new Buddy(baseConfig({ pullRequest: {} }))
      const scanResult = makeScanResult([makeUpdate()])
      const scanSpy = spyOn(buddy, 'scanForUpdates').mockResolvedValue(scanResult)
      const createSpy = spyOn(buddy, 'createPullRequests').mockResolvedValue(undefined)
      restorers.push(() => scanSpy.mockRestore(), () => createSpy.mockRestore())

      const result = await buddy.run()

      expect(result).toBe(scanResult)
      expect(createSpy).toHaveBeenCalledTimes(1)
      expect(createSpy).toHaveBeenCalledWith(scanResult)
    })

    it('edge case - skips PR creation when pullRequest is not configured', async () => {
      const buddy = new Buddy(baseConfig())
      const scanSpy = spyOn(buddy, 'scanForUpdates').mockResolvedValue(makeScanResult([makeUpdate()]))
      const createSpy = spyOn(buddy, 'createPullRequests').mockResolvedValue(undefined)
      restorers.push(() => scanSpy.mockRestore(), () => createSpy.mockRestore())

      await buddy.run()

      expect(createSpy).not.toHaveBeenCalled()
    })
  })

  describe('groupUpdatesByConfig', () => {
    it('success case - claims by glob, filters by per-group strategy, and falls through to defaults', () => {
      const config = baseConfig({
        packages: {
          groups: [
            // Multi-star pattern first, so it claims before the broad one —
            // and pins the fix for the first-star-only regex bug.
            { name: 'FooTypes', patterns: ['@types/*-foo'] },
            { name: 'Types', patterns: ['@types/*'], strategy: 'patch' },
          ],
        },
      })
      const buddy = new Buddy(config) as any
      const updates = [
        makeUpdate({ name: '@types/node', updateType: 'minor', newVersion: '18.1.0' }),
        makeUpdate({ name: '@types/bun-foo', updateType: 'patch' }),
        makeUpdate({ name: 'react', updateType: 'patch' }),
      ]

      const groups = buddy.groupUpdatesByConfig(updates)

      const fooTypes = groups.find((group: { name: string }) => group.name === 'FooTypes')
      expect(fooTypes?.updates.map((update: PackageUpdate) => update.name)).toEqual(['@types/bun-foo'])

      // '@types/node' is claimed by the Types group but its minor update is
      // filtered out by the group's patch strategy — and a group left empty
      // by its own strategy filter is not emitted at all.
      expect(groups.find((group: { name: string }) => group.name === 'Types')).toBeUndefined()

      const nonMajor = groups.find((group: { name: string }) => group.name === 'Non-Major Updates')
      expect(nonMajor?.updates.map((update: PackageUpdate) => update.name)).toEqual(['react'])
    })

    it('edge case - a malformed glob pattern claims nothing and does not throw', () => {
      const config = baseConfig({
        packages: { groups: [{ name: 'Bad', patterns: ['['] }] },
      })
      const buddy = new Buddy(config) as any
      const updates = [makeUpdate({ name: 'react', updateType: 'patch' })]

      const groups = buddy.groupUpdatesByConfig(updates)

      expect(groups.find((group: { name: string }) => group.name === 'Bad')).toBeUndefined()
      const nonMajor = groups.find((group: { name: string }) => group.name === 'Non-Major Updates')
      expect(nonMajor?.updates.map((update: PackageUpdate) => update.name)).toEqual(['react'])
    })

    it('success case - rule-named updates form one group before legacy groups run', () => {
      const config = baseConfig({
        packages: {
          rules: [{ matchPackages: ['react*'], groupName: 'React' }],
        },
      })
      const buddy = new Buddy(config) as any
      const updates = [
        makeUpdate({ name: 'react', updateType: 'minor', newVersion: '18.3.0' }),
        makeUpdate({ name: 'react-dom', updateType: 'patch' }),
        makeUpdate({ name: 'lodash', updateType: 'patch' }),
      ]

      const groups = buddy.groupUpdatesByConfig(updates)

      const reactGroup = groups.find((group: { name: string }) => group.name === 'React')
      expect(reactGroup?.updates.map((update: PackageUpdate) => update.name).sort()).toEqual(['react', 'react-dom'])
      expect(reactGroup?.updateType).toBe('minor')

      const nonMajor = groups.find((group: { name: string }) => group.name === 'Non-Major Updates')
      expect(nonMajor?.updates.map((update: PackageUpdate) => update.name)).toEqual(['lodash'])
    })
  })

  describe('isSimilarPRTitle', () => {
    function similar(existingTitle: string, newTitle: string): boolean {
      const buddy = new Buddy(baseConfig()) as any
      return buddy.isSimilarPRTitle(existingTitle, newTitle)
    }

    it('separates ecosystems and major vs non-major groups', () => {
      // Two GitHub Actions titles land in the same PR.
      expect(similar('chore(deps): update github actions', 'chore(deps): update GitHub Actions dependencies')).toBe(true)
      // A GH-Actions PR is not the npm grouped PR.
      expect(similar('chore(deps): update github actions', 'chore(deps): update all non-major dependencies')).toBe(false)
      // Docker images share one PR.
      expect(similar('chore(deps): update docker image node', 'chore(deps): update docker image nginx')).toBe(true)
      // Major and non-major grouped PRs stay separate.
      expect(similar('chore(deps): update all non-major dependencies', 'chore(deps): update dependencies (major)')).toBe(false)
      // Same single dependency, new version: update the existing PR.
      expect(similar('chore(deps): update dependency react to v18', 'chore(deps): update dependency react to v19')).toBe(true)
      // Different dependencies are different PRs.
      expect(similar('chore(deps): update dependency react to v18', 'chore(deps): update dependency vue to v3')).toBe(false)
    })
  })

  describe('dropOverriddenUpdates', () => {
    function packageJsonFile(content: string): PackageFile {
      return { path: 'package.json', type: 'package.json', content, dependencies: [] }
    }

    it('success case - drops a pinned package but keeps one whose override admits the new version', async () => {
      const buddy = new Buddy(baseConfig()) as any
      const updates = [
        makeUpdate({ name: 'lodash', currentVersion: '4.17.20', newVersion: '4.17.21' }),
        makeUpdate({ name: 'axios', currentVersion: '1.6.0', newVersion: '1.7.0' }),
      ]
      const files = [packageJsonFile(JSON.stringify({
        overrides: { lodash: '4.17.20' },
        resolutions: { axios: '^1.0.0' },
      }))]

      const result = await buddy.dropOverriddenUpdates(updates, files)

      // lodash's exact override excludes the target; axios's range admits it.
      expect(result.map((update: PackageUpdate) => update.name)).toEqual(['axios'])
    })

    it('edge case - a manifest with unparseable JSON contributes nothing and does not throw', async () => {
      const buddy = new Buddy(baseConfig()) as any
      const updates = [makeUpdate({ name: 'lodash' })]

      const result = await buddy.dropOverriddenUpdates(updates, [packageJsonFile('{ not json')])

      expect(result).toEqual(updates)
    })
  })

  describe('checkDockerfilesForUpdates', () => {
    function dockerFile(version: string): PackageFile {
      return {
        path: 'Dockerfile',
        type: 'Dockerfile',
        content: `FROM node:${version}`,
        dependencies: [{ name: 'node', currentVersion: version, type: 'docker-image', file: 'Dockerfile' }],
      }
    }

    it('edge case - respects wildcard tags without touching the registry', async () => {
      // 'latest' short-circuits before any fetch; the preload guard proves no
      // network call happened by failing the test loudly if one did.
      const buddy = new Buddy(baseConfig()) as any

      const result = await buddy.checkDockerfilesForUpdates([dockerFile('latest')])

      expect(result).toEqual([])
    })

    it('failure case - tolerates registry failures per-image instead of failing the scan', async () => {
      stubFetch(() => undefined) // every registry request comes back 400
      const buddy = new Buddy(baseConfig()) as any

      const result = await buddy.checkDockerfilesForUpdates([dockerFile('20.11.1')])

      expect(result).toEqual([])
    })
  })

  describe('analyzeMajors', () => {
    it('edge case - returns an empty report when majorUpgrades is not enabled', async () => {
      // The contract that keeps PRs byte-identical when the feature is off:
      // no report, no draft, and no AI client constructed (the preload fetch
      // guard would catch any network attempt).
      const buddy = new Buddy({ logLevel: 'silent' } as BuddyConfig) as any

      const result = await buddy.analyzeMajors(
        [makeUpdate({ updateType: 'major', newVersion: '5.0.0' })],
        ['package.json'],
      )

      expect(result).toEqual({ report: '', draft: false })
    })
  })
})
