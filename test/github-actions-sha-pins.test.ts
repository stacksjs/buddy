import type { BuddyConfig, PackageFile } from '../src/types'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { Buddy } from '../src/buddy'
import { parseGitHubActionsFile, updateGitHubActionsFile } from '../src/utils/github-actions-parser'

/**
 * A SHA-pinned action (`uses: owner/repo@<sha> # v1.2.3`) is the immutable way
 * to pin, and its version lives in the comment. Comparing the SHA itself
 * against the latest tag never matched, so every run proposed an "update" to
 * the version already pinned, and applying it would have replaced the SHA with
 * a mutable tag. On stacksjs/stacks that update needed a workflow-scoped token
 * and failed the whole run.
 */

const OLD_SHA = 'a'.repeat(40)
const NEW_SHA = 'b'.repeat(40)
const WORKFLOW = '.github/workflows/ci.yml'

const config: BuddyConfig = {
  verbose: false,
  packages: { strategy: 'all' },
  repository: { provider: 'github', owner: 'acme', name: 'app', token: 'test-token' },
}

function workflow(ref: string): string {
  return `jobs:\n  test:\n    steps:\n      - name: Setup\n        uses: pantry-pm/pantry/packages/action@${ref}\n`
}

async function parsed(ref: string): Promise<PackageFile> {
  const file = await parseGitHubActionsFile(WORKFLOW, workflow(ref))
  return file!
}

describe('SHA-pinned GitHub Actions', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spyOn(console, 'log').mockImplementation(() => {})
    spyOn(console, 'info').mockImplementation(() => {})
    spyOn(console, 'warn').mockImplementation(() => {})
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.endsWith('/releases/latest'))
        return new Response(JSON.stringify({ tag_name: 'v0.11.65' }), { status: 200 })
      if (url.endsWith('/commits/v0.11.65'))
        return new Response(JSON.stringify({ sha: NEW_SHA }), { status: 200 })
      return new Response('not found', { status: 404 })
    }) as typeof fetch)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('reads the version from the pin comment', async () => {
    const file = await parsed(`${OLD_SHA} # v0.11.64`)
    expect(file.dependencies[0]).toMatchObject({
      name: 'pantry-pm/pantry/packages/action',
      currentVersion: OLD_SHA,
      metadata: { pinnedSha: OLD_SHA, pinnedVersion: 'v0.11.64' },
    })
  })

  it('proposes nothing when the pin already names the latest release', async () => {
    const buddy = new Buddy(config)
    const updates = await (buddy as any).checkGitHubActionsForUpdates([await parsed(`${OLD_SHA} # v0.11.65`)])
    expect(updates).toEqual([])
  })

  it('moves an outdated pin to the new release commit, keeping it a SHA', async () => {
    const buddy = new Buddy(config)
    const updates = await (buddy as any).checkGitHubActionsForUpdates([await parsed(`${OLD_SHA} # v0.11.64`)])

    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ currentVersion: OLD_SHA, newVersion: 'v0.11.65', resolved: { sha: NEW_SHA }, updateType: 'patch' })

    const rewritten = await updateGitHubActionsFile(WORKFLOW, workflow(`${OLD_SHA} # v0.11.64`), updates)
    expect(rewritten).toContain(`uses: pantry-pm/pantry/packages/action@${NEW_SHA} # v0.11.65`)
    expect(rewritten).not.toContain('@v0.11.65')
  })

  it('leaves a pin without a version comment alone rather than guessing', async () => {
    const buddy = new Buddy(config)
    const updates = await (buddy as any).checkGitHubActionsForUpdates([await parsed(OLD_SHA)])
    expect(updates).toEqual([])
  })

  it('leaves the pin alone when the release cannot be resolved to a commit', async () => {
    fetchSpy.mockImplementation((async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.endsWith('/releases/latest'))
        return new Response(JSON.stringify({ tag_name: 'v0.11.65' }), { status: 200 })
      return new Response('not found', { status: 404 })
    }) as typeof fetch)

    const buddy = new Buddy(config)
    const updates = await (buddy as any).checkGitHubActionsForUpdates([await parsed(`${OLD_SHA} # v0.11.64`)])
    expect(updates).toEqual([])
  })
})
