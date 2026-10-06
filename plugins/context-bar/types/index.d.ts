export type Segment = {
  name: string
  color: string
  tokens: number
  kind: 'used' | 'free' | 'buffer'
}

export type Snapshot = {
  segments: Segment[]
  totalTokens: number
  maxTokens: number
  percentage: number
  compactAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { snapshot: Snapshot | null; isVisible: boolean }
  }
}
