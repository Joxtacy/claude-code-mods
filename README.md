# claude-code-mods

Personal Claude Code mods (function-hook plugins).

| Mod | What it does |
| --- | --- |
| [`context-bar`](plugins/context-bar) | Draws the context window above the prompt as a stacked bar, one colour per `/context` category, with a legend and the auto-compact point. Toggle with `/context-bar`. |
| [`turn-usage`](plugins/turn-usage) | Per-turn token, cache-hit and cost line under the prompt. |

## Install

```
/plugin install context-bar --marketplace Joxtacy/claude-code-mods
/plugin install turn-usage --marketplace Joxtacy/claude-code-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

## Develop

```sh
claude --plugin-dir plugins/<mod>   # run a mod from its folder
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
```
