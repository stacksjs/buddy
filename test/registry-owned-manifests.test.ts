import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('real outdated discovery never proposes updates through installed package aliases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-registry-owned-')), requests: string[] = []
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request): Response {
    const name = decodeURIComponent(new URL(request.url).pathname.slice(1)); requests.push(name)
    if (!['owned-root', 'owned-workspace', 'installed-detail'].includes(name)) return new Response('Unknown fixture package', { status: 404 })
    // Native --lockfile-only needs packument metadata, never an archive. Any
    // accidental archive request is rejected rather than serving fake bytes.
    return Response.json({ name, 'dist-tags': { latest: '2.0.0' }, versions: Object.fromEntries(['1.0.0', '2.0.0'].map(version => [version, { name, version, dist: { tarball: `http://127.0.0.1:${server.port}/${name}/-/${name}-${version}.tgz`, shasum: '0000000000000000000000000000000000000000' } }])), time: { '1.0.0': '2020-01-01T00:00:00Z', '2.0.0': '2020-02-01T00:00:00Z' } })
  } })
  const run = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code !== 0) throw new Error(`Real Bun registry fixture failed: ${stdout}${stderr}`)
    return stdout
  }
  try {
    await mkdir(join(root, 'node_modules/installed'), { recursive: true })
    await mkdir(join(root, 'storage/framework'), { recursive: true })
    await mkdir(join(root, 'packages/app'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'root', dependencies: { 'owned-root': '1.0.0' } }))
    await writeFile(join(root, 'packages/app/package.json'), JSON.stringify({ name: 'app', dependencies: { 'owned-workspace': '1.0.0' } }))
    await writeFile(join(root, 'node_modules/installed/package.json'), JSON.stringify({ name: 'installed', dependencies: { 'installed-detail': '1.0.0' } }))
    await symlink(join(root, 'node_modules/installed'), join(root, 'storage/framework/defaults'), 'junction')
    for (const name of ['dist', '.next', '.git', 'coverage', 'pantry']) {
      await mkdir(join(root, name), { recursive: true })
      await writeFile(join(root, name, 'package.json'), JSON.stringify({ name: 'generated', dependencies: { 'installed-detail': '1.0.0' } }))
    }
    await writeFile(join(root, 'bunfig.toml'), `[install]\nregistry = "http://127.0.0.1:${server.port}"\n`)
    await run(['install', '--lockfile-only', '--ignore-scripts'])
    // A fresh process executes real Bun commands and the public registry API.
    // It does not inherit the parent suite's fetch stubs or mock a scanner.
    const output = await run([resolve(import.meta.dir, 'fixtures/registry-owned.ts'), root, `http://127.0.0.1:${server.port}`])
    const line = output.split('\n').find(value => value.startsWith('BUDDY_OWNED_RESULT='))
    if (!line) throw new Error('Real registry API did not return its result')
    expect(JSON.parse(line.slice('BUDDY_OWNED_RESULT='.length))).toEqual([
      { name: 'owned-root', file: 'package.json', newVersion: '2.0.0' },
      { name: 'owned-workspace', file: 'packages/app/package.json', newVersion: '2.0.0' },
    ])
    expect(requests).not.toContain('installed-detail')
  }
  finally { server.stop(true); await rm(root, { recursive: true, force: true }) }
})
