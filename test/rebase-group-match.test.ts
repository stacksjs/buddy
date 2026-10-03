import { describe, expect, it } from 'bun:test'
import { findGroupForPullRequest, serializeManifest } from '../src/pr/pr-manifest'

// stacksjs/stacks#2817: its package set moved between runs (37 in the PR, 45
// in the scan), so the exact-set match found no group and a ticked rebase box
// did nothing while reporting success.
describe('the group a rebase refreshes from', () => {
  const groups = [
    { name: 'Non-Major Updates', updates: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
    { name: 'Major Update - stripe', updates: [{ name: 'stripe' }, { name: 'stripe' }] },
  ]

  it('is the group the PR manifest names, even when its packages moved', () => {
    const body = `table${serializeManifest([{ name: 'a', currentVersion: '1', newVersion: '2', updateType: 'minor', dependencyType: 'dependencies', file: 'package.json' }] as any, { group: 'Non-Major Updates' })}`
    expect(findGroupForPullRequest(groups, body, ['a'])?.name).toBe('Non-Major Updates')
  })

  it('falls back to the same package names, counted once per package', () => {
    expect(findGroupForPullRequest(groups, 'no manifest', ['stripe'])?.name).toBe('Major Update - stripe')
  })

  it('finds nothing for a set no group has', () => {
    expect(findGroupForPullRequest(groups, 'no manifest', ['zzz'])).toBeUndefined()
  })
})
