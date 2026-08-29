/**
 * Whether a report run should publish.
 *
 * `reports.enabled` was documented as the opt-in for scheduled reports and
 * defaulted to `false`, and nothing read it — the generated workflow published
 * every week regardless. A person at a terminal typing `--publish` has already
 * decided; the setting exists to govern the run nobody typed.
 *
 * @param options - Whether this is the scheduled run, and what config says
 * @returns Whether to publish, and why not when not
 * @example
 * ```ts
 * shouldPublishReport({ scheduled: true, enabled: undefined })
 * // { publish: false, reason: 'reports.enabled is not set' }
 * ```
 */
export function shouldPublishReport(options: {
  /** The run came from the generated workflow's schedule, not a person */
  scheduled: boolean
  /** `reports.enabled` from config */
  enabled: boolean | undefined
}): { publish: boolean, reason?: string } {
  if (!options.scheduled)
    return { publish: true }

  if (options.enabled === true)
    return { publish: true }

  return {
    publish: false,
    reason: options.enabled === false
      ? 'reports.enabled is false'
      : 'reports.enabled is not set — scheduled reports are opt-in',
  }
}
