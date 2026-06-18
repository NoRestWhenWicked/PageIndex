# Daily Workflow

The repeatable loop that keeps the second brain alive. Most steps take minutes.

## Morning brief
Ask the agent for a morning brief. It should:
1. Read `MEMORY.md` and the latest `Sessions/` log for context.
2. Review today's calendar (via the Calendar connector) and flag conflicts.
3. Surface the top 3 priorities from `Memory/goals.md` and active `PARA/Projects/`.
4. List anything waiting in `PARA/Inbox/`.

## Through the day — capture
- Dump everything into a daily capture note (`Templates/daily-capture.md`) in
  `Daily/Captures/`. Don't organize while capturing — speed beats structure here.

## Task planning
- Turn the morning's priorities into a short, ordered task list.
- Keep it to what's realistic for today; defer the rest.

## Knowledge retrieval
- When you need something you've seen before, ask the agent to search the vault
  first (notes, sessions, resources) before searching the web.

## End of day — process & log
1. Run `capture-processing.md` to empty the inbox into PARA.
2. Have the agent write a session log (`Templates/session-log.md`) in `Sessions/`.
3. Update `MEMORY.md` if anything durable changed.

> Rule of thumb: **capture all day, organize once, log every session.**
