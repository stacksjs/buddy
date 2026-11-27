import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { GitHubProvider } from '../src/git/github-provider'

function git(cwd: string, ...args: string[]): string {
  const child = Bun.spawnSync({ cmd: ['git', ...args], cwd, stderr: 'pipe', stdout: 'pipe' })
  if (!child.success)
    throw new Error(child.stderr.toString())
  return child.stdout.toString().trim()
}

const branch = 'buddy/update-dependencies'
const branchRef = 'refs/heads/' + branch
const before = {
  'dependencies.json': '{"name":"fixture","version":"1.0.0"}',
  'bun.lock': '{"version":"1.0.0"}',
  'pantry.lock': '{"version":"1.0.0"}',
}
const competing = {
  ...before,
  'bun.lock': '{"version":"1.1.0"}',
  'pantry.lock': '{"version":"1.1.0"}',
}
const files = [
  { path: 'dependencies.json', content: '{"name":"fixture","version":"2.0.0"}', type: 'update' },
  { path: 'bun.lock', content: '{"version":"2.0.0"}', type: 'update' },
  { path: 'pantry.lock', content: '{"version":"2.0.0"}', type: 'update' },
] as const

for (const competingUpdate of [false, true]) {
  const scenario = competingUpdate ? 'a competing branch write preserves remote files' : 'a main-only clone refreshes both lockfiles'
  test(scenario, async () => {
    const previousDirectory = process.cwd()
    const root = mkdtempSync(join(tmpdir(), 'buddy-refresh-lease-'))
    const remote = join(root, 'remote.git')
    const writer = join(root, 'writer')
    const checkout = join(root, 'checkout')
    try {
      git(root, 'init', '--bare', remote)
      mkdirSync(writer)
      git(writer, 'init', '-b', 'main')
      git(writer, 'config', 'user.name', 'Fixture')
      git(writer, 'config', 'user.email', 'test@example.test')
      for (const [path, content] of Object.entries(before))
        writeFileSync(join(writer, path), content)
      git(writer, 'add', '.')
      git(writer, 'commit', '-m', 'Base')
      git(writer, 'remote', 'add', 'origin', remote)
      git(writer, 'push', 'origin', 'main')
      git(writer, 'switch', '-c', branch)
      git(writer, 'commit', '--allow-empty', '-m', 'Earlier dependency update')
      git(writer, 'push', 'origin', branch)
      for (const [path, content] of Object.entries(competing))
        writeFileSync(join(writer, path), content)
      git(writer, 'add', '.')
      git(writer, 'commit', '-m', 'Competing dependency update')
      const competingTip = git(writer, 'rev-parse', 'HEAD')
      git(root, 'clone', '--single-branch', '--branch', 'main', remote, checkout)
      expect(git(checkout, 'for-each-ref', '--format=%(objectname)', 'refs/remotes/origin/' + branch)).toBe('')

      process.chdir(checkout)
      const provider = new GitHubProvider('fixture-token', 'example', 'fixture', true)
      let fallback = false
      Object.assign(provider, { commitChangesWithAPI: async () => { fallback = true } })
      const runCommand = provider.runCommand.bind(provider)
      provider.runCommand = async (command, args, token) => {
        if (competingUpdate && command === 'git' && args[0] === 'push')
          git(writer, 'push', 'origin', branch)
        return runCommand(command, args, token)
      }

      const refresh = provider.commitChanges(branch, 'Refresh dependency files', [...files])
      if (competingUpdate) {
        await expect(refresh).rejects.toThrow('Could not update ' + branchRef)
        expect(git(remote, 'rev-parse', branchRef)).toBe(competingTip)
        for (const [path, content] of Object.entries(competing))
          expect(git(remote, 'show', branchRef + ':' + path)).toBe(content)
      }
      else {
        await refresh
        for (const file of files)
          expect(git(remote, 'show', branchRef + ':' + file.path)).toBe(file.content)
      }
      expect(fallback).toBeFalse()
    }
    finally {
      process.chdir(previousDirectory)
      rmSync(root, { recursive: true, force: true })
    }
  })
}
