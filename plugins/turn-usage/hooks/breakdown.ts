import type { SessionContextBreakdown } from 'claude-code'

import { formatTokens } from './format'

const TOP = 5

const pad = (label: string, tokens: number, width = 26): string =>
  `  ${label.length > width - 1 ? `${label.slice(0, width - 2)}…` : label.padEnd(width)}${formatTokens(tokens).padStart(7)}`

const top = <T>(items: readonly T[], tokens: (item: T) => number): T[] =>
  [...items].sort((a, b) => tokens(b) - tokens(a)).slice(0, TOP)

const shortPath = (path: string): string => path.replace(/^\/Users\/[^/]+/, '~')

// Plain text for the transcript: what fills the window, then the biggest items
// inside the categories a person can trim (memory files, MCP servers, skills, agents).
export const formatBreakdown = (b: SessionContextBreakdown, isFull: boolean): string => {
  const lines: string[] = []
  const auto = b.isAutoCompactEnabled && b.autoCompactThreshold !== undefined
    ? ` · autocompact at ${formatTokens(b.autoCompactThreshold)}`
    : ''
  lines.push(`Context ${formatTokens(b.totalTokens)} / ${formatTokens(b.rawMaxTokens)} (${b.percentage}%) · ${b.model}${auto}`)
  lines.push(isFull ? '(exact counts)' : '(estimates; /usage-breakdown full for exact counts)')

  lines.push('', 'By category')
  for (const c of b.categories) {
    if (c.kind === 'used' && c.tokens > 0) lines.push(pad(c.name, c.tokens))
  }
  const deferred = b.categories.filter(c => c.kind === 'deferred').reduce((sum, c) => sum + c.tokens, 0)
  if (deferred > 0) lines.push(pad('Deferred (not loaded)', deferred))

  if (b.memoryFiles.length > 0) {
    lines.push('', 'Memory files')
    for (const f of top(b.memoryFiles, f => f.tokens)) lines.push(pad(shortPath(f.path), f.tokens, 48))
  }

  const servers = new Map<string, number>()
  for (const t of b.mcpTools) {
    if (t.isLoaded) servers.set(t.serverName, (servers.get(t.serverName) ?? 0) + t.tokens)
  }
  if (servers.size > 0) {
    lines.push('', 'MCP servers (loaded tools)')
    for (const [name, tokens] of top([...servers], s => s[1])) lines.push(pad(name, tokens, 48))
  }

  if (b.skills && b.skills.tokens > 0) {
    lines.push('', `Skills listing ${formatTokens(b.skills.tokens)} (${b.skills.includedSkills} of ${b.skills.totalSkills} listed)`)
    for (const s of top(b.skills.skillFrontmatter, s => s.tokens)) lines.push(pad(s.name, s.tokens, 48))
  }

  if (b.agents.length > 0) {
    lines.push('', 'Agent descriptions')
    for (const a of top(b.agents, a => a.tokens)) lines.push(pad(a.agentType, a.tokens, 48))
  }

  const u = b.apiUsage
  if (u) {
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    if (input > 0) {
      lines.push('', `Last request: ${formatTokens(input)} in, ${Math.round((u.cache_read_input_tokens / input) * 100)}% from cache`)
    }
  }
  return lines.join('\n')
}
