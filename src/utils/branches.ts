/**
 * Branch prefixes buddy opens pull requests from: the current one, then the
 * one used before the rename to buddy.
 *
 * Every "is this ours" check hard-coded `buddy/`, so pull requests opened from
 * `buddy-bot/` branches before the rename stopped being recognised anywhere:
 * the rebase checkbox found nothing to rebase, stale branches were never
 * cleaned up and auto-merge skipped them, while the update run still matched
 * them by title and kept them open.
 */
export const BUDDY_BRANCH_PREFIXES = ['buddy/', 'buddy-bot/'] as const

/** Whether a branch is one buddy opened a pull request from. */
export function isBuddyBranch(name: string | undefined | null): boolean {
  return typeof name === 'string' && BUDDY_BRANCH_PREFIXES.some(prefix => name.startsWith(prefix))
}
