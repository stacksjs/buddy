import type { BuddyEvents } from './bus'
import type { NotificationConfig } from './sinks'
import { EventBus } from './bus'
import { createSinks } from './sinks'

export { describeEvent, EVENT_NAMES, EventBus } from './bus'
export type { BuddyEvents, EventSink } from './bus'
export {
  createDiscordSink,
  createSinks,
  createSlackSink,
  createWebhookSink,
  sign,
  WEBHOOK_PAYLOAD_VERSION,
} from './sinks'
export type { NotificationConfig } from './sinks'

/**
 * Fire one event through a bus built from the given notification config.
 *
 * For call sites that do not hold a `Buddy` instance — CLI actions, the
 * review and CI paths. Sinks are built per call, which is cheap and only
 * happens when notifications are configured at all.
 */
export async function emitEvent<K extends keyof BuddyEvents>(
  notifications: NotificationConfig | undefined,
  event: K,
  payload: BuddyEvents[K],
): Promise<void> {
  const sinks = createSinks(notifications)
  if (sinks.length === 0)
    return

  const bus = new EventBus()
  for (const sink of sinks)
    bus.register(sink)
  await bus.emit(event, payload)
}
