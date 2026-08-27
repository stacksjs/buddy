import type { HandlerDeps } from '../src/commands/handlers'
import type { CommandContext } from '../src/commands/dispatcher'
import type { GitProvider } from '../src/git/provider'
import { describe, expect, it } from 'bun:test'
import { createHandlers } from '../src/commands/handlers'
import { Logger } from '../src/utils/logger'

/** Deps that record what a handler routed to, with everything stubbed. */
function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps & { calls: string[] } {
  const calls: string[] = []

  return {
    calls,
    config: {},
    provider: {} as GitProvider,
    review: async (pr) => {
      calls.push(`review:${pr}`)
      return 'reviewed'
    },
    rebase: async (pr) => {
      calls.push(`rebase:${pr}`)
      return 'rebased'
    },
    merge: async () => {
      calls.push('merge')
      return []
    },
    fixCi: async (pr) => {
      calls.push(`fixCi:${pr}`)
      return 'reported'
    },
    plan: async (number, isPullRequest, request) => {
      calls.push(`plan:${number}:${isPullRequest}:${request}`)
      return '## Plan\n\n1. Do the thing'
    },
    remember: async () => 'noted',
    ...overrides,
  }
}

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    command: { name: 'fix-ci', args: '', raw: '@buddy fix-ci' },
    actor: { login: 'maintainer', canWrite: true, isBot: false },
    number: 42,
    isPullRequest: true,
    logger: Logger.quiet(),
    ...overrides,
  }
}

/**
 * The handlers had no tests at all, which is part of why `fix-ci` sat returning
 * `handled: false` with a message explaining why it could not work.
 */
describe('command handlers', () => {
  describe('fix-ci', () => {
    it('success case - diagnoses the pull request it was asked on', async () => {
      const dependencies = deps()
      const outcome = await createHandlers(dependencies)['fix-ci'](context())

      expect(outcome.handled).toBe(true)
      expect(dependencies.calls).toEqual(['fixCi:42'])
    })

    it('failure case - an issue has no checks to look at', async () => {
      const dependencies = deps()
      const outcome = await createHandlers(dependencies)['fix-ci'](context({ isPullRequest: false }))

      expect(outcome.handled).toBe(false)
      expect(outcome.reply).toContain('issue, not a pull request')
      expect(dependencies.calls).toEqual([])
    })

    it('success case - reports the status rather than repeating the diagnosis', async () => {
      // The run posts its own comment carrying the evidence and the log
      // excerpt. Echoing it here would put the same wall of text on the
      // thread twice.
      const outcome = await createHandlers(deps())['fix-ci'](context())

      expect(outcome.reply).toBe('reported')
      expect(outcome.reply).not.toContain('CI failure analysis')
    })
  })

  describe('routing', () => {
    it('success case - review and rebase reach their machinery', async () => {
      const dependencies = deps()
      const handlers = createHandlers(dependencies)

      await handlers.review(context({ command: { name: 'review', args: '', raw: '' } }))
      await handlers.rebase(context({ command: { name: 'rebase', args: '', raw: '' } }))

      expect(dependencies.calls).toEqual(['review:42', 'rebase:42'])
    })

    it('failure case - reviewing an issue is refused before any work', async () => {
      const dependencies = deps()
      const outcome = await createHandlers(dependencies).review(
        context({ command: { name: 'review', args: '', raw: '' }, isPullRequest: false }),
      )

      expect(outcome.handled).toBe(false)
      expect(dependencies.calls).toEqual([])
    })
  })

  describe('plan', () => {
    it('success case - plans the issue it was asked on', async () => {
      // `plan` was a command the parser knew and the docs advertised, with no
      // handler behind it — so it replied "I don't know how to plan yet".
      const dependencies = deps()
      const outcome = await createHandlers(dependencies).plan(
        context({ command: { name: 'plan', args: '', raw: '@buddy plan' }, isPullRequest: false }),
      )

      expect(outcome.handled).toBe(true)
      expect(dependencies.calls).toEqual(['plan:42:false:'])
    })

    it('success case - passes the direction the commenter added', async () => {
      const dependencies = deps()
      await createHandlers(dependencies).plan(
        context({ command: { name: 'plan', args: '  focus on the parser  ', raw: '' } }),
      )

      expect(dependencies.calls).toEqual(['plan:42:true:focus on the parser'])
    })

    it('success case - the plan is the reply', async () => {
      // `handle-comment` posts `outcome.reply`, so returning the plan here is
      // what puts it on the thread — posting separately would double it.
      const outcome = await createHandlers(deps()).plan(context({ command: { name: 'plan', args: '', raw: '' } }))

      expect(outcome.reply).toContain('## Plan')
    })
  })
})
