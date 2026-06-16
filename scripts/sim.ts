/* Simulation harness — "plays" every game through its real server logic
 * against the in-memory store, asserting invariants to surface bugs.
 * Run: npx tsx scripts/sim.ts   (not shipped in the app bundle) */
import { GAMES } from "../lib/games";
import { HEROES } from "../lib/heroes";
import { tick, applyAction } from "../lib/room";
import { battleTick, battleAction } from "../lib/battle";
import { heartbeat } from "../lib/store";

// Virtual clock: lets us fast-forward past the bots' real-time "thinking"
// delays without sleeping, so battles resolve deterministically and quickly.
let virtualNow = Date.now();
Date.now = () => virtualNow;
const advanceClock = (ms: number) => {
  virtualNow += ms;
};

let failures = 0;
let checks = 0;
function check(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  }
}

/* ---------------- Party games: solo + bots ---------------- */
async function playParty(gameId: string, rounds: number) {
  const me = "human:1";
  const name = "Tester";
  // Heartbeat so presence sees us in this game.
  await heartbeat(me, name, gameId);
  let v = await tick(gameId, me, name);
  check(v.bots > 0, `${gameId}: bots should fill a solo table (got ${v.bots})`);

  for (let r = 0; r < rounds; r++) {
    // submit phase
    let guard = 40;
    while (v.phase === "submitting" && guard-- > 0) {
      await heartbeat(me, name, gameId);
      v = await tick(gameId, me, name);
      if (v.you.submitted) continue;
      const need = v.pick;
      check(v.you.hand.length >= need, `${gameId} r${v.roundNo}: hand (${v.you.hand.length}) < pick (${need})`);
      const ids = v.you.hand.slice(0, need).map((c) => c.id);
      v = await applyAction(gameId, me, name, { type: "submit", cardIds: ids });
      check(v.you.submitted, `${gameId} r${v.roundNo}: submit didn't register`);
      // force everyone else so we don't loop forever on bot delays
      v = await applyAction(gameId, me, name, { type: "force" });
    }
    // voting phase
    guard = 40;
    while (v.phase === "voting" && guard-- > 0) {
      await heartbeat(me, name, gameId);
      v = await tick(gameId, me, name);
      if (!v.you.voted) {
        const other = v.table.find((t) => !t.isYours);
        check(!!other, `${gameId} r${v.roundNo}: nothing to vote for`);
        if (other) v = await applyAction(gameId, me, name, { type: "vote", choiceKey: other.key });
      }
      v = await applyAction(gameId, me, name, { type: "force" });
    }
    // results
    check(v.phase === "results", `${gameId} r${v.roundNo}: expected results, got ${v.phase}`);
    check(v.table.length > 0, `${gameId} r${v.roundNo}: empty results table`);
    // every revealed submission should have an owner name and card text
    for (const t of v.table) {
      check(!!t.ownerName, `${gameId} r${v.roundNo}: missing ownerName at results`);
      check(t.cards.every((c) => c.text && c.text !== "(missing card)"), `${gameId} r${v.roundNo}: missing card text`);
    }
    // a winner should exist (votes were cast)
    check(v.table.some((t) => t.isWinner), `${gameId} r${v.roundNo}: no winner flagged`);
    // advance
    v = await applyAction(gameId, me, name, { type: "next" });
    check(v.phase === "submitting", `${gameId}: next didn't start a new round`);
    check(v.roundNo === r + 2, `${gameId}: roundNo should be ${r + 2}, got ${v.roundNo}`);
    check(v.you.hand.length === 7, `${gameId} r${v.roundNo}: hand not refilled to 7 (got ${v.you.hand.length})`);
  }
  // scoreboard sanity
  const total = v.players.reduce((s, p) => s + p.score, 0);
  check(total >= rounds, `${gameId}: total score (${total}) < rounds played (${rounds})`);
  return v;
}

/* ---------------- Battle: full match to a winner ---------------- */
async function playBattle(gameId: string, heroId: string) {
  const me = "human:b";
  const name = "Fighter";
  await heartbeat(me, name, gameId);
  let v = await battleTick(gameId, me, name);
  check(v.phase === "select", `${gameId}: battle should begin in select`);
  v = await battleAction(gameId, me, name, { type: "pick", heroId });
  v = await battleAction(gameId, me, name, { type: "start" });
  check(v.phase === "playing", `${gameId}: battle should be playing after start`);
  check(v.seats.length === 4, `${gameId}: expected 4 seats, got ${v.seats.length}`);
  const mySeat = v.seats.find((s) => s.isYou);
  check(mySeat?.heroId === heroId, `${gameId}: my hero pick (${heroId}) not honored`);
  // every seat must reference a real hero (catches a missing 5th-hero wiring)
  check(v.seats.every((s) => !!s.heroName && !!s.heroEmoji), `${gameId}: seat with unknown hero`);

  let guard = 2000;
  while (v.phase === "playing" && guard-- > 0) {
    if (v.you.isTurn && v.you.alive) {
      if (v.you.hand.length > 0) {
        const card = v.you.hand[0];
        const foe = v.seats.find((s) => s.alive && !s.isYou);
        v = await battleAction(gameId, me, name, { type: "play", cardId: card.id, targetId: foe?.id });
      }
      v = await battleAction(gameId, me, name, { type: "end" });
    } else {
      // fast-forward past the bot's "thinking" delay on the virtual clock,
      // then tick so it takes its turn.
      advanceClock(1500);
      v = await battleTick(gameId, me, name);
    }
    // HP/shield invariants
    for (const s of v.seats) {
      check(s.hp >= 0 && s.hp <= v.maxHp, `${gameId}: seat ${s.name} hp out of range (${s.hp})`);
      check(s.shield >= 0, `${gameId}: seat ${s.name} negative shield (${s.shield})`);
    }
  }
  check(v.phase === "over" || guard <= 0, `${gameId}: battle didn't end (phase ${v.phase})`);
  if (guard <= 0) check(false, `${gameId}: battle exceeded guard — possible stall (turn=${v.turnName})`);
  check(!!v.winnerName, `${gameId}: no winner at battle end`);
  return v;
}

async function main() {
  console.log("▶ Party games");
  for (const g of GAMES) {
    process.stdout.write(`  ${g.emoji} ${g.name} … `);
    await playParty(g.id, 3);
    console.log("done");
  }
  console.log("▶ Deck Mayhem battles");
  const heroIds = HEROES.map((h) => h.id);
  for (let i = 0; i < GAMES.length; i++) {
    const g = GAMES[i];
    const hero = heroIds[i % heroIds.length]; // rotate through all heroes incl. golem
    process.stdout.write(`  battle:${g.id} as ${hero} … `);
    const v = await playBattle("battle:" + g.id, hero);
    console.log(`won by ${v.winnerName}`);
  }

  console.log(`\n${checks} checks, ${failures} failures.`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
