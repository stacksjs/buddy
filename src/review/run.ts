import type { AiClient } from '../ai/types'
import type { GitProvider } from '../git/provider'
import { assertSupports } from '../git/provider'
import type { BuddyConfig } from '../types'
import type { Logger } from '../utils/logger'
import { createAiClient, loadLearnings, renderLearnings, selectLearnings } from '../ai'
import { runAnalyzers } from '../analysis/engine'
import { getDefaultLogger } from '../utils/logger'
import { parseUnifiedDiff } from './diff'
import { reviewDiff } from './engine'
import { composeInstructions, loadGuidelines } from './guidelines'
import type { ReviewProfile } from './engine'
import type { ReviewResult } from './findings'
import type { ReviewTrigger } from './filters'
import { reviewSkipReason } from './filters'
import { needsReview, parseReviewState, upsertReviewState } from './marker'
import type { PreparedReview } from './poster'
import { prepareReview } from './poster'

/** Inputs to a full review of a pull request. */
export interface RunReviewOptions {
  config: BuddyConfig
  provider: GitProvider
  prNumber: number
  /** Ignore previously reported findings and review the whole diff again */
  full?: boolean
  /** Post only the summary and walkthrough */
  summaryOnly?: boolean
  /** Skip when the head commit was already reviewed */
  skipIfReviewed?: boolean
  /** Override the configured review profile */
  profile?: ReviewProfile
  /** Report what would be posted without posting it */
  dryRun?: boolean
  /**
   * Client to review with; omitted means build one from config.
   *
   * Injectable for the same reason `attemptFix` takes one: an orchestration
   * that constructs its own client cannot be tested without a key, and this
   * one drifted from its second caller for exactly that long.
   */
  ai?: AiClient | null
  /**
   * Whether Buddy chose to review or was asked to (default: `requested`).
   *
   * Defaults to the permissive value so a caller that has not been taught the
   * distinction keeps working: an unasked-for filter should never silently
   * swallow a review someone requested.
   */
  trigger?: ReviewTrigger
  logger?: Logger
}

/**
 * Review a pull request end to end and post the result.
 *
 * Shared by the CLI, the `@buddy review` command and the automatic
 * trigger, so all three assemble context — guidelines, learnings, analyzer
 * findings — the same way rather than drifting apart.
 *
 * @param options - Repository context and review settings
 * @returns A short status line describing what happened
 */
/** What a pull request review produced, for callers that need more than a status line. */
export interface ReviewOutcome {
  /** A short status line describing what happened */
  status: string
  /** The review, when one was computed — absent when skipped, paused or empty */
  result?: ReviewResult
}

/**
 * Review a pull request and report both the status and the findings.
 *
 * `runReviewForPR` returns only the status line, which is all a comment reply
 * needs. The CLI needs the findings too: `--format` renders them and
 * `--fail-on` gates the exit code on them, and both were accepted on the pull
 * request path and then never applied, because the findings never came back.
 *
 * @param options - Repository context and review settings
 * @returns The status, and the review when one was computed
 */
export async function reviewPullRequest(options: RunReviewOptions): Promise<ReviewOutcome> {
  const logger = options.logger ?? getDefaultLogger()
  const { config, provider, prNumber } = options

  const prs = await provider.getPullRequests('open')
  const pr = prs.find(candidate => candidate.number === prNumber)
  if (!pr)
    return { status: `Could not find open pull request #${prNumber}.` }

  // Checked before the diff is fetched or a model is contacted, so an ignored
  // pull request costs one API call rather than a review's worth of tokens.
  const skip = reviewSkipReason(config, pr, options.trigger ?? 'requested')
  if (skip) {
    logger.info(`🔍 Skipping PR #${prNumber}: ${skip}`)
    return { status: skip }
  }

  const state = parseReviewState(pr.body)
  if (state?.paused && !options.full)
    return { status: 'Reviews are paused on this pull request. Say `@buddy resume` to restart them.' }

  const diff = await provider.getPullRequestDiff(prNumber)
  if (!diff.trim())
    return { status: 'There are no changes to review.' }

  const parsed = parseUnifiedDiff(diff)
  const changedFiles = parsed.files.map(file => file.path)
  const headSha = await provider.getPullRequestHeadSha(prNumber)

  if (options.skipIfReviewed && !needsReview(state, headSha)) {
    logger.info(`🔍 PR #${prNumber} already reviewed at ${headSha}`)
    return { status: 'Already reviewed at this commit.' }
  }

  const ai = options.ai === undefined ? createAiClient(config, logger) : options.ai

  // Analyzers run whether or not AI is configured, so a repository without a
  // key still gets secret scanning and workflow auditing on its pull requests.
  const analysis = config.analysis?.enabled === false
    ? { findings: [], ran: [], skipped: [] }
    : await runAnalyzers({
        files: changedFiles,
        root: process.cwd(),
        ...(config.analysis?.tools ? { enabled: config.analysis.tools } : {}),
        logger,
      })
  if (analysis.skipped.length > 0)
    logger.info(`⏭️  Skipped ${analysis.skipped.length} analyzer(s): ${analysis.skipped.map(entry => entry.name).join(', ')}`)

  if (!ai) {
    if (analysis.findings.length === 0)
      return { status: 'No AI provider configured and static analysis found nothing to report.' }

    const prepared = prepareReview(
      {
        summary: 'Static analysis only — no AI provider is configured.',
        walkthrough: [],
        findings: analysis.findings,
        effort: 1,
        omittedFiles: [],
      },
      {
        headSha,
        requestChangesOn: config.ai?.review?.requestChangesOn,
        suggestions: provider.capabilities().reviewSuggestions,
      },
    )

    const staticResult: ReviewResult = {
      summary: 'Static analysis only — no AI provider is configured.',
      walkthrough: [],
      findings: analysis.findings,
      effort: 1,
      omittedFiles: [],
    }

    if (options.dryRun) {
      reportDryRun(prepared, logger)
      return { status: `Would post ${analysis.findings.length} static-analysis finding(s).`, result: staticResult }
    }

    assertSupports(provider, 'inlineReviewComments', 'createReview', 'posting a review')
    const submission = await provider.createReview(prNumber, prepared)
    if (!submission.posted)
      return { status: 'The review could not be posted.', result: staticResult }

    await persistReviewState(provider, prNumber, pr.body, prepared.state, state?.paused, logger)
    return {
      status: `Posted ${analysis.findings.length} static-analysis finding(s).${placementNote(submission, prepared, logger)}`,
      result: staticResult,
    }
  }

  // Guidelines and learnings are read from the base branch: both are inlined
  // into the prompt as trusted context, so reading them from the pull
  // request's own branch would let it rewrite its own review instructions.
  const baseRef = pr.base || config.repository?.baseBranch || 'main'
  const readAtRef = (path: string, ref: string): Promise<string | null> => provider.getFileContent(path, ref)

  const [guidelines, learnings] = await Promise.all([
    loadGuidelines(readAtRef, baseRef, config.ai?.review?.guidelineFiles, logger),
    loadLearnings(readAtRef, baseRef, undefined, logger),
  ])

  const result = await reviewDiff(ai, {
    diff,
    profile: options.profile ?? config.ai?.review?.profile,
    summaryOnly: options.summaryOnly ?? config.ai?.review?.summaryOnly,
    instructions: composeInstructions({
      global: config.ai?.review?.instructions,
      guidelines,
    }),
    learnings: renderLearnings(selectLearnings(learnings, changedFiles)),
    pathFilters: config.ai?.review?.pathFilters,
    pathInstructions: config.ai?.review?.pathInstructions,
    analyzerFindings: analysis.findings,
    // A full review deliberately forgets what was already reported, which is
    // the only way to get a dismissed finding back.
    seenFingerprints: options.full ? [] : state?.fingerprints ?? [],
    logger,
  })

  const prepared = prepareReview(result, {
    headSha,
    requestChangesOn: config.ai?.review?.requestChangesOn,
    seenFingerprints: options.full ? [] : state?.fingerprints ?? [],
    suggestions: provider.capabilities().reviewSuggestions,
  })

  if (options.dryRun) {
    reportDryRun(prepared, logger)
    return { status: `Would post ${result.findings.length} finding(s).`, result }
  }

  assertSupports(provider, 'inlineReviewComments', 'createReview', 'posting a review')
  const submission = await provider.createReview(prNumber, prepared)

  // A review that never landed must not be recorded as this commit's review:
  // persisting the state anyway would make every later run skip a review
  // nobody can see.
  if (!submission.posted)
    return { status: 'The review could not be posted.', result }

  await persistReviewState(provider, prNumber, pr.body, prepared.state, state?.paused, logger)

  return {
    status: result.findings.length === 0
      ? 'Reviewed — nothing to report.'
      : `Reviewed — ${result.findings.length} finding(s) posted.${placementNote(submission, prepared, logger)}`,
    result,
  }
}

/**
 * Describe inline comments the platform dropped, or nothing.
 *
 * `createReview` reports how many line-anchored comments were actually
 * placed. A comment anchored to a line outside the diff is dropped by the
 * platform, and a review that silently loses findings reads as cleaner than
 * it is.
 *
 * @param submission - What the provider reports it published
 * @param prepared - What was asked for
 * @param logger - Logger for the warning
 * @returns A sentence to append to the status, or an empty string
 */
function placementNote(
  submission: { inlineComments: number },
  prepared: PreparedReview,
  logger: Logger,
): string {
  const dropped = prepared.comments.length - submission.inlineComments
  if (dropped <= 0)
    return ''

  logger.warn(`⚠️ ${dropped} of ${prepared.comments.length} inline comment(s) could not be placed on the diff`)
  return ` ${dropped} of ${prepared.comments.length} inline comment(s) could not be placed on the diff.`
}

/**
 * Review a pull request end to end and post the result.
 *
 * Shared by the CLI, the `@buddy review` command and the automatic
 * trigger, so all three assemble context — guidelines, learnings, analyzer
 * findings — the same way rather than drifting apart.
 *
 * @param options - Repository context and review settings
 * @returns A short status line describing what happened
 */
export async function runReviewForPR(options: RunReviewOptions): Promise<string> {
  return (await reviewPullRequest(options)).status
}



/**
 * Print a review instead of posting it.
 *
 * @param prepared - The review that would have been posted
 * @param logger - Where to print
 */
function reportDryRun(prepared: PreparedReview, logger: Logger): void {
  logger.info(`\n${prepared.body}\n`)

  for (const comment of prepared.comments)
    logger.info(`${comment.path}:${comment.line}\n${comment.body}\n`)
}

/**
 * Write the state a review established back onto the pull request.
 *
 * Separated from posting because the review itself has already landed by this
 * point: if updating the body fails — a token without write access to the
 * description, say — the findings are still on the pull request, and the worst
 * case is that the next run reviews the same commit again. That is a better
 * failure than losing the review to a bookkeeping error.
 *
 * @param provider - Git provider to write through
 * @param prNumber - Pull request to update
 * @param body - Current pull request body
 * @param state - State this review established
 * @param paused - Carried forward so persisting does not silently resume a
 * paused pull request
 * @param logger - Logger for the failure path
 */
async function persistReviewState(
  provider: GitProvider,
  prNumber: number,
  body: string | null | undefined,
  state: PreparedReview['state'],
  paused: boolean | undefined,
  logger: Logger,
): Promise<void> {
  try {
    await provider.updatePullRequest(prNumber, {
      body: upsertReviewState(body, { ...state, ...(paused ? { paused: true } : {}) }),
    })
  }
  catch (error) {
    logger.warn(`Could not record review state on PR #${prNumber}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
