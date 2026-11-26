export type HqSource = 'bughq' | 'loghq' | 'statushq'

export type HqAlertKind =
  | 'test'
  | 'bug'
  | 'regression'
  | 'error'
  | 'outage'
  | 'degradation'
  | 'recovery'
  | 'status-report'
  | 'unrecognized'

export interface HqAlert {
  source: HqSource
  kind: HqAlertKind
  project?: string
  reference?: string
  level?: string
  environment?: string
}

interface HqMessage {
  content: string
  embeds: Array<{
    description?: string
    url?: string
    footer?: { text: string }
    fields?: Array<{ name: string, value: string }>
  }>
}

/** Parse operator-supplied Discord sender IDs and their known HQ apps. */
export function parseHqSources(input?: string): Map<string, HqSource> {
  const sources = new Map<string, HqSource>()
  for (const entry of input?.split(',') ?? []) {
    const [source, id, ...extra] = entry.trim().split('=')
    if ((source !== 'bughq' && source !== 'loghq' && source !== 'statushq') || !id || extra.length)
      throw new Error('Use --hq-sources with comma-separated bughq=ID, loghq=ID, or statushq=ID entries.')
    if (sources.has(id))
      throw new Error('Each ID in --hq-sources must appear only once.')
    sources.set(id, source)
  }
  return sources
}

function classifyStatus(content: string): Omit<HqAlert, 'source'> {
  const heading = content.split('\n', 1)[0]?.trim()
  if (heading === '**Test notification**')
    return { kind: 'test' }
  if (heading?.startsWith('**📢 ') && heading.endsWith('**'))
    return { kind: 'status-report' }
  const subject = heading?.match(/^\*\*(🔴|⚠️?|✅) (.+?)(?: is down|: issue detected| has recovered)\*\*$/u)
  if (!subject)
    return { kind: 'unrecognized' }
  if (subject[1] === '🔴' && heading?.endsWith(' is down**'))
    return { kind: 'outage', project: subject[2] }
  if (subject[1] === '✅' && heading?.endsWith(' has recovered**'))
    return { kind: 'recovery', project: subject[2] }
  if (subject[1].startsWith('⚠') && heading?.endsWith(': issue detected**'))
    return { kind: 'degradation', project: subject[2] }
  return { kind: 'unrecognized' }
}

/** Classify payloads from a configured sender, using the emitting app's format. */
export function classifyHqAlert(source: HqSource, message: HqMessage): HqAlert {
  if (source === 'statushq')
    return { source, ...classifyStatus(message.content) }

  const embed = message.embeds.find(item => item.footer?.text === source)
  const field = (name: string): string | undefined => embed?.fields?.find(item => item.name === name)?.value
  const project = field('Project')
  const environment = field('Environment')
  const level = field('Level')
  const href = embed?.url
  const url = href && URL.canParse(href) ? new URL(href) : undefined
  const kind = { source, project, level, environment } as const
  if (!url || url.origin !== `https://${source}.org` || url.username || url.password || !project)
    return { ...kind, kind: 'unrecognized' }
  if (environment === 'test' && level === 'info' && url.pathname === '/dashboard' && !url.search)
    return { ...kind, kind: 'test' }

  if (source === 'bughq' && /^\/issue\/[\w-]+$/.test(url.pathname)) {
    const reference = url.pathname.split('/').at(-1)
    if (embed?.description === 'A new issue was just captured.')
      return { ...kind, kind: 'bug', reference }
    if (embed?.description === 'An issue you resolved is happening again.')
      return { ...kind, kind: 'regression', reference }
  }

  const projectId = url.searchParams.get('project')
  if (source === 'loghq' && url.pathname === '/dashboard' && projectId && /^[\w-]+$/.test(projectId)) {
    if (embed?.description === 'A new error was just logged.')
      return { ...kind, kind: 'error', reference: projectId }
    if (embed?.description === 'An error that had gone quiet is happening again.')
      return { ...kind, kind: 'regression', reference: projectId }
  }
  return { ...kind, kind: 'unrecognized' }
}
