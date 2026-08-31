import type { BuddyConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateConfig } from '../src/config-validation'
import { generateConfigFile, generateUnifiedWorkflow, getWorkflowPreset, schedulePlan } from '../src/setup'

interface Workflow {
  on: { schedule?: Array<{ cron: string }> }
  jobs: Record<string, { if?: string, needs?: string[], outputs?: Record<string, string> }>
}

function parse(useCase: string): Workflow {
  return Bun.YAML.parse(generateUnifiedWorkflow(false, getWorkflowPreset(useCase))) as Workflow
}

function crons(useCase: string): string[] {
  return (parse(useCase).on.schedule ?? []).map(entry => entry.cron)
}

/** The `determine-jobs` script, where a scheduled tick is matched to its jobs. */
function dispatchScript(useCase: string): string {
  const yaml = generateUnifiedWorkflow(false, getWorkflowPreset(useCase))
  return yaml.slice(yaml.indexOf('case "${{ github.event.schedule }}"'), yaml.indexOf('# Shared setup job'))
}

/**
 * `generateCoreWorkflows` took a preset and named the parameter `_preset`. Every
 * repository got the same workflow whichever of the eight a maintainer picked,
 * so the picker, the `--preset` flag and the setup summary all described a
 * choice that had no effect.
 */
describe('workflow presets', () => {
  describe('the schedule plan', () => {
    it('success case - a preset\'s own cadence reaches the workflow', () => {
      expect(crons('security')).toContain('0 */4 * * *')
      expect(crons('high-frequency')).toContain('0 6 * * *')
      expect(crons('standard')).toContain('0 9 1 * *')
      expect(crons('testing')).toContain('*/15 * * * *')
    })

    it('success case - two presets do not produce the same workflow', () => {
      // The regression this suite exists for.
      expect(crons('minimal')).not.toEqual(crons('high-frequency'))
    })

    it('success case - a cron shared by two jobs starts both', () => {
      // Monorepo puts updates and the dashboard on one expression. An if/elif
      // chain would let the first branch win and drop the dashboard entirely.
      const plan = schedulePlan(getWorkflowPreset('monorepo'))
      const shared = plan.find(entry => entry.cron === '0 9 * * *')

      expect(shared?.jobs).toEqual(['update', 'dashboard'])
      expect(crons('monorepo').filter(cron => cron === '0 9 * * *')).toHaveLength(1)
    })

    it('success case - a cron shared by three jobs starts all three', () => {
      // Minimal's weekly slot collides with the fixed health-report cron.
      const plan = schedulePlan(getWorkflowPreset('minimal'))

      expect(plan.find(entry => entry.cron === '0 9 * * 1')?.jobs)
        .toEqual(['update', 'dashboard', 'report'])
    })

    it('edge case - `manual` means no schedule, not a cron expression', () => {
      // `testing` and `custom` use it for the dashboard. Emitted verbatim it
      // would be YAML GitHub refuses to parse.
      expect(crons('testing')).not.toContain('manual')
      expect(crons('custom')).not.toContain('manual')
      expect(crons('custom')).toEqual(['0 4 * * *', '0 9 * * 1'])
    })

    it('success case - housekeeping runs whatever the preset asks for', () => {
      // A preset that could switch branch cleanup off would let stale
      // branches pile up silently.
      for (const useCase of ['standard', 'high-frequency', 'security', 'minimal', 'testing', 'custom'])
        expect(crons(useCase)).toContain('0 4 * * *')
    })

    it('edge case - an unknown preset falls back to standard', () => {
      expect(crons('nonsense')).toEqual(crons('standard'))
    })
  })

  describe('per-slot update strategies', () => {
    it('success case - a custom cadence is a real schedule slot with its own strategy', () => {
      const plan = schedulePlan(getWorkflowPreset('standard'))

      expect(plan.find(entry => entry.cron === '0 9 * * *')?.updateStrategy).toBe('patch')
      expect(plan.find(entry => entry.cron === '0 9 * * 1')?.updateStrategy).toBe('minor')
      expect(plan.find(entry => entry.cron === '0 9 1 * *')?.updateStrategy).toBe('major')
    })

    it('success case - the tick tells the update job which strategy fired', () => {
      const yaml = generateUnifiedWorkflow(false, getWorkflowPreset('standard'))

      expect(yaml).toContain('"0 9 1 * *")')
      expect(yaml).toContain('echo "update_strategy=major" >> $GITHUB_OUTPUT')
      expect(yaml).toContain('needs.determine-jobs.outputs.update_strategy')
    })

    it('success case - high-frequency is its four slots, not a fifth catch-all', () => {
      const plan = schedulePlan(getWorkflowPreset('high-frequency'))
      const updates = plan.filter(entry => entry.jobs.includes('update'))

      expect(updates.map(entry => entry.cron).sort()).toEqual(['0 0 * * *', '0 12 * * *', '0 18 * * *', '0 6 * * *'])
      // Midnight is the minor slot the preset describes as manual-review.
      expect(plan.find(entry => entry.cron === '0 0 * * *')?.updateStrategy).toBe('minor')
    })

    it('success case - security stops duplicating its own patch cadence', () => {
      const plan = schedulePlan(getWorkflowPreset('security'))

      expect(plan.some(entry => entry.cron === '0 */6 * * *')).toBe(false)
      expect(plan.find(entry => entry.cron === '0 */4 * * *')?.updateStrategy).toBe('patch')
    })
  })

  describe('triggers and their matcher agree', () => {
    it('success case - every declared cron has a branch that runs something', () => {
      // A cron declared in `schedule:` with no matching branch starts a
      // workflow that does nothing at all — which is how the health report
      // came to be unreachable.
      for (const useCase of ['standard', 'high-frequency', 'security', 'minimal', 'testing', 'custom']) {
        const script = dispatchScript(useCase)

        for (const cron of crons(useCase))
          expect(script).toContain(`"${cron}")`)
      }
    })

    it('success case - every branch corresponds to a declared cron', () => {
      const script = dispatchScript('high-frequency')
      const matched = [...script.matchAll(/"([^"]+)"\)/g)].map(match => match[1])

      expect(matched.sort()).toEqual([...crons('high-frequency')].sort())
    })
  })

  describe('the dependency-health report', () => {
    it('success case - is reachable', () => {
      // It was gated on a cron literal that `determine-jobs` never matched, so
      // `setup` was skipped, and the report — which needs setup — was skipped
      // with it. The job was generated and could never once have run.
      const workflow = parse('standard')

      expect(workflow.jobs.report.if).toContain('run_report')
      expect(workflow.jobs['determine-jobs'].outputs).toHaveProperty('run_report')
    })

    it('success case - its setup dependency runs on a report-only tick', () => {
      // `report` needs `setup`, and a skipped dependency skips the job that
      // needs it. Asserted through the derived flag rather than by looking for
      // `run_report` in setup's condition — naming one output there is what
      // left the other seven jobs unreachable. See
      // test/workflow-reachability.test.ts for the per-event proof.
      expect(parse('standard').jobs.setup.if).toContain('run_any')
      expect(parse('standard').jobs['determine-jobs'].outputs).toHaveProperty('run_any')
    })
  })

  describe('update strategy', () => {
    it('success case - scheduled runs use the preset strategy', () => {
      const yaml = generateUnifiedWorkflow(false, getWorkflowPreset('testing'))

      expect(yaml).toContain(`github.event.inputs.strategy || needs.determine-jobs.outputs.update_strategy || 'patch'`)
    })

    it('success case - the manual trigger defaults to the same strategy', () => {
      // Two defaults that disagree would make a manual run behave unlike the
      // scheduled one it is meant to stand in for.
      const yaml = generateUnifiedWorkflow(false, getWorkflowPreset('testing'))

      expect(yaml).toContain('default: patch')
    })
  })
})


/**
 * The config file discarded the preset too: `strategy` was hardcoded to
 * `'all'`, the templates to the standard set, and `autoMerge` — the one field
 * that changes whether pull requests merge themselves — reached nothing at all.
 */
describe('the generated config file', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'buddy-preset-'))
    originalCwd = process.cwd()
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(testDir, { recursive: true, force: true })
  })

  /** Generate for a preset and load the result back as a real module. */
  async function generated(useCase: string): Promise<BuddyConfig> {
    await generateConfigFile({ owner: 'o', name: 'r' }, false, getWorkflowPreset(useCase))

    // Imported rather than string-matched: this proves the file setup wrote is
    // valid TypeScript that evaluates to a config, not merely that it contains
    // the right substrings.
    const module = await import(`${join(testDir, 'buddy.config.ts')}?t=${useCase}`)
    return module.default as BuddyConfig
  }

  it('success case - is a valid config for every preset', async () => {
    for (const useCase of ['standard', 'high-frequency', 'security', 'minimal', 'docker', 'monorepo', 'testing', 'custom'])
      expect(validateConfig(await generated(useCase))).toEqual([])
  })

  it('success case - the update strategy comes from the preset', async () => {
    expect((await generated('testing')).packages?.strategy).toBe('patch')
    // Standard's main slot is the daily-patch cadence its description names.
    expect((await generated('standard')).packages?.strategy).toBe('patch')
  })

  it('success case - the preset\'s custom workflows reach the config', async () => {
    // `buddy generate-workflows` reads these, so a preset that declares them
    // and a config that drops them means the workflows are never written.
    const custom = (await generated('security')).workflows?.custom ?? []

    expect(custom.map(workflow => workflow.name)).toEqual(['weekly-minor'])
    expect(custom[0].schedule).toBe('0 9 * * 1')
  })

  it('success case - templates come from the preset', async () => {
    expect((await generated('docker')).workflows?.templates).toEqual({ docker: true, weekly: true })
    expect((await generated('security')).workflows?.templates).toEqual({})
  })

  it('success case - a preset that asks for auto-merge gets it', async () => {
    const autoMerge = (await generated('security')).pullRequest?.autoMerge

    expect(autoMerge?.enabled).toBe(true)
    expect(autoMerge?.strategy).toBe('squash')
  })

  it('failure case - auto-merge stays scoped to patches', async () => {
    // The preset carries a bare boolean. Generating an unconditional
    // auto-merge from a `true` would hand a new repository something far more
    // dangerous than the preset describes.
    expect((await generated('security')).pullRequest?.autoMerge?.conditions).toEqual(['patch-only'])
  })

  it('success case - a preset that does not ask for auto-merge has none', async () => {
    // An empty or missing condition list means nothing auto-merges, but the
    // absence should be explicit rather than relying on that reading.
    expect((await generated('standard')).pullRequest?.autoMerge).toBeUndefined()
  })

  it('edge case - no preset generates a working default', async () => {
    await generateConfigFile({ owner: 'o', name: 'r' }, false)
    const module = await import(`${join(testDir, 'buddy.config.ts')}?t=default`)

    expect(validateConfig(module.default)).toEqual([])
  })
})
