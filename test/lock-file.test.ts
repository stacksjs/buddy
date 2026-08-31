import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  detectRequiredPackageManagers,
  getAllLockFilePaths,
  hasLockFile,
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
      for (const expected of ['bun.lock', 'bun.lockb', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock'])
        expect(paths).toContain(expected)
    })
  })

  describe('hasLockFile', () => {
    it('success case - finds each manager by its lock file', () => {
      const dir = tempDir()
      writeFileSync(join(dir, 'yarn.lock'), '')
      writeFileSync(join(dir, 'composer.lock'), '{}')

      expect(hasLockFile('yarn', dir)).toBe(true)
      expect(hasLockFile('composer', dir)).toBe(true)
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
    // These run from the repository root, whose bun.lock makes the JS
    // manager detection deterministic.
    it('success case - a package.json update needs the JS manager', () => {
      expect(detectRequiredPackageManagers(['package.json'])).toEqual(['bun'])
      expect(detectRequiredPackageManagers(['packages/app/package.json'])).toEqual(['bun'])
    })

    it('success case - a composer.json update needs composer', () => {
      expect(detectRequiredPackageManagers(['composer.json'])).toEqual(['composer'])
    })

    it('success case - mixed updates need both, once each', () => {
      const managers = detectRequiredPackageManagers([
        'package.json',
        'composer.json',
        'sub/package.json',
      ])

      expect(managers.sort()).toEqual(['bun', 'composer'])
    })

    it('edge case - unrelated files need nothing', () => {
      expect(detectRequiredPackageManagers(['deps.yaml', 'README.md', 'Dockerfile'])).toEqual([])
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
