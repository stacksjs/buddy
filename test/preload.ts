/**
 * Block real network access during tests.
 *
 * A test that reaches the internet is a test that fails on a plane, in a
 * sandboxed CI runner, or whenever the upstream service rate-limits — and it
 * fails as a confusing "network error" rather than as "this test forgot to
 * mock". The suite was intermittently red for exactly that reason.
 *
 * Every outbound `fetch` throws here unless the test opted in. Tests that want
 * a stub keep doing what they already do — `spyOn(globalThis, 'fetch')`
 * replaces this guard for the duration — so this only catches the calls nobody
 * meant to make.
 *
 * The error names the URL and points at the fix, because the failure otherwise
 * surfaces deep inside whatever service made the call.
 */
import { afterEach, beforeEach } from 'bun:test'

/** Set by {@link allowNetwork} for the rare test that genuinely needs the wire. */
let networkAllowed = false

const realFetch = globalThis.fetch

/**
 * Permit real network access for the current test.
 *
 * Reserved for tests explicitly marked as integration tests. Reset after every
 * test, so it cannot leak into the next one.
 */
export function allowNetwork(): void {
  networkAllowed = true
}

function guardedFetch(input: unknown, init?: unknown): Promise<Response> {
  if (networkAllowed)
    return realFetch(input as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1])

  const url = typeof input === 'string'
    ? input
    : (input as { url?: string })?.url ?? String(input)

  throw new Error(
    `Blocked network request to ${url}\n`
    + '  A test reached the internet. Stub it instead:\n'
    + "    spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'))\n"
    + '  For a Buddy scan, the usual cause is the OSV advisory lookup — set\n'
    + '  `security: { enabled: false }` in the test config unless the test is about security.\n'
    + '  If the test genuinely needs the network, call allowNetwork() from test/preload.',
  )
}

globalThis.fetch = guardedFetch as unknown as typeof fetch

// Restore the guard between tests. A test that installs its own spy and never
// restores it would otherwise leave the next test unprotected, which is how
// this class of failure stays intermittent and hard to attribute.
beforeEach(() => {
  networkAllowed = false
  if (globalThis.fetch !== guardedFetch)
    globalThis.fetch = guardedFetch as unknown as typeof fetch
})

afterEach(() => {
  networkAllowed = false
})
