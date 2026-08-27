import type { RunHistoryReader } from '../src/ci/base'
import type { WorkflowRun } from '../src/git/provider'
import { describe, expect, it } from 'bun:test'
import { failsOnBaseBranch as check } from '../src/ci/base'
import { Logger } from '../src/utils/logger'

/** The check under test, silenced so a passing suite stays readable. */
function failsOnBaseBranch(
  reader: RunHistoryReader,
  baseBranch: string,
  kind: Parameters<typeof check>[2],
): Promise<boolean> {
  return check(reader, baseBranch, kind, Logger.silent())
}

const TYPE_ERROR = `src/app.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.`
const LOCKFILE_DRIFT = `error: lockfile had changes, but lockfile is frozen`

/** A run with sensible defaults, overridable per test. */
function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 1,
    name: 'CI',
    headSha: 'abc123',
    headBranch: 'main',
    status: 'completed',
    conclusion: 'failure',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** A reader over a fixed run list and a log lookup. */
function reader(runs: WorkflowRun[], logs: Record<number, string | null> = {}): RunHistoryReader {
  return {
    listWorkflowRuns: async () => runs,
    getWorkflowRunLogs: async id => logs[id] ?? null,
  }
}

/**
 * `failsOnBase` was declared, documented and consumed by `attemptFix`, but no
 * production caller ever computed it — so a pull request against a broken base
 * branch had that breakage diagnosed, and sometimes repaired, as its own.
 */
describe('failsOnBaseBranch', () => {
  describe('what counts as inherited', () => {
    it('success case - the same failure on base is not this pull request\'s', async () => {
      const inherited = await failsOnBaseBranch(
        reader([run({ id: 7 })], { 7: TYPE_ERROR }),
        'main',
        'type-error',
      )

      expect(inherited).toBe(true)
    })

    it('failure case - a different failure on base does not excuse this one', async () => {
      // The base being red is not the question. A pull request that breaks
      // type-checking still owns that, even on a branch whose lock file has
      // drifted — and a bot that downed tools whenever base was red would be
      // useless on exactly the repositories that need it most.
      const inherited = await failsOnBaseBranch(
        reader([run({ id: 7 })], { 7: LOCKFILE_DRIFT }),
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
    })

    it('failure case - a green base is not inherited breakage', async () => {
      const inherited = await failsOnBaseBranch(
        reader([run({ id: 7, conclusion: 'success' })], { 7: TYPE_ERROR }),
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
    })

    it('edge case - a cancelled run is not a failure', async () => {
      const inherited = await failsOnBaseBranch(
        reader([run({ id: 7, conclusion: 'cancelled' })], { 7: TYPE_ERROR }),
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
    })
  })

  describe('picking which runs to trust', () => {
    it('success case - only the newest run of each workflow counts', async () => {
      // A workflow that failed and has since gone green is not failing now.
      // Reading the older run would keep declining repairs on a base branch
      // that was fixed hours ago.
      const inherited = await failsOnBaseBranch(
        reader(
          [
            run({ id: 9, name: 'CI', conclusion: 'success' }),
            run({ id: 8, name: 'CI', conclusion: 'failure' }),
          ],
          { 8: TYPE_ERROR, 9: TYPE_ERROR },
        ),
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
    })

    it('success case - a second workflow still red is found', async () => {
      // Providers interleave runs from every workflow, so the newest run
      // overall often belongs to something unrelated to the failure at hand.
      const inherited = await failsOnBaseBranch(
        reader(
          [
            run({ id: 9, name: 'Docs', conclusion: 'success' }),
            run({ id: 8, name: 'CI', conclusion: 'failure' }),
          ],
          { 8: TYPE_ERROR },
        ),
        'main',
        'type-error',
      )

      expect(inherited).toBe(true)
    })

    it('edge case - reads at most three base logs', async () => {
      const reads: number[] = []
      const runs = [1, 2, 3, 4, 5].map(id => run({ id, name: `w${id}` }))

      const inherited = await failsOnBaseBranch(
        {
          listWorkflowRuns: async () => runs,
          getWorkflowRunLogs: async (id) => {
            reads.push(id)
            return LOCKFILE_DRIFT
          },
        },
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
      expect(reads).toHaveLength(3)
    })
  })

  describe('when the history cannot be read', () => {
    it('edge case - an unreadable log does not block the remaining runs', async () => {
      const inherited = await failsOnBaseBranch(
        reader(
          [run({ id: 8, name: 'Lint' }), run({ id: 9, name: 'CI' })],
          { 8: null, 9: TYPE_ERROR },
        ),
        'main',
        'type-error',
      )

      expect(inherited).toBe(true)
    })

    it('failure case - a provider error reads as no evidence, not as breakage', async () => {
      // Declining to repair a real failure because a list call failed would be
      // a worse outcome than one repair that turns out to have been moot.
      const inherited = await failsOnBaseBranch(
        {
          listWorkflowRuns: async () => { throw new Error('403 Forbidden') },
          getWorkflowRunLogs: async () => null,
        },
        'main',
        'type-error',
      )

      expect(inherited).toBe(false)
    })

    it('edge case - no runs at all is not breakage', async () => {
      expect(await failsOnBaseBranch(reader([]), 'main', 'type-error')).toBe(false)
    })
  })

  describe('what it asks the provider for', () => {
    it('success case - asks only for completed runs on the base branch', async () => {
      let branch = ''
      let options: unknown

      await failsOnBaseBranch(
        {
          listWorkflowRuns: async (b, o) => { branch = b; options = o; return [] },
          getWorkflowRunLogs: async () => null,
        },
        'release/v2',
        'type-error',
      )

      expect(branch).toBe('release/v2')
      // An in-progress run has no conclusion to compare against yet.
      expect(options).toMatchObject({ status: 'completed' })
    })
  })
})
