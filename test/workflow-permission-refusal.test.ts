import type { FileChange } from '../src/types'
import { describe, expect, it, spyOn } from 'bun:test'
import { GitHubProvider, isWorkflowPermissionRefusal, WorkflowPermissionError } from '../src/git/github-provider'

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
