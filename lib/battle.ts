import type { BattleState, BattleView, BattleSeat, BattleCard } from "./types";
import { HEROES, getHero, getCard } from "./heroes";
import { getJSON, setJSON, presenceForGame } from "./store";

const MAX_HP = 10;
const HAND_SIZE = 3;
const TARGET_SEATS = 4;
const BOT_TURN_DELAY = 1100; // ms, so a human can watch AI turns unfold
const ROOM_TTL = 60 * 60 * 6;
const BOT_NAMES = ["Botzilla", "CPUcake", "RoboRival", "AI-yai-yai", "Deepfried"];

const key = (game: string) => `battle:${game}`;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshState(game: string): BattleState {
  return {
    game,
    phase: "select",
    seats: [],
    hands: {},
    decks: {},
    discards: {},
    turn: "",
    turnSince: Date.now(),
    log: [],
    matchNo: 0,
    picks: {},
  };
}

async function loadBattle(game: string): Promise<BattleState> {
  const s = await getJSON<BattleState>(key(game));
  return s || freshState(game);
}
async function saveBattle(s: BattleState): Promise<void> {
  await setJSON(key(s.game), s, ROOM_TTL);
}

function logPush(s: BattleState, line: string) {
  s.log.push(line);
  if (s.log.length > 12) s.log = s.log.slice(-12);
}

/* ---------- deck / draw ---------- */
function drawOne(s: BattleState, id: string): string | null {
  let deck = s.decks[id] || [];
  if (deck.length === 0) {
    deck = shuffle(s.discards[id] || []);
    s.discards[id] = [];
    s.decks[id] = deck;
  }
  if (deck.length === 0) return null;
  const card = deck.pop()!;
  (s.hands[id] ||= []).push(card);
  return card;
}
function drawTo(s: BattleState, id: string, size: number) {
  let guard = 50;
  while ((s.hands[id]?.length || 0) < size && guard-- > 0) {
    if (!drawOne(s, id)) break;
  }
}
function drawN(s: BattleState, id: string, n: number) {
  for (let i = 0; i < n; i++) if (!drawOne(s, id)) break;
}

/* ---------- seats / turns ---------- */
function seatOf(s: BattleState, id: string): BattleSeat | undefined {
  return s.seats.find((x) => x.id === id);
}
function aliveSeats(s: BattleState): BattleSeat[] {
  return s.seats.filter((x) => x.alive);
}
function nextAlive(s: BattleState, fromId: string): string {
  const idx = s.seats.findIndex((x) => x.id === fromId);
  for (let step = 1; step <= s.seats.length; step++) {
    const seat = s.seats[(idx + step) % s.seats.length];
    if (seat.alive) return seat.id;
  }
  return fromId;
}

function applyDamage(target: BattleSeat, value: number): string {
  const absorbed = Math.min(target.shield, value);
  target.shield -= absorbed;
  const dmg = value - absorbed;
  target.hp -= dmg;
  let note = "";
  if (absorbed > 0) note += ` (${absorbed} blocked)`;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    note += " 💀";
  }
  return note;
}

function checkWin(s: BattleState) {
  const alive = aliveSeats(s);
  if (alive.length <= 1 && s.phase === "playing") {
    s.phase = "over";
    s.winnerId = alive[0]?.id;
    logPush(s, alive[0] ? `🏆 ${alive[0].name} wins the match!` : "Everyone fell — no winner.");
  }
}

/** Resolve one card's effects. `targetId` is the chosen attack target. */
function resolveCard(s: BattleState, actor: BattleSeat, card: BattleCard, targetId?: string) {
  for (const eff of card.effects) {
    if (eff.kind === "attack") {
      const opponents = aliveSeats(s).filter((x) => x.id !== actor.id);
      let target = targetId ? seatOf(s, targetId) : undefined;
      if (!target || !target.alive || target.id === actor.id) {
        // default: hit the weakest opponent
        target = [...opponents].sort((a, b) => a.hp + a.shield - (b.hp + b.shield))[0];
      }
      if (target) {
        const note = applyDamage(target, eff.value);
        logPush(s, `${card.icon} ${actor.name} hits ${target.name} for ${eff.value}${note}`);
      }
    } else if (eff.kind === "shield") {
      actor.shield += eff.value;
      logPush(s, `${card.icon} ${actor.name} gains ${eff.value} shield`);
    } else if (eff.kind === "heal") {
      const before = actor.hp;
      actor.hp = Math.min(MAX_HP, actor.hp + eff.value);
      logPush(s, `${card.icon} ${actor.name} heals ${actor.hp - before}`);
    } else if (eff.kind === "draw") {
      drawN(s, actor.id, eff.value);
      logPush(s, `${card.icon} ${actor.name} draws ${eff.value}`);
    }
  }
}

function playCardInternal(s: BattleState, seatId: string, cardId: string, targetId?: string): boolean {
  if (s.phase !== "playing" || s.turn !== seatId) return false;
  const actor = seatOf(s, seatId);
  if (!actor || !actor.alive) return false;
  const hand = s.hands[seatId] || [];
  const pos = hand.indexOf(cardId);
  if (pos < 0) return false;
  const card = getCard(cardId);
  if (!card) return false;
  hand.splice(pos, 1);
  (s.discards[seatId] ||= []).push(cardId);
  resolveCard(s, actor, card, targetId);
  checkWin(s);
  return true;
}

function endTurnInternal(s: BattleState, seatId: string) {
  if (s.phase !== "playing" || s.turn !== seatId) return;
  const nxt = nextAlive(s, seatId);
  s.turn = nxt;
  s.turnSince = Date.now();
  drawTo(s, nxt, HAND_SIZE);
}

/* ---------- AI ---------- */
function botTakeTurn(s: BattleState, seatId: string) {
  const me = seatOf(s, seatId);
  if (!me) return;
  let guard = 16;
  while (guard-- > 0 && s.phase === "playing" && s.turn === seatId && me.alive) {
    const hand = (s.hands[seatId] || []).map((id) => getCard(id)!).filter(Boolean);
    if (hand.length === 0) break;

    const has = (k: string) => hand.find((c) => c.effects.some((e) => e.kind === k));
    const missing = MAX_HP - me.hp;
    let pick: BattleCard | undefined;

    // 1) play draws to expand options
    pick = has("draw");
    // 2) heal when meaningfully hurt
    if (!pick && missing >= 3) pick = has("heal");
    // 3) attack
    if (!pick) pick = hand.find((c) => c.effects.some((e) => e.kind === "attack"));
    // 4) shield up if not over-shielded
    if (!pick && me.shield < 6) pick = has("shield");
    // 5) anything left
    if (!pick) pick = hand[0];
    if (!pick) break;

    // choose weakest opponent for any attack
    const target = aliveSeats(s)
      .filter((x) => x.id !== seatId)
      .sort((a, b) => a.hp + a.shield - (b.hp + b.shield))[0];
    playCardInternal(s, seatId, pick.id, target?.id);
  }
  if (s.phase === "playing" && s.turn === seatId) endTurnInternal(s, seatId);
}

/* ---------- match setup ---------- */
function initMatch(s: BattleState, humans: Array<{ id: string; name: string }>) {
  const used = new Set<string>();
  const assignHero = (preferred?: string) => {
    if (preferred && getHero(preferred) && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    const free = HEROES.find((h) => !used.has(h.id));
    const chosen = free ? free.id : HEROES[Math.floor(Math.random() * HEROES.length)].id;
    used.add(chosen);
    return chosen;
  };

  const seats: BattleSeat[] = [];
  for (const h of humans) {
    seats.push({
      id: h.id,
      name: h.name,
      heroId: assignHero(s.picks[h.id]),
      hp: MAX_HP,
      shield: 0,
      alive: true,
      isBot: false,
    });
  }
  let b = 0;
  while (seats.length < TARGET_SEATS) {
    const heroId = assignHero();
    seats.push({
      id: `bot:${b}`,
      name: BOT_NAMES[b % BOT_NAMES.length],
      heroId,
      hp: MAX_HP,
      shield: 0,
      alive: true,
      isBot: true,
    });
    b++;
  }

  s.seats = seats;
  s.hands = {};
  s.decks = {};
  s.discards = {};
  for (const seat of seats) {
    const hero = getHero(seat.heroId)!;
    s.decks[seat.id] = shuffle(hero.deck.map((c) => c.id));
    s.discards[seat.id] = [];
    s.hands[seat.id] = [];
    drawTo(s, seat.id, HAND_SIZE);
  }
  s.turn = seats[0].id;
  s.turnSince = Date.now();
  s.phase = "playing";
  s.matchNo += 1;
  s.winnerId = undefined;
  s.log = [`⚔️ Match ${s.matchNo}: ${seats.map((x) => x.name).join(" vs ")}`];
}

/* ---------- view ---------- */
function buildView(s: BattleState, meId: string): BattleView {
  const turnSeat = seatOf(s, s.turn);
  const mySeat = seatOf(s, meId);
  const myHand = (s.hands[meId] || []).map((id) => getCard(id)!).filter(Boolean) as BattleCard[];
  return {
    game: s.game,
    phase: s.phase,
    matchNo: s.matchNo,
    maxHp: MAX_HP,
    you: {
      id: meId,
      seated: !!mySeat,
      heroId: mySeat?.heroId,
      hand: s.phase === "playing" ? myHand : [],
      isTurn: s.phase === "playing" && s.turn === meId && !!mySeat?.alive,
      alive: !!mySeat?.alive,
    },
    seats: s.seats.map((seat) => {
      const hero = getHero(seat.heroId)!;
      return {
        id: seat.id,
        name: seat.name,
        heroId: seat.heroId,
        heroName: hero.name,
        heroEmoji: hero.emoji,
        accent: hero.accent,
        hp: seat.hp,
        shield: seat.shield,
        alive: seat.alive,
        isBot: seat.isBot,
        isYou: seat.id === meId,
        isTurn: s.phase === "playing" && s.turn === seat.id,
        handCount: (s.hands[seat.id] || []).length,
      };
    }),
    heroes: HEROES.map((h) => ({ id: h.id, name: h.name, emoji: h.emoji, accent: h.accent, blurb: h.blurb })),
    yourPick: s.picks[meId],
    turnName: turnSeat?.name || "",
    log: s.log,
    winnerName: s.winnerId ? seatOf(s, s.winnerId)?.name : undefined,
  };
}

async function humansForGame(game: string, meId: string, meName: string) {
  const presence = await presenceForGame(game);
  const map = new Map<string, string>();
  for (const p of presence) map.set(p.id, p.name);
  map.set(meId, meName); // ensure caller included
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

/* ---------- public ---------- */
export async function battleTick(game: string, meId: string, meName: string): Promise<BattleView> {
  const s = await loadBattle(game);
  // run at most one ready AI turn per tick so the human can follow the action
  if (s.phase === "playing") {
    const turnSeat = seatOf(s, s.turn);
    if (turnSeat?.isBot && Date.now() - s.turnSince >= BOT_TURN_DELAY) {
      botTakeTurn(s, s.turn);
    }
  }
  await saveBattle(s);
  return buildView(s, meId);
}

export type BattleActionInput =
  | { type: "pick"; heroId: string }
  | { type: "start" }
  | { type: "play"; cardId: string; targetId?: string }
  | { type: "end" }
  | { type: "again" };

export async function battleAction(
  game: string,
  meId: string,
  meName: string,
  action: BattleActionInput
): Promise<BattleView> {
  const s = await loadBattle(game);

  switch (action.type) {
    case "pick":
      if (s.phase === "select" && getHero(action.heroId)) s.picks[meId] = action.heroId;
      break;
    case "start":
      if (s.phase !== "playing") {
        const humans = await humansForGame(game, meId, meName);
        initMatch(s, humans);
      }
      break;
    case "play":
      playCardInternal(s, meId, action.cardId, action.targetId);
      break;
    case "end":
      endTurnInternal(s, meId);
      break;
    case "again":
      s.phase = "select";
      s.seats = [];
      s.winnerId = undefined;
      break;
  }

  await saveBattle(s);
  return buildView(s, meId);
}
