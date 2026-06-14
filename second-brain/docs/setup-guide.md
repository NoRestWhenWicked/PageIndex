# Setup Guide

How to stand up the second brain end to end. One-time setup, then the daily loop
takes over.

## 1. Install the tools
- **Claude Desktop** — the primary chat surface. Install and sign in.
- **Claude Code** — the CLI/agent that can read and edit this vault directly.
- **Obsidian** — the local note UI. Open this `second-brain/` folder as a vault.

See `tool-stack.md` for how each piece fits together.

## 2. Connect local files
- Point Claude (Desktop/Code) at this vault directory so it can read and write notes.
- In Obsidian, install community plugins you like (Templates, Daily Notes) and set
  the templates folder to `Templates/`.

## 3. Enable connectors (optional but recommended)
- **Calendar** — for the morning brief and meeting context.
- **Gmail / Drive** — for capturing and retrieving from existing sources.
- Connect via MCP. Grant the minimum scopes you need.

## 4. Configure the workspace
- Fill in `Memory/preferences.md` and `Memory/goals.md`.
- Summarize the essentials into `MEMORY.md`.
- Read `CLAUDE.md` and adjust the operating rules to taste.

## 5. Start the loop
- Run `Workflows/daily-workflow.md` tomorrow morning.
- Process the inbox at end of day (`Workflows/capture-processing.md`).
- Do your first `Workflows/weekly-review.md` at the end of the week.

## Checklist
- [ ] Tools installed and signed in
- [ ] Vault opened in Obsidian; templates folder set
- [ ] Claude connected to the vault directory
- [ ] Connectors authorized (calendar at minimum)
- [ ] `preferences.md`, `goals.md`, `MEMORY.md` filled in
