import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  detectRequiredPackageManagers,
  getAllLockFilePaths,
  hasLockFile,
  lockFileFor,
  missingLockFiles,
  regenerateLockFile,
} from '../src/utils/lock-file'

/**
 * 188 lines, publicly re-exported, and no direct test — the dossier's
 * shortlist. The spawn-heavy path is exercised through its non-fatal error
 * contract; the pure parts are asserted directly.
 */
describe('lock-file', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0)
      cleanups.pop()?.()
  })

  /** A temp directory removed after the test. */
  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'buddy-lock-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    return dir
  }

  describe('getAllLockFilePaths', () => {
    it('success case - names every lock file a regeneration may touch', () => {
      const paths = getAllLockFilePaths()

      // The staging step after regeneration adds exactly these; a manager
      // whose lock file is missing here gets regenerated and then not
      // committed, which looks like the update never ran.
      for (const expected of ['bun.lock', 'bun.lockb', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'pantry.lock'])
        expect(paths).toContain(expected)
    })
  })

  describe('hasLockFile', () => {
    it('success case - finds each manager by its lock file', () => {
      const dir = tempDir()
      writeFileSync(join(dir, 'yarn.lock'), '')
      writeFileSync(join(dir, 'composer.lock'), '{}')
      writeFileSync(join(dir, 'pantry.lock'), '{}')

      expect(hasLockFile('yarn', dir)).toBe(true)
      expect(hasLockFile('composer', dir)).toBe(true)
      expect(hasLockFile('pantry', dir)).toBe(true)
      expect(hasLockFile('npm', dir)).toBe(false)
      expect(hasLockFile('pnpm', dir)).toBe(false)
    })

    it('edge case - either bun lock format counts', () => {
      const textual = tempDir()
      writeFileSync(join(textual, 'bun.lock'), '')
      expect(hasLockFile('bun', textual)).toBe(true)

      const binary = tempDir()
      writeFileSync(join(binary, 'bun.lockb'), '')
      expect(hasLockFile('bun', binary)).toBe(true)

      expect(hasLockFile('bun', tempDir())).toBe(false)
    })
  })

  describe('detectRequiredPackageManagers', () => {
    /** A project root holding exactly these lock files. */
    function project(...lockfiles: string[]): string {
      const dir = tempDir()
      for (const lockfile of lockfiles)
        writeFileSync(join(dir, lockfile), '')
      return dir
    }

    it('success case - a package.json update needs the JS manager', () => {
      const dir = project('bun.lock')
      expect(detectRequiredPackageManagers(['package.json'], dir)).toEqual(['bun'])
      expect(detectRequiredPackageManagers(['packages/app/package.json'], dir)).toEqual(['bun'])
    })

    it('success case - a composer.json update needs composer', () => {
      expect(detectRequiredPackageManagers(['composer.json'], project('bun.lock'))).toEqual(['composer'])
    })

    it('success case - mixed updates need both, once each', () => {
      const managers = detectRequiredPackageManagers([
        'package.json',
        'composer.json',
        'sub/package.json',
      ], project('bun.lock'))

      expect(managers.sort()).toEqual(['bun', 'composer'])
    })

    it('edge case - unrelated files need nothing', () => {
      expect(detectRequiredPackageManagers(['deps.yaml', 'README.md', 'Dockerfile'], project('bun.lock'))).toEqual([])
    })

    // stacksjs/stacks#2848: pantry.lock records npm resolutions too, so a
    // package.json bump that regenerated only bun.lock failed the workspace's
    // "install must not change the lockfiles" check on every dependency PR.
    it('success case - a package.json update in a pantry project also regenerates pantry.lock, after the JS lockfile', () => {
      expect(detectRequiredPackageManagers(['package.json'], project('bun.lock', 'pantry.lock'))).toEqual(['bun', 'pantry'])
    })

    it('success case - a pantry manifest update regenerates pantry.lock alone', () => {
      const dir = project('bun.lock', 'pantry.lock')
      expect(detectRequiredPackageManagers(['deps.yaml'], dir)).toEqual(['pantry'])
      expect(detectRequiredPackageManagers(['pantry.jsonc'], dir)).toEqual(['pantry'])
    })

    it('edge case - pantry is not required without a pantry.lock', () => {
      expect(detectRequiredPackageManagers(['package.json', 'deps.yaml'], project('bun.lock'))).toEqual(['bun'])
    })

    it('edge case - pantry runs last even when composer is also needed', () => {
      const managers = detectRequiredPackageManagers(['composer.json', 'package.json'], project('bun.lock', 'pantry.lock'))
      expect(managers.at(-1)).toBe('pantry')
    })
  })

  // A pull request whose updates still match was skipped even when it had
  // never regenerated a lock file its manifests require, so it stayed red on
  // every run (stacksjs/stacks#2848: four open PRs without pantry.lock).
  describe('missingLockFiles', () => {
    function project(...lockfiles: string[]): string {
      const dir = tempDir()
      for (const lockfile of lockfiles)
        writeFileSync(join(dir, lockfile), '')
      return dir
    }

    it('names the pantry.lock a package.json bump left behind', () => {
      const dir = project('bun.lock', 'pantry.lock')
      expect(missingLockFiles(['package.json', 'bun.lock'], dir)).toEqual(['pantry.lock'])
    })

    it('is satisfied when every required lock file changed', () => {
      const dir = project('bun.lock', 'pantry.lock')
      expect(missingLockFiles(['packages/a/package.json', 'bun.lock', 'pantry.lock'], dir)).toEqual([])
    })

    it('expects only the lock files the project has', () => {
      expect(missingLockFiles(['package.json', 'bun.lock'], project('bun.lock'))).toEqual([])
      expect(missingLockFiles(['README.md'], project('bun.lock', 'pantry.lock'))).toEqual([])
    })

    it('finds the binary bun lock too', () => {
      const dir = project('bun.lockb')
      expect(lockFileFor('bun', dir)).toBe('bun.lockb')
      expect(missingLockFiles(['package.json'], dir)).toEqual(['bun.lockb'])
    })
  })

  describe('regenerateLockFile', () => {
    it('failure case - a missing binary resolves rather than throwing', async () => {
      // The contract is non-fatal: a machine without the manager installed
      // gets a result object naming the failure, not an unhandled rejection
      // that sinks the whole update run.
      const originalPath = process.env.PATH
      process.env.PATH = tempDir()
      cleanups.push(() => {
        process.env.PATH = originalPath
      })

      const result = await regenerateLockFile('yarn', tempDir())

      expect(result.success).toBe(false)
      expect(result.packageManager).toBe('yarn')
      // Which channel reports the missing binary is platform-dependent —
      // node fires the `error` event, Bun closes with a negative code. The
      // contract is only that the failure is named, not how it was caught.
      expect(result.message).toMatch(/Failed to run yarn|exited with code/)
    })
  })
})
