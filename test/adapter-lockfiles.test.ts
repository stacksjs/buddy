import type { PackageUpdate } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Buddy } from '../src/buddy'
import { regenerateLockfiles } from '../src/ecosystems/scan'

/** An adapter that records what it was asked to do. */
function fakeAdapter(name: string, options: { lockfile?: string, note?: string } = {}) {
  const seen: string[] = []

  return {
    seen,
    adapter: {
      name,
      applyUpdate: (content: string) => content,
      async postWrite(dir: string) {
        seen.push(dir)
        return {
          regenerated: options.lockfile ? [options.lockfile] : [],
          ...(options.note ? { note: options.note } : {}),
        }
      },
    } as never,
  }
}

/**
 * `regenerateLockfiles` and every adapter's `postWrite` were written, tested
 * and exported, and nothing called them — so a Python, Rust, Go or Ruby
 * manifest was updated and its lockfile left describing the old version. That
 * is the `lockfile-drift` failure `fix-ci` exists to diagnose, arriving on a
 * pull request buddy opened itself.
 */
describe('regenerateLockfiles', () => {
  it('success case - runs the adapters whose manifests changed', async () => {
    const python = fakeAdapter('python', { lockfile: 'uv.lock' })
    const rust = fakeAdapter('rust', { lockfile: 'Cargo.lock' })

    const result = await regenerateLockfiles('/repo', ['python'], [python.adapter, rust.adapter])

    expect(result.regenerated).toEqual(['uv.lock'])
    expect(python.seen).toEqual(['/repo'])
    expect(rust.seen).toEqual([])
  })

  it('success case - collects the notes an adapter reports', async () => {
    // A missing tool has to surface: the pull request will carry a manifest
    // its lockfile does not match.
    const python = fakeAdapter('python', { note: 'uv.lock (needs `uv lock`)' })

    const result = await regenerateLockfiles('/repo', ['python'], [python.adapter])

    expect(result.notes).toEqual(['uv.lock (needs `uv lock`)'])
    expect(result.regenerated).toEqual([])
  })

  it('failure case - an adapter that throws does not stop the others', async () => {
    const broken = {
      name: 'python',
      applyUpdate: (c: string) => c,
      postWrite: async () => { throw new Error('uv exploded') },
    } as never
    const ruby = fakeAdapter('ruby', { lockfile: 'Gemfile.lock' })

    const result = await regenerateLockfiles('/repo', ['python', 'ruby'], [broken, ruby.adapter])

    expect(result.regenerated).toEqual(['Gemfile.lock'])
  })
})

describe('adapter updates carry their lockfile', () => {
  let testDir: string

  // Deliberately no `process.chdir`: `Buddy` takes an explicit project path,
  // and another suite in this run leaves the working directory pointing at a
  // temporary directory it has already removed.
  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'buddy-locks-'))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('success case - the updated manifest is on disk before the tool runs', async () => {
    // `postWrite` runs the ecosystem's own tool against the working tree: it
    // reads the manifest, not the change about to be committed. A tool run
    // before the write would lock the version being replaced.
    await fs.writeFile(join(testDir, 'Cargo.toml'), '[dependencies]\nserde = "1.0.100"\n')

    const buddy = new Buddy({ packages: { strategy: 'all' } }, testDir)
    const update = {
      name: 'serde',
      currentVersion: '1.0.100',
      newVersion: '1.0.200',
      updateType: 'patch',
      dependencyType: 'rust',
      file: 'Cargo.toml',
    } as PackageUpdate

    const changes = await (buddy as never as {
      generateAdapterFileUpdates: (u: PackageUpdate[]) => Promise<Array<{ path: string, content: string }>>
    }).generateAdapterFileUpdates([update])

    const manifest = changes.find(change => change.path === 'Cargo.toml')
    expect(manifest?.content).toContain('1.0.200')

    // The staged write is what makes the regeneration meaningful.
    expect(await fs.readFile(join(testDir, 'Cargo.toml'), 'utf-8')).toContain('1.0.200')
  })

  it('edge case - no adapter updates means nothing is written', async () => {
    const buddy = new Buddy({ packages: { strategy: 'all' } }, testDir)

    const changes = await (buddy as never as {
      generateAdapterFileUpdates: (u: PackageUpdate[]) => Promise<unknown[]>
    }).generateAdapterFileUpdates([
      { name: 'react', currentVersion: '1', newVersion: '2', updateType: 'major', dependencyType: 'dependencies', file: 'package.json' } as PackageUpdate,
    ])

    expect(changes).toEqual([])
  })
})
