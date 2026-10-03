import type { PackageUpdate } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { groupUpdates } from '../src/utils/helpers'

// stripe was pinned at 22.3.2 in two workspace manifests (payments and orm).
// The update was deduplicated down to one file, so the major PR bumped only
// payments: two Stripe copies were installed and their types stopped lining up.
describe('a dependency declared in several manifests', () => {
  const update = (file: string, updateType: PackageUpdate['updateType'] = 'major'): PackageUpdate => ({
    name: 'stripe',
    currentVersion: '22.3.2',
    newVersion: '23.0.0',
    updateType,
    dependencyType: 'dependencies',
    file,
  })

  it('bumps every manifest in one major PR', () => {
    const groups = groupUpdates([
      update('storage/framework/core/payments/package.json'),
      update('storage/framework/core/orm/package.json'),
    ], { prioritizeSecurity: false })

    const majors = groups.filter(group => group.name === 'Major Update - stripe')
    expect(majors).toHaveLength(1)
    expect(majors[0]!.updates.map(u => u.file).sort()).toEqual([
      'storage/framework/core/orm/package.json',
      'storage/framework/core/payments/package.json',
    ])
  })

  it('keeps every manifest in the non-major group too', () => {
    const groups = groupUpdates([update('a/package.json', 'minor'), update('b/package.json', 'minor')], { prioritizeSecurity: false })
    expect(groups.find(group => group.name === 'Non-Major Updates')!.updates).toHaveLength(2)
  })

  it('still prefers a manifest over a dependency file naming the same package', () => {
    const groups = groupUpdates([update('deps.yaml', 'minor'), update('package.json', 'minor')], { prioritizeSecurity: false })
    expect(groups.find(group => group.name === 'Non-Major Updates')!.updates.map(u => u.file)).toEqual(['package.json'])
  })
})
