/**
 * Turning an issue into an implementation plan.
 *
 * `planMode` was written, exported and listed in `AGENT_MODES`, and nothing
 * ever constructed it — while `@buddy plan` was a command the parser knew and
 * the docs advertised, with no handler behind it. The two gaps were the same
 * gap.
 */
import type { GitProvider } from '../git/provider'
import type { BuddyConfig } from '../types'
import type { Logger } from '../utils/logger'
import { createAiClient } from '../ai'
import { getDefaultLogger } from '../utils/logger'
import { planMode } from './modes'
import { runAgent } from './runner'
import { BUILTIN_TOOLS } from './toolbelt'
import { createReadIssueTool } from './tools/issue'

/** Inputs to a planning run. */
export interface RunPlanOptions {
  config: BuddyConfig
  provider: GitProvider
  /** Issue or pull request to plan for */
  number: number
  /** Whether the number is a pull request */
  isPullRequest: boolean
  /** Extra direction from the comment, when there was any */
  request?: string
  /** Directory the plan is researched in */
  workspace?: string
  logger?: Logger
}

/**
 * Research the repository and write an implementation plan.
 *
 * Runs in `planMode`, whose tier list is the guarantee rather than the
 * instruction: a planning run is offered read tools only, so no wording in an
 * issue body can talk it into changing the repository it is describing.
 *
 * @param options - Repository context and what to plan
 * @returns The plan, ready to post as a comment
 * @example
 * ```ts
 * const plan = await runPlan({ config, provider, number: 42, isPullRequest: false })
 * ```
 */
export async function runPlan(options: RunPlanOptions): Promise<string> {
  const logger = options.logger ?? getDefaultLogger()
  const ai = createAiClient(options.config, logger)

  if (!ai)
    return 'I need an AI provider configured to write a plan. See https://buddy.sh/ai/providers'

  const noun = options.isPullRequest ? 'pull request' : 'issue'

  // The issue text is deliberately absent from this task and reachable only
  // through `read_issue`, so the model is told which half of its context a
  // third party wrote.
  const task = [
    `Write an implementation plan for ${noun} #${options.number} in this repository.`,
    '',
    'Call `read_issue` first to see what is being asked for, then read enough of',
    'the repository to be concrete about it.',
    ...(options.request
      ? ['', 'The person asking added this direction, which comes from them rather than', 'from the repository:', `  ${options.request.replace(/\n/g, ' ')}`]
      : []),
    '',
    'Produce: the files that would change and why, the order of the work, the',
    'risks, and how the result would be verified. Prefer naming real paths you',
    'have read over describing the change in the abstract.',
    '',
    'If the request is too vague to plan, say what you would need to know',
    'instead of inventing a plan around the gap.',
  ].join('\n')

  const result = await runAgent(ai, {
    mode: planMode,
    task,
    tools: [...BUILTIN_TOOLS, createReadIssueTool(options.provider, options.number, options.isPullRequest)],
    context: {
      workspace: options.workspace ?? process.cwd(),
      baseBranch: options.config.repository?.baseBranch ?? 'main',
    },
    logger,
  })

  if (!result.output) {
    return result.stopReason === 'completed'
      ? 'I finished researching but produced no plan. That is a bug — please open an issue.'
      : `I could not finish the plan (${result.stopReason}). The issue may need narrowing.`
  }

  return result.output
}
