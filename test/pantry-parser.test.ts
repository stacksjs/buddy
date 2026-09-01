import { describe, expect, it } from 'bun:test'
import { isPantryLockFile, parsePantryLockFile } from '../src/utils/pantry-parser'

/**
 * 0% function coverage before this file: the parser is wired into the
 * package scanner and was never once called by a test, so a regression here
 * would surface as pantry.lock silently vanishing from the dashboard.
 */
describe('pantry-parser', () => {
  describe('isPantryLockFile', () => {
    it('success case - matches the lock file wherever it lives', () => {
      expect(isPantryLockFile('pantry.lock')).toBe(true)
      expect(isPantryLockFile('packages/app/pantry.lock')).toBe(true)
    })

    it('failure case - near-misses are not lock files', () => {
      expect(isPantryLockFile('pantry.lock.bak')).toBe(false)
      expect(isPantryLockFile('pantry.yaml')).toBe(false)
      expect(isPantryLockFile('bun.lock')).toBe(false)
    })
  })

  describe('parsePantryLockFile', () => {
    const lock = {
      version: '1',
      packages: {
        'bun.com': { name: 'bun.com', version: '1.2.19', resolved: 'https://example.com/bun' },
        'node': { name: 'node', version: '22.3.0', resolved: 'https://example.com/node' },
      },
    }

    it('success case - extracts every resolved package', async () => {
      const parsed = await parsePantryLockFile('pantry.lock', JSON.stringify(lock))

      expect(parsed?.type).toBe('pantry.lock')
      expect(parsed?.dependencies).toEqual([
        { name: 'bun.com', currentVersion: '1.2.19', type: 'dependencies', file: 'pantry.lock' },
        { name: 'node', currentVersion: '22.3.0', type: 'dependencies', file: 'pantry.lock' },
      ])
    })

    it('edge case - entries missing a name or version are skipped', async () => {
      const partial = {
        version: '1',
        packages: {
          ok: { name: 'ok', version: '1.0.0', resolved: '' },
          nameless: { version: '2.0.0', resolved: '' },
          versionless: { name: 'versionless', resolved: '' },
        },
      }

      const parsed = await parsePantryLockFile('pantry.lock', JSON.stringify(partial))

      expect(parsed?.dependencies.map(dep => dep.name)).toEqual(['ok'])
    })

    it('edge case - a lock without packages parses to no dependencies', async () => {
      const parsed = await parsePantryLockFile('pantry.lock', JSON.stringify({ version: '1' }))

      expect(parsed?.dependencies).toEqual([])
    })

    it('failure case - malformed JSON returns null rather than throwing', async () => {
      expect(await parsePantryLockFile('pantry.lock', 'not json {')).toBeNull()
    })
  })
})
