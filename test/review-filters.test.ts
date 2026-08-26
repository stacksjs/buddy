import type { BuddyConfig } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { reviewSkipReason } from '../src/review/filters'

/**
 * These five settings were typed, validated and documented long before
 * anything read them, so a repository that set `ai.review.enabled: false`
 * still got reviews.
 */
describe('review filters', () => {
  const pr = { title: 'Add retry to the fetch helper', author: 'alice', draft: false }

  /** Config carrying only the review settings under test. */
  function withReview(review: NonNullable<NonNullable<BuddyConfig['ai']>['review']>): BuddyConfig {
    return { repository: { provider: 'github', owner: 'stacksjs', name: 'buddy' }, ai: { review } }
  }

  describe('enabled', () => {
    it('success case - an unset flag reviews, rather than silently refusing', () => {
      // Reviews already need a workflow trigger and a provider key. Treating
      // unset as off would disable review for every existing repository.
      expect(reviewSkipReason(withReview({}), pr, 'automatic')).toBeNull()
      expect(reviewSkipReason(withReview({}), pr, 'requested')).toBeNull()
    })

    it('failure case - false refuses even an explicit request', () => {
      // `enabled` describes the repository, not one pull request, so asking
      // does not override it.
      const config = withReview({ enabled: false })

      expect(reviewSkipReason(config, pr, 'automatic')).toContain('disabled')
      expect(reviewSkipReason(config, pr, 'requested')).toContain('disabled')
    })
  })

  describe('autoReview', () => {
    it('failure case - false stops the automatic trigger', () => {
      expect(reviewSkipReason(withReview({ autoReview: false }), pr, 'automatic')).toContain('Automatic review is off')
    })

    it('success case - an explicit request still works', () => {
      expect(reviewSkipReason(withReview({ autoReview: false }), pr, 'requested')).toBeNull()
    })
  })

  describe('drafts', () => {
    const draft = { ...pr, draft: true }

    it('failure case - drafts are skipped on an automatic trigger by default', () => {
      expect(reviewSkipReason(withReview({}), draft, 'automatic')).toContain('draft')
    })

    it('success case - opting in reviews them', () => {
      expect(reviewSkipReason(withReview({ drafts: true }), draft, 'automatic')).toBeNull()
    })

    it('success case - asking for a review of a draft overrides the default', () => {
      expect(reviewSkipReason(withReview({}), draft, 'requested')).toBeNull()
    })
  })

  describe('ignoreTitleKeywords', () => {
    it('failure case - matches case-insensitively as a substring', () => {
      // `wip` has to catch `WIP:` and `[wip]` without anyone writing a regex.
      const config = withReview({ ignoreTitleKeywords: ['wip'] })

      expect(reviewSkipReason(config, { ...pr, title: 'WIP: refactor' }, 'automatic')).toContain('wip')
      expect(reviewSkipReason(config, { ...pr, title: '[wip] refactor' }, 'automatic')).toContain('wip')
    })

    it('success case - an unrelated title passes', () => {
      expect(reviewSkipReason(withReview({ ignoreTitleKeywords: ['wip'] }), pr, 'automatic')).toBeNull()
    })

    it('edge case - an empty keyword does not match everything', () => {
      // A blank entry left in a config array would otherwise skip every PR.
      expect(reviewSkipReason(withReview({ ignoreTitleKeywords: ['', '  '] }), pr, 'automatic')).toBeNull()
    })
  })

  describe('ignoreUsernames', () => {
    it('failure case - skips a listed author, ignoring case', () => {
      const config = withReview({ ignoreUsernames: ['Dependabot[bot]'] })

      expect(reviewSkipReason(config, { ...pr, author: 'dependabot[bot]' }, 'automatic')).toContain('dependabot[bot]')
    })

    it('success case - an unlisted author passes', () => {
      expect(reviewSkipReason(withReview({ ignoreUsernames: ['bob'] }), pr, 'automatic')).toBeNull()
    })

    it('edge case - a partial match is not a match', () => {
      // Substring matching here would let `bob` ignore `bobby`.
      expect(reviewSkipReason(withReview({ ignoreUsernames: ['ali'] }), pr, 'automatic')).toBeNull()
    })
  })

  it('edge case - no ai config at all reviews normally', () => {
    const config: BuddyConfig = { repository: { provider: 'github', owner: 'stacksjs', name: 'buddy' } }

    expect(reviewSkipReason(config, pr, 'automatic')).toBeNull()
  })
})
