import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { detectPackageManager } from './helpers'
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
export function detectRequiredPackageManagers(updatedFilePaths: string[], cwd: string = process.cwd()): PackageManagerType[] {
  const managers: Set<PackageManagerType> = new Set()
  let pantryInputChanged = false

  for (const filePath of updatedFilePaths) {
    const fileName = filePath.split('/').pop() || ''

    if (fileName === 'package.json') {
      // Detect the JS package manager from lock files on disk
      managers.add(detectPackageManager(cwd))
      pantryInputChanged = true
    }

    if (fileName === 'composer.json') {
      managers.add('composer')
    }

    if (PANTRY_MANIFESTS.has(fileName))
      pantryInputChanged = true
  }

  if (pantryInputChanged && hasLockFile('pantry', cwd))
    managers.add('pantry')

  return Array.from(managers)
}

/**
 * The lock file a manager writes in this project, or null when it has none.
 */
export function lockFileFor(packageManager: PackageManagerType, cwd: string): string | null {
  const candidates: Record<PackageManagerType, string[]> = {
    bun: ['bun.lock', 'bun.lockb'],
    npm: ['package-lock.json'],
    yarn: ['yarn.lock'],
    pnpm: ['pnpm-lock.yaml'],
    composer: ['composer.lock'],
    pantry: ['pantry.lock'],
  }
  return candidates[packageManager].find(name => existsSync(`${cwd}/${name}`)) ?? null
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
export function missingLockFiles(changedPaths: string[], cwd: string = process.cwd()): string[] {
  const changed = new Set(changedPaths.map(path => path.replace(/^\.\//, '')))
  return detectRequiredPackageManagers(changedPaths, cwd)
    .map(manager => lockFileFor(manager, cwd))
    .filter((lockFile): lockFile is string => lockFile !== null && !changed.has(lockFile))
}

/**
 * Check if a lock file exists for a given package manager in the working directory
 */
export function hasLockFile(packageManager: PackageManagerType, cwd: string): boolean {
  const path = require('node:path')

  switch (packageManager) {
    case 'bun':
      return existsSync(path.join(cwd, 'bun.lock')) || existsSync(path.join(cwd, 'bun.lockb'))
    case 'npm':
      return existsSync(path.join(cwd, 'package-lock.json'))
    case 'yarn':
      return existsSync(path.join(cwd, 'yarn.lock'))
    case 'pnpm':
      return existsSync(path.join(cwd, 'pnpm-lock.yaml'))
    case 'composer':
      return existsSync(path.join(cwd, 'composer.lock'))
    case 'pantry':
      return existsSync(path.join(cwd, 'pantry.lock'))
  }
}
