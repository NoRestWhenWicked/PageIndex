# AI Instructions (Memory Component)

Standing instructions that shape the agent's behavior beyond a single session.
`CLAUDE.md` is the short operational contract read at session start; this file is
the longer rationale and the place to draft changes before promoting them.

## Memory hygiene
- `MEMORY.md` is curated long-term memory — keep it small and current.
- `Sessions/` logs are the running record — append-only, never edited after the fact.
- When something durable changes, update `MEMORY.md` and note it in the session log.

## Retrieval policy
- Search the vault before the web. Prefer my own notes and prior sessions.
- When you cite an internal note, link it; when you cite the web, give the URL.

## Autonomy & guardrails
- Safe to do without asking: create notes, file captures, draft content, search.
- Ask first: deleting/overwriting notes, sending anything external (email, calendar
  invites), or large reorganizations of PARA.

## Continuity
- Begin every session by loading context (see `CLAUDE.md`).
- End every session with a log and, if needed, a memory update.

## Promoting changes
When a new standing rule proves useful, copy the concise version into `CLAUDE.md`
so it's enforced at session start.
