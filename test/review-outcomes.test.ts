import type { AiClient } from '../src/ai/types'
import type { GitProvider, ReviewSubmission, ReviewSubmissionResult } from '../src/git/provider'
import type { BuddyConfig, PullRequest } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { NO_CAPABILITIES } from '../src/git/provider'
import { reviewPullRequest } from '../src/review/run'
import { Logger } from '../src/utils/logger'

const DIFF = `diff --git a/src/app.ts b/src/app.ts
index 111..222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,4 @@
 const a = 1
+const b = 2
+const c = 3
 const d = 4
`

interface Seen {
  reviews: ReviewSubmission[]
  bodyUpdates: number
}

/**
 * A provider carrying one pull request, with a scriptable review outcome.
 *
 * @param options - Capability toggle and what createReview should report
 */
function stub(options: {
  suggestions?: boolean
  submission?: (review: ReviewSubmission) => ReviewSubmissionResult
} = {}): { provider: GitProvider, seen: Seen } {
  const seen: Seen = { reviews: [], bodyUpdates: 0 }

  const pr = {
    number: 7,
    title: 'add a thing',
    body: 'description',
    head: 'feature',
    base: 'main',
    state: 'open',
    labels: [],
    draft: false,
  } as unknown as PullRequest

  const provider = {
    capabilities: () => ({
      ...NO_CAPABILITIES,
      inlineReviewComments: true,
      reviewSuggestions: options.suggestions ?? true,
    }),
    getPullRequests: async () => [pr],
    getPullRequestDiff: async () => DIFF,
    getPullRequestHeadSha: async () => 'head1',
    getFileContent: async () => null,
    createReview: async (_prNumber: number, review: ReviewSubmission) => {
      seen.reviews.push(review)
      return options.submission
        ? options.submission(review)
        : { posted: true, inlineComments: review.comments?.length ?? 0 }
    },
    updatePullRequest: async () => {
      seen.bodyUpdates++
      return pr
    },
  } as unknown as GitProvider

  return { provider, seen }
}

/** An AI client that reports these findings for any diff. */
function reportingAi(findings: unknown[]): AiClient {
  return {
    name: 'stub',
    complete: async () => ({
      // The engine reads `json`, not `text` — a stub answering in prose is
      // indistinguishable from a review that found nothing.
      json: { summary: 'looked at it', walkthrough: [], findings },
      outputTokens: 1,
    }),
  } as unknown as AiClient
}

const FINDING = {
  path: 'src/app.ts',
  line: 2,
  severity: 'minor',
  category: 'style',
  message: 'Name this better.',
  suggestion: 'const better = 2',
}

const config: BuddyConfig = { analysis: { enabled: false } }

/**
 * `createReview` reports what publishing achieved — `ReviewSubmissionResult`
 * was declared and implemented by all three providers, and the one caller
 * ignored it: a review that failed to post was reported as posted, and
 * inline comments the platform dropped vanished without a trace.
 */
describe('review submission outcomes', () => {
  it('failure case - a review that was not posted says so and records nothing', async () => {
    const { provider, seen } = stub({ submission: () => ({ posted: false, inlineComments: 0 }) })

    const { status } = await reviewPullRequest({
      config,
      provider,
      prNumber: 7,
      ai: reportingAi([FINDING]),
      logger: Logger.silent(),
    })

    expect(status).toBe('The review could not be posted.')
    // Persisting the state anyway would make every later run skip a review
    // nobody can see.
    expect(seen.bodyUpdates).toBe(0)
  })

  it('failure case - dropped inline comments are named in the status', async () => {
    const { provider } = stub({ submission: () => ({ posted: true, inlineComments: 1 }) })

    const { status } = await reviewPullRequest({
      config,
      provider,
      prNumber: 7,
      ai: reportingAi([
        FINDING,
        { ...FINDING, line: 3, message: 'This one anchors nowhere.' },
      ]),
      logger: Logger.silent(),
    })

    expect(status).toContain('1 of 2 inline comment(s) could not be placed on the diff.')
  })

  it('success case - a fully placed review reports no shortfall', async () => {
    const { provider, seen } = stub()

    const { status } = await reviewPullRequest({
      config,
      provider,
      prNumber: 7,
      ai: reportingAi([FINDING]),
      logger: Logger.silent(),
    })

    expect(status).toContain('1 finding(s) posted.')
    expect(status).not.toContain('could not be placed')
    expect(seen.bodyUpdates).toBe(1)
  })
})

/**
 * `ProviderCapabilities.reviewSuggestions` was declared, documented and set
 * by every provider — and read by nothing, so Bitbucket received literal
 * ```suggestion fences promising a one-click apply it does not have.
 */
describe('suggestion blocks follow the capability', () => {
  it('success case - a capable platform gets the suggestion block', async () => {
    const { provider, seen } = stub({ suggestions: true })

    await reviewPullRequest({
      config,
      provider,
      prNumber: 7,
      ai: reportingAi([FINDING]),
      logger: Logger.silent(),
    })

    const body = seen.reviews[0]?.comments?.[0]?.body ?? ''
    expect(body).toContain('```suggestion')
  })

  it('failure case - a platform without suggestions gets a plain fence', async () => {
    const { provider, seen } = stub({ suggestions: false })

    await reviewPullRequest({
      config,
      provider,
      prNumber: 7,
      ai: reportingAi([FINDING]),
      logger: Logger.silent(),
    })

    const body = seen.reviews[0]?.comments?.[0]?.body ?? ''
    expect(body).not.toContain('```suggestion')
    expect(body).toContain('Suggested replacement:')
    expect(body).toContain(FINDING.suggestion)
  })
})
