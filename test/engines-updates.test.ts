import type { PackageFile, PackageUpdate } from '../src/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Buddy } from '../src/buddy'
import { validateConfig } from '../src/config-validation'
import { applyEngineUpdates, engineUpdateType } from '../src/scanner/package-json-extras'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

const MANIFEST = `{
  "name": "app",
  "engines": {
    "node": ">=20",
    "pnpm": "^9.0.0"
  },
  "devDependencies": {
    "pnpm": "^9.0.0"
  }
}
`

function engine(name: string, current: string, next: string): PackageUpdate {
  return {
    name,
    currentVersion: current,
    newVersion: next,
    updateType: engineUpdateType(current, next),
    dependencyType: 'engines',
    file: 'package.json',
  } as PackageUpdate
}

/**
 * `resolveEngineVersion` and `bumpEngineConstraint` were written, tested and
 * exported, and no scan step called either — so an engine was listed on the
 * dashboard and never proposed. Had one been, the package.json writer only
 * looks in the four dependency sections, so it would have logged "not found"
 * and written nothing.
 */
describe('engine update type', () => {
  it('success case - classifies by the first component that moved', () => {
    expect(engineUpdateType('>=20', '>=22')).toBe('major')
    expect(engineUpdateType('>=20.5', '>=20.9')).toBe('minor')
    expect(engineUpdateType('^1.2.3', '^1.2.4')).toBe('patch')
  })
})

describe('rewriting engine constraints', () => {
  it('success case - rewrites the constraint and nothing else', () => {
    const result = applyEngineUpdates(MANIFEST, [engine('node', '>=20', '>=22')])

    expect(result).toContain('"node": ">=22"')
    // Indentation, key order and the trailing newline are the author's.
    expect(result.split('\n').length).toBe(MANIFEST.split('\n').length)
    expect(result.endsWith('\n')).toBe(true)
  })

  it('failure case - a name shared with a dependency is not touched there', () => {
    // `pnpm` is both an engine and a devDependency here. Only the engine
    // moves; rewriting the devDependency would be a different update.
    const result = applyEngineUpdates(MANIFEST, [engine('pnpm', '^9.0.0', '^10.0.0')])

    expect(result).toContain('"engines": {\n    "node": ">=20",\n    "pnpm": "^10.0.0"')
    expect(result).toContain('"devDependencies": {\n    "pnpm": "^9.0.0"')
  })

  it('success case - applies several engines in one pass', () => {
    const result = applyEngineUpdates(MANIFEST, [
      engine('node', '>=20', '>=22'),
      engine('pnpm', '^9.0.0', '^10.0.0'),
    ])

    expect(result).toContain('"node": ">=22"')
    expect(result).toContain('"pnpm": "^10.0.0"')
  })

  it('edge case - an unmatched constraint leaves the file identical', () => {
    expect(applyEngineUpdates(MANIFEST, [engine('node', '>=18', '>=22')])).toBe(MANIFEST)
  })

  it('edge case - a manifest with no engines block is untouched', () => {
    const bare = '{\n  "name": "app"\n}\n'
    expect(applyEngineUpdates(bare, [engine('node', '>=20', '>=22')])).toBe(bare)
  })
})

describe('checking engines for updates', () => {
  function manifestWith(engines: Record<string, string>): PackageFile {
    return {
      path: 'package.json',
      type: 'package.json',
      content: '',
      dependencies: Object.entries(engines).map(([name, currentVersion]) => ({
        name,
        currentVersion,
        type: 'engines' as const,
        file: 'package.json',
      })),
    }
  }

  function buddyWithRegistry(latest: Record<string, string | null>): Buddy {
    const buddy = new Buddy({ packages: { strategy: 'all', engines: true } }, process.cwd())
    ;(buddy as never as { registryClient: { getLatestVersion: (n: string) => Promise<string | null> } })
      .registryClient.getLatestVersion = async name => latest[name] ?? null
    return buddy
  }

  async function check(buddy: Buddy, files: PackageFile[]): Promise<PackageUpdate[]> {
    return (buddy as never as { checkEnginesForUpdates: (f: PackageFile[]) => Promise<PackageUpdate[]> })
      .checkEnginesForUpdates(files)
  }

  it('success case - an npm-published runtime is resolved through the registry', async () => {
    const updates = await check(buddyWithRegistry({ pnpm: '10.4.1' }), [manifestWith({ pnpm: '^9.0.0' })])

    expect(updates).toEqual([
      expect.objectContaining({
        name: 'pnpm',
        currentVersion: '^9.0.0',
        newVersion: '^10.4.1',
        updateType: 'major',
        dependencyType: 'engines',
      }),
    ])
  })

  it('success case - node is resolved through its GitHub releases', async () => {
    globalThis.fetch = (async (input: string) => {
      expect(String(input)).toContain('/repos/nodejs/node/releases/latest')
      return new Response(JSON.stringify({ tag_name: 'v22.3.0' }), { status: 200 })
    }) as unknown as typeof fetch

    const updates = await check(buddyWithRegistry({}), [manifestWith({ node: '>=20' })])

    expect(updates[0]).toMatchObject({ name: 'node', newVersion: '>=22' })
  })

  it('success case - the constraint keeps its shape', async () => {
    // A floor stays a floor at the author's precision: `>=20` becomes `>=22`,
    // never `22.3.0`, which would break every contributor on another patch.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tag_name: 'v22.3.0' }), { status: 200 })) as unknown as typeof fetch

    const updates = await check(buddyWithRegistry({}), [manifestWith({ node: '>=20.5' })])

    expect(updates[0]?.newVersion).toBe('>=22.3')
  })

  it('edge case - a constraint already at the latest yields nothing', async () => {
    // Compared at the author's precision: a floor of `>=9` is not moved by a
    // 9.x release, only by 10.
    const updates = await check(buddyWithRegistry({ pnpm: '9.1.0' }), [manifestWith({ pnpm: '>=9' })])

    expect(updates).toEqual([])
  })

  it('success case - a precise caret constraint follows the latest within its major', async () => {
    // `^9.0.0` admits 9.1.0 already, but the floor is what the author wrote,
    // and keeping it current is the point — the same way `^9.0.0` on a
    // dependency is bumped to `^9.1.0`.
    const updates = await check(buddyWithRegistry({ pnpm: '9.1.0' }), [manifestWith({ pnpm: '^9.0.0' })])

    expect(updates[0]).toMatchObject({ newVersion: '^9.1.0', updateType: 'minor' })
  })

  it('edge case - an unresolvable runtime yields nothing rather than an error', async () => {
    const updates = await check(buddyWithRegistry({ pnpm: null }), [manifestWith({ pnpm: '^9.0.0' })])

    expect(updates).toEqual([])
  })

  it('edge case - a manifest with no engines makes no lookups', async () => {
    let looked = false
    const buddy = buddyWithRegistry({})
    ;(buddy as never as { registryClient: { getLatestVersion: () => Promise<null> } })
      .registryClient.getLatestVersion = async () => {
        looked = true
        return null
      }

    expect(await check(buddy, [manifestWith({})])).toEqual([])
    expect(looked).toBe(false)
  })
})

describe('the opt-in', () => {
  it('success case - engines is a boolean in config', () => {
    expect(validateConfig({ packages: { strategy: 'all', engines: true } })).toEqual([])
  })

  it('failure case - a non-boolean is rejected', () => {
    const issues = validateConfig({ packages: { strategy: 'all', engines: 'yes' as never } })

    expect(issues.some(issue => issue.path === 'packages.engines')).toBe(true)
  })
})

describe('writing engines through the file generator', () => {
  it('success case - an engines update reaches the manifest on disk', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'buddy-engines-'))
    const path = join(dir, 'package.json')
    await fs.writeFile(path, MANIFEST)

    try {
      const buddy = new Buddy({ packages: { strategy: 'all' } }, dir)
      const changes = await buddy.generateAllFileUpdates([{ ...engine('node', '>=20', '>=22'), file: path }])

      // Before this, the update went through the dependency-section loop,
      // logged "Package node not found", and produced no change at all.
      expect(changes).toHaveLength(1)
      expect(changes[0].content).toContain('"node": ">=22"')
    }
    finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
