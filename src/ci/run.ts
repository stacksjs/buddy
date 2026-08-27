/**
 * Repair a failing run, from wherever the request came from.
 *
 * The CLI had this inline, which was fine while it was the only caller. The
 * `@buddy fix-ci` comment needs the same sequence — resolve a run, read its
 * log, diagnose, report, count the attempt — and a second copy would drift
 * from the first the way the two review paths did.
 */
import type { PullRequest } from '../types'
import type { BuddyConfig } from '../types'
import type { GitProvider } from '../git/provider'
import type { Logger } from '../utils/logger'
import type { FailureKind } from './classify'
import { assertSupports, supports } from '../git/provider'
import { formatError } from '../utils/errors'
import { getDefaultLogger } from '../utils/logger'
import { parseFixAttempts, upsertFixAttempts } from './attempts'
import { failsOnBaseBranch, latestFailurePerWorkflow } from './base'
import { attemptFix } from './fix'

/** Inputs to a repair run. */
export interface RunFixCiOptions {
  config: BuddyConfig
  provider: GitProvider
  /** Run to diagnose; resolved from the pull request when absent */
  runId?: number
  /** Pull request to report on, and where the attempt counter lives */
  prNumber?: number
  /** Diagnose and report without changing anything */
  dryRun?: boolean
  /** Diagnose without repairing, because the caller has nowhere to repair */
  analysisOnly?: boolean
  /** Directory repairs run in */
  workspace?: string
  logger?: Logger
}

/**
 * Find the run a pull request is currently red on.
 *
 * Restricted to the head commit deliberately. A branch keeps its old runs, and
 * diagnosing one from three pushes ago would produce a confident report about
 * a failure somebody already fixed.
 *
 * @param provider - Provider to read runs from
 * @param pr - The pull request in question
 * @param logger - Optional logger
 * @returns The failing run's id, or `null` when nothing at the head has failed
 */
async function resolveFailingRun(
  provider: GitProvider,
  pr: PullRequest,
  logger: Logger,
): Promise<number | null> {
  if (!supports(provider, 'ciRuns', 'listWorkflowRuns'))
    return null

  try {
    const headSha = await provider.getPullRequestHeadSha(pr.number)
    const runs = await provider.listWorkflowRuns(pr.head, { status: 'completed', limit: 30 })
    const atHead = headSha ? runs.filter(run => run.headSha === headSha) : runs

    return latestFailurePerWorkflow(atHead)[0]?.id ?? null
  }
  catch (error) {
    logger.debug(`Could not resolve the failing run for #${pr.number}: ${formatError(error)}`)
    return null
  }
}

/**
 * Diagnose a failing run and repair it when the fix is clear.
 *
 * Shared by `buddy fix-ci` and the `@buddy fix-ci` comment so both resolve the
 * run, apply the anti-loop guard and report the same way.
 *
 * @param options - Repository context and repair settings
 * @returns A short status line describing what happened
 * @example
 * ```ts
 * const status = await runFixCi({ config, provider, prNumber: 128 })
 * ```
 */
export async function runFixCi(options: RunFixCiOptions): Promise<string> {
  const logger = options.logger ?? getDefaultLogger()
  const { config, provider } = options
  const workspace = options.workspace ?? process.cwd()

  assertSupports(provider, 'ciLogs', 'getWorkflowRunLogs', 'reading CI logs')

  // The pull request carries the attempt counter, so it is fetched before
  // anything else that might spend one.
  let pullRequest: PullRequest | undefined
  if (options.prNumber) {
    const open = await provider.getPullRequests('open')
    pullRequest = open.find(candidate => candidate.number === options.prNumber)

    if (!pullRequest)
      return `Could not find open pull request #${options.prNumber}.`
  }

  const runId = options.runId
    ?? (pullRequest ? await resolveFailingRun(provider, pullRequest, logger) : null)

  if (!runId) {
    return pullRequest
      ? 'Nothing is failing at the head of this pull request, so there is nothing to diagnose.'
      : 'No run to diagnose. Pass --run-id, or --pr so I can find the failing run myself.'
  }

  const log = await provider.getWorkflowRunLogs(runId)
  if (!log) {
    logger.warn(`⚠️ Could not read the logs for run ${runId}; nothing to diagnose`)
    return `Could not read the logs for run ${runId}. They may have expired.`
  }

  const priorAttempts = parseFixAttempts(pullRequest?.body)?.attempts ?? 0
  const baseBranch = config.repository?.baseBranch ?? 'main'

  // Capability-gated rather than assumed: a provider that cannot read a run
  // history still gets the full diagnosis, it just cannot tell an inherited
  // failure from a new one.
  const canReadRuns = supports(provider, 'ciRuns', 'listWorkflowRuns')
  const canRerun = supports(provider, 'ciRuns', 'rerunWorkflowRun')

  const { createAiClient } = await import('../ai')

  const outcome = await attemptFix({
    log,
    priorAttempts,
    workspace,
    baseBranch,
    // The agent edits files. Where there is no branch to edit, it must not run
    // at all rather than run against whatever happens to be checked out.
    ai: options.analysisOnly ? null : createAiClient(config, logger),
    logger,
    dryRun: Boolean(options.dryRun),
    analysisOnly: Boolean(options.analysisOnly),
    ...(canReadRuns
      ? {
          checkBase: (kind: FailureKind) => failsOnBaseBranch(
            {
              listWorkflowRuns: (branch, listOptions) => provider.listWorkflowRuns!(branch, listOptions),
              getWorkflowRunLogs: id => provider.getWorkflowRunLogs!(id),
            },
            baseBranch,
            kind,
            logger,
          ),
        }
      : {}),
    ...(canRerun ? { rerun: () => provider.rerunWorkflowRun!(runId) } : {}),
    ...(options.analysisOnly ? {} : { regenerateLockfile: () => regenerateLockfile(workspace, logger) }),
  })

  logger.info(`\n${outcome.report}\n`)

  if (options.prNumber && !options.dryRun) {
    await provider.createComment(options.prNumber, outcome.report)

    // Only a real attempt counts. Recording the ones the guard already refused
    // would march the counter up without anything being tried.
    if (outcome.action !== 'skipped' && pullRequest) {
      try {
        await provider.updatePullRequest(options.prNumber, {
          body: upsertFixAttempts(pullRequest.body, priorAttempts + 1),
        })
      }
      catch (error) {
        logger.warn(`Could not record the fix attempt on PR #${options.prNumber}: ${formatError(error)}`)
      }
    }
  }

  return `${outcome.action}${outcome.fixed ? ' (fixed)' : ''}`
}

/**
 * Regenerate every lock file in the workspace and land the result.
 *
 * @param workspace - Directory to regenerate in
 * @param logger - Logger for per-manager failures
 * @returns What was rewritten, and whether it reached the branch
 */
async function regenerateLockfile(workspace: string, logger: Logger): Promise<{ regenerated: boolean, pushed: boolean }> {
  const { regenerateLockFile, detectRequiredPackageManagers, getAllLockFilePaths } = await import('../utils/lock-file')
  const { commitAndPush } = await import('../utils/git')

  // Detection keys off the manifests a lock file is derived from, so a
  // repository with several ecosystems regenerates each of them.
  const managers = detectRequiredPackageManagers(['package.json', 'composer.json'])
  let regenerated = false

  for (const manager of managers) {
    const result = await regenerateLockFile(manager, workspace)
    if (result.success)
      regenerated = true
    else
      logger.warn(`⚠️ ${result.message}`)
  }

  if (!regenerated)
    return { regenerated: false, pushed: false }

  // Rewriting the file in a workspace that is about to be thrown away repairs
  // nothing. The job checked this branch out with credentials, so the commit
  // is a local one rather than a branch recreation.
  try {
    const pushed = await commitAndPush(
      getAllLockFilePaths(),
      'fix(deps): regenerate the lock file\n\nThe lock file had drifted from the manifest, which failed CI.',
      workspace,
    )
    return { regenerated: true, pushed }
  }
  catch (error) {
    logger.warn(`⚠️ Could not push the regenerated lock file: ${formatError(error)}`)
    return { regenerated: true, pushed: false }
  }
}
