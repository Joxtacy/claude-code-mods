import { test, expect } from 'claude-code/testing'
import type { SessionContextBreakdown, SessionUsageArgs } from 'claude-code'

const breakdown = {
  categories: [
    { name: 'System prompt', tokens: 3_100, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Memory files', tokens: 4_200, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 50_000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'MCP tools', tokens: 9_000, color: 'x', isDeferred: true, kind: 'deferred' },
    { name: 'Free space', tokens: 120_000, color: 'x', isDeferred: false, kind: 'free' },
  ],
  totalTokens: 57_300,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  autocompactSource: 'model-default',
  percentage: 29,
  gridRows: [],
  model: 'claude-opus-5-5',
  memoryFiles: [
    { path: '/Users/joxtacy/.claude/CLAUDE.md', type: 'User', tokens: 900 },
    { path: '/Users/joxtacy/proj/CLAUDE.md', type: 'Project', tokens: 3_300 },
  ],
  mcpTools: [
    { name: 'mcp__a__x', serverName: 'atlassian', tokens: 2_000, isLoaded: true },
    { name: 'mcp__a__y', serverName: 'atlassian', tokens: 1_500, isLoaded: true },
    { name: 'mcp__f__z', serverName: 'figma', tokens: 8_000, isLoaded: false },
  ],
  agents: [],
  isAutoCompactEnabled: true,
  autoCompactThreshold: 167_000,
  apiUsage: { input_tokens: 300, output_tokens: 10, cache_read_input_tokens: 56_000, cache_creation_input_tokens: 1_000 },
} as unknown as SessionContextBreakdown

const run = (args: string) =>
  ({ command: 'usage-breakdown', args, origin: { kind: 'composer' }, presentation: {} }) as never

test('lists categories and the biggest trimmable items, biggest first', async ($, on) => {
  const asked: (SessionUsageArgs | undefined)[] = []
  on('session.usage', (_$, e) => {
    asked.push(e)
    return { value: { startedAt: 0, context: { window: 200_000, breakdown }, rateLimits: [] } }
  })

  const { text } = await $.command.run(run(''))

  expect(asked).toEqual([{ breakdown: 'summary' }])
  expect(text).toContain('Context 57.3k / 200.0k (29%) · claude-opus-5-5 · autocompact at 167.0k')
  expect(text).toContain('(estimates; /usage-breakdown full for exact counts)')
  expect(text).toMatch(/Messages\s+50\.0k/)
  expect(text).toMatch(/Deferred \(not loaded\)\s+9\.0k/)
  expect(text).not.toContain('Free space')
  expect(text!.indexOf('~/proj/CLAUDE.md')).toBeLessThan(text!.indexOf('~/.claude/CLAUDE.md'))
  expect(text).toMatch(/atlassian\s+3\.5k/)
  expect(text).not.toContain('figma')
  expect(text).toContain('Last request: 57.3k in, 98% from cache')
})

test('full asks for exact counts', async ($, on) => {
  const asked: (SessionUsageArgs | undefined)[] = []
  on('session.usage', (_$, e) => {
    asked.push(e)
    return { value: { startedAt: 0, context: { window: 200_000, breakdown }, rateLimits: [] } }
  })

  const { text } = await $.command.run(run(' full '))
  expect(asked).toEqual([{ breakdown: 'full' }])
  expect(text).toContain('(exact counts)')
})

test('says so when no breakdown is available', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  const { text } = await $.command.run(run(''))
  expect(text).toBe('No context breakdown is available in this session yet.')
})
