import { describe, expect, it } from 'bun:test'
import {
  FINISHING_TOUCHES,
  getFinishingTouch,
  hasTouchOffer,
  parseTouchSelections,
  renderTouchOffer,
  withTouchOffer,
} from '../src/agent/tasks'
import {
  constrainLabels,
  findDuplicates,
  findMentionedPackages,
  renderPackageContext,
  similarity,
} from '../src/issues/enrichment'

describe('package mentions', () => {
  const known = ['react', 'vite', 'vitest', '@types/node', 'lodash.merge']

  it('success case - finds a mentioned dependency', () => {
    expect(findMentionedPackages('please bump lodash.merge', known)).toEqual(['lodash.merge'])
  })

  it('success case - matches scoped packages', () => {
    expect(findMentionedPackages('@types/node is outdated', known)).toEqual(['@types/node'])
  })

  it('failure case - does not match a package inside a longer name', () => {
    // `vite` must not match inside `vitest`.
    expect(findMentionedPackages('vitest is failing', known)).toEqual(['vitest'])
  })

  it('failure case - ignores packages the repository does not use', () => {
    // Extracting names freely would produce context for irrelevant packages.
    expect(findMentionedPackages('angular is broken', known)).toEqual([])
  })

  it('edge case - handles empty input', () => {
    expect(findMentionedPackages('', known)).toEqual([])
  })
})

describe('package context rendering', () => {
  it('success case - renders versions and notes', () => {
    const body = renderPackageContext([{
      name: 'lodash',
      declaredVersion: '^4.17.20',
      latestVersion: '4.17.21',
      vulnerable: true,
      openPRs: [42],
    }])

    expect(body).toContain('lodash')
    expect(body).toContain('4.17.21')
    expect(body).toContain('known advisory')
    expect(body).toContain('#42')
  })

  it('success case - flags deprecation', () => {
    expect(renderPackageContext([{ name: 'old', deprecated: true }])).toContain('deprecated')
  })

  it('edge case - renders nothing when there is nothing useful to say', () => {
    expect(renderPackageContext([{ name: 'unknown-pkg' }])).toBe('')
    expect(renderPackageContext([])).toBe('')
  })
})

describe('label constraints', () => {
  const existing = ['bug', 'enhancement', 'dependencies', 'good first issue']

  it('success case - applies labels the repository defines', () => {
    const decision = constrainLabels(['bug', 'dependencies'], existing)

    expect(decision.apply).toEqual(['bug', 'dependencies'])
    expect(decision.rejected).toEqual([])
  })

  it('failure case - rejects labels the repository does not define', () => {
    // A model will invent plausible labels; applying them creates junk.
    const decision = constrainLabels(['bug', 'needs-triage', 'P1'], existing)

    expect(decision.apply).toEqual(['bug'])
    expect(decision.rejected).toEqual(['needs-triage', 'P1'])
  })

  it('success case - matches case-insensitively but applies the real casing', () => {
    expect(constrainLabels(['Good First Issue'], existing).apply).toEqual(['good first issue'])
  })

  it('edge case - deduplicates repeated suggestions', () => {
    expect(constrainLabels(['bug', 'BUG'], existing).apply).toEqual(['bug'])
  })
})

describe('duplicate detection', () => {
  it('success case - scores near-identical issues highly', () => {
    const score = similarity(
      'dependency dashboard checkbox does nothing when ticked',
      'ticking the dependency dashboard checkbox does nothing',
    )

    expect(score).toBeGreaterThan(0.6)
  })

  it('success case - scores unrelated issues low', () => {
    expect(similarity('add support for python dependencies', 'the readme has a typo')).toBeLessThan(0.3)
  })

  it('success case - finds candidates above the threshold', () => {
    const duplicates = findDuplicates(
      'rebase checkbox does nothing when ticked',
      [
        { number: 1, text: 'ticking the rebase checkbox does nothing at all' },
        { number: 2, text: 'add python support' },
      ],
    )

    expect(duplicates.map(entry => entry.number)).toEqual([1])
  })

  it('edge case - empty text is never a duplicate', () => {
    expect(similarity('', 'anything at all')).toBe(0)
  })
})

describe('finishing touches', () => {
  it('success case - every built-in touch builds a task', () => {
    for (const touch of Object.values(FINISHING_TOUCHES)) {
      const task = touch.buildTask({ files: ['src/app.ts'], summary: 'a finding' })
      expect(task.length).toBeGreaterThan(50)
    }
  })

  it('success case - code-changing touches require verification', () => {
    // A change that looks right and breaks the build costs more than none.
    for (const name of ['unit-tests', 'autofix', 'simplify'])
      expect(FINISHING_TOUCHES[name].buildTask({})).toContain('Verify your work')
  })

  it('success case - the plan touch cannot change anything', () => {
    expect(FINISHING_TOUCHES.plan.mode.tiers).not.toContain('write')
    expect(FINISHING_TOUCHES.plan.buildTask({})).toContain('not an implementation')
  })

  it('failure case - an unknown touch is rejected rather than ignored', () => {
    expect(() => getFinishingTouch('nonsense')).toThrow(/Unknown finishing touch/)
  })

  it('success case - renders an offer with checkbox markers', () => {
    const offer = renderTouchOffer(['docstrings', 'unit-tests'])

    expect(offer).toContain('buddy:touch=docstrings')
    expect(offer).toContain('buddy:touch=unit-tests')
  })

  it('success case - reads back which touches were ticked', () => {
    const body = ` - [x] <!-- buddy:touch=docstrings -->Add docs\n - [ ] <!-- buddy:touch=simplify -->Simplify`

    expect(parseTouchSelections(body)).toEqual(['docstrings'])
  })

  it('edge case - ignores a ticked marker for an unknown touch', () => {
    expect(parseTouchSelections(' - [x] <!-- buddy:touch=nonsense -->x')).toEqual([])
  })

  it('edge case - nothing ticked selects nothing', () => {
    expect(parseTouchSelections(renderTouchOffer())).toEqual([])
  })
})

/**
 * `renderTouchOffer` had no production caller. `buddy touch` read ticked boxes
 * out of `pullRequest.body`, and nothing ever wrote any there — so the flow the
 * feature page is built around ("tick the checkbox Buddy posts") could not
 * start. `--offer` is what posts them.
 */
describe('offering finishing touches', () => {
  it('success case - appends the offer to a body', () => {
    const body = withTouchOffer('The original description.')

    expect(body).toContain('The original description.')
    expect(body).toContain('buddy:touch=unit-tests')
  })

  it('success case - the offer it writes is the one the parser reads', () => {
    // The two halves have to agree on the marker, or a tick is invisible.
    const ticked = withTouchOffer('desc').replace('- [ ] <!-- buddy:touch=unit-tests', '- [x] <!-- buddy:touch=unit-tests')

    expect(parseTouchSelections(ticked)).toEqual(['unit-tests'])
  })

  it('failure case - a body that already has the offer is left alone', () => {
    // The job posts on `opened` and on `ready_for_review`, so a draft marked
    // ready would otherwise get a second set of boxes that tick independently
    // of the first.
    const once = withTouchOffer('desc')

    expect(withTouchOffer(once)).toBe(once)
    expect(once.match(/buddy:touches/g)).toHaveLength(1)
  })

  it('success case - recognises a body that carries the offer', () => {
    expect(hasTouchOffer(withTouchOffer('desc'))).toBe(true)
    expect(hasTouchOffer('desc')).toBe(false)
    expect(hasTouchOffer(null)).toBe(false)
  })

  it('edge case - an empty body still gets an offer', () => {
    expect(hasTouchOffer(withTouchOffer(null))).toBe(true)
  })

  it('edge case - offering nothing changes nothing', () => {
    // `renderTouchOffer([])` is empty, and an empty offer must not append a
    // marker that `parseTouchSelections` would then find no boxes under.
    expect(withTouchOffer('desc', [])).toBe('desc')
  })

  it('success case - ticks already in the body survive being offered again', () => {
    const ticked = withTouchOffer('desc').replace('- [ ] <!-- buddy:touch=docstrings', '- [x] <!-- buddy:touch=docstrings')

    expect(parseTouchSelections(withTouchOffer(ticked))).toEqual(['docstrings'])
  })
})
