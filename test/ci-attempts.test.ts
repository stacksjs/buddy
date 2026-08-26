import { describe, expect, it } from 'bun:test'
import { attemptFix } from '../src/ci/fix'
import { parseFixAttempts, upsertFixAttempts } from '../src/ci/attempts'

const TYPE_ERROR_LOG = `src/app.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.`

/**
 * `attemptFix` has always refused to keep trying past `maxAttempts`, but no
 * production caller passed `priorAttempts`, so every failure looked like the
 * first one and the guard never engaged.
 */
describe('fix attempt tracking', () => {
  describe('marker round-trip', () => {
    it('success case - a recorded attempt reads back', () => {
      const body = upsertFixAttempts('Original description.', 1)

      expect(parseFixAttempts(body)?.attempts).toBe(1)
      expect(body).toContain('Original description.')
    })

    it('success case - recording again replaces rather than stacks', () => {
      const first = upsertFixAttempts('desc', 1)
      const second = upsertFixAttempts(first, 2)

      expect(second.match(/<!--\s*buddy:fix-ci/g)).toHaveLength(1)
      expect(parseFixAttempts(second)?.attempts).toBe(2)
    })

    it('edge case - no marker means no attempts yet', () => {
      expect(parseFixAttempts('just a description')).toBeNull()
      expect(parseFixAttempts(null)).toBeNull()
      expect(parseFixAttempts('')).toBeNull()
    })

    it('edge case - an unreadable marker reads as absent rather than throwing', () => {
      // Refusing to act because the bookkeeping is corrupt would be a worse
      // failure than one extra attempt.
      expect(() => parseFixAttempts('<!-- buddy:fix-ci v1\n{bad\n-->')).not.toThrow()
      expect(parseFixAttempts('<!-- buddy:fix-ci v1\n{bad\n-->')).toBeNull()
    })

    it('edge case - a negative count is rejected', () => {
      expect(parseFixAttempts('<!-- buddy:fix-ci v1\n{"attempts":-3}\n-->')).toBeNull()
    })

    it('success case - survives alongside the review marker', () => {
      // Both live in the pull request body; neither may eat the other.
      const withReview = 'desc\n\n<!-- buddy:review v1\n{"reviewedSha":"abc","fingerprints":[]}\n-->'
      const body = upsertFixAttempts(withReview, 1)

      expect(body).toContain('buddy:review')
      expect(parseFixAttempts(body)?.attempts).toBe(1)
    })
  })

  describe('the guard the count feeds', () => {
    const base = { workspace: process.cwd(), baseBranch: 'main' }

    it('failure case - stops once the attempts are spent', async () => {
      const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG, priorAttempts: 3, maxAttempts: 3 })

      expect(outcome.action).toBe('skipped')
      expect(outcome.report).toContain('stopping rather than looping')
    })

    it('success case - a count below the ceiling still tries', async () => {
      const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG, priorAttempts: 1, maxAttempts: 3 })

      expect(outcome.action).not.toBe('skipped')
    })

    it('failure case - a pre-existing failure on base is not this PR to fix', async () => {
      const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG, failsOnBase: true })

      expect(outcome.action).toBe('skipped')
      expect(outcome.report).toContain('base branch')
    })
  })
})
