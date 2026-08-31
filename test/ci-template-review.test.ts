import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateCoreWorkflows, getWorkflowPreset } from '../src/setup'
import { Logger } from '../src/utils/logger'

/**
 * `ciTemplateFor` took a `{ review }` option and its only call site never
 * passed it, so a GitLab or Bitbucket repository set up by `buddy setup` got
 * a pipeline that scheduled updates and never reviewed a merge request. The
 * GitHub workflow has always carried the review job.
 */
describe('generated GitLab and Bitbucket pipelines', () => {
  let dir: string
  let originalCwd: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'buddy-pipeline-'))
    originalCwd = process.cwd()
    process.chdir(dir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('success case - the GitLab pipeline carries the review job', async () => {
    await generateCoreWorkflows(
      getWorkflowPreset('standard'),
      { owner: 'group', name: 'repo', provider: 'gitlab' },
      false,
      Logger.silent(),
    )

    const pipeline = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')

    expect(pipeline).toContain('buddy:review:')
    expect(pipeline).toContain('buddy review $CI_MERGE_REQUEST_IID')
  })

  it('success case - the Bitbucket pipeline carries the review step', async () => {
    await generateCoreWorkflows(
      getWorkflowPreset('standard'),
      { owner: 'workspace', name: 'repo', provider: 'bitbucket' },
      false,
      Logger.silent(),
    )

    const pipeline = await fs.readFile(join(dir, 'bitbucket-pipelines.yml'), 'utf-8')

    expect(pipeline).toContain('buddy review $BITBUCKET_PR_ID')
  })
})
