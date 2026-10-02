import type { FileChange } from '../src/types'
import { describe, expect, it, spyOn } from 'bun:test'
import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { gitAuthConfigArgs, GitHubProvider, isWorkflowPermissionRefusal, WorkflowPermissionError } from '../src/git/github-provider'

/**
 * A token can exist and still be refused for `.github/workflows/`: a GitHub
 * App without the Workflows permission, or a PAT without the workflow scope.
 * The push failed, the API fallback was refused for the same reason, and the
 * whole scheduled run went red on stacksjs/stacks every time.
 */

const REFUSAL = new Error(
  'Command failed with code 1: To https://github.com/acme/app\n ! [remote rejected] buddy/update-github-actions -> buddy/update-github-actions '
  + '(refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml` without `workflows` permission)',
)

const workflowFile: FileChange = { path: '.github/workflows/ci.yml', content: 'x', type: 'update' }
const manifest: FileChange = { path: 'package.json', content: '{}', type: 'update' }

function provider() {
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(console, 'warn').mockImplementation(() => {})
  const github = new GitHubProvider('token', 'acme', 'app', true, 'app-token') as any
  const gitCalls: FileChange[][] = []
  github.commitChangesWithGit = async (_branch: string, _message: string, files: FileChange[]) => {
    gitCalls.push(files)
    if (files.some(f => f.path.includes('.github/workflows/')))
      throw REFUSAL
  }
  github.commitChangesWithAPI = async () => {
    throw new Error('the API fallback must not run for a permission refusal')
  }
  return { github, gitCalls }
}

describe('a push refused for workflow files', () => {
  it('is recognised from the remote rejection', () => {
    expect(isWorkflowPermissionRefusal(REFUSAL)).toBe(true)
    expect(isWorkflowPermissionRefusal(new Error('! [remote rejected] main -> main (protected branch hook declined)'))).toBe(false)
  })

  it('reports a workflow-only change as a permission gap, without the API fallback', async () => {
    const { github } = provider()
    await expect(github.commitChanges('buddy/update-github-actions', 'chore', [workflowFile])).rejects.toBeInstanceOf(WorkflowPermissionError)
  })

  it('commits the rest of a mixed change without the workflow files', async () => {
    const { github, gitCalls } = provider()
    await github.commitChanges('buddy/update', 'chore', [workflowFile, manifest])

    expect(gitCalls).toHaveLength(2)
    expect(gitCalls[1]).toEqual([manifest])
  })
})

/**
 * Setting GITHUB_TOKEN in git's environment changes nothing: git sends the
 * header actions/checkout persisted. So "push with the workflow token" went
 * out as GITHUB_TOKEN, whose pushes trigger no workflows, and a refreshed PR
 * never re-ran CI.
 */
describe('git authentication for an override token', () => {
  it('resets the persisted header before adding its own', () => {
    const args = gitAuthConfigArgs('https://github.com', 'tok')
    expect(args).toEqual([
      '-c',
      'http.https://github.com/.extraheader=',
      '-c',
      `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from('x-access-token:tok').toString('base64')}`,
    ])
  })

  it('targets a GitHub Enterprise host when that is the server', () => {
    expect(gitAuthConfigArgs('https://git.example.com/', 'tok')[1]).toBe('http.https://git.example.com/.extraheader=')
  })

  it('pushes with BUDDY_TOKEN when there is one, so the push triggers CI', async () => {
    spyOn(console, 'log').mockImplementation(() => {})
    // commitChangesWithGit writes the changed files into the working tree, so
    // it runs in a scratch directory rather than over this repository.
    const cwd = process.cwd()
    const dir = mkdtempSync(join(tmpdir(), 'buddy-push-token-'))
    process.chdir(dir)
    try {
      const github = new GitHubProvider('github-token', 'acme', 'app', true, 'buddy-token') as any
      const calls: Array<{ args: string[], token?: string }> = []
      github.runCommand = async (_command: string, args: string[], token?: string) => {
        calls.push({ args, token })
        return args[0] === 'status' ? ' M package.json\n' : ''
      }
      await github.commitChangesWithGit('buddy/update', 'chore', [manifest], 'main').catch(() => {})

      const push = calls.find(call => call.args[0] === 'push')
      expect(push?.token).toBe('buddy-token')
    }
    finally {
      process.chdir(cwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
