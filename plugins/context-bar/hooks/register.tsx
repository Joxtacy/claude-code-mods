import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment, Snapshot } from '../types'

const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)
const isVisible = atom({ plugin: 'context-bar', key: 'isVisible' } as const, true)

const STORE_KEY = 'isVisible'
const FREE_COLOR = 'subtle'
const MARKER_COLOR = 'warning'

// 950 -> "950", 3_412 -> "3.4k", 12_300 -> "12k", 1_000_000 -> "1M"
const formatTokens = (n: number) => {
  const short = (x: number, unit: string) => `${x < 10 ? Number(x.toFixed(1)) : Math.round(x)}${unit}`
  if (n >= 1_000_000) return short(n / 1_000_000, 'M')
  if (n >= 1000) return short(n / 1000, 'k')
  return `${n}`
}

// 0.27 -> "0.3%", 1.2 -> "1%", 18.6 -> "19%"
const formatPercent = (p: number) => `${p < 1 ? Number(p.toFixed(1)) : Math.round(p)}%`

// Splits `width` cells across the segments in proportion to their tokens,
// giving every non-empty used segment at least one cell so it stays visible.
export const allocate = (segments: Segment[], width: number): number[] => {
  const total = segments.reduce((sum, s) => sum + s.tokens, 0)
  if (total <= 0 || width <= 0) return segments.map(() => 0)

  const exact = segments.map(s => (s.tokens / total) * width)
  const cells = segments.map((s, i) => {
    const floor = Math.floor(exact[i] ?? 0)
    return s.kind === 'used' && s.tokens > 0 ? Math.max(1, floor) : floor
  })
  let left = width - cells.reduce((a, b) => a + b, 0)

  const byRemainder = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r)
  for (let k = 0; left > 0 && byRemainder.length > 0; k++, left--) {
    const { i } = byRemainder[k % byRemainder.length]!
    cells[i] = (cells[i] ?? 0) + 1
  }
  // Minimums can overshoot: take the excess from the widest non-used segments.
  while (left < 0) {
    const order = cells
      .map((c, i) => ({ i, c, isUsed: segments[i]?.kind === 'used' }))
      .sort((a, b) => Number(a.isUsed) - Number(b.isUsed) || b.c - a.c)
    const victim = order.find(o => o.c > (o.isUsed ? 1 : 0))
    if (!victim) break
    cells[victim.i] = victim.c - 1
    left += 1
  }

  return cells
}

// Used categories first, then free space, then the compaction buffer at the end.
const ORDER: Record<Segment['kind'], number> = { used: 0, free: 1, buffer: 2 }

// /context draws some categories in greys that blur into each other and into
// free space; those (and any repeated colour) get a colourful theme key instead.
const GREYS = new Set(['inactive', 'subtle', 'promptBorder', 'text', FREE_COLOR])
const SPARE = ['suggestion', 'bashBorder', 'ide', 'planMode', 'merged', 'autoAccept', 'remember', 'claude']

export const distinctColors = (segments: Segment[]): Segment[] => {
  const taken = new Set(
    segments.filter(s => s.kind === 'used' && !GREYS.has(s.color)).map(s => s.color),
  )
  const spare = SPARE.filter(c => !taken.has(c))
  const seen = new Set<string>()

  return segments.map(s => {
    if (s.kind !== 'used') return s
    const isClash = GREYS.has(s.color) || seen.has(s.color)
    const color = isClash ? (spare.shift() ?? s.color) : s.color
    seen.add(color)
    return color === s.color ? s : { ...s, color }
  })
}

const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const breakdown = usage.context.breakdown
  if (!breakdown) return

  const segments: Segment[] = distinctColors(breakdown.categories.flatMap(c =>
    c.kind === 'deferred' || c.tokens <= 0
      ? []
      : [{ name: c.name, color: c.color, tokens: c.tokens, kind: c.kind }],
  ).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]))
  const next: Snapshot = {
    segments,
    totalTokens: breakdown.totalTokens,
    maxTokens: breakdown.rawMaxTokens,
    percentage: breakdown.percentage,
    compactAt: breakdown.isAutoCompactEnabled ? breakdown.autoCompactThreshold : undefined,
  }
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-bar',
      description: 'Toggle the context window bar above the prompt',
    })
    const stored = await $.store.get(STORE_KEY)
    if (typeof stored === 'boolean') await update($, isVisible, () => stored)
    void refresh($).catch(() => {})

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await refresh($).catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'context-bar' }, async $ => {
    const shown = !(await read($, isVisible))
    await update($, isVisible, () => shown)
    await $.store.set(STORE_KEY, shown)
    if (shown) await refresh($).catch(() => {})

    return { text: shown ? 'Context bar shown.' : 'Context bar hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isVisible))) return next(e)
    const snap = await read($, snapshot)
    if (!snap || snap.segments.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    // Border (2) and horizontal padding (2) around the bar.
    const cells = allocate(snap.segments, Math.max(10, e.props.bodyColumns - 4))
    const share = (tokens: number) => formatPercent((tokens / snap.maxTokens) * 100)
    const legend = snap.segments.filter(s => s.kind !== 'buffer')

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text>
            <Text color="claude">◆ </Text>
            <Text bold>context</Text>
          </Text>
          <Text wrap="truncate-start">
            <Text bold>{formatTokens(snap.totalTokens)}</Text>
            <Text dimColor> of </Text>
            <Text>{formatTokens(snap.maxTokens)}</Text>
            {snap.compactAt !== undefined && (
              <Text dimColor> · compacts at {formatTokens(snap.compactAt)}</Text>
            )}{' '}
            <Text bold color="inverseText" backgroundColor={snap.percentage >= 80 ? 'warning' : 'success'}>
              {` ${snap.percentage}% `}
            </Text>
          </Text>
        </Box>
        <Text wrap="truncate">
          {snap.segments.map((s, i) => {
            const n = cells[i] ?? 0
            if (n <= 0) return null
            if (s.kind === 'buffer') {
              return (
                <Text>
                  <Text color={MARKER_COLOR}>▏</Text>
                  {' '.repeat(n - 1)}
                </Text>
              )
            }
            return (
              <Text color={s.kind === 'free' ? FREE_COLOR : s.color} dimColor={s.kind === 'free'}>
                {'█'.repeat(n)}
              </Text>
            )
          })}
        </Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
          {legend.map(s =>
            s.kind === 'free' ? (
              <Text>
                <Text color={FREE_COLOR} dimColor>▌</Text>
                <Text dimColor> free </Text>
                <Text>{formatTokens(s.tokens)}</Text>
              </Text>
            ) : (
              <Text>
                <Text color={s.color}>▌</Text>
                <Text> {s.name.toLowerCase()} {formatTokens(s.tokens)} </Text>
                <Text dimColor>{share(s.tokens)}</Text>
              </Text>
            ),
          )}
        </Box>
      </Box>
    )
  })
}
