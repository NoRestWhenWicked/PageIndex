# 🎉 Party Card Games

Absurd party card games you can enjoy **solo** — and the moment anyone else
opens the site, they show up live and can play the **same round together**. No
sign-up, no accounts, just bad decisions.

Built with **Next.js (App Router)** and designed to deploy to **Vercel** in one
click.

## The games

| Game | Vibe |
| --- | --- |
| 🃏 **Fill In The Blank** | Cards Against Humanity-style "complete the sentence" chaos. |
| 🛋️ **Horrible Therapist** | A patient describes a real problem — you give the worst possible advice. |
| 🚩 **Red Flags** | "The date was going great… until ___." Describe the dealbreaker. |

All card content is original.

## How it works

### The lobby (`/`)
- Shows every available game with a **live player count** ("3 playing now").
- A pulsing pill shows how many people are **online across the whole site**.
- Counts refresh every few seconds via lightweight presence heartbeats.

### A game room (`/play/<game>`)
Each game is one shared, always-on table that works for **1 to N players**:

1. **Submit** — everyone gets a hand of 7 answer cards and plays into the prompt.
2. **Vote** — submissions are revealed anonymously; vote for your favourite
   (you can't vote for your own).
3. **Results** — votes are tallied, the winner gets a point, scoreboard updates,
   then **Next round** deals fresh cards.

**Solo mode** is automatic: if you're the only one there, submitting reveals
your combo immediately and you keep dealing yourself new prompts — genuinely fun
to do alone. When a second person opens the same URL, they're dealt in and the
round switches to voting automatically. **Skip waiting** buttons keep things
moving if someone goes AFK.

Your display name + id are stored in `localStorage` (editable in the top-right).

## Run locally

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

Open the site in two browser windows (or a normal + incognito window) to see
multiplayer presence in action.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Set the project's **Root Directory** to `web`.
3. Deploy. (Framework preset: Next.js — auto-detected.)

### Multiplayer across many users (recommended for production)

The app keeps presence + game state in a tiny key/value store. With **no
configuration** it uses an in-process memory store, which is perfect for local
dev and works on a single serverless instance.

For real multiplayer at scale on Vercel, serverless functions don't share
memory, so add a **Vercel KV** (or any Upstash Redis) store and set these env
vars — the app auto-detects them and switches over with zero code changes:

```
KV_REST_API_URL      (or UPSTASH_REDIS_REST_URL)
KV_REST_API_TOKEN    (or UPSTASH_REDIS_REST_TOKEN)
```

On Vercel: **Storage → Create → KV**, attach it to the project, and these
variables are injected automatically. Redeploy and presence + rooms are shared
across all instances.

## Project layout

```
web/
├── app/
│   ├── page.tsx                 # lobby (server) → Lobby.tsx (client)
│   ├── Lobby.tsx                # game grid + live player counts
│   ├── play/[game]/page.tsx     # room (server) → GameRoom.tsx (client)
│   ├── play/[game]/GameRoom.tsx # the interactive table (poll-based realtime)
│   └── api/
│       ├── presence/route.ts    # heartbeat + online/per-game counts
│       └── room/[game]/route.ts # join, submit, vote, next, reset
└── lib/
    ├── games.ts                 # the three decks (prompts + answers)
    ├── room.ts                  # game-room state machine + view builder
    ├── store.ts                 # memory / Vercel KV persistence
    ├── identity.ts              # client-side player id + random name
    └── types.ts
```

Realtime is done with simple polling (presence ~4s, room ~2s) so it runs on
plain Vercel serverless with no websocket infrastructure.
