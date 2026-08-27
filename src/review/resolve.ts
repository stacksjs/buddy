/**
 * Closing the review threads Buddy opened.
 *
 * `@buddy resolve` was recognised by the command parser and described in the
 * docs — "closes the threads Buddy opened, not the ones your teammates did" —
 * with no handler behind it and no provider method that could have backed one.
 */
import type { GitProvider, ReviewThread } from '../git/provider'
import type { Logger } from '../utils/logger'
import { supports } from '../git/provider'
import { getDefaultLogger } from '../utils/logger'

/** Inputs to a resolve run. */
export interface ResolveThreadsOptions {
  provider: GitProvider
  prNumber: number
  /**
   * Login whose threads may be closed.
   *
   * Defaults to the bot's own. Passing someone else's would close a human's
   * conversation, which is the thing this must not do.
   */
  author?: string
  logger?: Logger
}

/** Logins a review posted by Buddy appears under. */
const BOT_LOGINS = ['github-actions[bot]', 'buddy', 'buddy[bot]']

/**
 * Whether a thread is Buddy's to close.
 *
 * Judged by who *started* it, not who is in it. A maintainer replying to a
 * finding does not make the thread theirs, and a teammate's thread that Buddy
 * happened to comment on is still not Buddy's to close.
 *
 * @param thread - The thread in question
 * @param author - Login to match, when the caller knows it
 */
function startedByBuddy(thread: ReviewThread, author?: string): boolean {
  const opener = thread.authorLogins[0]
  if (!opener)
    return false

  return author ? opener === author : BOT_LOGINS.includes(opener)
}

/**
 * Resolve the review threads Buddy opened on a pull request.
 *
 * @param options - Provider, pull request and whose threads to close
 * @returns A short status line describing what happened
 * @example
 * ```ts
 * const status = await resolveBuddyThreads({ provider, prNumber: 128 })
 * ```
 */
export async function resolveBuddyThreads(options: ResolveThreadsOptions): Promise<string> {
  const logger = options.logger ?? getDefaultLogger()
  const { provider, prNumber } = options

  if (!supports(provider, 'reviewThreads', 'listReviewThreads'))
    return 'This provider cannot resolve review threads.'

  const threads = await provider.listReviewThreads(prNumber)
  const mine = threads.filter(thread => !thread.isResolved && startedByBuddy(thread, options.author))

  if (mine.length === 0) {
    // Distinguished deliberately: "nothing of mine is open" and "there is
    // nothing here at all" are different answers to the same request.
    return threads.length === 0
      ? 'There are no review threads on this pull request.'
      : 'None of the open threads here are mine to close.'
  }

  if (!supports(provider, 'reviewThreads', 'resolveReviewThread'))
    return 'This provider cannot resolve review threads.'

  let resolved = 0
  for (const thread of mine) {
    if (await provider.resolveReviewThread(prNumber, thread.id))
      resolved++
    else
      logger.warn(`Could not resolve thread ${thread.id} on #${prNumber}`)
  }

  if (resolved === 0)
    return `I could not close any of the ${mine.length} thread(s) I opened.`

  const partial = resolved < mine.length ? ` (${mine.length - resolved} refused)` : ''
  return `Closed ${resolved} thread(s) I opened${partial}.`
}
