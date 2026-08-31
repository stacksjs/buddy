import type { VersionRange } from '../types'
import { semver } from 'bun'
import { getUpdateType } from '../utils/helpers'

export class VersionResolver {
  /**
   * Compare two version strings using Bun's fast semver implementation
   */
  static compareVersions(version1: string, version2: string): -1 | 0 | 1 {
    return semver.order(version1, version2)
  }

  /**
   * Check if a version satisfies a range using Bun's fast semver implementation
   */
  static satisfiesRange(version: string, range: string): boolean {
    return semver.satisfies(version, range)
  }

  /**
   * Get the latest version that satisfies a range
   */
  static getLatestInRange(versions: string[], range: string): string | null {
    const satisfyingVersions = versions.filter(v => semver.satisfies(v, range))

    if (satisfyingVersions.length === 0)
      return null

    // Sort using Bun's semver.order (descending)
    return satisfyingVersions.sort((a, b) => semver.order(b, a))[0]
  }

  /**
   * Create a VersionRange object
   */
  static createRange(rangeString: string): VersionRange {
    return {
      raw: rangeString,
      range: rangeString.replace(/^[\^~>=<]+/, ''),
      isExact: !/^[\^~>=<]/.test(rangeString),
      satisfies: (version: string) => this.satisfiesRange(version, rangeString),
      getLatest: (versions: string[]) => this.getLatestInRange(versions, rangeString),
    }
  }

  /**
   * Determine update type between two versions.
   *
   * Delegates to the canonical classifier in `utils/helpers`. This class
   * used to carry its own variant, which disagreed with the live scan path
   * on exactly the awkward inputs: 'v2.0.0' read as no change (the v was
   * never stripped) and 'latest' read as a fabricated major.
   */
  static getUpdateType(fromVersion: string, toVersion: string): 'major' | 'minor' | 'patch' {
    return getUpdateType(fromVersion, toVersion)
  }

  /**
   * Check if an update is safe based on version range
   */
  static isSafeUpdate(currentRange: string, newVersion: string): boolean {
    // Use Bun's semver to check if the new version satisfies the current range
    return semver.satisfies(newVersion, currentRange)
  }
}
