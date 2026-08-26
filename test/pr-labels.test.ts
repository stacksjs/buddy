import type { BuddyConfig, PackageUpdate, UpdateGroup } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { Buddy } from '../src/buddy'
import { PullRequestGenerator } from '../src/pr/pr-generator'

/**
 * Labels reaching a pull request come from three places, and each one was
 * broken or missing at some point: the automatic set, `pullRequest.labels`
 * (declared and validated but read by nothing), and rule effects (folded in
 * only on the creation path, so refreshing a pull request dropped them).
 */
describe('pull request labels', () => {
  const update: PackageUpdate = {
    name: 'react',
    currentVersion: '18.0.0',
    newVersion: '18.0.1',
    updateType: 'patch',
    dependencyType: 'dependencies',
    file: 'package.json',
  }

  const group: UpdateGroup = {
    name: 'Patch Updates',
    updateType: 'patch',
    title: 'chore(deps): update react to v18.0.1',
    body: '',
    updates: [update],
  }

  const baseConfig: BuddyConfig = {
    repository: { provider: 'github', owner: 'stacksjs', name: 'buddy' },
  }

  /** Resolve labels the way every pull-request path now does. */
  function labelsFor(config: BuddyConfig): string[] {
    const buddy = new Buddy(config)
    // @ts-expect-error - accessing private method for testing
    return buddy.labelsFor(group, new PullRequestGenerator(config))
  }

  it('success case - always includes the automatic set', () => {
    const labels = labelsFor(baseConfig)
    expect(labels).toContain('dependencies')
    expect(labels).toContain('patch')
    expect(labels).toContain('npm')
  })

  it('success case - includes labels declared in pullRequest.labels', () => {
    // This key was declared, validated and documented, but the live path never
    // read it, so a configured label silently never reached a pull request.
    const labels = labelsFor({ ...baseConfig, pullRequest: { labels: ['deps', 'automated'] } })
    expect(labels).toContain('deps')
    expect(labels).toContain('automated')
    expect(labels).toContain('dependencies')
  })

  it('success case - includes labels a matching rule asked for', () => {
    const labels = labelsFor({
      ...baseConfig,
      packages: { strategy: 'all', rules: [{ matchPackages: ['react'], labels: ['frontend'] }] },
    })
    expect(labels).toContain('frontend')
  })

  it('success case - unions all three sources without duplicating', () => {
    const labels = labelsFor({
      ...baseConfig,
      pullRequest: { labels: ['dependencies', 'deps'] },
      packages: { strategy: 'all', rules: [{ matchPackages: ['react'], labels: ['deps', 'frontend'] }] },
    })

    expect(labels).toContain('deps')
    expect(labels).toContain('frontend')
    // `dependencies` is automatic and also configured; it must appear once.
    expect(labels.filter(label => label === 'dependencies')).toHaveLength(1)
    expect(labels.filter(label => label === 'deps')).toHaveLength(1)
  })

  describe('security advisories', () => {
    /** An update that resolves a published advisory. */
    const vulnerable: PackageUpdate = {
      ...update,
      securityAdvisories: [{
        id: 'GHSA-xxxx-yyyy-zzzz',
        aliases: ['CVE-2026-0001'],
        severity: 'high',
        summary: 'Prototype pollution',
        url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
      }],
    }

    /** Resolve labels for a group carrying the advisory. */
    function labelsForVulnerable(config: BuddyConfig): string[] {
      const buddy = new Buddy(config)
      // @ts-expect-error - accessing private method for testing
      return buddy.labelsFor({ ...group, updates: [vulnerable] }, new PullRequestGenerator(config))
    }

    it('success case - labels a group that resolves an advisory', () => {
      // `security-only` auto-merge tests for this label, so while nothing
      // applied it that condition could never once fire.
      expect(labelsForVulnerable(baseConfig)).toContain('security')
    })

    it('success case - honours a configured label name', () => {
      const labels = labelsForVulnerable({ ...baseConfig, security: { label: 'vulnerability' } })

      expect(labels).toContain('vulnerability')
      expect(labels).not.toContain('security')
    })

    it('failure case - a routine update is not labelled security', () => {
      // The old implementation matched package names that merely sounded
      // security-related, which mislabelled routine updates.
      expect(labelsFor(baseConfig)).not.toContain('security')
    })
  })

  it('edge case - a rule that does not match contributes nothing', () => {
    const labels = labelsFor({
      ...baseConfig,
      packages: { strategy: 'all', rules: [{ matchPackages: ['vue'], labels: ['should-not-appear'] }] },
    })
    expect(labels).not.toContain('should-not-appear')
  })
})
