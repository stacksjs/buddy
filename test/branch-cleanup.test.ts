import { describe, expect, it } from 'bun:test'
import { GitHubProvider } from '../src/git/github-provider'
import { Logger } from '../src/utils/logger'

/** A provider whose git commands are scripted, recording what was run. */
function provider(script: (args: string[]) => Promise<string>) {
  const prov = new GitHubProvider('token', 'owner', 'repo', false, undefined, 'https://api.github.test', Logger.silent())
  const ran: string[][] = []
  ;(prov as never as { runCommand: (cmd: string, args: string[]) => Promise<string> }).runCommand
    = async (_cmd, args) => {
      ran.push(args)
      return script(args)
    }
  return { prov, ran }
}

/**
 * `deleteBranch` swallowed every failure "because branch deletion failures are
 * not critical" — so `cleanupStaleBranches`, whose per-branch `catch` fills the
 * `failed` bucket, could never reach it. Every branch was reported deleted
 * whether the push succeeded or not, and `buddy update-check` printed
 * "N branches deleted, 0 failed" over a remote that still had them.
 */
describe('deleting a branch', () => {
  it('success case - a successful push resolves', async () => {
    const { prov, ran } = provider(async () => '')

    await expect(prov.deleteBranch('buddy/update-x')).resolves.toBeUndefined()
    expect(ran[0]).toEqual(['push', 'origin', '--delete', 'buddy/update-x'])
  })

  it('failure case - a refused push is reported, not swallowed', async () => {
    // No permission, network, protected branch: the caller asked for a
    // deletion and did not get one. GitLab and Bitbucket already throw here.
    const { prov } = provider(async (args) => {
      if (args[0] === 'push')
        throw new Error('remote: error: GH006: Protected branch update failed')
      return ''
    })

    await expect(prov.deleteBranch('main')).rejects.toThrow('Protected branch')
  })

  it('edge case - a branch that is already gone counts as deleted', async () => {
    // The outcome the caller wanted has already happened. Failing cleanup
    // over it would leave the same branch "failing" on every run.
    const { prov } = provider(async (args) => {
      if (args[0] === 'push')
        throw new Error("error: unable to delete 'buddy/old': remote ref does not exist")
      return ''
    })

    await expect(prov.deleteBranch('buddy/old')).resolves.toBeUndefined()
  })

  it('success case - the local tracking branch is tidied even when the push fails', async () => {
    const { prov, ran } = provider(async (args) => {
      if (args[0] === 'push')
        throw new Error('fatal: could not read from remote')
      return ''
    })

    await prov.deleteBranch('buddy/x').catch(() => {})

    expect(ran.some(args => args[0] === 'branch' && args[1] === '-D')).toBe(true)
  })
})
