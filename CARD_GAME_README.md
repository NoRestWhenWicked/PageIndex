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
| 🦄 **Unicorn Chaos** | Friendship, sparkles, and mild chaos magic. |
| 🐱 **Cat-astrophe** | Chaotic feline energy — knock it all off the table. |
| ⚔️ **Deck Mayhem** | A real-time card battler — pick a hero, last one standing wins. |

All card content is original.

### Game feel

- **Sound & haptics** — synthesized blips/fanfares (no audio files) for card
  selection, submission, reveals, wins, and battle hits/shields/heals, plus a
  vibration buzz on supporting devices. Toggle with the 🔊 button (saved per
  browser); respects `prefers-reduced-motion`.
- **Confetti** bursts when you win a round or a battle.
- **Streaks & crown** — the scoreboard flags the current leader (👑) and shows a
  🔥 badge for consecutive round wins.

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

> **Note:** The Next.js app lives at the **repository root** (so Vercel's
> default Root Directory works with no extra config). The Python PageIndex
> project also lives in this repo and is independent of the web app.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Open the site in two browser windows (or a normal + incognito window) to see
multiplayer presence in action.

### Simulate / test the game logic

```bash
npm test          # or: npm run sim
```

This drives every game through its real server logic against the in-memory
store — solo + AI party rounds and full Deck Mayhem matches to a winner —
asserting invariants (hand sizes, scoring, HP/shield ranges, no stalls). A fast,
dependency-light smoke test for the rules engine.

## Deploy to Vercel

1. Import this repository into Vercel (leave **Root Directory** as the repo root).
2. Deploy. (Framework preset: Next.js — auto-detected.)

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

### Optional: AI-generated card art

Cards show an auto-generated procedural SVG icon by default (no setup). To
upgrade to real AI-generated sticker images, set an image API key in the
project's environment variables:

```
OPENAI_API_KEY     enables AI card art (required)
CARD_ART_MODEL     optional, default "dall-e-2" (cheap, 256px). Try "gpt-image-1".
CARD_ART_SIZE      optional, default "256x256"
```

Images are generated on demand the first time a card appears and cached
(Vercel KV if configured, else in-memory) so each distinct card costs at most
one generation, ever. Until a key is set, the procedural icons are used and the
`/api/cardart` endpoint simply returns nothing.

#### Build-time art (pre-generate & commit)

For instant, zero-runtime-cost art, pre-generate every card image once and
commit them as static assets:

```bash
npm install
OPENAI_API_KEY=sk-... npm run gen:art
git add public/cardart && git commit -m "Add generated card art" && git push
```

This writes `public/cardart/<hash>.png` and a `manifest.json`. The app prefers
these static images, then falls back to the runtime endpoint, then the
procedural icon. Re-running only fills in newly added cards.

## Project layout

```
├── app/
│   ├── page.tsx                 # lobby (server) → Lobby.tsx (client)
│   ├── Lobby.tsx                # game grid + live player counts
│   ├── play/[game]/page.tsx     # room (server) → GameRoom.tsx (client)
│   ├── play/[game]/GameRoom.tsx # the interactive table (poll-based realtime)
│   └── api/
│       ├── presence/route.ts    # heartbeat + online/per-game counts
│       └── room/[game]/route.ts # join, submit, vote, next, reset
├── lib/
    ├── games.ts                 # the three decks (prompts + answers)
    ├── room.ts                  # game-room state machine + view builder
    ├── store.ts                 # memory / Vercel KV persistence
    ├── identity.ts              # client-side player id + random name
    └── types.ts
```

Realtime is done with simple polling (presence ~4s, room ~2s) so it runs on
plain Vercel serverless with no websocket infrastructure.
