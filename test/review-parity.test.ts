import type { AiClient } from '../src/ai/types'
import type { GitProvider } from '../src/git/provider'
import type { PullRequest } from '../src/types'
import type { BuddyConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reviewPullRequest, runReviewForPR } from '../src/review/run'
import { NO_CAPABILITIES } from '../src/git/provider'
import { Logger } from '../src/utils/logger'

const DIFF = `diff --git a/src/app.ts b/src/app.ts
index 111..222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const a = 1
+const token = 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB'
 const b = 2
`

interface Seen {
  prompts: string[]
  reviews: Array<{ pr: number, body: string }>
  filesRead: Array<{ path: string, ref: string }>
}

/** A provider carrying one pull request, plus a record of what was read. */
function stub(files: Record<string, string> = {}): { provider: GitProvider, seen: Seen } {
  const seen: Seen = { prompts: [], reviews: [], filesRead: [] }

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
    capabilities: () => ({ ...NO_CAPABILITIES, inlineReviewComments: true }),
    getPullRequests: async () => [pr],
    getPullRequestDiff: async () => DIFF,
    getPullRequestHeadSha: async () => 'head1',
    getFileContent: async (path: string, ref: string) => {
      seen.filesRead.push({ path, ref })
      return files[path] ?? null
    },
    createReview: async (prNumber: number, review: { body: string }) => {
      seen.reviews.push({ pr: prNumber, body: review.body })
      return { id: 1 }
    },
    updatePullRequest: async () => pr,
  } as unknown as GitProvider

  return { provider, seen }
}

/** An AI client that records its prompt and reports nothing. */
function recordingAi(seen: Seen): AiClient {
  return {
    name: 'stub',
    complete: async (request: { system?: string, messages: Array<{ content: string }> }) => {
      seen.prompts.push(`${request.system ?? ''}\n${request.messages.map(m => m.content).join('\n')}`)
      return {
        text: JSON.stringify({ summary: 'looks fine', walkthrough: [], findings: [] }),
        outputTokens: 1,
      }
    },
  } as unknown as AiClient
}

/**
 * `buddy review <pr>` reimplemented the pull request review that
 * `runReviewForPR` already did, and the two had drifted. The command skipped
 * analyzers outright for a pull request and never read learnings at all — and
 * it is the command the generated workflow runs, so the automatic review every
 * repository gets was the one path missing both.
 *
 * These cover the shared path both entry points now use.
 */
describe('reviewing a pull request', () => {
  const config: BuddyConfig = {
    repository: { provider: 'github', owner: 'o', name: 'r', baseBranch: 'main' },
  }

  it('success case - reads learnings from the base branch', async () => {
    // `@buddy remember` writes these. A review that does not read them makes
    // the whole feature inert.
    const { provider, seen } = stub()

    await runReviewForPR({ config, provider, prNumber: 7, ai: recordingAi(seen), logger: Logger.silent() })

    const learnings = seen.filesRead.filter(read => read.path.includes('learnings'))
    expect(learnings.length).toBeGreaterThan(0)
    expect(learnings.every(read => read.ref === 'main')).toBe(true)
  })

  it('success case - reads guidelines from the base branch, never the PR branch', async () => {
    // Both are inlined into the prompt as trusted context. Reading them from
    // the pull request's own branch would let it rewrite the rules its code is
    // reviewed against.
    const { provider, seen } = stub()

    await runReviewForPR({ config, provider, prNumber: 7, ai: recordingAi(seen), logger: Logger.silent() })

    expect(seen.filesRead.length).toBeGreaterThan(0)
    expect(seen.filesRead.every(read => read.ref === 'main')).toBe(true)
    expect(seen.filesRead.some(read => read.ref === 'feature')).toBe(false)
  })

  it('success case - runs analyzers on a pull request', async () => {
    // The command skipped these entirely when given a pull request, so secret
    // scanning never ran on the path that reviews every pull request.
    const { provider, seen } = stub()

    await runReviewForPR({ config, provider, prNumber: 7, ai: recordingAi(seen), logger: Logger.silent() })

    expect(seen.reviews).toHaveLength(1)
  })

  it('success case - a dry run reports without posting', async () => {
    const { provider, seen } = stub()

    const status = await runReviewForPR({
      config,
      provider,
      prNumber: 7,
      dryRun: true,
      ai: recordingAi(seen),
      logger: Logger.silent(),
    })

    expect(seen.reviews).toHaveLength(0)
    expect(status).toContain('Would post')
  })

  it('failure case - a missing pull request is reported, not thrown', async () => {
    const { provider } = stub()

    expect(await runReviewForPR({ config, provider, prNumber: 999, ai: null, logger: Logger.silent() }))
      .toContain('Could not find')
  })

  it('success case - an explicit review ignores the automatic filters', async () => {
    // `--auto` is what the generated workflow passes; without it this is
    // someone who has already decided they want a review.
    const { provider, seen } = stub()

    await runReviewForPR({
      config: { ...config, ai: { review: { draft: false } } } as BuddyConfig,
      provider,
      prNumber: 7,
      trigger: 'requested',
      ai: recordingAi(seen),
      logger: Logger.silent(),
    })

    expect(seen.reviews).toHaveLength(1)
  })

  it('success case - a recorded learning reaches the model', async () => {
    // Reading the file is not the point; the point is that what `@buddy
    // remember` wrote changes how the next review is prompted.
    const learning = {
      id: 'abc',
      text: 'we pin react to 17 on purpose',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const { provider, seen } = stub({ '.buddy/learnings.jsonl': `${JSON.stringify(learning)}\n` })

    await runReviewForPR({ config, provider, prNumber: 7, ai: recordingAi(seen), logger: Logger.silent() })

    expect(seen.prompts.join('\n')).toContain('we pin react to 17 on purpose')
  })

  it('success case - a guideline reaches the model', async () => {
    const { provider, seen } = stub({ 'CLAUDE.md': 'Never use `any`.' })

    await runReviewForPR({ config, provider, prNumber: 7, ai: recordingAi(seen), logger: Logger.silent() })

    expect(seen.prompts.join('\n')).toContain('Never use `any`')
  })
})

/**
 * Analyzers were skipped outright when the command was given a pull request:
 * `config.analysis?.enabled === false || prNumber`. Secret scanning therefore
 * never ran on the path that reviews every pull request.
 */
describe('analyzers on a pull request', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'buddy-review-'))
    originalCwd = process.cwd()
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('success case - a planted credential is found and reported', async () => {
    // Analyzers read the working tree rather than the diff, so the file has to
    // exist for this to mean anything.
    await fs.mkdir('src', { recursive: true })
    await fs.writeFile('src/app.ts', `const token = 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB'\n`)

    const { provider, seen } = stub()
    const config: BuddyConfig = {
      repository: { provider: 'github', owner: 'o', name: 'r', baseBranch: 'main' },
    }

    // No AI at all: whatever lands comes from static analysis alone, which is
    // the guarantee that matters for a repository without a key.
    const status = await runReviewForPR({ config, provider, prNumber: 7, ai: null, logger: Logger.silent() })

    expect(status).toContain('static-analysis')
    expect(seen.reviews).toHaveLength(1)
    expect(seen.reviews[0].body).toContain('Static analysis only')
  })
})

/**
 * `--format` and `--fail-on` were accepted on the pull request path and applied
 * only on the local one — the findings never came back to the command, so a
 * pull request review could not be rendered as JSON or fail a pipeline.
 */
describe('reviewPullRequest returns the findings', () => {
  const config: BuddyConfig = {
    repository: { provider: 'github', owner: 'o', name: 'r', baseBranch: 'main' },
  }

  /** An AI client that reports one finding on the added line. */
  function findingAi(seen: Seen): AiClient {
    return {
      name: 'stub',
      complete: async (request: { system?: string, messages: Array<{ content: string }> }) => {
        seen.prompts.push(request.messages.map(m => m.content).join('\n'))
        const json = {
          summary: 'one problem',
          walkthrough: [],
          findings: [{ path: 'src/app.ts', line: 2, severity: 'critical', category: 'security', message: 'hard-coded token' }],
        }
        return { text: JSON.stringify(json), json, outputTokens: 1 }
      },
    } as unknown as AiClient
  }

  it('success case - the findings come back with the status', async () => {
    const { provider, seen } = stub()

    const outcome = await reviewPullRequest({ config, provider, prNumber: 7, ai: findingAi(seen), logger: Logger.silent() })

    expect(outcome.status).toContain('1 finding')
    expect(outcome.result?.findings.map(f => f.severity)).toEqual(['critical'])
  })

  it('success case - a skipped review carries no result', async () => {
    const { provider } = stub()

    const outcome = await reviewPullRequest({ config, provider, prNumber: 999, ai: null, logger: Logger.silent() })

    expect(outcome.status).toContain('Could not find')
    expect(outcome.result).toBeUndefined()
  })

  it('success case - the string form is the status alone', async () => {
    const { provider, seen } = stub()

    const status = await runReviewForPR({ config, provider, prNumber: 7, ai: findingAi(seen), logger: Logger.silent() })

    expect(typeof status).toBe('string')
  })
})
