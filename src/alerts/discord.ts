import type { HqAlert, HqSource } from './hq'
import { version } from '../../package.json'
import { redactDeep } from '../ai/redact'
import { fetchWithTimeout } from '../utils/http'
import { classifyHqAlert } from './hq'

interface Embed {
  title?: string
  description?: string
  url?: string
  footer?: { text: string }
  fields?: Array<{ name: string, value: string }>
}

interface DiscordMessage {
  id: string
  webhook_id?: string
  author: { id: string, bot?: boolean }
  timestamp: string
  content: string
  embeds: Embed[]
}

interface DiscordAlert {
  id: string
  sourceId: string
  timestamp: string
  content: string
  embeds: Embed[]
  hq?: HqAlert
}

interface DiscordAlertOptions {
  channelId: string
  sourceIds: string[]
  botToken: string
  after?: string
  hqSources?: ReadonlyMap<string, HqSource>
}

interface DiscordAlertBatch {
  alerts: DiscordAlert[]
  nextCursor: string | null
}

const DISCORD_API = 'https://discord.com/api/v10'
const PAGE_SIZE = 100
const MAX_SNOWFLAKE = (1n << 64n) - 1n

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= MAX_SNOWFLAKE
}

function readAlert(message: DiscordMessage, sourceIds: Set<string>, hqSources?: ReadonlyMap<string, HqSource>): DiscordAlert | undefined {
  const sourceId = message.webhook_id ?? (message.author?.bot ? message.author.id : undefined)
  if (!sourceId || !sourceIds.has(sourceId))
    return

  if (!message.content?.trim() && !message.embeds?.length)
    throw new Error(`Discord alert ${message.id} has no text or embeds. Check the bot's Message Content intent.`)

  const { id, timestamp, content, embeds } = message
  const hqSource = hqSources?.get(sourceId)
  return {
    id,
    sourceId,
    timestamp,
    content,
    ...(hqSource ? { hq: classifyHqAlert(hqSource, message) } : {}),
    embeds: embeds.map(({ title, description, url, footer, fields }) => ({
      title,
      description,
      url,
      footer: footer && { text: footer.text },
      fields: fields?.map(({ name, value }) => ({ name, value })),
    })),
  }
}

/**
 * Read one guild channel through the Discord bot API. With no cursor, start
 * with the latest page. With a cursor, walk back from the newest message so
 * a burst of more than one page cannot leave a gap. The result is oldest
 * first, and the caller commits the cursor after handling the batch.
 */
export async function readDiscordAlerts(
  { channelId, sourceIds, botToken, after, hqSources }: DiscordAlertOptions,
  request: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<DiscordAlertBatch> {
  if (!isSnowflake(channelId))
    throw new Error('Provide a valid Discord channel ID.')
  const allowedSources = new Set([...sourceIds, ...hqSources?.keys() ?? []])
  if (!allowedSources.size || ![...allowedSources].every(isSnowflake))
    throw new Error('Provide valid Discord webhook or bot IDs with --source-ids or --hq-sources.')
  if (after !== undefined && !isSnowflake(after))
    throw new Error('Provide a valid Discord message ID with --after.')
  if (!botToken.trim())
    throw new Error('Set DISCORD_BOT_TOKEN to a Discord bot token.')

  const cutoff = after === undefined ? undefined : BigInt(after)
  const alerts: DiscordAlert[] = []
  let nextCursor = after ?? null
  let before: string | undefined

  while (true) {
    const url = new URL(`${DISCORD_API}/channels/${channelId}/messages`)
    url.searchParams.set('limit', String(PAGE_SIZE))
    if (before)
      url.searchParams.set('before', before)

    const response = await request(url.href, {
      headers: {
        'Authorization': `Bot ${botToken.trim()}`,
        'User-Agent': `DiscordBot (https://buddy.sh, ${version})`,
      },
      redirect: 'error',
    })
    if (!response.ok) {
      if (response.status === 401)
        throw new Error('Discord rejected DISCORD_BOT_TOKEN (HTTP 401).')
      if (response.status === 403 || response.status === 404)
        throw new Error(`Discord channel ${channelId} is unavailable (HTTP ${response.status}). Check the channel ID and bot access.`)
      throw new Error(`Discord could not read channel ${channelId} (HTTP ${response.status}).`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || !payload.every(message => isSnowflake(message?.id)))
      throw new Error('Discord returned an invalid message page.')
    const messages = payload as DiscordMessage[]
    const newest = messages[0]
    if (!newest) {
      if (!before && after)
        throw new Error('Discord returned an empty channel history. Check the bot’s Read Message History permission.')
      break
    }

    let previousId = before ? BigInt(before) : undefined
    for (const message of messages) {
      const id = BigInt(message.id)
      if (previousId !== undefined && id >= previousId)
        throw new Error('Discord returned messages out of order.')
      previousId = id
    }

    if (!before && (cutoff === undefined || BigInt(newest.id) > cutoff))
      nextCursor = newest.id

    for (const message of messages) {
      if (cutoff !== undefined && BigInt(message.id) <= cutoff)
        break
      const alert = readAlert(message, allowedSources, hqSources)
      if (alert)
        alerts.push(alert)
    }

    const oldest = messages[messages.length - 1].id
    if (cutoff === undefined || messages.length < PAGE_SIZE || BigInt(oldest) <= cutoff)
      break
    before = oldest
  }

  return { alerts: redactDeep(alerts.reverse()) as DiscordAlert[], nextCursor }
}
