import type { AiCompletionRequest } from '../src/ai/types'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createAnthropicProvider } from '../src/ai/providers/anthropic'
import { AiProviderError } from '../src/ai/types'

/**
 * The google and openai providers were tested directly; this one — the
 * default when several keys are present — was not. The SDK is faked at the
 * module seam so `complete` runs its real mapping code: block collection,
 * stop-reason normalisation, usage mapping, and the lazy client.
 *
 * `mock.module` is process-global; that is safe here because nothing else in
 * the suite imports `@anthropic-ai/sdk` (it is an optional peer the provider
 * itself loads lazily). The fake delegates nowhere — there is no real network
 * client any test should ever construct.
 */
interface FakeResponse {
  content: Array<{ type: 'text', text: string } | { type: 'tool_use', id: string, name: string, input: unknown }>
  stop_reason: string | null
  usage: { input_tokens: number, output_tokens: number, cache_read_input_tokens?: number }
  model: string
}

const OK_RESPONSE: FakeResponse = {
  content: [{ type: 'text', text: 'hello' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-test-1',
}

let respondWith: () => FakeResponse = () => OK_RESPONSE
let createCalls: any[] = []
let constructorCalls: any[] = []

class FakeAnthropic {
  messages = {
    create: async (params: unknown): Promise<FakeResponse> => {
      createCalls.push(params)
      return respondWith()
    },
  }

  constructor(options: unknown) {
    constructorCalls.push(options)
  }
}

mock.module('@anthropic-ai/sdk', () => ({ default: FakeAnthropic }))

/** A minimal request; tests spread overrides onto it. */
function request(overrides: Partial<AiCompletionRequest> = {}): AiCompletionRequest {
  return { messages: [{ role: 'user', content: 'hi' }], ...overrides } as AiCompletionRequest
}

beforeEach(() => {
  respondWith = () => OK_RESPONSE
  createCalls = []
  constructorCalls = []
})

describe('anthropic provider', () => {
  describe('response mapping', () => {
    it('success case - concatenates text blocks and collects tool calls', async () => {
      respondWith = () => ({
        ...OK_RESPONSE,
        content: [
          { type: 'text', text: 'part one ' },
          { type: 'tool_use', id: 't1', name: 'read_file', input: { path: 'a.ts' } },
          { type: 'text', text: 'part two' },
        ],
        stop_reason: 'tool_use',
      })

      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      const response = await provider.complete(request(), 'claude-test-1')

      expect(response.text).toBe('part one part two')
      expect(response.toolCalls).toEqual([{ id: 't1', name: 'read_file', input: { path: 'a.ts' } }])
      expect(response.stopReason).toBe('tool_use')
    })

    it('success case - maps usage, including the cache read count only when present', async () => {
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })

      const plain = await provider.complete(request(), 'claude-test-1')
      expect(plain.usage).toEqual({ inputTokens: 10, outputTokens: 5 })

      respondWith = () => ({ ...OK_RESPONSE, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 7 } })
      const cached = await provider.complete(request(), 'claude-test-1')
      expect(cached.usage.cachedInputTokens).toBe(7)
    })

    it('edge case - every stop reason lands in the normalized set', async () => {
      // `refusal` in particular must survive: it arrives as a successful HTTP
      // response with empty content, and a caller that cannot tell would read
      // the empty text as a valid answer.
      const cases: Array<[string | null, string]> = [
        ['end_turn', 'end'],
        ['stop_sequence', 'end'],
        ['tool_use', 'tool_use'],
        ['max_tokens', 'max_tokens'],
        ['refusal', 'refusal'],
        ['something_new', 'other'],
        [null, 'other'],
      ]

      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      for (const [wire, normalized] of cases) {
        respondWith = () => ({ ...OK_RESPONSE, stop_reason: wire })
        const response = await provider.complete(request(), 'claude-test-1')
        expect(response.stopReason).toBe(normalized as typeof response.stopReason)
      }
    })

    it('success case - parses json only for schema-constrained requests', async () => {
      respondWith = () => ({ ...OK_RESPONSE, content: [{ type: 'text', text: '{"answer":42}' }] })
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })

      const unconstrained = await provider.complete(request(), 'claude-test-1')
      expect(unconstrained.json).toBeUndefined()

      const constrained = await provider.complete(request({ jsonSchema: { type: 'object' } }), 'claude-test-1')
      expect(constrained.json).toEqual({ answer: 42 })
    })

    it('failure case - malformed json for a schema-constrained request throws', async () => {
      respondWith = () => ({ ...OK_RESPONSE, content: [{ type: 'text', text: 'not json' }] })
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })

      await expect(provider.complete(request({ jsonSchema: { type: 'object' } }), 'claude-test-1'))
        .rejects.toBeInstanceOf(AiProviderError)
    })
  })

  describe('request mapping', () => {
    it('success case - passes model, system, tools and output config through', async () => {
      // The schema-constrained request parses the reply as JSON on the way out.
      respondWith = () => ({ ...OK_RESPONSE, content: [{ type: 'text', text: '{}' }] })
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      await provider.complete(request({
        system: 'be brief',
        effort: 'low',
        jsonSchema: { type: 'object' },
        tools: [{ name: 'grep', description: 'search', parameters: { type: 'object' } }],
      }), 'claude-test-1')

      const params = createCalls[0]
      expect(params.model).toBe('claude-test-1')
      expect(params.system).toBe('be brief')
      expect(params.tools).toEqual([{ name: 'grep', description: 'search', input_schema: { type: 'object' } }])
      expect(params.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } })
    })

    it('edge case - omits the optional keys rather than sending undefined', async () => {
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      await provider.complete(request(), 'claude-test-1')

      const params = createCalls[0]
      expect('system' in params).toBe(false)
      expect('tools' in params).toBe(false)
      expect('output_config' in params).toBe(false)
      // The default ceiling is sized to stay under the SDK's HTTP timeout.
      expect(params.max_tokens).toBe(16000)
    })

    it('success case - an explicit maxTokens overrides the default', async () => {
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      await provider.complete(request({ maxTokens: 512 }), 'claude-test-1')

      expect(createCalls[0].max_tokens).toBe(512)
    })
  })

  describe('client construction', () => {
    it('success case - the client is built once and reused', async () => {
      const provider = createAnthropicProvider({ apiKey: 'sk-test' })
      await provider.complete(request(), 'claude-test-1')
      await provider.complete(request(), 'claude-test-1')

      expect(constructorCalls).toHaveLength(1)
      expect(constructorCalls[0]).toEqual({ apiKey: 'sk-test' })
    })

    it('success case - a gateway base URL reaches the SDK', async () => {
      const provider = createAnthropicProvider({ apiKey: 'sk-test', baseUrl: 'https://gateway.example' })
      await provider.complete(request(), 'claude-test-1')

      expect(constructorCalls[0]).toEqual({ apiKey: 'sk-test', baseURL: 'https://gateway.example' })
    })
  })
})
