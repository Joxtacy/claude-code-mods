// 42300 -> "42.3k", matching ~/.claude/statusline.sh.
export const formatTokens = (n: number): string =>
  n >= 1_000_000 ? `${(Math.floor(n / 100_000) / 10).toFixed(1)}M`
  : n >= 1_000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}k`
  : String(n)
