/**
 * How many times Buddy has already tried to repair a pull request.
 *
 * `attemptFix` refuses to keep trying past `maxAttempts`, but it can only do
 * that if someone tells it how many attempts came before — and a CI job has no
 * memory of its own. The count therefore lives on the pull request, the same
 * place review state does, because it is the only store that survives the run.
 */

/** Marker carrying the attempt count, hidden in the pull request body. */
const MARKER_REGEX = /<!--\s*buddy:fix-ci\s+v(\d+)\s*([\s\S]*?)-->/

/** Schema version emitted by this build. */
export const FIX_ATTEMPTS_VERSION = 1

/** Attempt bookkeeping for one pull request. */
export interface FixAttemptState {
  /** Repairs attempted so far, successful or not */
  attempts: number
  /** ISO timestamp of the most recent attempt */
  lastAttemptAt: string
}

/**
 * Read the attempt count out of a pull request body.
 *
 * A missing or unreadable marker reads as zero attempts rather than as an
 * error: the guard exists to stop a loop, and refusing to act because the
 * bookkeeping is unparseable would be a worse failure than one extra try.
 *
 * @param body - Pull request body, possibly null
 * @returns The recorded state, or `null` when absent or unreadable
 */
export function parseFixAttempts(body: string | null | undefined): FixAttemptState | null {
  if (!body)
    return null

  const match = body.match(MARKER_REGEX)
  if (!match)
    return null

  try {
    const parsed = JSON.parse(match[2].trim()) as Partial<FixAttemptState>
    const attempts = Number(parsed.attempts)
    if (!Number.isFinite(attempts) || attempts < 0)
      return null

    return {
      attempts: Math.floor(attempts),
      lastAttemptAt: typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : new Date(0).toISOString(),
    }
  }
  catch {
    return null
  }
}

/**
 * Record an attempt on a pull request body.
 *
 * Counted per pull request rather than per commit, deliberately. Buddy's own
 * repair pushes a commit, so keying the count to the head sha would reset it
 * every time a fix landed and defeat the guard it exists to provide.
 *
 * @param body - Current pull request body
 * @param attempts - Total attempts including the one just made
 * @param now - Timestamp to record
 * @returns The body with exactly one, current, marker
 * @example
 * ```ts
 * const attempts = (parseFixAttempts(pr.body)?.attempts ?? 0) + 1
 * await provider.updatePullRequest(number, { body: upsertFixAttempts(pr.body, attempts) })
 * ```
 */
export function upsertFixAttempts(body: string | null | undefined, attempts: number, now: Date = new Date()): string {
  const state: FixAttemptState = { attempts, lastAttemptAt: now.toISOString() }
  const marker = `<!-- buddy:fix-ci v${FIX_ATTEMPTS_VERSION}\n${JSON.stringify(state)}\n-->`
  const withoutMarker = (body ?? '').replace(MARKER_REGEX, '').trimEnd()

  return `${withoutMarker}\n\n${marker}`
}
