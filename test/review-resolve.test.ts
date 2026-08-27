import type { GitProvider, ReviewThread } from '../src/git/provider'
import { describe, expect, it } from 'bun:test'
import { resolveBuddyThreads } from '../src/review/resolve'
import { NO_CAPABILITIES } from '../src/git/provider'
import { Logger } from '../src/utils/logger'

/** A provider over a fixed thread list, recording what it was asked to close. */
function stub(threads: ReviewThread[], options: { capable?: boolean, refuse?: boolean } = {}) {
  const closed: string[] = []

  const provider = {
    capabilities: () => ({ ...NO_CAPABILITIES, reviewThreads: options.capable ?? true }),
    listReviewThreads: async () => threads,
    resolveReviewThread: async (_pr: number, id: string) => {
      if (options.refuse)
        return false

      closed.push(id)
      return true
    },
  } as unknown as GitProvider

  return { provider, closed }
}

function thread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  return {
    id: 't1',
    isResolved: false,
    path: 'src/app.ts',
    authorLogins: ['github-actions[bot]'],
    ...overrides,
  }
}

const base = { prNumber: 7, logger: Logger.silent() }

/**
 * `@buddy resolve` was recognised by the parser and described in the docs —
 * "closes the threads Buddy opened, not the ones your teammates did" — with no
 * handler behind it and no provider method that could have backed one.
 */
describe('resolveBuddyThreads', () => {
  describe('whose threads get closed', () => {
    it('success case - closes a thread buddy opened', async () => {
      const { provider, closed } = stub([thread({ id: 'mine' })])

      const status = await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual(['mine'])
      expect(status).toContain('Closed 1 thread')
    })

    it('failure case - leaves a teammate\'s thread alone', async () => {
      // The whole promise of the command. Closing a human's conversation
      // because a bot was asked to tidy up is the failure that matters.
      const { provider, closed } = stub([thread({ id: 'theirs', authorLogins: ['alice'] })])

      const status = await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual([])
      expect(status).toContain('None of the open threads')
    })

    it('failure case - a thread buddy only replied to is not buddy\'s', async () => {
      // Judged by who started it. A bot commenting on a maintainer's thread
      // does not make the thread the bot's to close.
      const { provider, closed } = stub([
        thread({ id: 'theirs', authorLogins: ['alice', 'github-actions[bot]'] }),
      ])

      await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual([])
    })

    it('success case - a maintainer replying does not take the thread away', async () => {
      const { provider, closed } = stub([
        thread({ id: 'mine', authorLogins: ['github-actions[bot]', 'alice'] }),
      ])

      await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual(['mine'])
    })

    it('success case - an explicit author overrides the bot logins', async () => {
      const { provider, closed } = stub([thread({ id: 'mine', authorLogins: ['custom-bot'] })])

      await resolveBuddyThreads({ ...base, provider, author: 'custom-bot' })

      expect(closed).toEqual(['mine'])
    })

    it('edge case - an already-resolved thread is not touched again', async () => {
      const { provider, closed } = stub([thread({ id: 'done', isResolved: true })])

      await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual([])
    })

    it('edge case - a thread with no author is not claimed', async () => {
      const { provider, closed } = stub([thread({ id: 'orphan', authorLogins: [] })])

      await resolveBuddyThreads({ ...base, provider })

      expect(closed).toEqual([])
    })
  })

  describe('what it reports', () => {
    it('success case - distinguishes an empty pull request from a busy one', async () => {
      // "Nothing of mine is open" and "there is nothing here at all" are
      // different answers to the same request.
      expect(await resolveBuddyThreads({ ...base, provider: stub([]).provider }))
        .toContain('no review threads')

      expect(await resolveBuddyThreads({
        ...base,
        provider: stub([thread({ authorLogins: ['alice'] })]).provider,
      })).toContain('None of the open threads')
    })

    it('success case - counts several', async () => {
      const { provider, closed } = stub([thread({ id: 'a' }), thread({ id: 'b' })])

      expect(await resolveBuddyThreads({ ...base, provider })).toContain('Closed 2 thread')
      expect(closed).toEqual(['a', 'b'])
    })

    it('failure case - a refused close is reported rather than claimed', async () => {
      const { provider } = stub([thread()], { refuse: true })

      expect(await resolveBuddyThreads({ ...base, provider })).toContain('could not close')
    })

    it('failure case - a provider without the capability says so', async () => {
      const { provider } = stub([thread()], { capable: false })

      expect(await resolveBuddyThreads({ ...base, provider })).toContain('cannot resolve')
    })
  })
})
