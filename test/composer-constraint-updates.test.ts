import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import * as fs from 'node:fs'
import { generateComposerUpdates } from '../src/utils/composer-parser'

/**
 * This file sat in the tree as zero bytes — a suite that ran, passed and
 * asserted nothing, which reads as coverage in every listing. What its name
 * promises is the constraint-style contract: an update must keep the shape
 * the maintainer wrote (`^`, `~`, exact, compound range), because rewriting
 * `^10.0` to a bare `10.48.29` silently pins a project that chose a range.
 */
describe('composer constraint updates', () => {
  const composerJson = {
    'require': {
      'php': '^8.1',
      'laravel/framework': '^10.0',
      'symfony/console': '>=6.0,<7.0',
      'monolog/monolog': '~3.0',
      'guzzlehttp/guzzle': '7.8.1',
    },
    'require-dev': {
      'phpunit/phpunit': '^10.0',
    },
  }

  let readFileSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(composerJson, null, 2))
  })

  afterEach(() => {
    // Restore, or every later test that reads a real file gets composer.json.
    readFileSpy?.mockRestore?.()
  })

  /** Run one update through the generator and hand back the rewritten JSON. */
  async function updated(name: string, newVersion: string): Promise<Record<string, Record<string, string>>> {
    const result = await generateComposerUpdates([{ name, newVersion, file: 'composer.json' }])
    expect(result).toHaveLength(1)
    return JSON.parse(result[0].content)
  }

  it('success case - a caret constraint keeps its caret', async () => {
    const json = await updated('laravel/framework', '10.48.29')

    expect(json.require['laravel/framework']).toBe('^10.48.29')
  })

  it('success case - a tilde constraint keeps its tilde', async () => {
    const json = await updated('monolog/monolog', '3.9.0')

    expect(json.require['monolog/monolog']).toBe('~3.9.0')
  })

  it('success case - an exact pin stays exact', async () => {
    const json = await updated('guzzlehttp/guzzle', '7.9.2')

    expect(json.require['guzzlehttp/guzzle']).toBe('7.9.2')
  })

  it('success case - a compound range moves only its floor', async () => {
    // `>=6.0,<7.0` updated to 6.4.23 must not touch the ceiling: rewriting
    // both bounds would widen the range the maintainer deliberately closed.
    const json = await updated('symfony/console', '6.4.23')

    expect(json.require['symfony/console']).toBe('>=6.4.23,<7.0')
  })

  it('success case - require-dev packages update with the same rules', async () => {
    const json = await updated('phpunit/phpunit', '10.5.20')

    expect(json['require-dev']['phpunit/phpunit']).toBe('^10.5.20')
  })

  it('edge case - only the named package changes', async () => {
    const json = await updated('laravel/framework', '10.48.29')

    expect(json.require['symfony/console']).toBe('>=6.0,<7.0')
    expect(json.require['monolog/monolog']).toBe('~3.0')
    expect(json.require.php).toBe('^8.1')
  })

  it('failure case - an unknown package leaves the file untouched', async () => {
    const json = await updated('vendor/not-here', '1.0.0')

    expect(json).toEqual(composerJson)
  })
})
