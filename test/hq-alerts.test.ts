import { describe, expect, test } from 'bun:test'
import { readDiscordAlerts } from '../src/alerts/discord'
import { classifyHqAlert, parseHqSources } from '../src/alerts/hq'

function embedAlert(source: string, url: string, description: string, level = 'error', environment = 'production') {
  return {
    content: '',
    embeds: [{
      url,
      description,
      footer: { text: source },
      fields: [
        { name: 'Project', value: 'Votescape' },
        { name: 'Environment', value: environment },
        { name: 'Level', value: level },
      ],
    }],
  }
}

describe('HQ Discord alert classification', () => {
  test('recognizes BugHQ issues, regressions, and channel tests', () => {
    const url = 'https://bughq.org/issue/abc-1'
    expect(classifyHqAlert('bughq', embedAlert('bughq', url, 'A new issue was just captured.'))).toEqual({
      source: 'bughq', kind: 'bug', reference: 'abc-1', project: 'Votescape', environment: 'production', level: 'error',
    })
    expect(classifyHqAlert('bughq', embedAlert('bughq', url, 'An issue you resolved is happening again.')).kind).toBe('regression')
    expect(classifyHqAlert('bughq', embedAlert('bughq', 'https://bughq.org/dashboard', 'A new issue was just captured.', 'info', 'test')).kind).toBe('test')
  })

  test('recognizes LogHQ errors and rejects payloads with a different host or footer', () => {
    const url = 'https://loghq.org/dashboard?project=votescape-a2d78e'
    expect(classifyHqAlert('loghq', embedAlert('loghq', url, 'A new error was just logged.'))).toMatchObject({
      kind: 'error', reference: 'votescape-a2d78e',
    })
    expect(classifyHqAlert('loghq', embedAlert('bughq', url, 'A new error was just logged.')).kind).toBe('unrecognized')
    expect(classifyHqAlert('loghq', embedAlert('loghq', url.replace('loghq.org', 'loghq.org.example.com'), 'A new error was just logged.')).kind).toBe('unrecognized')
  })

  test('pairs StatusHQ outage, degradation, and recovery by monitor name', () => {
    const headings = [
      ['🔴 Votescape is down', 'outage'],
      ['⚠️ Votescape: issue detected', 'degradation'],
      ['✅ Votescape has recovered', 'recovery'],
    ] as const
    for (const [heading, kind] of headings)
      expect(classifyHqAlert('statushq', { content: `**${heading}**\nDetails`, embeds: [] })).toMatchObject({ kind, project: 'Votescape' })
    expect(classifyHqAlert('statushq', { content: '**Test notification**\nDetails', embeds: [] }).kind).toBe('test')
    expect(classifyHqAlert('statushq', { content: '**📢 Scheduled maintenance**\nDetails', embeds: [] }).kind).toBe('status-report')
  })

  test('classifies only configured HQ source IDs through the reader', async () => {
    const sender = '1200000000000000001'
    const unrelated = '1200000000000000002'
    const alert = embedAlert('bughq', 'https://bughq.org/issue/id', 'A new issue was just captured.')
    const batch = await readDiscordAlerts({
      channelId: '1479360892444479498',
      botToken: 'example-token',
      sourceIds: [unrelated],
      hqSources: parseHqSources(`bughq=${sender}`),
    }, async () => Response.json([
      { id: '1234', webhook_id: sender, ...alert },
      { id: '1233', webhook_id: unrelated, ...alert },
    ]))
    expect(batch.alerts[0].hq).toBeUndefined()
    expect(batch.alerts[1].hq?.kind).toBe('bug')
    expect(() => parseHqSources(`bughq=${sender},loghq=${sender}`)).toThrow('must appear only once')
  })
})
