import { describe, expect, it } from 'bun:test'
import { cli } from '../bin/cli'

/**
 * In-process wiring tests for the CLI surface. `bin/cli.ts` guards its
 * `cli.parse()` behind `import.meta.main`, so importing it registers the 32
 * commands without parsing argv or running an action — and `parse(argv,
 * { run: false })` exercises the real flag plumbing without side effects.
 * The subprocess smoke suite (`cli-surface.test.ts`) stays authoritative for
 * process-level behavior; this file pins the wiring drift it cannot see.
 */

const argv = (...parts: string[]): string[] => ['bun', 'buddy', ...parts]

function command(name: string): any {
  const found = (cli as any).commands.find((c: any) => c.name === name)
  if (!found)
    throw new Error(`command '${name}' is not registered`)
  return found
}

describe('cli wiring', () => {
  describe('command surface', () => {
    it('success case - registers exactly the documented commands', () => {
      const names = (cli as any).commands.map((c: any) => c.name).sort()
      expect(names).toEqual([
        'check',
        'cleanup',
        'compare',
        'dashboard',
        'deps',
        'doctor',
        'exists',
        'fix-ci',
        'gate',
        'generate-workflows',
        'handle-comment',
        'handle-issue',
        'help',
        'info',
        'latest',
        'list-branches',
        'open-settings',
        'post-merge',
        'rebase',
        'report',
        'review',
        'run',
        'scan',
        'schedule',
        'search',
        'security',
        'setup',
        'touch',
        'update',
        'update-check',
        'version',
        'versions',
      ])
    })

    it('success case - every command and option carries a description', () => {
      for (const c of (cli as any).commands) {
        expect(c.description, `command '${c.name}'`).toBeTruthy()
        for (const o of c.options ?? [])
          expect(o.description, `${c.name} ${o.rawName}`).toBeTruthy()
      }
    })

    it('success case - init aliases setup', () => {
      expect(command('setup').aliasNames).toContain('init')
    })

    it('success case - the global --config option and version are wired', () => {
      const globalOptions = ((cli as any).globalCommand?.options ?? []).map((o: any) => o.name)
      expect(globalOptions).toContain('config')
      expect((cli as any).globalCommand?.versionNumber ?? (cli as any).commands[0]?.versionNumber).toBeTruthy()
    })
  })

  describe('strategy flags', () => {
    it('failure case - no strategy flag carries a CAC default that would shadow the config', () => {
      // The defect #1441 fixed: `{ default: 'all' }` on --strategy made
      // `options.strategy ?? config.packages.strategy` unreachable.
      for (const c of (cli as any).commands) {
        const strategy = (c.options ?? []).find((o: any) => o.name === 'strategy')
        if (strategy)
          expect(strategy.config?.default, `${c.name} --strategy`).toBeUndefined()
      }
    })

    it('success case - exactly the four update-driving commands take --strategy', () => {
      const withStrategy = (cli as any).commands
        .filter((c: any) => (c.options ?? []).some((o: any) => o.name === 'strategy'))
        .map((c: any) => c.name)
        .sort()
      expect(withStrategy).toEqual(['check', 'scan', 'schedule', 'update'])
    })
  })

  describe('parse without running', () => {
    it('success case - scan flags land as parsed options', () => {
      cli.parse(argv('scan', '--strategy', 'minor', '--verbose'), { run: false })
      expect((cli as any).matchedCommandName).toBe('scan')
      expect((cli as any).options.strategy).toBe('minor')
      expect((cli as any).options.verbose).toBe(true)
    })

    it('success case - negation flips respect-latest off', () => {
      cli.parse(argv('update', '--no-respect-latest'), { run: false })
      expect((cli as any).matchedCommandName).toBe('update')
      expect((cli as any).options.respectLatest).toBe(false)
    })

    it('success case - review flags parse with their defaults intact', () => {
      cli.parse(argv('review', '--fail-on', 'high', '--light'), { run: false })
      expect((cli as any).options.failOn).toBe('high')
      expect((cli as any).options.light).toBe(true)
      // --format was not given: the declared default applies
      expect((cli as any).options.format).toBe('pretty')
    })

    it('success case - declared defaults surface when the flag is omitted', () => {
      cli.parse(argv('cleanup', '--dry-run'), { run: false })
      // The default is declared as the string '7' — actions parse it. If this
      // ever becomes a number at the declaration site, update the pin.
      expect((cli as any).options.days).toBe('7')
      expect((cli as any).options.dryRun).toBe(true)
    })

    it('success case - positional arguments are captured', () => {
      cli.parse(argv('exists', 'lodash'), { run: false })
      expect((cli as any).matchedCommandName).toBe('exists')
      expect((cli as any).args).toContain('lodash')
    })
  })
})
