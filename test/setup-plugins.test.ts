import type { SetupContext } from '../src/setup'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PluginManager } from '../src/setup'

const realFetch = globalThis.fetch

interface Posted {
  url: string
  body: unknown
}

/** Record every webhook POST and answer it. */
function captureFetch(status = 200): Posted[] {
  const posted: Posted[] = []

  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    posted.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response('{}', { status })
  }) as unknown as typeof fetch

  return posted
}

function context(): SetupContext {
  return {
    step: 'setup_complete',
    progress: {} as SetupContext['progress'],
    // Setup holds a token by the time hooks run. Nothing here may reach a
    // webhook whose URL a committed file chose.
    config: { repository: { token: 'ghp_secret_value_here' } },
    repository: { owner: 'acme', name: 'widgets' } as SetupContext['repository'],
    analysis: {} as SetupContext['analysis'],
    plugins: [],
  }
}

/**
 * `loadCustomPlugins` pushed whatever `JSON.parse` returned onto the plugin
 * list, and `SetupHook.handler` is a function. JSON cannot carry one, so every
 * documented custom plugin loaded, announced itself, and then failed on each
 * hook with `hook.handler is not a function` — caught and logged as an
 * ordinary hook failure.
 */
describe('custom plugins from .buddy/plugins', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'buddy-plugins-'))
    originalCwd = process.cwd()
    process.chdir(testDir)
    await fs.mkdir('.buddy/plugins', { recursive: true })
  })

  afterEach(async () => {
    globalThis.fetch = realFetch
    process.chdir(originalCwd)
    await fs.rm(testDir, { recursive: true, force: true })
  })

  /** Write a plugin file and return the plugins discovered from it. */
  async function discover(plugin: unknown, name = 'custom.json') {
    await fs.writeFile(join('.buddy/plugins', name), JSON.stringify(plugin))
    const plugins = await new PluginManager().discoverPlugins()
    return plugins.filter(candidate => candidate.name === 'custom-integration')
  }

  const valid = {
    name: 'custom-integration',
    version: '1.0.0',
    enabled: true,
    triggers: [{ event: 'setup_complete' }],
    hooks: [{
      name: 'custom-notification',
      priority: 10,
      async: true,
      action: { type: 'webhook', url: 'https://example.test/notify' },
    }],
    configuration: { api_key: 'k' },
  }

  describe('loading', () => {
    it('success case - a declarative plugin loads', async () => {
      const [plugin] = await discover(valid)

      expect(plugin.version).toBe('1.0.0')
      expect(plugin.hooks[0].action?.url).toBe('https://example.test/notify')
    })

    it('failure case - a handler written as text is refused with the fix', async () => {
      // This is exactly what the README documented:
      // `"handler": "// Custom JavaScript function"`.
      const withHandler = {
        ...valid,
        hooks: [{ name: 'custom-notification', priority: 10, async: true, handler: '// Custom JavaScript function' }],
      }

      expect(await discover(withHandler)).toHaveLength(0)
    })

    it('failure case - a hook with no action is refused at load', async () => {
      const noAction = { ...valid, hooks: [{ name: 'h', priority: 1, async: true }] }

      expect(await discover(noAction)).toHaveLength(0)
    })

    it('failure case - a plugin with no triggers is refused', async () => {
      expect(await discover({ ...valid, triggers: [] })).toHaveLength(0)
    })

    it('failure case - a plugin with no name is refused', async () => {
      const { name, ...rest } = valid
      expect(await discover(rest)).toHaveLength(0)
      expect(name).toBe('custom-integration')
    })

    it('edge case - a file that is not an object is refused', async () => {
      await fs.writeFile('.buddy/plugins/bad.json', '"just a string"')

      expect(await new PluginManager().discoverPlugins()).toHaveLength(0)
    })

    it('edge case - unparseable JSON does not stop the other plugins', async () => {
      await fs.writeFile('.buddy/plugins/broken.json', '{ not json')

      expect(await discover(valid)).toHaveLength(1)
    })
  })

  describe('running', () => {
    /** A manager with one loaded plugin and a context set. */
    async function loaded(plugin: unknown = valid) {
      await fs.writeFile('.buddy/plugins/custom.json', JSON.stringify(plugin))
      const manager = new PluginManager()

      for (const discovered of await manager.discoverPlugins())
        await manager.loadPlugin(discovered)

      manager.setContext(context())
      return manager
    }

    it('success case - the declared webhook is called', async () => {
      const posted = captureFetch()
      const manager = await loaded()

      await manager.executePluginHooks({ event: 'setup_complete' })

      expect(posted).toHaveLength(1)
      expect(posted[0].url).toBe('https://example.test/notify')
    })

    it('success case - the payload names the event and repository', async () => {
      const posted = captureFetch()
      await (await loaded()).executePluginHooks({ event: 'setup_complete' })

      expect(posted[0].body).toMatchObject({
        event: 'setup_complete',
        repository: 'acme/widgets',
      })
    })

    it('failure case - the payload carries no credentials', async () => {
      // A plugin file committed to a repository chooses the URL, so what is
      // sent to it is a fixed shape rather than whatever is on the context.
      const posted = captureFetch()
      await (await loaded()).executePluginHooks({ event: 'setup_complete' })

      expect(JSON.stringify(posted[0].body)).not.toContain('ghp_secret_value_here')
    })

    it('success case - extra body fields are merged in', async () => {
      const posted = captureFetch()
      const withBody = {
        ...valid,
        hooks: [{
          name: 'h',
          priority: 1,
          async: true,
          action: { type: 'webhook', url: 'https://example.test/notify', body: { channel: '#builds' } },
        }],
      }

      await (await loaded(withBody)).executePluginHooks({ event: 'setup_complete' })

      expect(posted[0].body).toMatchObject({ channel: '#builds' })
    })

    it('failure case - a refused webhook does not abort setup', async () => {
      captureFetch(500)
      const manager = await loaded()

      await expect(manager.executePluginHooks({ event: 'setup_complete' })).resolves.toBeUndefined()
    })

    it('edge case - a trigger the plugin did not declare runs nothing', async () => {
      const posted = captureFetch()
      await (await loaded()).executePluginHooks({ event: 'pre_setup' })

      expect(posted).toHaveLength(0)
    })
  })
})
