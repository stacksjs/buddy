import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PackageScanner } from '../src/scanner/package-scanner'
import { Logger } from '../src/utils/logger'

const mockWorkflowContent = `
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun install
      - uses: actions/cache@v4.1.0
        with:
          path: ~/.bun
          key: \${{ runner.os }}-bun
`

describe('PackageScanner - GitHub Actions Integration', () => {
  let root: string
  let scanner: PackageScanner
  const workflow = async (name: string, content = mockWorkflowContent): Promise<void> => {
    await mkdir(join(root, '.github/workflows'), { recursive: true })
    await writeFile(join(root, '.github/workflows', name), content)
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'buddy-workflow-discovery-'))
    scanner = new PackageScanner(root, Logger.quiet())
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('finds owned GitHub Actions workflow files through project scanning', async () => {
    await workflow('ci.yml'); await workflow('release.yaml'); await workflow('README.md', 'Workflow documentation')
    const files = await scanner.scanProject()
    expect(files.map(file => file.path).sort()).toEqual(['.github/workflows/ci.yml', '.github/workflows/release.yaml'])
  })

  it('handles an absent workflow directory', async () => {
    expect(await scanner.scanProject()).toEqual([])
  })

  it('admits YAML workflow extensions and excludes unrelated files', async () => {
    await workflow('ci.yml'); await workflow('release.yaml'); await workflow('test.json', '{}'); await workflow('build.txt', 'notes')
    const files = await scanner.scanProject()
    expect(files.map(file => file.path).sort()).toEqual(['.github/workflows/ci.yml', '.github/workflows/release.yaml'])
  })

  it('parses action names and versions from a real workflow', async () => {
    await workflow('ci.yml')
    const result = await scanner.parseGitHubActionsFile('.github/workflows/ci.yml')
    expect(result?.path).toBe('.github/workflows/ci.yml')
    expect(result?.dependencies.map(dependency => [dependency.name, dependency.currentVersion])).toEqual([
      ['actions/checkout', 'v4'], ['oven-sh/setup-bun', 'v2'], ['actions/cache', 'v4.1.0'],
    ])
  })

  it('returns null when a workflow cannot be read', async () => {
    expect(await scanner.parseGitHubActionsFile('.github/workflows/missing.yml')).toBeNull()
  })

  it('reports no dependencies for unsupported workflow content', async () => {
    await workflow('invalid.yml', 'invalid yaml content [}')
    const result = await scanner.parseGitHubActionsFile('.github/workflows/invalid.yml')
    expect(result).toBeTruthy()
    expect(result?.dependencies).toEqual([])
  })

  it('includes the actual action dependency inventory in a project scan', async () => {
    await workflow('ci.yml')
    const files = await scanner.scanProject()
    expect(files).toHaveLength(1)
    expect(files[0]?.dependencies.map(dependency => dependency.name)).toEqual(['actions/checkout', 'oven-sh/setup-bun', 'actions/cache'])
  })

  it('handles a directory where a workflow file was expected', async () => {
    await mkdir(join(root, '.github/workflows/not-a-file.yml'), { recursive: true })
    expect(await scanner.parseGitHubActionsFile('.github/workflows/not-a-file.yml')).toBeNull()
  })
})
