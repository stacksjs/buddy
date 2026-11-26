import { describe, expect, test } from 'bun:test'
import { readDiscordAlerts } from '../src/alerts/discord'

const options = {
  channelId: '1479360892444479498',
  sourceIds: ['1000000000000000001'],
  botToken: 'example-token',
}

function message(id: bigint, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: String(id),
    author: { id: options.sourceIds[0], bot: true },
    timestamp: '2026-11-26T01:00:00.000Z',
    content: 'Monitor recovered',
    embeds: [],
    ...extra,
  }
}

describe('Discord alerts', () => {
  test('resumes across a full page with string snowflakes and includes only configured senders', async () => {
    const base = 1500000000000000000n
    const cursor = String(base)
    const newest = base + 103n
    const before = String(base + 4n)
    const embeds = [{ title: 'New failure', footer: { text: 'bughq' }, fields: [{ name: 'Project', value: 'Buddy' }] }]
    const firstPage = Array.from({ length: 100 }, (_, index) => message(newest - BigInt(index), {
      webhook_id: '1000000000000000002',
    }))
    const secondPage = [
      message(base + 3n),
      message(base + 2n, { author: { id: options.sourceIds[0], bot: false } }),
      message(base + 1n, { webhook_id: options.sourceIds[0], content: '', embeds }),
      message(base),
    ]
    const cursors: Array<string | null> = []
    const batch = await readDiscordAlerts({ ...options, after: cursor }, async (url, init) => {
      expect(url).toStartWith(`https://discord.com/api/v10/channels/${options.channelId}/messages?`)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bot example-token')
      expect(init?.redirect).toBe('error')
      const cursor = new URL(url).searchParams.get('before')
      cursors.push(cursor)
      return Response.json(cursor ? secondPage : firstPage)
    })

    expect(cursors).toEqual([null, before])
    expect(batch.nextCursor).toBe(String(newest))
    expect(batch.alerts.map(alert => alert.id)).toEqual([String(base + 1n), String(base + 3n)])
    expect(batch.alerts[0].embeds).toEqual(embeds)
  })

  test('keeps the cursor when latest messages have already been handled', async () => {
    const previous = 1500000000000000131n
    const batch = await readDiscordAlerts({ ...options, after: String(previous) }, async () =>
      Response.json([message(previous - 1n)]))
    expect(batch).toEqual({ alerts: [], nextCursor: String(previous) })
  })

  test('reports credential and permission errors without echoing the response body', async () => {
    await expect(readDiscordAlerts(options, async () =>
      new Response('example-token', { status: 401 }))).rejects.toThrow('Discord rejected DISCORD_BOT_TOKEN (HTTP 401).')
    await expect(readDiscordAlerts({ ...options, after: '1500000000000000000' }, async () =>
      Response.json([]))).rejects.toThrow('Read Message History')
    await expect(readDiscordAlerts(options, async () =>
      Response.json([message(1500000000000000000n, { content: '' })]))).rejects.toThrow('Message Content intent')
  })
})
