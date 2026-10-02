import { describe, expect, it } from 'bun:test'
import { computeMetrics } from '../src/reports/metrics'
import { isBuddyBranch } from '../src/utils/branches'

// Pull requests opened before the rename live on `buddy-bot/` branches. Every
// "is this ours" check hard-coded `buddy/`, so the rebase checkbox found
// nothing to rebase on stacksjs/stacks and those PRs could not be refreshed.
describe('isBuddyBranch', () => {
  it('recognises the current and the pre-rename prefix', () => {
    expect(isBuddyBranch('buddy/update-non-major-updates')).toBe(true)
    expect(isBuddyBranch('buddy-bot/update-non-major-updates')).toBe(true)
  })

  it('rejects other tools and look-alikes', () => {
    expect(isBuddyBranch('renovate/stripe-23.x')).toBe(false)
    expect(isBuddyBranch('dependabot/npm_and_yarn/stripe-23.0.0')).toBe(false)
    expect(isBuddyBranch('buddy-fix-login')).toBe(false)
    expect(isBuddyBranch('feature/buddy/thing')).toBe(false)
    expect(isBuddyBranch(undefined)).toBe(false)
  })

  it('counts pre-rename pull requests in the metrics by default', () => {
    const now = new Date('2026-10-02T00:00:00Z')
    const pr = (head: string) => ({ head, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: now, state: 'open' }) as any
    const metrics = computeMetrics({ period: '30d', now, pullRequests: [pr('buddy/a'), pr('buddy-bot/b'), pr('renovate/c')], updates: [], dependenciesByEcosystem: {} } as any)
    expect(JSON.stringify(metrics)).toContain('"opened":2')
  })
})

// "PR is already up to date, no rebase needed" was decided from update
// versions alone, so a branch cut from an older base was never rebased onto
// the fixes that would turn its CI green.
describe('isBranchBehind', () => {
  it('reads behind_by from the compare endpoint', async () => {
    const { GitHubProvider } = await import('../src/git/github-provider')
    const github = new GitHubProvider('token', 'acme', 'app') as any
    const requested: string[] = []
    github.apiRequestWithRetry = async (endpoint: string) => {
      requested.push(endpoint)
      return { behind_by: endpoint.includes('stale') ? 3 : 0 }
    }

    expect(await github.isBranchBehind('buddy-bot/stale', 'main')).toBe(true)
    expect(await github.isBranchBehind('buddy/fresh', 'main')).toBe(false)
    expect(requested[0]).toBe('GET /repos/acme/app/compare/main...buddy-bot%2Fstale')
  })
})
