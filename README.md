# claude-code-mods

Personal Claude Code mods (function-hook plugins).

| Mod | What it does |
| --- | --- |
| [`context-bar`](plugins/context-bar) | Draws the context window above the prompt as a stacked bar, one colour per `/context` category, with a legend and the auto-compact point. Toggle with `/context-bar`. |
| [`turn-usage`](plugins/turn-usage) | Per-turn token, cache-hit and cost line under the prompt. |

## Install

From a local checkout:

```
/plugin marketplace add ~/PrivateProjects/claude-code-mods
/plugin install context-bar@claude-code-mods
/plugin install turn-usage@claude-code-mods
```

## Develop

```sh
claude --plugin-dir plugins/<mod>   # run a mod from its folder
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
```
