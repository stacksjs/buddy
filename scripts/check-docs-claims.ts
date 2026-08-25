#!/usr/bin/env bun
/**
 * Check the documentation against the code it documents.
 *
 * The docs drifted badly once: commands that were never registered, flags that
 * `clapp` hard-errors on, and config keys invented wholesale. Nothing caught it
 * because the docs workflow is path-filtered on `docs/`, so a change under
 * `src/` never rechecks the pages describing it. This script closes that gap by
 * deriving the truth from source and failing when a page disagrees.
 *
 * Two checks run:
 *
 * - **CLI surface** — every `buddy <command> [--flags]` written in the docs must
 *   resolve to a command registered in `bin/cli.ts`, with flags that command
 *   actually declares.
 * - **Config keys** — every key in a Buddy config example must exist somewhere
 *   in `BuddyConfig` (`src/types.ts`).
 *
 * Both checks read the truth out of source at run time, so they cannot go stale
 * the way a hand-maintained list would.
 *
 * Known blind spot: a fence that *declares* types is skipped, because a
 * documented `interface` is describing a shape rather than using one. That
 * means an invented interface in an API reference page passes. Checking a
 * documented type against a real one is a different problem than checking a
 * config literal, and this script does not attempt it.
 *
 * @example
 * ```sh
 * bun run check:docs
 * ```
 */
import { Glob } from 'bun'

const ROOT = new URL('..', import.meta.url).pathname

/** A documentation claim that source does not support. */
interface Problem {
  file: string
  line: number
  message: string
}

/** Flags every command accepts, whether or not it declares them. */
const GLOBAL_FLAGS = ['--config', '--help', '-h', '--version']

/**
 * Words that follow "buddy" in prose often enough to be worth ignoring, so a
 * sentence like "buddy scans your repo" is not read as a command invocation.
 */
const PROSE_AFTER_BUDDY = new Set([
  'bot', 'is', 'can', 'will', 'handles', 'uses', 'scans', 'runs', 'does',
  'and', 'or', 'to', 'the', 'a', 'as', 'in', 'on', 'for', 'with', 'from',
  'creates', 'opens', 'posts', 'reads', 'writes', 'needs', 'supports',
])

/**
 * Read the real command surface out of `bin/cli.ts`.
 *
 * Options are attached to the most recent `.command()` above them, which is how
 * the chained registrations in `bin/cli.ts` are actually structured.
 *
 * @returns Command name to the set of flags it accepts
 */
async function readCliSurface(): Promise<Map<string, Set<string>>> {
  const lines = (await Bun.file(`${ROOT}bin/cli.ts`).text()).split('\n')
  const commands = new Map<string, Set<string>>()
  const aliases = new Map<string, string>()
  const marks: Array<{ line: number, name: string }> = []

  lines.forEach((line, i) => {
    // Both spellings are in use: chained onto `cli`, and the single-line
    // `cli.command('version', …).action(…)` form.
    const match = line.match(/^\s*(?:cli)?\.command\((["'])(.+?)\1\s*,/)
    if (!match)
      return

    const name = match[2].split(' ')[0]
    marks.push({ line: i, name })
    if (!commands.has(name))
      commands.set(name, new Set(GLOBAL_FLAGS))
  })

  // An alias is a real name a user can type, so it must resolve like one.
  lines.forEach((line, i) => {
    const match = line.match(/^\s*\.alias\((["'])(.+?)\1\)/)
    if (!match)
      return

    let owner: string | null = null
    for (const mark of marks) {
      if (mark.line < i)
        owner = mark.name
    }
    if (owner)
      aliases.set(match[2], owner)
  })

  lines.forEach((line, i) => {
    const match = line.match(/^\s*\.option\((["'])(.+?)\1\s*,/)
    if (!match)
      return

    let owner: string | null = null
    for (const mark of marks) {
      if (mark.line < i)
        owner = mark.name
    }
    if (!owner)
      return

    // `'--verbose, -v'` and `'-f, --format <format>'` both declare two spellings.
    for (const token of match[2].split(',').map(part => part.trim().split(/[ <[]/)[0]).filter(Boolean))
      commands.get(owner)!.add(token)
  })

  for (const [alias, target] of aliases) {
    const flags = commands.get(target)
    if (flags)
      commands.set(alias, flags)
  }

  return commands
}

/**
 * Files that declare the config vocabulary.
 *
 * `PackageRule` lives with the engine that consumes it rather than in
 * `types.ts`, so a rule key like `groupName` is only valid because of the
 * second entry here.
 */
const CONFIG_TYPE_FILES = ['src/types.ts', 'src/rules/engine.ts']

/**
 * Read every property name declared by the config types.
 *
 * Flattened deliberately: `BuddyConfig` nests inline object types many levels
 * deep, and a flat vocabulary catches an invented key wherever it appears
 * without needing to resolve the shape it sits in. The trade is that a key
 * valid in one branch of the config is accepted in every branch — this check
 * exists to catch wholesale invention, not misplacement.
 *
 * @returns Every property name the config types declare
 */
async function readConfigKeys(): Promise<{ keys: Set<string>, openMaps: Set<string> }> {
  const keys = new Set<string>()
  const openMaps = new Set<string>()

  for (const file of CONFIG_TYPE_FILES) {
    const text = await Bun.file(`${ROOT}${file}`).text()

    for (const [, , key] of text.matchAll(/^\s*(?:readonly\s+)?(['"]?)([A-Za-z_$][\w$]*)\1\??\s*:/gm))
      keys.add(key)

    // A `Record<string, …>` is keyed by user data — package names, scopes —
    // so its children are values, not schema keys, and must not be checked.
    for (const [, , key] of text.matchAll(/^\s*(['"]?)([A-Za-z_$][\w$]*)\1\??\s*:\s*Record</gm))
      openMaps.add(key)
  }

  return { keys, openMaps }
}

/**
 * Check every `buddy …` invocation written in the docs.
 *
 * @param files - Markdown files to scan
 * @param commands - The real CLI surface
 * @returns Problems found
 */
function checkCliClaims(files: Array<{ path: string, text: string }>, commands: Map<string, Set<string>>): Problem[] {
  const problems: Problem[] = []

  for (const { path, text } of files) {
    text.split('\n').forEach((line, i) => {
      // An invocation, not a prose mention: line start, a shell prompt, or a
      // backtick immediately before the word.
      const match = line.match(/(?:^|\$\s*|`)buddy\s+([a-z][a-z-]*)((?:\s+[^`\n]*)?)/)
      if (!match)
        return

      const [, name, rest = ''] = match
      const flags = commands.get(name)

      if (!flags) {
        if (!PROSE_AFTER_BUDDY.has(name))
          problems.push({ file: path, line: i + 1, message: `unknown command: buddy ${name}` })
        return
      }

      for (const [, flag] of rest.matchAll(/(?:^|\s)(--?[a-z][a-z-]*)/g)) {
        if (!flags.has(flag) && !flags.has(`--no-${flag.replace(/^--/, '')}`))
          problems.push({ file: path, line: i + 1, message: `buddy ${name}: unknown flag ${flag}` })
      }
    })
  }

  return problems
}

/**
 * Check config keys used in documentation examples.
 *
 * Only fenced blocks that identify themselves as Buddy config are scanned —
 * either by naming `BuddyConfig` or by sitting in a file whose whole subject is
 * configuration — so an unrelated snippet cannot raise a false alarm.
 *
 * @param files - Markdown files to scan
 * @param known - Every property name the config types declare
 * @returns Problems found
 */
function checkConfigClaims(
  files: Array<{ path: string, text: string }>,
  known: Set<string>,
  openMaps: Set<string>,
): Problem[] {
  const problems: Problem[] = []
  const configPages = /docs\/(config|api\/configuration)\.md$/
  const codeLang = /^(ts|typescript|js|javascript|json)$/

  for (const { path, text } of files) {
    const lines = text.split('\n')
    let fenceStart = -1
    let fenceLang = ''

    lines.forEach((line, i) => {
      const fence = line.match(/^```(\w*)/)
      if (!fence)
        return

      if (fenceStart === -1) {
        fenceStart = i
        fenceLang = fence[1]
        return
      }

      const body = lines.slice(fenceStart + 1, i)
      const source = body.join('\n')

      // A fence that declares types is describing the schema, not using it.
      const declaresTypes = /^\s*(?:export\s+)?(?:interface|type)\s/m.test(source)
      const isConfig = codeLang.test(fenceLang)
        && !declaresTypes
        && (/BuddyConfig|buddy\.config/.test(source) || configPages.test(path))

      if (isConfig) {
        // Track nesting so the children of an open map can be skipped.
        const stack: Array<{ indent: number, key: string }> = []

        body.forEach((bodyLine, offset) => {
          const match = bodyLine.match(/^(\s*)(['"]?)([A-Za-z_$][\w$@/-]*)\2\s*:/)
          if (!match)
            return

          const [, indent, , key] = match
          while (stack.length > 0 && stack[stack.length - 1].indent >= indent.length)
            stack.pop()

          const insideOpenMap = stack.some(entry => openMaps.has(entry.key))
          if (!insideOpenMap && !known.has(key))
            problems.push({ file: path, line: fenceStart + offset + 2, message: `unknown config key: ${key}` })

          if (bodyLine.trimEnd().endsWith('{'))
            stack.push({ indent: indent.length, key })
        })
      }

      fenceStart = -1
      fenceLang = ''
    })
  }

  return problems
}

const [commands, { keys: configKeys, openMaps }] = await Promise.all([readCliSurface(), readConfigKeys()])

const files: Array<{ path: string, text: string }> = []
for (const pattern of ['README.md', 'CLAUDE.md', 'docs/**/*.md']) {
  for await (const path of new Glob(pattern).scan(ROOT))
    files.push({ path, text: await Bun.file(`${ROOT}${path}`).text() })
}

const problems = [
  ...checkCliClaims(files, commands),
  ...checkConfigClaims(files, configKeys, openMaps),
]

if (problems.length === 0) {
  console.log(`✓ ${files.length} pages agree with ${commands.size} commands and ${configKeys.size} config keys`)
  process.exit(0)
}

const byFile = new Map<string, Problem[]>()
for (const problem of problems)
  byFile.set(problem.file, [...(byFile.get(problem.file) ?? []), problem])

for (const [file, found] of [...byFile].sort()) {
  console.error(`\n${file}`)
  for (const { line, message } of found)
    console.error(`  ${line}: ${message}`)
}

console.error(`\n✗ ${problems.length} claim(s) in ${byFile.size} file(s) do not match the source.`)
console.error('  Fix the documentation, or the code it describes — do not silence this check.')
process.exit(1)
