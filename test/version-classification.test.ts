import { describe, expect, it } from 'bun:test'
import { getUpdateType } from '../src/utils/helpers'
import { VersionResolver } from '../src/version/version-resolver'

describe('Version Classification', () => {
  describe('getUpdateType', () => {
    it('should correctly identify major updates', () => {
      expect(getUpdateType('1.0.0', '2.0.0')).toBe('major')
      expect(getUpdateType('0.14.1', '1.0.0')).toBe('major')
      expect(getUpdateType('2.5.3', '3.0.0')).toBe('major')
    })

    it('should correctly identify minor updates', () => {
      expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor')
      expect(getUpdateType('0.14.1', '0.15.0')).toBe('minor')
      expect(getUpdateType('0.14.1', '0.15.1')).toBe('minor')
      expect(getUpdateType('0.14.1', '0.16.3')).toBe('minor')
      expect(getUpdateType('2.5.3', '2.6.0')).toBe('minor')
      expect(getUpdateType('1.2.0', '1.3.5')).toBe('minor')
    })

    it('should correctly identify patch updates', () => {
      expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch')
      expect(getUpdateType('0.14.1', '0.14.2')).toBe('patch')
      expect(getUpdateType('2.5.3', '2.5.4')).toBe('patch')
      expect(getUpdateType('1.2.3', '1.2.10')).toBe('patch')
    })

    it('should handle version prefixes correctly', () => {
      expect(getUpdateType('^1.0.0', '1.1.0')).toBe('minor')
      expect(getUpdateType('~1.0.0', '1.0.1')).toBe('patch')
      expect(getUpdateType('v1.0.0', 'v2.0.0')).toBe('major')
      expect(getUpdateType('@1.0.0', '1.1.0')).toBe('minor')
      expect(getUpdateType('>=1.0.0', '1.1.0')).toBe('minor')
    })

    it('should handle edge cases', () => {
      // Same version should be patch (no-op)
      expect(getUpdateType('1.0.0', '1.0.0')).toBe('patch')

      // Downgrade should be patch
      expect(getUpdateType('1.1.0', '1.0.0')).toBe('patch')

      // Two-part versions
      expect(getUpdateType('1.0', '1.1')).toBe('minor')
      expect(getUpdateType('1.0', '2.0')).toBe('major')
    })

    it('should handle the specific bunfig case from PR #125', () => {
      // This was incorrectly classified as major but should be minor
      expect(getUpdateType('0.14.1', '0.15.0')).toBe('minor')
      expect(getUpdateType('0.14.1', '0.15.1')).toBe('minor')
    })
  })
})

/**
 * Three parallel implementations of this classification existed — helpers,
 * a private Buddy method, and VersionResolver — and disagreed on short
 * actions tags, prereleases, suffixed Docker tags and non-semver input.
 * These pin the decided semantics of the one that remains.
 */
describe('one classifier across the codebase', () => {
  it('success case - a short actions tag reads as the bump it is', () => {
    // Bun.semver.order('4.2.2', '4') is -1 — without numeric padding the
    // upgrade guard misread this real upgrade as a downgrade.
    expect(getUpdateType('v4', 'v4.2.2')).toBe('minor')
    expect(getUpdateType('v4.2.2', 'v5')).toBe('major')
  })

  it('success case - prerelease movement under an unchanged triple is a patch', () => {
    // These fell through to 'major', letting an excludeMajor filter block a
    // beta graduation as if it were a breaking change.
    expect(getUpdateType('1.0.0-beta.1', '1.0.0')).toBe('patch')
    expect(getUpdateType('1.0.0-beta.1', '1.0.0-beta.2')).toBe('patch')
  })

  it('success case - a prerelease of the next major is still major', () => {
    expect(getUpdateType('1.0.0', '2.0.0-rc.1')).toBe('major')
  })

  it('success case - suffixed docker tags classify by their numeric core', () => {
    expect(getUpdateType('3.19-alpine', '3.20-alpine')).toBe('minor')
    expect(getUpdateType('3.19-alpine', '4.0-alpine')).toBe('major')
  })

  it('edge case - non-semver input degrades to patch, never a fabricated major', () => {
    expect(getUpdateType('latest', '1.0.0')).toBe('patch')
    expect(getUpdateType('workspace:*', '1.0.0')).toBe('patch')
    expect(getUpdateType('main', '1.0.0')).toBe('patch')
  })

  it('success case - VersionResolver answers identically', () => {
    const cases: Array<[string, string]> = [
      ['v4', 'v4.2.2'],
      ['v1.0.0', 'v2.0.0'],
      ['1.0.0-beta.1', '1.0.0'],
      ['latest', '1.0.0'],
      ['1.2.3', '1.3.0'],
    ]

    for (const [from, to] of cases)
      expect(VersionResolver.getUpdateType(from, to)).toBe(getUpdateType(from, to))
  })
})
