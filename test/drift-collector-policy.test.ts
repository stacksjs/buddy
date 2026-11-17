import type { Logger } from '../src/utils/logger'
import { expect, spyOn, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RegistryClient } from '../src/registry/registry-client'
import { collectDriftInputs } from '../src/scanner/drift-collector'
import { findDrift } from '../src/scanner/resolution-drift'

test('the capped dependency report follows the current registry release line', async () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-drift-policy-'))
  const logger = { info() {}, warn() {}, error() {}, success() {}, debug() {} } as unknown as Logger
  const fetcher = spyOn(globalThis, 'fetch').mockImplementation((async () => Response.json({
    'name': '@stacksjs/desktop',
    'dist-tags': { latest: '0.2.902' },
    'versions': { '0.2.902': {}, '0.70.232': {} },
  })) as unknown as typeof fetch)
  try {
    for (const manifest of [
      { name: '@stacksjs/desktop', version: '0.2.902' },
      { name: 'renderer', version: '1.0.0', dependencies: { '@stacksjs/desktop': '^0.2.889' } },
    ]) {
      const directory = join(root, 'node_modules', manifest.name)
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
    }
    const registry = new RegistryClient(root, logger, { registries: { npm: 'https://registry.example.test' } })
    const inputs = await collectDriftInputs([], registry, root, logger)
    expect(inputs).toHaveLength(1)
    expect(findDrift(inputs)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  }
  finally {
    fetcher.mockRestore()
    rmSync(root, { recursive: true, force: true })
  }
})

test.each([
  { name: 'excluded prerelease', includePrerelease: false, latest: '23.2.0-beta.1', expected: undefined },
  { name: 'explicit prerelease opt-in', includePrerelease: true, latest: '23.2.0-beta.1', expected: '23.2.0-beta.1' },
  { name: 'genuine stable cap', includePrerelease: false, latest: '23.1.0', expected: '23.1.0' },
])('the capped dependency report respects $name', async ({ includePrerelease, latest, expected }) => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-drift-prerelease-'))
  const logger = { info() {}, warn() {}, error() {}, success() {}, debug() {} } as unknown as Logger
  const versions: Record<string, object> = { '23.0.0': {}, '23.2.0-beta.1': {} }
  if (latest === '23.1.0') versions['23.1.0'] = {}
  const fetcher = spyOn(globalThis, 'fetch').mockImplementation((async () => Response.json({
    'name': 'stripe',
    'dist-tags': { latest },
    versions,
  })) as unknown as typeof fetch)
  try {
    for (const manifest of [
      { name: 'stripe', version: '23.0.0' },
      { name: 'payments', version: '1.0.0', dependencies: { stripe: '23.0.0' } },
    ]) {
      const directory = join(root, 'node_modules', manifest.name)
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
    }
    const registry = new RegistryClient(root, logger, {
      registries: { npm: 'https://registry.example.test' },
      packages: { strategy: 'all', includePrerelease },
    })
    const inputs = await collectDriftInputs([], registry, root, logger)
    const drift = findDrift(inputs)
    if (expected) {
      expect(drift).toHaveLength(1)
      expect(drift[0]).toMatchObject({ name: 'stripe', kind: 'capped', installed: '23.0.0', reachable: '23.0.0', latest: expected })
    }
    else {
      expect(drift).toEqual([])
    }
    expect(fetcher).toHaveBeenCalledTimes(1)
  }
  finally {
    fetcher.mockRestore()
    rmSync(root, { recursive: true, force: true })
  }
})
