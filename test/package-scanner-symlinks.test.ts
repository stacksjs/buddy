import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PackageScanner } from '../src/scanner/package-scanner'
import { Logger } from '../src/utils/logger'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

test('installed framework directory aliases are not project-owned dependency manifests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-manifests-'))
  directories.push(root)
  const installed = join(root, 'node_modules/@stacksjs/defaults')
  await mkdir(installed, { recursive: true })
  await mkdir(join(root, 'storage/framework'), { recursive: true })
  await mkdir(join(root, 'packages/app'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'root', dependencies: { 'owned-root': '1.0.0' } }))
  await writeFile(join(root, 'packages/app/package.json'), JSON.stringify({ name: 'app', dependencies: { 'owned-workspace': '1.0.0' } }))
  await writeFile(join(installed, 'package.json'), JSON.stringify({ name: '@stacksjs/defaults', dependencies: { 'installed-detail': '1.0.0' } }))
  await symlink(installed, join(root, 'storage/framework/defaults'), 'junction')

  const files = await new PackageScanner(root, Logger.quiet()).scanProject()
  expect(files.map(file => file.path).sort()).toEqual(['package.json', 'packages/app/package.json'])
  expect(files.flatMap(file => file.dependencies.map(dependency => dependency.name)).sort()).toEqual(['owned-root', 'owned-workspace'])
})

test('adapter discovery excludes linked manifest files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-adapters-'))
  directories.push(root)
  await mkdir(join(root, 'node_modules/installed'), { recursive: true })
  await mkdir(join(root, 'linked'), { recursive: true })
  const manifest = '[package]\nname = "owned"\nversion = "1.0.0"\n'
  await writeFile(join(root, 'Cargo.toml'), manifest)
  await writeFile(join(root, 'node_modules/installed/Cargo.toml'), manifest)
  await symlink(join(root, 'node_modules/installed/Cargo.toml'), join(root, 'linked/Cargo.toml'), 'file')
  const { detectFiles } = await import('../src/ecosystems/shared')
  expect(await detectFiles(root, ['Cargo.toml'])).toEqual(['Cargo.toml'])
})

test('catalog discovery excludes a linked workspace manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-catalogs-'))
  directories.push(root)
  await mkdir(join(root, 'node_modules/installed'), { recursive: true })
  const target = join(root, 'node_modules/installed/pnpm-workspace.yaml')
  await writeFile(target, 'catalog:\n  is-number: "1.0.0"\n')
  await symlink(target, join(root, 'pnpm-workspace.yaml'), 'file')
  const { scanCatalogs } = await import('../src/scanner/catalog-scan')
  expect(await scanCatalogs(root, async () => '2.0.0', { logger: Logger.quiet() })).toEqual({ updates: [], entries: [] })
})

test('linked files and recursive aliases do not become package, YAML or container update targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-file-links-'))
  directories.push(root)
  const installed = join(root, 'node_modules/installed'), alias = join(root, 'packages/alias')
  await mkdir(installed, { recursive: true })
  await mkdir(alias, { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'owned', dependencies: { 'owned-root': '1.0.0' } }))
  for (const [name, content] of [
    ['package.json', JSON.stringify({ name: 'installed', dependencies: { 'installed-detail': '1.0.0' } })],
    ['deps.yaml', 'dependencies:\n  bun: ^1.2.0\n'],
    ['Dockerfile', 'FROM node:20.0.0\n'],
  ]) {
    await writeFile(join(installed, name!), content!)
    await symlink(join(installed, name!), join(alias, name!), 'file')
  }
  await mkdir(join(root, '.github/workflows'), { recursive: true })
  await writeFile(join(installed, 'ci.yml'), 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n')
  await symlink(join(installed, 'ci.yml'), join(root, '.github/workflows/ci.yml'), 'file')
  await symlink(root, join(alias, 'cycle'), 'junction')
  await symlink(join(root, 'missing.yaml'), join(root, 'aaa-broken.yaml'), 'file')
  const files = await new PackageScanner(root, Logger.quiet()).scanProject()
  expect(files.map(file => file.path)).toEqual(['package.json'])
})

test.each(['.github', '.github/workflows'])('workflow discovery does not follow a linked %s directory', async (alias) => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-workflow-links-'))
  directories.push(root)
  const external = join(root, 'node_modules/installed')
  await mkdir(join(external, 'workflows'), { recursive: true })
  await writeFile(join(external, 'workflows/ci.yml'), 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n')
  if (alias.endsWith('workflows'))
    await mkdir(join(root, '.github'))
  await symlink(alias.endsWith('workflows') ? join(external, 'workflows') : external, join(root, alias), 'junction')
  expect(await new PackageScanner(root, Logger.quiet()).scanProject()).toEqual([])
})

test('real vendored manifests and owned workflows remain discoverable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-vendored-'))
  directories.push(root)
  await mkdir(join(root, 'storage/framework/defaults'), { recursive: true })
  await mkdir(join(root, '.github/workflows'), { recursive: true })
  await writeFile(join(root, 'storage/framework/defaults/package.json'), JSON.stringify({ name: 'owned-defaults', dependencies: { 'owned-framework': '1.0.0' } }))
  await writeFile(join(root, '.github/workflows/ci.yml'), 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n')
  const files = await new PackageScanner(root, Logger.quiet()).scanProject()
  expect(files.map(file => file.path).sort()).toEqual(['.github/workflows/ci.yml', 'storage/framework/defaults/package.json'])
})

test('owned adapter and catalog manifests remain discoverable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-owned-other-scans-'))
  directories.push(root)
  await writeFile(join(root, 'Cargo.toml'), '[package]\nname = "owned"\nversion = "1.0.0"\n')
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'catalog:\n  is-number: "1.0.0"\n')
  const { detectFiles } = await import('../src/ecosystems/shared')
  const { scanCatalogs } = await import('../src/scanner/catalog-scan')
  expect(await detectFiles(root, ['Cargo.toml'])).toEqual(['Cargo.toml'])
  const result = await scanCatalogs(root, async () => '2.0.0', { logger: Logger.quiet() })
  expect(result.updates).toHaveLength(1)
  expect(result.updates[0]!.file).toBe('pnpm-workspace.yaml')
  expect(result.updates[0]!.name).toBe('is-number')
})
