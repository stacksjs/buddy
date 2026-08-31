import { describe, expect, it } from 'bun:test'
import { VersionResolver } from '../src/version/version-resolver'

/**
 * Publicly exported from the package root and referenced by no test — the
 * last module on the dossier's zero-coverage list. Nothing inside buddy
 * calls it either (the scanner classifies versions through
 * `utils/helpers.getUpdateType`), so these tests are the only thing standing
 * between the exported API and silent breakage.
 */
describe('VersionResolver', () => {
  describe('compareVersions', () => {
    it('success case - orders versions numerically, not lexically', () => {
      // '1.10.0' sorts after '1.2.3' as a version and before it as a string.
      expect(VersionResolver.compareVersions('1.2.3', '1.10.0')).toBe(-1)
      expect(VersionResolver.compareVersions('1.10.0', '1.2.3')).toBe(1)
      expect(VersionResolver.compareVersions('1.2.3', '1.2.3')).toBe(0)
    })
  })

  describe('satisfiesRange', () => {
    it('success case - honours caret and tilde semantics', () => {
      expect(VersionResolver.satisfiesRange('1.4.2', '^1.0.0')).toBe(true)
      expect(VersionResolver.satisfiesRange('2.0.0', '^1.0.0')).toBe(false)
      expect(VersionResolver.satisfiesRange('1.2.9', '~1.2.3')).toBe(true)
      expect(VersionResolver.satisfiesRange('1.3.0', '~1.2.3')).toBe(false)
    })
  })

  describe('getLatestInRange', () => {
    it('success case - picks the highest satisfying version', () => {
      const versions = ['1.0.0', '1.4.2', '1.10.0', '2.0.0']

      expect(VersionResolver.getLatestInRange(versions, '^1.0.0')).toBe('1.10.0')
    })

    it('failure case - returns null when nothing satisfies', () => {
      expect(VersionResolver.getLatestInRange(['1.0.0', '1.4.2'], '^3.0.0')).toBeNull()
    })

    it('edge case - an empty list has no latest', () => {
      expect(VersionResolver.getLatestInRange([], '^1.0.0')).toBeNull()
    })
  })

  describe('createRange', () => {
    it('success case - a caret range parses with its operator stripped', () => {
      const range = VersionResolver.createRange('^1.2.3')

      expect(range.raw).toBe('^1.2.3')
      expect(range.range).toBe('1.2.3')
      expect(range.isExact).toBe(false)
    })

    it('success case - an operatorless version is exact', () => {
      expect(VersionResolver.createRange('1.2.3').isExact).toBe(true)
    })

    it('success case - the closures resolve against the raw range', () => {
      const range = VersionResolver.createRange('^1.0.0')

      expect(range.satisfies('1.4.2')).toBe(true)
      expect(range.satisfies('2.0.0')).toBe(false)
      expect(range.getLatest(['1.0.0', '1.4.2', '2.0.0'])).toBe('1.4.2')
    })
  })

  describe('getUpdateType', () => {
    it('success case - classifies by the first component that grew', () => {
      expect(VersionResolver.getUpdateType('1.2.3', '2.0.0')).toBe('major')
      expect(VersionResolver.getUpdateType('1.2.3', '1.3.0')).toBe('minor')
      expect(VersionResolver.getUpdateType('1.2.3', '1.2.4')).toBe('patch')
    })

    it('success case - range operators on either side are ignored', () => {
      expect(VersionResolver.getUpdateType('^1.2.3', '2.0.0')).toBe('major')
      expect(VersionResolver.getUpdateType('~1.2.3', '1.2.9')).toBe('patch')
    })

    it('edge case - short versions pad to major.minor.patch', () => {
      expect(VersionResolver.getUpdateType('1.2', '1.3')).toBe('minor')
      expect(VersionResolver.getUpdateType('1', '2')).toBe('major')
    })
  })

  describe('isSafeUpdate', () => {
    it('success case - safe means the new version stays inside the range', () => {
      expect(VersionResolver.isSafeUpdate('^1.0.0', '1.9.9')).toBe(true)
      expect(VersionResolver.isSafeUpdate('^1.0.0', '2.0.0')).toBe(false)
    })

    it('edge case - an exact pin admits nothing else', () => {
      expect(VersionResolver.isSafeUpdate('1.2.3', '1.2.4')).toBe(false)
      expect(VersionResolver.isSafeUpdate('1.2.3', '1.2.3')).toBe(true)
    })
  })
})
