import type { EngineInterface, Register, TurnUsage } from 'claude-code'

import { formatBreakdown } from './breakdown'
import { formatTokens } from './format'

export { formatTokens }

const totalTokens = (u: TurnUsage): number =>
  u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

export const formatLine = (
  usage: TurnUsage,
  costUsd: number | undefined,
  durationMs: number,
  agentTokens: number,
): string => {
  const input = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  const cached = input > 0 ? Math.round((usage.cache_read_input_tokens / input) * 100) : 0
  const parts = [
    `last turn ${formatTokens(input)} in`,
    `${cached}% cached`,
    `${formatTokens(usage.output_tokens)} out`,
  ]
  if (costUsd !== undefined) parts.push(`$${costUsd.toFixed(2)}`)
  parts.push(`${Math.round(durationMs / 1000)}s`)
  if (agentTokens > 0) parts.push(`agents ${formatTokens(agentTokens)}`)
  return parts.join(' · ')
}

// Cost is a nicety: a failed lookup leaves it off the line rather than dropping the line.
const readCost = async ($: EngineInterface): Promise<number | undefined> => {
  try {
    return (await $.session.usage()).cost?.usd
  } catch {
    return undefined
  }
}

export const register: Register = on => {
  // Module variables reset on reload; that only loses the turn in flight.
  let costAtStart: number | undefined
  let agentTokens = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-breakdown',
      description: 'Show what fills the context window, biggest items first',
      argumentHint: '[full]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'usage-breakdown' }, async ($, e) => {
    const isFull = e.args.trim() === 'full'
    const usage = await $.session.usage({ breakdown: isFull ? 'full' : 'summary' })
    const breakdown = usage.context.breakdown
    if (!breakdown) return { text: 'No context breakdown is available in this session yet.' }
    return { text: formatBreakdown(breakdown, isFull) }
  })

  on('turn.start', async ($, e, next) => {
    costAtStart = await readCost($)
    agentTokens = 0
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const usage = done.usage ?? e.usage

    if (e.agentId !== undefined) {
      if (usage) agentTokens += totalTokens(usage)
      return done
    }
    if (!usage) return done

    const costNow = await readCost($)
    const costDelta =
      costNow !== undefined && costAtStart !== undefined ? costNow - costAtStart : undefined
    $.ui.status(formatLine(usage, costDelta, e.durationMs, agentTokens))
    return done
  })
}
