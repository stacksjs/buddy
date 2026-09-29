import type { Dependency, PackageFile, PackageUpdate } from '../types'
import { resolveDependencyFile } from 'ts-pantry'
import { getDefaultLogger } from './logger'

/**
 * Check if a file path is a dependency file that we can handle
 */
export function isDependencyFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || ''
  const dependencyFileNames = ['deps.yaml', 'dependencies.yaml', 'pkgx.yaml', '.deps.yaml']

  // Check for exact matches
  if (dependencyFileNames.includes(fileName)) {
    return true
  }

  // Check for .yml variants
  const baseNameWithoutExt = fileName.replace(/\.(yaml|yml)$/, '')
  return ['deps', 'dependencies', 'pkgx', '.deps'].includes(baseNameWithoutExt)
}

/**
 * Parse a dependency file using ts-pantry (supports pkgx registry format)
 */
export async function parseDependencyFile(filePath: string, content: string): Promise<PackageFile | null> {
  try {
    if (!isDependencyFile(filePath)) {
      return null
    }

    let dependencies: Dependency[] = []

    try {
      // Use ts-pantry to resolve the dependency file
      const resolvedDeps = await resolveDependencyFile(filePath)

      if (resolvedDeps && typeof resolvedDeps === 'object') {
        // Parse dependencies from the resolved structure
        // ts-pantry returns allDependencies array instead of separate sections
        if (resolvedDeps.allDependencies && Array.isArray(resolvedDeps.allDependencies)) {
          for (const dep of resolvedDeps.allDependencies) {
            if (dep.name && dep.constraint) {
              dependencies.push({
                name: dep.name,
                currentVersion: dep.constraint,
                type: 'dependencies', // ts-pantry doesn't distinguish between dep types for this registry
                file: filePath,
              })
            }
          }
        }
      }
    }
    catch (pkgxError) {
      getDefaultLogger().warn(`ts-pantry failed to parse ${filePath}, attempting fallback YAML parsing:`, pkgxError)
    }

    // Fallback: if ts-pantry returned no dependencies (either threw or returned empty),
    // try the simple YAML parser which works without the pantry registry
    if (dependencies.length === 0) {
      try {
        dependencies = await parseSimpleYamlDependencies(content, filePath)
      }
      catch (yamlError) {
        getDefaultLogger().warn(`Fallback YAML parsing failed for ${filePath}:`, yamlError)
        dependencies = []
      }
    }

    const fileName = filePath.split('/').pop() || ''
    return {
      path: filePath,
      type: fileName as PackageFile['type'],
      content,
      dependencies,
    }
  }
  catch (error) {
    getDefaultLogger().warn(`Failed to parse dependency file ${filePath}:`, error)
    return null
  }
}

/**
 * Simple YAML parser for basic dependencies structure
 * Fallback when ts-pantry fails
 */
async function parseSimpleYamlDependencies(content: string, filePath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = []

  // Simple line-by-line parsing for basic YAML structure
  const lines = content.split('\n')
  let inDependenciesSection = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === 'dependencies:') {
      inDependenciesSection = true
      continue
    }

    if (inDependenciesSection) {
      // If we hit a non-indented line, we're out of dependencies section
      if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
        inDependenciesSection = false
        continue
      }

      // Parse dependency line: "  package-name: ^1.0.0"
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      const depMatch = trimmed.match(/^([\w@/-]+):\s*(.+)$/)
      if (depMatch) {
        const [, name, version] = depMatch
        dependencies.push({
          name: name.trim(),
          currentVersion: version.trim(),
          type: 'dependencies',
          file: filePath,
        })
      }
    }
  }

  return dependencies
}

/**
 * Does this content parse as YAML?
 *
 * Used as a guard around rewrites rather than as a parser: the result is only
 * ever compared before and after, so a file that never parsed is not penalised.
 */
function parsesAsYaml(content: string): boolean {
  try {
    Bun.YAML.parse(content)
    return true
  }
  catch {
    return false
  }
}

/**
 * Update dependency file content with new package versions
 */
export async function updateDependencyFile(filePath: string, content: string, updates: PackageUpdate[]): Promise<string> {
  try {
    if (!isDependencyFile(filePath)) {
      getDefaultLogger().info(`⚠️ updateDependencyFile: ${filePath} is not a dependency file, returning original content`)
      return content
    }

    // Extra safety check: ensure we're not accidentally processing non-YAML content
    if (content.trim().startsWith('{') && content.includes('"require"')) {
      getDefaultLogger().info(`⚠️ updateDependencyFile: Content appears to be JSON (composer.json), but file is ${filePath}`)
      getDefaultLogger().info(`Content preview: ${content.substring(0, 200)}`)
      return content // Don't process JSON content in YAML function
    }

    let updatedContent = content

    // Apply updates using string replacement to preserve formatting
    for (const update of updates) {
      // Clean package name (remove dependency type info like "(dev)")
      const cleanPackageName = update.name.replace(/\s*\(dev\)$/, '').replace(/\s*\(peer\)$/, '').replace(/\s*\(optional\)$/, '')
      const escapedName = cleanPackageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      // Anchor to a key at the start of a line.
      //
      // The previous pattern was `(\s*\bNAME\b\s*:\s*)(...)`, which matched the
      // package name anywhere in the file - including inside a prose comment -
      // and whose leading `\s*` reached back across the newline before the real
      // key. Both halves were needed to corrupt a file, and both are gone: `^`
      // with the `m` flag pins the match to a key position, and the indent is
      // `[ \t]*`, which cannot cross a line. A commented-out key (`# redis: ^7`)
      // and a quoted neighbour (`"@types/node"` when updating `node`) no longer
      // match either, because neither starts with the name. stacksjs/buddy#1453
      //
      // Deliberately not anchored at the end, so a CRLF file still matches.
      //
      // Groups: 1 indent, 2 key including any quotes, 3 colon and its spacing,
      // 4 quote around the value, 5 version, 6 inline comment.
      const packageRegex = new RegExp(
        `^([ \\t]*)("${escapedName}"|'${escapedName}'|${escapedName})([ \\t]*:[ \\t]*)(["']?)([^\\s#"']+)\\4([ \\t]*#[^\\r\\n]*)?`,
        'gm',
      )

      // A replacer function, so every match is rewritten from its own captures.
      //
      // The previous code read the first match, built one replacement string
      // from it, and handed that literal to `String.replace` with a `g` regex -
      // writing the first occurrence's version over every other occurrence.
      updatedContent = updatedContent.replace(
        packageRegex,
        (
          fullMatch: string,
          indent: string,
          key: string,
          separator: string,
          quote: string,
          currentVersionInFile: string,
          commentPart?: string,
        ) => {
          // Check if current version should be respected (like "*", "latest", etc.)
          const dynamicIndicators = ['latest', '*', 'main', 'master', 'develop', 'dev']
          if (dynamicIndicators.includes(currentVersionInFile.toLowerCase().trim())) {
            getDefaultLogger().info(`⚠️ Skipping update for ${cleanPackageName} - version "${currentVersionInFile}" should be respected`)
            return fullMatch
          }

          // Extract the original version prefix (^, ~, >=, etc.) or lack thereof
          const originalPrefix = currentVersionInFile.match(/^(\D*)/)?.[1] ?? ''

          // Check if newVersion already has a prefix (to avoid double prefixes)
          const newVersionHasPrefix = /^[\^~>=<]/.test(update.newVersion)

          // Use newVersion as-is if it already has a prefix, otherwise preserve original prefix
          const finalVersion = newVersionHasPrefix ? update.newVersion : `${originalPrefix}${update.newVersion}`

          return `${indent}${key}${separator}${quote}${finalVersion}${quote}${commentPart ?? ''}`
        },
      )
    }

    // A corrupted write is worse than a missed update. These files are committed
    // by a bot, and a deps.yaml that no longer parses fails `Setup Pantry` before
    // any job in the workflow runs - so nothing downstream is left to catch it.
    //
    // Only bail when this function is what broke it: a file that already did not
    // parse is left to whatever it was doing before. stacksjs/buddy#1453
    if (updatedContent !== content && parsesAsYaml(content) && !parsesAsYaml(updatedContent)) {
      getDefaultLogger().warn(`⚠️ Skipping updates for ${filePath}: the rewrite no longer parses as YAML, so the file is left unchanged`)
      return content
    }

    return updatedContent
  }
  catch (error) {
    getDefaultLogger().warn(`Failed to update dependency file ${filePath}:`, error)
    return content
  }
}

/**
 * Generate file changes for dependency files
 */
export async function generateDependencyFileUpdates(updates: PackageUpdate[]): Promise<Array<{ path: string, content: string, type: 'update' }>> {
  const fileUpdates: Array<{ path: string, content: string, type: 'update' }> = []

  // Group updates by file
  const updatesByFile = new Map<string, PackageUpdate[]>()

  for (const update of updates) {
    if (isDependencyFile(update.file)) {
      if (!updatesByFile.has(update.file)) {
        updatesByFile.set(update.file, [])
      }
      updatesByFile.get(update.file)!.push(update)
    }
  }

  // Process each file
  for (const [filePath, packageUpdates] of updatesByFile) {
    try {
      // Read current file content
      const fs = await import('node:fs')
      if (fs.existsSync(filePath)) {
        const currentContent = fs.readFileSync(filePath, 'utf-8')
        const updatedContent = await updateDependencyFile(filePath, currentContent, packageUpdates)

        // Only add file update if content actually changed
        if (updatedContent !== currentContent) {
          fileUpdates.push({
            path: filePath,
            content: updatedContent,
            type: 'update',
          })
          getDefaultLogger().info(`✅ Generated update for ${filePath} with ${packageUpdates.length} package changes`)
        }
        else {
          getDefaultLogger().info(`ℹ️ No changes needed for ${filePath} - versions already up to date`)
        }
      }
      else {
        getDefaultLogger().warn(`⚠️ Dependency file ${filePath} does not exist`)
      }
    }
    catch (error) {
      getDefaultLogger().warn(`Failed to generate updates for dependency file ${filePath}:`, error)
    }
  }

  return fileUpdates
}
