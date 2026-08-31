import type { BuddyConfig } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { GitHubActionsTemplate } from '../src/templates/github-actions'

/**
 * `workflows.custom[].assignees` was declared, validated and documented, and
 * `generateCustomWorkflow` did not even accept the field; `reviewers` and
 * `labels` were accepted and then dropped by `generateWorkflow`. The workflow
 * runs `./buddy update` against the repository's own buddy.config.ts, so a
 * per-workflow override can only travel as a command-line flag — these assert
 * it does.
 */
describe('custom workflow personalisation', () => {
  it('success case - reviewers, assignees and labels become update flags', () => {
    const yaml = GitHubActionsTemplate.generateCustomWorkflow({
      name: 'Team Updates',
      schedule: '0 4 * * *',
      strategy: 'patch',
      reviewers: ['alice', 'bob'],
      assignees: ['carol'],
      labels: ['deps', 'automated'],
    })

    expect(yaml).toContain(`--reviewers 'alice,bob'`)
    expect(yaml).toContain(`--assignees 'carol'`)
    expect(yaml).toContain(`--labels 'deps,automated'`)
  })

  it('success case - both the dry-run and live invocations carry the flags', () => {
    const yaml = GitHubActionsTemplate.generateCustomWorkflow({
      name: 'Team Updates',
      schedule: '0 4 * * *',
      assignees: ['carol'],
    })

    // `./buddy update-check` also matches a bare 'update' substring.
    const invocations = yaml.split('\n').filter(line => line.includes('./buddy update --'))
    expect(invocations).toHaveLength(2)
    for (const line of invocations)
      expect(line).toContain(`--assignees 'carol'`)
  })

  it('edge case - no overrides means no flags', () => {
    const yaml = GitHubActionsTemplate.generateCustomWorkflow({
      name: 'Plain',
      schedule: '0 4 * * *',
    })

    expect(yaml).not.toContain('--reviewers')
    expect(yaml).not.toContain('--assignees')
    expect(yaml).not.toContain('--labels')
  })

  it('edge case - a quote in a name cannot escape the shell argument', () => {
    const yaml = GitHubActionsTemplate.generateCustomWorkflow({
      name: 'Hostile',
      schedule: '0 4 * * *',
      labels: [`a'; rm -rf /; '`],
    })

    const flag = /--labels '([^']*)'/.exec(yaml)
    expect(flag).not.toBeNull()
    expect(flag?.[1]).not.toContain(`'`)
  })

  it('failure case - global pullRequest settings are not frozen into the YAML', () => {
    // The runtime reads `pullRequest` from buddy.config.ts on every run;
    // baking today's values into the workflow file would shadow every later
    // config edit for as long as the file lives.
    const config: BuddyConfig = {
      pullRequest: { reviewers: ['global-reviewer'], labels: ['global-label'] },
    }

    const custom = GitHubActionsTemplate.generateCustomWorkflow(
      { name: 'Plain', schedule: '0 4 * * *' },
      config,
    )
    expect(custom).not.toContain('global-reviewer')
    expect(custom).not.toContain('global-label')

    const scheduled = GitHubActionsTemplate.generateScheduledWorkflows(config)
    expect(Object.keys(scheduled)).not.toHaveLength(0)
    for (const yaml of Object.values(scheduled)) {
      expect(yaml).not.toContain('global-reviewer')
      expect(yaml).not.toContain('global-label')
    }
  })
})
