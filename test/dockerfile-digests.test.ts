import type { PackageUpdate } from '../src/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { parseDockerfile, updateDockerfile } from '../src/utils/dockerfile-parser'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

const DIGEST = 'sha256:aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888'
const NEW_DIGEST = 'sha256:9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa'

function update(overrides: Partial<PackageUpdate> = {}): PackageUpdate {
  return {
    name: 'node',
    currentVersion: '20',
    newVersion: '22',
    updateType: 'major',
    dependencyType: 'docker-image',
    file: 'Dockerfile',
    ...overrides,
  } as PackageUpdate
}

/** Answer every registry request with a manifest carrying this digest. */
function registryReturning(digest: string | null): void {
  globalThis.fetch = (async (input: string) => {
    if (digest === null)
      return new Response('not found', { status: 404 })

    if (String(input).includes('/token') || String(input).includes('auth'))
      return new Response(JSON.stringify({ token: 't' }), { status: 200 })

    return new Response(JSON.stringify({ schemaVersion: 2 }), {
      status: 200,
      headers: { 'docker-content-digest': digest, 'content-type': 'application/vnd.oci.image.manifest.v1+json' },
    })
  }) as unknown as typeof fetch
}

/**
 * `resolveDockerDigest` was written — with a docstring explaining that moving
 * a tag without moving its digest "would leave the old image running while the
 * file claims otherwise" — and never called. Two things followed from that.
 */
describe('digest-pinned base images', () => {
  describe('parsing', () => {
    it('success case - a pinned reference names the image, not the digest', async () => {
      // `node:20@sha256:abc` was split on the *last* colon, giving the image
      // `node:20@sha256` at version `abc`. That is not an image, is never
      // found in any registry, and appears on the dashboard as though real.
      const parsed = await parseDockerfile('Dockerfile', `FROM node:20@${DIGEST}\n`)

      expect(parsed?.dependencies).toEqual([
        { name: 'node', currentVersion: '20', type: 'docker-image', file: 'Dockerfile' },
      ])
    })

    it('success case - an unpinned reference is unchanged', async () => {
      const parsed = await parseDockerfile('Dockerfile', 'FROM alpine:3.19\n')

      expect(parsed?.dependencies[0]).toMatchObject({ name: 'alpine', currentVersion: '3.19' })
    })

    it('edge case - a registry with a port still parses', async () => {
      const parsed = await parseDockerfile('Dockerfile', `FROM registry.io:5000/team/app:2.1@${DIGEST}\n`)

      expect(parsed?.dependencies[0]).toMatchObject({
        name: 'registry.io:5000/team/app',
        currentVersion: '2.1',
      })
    })

    it('edge case - a bare digest reference is still skipped', async () => {
      const parsed = await parseDockerfile('Dockerfile', `FROM node@${DIGEST}\n`)

      expect(parsed?.dependencies).toEqual([])
    })
  })

  describe('updating', () => {
    it('failure case - the pin is never silently dropped', async () => {
      // The regression: `FROM node:20@sha256:…` became `FROM node:22`, which
      // unpins an image somebody pinned on purpose.
      registryReturning(NEW_DIGEST)

      const result = await updateDockerfile('Dockerfile', `FROM node:20@${DIGEST}\n`, [update()])

      expect(result).not.toBe(`FROM node:22\n`)
      expect(result).toContain('@sha256:')
    })

    it('success case - the digest moves with the tag', async () => {
      registryReturning(NEW_DIGEST)

      const result = await updateDockerfile('Dockerfile', `FROM node:20@${DIGEST}\n`, [update()])

      expect(result).toBe(`FROM node:22@${NEW_DIGEST}\n`)
    })

    it('failure case - an unresolvable digest leaves the line alone', async () => {
      // Writing the new tag beside the old digest would leave the old image
      // running while the file claims otherwise — worse than not updating.
      registryReturning(null)

      const result = await updateDockerfile('Dockerfile', `FROM node:20@${DIGEST}\n`, [update()])

      expect(result).toBe(`FROM node:20@${DIGEST}\n`)
    })

    it('success case - an unpinned image needs no registry call', async () => {
      let called = false
      globalThis.fetch = (async () => {
        called = true
        return new Response('{}', { status: 200 })
      }) as unknown as typeof fetch

      const result = await updateDockerfile('Dockerfile', 'FROM node:20\n', [update()])

      expect(result).toBe('FROM node:22\n')
      expect(called).toBe(false)
    })

    it('success case - a stage alias survives the rewrite', async () => {
      registryReturning(NEW_DIGEST)

      const result = await updateDockerfile('Dockerfile', `FROM node:20@${DIGEST} as build\n`, [update()])

      expect(result).toBe(`FROM node:22@${NEW_DIGEST} as build\n`)
    })

    it('edge case - a pinned and an unpinned line update independently', async () => {
      registryReturning(NEW_DIGEST)

      const result = await updateDockerfile(
        'Dockerfile',
        `FROM node:20@${DIGEST}\nFROM node:20 as tools\n`,
        [update()],
      )

      expect(result).toContain(`FROM node:22@${NEW_DIGEST}`)
      expect(result).toContain('FROM node:22 as tools')
    })
  })
})

/**
 * Pre-existing, and found while fixing the digest handling: the trailing group
 * was `(\s.*)?$`, and `\s` matches a newline. With the `m` flag the match ran
 * past the end of its line and took every following line with it.
 */
describe('a FROM line stays on its line', () => {
  it('failure case - a repeated base image does not collapse the file', async () => {
    // A multi-stage build from the same image twice had both `FROM` lines
    // replaced by a single one, silently deleting a build stage.
    const content = 'FROM node:20 as build\nRUN bun install\nFROM node:20 as run\n'

    const result = await updateDockerfile('Dockerfile', content, [update()])

    expect(result.split('\n').filter(line => line.startsWith('FROM'))).toEqual([
      'FROM node:22 as build',
      'FROM node:22 as run',
    ])
    expect(result).toContain('RUN bun install')
  })

  it('success case - lines between two FROMs are untouched', async () => {
    const content = 'FROM node:20\nCOPY . .\nFROM alpine:3.19\n'

    const result = await updateDockerfile('Dockerfile', content, [update()])

    expect(result).toBe('FROM node:22\nCOPY . .\nFROM alpine:3.19\n')
  })
})
