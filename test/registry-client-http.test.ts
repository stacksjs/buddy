import type { BuddyConfig, PackageMetadata } from '../src/types'
import type { Logger } from '../src/utils/logger'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { RegistryClient } from '../src/registry/registry-client'
import { PackageRegistryError } from '../src/types'

function stubFetch(impl: (input?: unknown, init?: unknown) => Promise<Response>) {
  return spyOn(globalThis, 'fetch').mockImplementation(impl as unknown as typeof fetch)
}

/**
 * Tests for the real HTTP and subprocess paths of RegistryClient.
 *
 * Every network call is served by a `spyOn(globalThis, 'fetch')` stub (the
 * preload guard throws on anything unstubbed), and `runCommand` is spied per
 * instance so no test but the dedicated runCommand suite spawns a process.
 */

const NPM_REGISTRY = 'https://registry.example.test'
const COMPOSER_REGISTRY = 'https://packagist.example.test'
const GITHUB_API = 'https://ghe.example.test/api/v3'

/** Env vars that would otherwise leak real endpoints or tokens into tests. */
const ENV_VARS = [
  'BUDDY_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_API_URL',
  'NPM_CONFIG_REGISTRY',
  'COMPOSER_REGISTRY_URL',
] as const

function makeLogger(): Logger {
  return {
    info: mock(),
    warn: mock(),
    error: mock(),
    success: mock(),
    debug: mock(),
  } as unknown as Logger
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function baseConfig(overrides: Partial<BuddyConfig> = {}): BuddyConfig {
  return {
    registries: { npm: NPM_REGISTRY, composer: COMPOSER_REGISTRY },
    ...overrides,
  }
}

describe('RegistryClient HTTP behavior', () => {
  let testDir: string
  let mockLogger: Logger
  let fetchSpy: any
  let savedEnv: Record<string, string | undefined>

  function makeClient(config: BuddyConfig | undefined = baseConfig(), logger: Logger = mockLogger): RegistryClient {
    return new RegistryClient(testDir, logger, config)
  }

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-test-'))
    mockLogger = makeLogger()

    savedEnv = {}
    for (const key of ENV_VARS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    fetchSpy?.mockRestore?.()
    fetchSpy = undefined

    for (const key of ENV_VARS) {
      if (savedEnv[key] === undefined)
        delete process.env[key]
      else
        process.env[key] = savedEnv[key]
    }

    if (fs.existsSync(testDir))
      fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('getPackageMetadata', () => {
    it('maps a full packument into PackageMetadata, unwrapping repository/license/author objects', async () => {
      const packument = {
        'name': 'demo-pkg',
        'dist-tags': { latest: '2.0.0' },
        'versions': {
          '1.0.0': {},
          '2.0.0': {
            name: 'demo-pkg',
            description: 'Latest description',
            homepage: 'https://demo.example.test',
            repository: { url: 'git+https://github.com/demo/demo-pkg.git' },
            license: { type: 'MIT' },
            author: { name: 'Demo Author' },
            keywords: ['demo'],
            dependencies: { dep: '^1.0.0' },
            devDependencies: { devdep: '^2.0.0' },
            peerDependencies: { peerdep: '^3.0.0' },
          },
        },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      const client = makeClient()
      const metadata = await client.getPackageMetadata('demo-pkg')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(String(fetchSpy.mock.calls[0][0])).toBe(`${NPM_REGISTRY}/demo-pkg`)

      expect(metadata).toBeDefined()
      expect(metadata!.name).toBe('demo-pkg')
      expect(metadata!.description).toBe('Latest description')
      expect(metadata!.repository).toBe('git+https://github.com/demo/demo-pkg.git')
      expect(metadata!.homepage).toBe('https://demo.example.test')
      expect(metadata!.license).toBe('MIT')
      expect(metadata!.author).toBe('Demo Author')
      expect(metadata!.keywords).toEqual(['demo'])
      expect(metadata!.latestVersion).toBe('2.0.0')
      expect(metadata!.versions).toEqual(['1.0.0', '2.0.0'])
      expect(metadata!.dependencies).toEqual({ dep: '^1.0.0' })
      expect(metadata!.devDependencies).toEqual({ devdep: '^2.0.0' })
      expect(metadata!.peerDependencies).toEqual({ peerdep: '^3.0.0' })
    })

    it('falls back to packument-root fields and last version key when dist-tags and the latest manifest are missing', async () => {
      const packument = {
        description: 'Root description',
        homepage: 'https://root.example.test',
        versions: { '1.0.0': {}, '1.1.0': {} },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      const metadata = await makeClient().getPackageMetadata('rooty-pkg')

      expect(metadata).toBeDefined()
      expect(metadata!.latestVersion).toBe('1.1.0')
      expect(metadata!.description).toBe('Root description')
      expect(metadata!.homepage).toBe('https://root.example.test')
    })

    it('refuses shell-unsafe package names before any network call', async () => {
      fetchSpy = stubFetch(async () => {
        throw new Error('unexpected network call')
      })

      const client = makeClient()

      const metadata = await client.getPackageMetadata('foo; rm -rf /')
      expect(metadata).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get metadata for foo; rm -rf /:',
        expect.any(PackageRegistryError),
      )

      const exists = await client.packageExists('--cwd=/tmp')
      expect(exists).toBe(false)

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('packument caching and error handling', () => {
    it('memoizes the packument across metadata, latest-version and release-date lookups; clearCache forces a refetch', async () => {
      const packument = {
        'name': 'cached-pkg',
        'dist-tags': { latest: '1.0.0' },
        'versions': { '1.0.0': {} },
        'time': { '1.0.0': '2024-01-05T00:00:00.000Z' },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      const client = makeClient()
      await client.getPackageMetadata('cached-pkg')
      await client.getLatestVersion('cached-pkg')
      const releaseDate = await client.getPackageVersionReleaseDate('cached-pkg', '1.0.0')

      expect(releaseDate?.toISOString()).toBe('2024-01-05T00:00:00.000Z')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      client.clearCache()
      await client.getLatestVersion('cached-pkg')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('treats 404 as an ordinary miss with a debug log, and caches the null result', async () => {
      fetchSpy = stubFetch(async () => new Response('not found', { status: 404 }))

      const client = makeClient()
      expect(await client.packageExists('missing-pkg')).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith('No registry data for missing-pkg: HTTP 404')
      expect(mockLogger.warn).not.toHaveBeenCalled()

      // The failure is cached as null, so a second ask costs no request.
      expect(await client.packageExists('missing-pkg')).toBe(false)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('warns on non-404 HTTP errors', async () => {
      // 403 without rate-limit headers is non-transient, so no retries occur.
      fetchSpy = stubFetch(async () => new Response('forbidden', { status: 403 }))

      const client = makeClient()
      expect(await client.packageExists('gone-pkg')).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('No registry data for gone-pkg: HTTP 403')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLatestVersion', () => {
    it('prefers the latest dist-tag and honours includePrerelease', async () => {
      const packument = {
        'dist-tags': { latest: '2.0.0-beta.1' },
        'versions': { '1.0.0': {}, '1.1.0': {}, '2.0.0-beta.1': {} },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      // Default config: the prerelease dist-tag is skipped, highest stable wins.
      const stableClient = makeClient()
      expect(await stableClient.getLatestVersion('pre-pkg')).toBe('1.1.0')

      // Fresh client (fresh cache) with prereleases allowed: dist-tag wins.
      const preClient = makeClient(baseConfig({
        packages: { strategy: 'all', includePrerelease: true },
      }))
      expect(await preClient.getLatestVersion('pre-pkg')).toBe('2.0.0-beta.1')
    })

    it('yields null when only prereleases exist and prereleases are excluded', async () => {
      const packument = {
        versions: { '1.0.0-beta.1': {}, '1.0.0-rc.1': {} },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      expect(await makeClient().getLatestVersion('only-pre-pkg')).toBeNull()
    })
  })

  describe('runBunOutdated', () => {
    it('parses object-keyed bun outdated --json output with nested {version} fields', async () => {
      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand').mockResolvedValueOnce(JSON.stringify({
        'react': { current: { version: '18.0.0 ' }, latest: '18.2.0', workspace: 'apps/web' },
        'half-formed': { current: '1.0.0' },
      }))

      const results = await (client as any).runBunOutdated()

      expect(runCommandSpy).toHaveBeenCalledWith('bun', ['outdated', '--json'])
      expect(results).toEqual([
        {
          name: 'react',
          current: '18.0.0',
          update: '18.2.0',
          latest: '18.2.0',
          workspace: 'apps/web',
        },
      ])
    })

    it('falls back to table parsing when --json output is not JSON, stripping ANSI codes and (dev) suffixes', async () => {
      const esc = String.fromCharCode(27)
      const table = [
        '│ Package │ Current │ Update │ Latest │ Workspace │',
        '├─────────┼─────────┼────────┼────────┼───────────┤',
        `│ ${esc}[31mtypescript (dev)${esc}[0m │ 5.0.0 │ 5.1.0 │ 5.4.0 │ web │`,
        '└─────────┴─────────┴────────┴────────┴───────────┘',
      ].join('\n')

      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand')
        .mockResolvedValueOnce('error: unknown flag --json')
        .mockResolvedValueOnce(table)

      const results = await (client as any).runBunOutdated()

      expect(runCommandSpy).toHaveBeenCalledTimes(2)
      expect(runCommandSpy.mock.calls[0][1]).toEqual(['outdated', '--json'])
      expect(runCommandSpy.mock.calls[1][1]).toEqual(['outdated'])
      expect(results).toEqual([
        {
          name: 'typescript',
          current: '5.0.0',
          update: '5.1.0',
          latest: '5.4.0',
          workspace: 'web',
        },
      ])
    })
  })

  describe('getOutdatedPackages error handling', () => {
    it('wraps a total bun outdated failure in PackageRegistryError', async () => {
      const client = makeClient()
      spyOn(client as any, 'runCommand').mockRejectedValue(new Error('spawn failed'))

      const error = await client.getOutdatedPackages().catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(PackageRegistryError)
      expect((error as Error).message).toContain('Failed to check for outdated packages')
      expect((error as Error).message).toContain('spawn failed')
    })
  })

  describe('getUpdatesForPackages', () => {
    it('passes validated filter tokens through to bun outdated', async () => {
      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand').mockResolvedValue('[]')

      const updates = await client.getUpdatesForPackages(['react', '@types/node'])

      expect(updates).toEqual([])
      expect(runCommandSpy).toHaveBeenCalledWith('bun', ['outdated', '--json', 'react', '@types/node'])
    })

    it('rejects flag injection before any command runs', async () => {
      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand').mockResolvedValue('[]')

      const error = await client.getUpdatesForPackages(['--cwd=/tmp']).catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(PackageRegistryError)
      expect((error as Error).message).toContain('untrusted package filter')
      expect(runCommandSpy).not.toHaveBeenCalled()
    })
  })

  describe('getPackageJsonOutdated', () => {
    it('reports packages behind latest and honours ignore, excludeMajor, filter, and workspace: protocol', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        dependencies: {
          a: '^1.0.0',
          b: 'workspace:*',
          c: '2.0.0',
          ignored: '^1.0.0',
        },
        devDependencies: { d: '~3.0.0' },
      }))

      const client = makeClient(baseConfig({
        packages: { strategy: 'all', ignore: ['ignored'], excludeMajor: true },
      }))
      const latestSpy = spyOn(client, 'getLatestVersion').mockImplementation(
        async name => ({ a: '1.2.0', c: '2.0.0', d: '4.0.0' } as Record<string, string>)[name] ?? null,
      )

      const results = await (client as any).getPackageJsonOutdated()

      // b skipped (workspace:), c up to date, d excluded as major, ignored ignored.
      expect(results).toEqual([
        { name: 'a', current: '1.0.0', update: '1.2.0', latest: '1.2.0' },
      ])

      latestSpy.mockClear()
      const filtered = await (client as any).getPackageJsonOutdated('a')
      expect(filtered.map((result: { name: string }) => result.name)).toEqual(['a'])
      expect(latestSpy.mock.calls.map(call => call[0])).toEqual(['a'])

      // findPackageLocation reads the same tree.
      expect(await (client as any).findPackageLocation('a')).toBe('package.json')
      expect(await (client as any).findPackageLocation('not-anywhere')).toBeNull()
    })

    it('warns and returns [] when package.json is valid JSON but not an object', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), '[1,2,3]')

      const results = await (makeClient() as any).getPackageJsonOutdated()

      expect(results).toEqual([])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to check package.json versions:',
        expect.any(PackageRegistryError),
      )
    })

    it('warns and returns [] when package.json is not JSON at all', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), '{invalid json')

      const results = await (makeClient() as any).getPackageJsonOutdated()

      expect(results).toEqual([])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to check package.json versions:',
        expect.any(PackageRegistryError),
      )
    })
  })

  describe('getUpdatesForWorkspace', () => {
    it('builds workspace-scoped updates with release-notes and changelog links', async () => {
      const table = [
        '| Package | Current | Update | Latest |',
        '|---------|---------|--------|--------|',
        '| react | 18.0.0 | 18.1.0 | 18.2.0 |',
      ].join('\n')

      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand').mockResolvedValue(table)
      const metadata: PackageMetadata = {
        name: 'react',
        repository: 'https://github.com/foo/bar.git',
        homepage: 'https://react.dev',
        latestVersion: '18.2.0',
        versions: ['18.0.0', '18.2.0'],
      }
      spyOn(client, 'getPackageMetadata').mockResolvedValue(metadata)

      const updates = await client.getUpdatesForWorkspace('my-app')

      expect(runCommandSpy).toHaveBeenCalledWith('bun', ['outdated', '--filter', 'my-app'])
      expect(updates).toHaveLength(1)
      expect(updates[0].name).toBe('react')
      expect(updates[0].currentVersion).toBe('18.0.0')
      expect(updates[0].newVersion).toBe('18.2.0')
      expect(updates[0].updateType).toBe('minor')
      expect(updates[0].file).toBe('my-app/package.json')
      expect(updates[0].releaseNotesUrl).toBe('https://github.com/foo/bar/releases')
      expect(updates[0].changelogUrl).toBe('https://github.com/foo/bar/blob/main/CHANGELOG.md')
      expect(updates[0].homepage).toBe('https://react.dev')
    })

    it('degrades to [] with a warning when the command fails', async () => {
      const client = makeClient()
      spyOn(client as any, 'runCommand').mockRejectedValue(new Error('bun exploded'))

      const updates = await client.getUpdatesForWorkspace('my-app')

      expect(updates).toEqual([])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get updates for workspace my-app:',
        expect.any(Error),
      )
    })

    it('refuses a malformed workspace name without spawning anything', async () => {
      const client = makeClient()
      const runCommandSpy = spyOn(client as any, 'runCommand').mockResolvedValue('')

      const updates = await client.getUpdatesForWorkspace('bad name!')

      expect(updates).toEqual([])
      expect(runCommandSpy).not.toHaveBeenCalled()
    })
  })

  describe('searchPackages', () => {
    it('maps registry search results from the configured registry', async () => {
      fetchSpy = stubFetch(async () => jsonResponse({
        objects: [
          {
            package: {
              name: 'react',
              version: '18.2.0',
              description: 'A library',
              keywords: ['ui'],
            },
          },
        ],
      }))

      const results = await makeClient().searchPackages('react', 5)

      expect(String(fetchSpy.mock.calls[0][0])).toBe(`${NPM_REGISTRY}/-/v1/search?text=react&size=5`)
      expect(results).toEqual([
        { name: 'react', version: '18.2.0', description: 'A library', keywords: ['ui'] },
      ])
    })

    it('returns [] with a warning on HTTP failure', async () => {
      fetchSpy = stubFetch(async () => new Response('bad', { status: 400 }))

      const results = await makeClient().searchPackages('react')

      expect(results).toEqual([])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to search packages via registry API:',
        expect.any(Error),
      )
    })

    it('returns [] when the body has no objects array', async () => {
      fetchSpy = stubFetch(async () => jsonResponse({}))

      expect(await makeClient().searchPackages('react')).toEqual([])
    })
  })

  describe('getPackageVersionReleaseDate', () => {
    it('reads the packument time map and rejects invalid dates', async () => {
      const packument = {
        versions: { '1.2.3': {} },
        time: {
          '1.2.3': '2024-01-05T00:00:00.000Z',
          '9.9.9': 'not-a-date',
        },
      }

      fetchSpy = stubFetch(async () => jsonResponse(packument))

      const client = makeClient()
      const date = await client.getPackageVersionReleaseDate('dated-pkg', '1.2.3')
      expect(date?.toISOString()).toBe('2024-01-05T00:00:00.000Z')

      expect(await client.getPackageVersionReleaseDate('dated-pkg', '5.5.5')).toBeNull()
      expect(await client.getPackageVersionReleaseDate('dated-pkg', '9.9.9')).toBeNull()

      // All three reads share the memoized packument.
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getGitHubActionReleaseDate', () => {
    const githubConfig = (token?: string): BuddyConfig => baseConfig({
      repository: {
        provider: 'github',
        owner: 'acme',
        name: 'app',
        token,
        apiUrl: GITHUB_API,
      },
    })

    it('hits the releases-tag endpoint with auth headers from config', async () => {
      let capturedUrl = ''
      let capturedHeaders: Record<string, string> = {}
      fetchSpy = stubFetch(async (input: any, init?: any) => {
        capturedUrl = String(input)
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>
        return jsonResponse({ published_at: '2024-03-01T12:00:00Z' })
      })

      const date = await makeClient(githubConfig('cfg-token'))
        .getGitHubActionReleaseDate('actions/checkout', 'v4.1.0')

      expect(capturedUrl).toBe(`${GITHUB_API}/repos/actions/checkout/releases/tags/v4.1.0`)
      expect(capturedHeaders.Authorization).toBe('Bearer cfg-token')
      expect(date?.toISOString()).toBe('2024-03-01T12:00:00.000Z')
    })

    it('yields null when the release carries no published_at', async () => {
      fetchSpy = stubFetch(async () => jsonResponse({}))

      const date = await makeClient(githubConfig('cfg-token'))
        .getGitHubActionReleaseDate('actions/checkout', 'v4.1.0')

      expect(date).toBeNull()
    })

    it('guards malformed action names without any request', async () => {
      fetchSpy = stubFetch(async () => jsonResponse({}))

      const date = await makeClient(githubConfig('cfg-token'))
        .getGitHubActionReleaseDate('noslash', 'v1')

      expect(date).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('falls through BUDDY_TOKEN, GITHUB_TOKEN, GH_TOKEN, then anonymous', async () => {
      const captured: Array<Record<string, string>> = []
      fetchSpy = stubFetch(async (_input: any, init?: any) => {
        captured.push((init?.headers ?? {}) as Record<string, string>)
        return jsonResponse({ published_at: '2024-03-01T12:00:00Z' })
      })

      const client = makeClient(githubConfig())

      process.env.BUDDY_TOKEN = 'buddy-tok'
      process.env.GITHUB_TOKEN = 'gh-tok'
      await client.getGitHubActionReleaseDate('a/b', 'v1')

      delete process.env.BUDDY_TOKEN
      await client.getGitHubActionReleaseDate('a/b', 'v1')

      delete process.env.GITHUB_TOKEN
      process.env.GH_TOKEN = 'cli-tok'
      await client.getGitHubActionReleaseDate('a/b', 'v1')

      delete process.env.GH_TOKEN
      await client.getGitHubActionReleaseDate('a/b', 'v1')

      expect(captured[0].Authorization).toBe('Bearer buddy-tok')
      expect(captured[1].Authorization).toBe('Bearer gh-tok')
      expect(captured[2].Authorization).toBe('Bearer cli-tok')
      expect(captured[3].Authorization).toBeUndefined()
      expect(captured[3].Accept).toBe('application/vnd.github.v3+json')
      expect(captured[3]['User-Agent']).toBe('buddy')
    })
  })

  describe('getComposerPackageReleaseDate', () => {
    it('reads Packagist version timestamps', async () => {
      fetchSpy = stubFetch(async (input: any) => {
        expect(String(input)).toBe(`${COMPOSER_REGISTRY}/packages/laravel/framework.json`)
        return jsonResponse({
          package: {
            versions: {
              'v10.0.0': { time: '2023-02-14T10:00:00+00:00' },
            },
          },
        })
      })

      const client = makeClient()
      const date = await client.getComposerPackageReleaseDate('laravel/framework', 'v10.0.0')
      expect(date?.toISOString()).toBe('2023-02-14T10:00:00.000Z')

      expect(await client.getComposerPackageReleaseDate('laravel/framework', 'v9.0.0')).toBeNull()
    })

    it('yields null when Packagist has no record', async () => {
      fetchSpy = stubFetch(async () => new Response('missing', { status: 404 }))

      const date = await makeClient().getComposerPackageReleaseDate('unknown/package', 'v1.0.0')

      expect(date).toBeNull()
    })
  })

  describe('minimum release age for docker images', () => {
    it('is conservatively null so minimumReleaseAge allows docker updates', async () => {
      fetchSpy = stubFetch(async () => {
        throw new Error('unexpected network call')
      })

      const client = makeClient(baseConfig({
        packages: { strategy: 'all', minimumReleaseAge: 1440 },
      }))

      expect(await client.getDockerImageReleaseDate('nginx', '1.25')).toBeNull()

      const allowed = await client.meetsMinimumReleaseAge('nginx', '1.25', 'docker-image')
      expect(allowed).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('nginx@1.25'))
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('runCommand', () => {
    it('captures stdout from a successful command', async () => {
      const output = await (makeClient(undefined) as any).runCommand('bun', ['-e', 'console.log("out")'])
      expect(output).toBe('out\n')
    })

    it('surfaces stderr and the exit code on failure', async () => {
      const error = await (makeClient(undefined) as any)
        .runCommand('bun', ['-e', 'console.error("boom"); process.exit(3)'])
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('code 3')
      expect((error as Error).message).toContain('boom')
    })

    it('rejects when the binary does not exist', async () => {
      const error = await (makeClient(undefined) as any)
        .runCommand('buddy-definitely-not-a-real-binary-xyz', [])
        .catch((caught: unknown) => caught)

      // Depending on runtime, the miss reports via the error event (ENOENT,
      // or Bun's "Executable not found") or via close with a negative exit
      // code — assert the observable message, not the channel.
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toMatch(/ENOENT|code -\d+|Executable not found/)
    })
  })

  describe('getComposerOutdatedPackages', () => {
    it('returns [] with a warning when composer.json cannot be parsed', async () => {
      const client = makeClient()
      spyOn(client as any, 'runCommand').mockResolvedValueOnce('Composer version 2.5.8')

      const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true)
      const readSpy = spyOn(fs, 'readFileSync').mockReturnValue('{invalid json')

      try {
        const updates = await client.getComposerOutdatedPackages()

        expect(updates).toEqual([])
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to check for outdated Composer packages:',
          expect.any(Error),
        )
      }
      finally {
        existsSpy.mockRestore()
        readSpy.mockRestore()
      }
    })
  })
})
