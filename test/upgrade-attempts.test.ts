import type { AiClient } from '../src/ai/types'
import type { AgentRunResult } from '../src/agent/types'
import type { PackageUpdate } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { attemptMajorUpgrade } from '../src/upgrades/migrate'
import { Logger } from '../src/utils/logger'

const PLAN = {
  changes: [{ description: 'the legacy import was removed', action: 'import from the root', affectedFiles: [], automatable: true }],
  confidence: 'high',
  effort: 2,
  risks: [],
}

/** An analysis client that always returns the same plan. */
const ai = {
  provider: 'anthropic',
  model: 'test',
  tokensUsed: 0,
  async complete() {
    return { text: JSON.stringify(PLAN), toolCalls: [], json: PLAN, stopReason: 'end', usage: { inputTokens: 1, outputTokens: 1 }, model: 'test' }
  },
} as unknown as AiClient

const update: PackageUpdate = {
  name: 'react',
  currentVersion: '17.0.2',
  newVersion: '19.0.0',
  updateType: 'major',
  dependencyType: 'dependencies',
  file: 'package.json',
} as PackageUpdate

/** A scripted agent: one result per call, recording the tasks it was given. */
function scriptedAgent(results: Array<Partial<AgentRunResult>>) {
  const tasks: string[] = []
  let call = 0
  const agent = async (_ai: unknown, options: { task: string }): Promise<AgentRunResult> => {
    tasks.push(options.task)
    const scripted = results[Math.min(call++, results.length - 1)]
    return { output: '', stopReason: 'completed', transcript: [], outputTokens: 1, toolCalls: 1, ...scripted }
  }
  return { agent: agent as never, tasks }
}

function attempt(maxAttempts: number | undefined, results: Array<Partial<AgentRunResult>>) {
  const { agent, tasks } = scriptedAgent(results)
  return attemptMajorUpgrade({
    update,
    releaseNotes: 'removed the legacy API',
    files: [],
    workspace: '/tmp',
    baseBranch: 'main',
    ai,
    autoMigrate: true,
    ...(maxAttempts === undefined ? {} : { maxAttempts }),
    agent,
    logger: Logger.silent(),
  }).then(result => ({ result, tasks }))
}

/**
 * `ai.majorUpgrades.maxAttempts` was declared, documented as "maximum agent
 * attempts per upgrade", and the agent ran exactly once whatever it said.
 */
describe('migration attempts', () => {
  it('success case - a run that completes takes one attempt', async () => {
    const { result, tasks } = await attempt(3, [{ stopReason: 'completed' }])

    expect(tasks).toHaveLength(1)
    expect(result.outcome?.attempts).toBe(1)
    expect(result.status).toBe('migrated')
  })

  it('success case - a run that stops short is retried up to the limit', async () => {
    const { result, tasks } = await attempt(3, [
      { stopReason: 'max_tool_calls', output: 'got halfway' },
      { stopReason: 'completed' },
    ])

    expect(tasks).toHaveLength(2)
    expect(result.outcome?.attempts).toBe(2)
    expect(result.status).toBe('migrated')
  })

  it('success case - the retry is told what happened and to continue', async () => {
    // Starting over would redo the work that did land; the second run is
    // handed the first one's output and pointed at the workspace as it is.
    const { tasks } = await attempt(2, [
      { stopReason: 'timeout', output: 'renamed two imports' },
      { stopReason: 'completed' },
    ])

    expect(tasks[1]).toContain('renamed two imports')
    expect(tasks[1]).toContain('Continue from the workspace')
  })

  it('failure case - the limit is respected', async () => {
    const { result, tasks } = await attempt(2, [{ stopReason: 'max_tool_calls' }])

    expect(tasks).toHaveLength(2)
    expect(result.status).toBe('migration-failed')
    expect(result.draft).toBe(true)
  })

  it('edge case - unset means one attempt, as before', async () => {
    const { tasks } = await attempt(undefined, [{ stopReason: 'error' }])

    expect(tasks).toHaveLength(1)
  })

  it('edge case - applied stays true if any attempt changed code', async () => {
    const { result } = await attempt(2, [
      { stopReason: 'max_tool_calls', toolCalls: 3 },
      { stopReason: 'error', toolCalls: 0 },
    ])

    expect(result.outcome?.applied).toBe(true)
  })
})
