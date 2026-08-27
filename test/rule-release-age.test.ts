import type { BuddyConfig, PackageUpdate } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { Buddy } from '../src/buddy'

/** An update, with only the fields the age filter reads. */
function update(name: string): PackageUpdate {
  return {
    name,
    currentVersion: '1.0.0',
    newVersion: '1.1.0',
    updateType: 'minor',
    dependencyType: 'dependencies',
    file: 'package.json',
  } as PackageUpdate
}

interface Asked {
  name: string
  required?: number
}

/**
 * Run the filter with the age check stubbed, recording what each package was
 * asked to satisfy.
 *
 * `holdsFor` decides the verdict: a package is kept when the age it is
 * required to meet is at or below what the fixture says it has actually aged.
 */
function filter(config: BuddyConfig, updates: PackageUpdate[], agedMinutes: Record<string, number>) {
  const buddy = new Buddy(config, process.cwd())
  const asked: Asked[] = []

  ;(buddy as any).registryClient.meetsMinimumReleaseAge = async (
    name: string,
    _version: string,
    _type?: string,
    required?: number,
  ) => {
    asked.push({ name, required })
    return (agedMinutes[name] ?? 0) >= (required ?? 0)
  }

  return (buddy as any).filterUpdatesByMinimumReleaseAge(updates)
    .then((kept: PackageUpdate[]) => ({ kept: kept.map(u => u.name), asked }))
}

/**
 * `packages.rules[].minimumReleaseAge` was declared on `PackageRule`, resolved
 * into `ResolvedEffects`, validated by `config-validation`, and converted from
 * Renovate's prose durations — and nothing ever read the resolved value. Both
 * age gates read the global setting only, so a rule holding one risky package
 * for a week did nothing at all.
 */
describe('per-rule minimum release age', () => {
  it('success case - a rule holds a package the global would have let through', async () => {
    // The headline: no global age at all, and the rule still holds.
    const { kept } = await filter(
      {
        packages: {
          strategy: 'all',
          rules: [{ matchPackages: ['react'], minimumReleaseAge: 10080 }],
        },
      },
      [update('react'), update('lodash')],
      { react: 60, lodash: 60 },
    )

    expect(kept).toEqual(['lodash'])
  })

  it('success case - a rule can hold longer than the global', async () => {
    const { kept, asked } = await filter(
      {
        packages: {
          strategy: 'all',
          minimumReleaseAge: 60,
          rules: [{ matchPackages: ['react'], minimumReleaseAge: 10080 }],
        },
      },
      [update('react'), update('lodash')],
      { react: 1440, lodash: 1440 },
    )

    expect(kept).toEqual(['lodash'])
    expect(asked).toEqual([
      { name: 'react', required: 10080 },
      { name: 'lodash', required: 60 },
    ])
  })

  it('success case - a rule can release sooner than the global', async () => {
    // Overriding downward matters as much: a repository holding everything for
    // a week still wants its own packages to move.
    const { kept } = await filter(
      {
        packages: {
          strategy: 'all',
          minimumReleaseAge: 10080,
          rules: [{ matchPackages: ['@acme/*'], minimumReleaseAge: 0 }],
        },
      },
      [update('@acme/ui'), update('lodash')],
      { '@acme/ui': 5, 'lodash': 5 },
    )

    expect(kept).toEqual(['@acme/ui'])
  })

  it('success case - packages no rule matches keep the global hold', async () => {
    const { asked } = await filter(
      {
        packages: {
          strategy: 'all',
          minimumReleaseAge: 60,
          rules: [{ matchPackages: ['react'], minimumReleaseAge: 10080 }],
        },
      },
      [update('lodash')],
      { lodash: 99999 },
    )

    expect(asked).toEqual([{ name: 'lodash', required: 60 }])
  })

  it('edge case - a zero global with no rule ages skips the check entirely', async () => {
    // The filter is a network round trip per update; it must not run when
    // nothing has asked for a hold.
    const { kept, asked } = await filter(
      { packages: { strategy: 'all', minimumReleaseAge: 0 } },
      [update('react')],
      {},
    )

    expect(kept).toEqual(['react'])
    expect(asked).toEqual([])
  })

  it('edge case - a rule with no age of its own falls back to the global', async () => {
    const { asked } = await filter(
      {
        packages: {
          strategy: 'all',
          minimumReleaseAge: 60,
          rules: [{ matchPackages: ['react'], groupName: 'React' }],
        },
      },
      [update('react')],
      { react: 99999 },
    )

    expect(asked).toEqual([{ name: 'react', required: 60 }])
  })

  it('failure case - a hold is not defeated by pairing it with auto-merge', async () => {
    // The dangerous shape. A rule saying "hold this for a week, then merge it
    // without review" was proposing and auto-merging a version published
    // minutes earlier, because only the auto-merge half was ever read.
    const { kept } = await filter(
      {
        packages: {
          strategy: 'all',
          rules: [{ matchPackages: ['react'], minimumReleaseAge: 10080, autoMerge: true }],
        },
      },
      [update('react')],
      { react: 5 },
    )

    expect(kept).toEqual([])
  })

  it('success case - the later of two matching rules wins', async () => {
    // `minimumReleaseAge` is a single value, so a broad rule sets a default
    // and a narrow one refines it — which is what the docs promise.
    const { asked } = await filter(
      {
        packages: {
          strategy: 'all',
          rules: [
            { matchPackages: ['**'], minimumReleaseAge: 60 },
            { matchPackages: ['react'], minimumReleaseAge: 10080 },
          ],
        },
      },
      [update('react')],
      { react: 99999 },
    )

    expect(asked).toEqual([{ name: 'react', required: 10080 }])
  })
})
