import { describe, expect, it } from 'bun:test'
import { classifyFailure, describeFailure, extractErrorLines } from '../src/ci/classify'
import { attemptFix } from '../src/ci/fix'

const LOCKFILE_LOG = `
$ bun install --frozen-lockfile
bun install v1.2.19
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile
`

const FLAKE_LOG = `
$ bun install
error: request to https://registry.npmjs.org/react failed, reason: ECONNRESET
`

const TYPE_ERROR_LOG = `
$ bunx tsc --noEmit
src/app.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.
`

const TEST_LOG = `
$ bun test
(fail) auth > rejects an expired token
 1 fail
`

describe('failure classification', () => {
  it('success case - recognises lock file drift as mechanically fixable', () => {
    const failure = classifyFailure(LOCKFILE_LOG)

    expect(failure.kind).toBe('lockfile-drift')
    expect(failure.mechanical).toBe(true)
  })

  it('success case - recognises a network flake as retryable', () => {
    const failure = classifyFailure(FLAKE_LOG)

    expect(failure.kind).toBe('flake')
    expect(failure.mechanical).toBe(true)
  })

  it('success case - recognises a type error', () => {
    expect(classifyFailure(TYPE_ERROR_LOG).kind).toBe('type-error')
  })

  it('success case - recognises a test failure', () => {
    expect(classifyFailure(TEST_LOG).kind).toBe('test-failure')
  })

  it('success case - prefers lock file drift over generic install noise', () => {
    // Misreading this as an install failure would send a one-command fix to
    // the model instead.
    const mixed = `${LOCKFILE_LOG}\ncould not resolve dependency foo`

    expect(classifyFailure(mixed).kind).toBe('lockfile-drift')
  })

  it('edge case - an unrecognised failure still carries evidence', () => {
    const failure = classifyFailure('something went wrong\nFATAL: unexplained')

    expect(failure.kind).toBe('unknown')
    expect(failure.mechanical).toBe(false)
    expect(failure.evidence.length).toBeGreaterThan(0)
  })

  it('edge case - an empty log classifies as unknown', () => {
    expect(classifyFailure('').kind).toBe('unknown')
  })

  it('success case - describes every kind in plain language', () => {
    for (const log of [LOCKFILE_LOG, FLAKE_LOG, TYPE_ERROR_LOG, TEST_LOG, ''])
      expect(describeFailure(classifyFailure(log)).length).toBeGreaterThan(10)
  })
})

describe('error line extraction', () => {
  it('success case - keeps error lines and drops stack noise', () => {
    const lines = ['setup step', 'error: it broke', '    at foo (bar.ts:1)', 'more setup']

    const extracted = extractErrorLines(lines)

    expect(extracted).toContain('error: it broke')
    expect(extracted.some(line => line.startsWith('at foo'))).toBe(false)
  })

  it('edge case - falls back to the tail when nothing looks like an error', () => {
    const lines = Array.from({ length: 100 }, (_, index) => `line ${index}`)

    const extracted = extractErrorLines(lines, 5)

    expect(extracted).toHaveLength(5)
    expect(extracted.at(-1)).toBe('line 99')
  })
})

describe('fix attempts', () => {
  const base = { workspace: '/tmp', baseBranch: 'main' }

  it('success case - fixes lock file drift without a model', async () => {
    let regenerated = false
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      regenerateLockfile: async () => {
        regenerated = true
        return { regenerated: true, pushed: true }
      },
    })

    // No AI configured, and none needed.
    expect(regenerated).toBe(true)
    expect(outcome.action).toBe('mechanical-fix')
    expect(outcome.fixed).toBe(true)
  })

  it('success case - recommends a retry for a flake', async () => {
    const outcome = await attemptFix({ ...base, log: FLAKE_LOG })

    expect(outcome.action).toBe('retry')
    expect(outcome.report).toContain('transient')
  })

  it('failure case - refuses when the failure exists on the base branch', async () => {
    // Patching here would attribute someone else's breakage to this change.
    let regenerated = false
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      failsOnBase: true,
      regenerateLockfile: async () => {
        regenerated = true
        return { regenerated: true, pushed: true }
      },
    })

    expect(regenerated).toBe(false)
    expect(outcome.action).toBe('skipped')
    expect(outcome.report).toContain('base branch')
  })

  it('failure case - stops after the attempt cap rather than looping', async () => {
    const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG, priorAttempts: 3, maxAttempts: 3 })

    expect(outcome.action).toBe('skipped')
    expect(outcome.report).toContain('stopping')
  })

  it('success case - reports usefully when no AI is configured', async () => {
    const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG })

    expect(outcome.action).toBe('reported')
    expect(outcome.fixed).toBe(false)
    // An unfixable failure still gets an actionable comment, not silence.
    expect(outcome.report).toContain('does not type-check')
  })

  it('success case - includes log evidence in the report', async () => {
    const outcome = await attemptFix({ ...base, log: TYPE_ERROR_LOG })

    expect(outcome.report).toContain('error TS2322')
  })
})

describe('the lock-file repair reports what it actually did', () => {
  const base = { workspace: '/tmp', baseBranch: 'main' }

  it('failure case - a regenerated file that was not pushed is not a fix', async () => {
    // The report claimed "and pushed the result" long before anything pushed
    // anything. A file rewritten in a workspace about to be discarded has
    // repaired nothing, so the run is still red.
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      regenerateLockfile: async () => ({ regenerated: true, pushed: false }),
    })

    expect(outcome.fixed).toBe(false)
    expect(outcome.report).toContain('could not push')
    expect(outcome.report).not.toContain('pushed the result')
  })

  it('success case - a pushed file is a fix, and says so', async () => {
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      regenerateLockfile: async () => ({ regenerated: true, pushed: true }),
    })

    expect(outcome.fixed).toBe(true)
    expect(outcome.report).toContain('pushed the result')
  })

  it('failure case - a failed install is reported as such', async () => {
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      regenerateLockfile: async () => ({ regenerated: false, pushed: false }),
    })

    expect(outcome.fixed).toBe(false)
    expect(outcome.report).toContain('did not succeed')
  })

  it('success case - a dry run diagnoses without touching the workspace', async () => {
    // `--dry-run` used to regenerate lock files on disk regardless, because
    // the callback was passed unconditionally and never consulted the flag.
    let called = false
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      dryRun: true,
      regenerateLockfile: async () => {
        called = true
        return { regenerated: true, pushed: true }
      },
    })

    expect(called).toBe(false)
    expect(outcome.fixed).toBe(false)
    expect(outcome.report).toContain('dry run')
  })
})

/**
 * The flake branch reported that "re-running the failed job is likely to clear
 * it" and then re-ran nothing, because no provider could be asked to. It can
 * be now, so the branch does what its own report claims.
 */
describe('retrying a flake', () => {
  const base = { workspace: '/tmp', baseBranch: 'main' }

  it('success case - re-runs the failed jobs', async () => {
    let rerun = false
    const outcome = await attemptFix({
      ...base,
      log: FLAKE_LOG,
      rerun: async () => {
        rerun = true
        return true
      },
    })

    expect(rerun).toBe(true)
    expect(outcome.action).toBe('retry')
    expect(outcome.report).toContain('re-ran the failed jobs')
  })

  it('success case - a re-run is not reported as a repair', async () => {
    // The jobs were asked to run again and may still fail. Reporting that as
    // fixed would be a guess dressed up as a result.
    const outcome = await attemptFix({ ...base, log: FLAKE_LOG, rerun: async () => true })

    expect(outcome.fixed).toBe(false)
  })

  it('failure case - a refused re-run says so and points at the Actions tab', async () => {
    const outcome = await attemptFix({ ...base, log: FLAKE_LOG, rerun: async () => false })

    expect(outcome.action).toBe('retry')
    expect(outcome.report).toContain('could not re-run')
    expect(outcome.report).toContain('Actions tab')
  })

  it('success case - a dry run re-runs nothing', async () => {
    let rerun = false
    const outcome = await attemptFix({
      ...base,
      log: FLAKE_LOG,
      dryRun: true,
      rerun: async () => {
        rerun = true
        return true
      },
    })

    expect(rerun).toBe(false)
    expect(outcome.report).toContain('dry run')
  })

  it('edge case - a provider that cannot re-run still gets the diagnosis', async () => {
    const outcome = await attemptFix({ ...base, log: FLAKE_LOG })

    expect(outcome.action).toBe('retry')
    expect(outcome.report).toContain('transient')
  })
})

/**
 * `failsOnBase` could only ever be answered by a caller that already knew.
 * `checkBase` lets one work it out, which is what makes the guard reachable.
 */
describe('asking whether the base branch already fails', () => {
  const base = { workspace: '/tmp', baseBranch: 'main' }

  it('success case - the hook is asked with the classification', async () => {
    // The comparison is per-kind, so the hook cannot be called before the
    // failure at hand has been classified.
    let asked: string | undefined
    await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      checkBase: async (kind) => {
        asked = kind
        return false
      },
      regenerateLockfile: async () => ({ regenerated: true, pushed: true }),
    })

    expect(asked).toBe('lockfile-drift')
  })

  it('success case - an inherited failure is declined before any repair', async () => {
    let regenerated = false
    const outcome = await attemptFix({
      ...base,
      log: LOCKFILE_LOG,
      checkBase: async () => true,
      regenerateLockfile: async () => {
        regenerated = true
        return { regenerated: true, pushed: true }
      },
    })

    expect(regenerated).toBe(false)
    expect(outcome.action).toBe('skipped')
    expect(outcome.report).toContain('base branch')
  })

  it('success case - an explicit answer skips the lookup', async () => {
    // A caller that already knows should not pay for the API calls.
    let asked = false
    await attemptFix({
      ...base,
      log: TYPE_ERROR_LOG,
      failsOnBase: false,
      checkBase: async () => {
        asked = true
        return true
      },
    })

    expect(asked).toBe(false)
  })

  it('edge case - no hook at all leaves the guard closed', async () => {
    const outcome = await attemptFix({ ...base, log: FLAKE_LOG })

    expect(outcome.action).not.toBe('skipped')
  })
})
