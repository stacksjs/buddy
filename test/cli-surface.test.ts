import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * The CLI is registered in `bin/cli.ts`, which calls `cli.parse()` at import,
 * so it cannot be imported and inspected. These run it as a subprocess
 * instead — the only way to assert on the surface a user actually meets.
 *
 * Kept to commands that neither reach the network nor touch the working tree.
 */
const CLI = new URL('../bin/cli.ts', import.meta.url).pathname

/**
 * Run the CLI and capture what a user would see.
 *
 * @param args - Arguments to pass
 * @param cwd - Directory to run in (default: this repository)
 * @returns Exit code and combined output
 */
async function run(args: string[], cwd?: string): Promise<{ code: number, output: string }> {
  const proc = Bun.spawn(['bun', CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, APP_ENV: 'test' },
    ...(cwd ? { cwd } : {}),
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  return { code: await proc.exited, output: stdout + stderr }
}

describe('CLI surface', () => {
  it('success case - `buddy help` lists the commands', async () => {
    // A subcommand as well as a flag: `buddy help` is what a newcomer types,
    // and it used to print 'Command "help" not found'.
    const { code, output } = await run(['help'])

    expect(code).toBe(0)
    expect(output).toContain('buddy [command] [options]')
    expect(output).toContain('review')
    expect(output).toContain('scan')
    // The command's own usage line would mean the global help was not shown.
    expect(output).not.toContain('$ buddy help')
  }, 30000)

  it('success case - `buddy init` resolves to setup', async () => {
    const { output } = await run(['init', '--help'])

    expect(output).toContain('buddy setup')
  }, 30000)

  it('failure case - an unknown command is rejected', async () => {
    const { output } = await run(['frobnicate'])

    expect(output).toMatch(/not found/i)
  }, 30000)

  it('failure case - open-settings rejects an unknown --type', async () => {
    // Rejected before the repository lookup, so the error is the first thing
    // printed rather than the last.
    const { code, output } = await run(['open-settings', '--type', 'bogus'])

    expect(code).toBe(1)
    expect(output).toContain('Expected repo, org or both')
    expect(output).not.toContain('Opening GitHub Actions settings')
  }, 30000)

  it('success case - generate-workflows declines when workflows.enabled is false', async () => {
    // `workflows.enabled` was declared, documented and read by nothing — the
    // command generated the full set of workflow files regardless.
    const dir = mkdtempSync(join(tmpdir(), 'buddy-workflows-'))
    writeFileSync(join(dir, 'buddy.config.ts'), 'export default { workflows: { enabled: false } }\n')

    try {
      const { code, output } = await run(['generate-workflows', '--verbose'], dir)

      expect(code).toBe(0)
      expect(output).toContain('disabled by config')
      // Bun's native glob rather than node:fs — another suite's fs module
      // mock leaks into this file under CI's run order, and existsSync came
      // back undefined there.
      const entries = Array.from(new Bun.Glob('**/*').scanSync({ cwd: dir, onlyFiles: false }))
      expect(entries).toEqual(['buddy.config.ts'])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('success case - the strategy flag no longer shadows the config', async () => {
    // `--strategy` carried `{ default: 'all' }`, so the option was always
    // "set" and the handler's `options.strategy ?? config.packages?.strategy`
    // chain never reached the config — packages.strategy was dead on the
    // scan/update/check/schedule paths unless a flag was typed.
    const { code, output } = await run(['update', '--help'])

    expect(code).toBe(0)
    expect(output).toContain('packages.strategy from config')
    expect(output).not.toContain('(default: all)')
  }, 30000)

  it('failure case - an unknown flag is rejected rather than ignored', async () => {
    // clapp hard-errors on unknown options, which is why a documented-but-
    // unimplemented flag crashed rather than degrading.
    const { output } = await run(['scan', '--totally-fake-flag'])

    expect(output).toMatch(/unknown option/i)
  }, 30000)
})
