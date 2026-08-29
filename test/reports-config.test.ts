import { describe, expect, it } from 'bun:test'
import { shouldPublishReport } from '../src/reports/publish-gate'
import { generateUnifiedWorkflow } from '../src/setup'

/**
 * `reports.enabled` was documented as the opt-in for scheduled reports and
 * defaulted to `false`, and nothing read it — the generated workflow published
 * every week regardless. `reports.period` was documented, defaulted and never
 * consulted; only the `--period` flag was.
 */
describe('publishing a scheduled report', () => {
  it('failure case - the scheduled run does not publish by default', () => {
    // The documented default, enforced for the first time.
    const gate = shouldPublishReport({ scheduled: true, enabled: undefined })

    expect(gate.publish).toBe(false)
    expect(gate.reason).toContain('opt-in')
  })

  it('failure case - the scheduled run honours an explicit false', () => {
    expect(shouldPublishReport({ scheduled: true, enabled: false }).publish).toBe(false)
  })

  it('success case - the scheduled run publishes once enabled', () => {
    expect(shouldPublishReport({ scheduled: true, enabled: true })).toEqual({ publish: true })
  })

  it('success case - a person at a terminal is not second-guessed', () => {
    // `--publish` typed by hand is a decision already made; the setting exists
    // to govern the run nobody typed.
    expect(shouldPublishReport({ scheduled: false, enabled: false }).publish).toBe(true)
    expect(shouldPublishReport({ scheduled: false, enabled: undefined }).publish).toBe(true)
  })
})

describe('the generated report job', () => {
  it('success case - marks its run as scheduled', () => {
    // Without this the command cannot tell the cron from a person, and the
    // opt-in has nothing to bite on.
    const yaml = generateUnifiedWorkflow(false)

    expect(yaml).toContain('buddy report --publish --scheduled')
  })
})
