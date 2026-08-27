import { describe, expect, it } from 'bun:test'

describe('CLI Setup - Enhanced Functions', () => {
  describe('Unified Workflow Generation', () => {
    it('should generate unified workflow with custom token', async () => {
      const { generateUnifiedWorkflow } = await import('../src/setup')
      const workflow = generateUnifiedWorkflow(true)

      expect(workflow).toContain('name: Buddy')
      expect(workflow).toContain('cron: \'0 9 * * 1,3,5\'') // Standard preset schedule
      // GITHUB_TOKEN is the built-in token; BUDDY_TOKEN is passed separately for workflow file permissions
      // eslint-disable-next-line no-template-curly-in-string
      expect(workflow).toContain('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
      // eslint-disable-next-line no-template-curly-in-string
      expect(workflow).toContain('BUDDY_TOKEN: ${{ secrets.BUDDY_TOKEN }}')
      expect(workflow).toContain('bunx @buddysh/buddy dashboard')
      expect(workflow).toContain('bunx @buddysh/buddy update-check')
      expect(workflow).toContain('bunx @buddysh/buddy update')
      expect(workflow).toContain('workflow_dispatch')
    })

    it('should generate unified workflow with default token', async () => {
      const { generateUnifiedWorkflow } = await import('../src/setup')
      const workflow = generateUnifiedWorkflow(false)

      expect(workflow).toContain('name: Buddy')
      // eslint-disable-next-line no-template-curly-in-string
      expect(workflow).toContain('${{ secrets.GITHUB_TOKEN }}')
      // Should not use BUDDY_TOKEN in the actual token environment variable
      expect(workflow).not.toContain('secrets.BUDDY_TOKEN ||')
    })

    it('should include all three job types in unified workflow', async () => {
      const { generateUnifiedWorkflow } = await import('../src/setup')
      const workflow = generateUnifiedWorkflow(true)

      expect(workflow).toContain('check:')
      expect(workflow).toContain('dependency-update:')
      expect(workflow).toContain('dashboard-update:')
      expect(workflow).toContain('pull_request:') // Rebase checkbox triggers instantly via PR edit event
      expect(workflow).toContain('cron: \'0 9 * * 1,3,5\'') // Updates and dashboard
      expect(workflow).toContain('cron: \'0 4 * * *\'') // Housekeeping, never preset-driven
      expect(workflow).toContain('bunx @buddysh/buddy update-check')
      expect(workflow).toContain('bunx @buddysh/buddy update')
      expect(workflow).toContain('bunx @buddysh/buddy dashboard')
      expect(workflow).toContain('dry_run:')
    })
  })

  describe('Preset Configuration', () => {
    it('should return standard preset configuration', async () => {
      const { getWorkflowPreset } = await import('../src/setup')
      const preset = getWorkflowPreset('standard')

      expect(preset.name).toBe('Standard Project')
      expect(preset.description).toContain('Daily patch updates')
    })

    it('should return security preset configuration', async () => {
      const { getWorkflowPreset } = await import('../src/setup')
      const preset = getWorkflowPreset('security')

      expect(preset.name).toBe('Security Focused')
      expect(preset.description).toContain('security-first')
    })

    it('should generate unified workflow with correct format', async () => {
      const { generateUnifiedWorkflow } = await import('../src/setup')

      const workflow = generateUnifiedWorkflow(false)

      expect(workflow).toContain('name: Buddy')
      expect(workflow).toContain('cron: \'0 9 * * 1,3,5\'')
      expect(workflow).toContain('default: false') // dry_run default
      expect(workflow).toContain('dependency-update:') // job name
      expect(workflow).toContain('determine-jobs:') // job coordination
      expect(workflow).toContain('dashboard-update:') // dashboard job
    })
  })
})
