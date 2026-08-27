/**
 * Whether a failing check is inherited from the base branch.
 *
 * `attemptFix` has always known how to decline a pre-existing failure, but
 * nothing ever told it about one: `failsOnBase` had no production caller, so
 * every base-branch breakage was diagnosed, and sometimes repaired, as though
 * the pull request had caused it.
 */
import type { ListWorkflowRunsOptions, WorkflowRun } from '../git/provider'
import type { Logger } from '../utils/logger'
import type { FailureKind } from './classify'
import { formatError } from '../utils/errors'
import { getDefaultLogger } from '../utils/logger'
import { classifyFailure } from './classify'

/**
 * The slice of a provider this check needs.
 *
 * Narrow on purpose: the check is pure reasoning over two reads, and taking a
 * whole `GitProvider` would make it awkward to test something that deserves
 * direct tests.
 */
export interface RunHistoryReader {
  listWorkflowRuns: (branch: string, options?: ListWorkflowRunsOptions) => Promise<WorkflowRun[]>
  getWorkflowRunLogs: (runId: number) => Promise<string | null>
}

/**
 * Base-branch logs to read before giving up.
 *
 * Each one is an API round trip inside a repair run that has other work to do,
 * and a base branch red in more than three different ways is not a case worth
 * optimising for.
 */
const MAX_BASE_LOGS = 3

/**
 * Whether the base branch is already failing the same way.
 *
 * Not "is the base red" but "is the base red *in the same way*". A pull
 * request that adds a test to a repository whose lint is broken should still
 * have its own test failure diagnosed, and a bot that downed tools whenever
 * the base was red would be useless on exactly the repositories that need it.
 *
 * Comparing classifications is an approximation, and the direction it errs in
 * is deliberate. Two unrelated type errors both classify as `type-error`, so a
 * genuine regression on a base branch that already fails to type-check reads
 * as inherited — Buddy declines and says why, rather than committing a guess
 * about code it has already been told is broken.
 *
 * @param reader - Provider slice that can list runs and read their logs
 * @param baseBranch - Branch the pull request targets
 * @param kind - Failure classified from the pull request's own run
 * @param logger - Optional logger
 * @returns Whether the base branch fails the same way
 * @example
 * ```ts
 * const inherited = await failsOnBaseBranch(provider, 'main', failure.kind)
 * ```
 */
export async function failsOnBaseBranch(
  reader: RunHistoryReader,
  baseBranch: string,
  kind: FailureKind,
  logger?: Logger,
): Promise<boolean> {
  const log = logger ?? getDefaultLogger()

  try {
    const runs = await reader.listWorkflowRuns(baseBranch, { status: 'completed', limit: 20 })

    for (const run of latestFailurePerWorkflow(runs).slice(0, MAX_BASE_LOGS)) {
      const baseLog = await reader.getWorkflowRunLogs(run.id)
      if (!baseLog)
        continue

      if (classifyFailure(baseLog).kind === kind) {
        log.info(`🧭 ${baseBranch} already fails the same way (run ${run.id}) — not this pull request's to fix`)
        return true
      }
    }

    return false
  }
  catch (error) {
    // An unreadable history is no evidence either way, and the useful default
    // is to carry on: refusing to repair a real failure because a list call
    // failed would be a worse outcome than one repair that turns out moot.
    log.debug(`Could not check ${baseBranch} for a pre-existing failure: ${formatError(error)}`)
    return false
  }
}

/**
 * Reduce a run list to the newest failure of each distinct workflow.
 *
 * Providers interleave runs from every workflow, so the newest run overall
 * often belongs to something unrelated. Taking the newest *per workflow*
 * answers the question actually being asked — is this workflow red on base
 * right now — and drops a workflow whose latest run has since gone green.
 *
 * Also used to pick *which* run a comment is asking about: the same
 * interleaving that makes a base-branch check ambiguous makes "the run that
 * failed on this pull request" ambiguous too.
 *
 * @param runs - Runs, most recent first
 * @returns The newest run of each workflow, kept only where it failed
 */
export function latestFailurePerWorkflow(runs: WorkflowRun[]): WorkflowRun[] {
  const newest = new Map<string, WorkflowRun>()

  for (const run of runs) {
    if (!newest.has(run.name))
      newest.set(run.name, run)
  }

  return [...newest.values()].filter(run => run.conclusion === 'failure')
}
