import type { BuddyConfig } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { assertValidConfig, formatConfigIssues, validateConfig } from '../src/config-validation'
import { ConfigurationError } from '../src/types'

/** Minimal config that must always validate clean. */
const validConfig: BuddyConfig = {
  verbose: false,
  repository: { provider: 'github', owner: 'stacksjs', name: 'buddy' },
  packages: { strategy: 'all' },
}

function pathsOf(config: BuddyConfig): string[] {
  return validateConfig(config).map(issue => issue.path)
}

describe('config-validation', () => {
  describe('validateConfig', () => {
    it('success case - accepts a minimal valid config', () => {
      expect(validateConfig(validConfig)).toEqual([])
    })

    it('success case - accepts an empty config', () => {
      expect(validateConfig({})).toEqual([])
    })

    it('success case - accepts a fully populated config', () => {
      const config: BuddyConfig = {
        verbose: true,
        logLevel: 'debug',
        maxPRsPerRun: 5,
        repository: {
          provider: 'github',
          owner: 'acme',
          name: 'app',
          apiUrl: 'https://github.acme.com/api/v3',
          serverUrl: 'https://github.acme.com',
        },
        registries: {
          npm: 'https://npm.acme.com',
          npmScopes: { '@acme': 'https://npm.acme.com' },
          composer: 'https://packagist.acme.com',
        },
        security: { enabled: true, prioritize: true, label: 'sec', minimumSeverity: 'high' },
        schedule: { cron: '0 9 * * 1-5', timezone: 'UTC' },
        packages: {
          strategy: 'minor',
          ignore: ['legacy'],
          groups: [{ name: 'Types', patterns: ['@types/*'], strategy: 'patch' }],
          minimumReleaseAge: 1440,
        },
        pullRequest: {
          autoMerge: { enabled: true, strategy: 'squash', conditions: ['patch-only'] },
          reviewers: ['someone'],
        },
        releaseNotes: { enabled: true, maxReleases: 3, maxBodyLength: 1000 },
        dashboard: { enabled: true, title: 'Deps', issueNumber: 12 },
      }

      expect(validateConfig(config)).toEqual([])
    })

    it('failure case - rejects an unknown update strategy', () => {
      const issues = validateConfig({ packages: { strategy: 'minr' as any } })

      expect(issues).toHaveLength(1)
      expect(issues[0].path).toBe('packages.strategy')
      expect(issues[0].message).toContain('minr')
    })

    it('failure case - rejects a provider that does not exist', () => {
      const issues = validateConfig({
        repository: { provider: 'svn' as any, owner: 'a', name: 'b' },
      })

      expect(issues.map(i => i.path)).toContain('repository.provider')
    })

    it('success case - accepts gitlab and bitbucket', () => {
      for (const provider of ['github', 'gitlab', 'bitbucket'] as const)
        expect(validateConfig({ repository: { provider, owner: 'a', name: 'b' } })).toEqual([])
    })

    it('failure case - rejects a group with no patterns', () => {
      expect(pathsOf({
        packages: { strategy: 'all', groups: [{ name: 'Empty', patterns: [] }] },
      })).toContain('packages.groups[0].patterns')
    })

    it('failure case - rejects a group with no name', () => {
      expect(pathsOf({
        packages: { strategy: 'all', groups: [{ name: '', patterns: ['a*'] }] },
      })).toContain('packages.groups[0].name')
    })

    it('failure case - rejects groups given as an object', () => {
      expect(pathsOf({
        packages: { strategy: 'all', groups: { name: 'x' } as any },
      })).toContain('packages.groups')
    })

    it('failure case - rejects a negative minimumReleaseAge', () => {
      expect(pathsOf({
        packages: { strategy: 'all', minimumReleaseAge: -5 },
      })).toContain('packages.minimumReleaseAge')
    })

    it('failure case - rejects a non-numeric minimumReleaseAge', () => {
      expect(pathsOf({
        packages: { strategy: 'all', minimumReleaseAge: '60' as any },
      })).toContain('packages.minimumReleaseAge')
    })

    it('failure case - rejects maxPRsPerRun below one', () => {
      expect(pathsOf({ maxPRsPerRun: 0 })).toContain('maxPRsPerRun')
    })

    it('failure case - rejects a fractional maxPRsPerRun', () => {
      expect(pathsOf({ maxPRsPerRun: 2.5 })).toContain('maxPRsPerRun')
    })

    it('failure case - rejects an unknown auto-merge strategy', () => {
      expect(pathsOf({
        pullRequest: { autoMerge: { enabled: true, strategy: 'fast-forward' as any } },
      })).toContain('pullRequest.autoMerge.strategy')
    })

    it('failure case - rejects a non-URL registry', () => {
      expect(pathsOf({ registries: { npm: 'npm.acme.com' } })).toContain('registries.npm')
    })

    it('failure case - rejects a non-http registry protocol', () => {
      expect(pathsOf({ registries: { npm: 'ftp://npm.acme.com' } })).toContain('registries.npm')
    })

    it('failure case - rejects a scope key without @', () => {
      expect(pathsOf({
        registries: { npmScopes: { acme: 'https://npm.acme.com' } },
      })).toContain('registries.npmScopes.acme')
    })

    it('failure case - rejects a malformed apiUrl', () => {
      expect(pathsOf({
        repository: { provider: 'github', owner: 'a', name: 'b', apiUrl: 'not a url' },
      })).toContain('repository.apiUrl')
    })

    it('failure case - rejects a cron with the wrong field count', () => {
      expect(pathsOf({ schedule: { cron: '0 9 *' } })).toContain('schedule.cron')
    })

    it('success case - accepts both 5- and 6-field cron expressions', () => {
      expect(validateConfig({ schedule: { cron: '0 9 * * 1-5' } })).toEqual([])
      expect(validateConfig({ schedule: { cron: '0 0 9 * * 1-5' } })).toEqual([])
    })

    it('failure case - rejects an unknown severity', () => {
      expect(pathsOf({
        security: { minimumSeverity: 'urgent' as any },
      })).toContain('security.minimumSeverity')
    })

    it('failure case - rejects an unknown log level', () => {
      expect(pathsOf({ logLevel: 'trace' as any })).toContain('logLevel')
    })

    it('failure case - rejects a non-string entry in ignore', () => {
      expect(pathsOf({
        packages: { strategy: 'all', ignore: ['ok', 42 as any] },
      })).toContain('packages.ignore[1]')
    })

    it('failure case - rejects a non-string pin version', () => {
      expect(pathsOf({
        packages: { strategy: 'all', pin: { react: 18 as any } },
      })).toContain('packages.pin.react')
    })

    it('failure case - rejects a custom workflow with no name', () => {
      expect(pathsOf({
        workflows: { custom: [{ name: '', schedule: '0 9 * * 1' }] },
      })).toContain('workflows.custom[0].name')
    })

    it('edge case - reports every problem, not just the first', () => {
      const issues = validateConfig({
        maxPRsPerRun: 0,
        packages: { strategy: 'nope' as any, minimumReleaseAge: -1 },
      })

      expect(issues.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('notifications', () => {
    it('success case - a valid notifications block passes', () => {
      const issues = validateConfig({
        notifications: {
          slack: { webhookEnv: 'SLACK_WEBHOOK_URL', events: ['pr.created', 'run.failed'] },
          webhooks: [{ url: 'https://example.com/hook', secretEnv: 'HOOK_SECRET', events: ['scan.completed'] }],
        },
      })

      expect(issues).toHaveLength(0)
    })

    it('failure case - a mistyped event name is reported, not silently dropped', () => {
      // `events` naming an event that does not exist used to build the sink
      // and then filter every real event out — notifications configured,
      // credential read, nothing ever delivered.
      const issues = validateConfig({
        notifications: { slack: { events: ['pr.opened'] } },
      })

      expect(issues.some(issue => issue.path === 'notifications.slack.events[0]')).toBe(true)
    })

    it('failure case - a webhook without a url is reported', () => {
      const issues = validateConfig({
        notifications: { webhooks: [{ events: ['pr.created'] }] },
      } as any)

      expect(issues.some(issue => issue.path === 'notifications.webhooks[0].url')).toBe(true)
    })

    it('edge case - webhook event filters are validated too', () => {
      const issues = validateConfig({
        notifications: { webhooks: [{ url: 'https://example.com/hook', events: ['nope'] }] },
      })

      expect(issues.some(issue => issue.path === 'notifications.webhooks[0].events[0]')).toBe(true)
    })
  })

  describe('formatConfigIssues', () => {
    it('should render one line per issue', () => {
      const formatted = formatConfigIssues([
        { path: 'a', message: 'bad' },
        { path: 'b', message: 'worse' },
      ])

      expect(formatted.split('\n')).toHaveLength(2)
      expect(formatted).toContain('a: bad')
    })
  })

  describe('assertValidConfig', () => {
    it('success case - returns quietly for a valid config', () => {
      expect(() => assertValidConfig(validConfig)).not.toThrow()
    })

    it('failure case - throws ConfigurationError listing the issues', () => {
      let thrown: unknown
      try {
        assertValidConfig({ packages: { strategy: 'bogus' as any } })
      }
      catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(ConfigurationError)
      expect((thrown as ConfigurationError).message).toContain('packages.strategy')
      expect((thrown as ConfigurationError).configKey).toBe('packages.strategy')
    })
  })
})
