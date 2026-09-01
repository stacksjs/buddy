import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadWorkflows } from '../../src/security/loader'

const VALID = `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: bun test
`

/**
 * The loader is the front door of every `buddy security` audit — `audit()`
 * begins with it — and had 0% function coverage: the rules are tested
 * against hand-built fixtures, so a discovery bug (a skipped extension, a
 * traversed subdirectory) would fail every audit while every test stayed
 * green.
 */
describe('workflow loader', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0)
      cleanups.pop()?.()
  })

  /** A temp repo root, removed after the test. */
  function root(): string {
    const dir = mkdtempSync(join(tmpdir(), 'buddy-loader-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    return dir
  }

  it('success case - finds yml and yaml, and nothing else', async () => {
    const dir = root()
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), VALID)
    writeFileSync(join(dir, '.github', 'workflows', 'release.yaml'), VALID)
    writeFileSync(join(dir, '.github', 'workflows', 'README.md'), '# not a workflow')

    const workflows = await loadWorkflows(dir)

    expect(workflows.map(workflow => workflow.file).sort()).toEqual([
      '.github/workflows/ci.yml',
      '.github/workflows/release.yaml',
    ])
    expect(workflows[0].raw).toContain('runs-on')
  })

  it('edge case - subdirectories are not traversed', async () => {
    // GitHub itself only loads top-level files; a nested yml is a composite
    // action or a template, not a triggered workflow.
    const dir = root()
    mkdirSync(join(dir, '.github', 'workflows', 'templates'), { recursive: true })
    writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), VALID)
    writeFileSync(join(dir, '.github', 'workflows', 'templates', 'nested.yml'), VALID)

    const workflows = await loadWorkflows(dir)

    expect(workflows.map(workflow => workflow.file)).toEqual(['.github/workflows/ci.yml'])
  })

  it('edge case - a repository without workflows loads as empty', async () => {
    expect(await loadWorkflows(root())).toEqual([])
  })
})
