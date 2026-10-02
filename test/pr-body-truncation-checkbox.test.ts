import { describe, expect, it } from 'bun:test'
import { PullRequestGenerator } from '../src/pr/pr-generator'

// The rebase checkbox sat near the end of the body, so truncating a large
// group's prose cut it off: stacksjs/stacks#2817 (45 updates, 56KB) had no
// checkbox, and nobody could ask buddy to rebase it.
describe('a truncated pull request body', () => {
  const group = {
    name: 'Non-Major Updates',
    title: 'chore(deps): update all non-major dependencies',
    updateType: 'minor',
    updates: [{ name: 'stripe', currentVersion: '22.0.0', newVersion: '22.1.0', updateType: 'minor', dependencyType: 'dependencies', file: 'package.json' }],
  } as any

  it('keeps the rebase checkbox and stays under GitHub\'s limit', () => {
    const generator = new PullRequestGenerator({ verbose: false } as any) as any
    const body: string = generator.finalizeBody(`<details>${'x'.repeat(70_000)}</details>`, group)

    expect(body.length).toBeLessThan(65_536)
    expect(body).toContain('<!-- rebase-check -->')
    expect(body).toContain('truncated')
    // Ticking it must still be read as a request (the CLI's pattern).
    const ticked = body.replace('- [ ] <!-- rebase-check -->', '- [x] <!-- rebase-check -->')
    expect(/\s*-\s*\[x\]\s*<!--\s*rebase-check\s*-->.*(?:rebase|update)\/retry/i.test(ticked)).toBe(true)
  })

  it('carries exactly one checkbox when nothing was truncated', () => {
    const generator = new PullRequestGenerator({ verbose: false } as any) as any
    const body: string = generator.finalizeBody('short body\n\n', group)
    expect(body.match(/<!-- rebase-check -->/g)).toHaveLength(1)
  })
})
