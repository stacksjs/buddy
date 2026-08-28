import type { BuddyConfig, PackageUpdate, PRManifest, PRManifestUpdate } from '../types'
import { groupsToRules, resolveRuleEffects } from '../rules/engine'
import { parseManifest } from './pr-manifest'

/** Branch prefix every buddy pull request is opened from. */
const BUDDY_BRANCH_PREFIX = 'buddy/'

/** Label that suppresses auto-merge on an individual PR. */
export const DEFAULT_OPT_OUT_LABEL = 'no-auto-merge'

/**
 * Conditions that restrict which updates may merge without review.
 *
 * `all` is deliberately explicit: an empty condition list is treated as
 * "nothing qualifies" rather than "everything qualifies", so a half-written
 * config cannot start merging major upgrades.
 */
export type AutoMergeCondition = 'patch-only' | 'minor-only' | 'security-only' | 'all'

/** Why a pull request was or was not eligible for auto-merge. */
export interface AutoMergeDecision {
  /** Whether the PR qualifies */
  eligible: boolean
  /** Human-readable explanation, always populated */
  reason: string
}

/** The subset of a pull request auto-merge needs to make a decision. */
export interface AutoMergeCandidate {
  number: number
  title: string
  body: string
  head: string
  author?: string
  labels?: string[]
  draft?: boolean
}

/**
 * Resolved auto-merge settings, with defaults applied.
 *
 * @param config - Full buddy configuration
 */
export function resolveAutoMergeConfig(config: BuddyConfig): {
  enabled: boolean
  strategy: 'merge' | 'squash' | 'rebase'
  conditions: AutoMergeCondition[]
  requireGreenCI: boolean
  optOutLabel: string
  securityLabel: string
} {
  const autoMerge = config.pullRequest?.autoMerge
  return {
    enabled: autoMerge?.enabled ?? false,
    strategy: autoMerge?.strategy ?? 'squash',
    conditions: (autoMerge?.conditions ?? []) as AutoMergeCondition[],
    requireGreenCI: autoMerge?.requireGreenCI ?? true,
    optOutLabel: autoMerge?.optOutLabel ?? DEFAULT_OPT_OUT_LABEL,
    securityLabel: config.security?.label ?? 'security',
  }
}

/**
 * Decides whether a pull request may be auto-merged.
 *
 * Reads the update types from the embedded metadata manifest rather than the
 * PR title, so a retitled or reworded PR cannot be talked into a merge it does
 * not qualify for. A PR whose manifest is missing or truncated is never
 * eligible: without the complete update list there is no way to prove every
 * update satisfies the configured conditions.
 *
 * CI state is checked separately by the caller and passed in, because the two
 * entry points differ — PR creation has no checks yet, while `update-check`
 * polls a PR whose checks have had time to run.
 *
 * @param pr - The pull request under consideration
 * @param config - Full buddy configuration
 * @param ciGreen - Whether required checks have passed, or `undefined` when not yet known
 * @returns The decision and the reason behind it
 * @example
 * ```ts
 * const decision = evaluateAutoMerge(pr, config, true)
 * if (decision.eligible)
 *   await provider.mergePullRequest(pr.number, strategy)
 * ```
 */
export function evaluateAutoMerge(
  pr: AutoMergeCandidate,
  config: BuddyConfig,
  ciGreen?: boolean,
): AutoMergeDecision {
  const settings = resolveAutoMergeConfig(config)

  if (!settings.enabled)
    return { eligible: false, reason: 'auto-merge is disabled by config' }

  if (settings.conditions.length === 0)
    return { eligible: false, reason: 'no auto-merge conditions configured (set conditions to at least one of patch-only, minor-only, security-only, all)' }

  if (!pr.head.startsWith(BUDDY_BRANCH_PREFIX))
    return { eligible: false, reason: `PR #${pr.number} is not a buddy PR (branch: ${pr.head})` }

  if (pr.draft)
    return { eligible: false, reason: `PR #${pr.number} is a draft` }

  const labels = pr.labels ?? []
  if (labels.includes(settings.optOutLabel))
    return { eligible: false, reason: `PR #${pr.number} carries the ${settings.optOutLabel} label` }

  if (settings.requireGreenCI && ciGreen === false)
    return { eligible: false, reason: `PR #${pr.number} has failing or pending checks` }

  const manifest = parseManifest(pr.body)
  if (!manifest)
    return { eligible: false, reason: `PR #${pr.number} has no metadata manifest to verify update types against` }

  if (manifest.truncated)
    return { eligible: false, reason: `PR #${pr.number} has a truncated manifest, so its full update set cannot be verified` }

  // A rule that names auto-merge explicitly settles it in either direction;
  // the global conditions are the default for everything it does not cover.
  const ruled = evaluateRuleAutoMerge(manifest, config)
  if (ruled)
    return ruled

  return evaluateConditions(manifest, labels, settings)
}

/**
 * Whether a package rule decides auto-merge for this pull request.
 *
 * `autoMerge` on a rule was resolved into `ResolvedEffects` and merged by
 * `mergeGroupEffects`, and nothing ever read either — so a rule saying "these
 * are safe to merge without review" did nothing, and one saying the opposite
 * did nothing either.
 *
 * The all-or-nothing reading is `mergeGroupEffects`'s, not a new invention: a
 * group qualifies only when every update in it is covered. One package no rule
 * has vouched for sends the whole pull request back to the global conditions.
 *
 * @param manifest - The pull request's embedded update manifest
 * @param config - Configuration supplying the rules
 * @returns A decision when a rule settles it, `null` to fall through
 */
function evaluateRuleAutoMerge(manifest: PRManifest, config: BuddyConfig): AutoMergeDecision | null {
  const rules = [...groupsToRules(config.packages?.groups), ...(config.packages?.rules ?? [])]
  if (rules.length === 0 || manifest.updates.length === 0)
    return null

  // A manifest sheds `type` and `dependencyType` before it sheds rows, and
  // does not mark itself truncated when it does. Rules match on both, so
  // evaluating one against a manifest missing them would decide on data that
  // is not there — fall through to the conditions instead.
  const complete = manifest.updates.every(update => update.type && update.dependencyType)
  if (!complete)
    return null

  const effects = manifest.updates.map(update => resolveRuleEffects(toPackageUpdate(update), rules))

  if (effects.some(effect => effect.autoMerge === false))
    return { eligible: false, reason: 'a package rule holds one of these updates back from auto-merge' }

  if (effects.every(effect => effect.autoMerge === true))
    return { eligible: true, reason: 'every update is covered by a package rule that enables auto-merge' }

  return null
}

/**
 * Rebuild the update a manifest row describes, for rule matching.
 *
 * Only the fields `ruleMatches` reads are reconstructed; the manifest carries
 * nothing else and nothing here needs more.
 *
 * @param row - A manifest row
 */
function toPackageUpdate(row: PRManifestUpdate): PackageUpdate {
  return {
    name: row.name,
    currentVersion: row.current,
    newVersion: row.target,
    updateType: row.type,
    file: row.file,
    dependencyType: row.dependencyType,
  } as PackageUpdate
}

function evaluateConditions(
  manifest: PRManifest,
  labels: string[],
  settings: { conditions: AutoMergeCondition[], securityLabel: string },
): AutoMergeDecision {
  // A PR qualifies when any configured condition accepts it.
  for (const condition of settings.conditions) {
    switch (condition) {
      case 'all':
        return { eligible: true, reason: 'all updates qualify (condition: all)' }

      case 'patch-only':
        if (manifest.updates.length > 0 && manifest.updates.every(update => updateTypeOf(update) === 'patch'))
          return { eligible: true, reason: 'every update is a patch' }
        break

      case 'minor-only':
        if (manifest.updates.length > 0 && manifest.updates.every(update => updateTypeOf(update) !== 'major'))
          return { eligible: true, reason: 'every update is minor or patch' }
        break

      case 'security-only':
        if (labels.includes(settings.securityLabel))
          return { eligible: true, reason: 'PR resolves a security advisory' }
        break
    }
  }

  const types = [...new Set(manifest.updates.map(updateTypeOf))].join(', ') || 'none'
  return {
    eligible: false,
    reason: `update types (${types}) do not satisfy conditions (${settings.conditions.join(', ')})`,
  }
}

/**
 * Semver bucket for a manifest entry.
 *
 * Size-reduced manifests omit `type`, so it is recomputed from the version
 * pair when absent. An unparseable pair is treated as `major` — the
 * conservative reading, since an unknown change must never auto-merge under a
 * patch-only policy.
 */
function updateTypeOf(update: { type?: string, current: string, target: string }): 'major' | 'minor' | 'patch' {
  if (update.type === 'major' || update.type === 'minor' || update.type === 'patch')
    return update.type

  const current = parseVersion(update.current)
  const target = parseVersion(update.target)
  if (!current || !target)
    return 'major'

  if (current[0] !== target[0])
    return 'major'
  if (current[1] !== target[1])
    return 'minor'
  return 'patch'
}

function parseVersion(version: string): [number, number, number] | null {
  const match = version.trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match)
    return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Decides auto-merge eligibility for a set of updates before a PR exists.
 *
 * Used at creation time, where the manifest has not been written yet but the
 * updates are already known.
 *
 * @param updates - Updates the PR will contain
 * @param labels - Labels the PR will be created with
 * @param config - Full buddy configuration
 */
export function evaluateAutoMergeForUpdates(
  updates: PackageUpdate[],
  labels: string[],
  config: BuddyConfig,
): AutoMergeDecision {
  const settings = resolveAutoMergeConfig(config)

  if (!settings.enabled)
    return { eligible: false, reason: 'auto-merge is disabled by config' }

  if (settings.conditions.length === 0)
    return { eligible: false, reason: 'no auto-merge conditions configured' }

  if (labels.includes(settings.optOutLabel))
    return { eligible: false, reason: `PR carries the ${settings.optOutLabel} label` }

  const manifest: PRManifest = {
    schemaVersion: 1,
    updates: updates.map(update => ({
      name: update.name,
      current: update.currentVersion,
      target: update.newVersion,
      type: update.updateType,
      file: update.file,
      dependencyType: update.dependencyType,
    })),
  }

  const ruled = evaluateRuleAutoMerge(manifest, config)
  if (ruled)
    return ruled

  return evaluateConditions(manifest, labels, settings)
}
