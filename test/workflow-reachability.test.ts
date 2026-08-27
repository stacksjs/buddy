import { describe, expect, it } from 'bun:test'
import { generateUnifiedWorkflow } from '../src/setup'

interface Job { if?: string, needs?: string | string[] }
interface Workflow { jobs: Record<string, Job> }

const workflow = Bun.YAML.parse(generateUnifiedWorkflow(false)) as Workflow

/**
 * Evaluate the subset of GitHub's expression syntax this workflow uses.
 *
 * Rewritten to JavaScript rather than interpreted, because the operators in
 * play — `==`, `!=`, `&&`, `||` — mean the same thing in both, and the only
 * real differences are `always()` and the hyphen in `determine-jobs`, which
 * JavaScript cannot address with a dot.
 */
function evaluate(expression: string | undefined, ctx: Record<string, unknown>): boolean {
  if (!expression)
    return true

  const body = expression
    .replace(/^\$\{\{/, '')
    .replace(/\}\}$/, '')
    .replace(/always\(\)/g, 'true')
    .replace(/!cancelled\(\)/g, 'true')
    .replace(/needs\.determine-jobs\./g, 'c.needs["determine-jobs"].')
    .replace(/(?<!c\.)\bneeds\./g, 'c.needs.')
    .replace(/(?<!c\.)\bgithub\./g, 'c.github.')

  // eslint-disable-next-line no-new-func
  return Boolean(new Function('c', `return (${body})`)(ctx))
}

/**
 * What `determine-jobs` decides for an event, and what `setup` then does.
 *
 * The outputs are stated per event rather than read out of the shell script:
 * the bug this guards against is not in what the router decides, it is in
 * whether the jobs it decided for can actually start.
 */
function context(github: Record<string, unknown>, outputs: Record<string, string>) {
  const full = {
    run_check: 'false',
    run_update: 'false',
    run_dashboard: 'false',
    run_command: 'false',
    run_review: 'false',
    run_fixci: 'false',
    run_report: 'false',
    ...outputs,
  }

  const ctx = {
    github,
    needs: {
      'determine-jobs': {
        outputs: { ...full, run_any: Object.values(full).includes('true') ? 'true' : 'false' },
        result: 'success',
      },
      'setup': { result: 'success' },
    },
  }

  return ctx
}

/** Whether a job actually starts: its own gate, and every job it needs. */
function runs(name: string, ctx: Record<string, unknown>): boolean {
  const job = workflow.jobs[name]
  const needs = job.needs ? [job.needs].flat() : []
  const gated = evaluate(job.if, ctx)

  // A job whose dependency was skipped is skipped with it, unless its own
  // condition contains a status function. That is the whole defect.
  const skipsWithNeeds = !/always\(\)|!cancelled\(\)/.test(job.if ?? '')
  const needsRun = needs.every(dep => dep === 'determine-jobs' || runs(dep, ctx))

  return gated && (needsRun || !skipsWithNeeds)
}

/**
 * `setup` is a dependency of every job in the generated workflow, and a job
 * whose `needs` was skipped is skipped with it. Its condition named four of
 * the eleven gates, so the seven it did not name could never start — the
 * review, the @buddy commands, CI repair, the pre-merge gate, the finishing
 * touches, the post-merge step and the issue quick-links.
 *
 * #1412 fixed exactly this for the health report and did not check its
 * siblings. This suite is what would have caught that.
 */
describe('generated workflow reachability', () => {
  const cases: Array<{ event: string, github: Record<string, unknown>, outputs: Record<string, string>, expect: string[] }> = [
    {
      event: 'pull request opened',
      github: { event_name: 'pull_request', event: { action: 'opened', pull_request: { draft: false, merged: false } } },
      outputs: { run_review: 'true' },
      expect: ['review', 'gate'],
    },
    {
      event: 'pull request synchronized',
      github: { event_name: 'pull_request', event: { action: 'synchronize', pull_request: { draft: false, merged: false } } },
      outputs: { run_review: 'true' },
      expect: ['review', 'gate'],
    },
    {
      event: 'buddy pull request edited',
      github: { event_name: 'pull_request', event: { action: 'edited', pull_request: { draft: false, merged: false } } },
      outputs: { run_check: 'true' },
      expect: ['check', 'touch', 'gate'],
    },
    {
      event: 'pull request merged',
      github: { event_name: 'pull_request', event: { action: 'closed', pull_request: { draft: false, merged: true } } },
      outputs: {},
      expect: ['post-merge'],
    },
    {
      event: '@buddy comment',
      github: { event_name: 'issue_comment', event: { action: 'created' } },
      outputs: { run_command: 'true' },
      expect: ['command'],
    },
    {
      event: 'failing run on a buddy branch',
      github: { event_name: 'workflow_run', event: { action: 'completed', workflow_run: { conclusion: 'failure' } } },
      outputs: { run_fixci: 'true' },
      expect: ['fix-ci'],
    },
    {
      event: 'issue opened',
      github: { event_name: 'issues', event: { action: 'opened' } },
      outputs: {},
      expect: ['issue-links'],
    },
    {
      event: 'scheduled update',
      github: { event_name: 'schedule', event: { schedule: '0 9 * * 1,3,5' } },
      outputs: { run_update: 'true', run_dashboard: 'true' },
      expect: ['dependency-update', 'dashboard-update'],
    },
    {
      event: 'weekly health report',
      github: { event_name: 'schedule', event: { schedule: '0 9 * * 1' } },
      outputs: { run_report: 'true' },
      expect: ['report'],
    },
  ]

  for (const testCase of cases) {
    it(`success case - ${testCase.event} reaches ${testCase.expect.join(', ')}`, () => {
      const ctx = context(testCase.github, testCase.outputs)

      // Named first: everything downstream depends on it, and it is where the
      // whole family of jobs was being lost.
      expect(runs('setup', ctx)).toBe(true)

      for (const job of testCase.expect)
        expect({ job, runs: runs(job, ctx) }).toEqual({ job, runs: true })
    })
  }

  it('failure case - ordinary discussion starts nothing', () => {
    // The workflow triggers on every comment created. A comment that does not
    // mention the bot must not pay for a checkout and an install.
    const ctx = context(
      { event_name: 'issue_comment', event: { action: 'created' } },
      {},
    )

    expect(runs('setup', ctx)).toBe(false)
    expect(runs('command', ctx)).toBe(false)
  })

  it('failure case - a green run starts nothing', () => {
    const ctx = context(
      { event_name: 'workflow_run', event: { action: 'completed', workflow_run: { conclusion: 'success' } } },
      {},
    )

    expect(runs('setup', ctx)).toBe(false)
    expect(runs('fix-ci', ctx)).toBe(false)
  })

  it('success case - every job that needs setup is reachable on some event', () => {
    // The structural version of the same claim: a job nothing can ever start
    // is a job that should not have been generated.
    const dependents = Object.entries(workflow.jobs)
      .filter(([, job]) => [job.needs ?? []].flat().includes('setup'))
      .map(([name]) => name)

    const reachable = new Set(
      cases.flatMap(testCase => {
        const ctx = context(testCase.github, testCase.outputs)
        return dependents.filter(name => runs(name, ctx))
      }),
    )

    expect([...dependents].filter(name => !reachable.has(name))).toEqual([])
  })
})
