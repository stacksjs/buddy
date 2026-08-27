import type { GitProvider, ListWorkflowRunsOptions, WorkflowRun } from '../src/git/provider'
import type { PullRequest } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { runFixCi } from '../src/ci/run'
import { NO_CAPABILITIES } from '../src/git/provider'
import { Logger } from '../src/utils/logger'

const FLAKE_LOG = `error: request to https://registry.npmjs.org/react failed, reason: ECONNRESET`
const TYPE_ERROR_LOG = `src/app.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.`

interface Recorded {
  comments: Array<{ pr: number, body: string }>
  updates: Array<{ pr: number, body?: string }>
  rerun: number[]
  logsRead: number[]
}

interface StubOptions {
  runs?: WorkflowRun[]
  /** Runs on the base branch; empty means the base is green */
  baseRuns?: WorkflowRun[]
  logs?: Record<number, string | null>
  headSha?: string
  prBody?: string
  ciRuns?: boolean
  openPrs?: boolean
}

/** A provider with just enough surface for a repair run, and a record of it. */
function stub(options: StubOptions = {}): { provider: GitProvider, recorded: Recorded } {
  const recorded: Recorded = { comments: [], updates: [], rerun: [], logsRead: [] }
  const headSha = options.headSha ?? 'head1'

  const pr = {
    number: 7,
    title: 'chore(deps): bump x',
    body: options.prBody ?? 'description',
    head: 'buddy/update-x',
    base: 'main',
    state: 'open',
  } as PullRequest

  const provider = {
    capabilities: () => ({ ...NO_CAPABILITIES, ciLogs: true, ciRuns: options.ciRuns ?? true }),
    getPullRequests: async () => (options.openPrs === false ? [] : [pr]),
    getPullRequestHeadSha: async () => headSha,
    // Branch-aware, because `failsOnBaseBranch` asks about `main` with the
    // same call. A stub that answered identically for every branch would make
    // every failure look inherited.
    listWorkflowRuns: async (branch: string, _o?: ListWorkflowRunsOptions) =>
      (branch === pr.head ? options.runs ?? [] : options.baseRuns ?? []),
    getWorkflowRunLogs: async (id: number) => {
      recorded.logsRead.push(id)
      return options.logs?.[id] ?? null
    },
    rerunWorkflowRun: async (id: number) => {
      recorded.rerun.push(id)
      return true
    },
    createComment: async (prNumber: number, body: string) => {
      recorded.comments.push({ pr: prNumber, body })
    },
    updatePullRequest: async (prNumber: number, patch: { body?: string }) => {
      recorded.updates.push({ pr: prNumber, body: patch.body })
      return pr
    },
  } as unknown as GitProvider

  return { provider, recorded }
}

function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 1,
    name: 'CI',
    headSha: 'head1',
    headBranch: 'buddy/update-x',
    status: 'completed',
    conclusion: 'failure',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const base = { config: {}, logger: Logger.silent() }

/**
 * `@buddy fix-ci` used to refuse outright — "a comment does not tell me which
 * run failed". It can be told now, by looking at what is red at the head.
 */
describe('runFixCi', () => {
  describe('finding the run', () => {
    it('success case - resolves the failing run from a pull request', async () => {
      const { provider, recorded } = stub({
        runs: [run({ id: 55 })],
        logs: { 55: TYPE_ERROR_LOG },
      })

      await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(recorded.logsRead).toContain(55)
    })

    it('success case - an explicit run id wins over the lookup', async () => {
      const { provider, recorded } = stub({ logs: { 99: TYPE_ERROR_LOG } })

      await runFixCi({ ...base, provider, runId: 99, prNumber: 7, analysisOnly: true })

      expect(recorded.logsRead).toEqual([99])
    })

    it('failure case - ignores a run from an older commit', async () => {
      // A branch keeps its old runs. Diagnosing one from three pushes ago
      // produces a confident report about a failure somebody already fixed.
      const { provider } = stub({
        runs: [run({ id: 55, headSha: 'stale' })],
        logs: { 55: TYPE_ERROR_LOG },
        headSha: 'head1',
      })

      const status = await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(status).toContain('Nothing is failing')
    })

    it('success case - a green head is reported as nothing to do', async () => {
      const { provider } = stub({ runs: [run({ conclusion: 'success' })] })

      expect(await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true }))
        .toContain('Nothing is failing')
    })

    it('edge case - only the newest run of each workflow counts', async () => {
      // A workflow that failed and has since gone green is not failing now.
      const { provider } = stub({
        runs: [
          run({ id: 9, name: 'CI', conclusion: 'success' }),
          run({ id: 8, name: 'CI', conclusion: 'failure' }),
        ],
        logs: { 8: TYPE_ERROR_LOG },
      })

      expect(await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true }))
        .toContain('Nothing is failing')
    })

    it('edge case - a provider that cannot list runs says what it needs', async () => {
      const { provider } = stub({ ciRuns: false })

      expect(await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true }))
        .toContain('Nothing is failing')
    })

    it('failure case - a missing pull request is reported, not thrown', async () => {
      const { provider } = stub({ openPrs: false })

      expect(await runFixCi({ ...base, provider, prNumber: 7 })).toContain('Could not find')
    })

    it('failure case - no run and no pull request explains both ways in', async () => {
      const { provider } = stub()

      expect(await runFixCi({ ...base, provider })).toContain('--run-id')
    })

    it('edge case - expired logs are reported rather than diagnosed blank', async () => {
      const { provider } = stub({ runs: [run({ id: 55 })], logs: { 55: null } })

      expect(await runFixCi({ ...base, provider, prNumber: 7 })).toContain('expired')
    })
  })

  describe('answering from a comment', () => {
    it('success case - diagnoses without touching the workspace', async () => {
      // The comment job checks out the default branch, so a repair here would
      // change the wrong tree entirely.
      const { provider, recorded } = stub({
        runs: [run({ id: 55 })],
        logs: { 55: 'error: lockfile had changes, but lockfile is frozen' },
      })

      const status = await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(status).toBe('reported')
      expect(recorded.comments[0].body).toContain('Regenerating the lock file would fix this')
      expect(recorded.comments[0].body).toContain('wrong tree')
    })

    it('success case - still re-runs a flake, which needs no checkout', async () => {
      const { provider, recorded } = stub({ runs: [run({ id: 55 })], logs: { 55: FLAKE_LOG } })

      const status = await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(recorded.rerun).toEqual([55])
      expect(status).toBe('retry')
    })

    it('success case - names who will apply the fix it cannot', async () => {
      const { provider, recorded } = stub({ runs: [run({ id: 55 })], logs: { 55: TYPE_ERROR_LOG } })

      await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(recorded.comments[0].body).toContain('`fix-ci` job')
    })
  })

  describe('reporting and the attempt counter', () => {
    it('success case - posts the report to the pull request', async () => {
      const { provider, recorded } = stub({ runs: [run({ id: 55 })], logs: { 55: TYPE_ERROR_LOG } })

      await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(recorded.comments[0].pr).toBe(7)
      expect(recorded.comments[0].body).toContain('CI failure analysis')
    })

    it('success case - records the attempt on the pull request', async () => {
      const { provider, recorded } = stub({ runs: [run({ id: 55 })], logs: { 55: TYPE_ERROR_LOG } })

      await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(recorded.updates[0].body).toContain('buddy:fix-ci')
    })

    it('failure case - a refused attempt does not spend one', async () => {
      // Marching the counter up for attempts the guard already refused would
      // exhaust it without anything having been tried.
      const { provider, recorded } = stub({
        runs: [run({ id: 55 })],
        logs: { 55: TYPE_ERROR_LOG },
        prBody: 'desc\n\n<!-- buddy:fix-ci v1\n{"attempts":3}\n-->',
      })

      const status = await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(status).toBe('skipped')
      expect(recorded.updates).toHaveLength(0)
    })

    it('success case - a dry run posts nothing and spends nothing', async () => {
      const { provider, recorded } = stub({ runs: [run({ id: 55 })], logs: { 55: TYPE_ERROR_LOG } })

      await runFixCi({ ...base, provider, prNumber: 7, dryRun: true, analysisOnly: true })

      expect(recorded.comments).toHaveLength(0)
      expect(recorded.updates).toHaveLength(0)
    })
  })
  describe('inherited failures, end to end', () => {
    it('success case - declines a failure the base branch already has', async () => {
      const { provider, recorded } = stub({
        runs: [run({ id: 55 })],
        baseRuns: [run({ id: 60, headBranch: 'main' })],
        logs: { 55: TYPE_ERROR_LOG, 60: TYPE_ERROR_LOG },
      })

      const status = await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })

      expect(status).toBe('skipped')
      expect(recorded.comments[0].body).toContain('base branch')
    })

    it('success case - a differently-broken base does not excuse this failure', async () => {
      const { provider } = stub({
        runs: [run({ id: 55 })],
        baseRuns: [run({ id: 60, headBranch: 'main' })],
        logs: { 55: TYPE_ERROR_LOG, 60: 'error: lockfile had changes, but lockfile is frozen' },
      })

      expect(await runFixCi({ ...base, provider, prNumber: 7, analysisOnly: true })).toBe('reported')
    })
  })
})
