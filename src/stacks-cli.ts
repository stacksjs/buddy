import process from 'node:process'

// Buddy's machine commands use this tested release. Project commands are
// handed off by Stacks to the runtime installed in the selected project.
export const stacksRuntimeVersion = '0.75.636'

export function stacksArgs(args: string[]): string[] | undefined {
  if (args[0] === 'stacks' && args.length > 1)
    return args.slice(1)
}

export function stacksRuntimeCommand(bun: string, args: string[]): string[] {
  let version = stacksRuntimeVersion
  if (args[0] === '--runtime' || args[0]?.startsWith('--runtime=')) {
    const attached = args[0].startsWith('--runtime=')
    const selected = attached ? args[0].slice('--runtime='.length) : args[1]
    if (!selected || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(selected))
      throw new Error(`--runtime requires an exact Stacks version, such as ${stacksRuntimeVersion}.`)
    version = selected
    args = args.slice(attached ? 1 : 2)
  }

  const emptyEnvFile = process.platform === 'win32' ? 'NUL' : '/dev/null'
  return [bun, 'x', `--env-file=${emptyEnvFile}`, '--package', `@stacksjs/buddy@${version}`, 'stacks', ...args]
}

/** Use Bun's shared package cache so runtime versions can coexist on disk. */
export function runStacks(args: string[]): never {
  const bun = Bun.which('bun')
  if (!bun) {
    process.stderr.write('Buddy needs Bun on PATH to run Stacks commands. Install it from https://bun.sh.\n')
    process.exit(1)
  }

  try {
    const command = stacksRuntimeCommand(bun, args)
    if (typeof process.execve === 'function')
      process.execve(bun, command, process.env as Record<string, string>)

    const child = Bun.spawnSync(command, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
    process.exit(child.exitCode ?? 1)
  }
  catch (error) {
    process.stderr.write(`[buddy stacks] ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}
