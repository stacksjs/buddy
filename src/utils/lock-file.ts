import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { getDefaultLogger } from './logger'

export type PackageManagerType = 'bun' | 'npm' | 'yarn' | 'pnpm' | 'composer' | 'pantry'

export interface LockFileResult {
  success: boolean
  packageManager: PackageManagerType
  message: string
}

/**
 * All lock file names that may need to be staged after regeneration
 */
export function getAllLockFilePaths(): string[] {
  return [
    'bun.lock',
    'bun.lockb',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'pantry.lock',
  ]
}

/**
 * Get the install command for a given package manager
 */
function getInstallCommand(packageManager: PackageManagerType): { command: string, args: string[] } {
  switch (packageManager) {
    case 'bun':
      return { command: 'bun', args: ['install'] }
    case 'npm':
      return { command: 'npm', args: ['install'] }
    case 'yarn':
      return { command: 'yarn', args: ['install'] }
    case 'pnpm':
      return { command: 'pnpm', args: ['install'] }
    case 'composer':
      return { command: 'composer', args: ['update', '--lock'] }
    case 'pantry':
      // Scripts are skipped because a project's postinstall is not lockfile
      // work: in a Stacks app it seeds the local database.
      return { command: 'pantry', args: ['install', '--ignore-scripts', '--quiet'] }
  }
}

/**
 * Regenerate lock file by running the appropriate install command.
 * Non-fatal: catches errors, logs warnings, returns a result object.
 * @param packageManager - The package manager to use
 * @param cwd - Working directory to run the command in
 * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
 */
export async function regenerateLockFile(
  packageManager: PackageManagerType,
  cwd: string,
  timeoutMs: number = 5 * 60 * 1000,
): Promise<LockFileResult> {
  const { command, args } = getInstallCommand(packageManager)

  getDefaultLogger().info(`🔄 Regenerating lock file with ${packageManager} (${command} ${args.join(' ')})...`)

  return new Promise<LockFileResult>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        CI: 'true',
      },
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timeout = setTimeout(() => {
      killed = true
      getDefaultLogger().warn(`⚠️ ${packageManager} install timed out after ${timeoutMs / 1000}s, sending SIGTERM...`)
      child.kill('SIGTERM')

      // Escalate to SIGKILL after 10 seconds
      setTimeout(() => {
        if (!child.killed) {
          getDefaultLogger().warn(`⚠️ ${packageManager} install did not exit after SIGTERM, sending SIGKILL...`)
          child.kill('SIGKILL')
        }
      }, 10_000)
    }, timeoutMs)

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (killed) {
        resolve({
          success: false,
          packageManager,
          message: `Lock file regeneration timed out after ${timeoutMs / 1000}s`,
        })
        return
      }

      if (code === 0) {
        getDefaultLogger().info(`✅ Lock file regenerated successfully with ${packageManager}`)
        resolve({
          success: true,
          packageManager,
          message: `Lock file regenerated successfully`,
        })
      }
      else {
        getDefaultLogger().warn(`⚠️ ${packageManager} install exited with code ${code}`)
        if (stderr)
          getDefaultLogger().warn(`   stderr: ${stderr.slice(0, 500)}`)
        resolve({
          success: false,
          packageManager,
          message: `Install exited with code ${code}: ${stderr.slice(0, 200)}`,
        })
      }
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      getDefaultLogger().warn(`⚠️ Failed to run ${command}: ${error.message}`)
      resolve({
        success: false,
        packageManager,
        message: `Failed to run ${command}: ${error.message}`,
      })
    })
  })
}

/**
 * Pantry's own manifests. A change to one of these only reaches `pantry.lock`.
 */
const PANTRY_MANIFESTS = new Set(['deps.yaml', 'deps.yml', 'pantry.jsonc', 'pantry.json', 'pantry.toml'])
const JS_PACKAGE_MANAGERS = ['bun', 'pnpm', 'yarn', 'npm'] as const
type FileExists = (path: string) => boolean

/** Whether changing this manifest can invalidate a dependency lockfile. */
export function isLockfileManifest(path: string): boolean {
  const name = path.split('/').at(-1) ?? ''
  return name === 'package.json' || name === 'composer.json' || PANTRY_MANIFESTS.has(name)
}

/**
 * Examine which manifest files were updated to determine which package managers
 * need lock file regeneration.
 *
 * `pantry.lock` records npm resolutions alongside system packages, so a
 * `package.json` bump leaves it describing the old version just as surely as
 * `bun.lock`. Pantry is therefore required whenever the project has a
 * `pantry.lock` and any manifest it reads changed, and it is ordered last:
 * it reconciles against the JS lockfile, which has to be regenerated first.
 *
 * @param updatedFilePaths - List of file paths that were updated
 * @param cwd - Project root whose lock files decide the managers
 */
export function detectRequiredPackageManagers(updatedFilePaths: string[], cwd: string = process.cwd(), exists: FileExists = existsSync): PackageManagerType[] {
  const managers: Set<PackageManagerType> = new Set()
  let pantryInputChanged = false

  for (const filePath of updatedFilePaths) {
    const fileName = filePath.split('/').pop() || ''

    if (fileName === 'package.json') {
      // Detect the JS package manager from lock files on disk
      managers.add(JS_PACKAGE_MANAGERS.find(manager => lockFileFor(manager, cwd, exists)) ?? 'bun')
      pantryInputChanged = true
    }

    if (fileName === 'composer.json') {
      managers.add('composer')
    }

    if (PANTRY_MANIFESTS.has(fileName))
      pantryInputChanged = true
  }

  if (pantryInputChanged && lockFileFor('pantry', cwd, exists))
    managers.add('pantry')

  return Array.from(managers)
}

/** A project nested inside the repository with a lock file of its own. */
export interface NestedLockProject {
  /** Directory relative to the repository root, e.g. `bench/routing` */
  dir: string
  /** JS package manager that owns the lock file there */
  manager: PackageManagerType
  /** Lock file path relative to the repository root */
  lockFile: string
}

/**
 * Projects whose own lock file a manifest change requires regenerating.
 *
 * Workspace members share the root lock file, so they need nothing here. A
 * package.json that sits beside its OWN lock file (a benchmark, an example
 * app, a docs site) is a separate install: regenerating only the root left its
 * lock behind, and a frozen install of that directory failed CI
 * (stacksjs/stacks bench/routing).
 *
 * @param updatedFilePaths - Paths a change touches, relative to the root
 * @param cwd - Repository root
 */
export function nestedLockProjects(updatedFilePaths: string[], cwd: string = process.cwd(), exists: FileExists = existsSync): NestedLockProject[] {
  const projects = new Map<string, NestedLockProject>()
  for (const filePath of updatedFilePaths) {
    const clean = filePath.replace(/^\.\//, '')
    if (!clean.endsWith('package.json') || !clean.includes('/'))
      continue
    const dir = clean.slice(0, clean.lastIndexOf('/'))
    if (projects.has(dir))
      continue
    const absolute = join(cwd, dir)
    const manager = JS_PACKAGE_MANAGERS.find(candidate => lockFileFor(candidate, absolute, exists))
    if (!manager)
      continue
    const lockFile = lockFileFor(manager, absolute, exists)
    if (lockFile)
      projects.set(dir, { dir, manager, lockFile: `${dir}/${lockFile}` })
  }
  return [...projects.values()]
}

/**
 * The lock file a manager writes in this project, or null when it has none.
 */
export function lockFileFor(packageManager: PackageManagerType, cwd: string, exists: FileExists = existsSync): string | null {
  const candidates: Record<PackageManagerType, string[]> = {
    bun: ['bun.lock', 'bun.lockb'],
    npm: ['package-lock.json'],
    yarn: ['yarn.lock'],
    pnpm: ['pnpm-lock.yaml'],
    composer: ['composer.lock'],
    pantry: ['pantry.lock'],
  }
  return candidates[packageManager].find(name => exists(join(cwd, name))) ?? null
}

/**
 * Lock files a pull request should have regenerated but does not change.
 *
 * A pull request opened by an older release, or by a run whose regeneration
 * was skipped, carries manifests its lock files do not match. Its updates
 * still "match", so it was left alone and stayed red; this is the evidence
 * that it needs refreshing. Only lock files the project has are expected.
 *
 * @param changedPaths - Paths the pull request changes
 * @param cwd - Project root whose lock files decide what is expected
 */
export function missingLockFiles(changedPaths: string[], cwd: string = process.cwd(), exists: FileExists = existsSync): string[] {
  const changed = new Set(changedPaths.map(path => path.replace(/^\.\//, '')))
  const nested = nestedLockProjects(changedPaths, cwd, exists)
  const nestedDirs = new Set(nested.map(project => project.dir))
  // A manifest inside a nested project needs only that project's lock file.
  const rootPaths = changedPaths.filter(path => !nestedDirs.has(path.replace(/^\.\//, '').replace(/\/package\.json$/, '')))
  const rootLocks = detectRequiredPackageManagers(rootPaths, cwd, exists)
    .map(manager => lockFileFor(manager, cwd, exists))
  const nestedLocks = nested.map(project => project.lockFile)
  return [...rootLocks, ...nestedLocks]
    .filter((lockFile): lockFile is string => lockFile !== null && !changed.has(lockFile))
}

/**
 * Check if a lock file exists for a given package manager in the working directory
 */
export function hasLockFile(packageManager: PackageManagerType, cwd: string): boolean {
  return lockFileFor(packageManager, cwd) !== null
}
