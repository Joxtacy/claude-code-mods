import { expect, test } from 'claude-code/testing'
import type { SessionContextBreakdown, SessionUsage } from 'claude-code'

const breakdown = {
  categories: [
    { name: 'System prompt', tokens: 4_000, color: 'promptBorder', isDeferred: false, kind: 'used' },
    { name: 'System tools', tokens: 10_000, color: 'inactive', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 70_000, color: 'permission', isDeferred: false, kind: 'used' },
    { name: 'MCP tools', tokens: 6_000, color: 'cyan_FOR_SUBAGENTS_ONLY', isDeferred: true, kind: 'deferred' },
    { name: 'Autocompact buffer', tokens: 33_000, color: 'inactive', isDeferred: false, kind: 'buffer' },
    { name: 'Free space', tokens: 83_000, color: 'promptBorder', isDeferred: false, kind: 'free' },
  ],
  totalTokens: 84_000,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  percentage: 42,
  isAutoCompactEnabled: true,
  autoCompactThreshold: 167_000,
} as unknown as SessionContextBreakdown

const usage: SessionUsage = {
  startedAt: 0,
  context: { window: 200_000, tokens: 84_000, percent: 42, breakdown },
  rateLimits: [],
}

const props = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as never

const RUN = {
  command: 'context-bar',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as never

for (const surface of ['terminal', 'desktop'] as const) {
  test(`draws a segment per category on ${surface}`, async ($, on) => {
    on('session.usage', () => ({ value: usage }))
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    const store = new Map<string, unknown>()
    on('store.get', (_$, e) => ({ value: store.get(e.key) }))
    on('store.set', (_$, e) => (store.set(e.key, e.value), { value: undefined }))
    await $.session.measure({ context: usage.context, rateLimits: [], changed: ['context'] })

    const ui = await $.ui.mount({ plugin: 'context-bar', surface, component: 'AbovePrompt', props })
    const colors = (await ui.findAll({ type: 'Text', text: /^█+$/ })).map(t => t.props.color)
    // Grey /context colours are swapped for distinct colourful ones.
    expect(colors).toEqual(['suggestion', 'bashBorder', 'permission', 'subtle'])
    // The engine lists the buffer before free space; the bar puts it last.
    const bar = (await ui.findAll({ type: 'Text', text: /^[█▏ ]{20,}$/ }))[0]?.text ?? ''
    expect(bar).toMatch(/^█+▏ +$/)
    expect(await ui.find({ text: 'messages 70k 35%' })).toBeDefined()
    expect(await ui.find({ text: 'system prompt 4k 2%' })).toBeDefined()
    expect(await ui.find({ text: /mcp tools/ })).toBeUndefined()
    expect(await ui.find({ text: /84k of 200k · compacts at 167k +42%/ })).toBeDefined()
  })

  test(`/context-bar toggles it on ${surface}`, async ($, on) => {
    // The engine's own (empty) band, drawn when the plugin passes.
    on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
    on('session.usage', () => ({ value: usage }))
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    const store = new Map<string, unknown>()
    on('store.get', (_$, e) => ({ value: store.get(e.key) }))
    on('store.set', (_$, e) => (store.set(e.key, e.value), { value: undefined }))
    await $.session.measure({ context: usage.context, rateLimits: [], changed: ['context'] })

    const off = await $.command.run(RUN)
    expect(off).toEqual(expect.objectContaining({ text: 'Context bar hidden.' }))
    const hidden = await $.ui.mount({ plugin: 'context-bar', surface, component: 'AbovePrompt', props })
    expect(await hidden.find({ text: /42%/ })).toBeUndefined()
    await hidden.unmount()

    await $.command.run(RUN)
    const shown = await $.ui.mount({ plugin: 'context-bar', surface, component: 'AbovePrompt', props })
    expect(await shown.find({ text: /42%/ })).toBeDefined()
  })
}
