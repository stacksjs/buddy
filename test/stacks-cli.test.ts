import { describe, expect, it } from 'bun:test'
import process from 'node:process'
import { stacksArgs, stacksRuntimeCommand, stacksRuntimeVersion } from '../src/stacks-cli'

describe('Stacks runtime selection', () => {
  it('forwards the project selector and command flags unchanged', () => {
    expect(stacksArgs(['review', '--light'])).toBeUndefined()
    const args = ['--project', '../a b', 'dev', '--', '-p']
    expect(stacksArgs(['stacks', ...args])).toEqual(args)
    expect(stacksRuntimeCommand('/bin/bun', args)).toEqual([
      '/bin/bun', 'x', process.platform === 'win32' ? '--env-file=NUL' : '--env-file=/dev/null',
      '--package', `@stacksjs/buddy@${stacksRuntimeVersion}`, 'stacks', ...args,
    ])
  })

  it('pins the selected release without changing versions for other invocations', () => {
    const selected = ['@stacksjs/buddy@0.75.634', 'stacks', '--version']
    expect(stacksRuntimeCommand('bun', ['--runtime', '0.75.634', '--version']).slice(4)).toEqual(selected)
    expect(stacksRuntimeCommand('bun', ['--runtime=0.75.634', '--version']).slice(4)).toEqual(selected)
    expect(stacksRuntimeCommand('bun', ['--version'])[4]).toBe(`@stacksjs/buddy@${stacksRuntimeVersion}`)
    expect(() => stacksRuntimeCommand('bun', ['--runtime', 'latest', 'daemon:start'])).toThrow('exact Stacks version')
  })
})
