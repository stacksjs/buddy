import type { BuddyConfig, PullRequest } from '../types'

/**
 * How a review came to be running.
 *
 * The distinction matters because every filter here except `enabled` describes
 * when Buddy should review *on its own*. Someone who types `@buddy review` on a
 * draft has answered the question the filter exists to ask.
 */
export type ReviewTrigger = 'automatic' | 'requested'

/** The pull request fields a filter decision needs. */
export type ReviewCandidate = Pick<PullRequest, 'title' | 'author' | 'draft'>

/**
 * Why this pull request should not be reviewed, if it should not be.
 *
 * These settings were declared, validated and documented long before anything
 * read them, so a repository that set `ai.review.enabled: false` still got
 * reviews. Each one is honoured here, in one place, rather than being scattered
 * across the two paths that post reviews.
 *
 * `undefined` means "not configured" and never means "off": reviews already
 * require both a workflow trigger and a provider key, so treating an unset flag
 * as a refusal would silently disable reviews for every existing repository.
 * Only an explicit `false` turns something off.
 *
 * @param config - Resolved Buddy configuration
 * @param pr - Pull request under consideration
 * @param trigger - Whether Buddy chose to review, or was asked to
 * @returns A human-readable reason to skip, or `null` to go ahead
 * @example
 * ```ts
 * const skip = reviewSkipReason(config, pr, 'automatic')
 * if (skip)
 *   return skip
 * ```
 */
export function reviewSkipReason(
  config: BuddyConfig,
  pr: ReviewCandidate,
  trigger: ReviewTrigger,
): string | null {
  const review = config.ai?.review

  // The one filter that also refuses an explicit request: `enabled: false` is
  // a statement about the repository, not about a particular pull request.
  if (review?.enabled === false)
    return 'AI review is disabled for this repository (`ai.review.enabled` is false).'

  if (trigger === 'requested')
    return null

  if (review?.autoReview === false)
    return 'Automatic review is off (`ai.review.autoReview` is false). Ask for one with `@buddy review`.'

  if (pr.draft && review?.drafts !== true)
    return 'This pull request is a draft. Set `ai.review.drafts` to true, or ask with `@buddy review`.'

  const keyword = matchedKeyword(pr.title, review?.ignoreTitleKeywords)
  if (keyword)
    return `The title contains \`${keyword}\` (\`ai.review.ignoreTitleKeywords\`).`

  if (matchesUsername(pr.author, review?.ignoreUsernames))
    return `Pull requests from \`${pr.author}\` are ignored (\`ai.review.ignoreUsernames\`).`

  return null
}

/**
 * The first configured keyword appearing in a title.
 *
 * Matched case-insensitively as a substring, so `wip` catches `WIP:` and
 * `[wip]` without asking anyone to write a regular expression.
 *
 * @param title - Pull request title
 * @param keywords - Configured keywords, if any
 * @returns The keyword that matched, or `null`
 */
function matchedKeyword(title: string, keywords: string[] | undefined): string | null {
  if (!keywords?.length)
    return null

  const haystack = title.toLowerCase()
  return keywords.find(keyword => keyword.trim() && haystack.includes(keyword.toLowerCase().trim())) ?? null
}

/**
 * Whether an author is on the ignore list.
 *
 * Compared case-insensitively, because GitHub logins are.
 *
 * @param author - Pull request author's login
 * @param usernames - Configured logins to ignore, if any
 */
function matchesUsername(author: string, usernames: string[] | undefined): boolean {
  if (!usernames?.length)
    return false

  const login = author.toLowerCase()
  return usernames.some(name => name.toLowerCase().trim() === login)
}
