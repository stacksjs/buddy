import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diagnose } from '../src/doctor'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

function git(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(['git', '-c', 'user.name=Chris', '-c', 'user.email=chris@stacksjs.com', ...args], { cwd, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
  if (result.exitCode !== 0) throw new Error(`Fixture git ${args[0]} failed: ${result.stderr.toString()}`)
}

test('doctor recognizes a real linked worktree and its nested working directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-doctor-worktree-'))
  directories.push(root)
  const repository = join(root, 'repository'), linked = join(root, 'linked')
  await mkdir(repository)
  git(repository, 'init')
  await writeFile(join(repository, 'README.md'), 'Fixture repository\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'chore: seed fixture')
  git(repository, 'worktree', 'add', '--detach', linked)
  await mkdir(join(linked, 'packages/app'), { recursive: true })
  for (const cwd of [repository, linked, join(linked, 'packages/app')]) {
    const report = await diagnose({ repository: { provider: 'github', owner: 'o', name: 'r' } }, { cwd, env: {}, hasCommand: async () => false })
    expect(report.checks.find(check => check.name === 'git repository')?.status).toBe('ok')
    expect(report.healthy).toBe(true)
  }
  const missing = await diagnose({}, { cwd: join(root, 'missing'), env: {}, hasCommand: async () => false })
  expect(missing.checks.find(check => check.name === 'git repository')?.status).toBe('fail')
  expect(missing.healthy).toBe(false)
})
