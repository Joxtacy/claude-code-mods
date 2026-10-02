import { test, expect } from 'claude-code/testing'
import { formatTokens } from './register'

const usage = {
  model: 'claude-opus-5-5',
  input_tokens: 2_000,
  output_tokens: 1_500,
  cache_read_input_tokens: 96_000,
  cache_creation_input_tokens: 2_000,
}

test('formats tokens like the shell status line', () => {
  expect(formatTokens(999)).toBe('999')
  expect(formatTokens(42_399)).toBe('42.3k')
  expect(formatTokens(1_250_000)).toBe('1.2M')
})

test('pins a per-turn line with cache hit, cost delta and agent tokens', async ($, on) => {
  let cost = 1.0
  const statuses: (string | undefined)[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [], cost: { usd: cost } } }))
  on('ui.status', (_$, e) => { statuses.push(e.text); return { value: undefined } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }))

  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  await $.turn.complete({
    answer: '', durationMs: 3_000, isAborted: false, turnId: 's1', agentId: 'a1', reason: 'answer',
    usage: { ...usage, input_tokens: 10_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  })
  cost = 1.25
  await $.turn.complete({ answer: 'ok', durationMs: 38_400, isAborted: false, turnId: 't1', reason: 'answer', usage })

  expect(statuses).toEqual(['last turn 100.0k in · 96% cached · 1.5k out · $0.25 · 38s · agents 10.0k'])
})

test('shows nothing when the turn reported no usage', async ($, on) => {
  const statuses: (string | undefined)[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('ui.status', (_$, e) => { statuses.push(e.text); return { value: undefined } })
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  await $.turn.complete({ answer: '', durationMs: 10, isAborted: true, turnId: 't2', reason: 'aborted' })
  expect(statuses).toEqual([])
})
