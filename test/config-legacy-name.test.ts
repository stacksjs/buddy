import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { getConfig, resetConfigCache } from '../src/config'

// The rename to `buddy` moved the config lookup to `buddy.ts`. Repositories set
// up before it carry `config/buddy-bot.ts` (Stacks apps among them, where
// `config/buddy.ts` would read as the Stacks CLI's own config), and reading
// none of it falls back to an empty repository - a run that reports success
// against nothing.
describe('config lookup under the pre-rename name', () => {
  let dir: string
  let cwd: string

  const write = (path: string, name: string) => {
    fs.mkdirSync(join(dir, 'config'), { recursive: true })
    fs.writeFileSync(join(dir, path), `export default { repository: { provider: 'github', owner: 'acme', name: '${name}' } }\n`)
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(join(tmpdir(), 'buddy-legacy-config-'))
    cwd = process.cwd()
    process.chdir(dir)
    resetConfigCache()
  })

  afterEach(() => {
    process.chdir(cwd)
    resetConfigCache()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reads config/buddy-bot.ts when there is no buddy config', async () => {
    write('config/buddy-bot.ts', 'legacy')
    const config = await getConfig()
    expect(config.repository?.owner).toBe('acme')
    expect(config.repository?.name).toBe('legacy')
  })

  it('prefers config/buddy.ts when both exist', async () => {
    write('config/buddy-bot.ts', 'legacy')
    write('config/buddy.ts', 'current')
    const config = await getConfig()
    expect(config.repository?.name).toBe('current')
  })
})
