# Tool Stack

The pieces that make up the second brain and how they fit together.

| Tool | Role |
|------|------|
| **Claude Opus** | The reasoning engine for deep work — research, synthesis, planning. |
| **Claude Code** | Agent with direct read/write access to the vault files. Runs workflows, files notes, maintains memory. |
| **Claude Desktop** | Everyday chat surface; good for quick capture and Q&A. |
| **Obsidian Vault** | Local, plain-Markdown UI for browsing, linking, and editing notes. This `second-brain/` folder *is* the vault. |
| **MCP Connectors** | Bridges to external data — Calendar, Gmail, Drive — so the agent can pull context and act. |

## How they work together
1. **Capture** happens anywhere (Desktop, Obsidian mobile, a connector) into `Daily/Captures/` or `PARA/Inbox/`.
2. **Organize** is driven by Claude Code, which moves captures into PARA and applies templates.
3. **Memory** lives in plain Markdown (`MEMORY.md`, `Memory/`) so every tool can read it.
4. **Act** — the agent uses connectors (calendar, mail) under explicit guardrails (`Memory/ai-instructions.md`).

## Principles
- **Plain text, local-first.** Markdown means no lock-in and every tool can read it.
- **One vault, many surfaces.** Don't fragment notes across apps — tool-hopping is a known pitfall (`pitfalls-to-avoid.md`).
- **Least privilege for connectors.** Grant only the scopes a workflow needs.
