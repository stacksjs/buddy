import { spawn } from 'node:child_process'

export interface SimpleFileUpdate { path: string, content: string }

async function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: 'pipe', cwd })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', d => (stdout += d.toString()))
    child.stderr?.on('data', d => (stderr += d.toString()))
    child.on('close', (code) => {
      if (code === 0)
        resolve(stdout)
      else reject(new Error(stderr || `git exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

/**
 * Compare generated file updates with the current content on a branch.
 * Returns true if any file differs, false if all are identical.
 *
 * It first tries branchName:path locally, then origin/branchName:path.
 */
export async function hasBranchDifferences(fileUpdates: SimpleFileUpdate[], branchName: string, cwd?: string): Promise<boolean> {
  for (const update of fileUpdates) {
    const cleanPath = update.path.replace(/^\.\//, '').replace(/^\/+/, '')

    // Try local branch
    try {
      const localContent = await runGit(['show', `${branchName}:${cleanPath}`], cwd)
      if (localContent !== update.content)
        return true
      continue
    }
    catch {}

    // Try remote branch
    try {
      const remoteContent = await runGit(['show', `origin/${branchName}:${cleanPath}`], cwd)
      if (remoteContent !== update.content)
        return true
      continue
    }
    catch {
      // If neither ref exists, conservatively treat as changed
      return true
    }
  }
  return false
}

/**
 * Commit the given paths and push them to the current branch.
 *
 * Used by the mechanical CI repair, which runs in a job that has already
 * checked the failing branch out with credentials. Deliberately not
 * `GitProvider.commitChanges`: that recreates a branch from its base, which is
 * right for a dependency update Buddy owns end to end and catastrophic here,
 * where the branch carries someone else's commits.
 *
 * @param paths - Repository-relative paths to stage
 * @param message - Commit message
 * @param cwd - Repository root (default: the current directory)
 * @returns Whether a commit was made and pushed
 * @example
 * ```ts
 * const pushed = await commitAndPush(['bun.lock'], 'fix(deps): regenerate the lock file')
 * ```
 */
export async function commitAndPush(paths: string[], message: string, cwd?: string): Promise<boolean> {
  if (paths.length === 0)
    return false

  await runGit(['add', '--', ...paths], cwd)

  // Nothing staged means the regeneration produced an identical file, which is
  // a success with nothing to record rather than a failure.
  const staged = await runGit(['diff', '--cached', '--name-only'], cwd)
  if (!staged.trim())
    return false

  await runGit(['commit', '-m', message], cwd)

  // The branch is whatever the job checked out. Pushing HEAD to it by name
  // avoids assuming an upstream is configured.
  const branch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
  await runGit(['push', 'origin', `HEAD:${branch}`], cwd)

  return true
}
