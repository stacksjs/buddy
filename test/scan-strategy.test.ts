import type { PackageUpdate } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { Buddy } from '../src/buddy'

function update(name: string, updateType: PackageUpdate['updateType']): PackageUpdate {
  return {
    name,
    currentVersion: '1.0.0',
    newVersion: updateType === 'major' ? '2.0.0' : updateType === 'minor' ? '1.1.0' : '1.0.1',
    updateType,
    dependencyType: 'dependencies',
    file: 'package.json',
  } as PackageUpdate
}

/**
 * `buddy scan --strategy patch --packages react` folded `--strategy` into the
 * config and then listed the major anyway: the full scan filtered by strategy
 * and the targeted `--packages` / `--pattern` paths did not.
 */
describe('strategy on targeted checks', () => {
  function buddyWith(strategy: 'all' | 'major' | 'minor' | 'patch' | undefined) {
    const buddy = new Buddy({ packages: strategy ? { strategy } : ({} as never) }, process.cwd())
    const client = (buddy as never as { registryClient: Record<string, unknown> }).registryClient
    client.getUpdatesForPackages = async () => [update('react', 'major'), update('lodash', 'patch')]
    client.getUpdatesWithPattern = async () => [update('@types/node', 'minor'), update('@types/bun', 'patch')]
    return buddy
  }

  it('success case - --packages honours the strategy', async () => {
    const updates = await buddyWith('patch').checkPackages(['react', 'lodash'])

    expect(updates.map(u => u.name)).toEqual(['lodash'])
  })

  it('success case - --pattern honours the strategy', async () => {
    const updates = await buddyWith('patch').checkPackagesWithPattern('@types/*')

    expect(updates.map(u => u.name)).toEqual(['@types/bun'])
  })

  it('success case - all admits everything, as the scan does', async () => {
    expect(await buddyWith('all').checkPackages(['react', 'lodash'])).toHaveLength(2)
  })

  it('edge case - no strategy configured filters nothing', async () => {
    expect(await buddyWith(undefined).checkPackages(['react', 'lodash'])).toHaveLength(2)
  })
})
