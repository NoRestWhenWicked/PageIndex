import type {
  GameDef,
  RoomState,
  RoomView,
  RoundState,
  AnswerCard,
} from "./types";
import { getGame } from "./games";
import { getJSON, setJSON, presenceForGame } from "./store";

const HAND_SIZE = 7;
const ROOM_TTL = 60 * 60 * 6; // 6h

const roomKey = (game: string) => `room:${game}`;

/* ---------- AI players (fill the table when you're the only human) ---------- */
const BOT_PREFIX = "bot:";
const TABLE_TARGET = 5; // total players to aim for when solo (odd # reduces ties)
const BOT_MIN_DELAY = 1200; // ms a bot "thinks" before acting
const BOT_MAX_DELAY = 4200;
const BOT_NAMES = [
  "HAL 9001",
  "GLaDOS Jr.",
  "Clippy",
  "DeepThought",
  "Megahurtz",
  "Skynet (intern)",
  "Bender Jr.",
  "Lt. Data",
  "Roomba 3000",
  "WALL·Eeep",
  "C-3PNO",
  "Marvin",
];

const isBotId = (id: string) => id.startsWith(BOT_PREFIX);

/* ---------- small deterministic helpers ---------- */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dealCards(game: GameDef, exclude: Set<string>, n: number): string[] {
  const pool = game.answers.map((a) => a.id).filter((id) => !exclude.has(id));
  const dealt: string[] = [];
  // sample without replacement from the remaining pool
  const bag = [...pool];
  for (let i = 0; i < n && bag.length > 0; i++) {
    const idx = Math.floor(Math.random() * bag.length);
    dealt.push(bag[idx]);
    bag.splice(idx, 1);
  }
  return dealt;
}

function newRoundState(game: GameDef, recent: string[]): RoundState {
  const candidates = game.prompts.filter((p) => !recent.includes(p.id));
  const prompt = pickRandom(candidates.length ? candidates : game.prompts);
  return {
    roundNo: 1,
    phase: "submitting",
    prompt,
    submissions: [],
    votes: {},
    phaseSince: Date.now(),
  };
}

function freshRoom(gameId: string): RoomState {
  const game = getGame(gameId)!;
  return {
    game: gameId,
    round: newRoundState(game, []),
    hands: {},
    scores: {},
    streaks: {},
    names: {},
    recentPromptIds: [],
    bots: [],
  };
}

async function loadRoom(gameId: string): Promise<RoomState> {
  const existing = await getJSON<RoomState>(roomKey(gameId));
  if (existing) {
    // backfill any fields added since the room was created
    existing.names ||= {};
    existing.streaks ||= {};
    existing.recentPromptIds ||= [];
    existing.bots ||= [];
    if (existing.round.phaseSince === undefined) existing.round.phaseSince = Date.now();
    return existing;
  }
  return freshRoom(gameId);
}

/* ---------- AI roster + behaviour ---------- */
/** ms a given bot waits before acting this phase (deterministic, varied). */
function botDelay(roundNo: number, botId: string, phase: string): number {
  const h = hashStr(`${roundNo}:${botId}:${phase}`);
  return BOT_MIN_DELAY + (h % (BOT_MAX_DELAY - BOT_MIN_DELAY));
}

/**
 * Keep the bot roster sized to the situation: when exactly one human is
 * present, top the table up with AI opponents; otherwise (real multiplayer or
 * empty room) run no bots. Only safe to call at a round boundary.
 */
function reconcileBots(room: RoomState, humanCount: number) {
  const desired = humanCount === 1 ? TABLE_TARGET - 1 : 0;
  const offset = hashStr(room.game);

  while (room.bots.length < desired) {
    const idx = room.bots.length;
    const id = `${BOT_PREFIX}${idx + 1}`;
    const name = BOT_NAMES[(offset + idx) % BOT_NAMES.length];
    room.bots.push({ id, name });
    room.names[id] = name;
    if (room.scores[id] === undefined) room.scores[id] = 0;
  }
  while (room.bots.length > desired) {
    const b = room.bots.pop()!;
    delete room.scores[b.id];
    delete room.names[b.id];
    delete room.hands[b.id];
  }
}

/** Have any bots that are "ready" make their move for the current phase. */
function botMoves(room: RoomState, game: GameDef, now: number, immediate = false) {
  const round = room.round;
  const since = round.phaseSince ?? now;

  if (round.phase === "submitting") {
    const submitted = new Set(round.submissions.map((s) => s.playerId));
    const need = round.prompt.pick || 1;
    for (const b of room.bots) {
      if (submitted.has(b.id)) continue;
      if (immediate || now - since >= botDelay(round.roundNo, b.id, "submit")) {
        round.submissions.push({ playerId: b.id, cardIds: dealCards(game, new Set(), need) });
      }
    }
  } else if (round.phase === "voting") {
    const voted = new Set(Object.keys(round.votes));
    for (const b of room.bots) {
      if (voted.has(b.id)) continue;
      if (immediate || now - since >= botDelay(round.roundNo, b.id, "vote")) {
        const options = round.submissions.filter((s) => s.playerId !== b.id);
        if (options.length) {
          const choice = options[hashStr(`${round.roundNo}:${b.id}:vote`) % options.length];
          round.votes[b.id] = choice.playerId;
        }
      }
    }
  }
}

async function saveRoom(room: RoomState): Promise<void> {
  await setJSON(roomKey(room.game), room, ROOM_TTL);
}

/* ---------- per-player upkeep ---------- */
function ensurePlayer(room: RoomState, game: GameDef, id: string, name: string) {
  room.names[id] = name;
  if (room.scores[id] === undefined) room.scores[id] = 0;
  if (!room.hands[id]) {
    room.hands[id] = dealCards(game, new Set(), HAND_SIZE);
  }
}

function refillHands(room: RoomState, game: GameDef, ids: string[]) {
  for (const id of ids) {
    const hand = room.hands[id] || [];
    const need = HAND_SIZE - hand.length;
    if (need > 0) {
      const extra = dealCards(game, new Set(hand), need);
      room.hands[id] = [...hand, ...extra];
    }
  }
}

function startNextRound(room: RoomState, game: GameDef, activeIds: string[]) {
  const prev = room.round;
  const recent = [prev.prompt.id, ...room.recentPromptIds].slice(0, 8);
  const next = newRoundState(game, recent);
  next.roundNo = prev.roundNo + 1;
  room.round = next;
  room.recentPromptIds = recent;
  refillHands(room, game, activeIds);
}

/** Deterministic, stable ordering of submissions for a round (anonymised). */
function orderedSubmissions(round: RoundState) {
  return [...round.submissions].sort(
    (a, b) =>
      hashStr(round.roundNo + a.playerId) - hashStr(round.roundNo + b.playerId)
  );
}

function tally(round: RoundState): { winnerIds: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const sub of round.submissions) counts[sub.playerId] = 0;
  for (const owner of Object.values(round.votes)) {
    if (counts[owner] !== undefined) counts[owner] += 1;
  }
  let best = -1;
  for (const sub of round.submissions) best = Math.max(best, counts[sub.playerId]);
  // a tie keeps ALL top-voted players as co-winners (each scores a point)
  const winnerIds =
    best > 0 ? round.submissions.filter((s) => counts[s.playerId] === best).map((s) => s.playerId) : [];
  return { winnerIds, counts };
}

/* ---------- state machine ---------- */
function advance(room: RoomState, game: GameDef, humanIds: string[], force = false) {
  const round = room.round;
  const now = Date.now();

  // let ready AI players act first (instantly when the human forces a skip)
  botMoves(room, game, now, force);

  const participants = [...humanIds, ...room.bots.map((b) => b.id)];
  const submittedSet = new Set(round.submissions.map((s) => s.playerId));

  if (round.phase === "submitting") {
    const allSubmitted =
      participants.length > 0 &&
      participants.every((id) => submittedSet.has(id));
    if ((allSubmitted || force) && round.submissions.length > 0) {
      if (round.submissions.length === 1) {
        round.phase = "results";
        round.solo = true;
        round.winnerId = round.submissions[0].playerId;
        round.winnerIds = [round.submissions[0].playerId];
      } else {
        round.phase = "voting";
        round.phaseSince = now; // reset the clock so bots "think" before voting
        // give bots a chance to vote immediately if the human forced the skip
        if (force) botMoves(room, game, now, true);
      }
    }
    return;
  }

  if (round.phase === "voting") {
    const votedSet = new Set(Object.keys(round.votes));
    const allVoted =
      participants.length > 0 && participants.every((id) => votedSet.has(id));
    if (allVoted || force) {
      const { winnerIds } = tally(round);
      round.phase = "results";
      round.solo = false;
      round.winnerIds = winnerIds;
      round.winnerId = winnerIds[0];
      const winSet = new Set(winnerIds);
      for (const id of winnerIds) {
        if (room.scores[id] !== undefined) room.scores[id] += 1;
        room.streaks[id] = (room.streaks[id] || 0) + 1;
      }
      // anyone who played but didn't win loses their streak
      for (const sub of round.submissions) {
        if (!winSet.has(sub.playerId)) room.streaks[sub.playerId] = 0;
      }
    }
    return;
  }
}

/* ---------- view builder ---------- */
function buildView(
  room: RoomState,
  game: GameDef,
  meId: string,
  onlineIds: Set<string>
): RoomView {
  const round = room.round;
  const cardById = new Map(game.answers.map((a) => [a.id, a] as const));
  const toCards = (ids: string[]): AnswerCard[] =>
    ids.map((id) => cardById.get(id) || { id, text: "(missing card)" });

  const myHand = room.hands[meId] || [];
  const submittedSet = new Set(round.submissions.map((s) => s.playerId));
  const botIds = new Set(room.bots.map((b) => b.id));

  // player list: humans online + active bots + anyone with a score
  const ids = new Set<string>([...onlineIds, ...botIds, ...Object.keys(room.scores)]);
  const maxScore = Math.max(0, ...[...ids].map((id) => room.scores[id] || 0));
  const players = [...ids]
    .map((id) => ({
      id,
      name: room.names[id] || "Player",
      score: room.scores[id] || 0,
      streak: room.streaks[id] || 0,
      leader: maxScore > 0 && (room.scores[id] || 0) === maxScore,
      submitted: submittedSet.has(id),
      online: onlineIds.has(id) || botIds.has(id),
      isBot: botIds.has(id),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // table (submissions)
  let table: RoomView["table"] = [];
  if (round.phase === "voting" || round.phase === "results") {
    const reveal = round.phase === "results";
    const { counts } = reveal ? tally(round) : { counts: {} as Record<string, number> };
    // stable shuffle by round number so order doesn't jump between polls
    const ordered = orderedSubmissions(round);
    table = ordered.map((sub, i) => ({
      key: `${round.roundNo}-${i}`,
      cards: toCards(sub.cardIds),
      isYours: sub.playerId === meId,
      ...(reveal
        ? {
            ownerName: room.names[sub.playerId] || "Player",
            ownerId: sub.playerId,
            votes: counts[sub.playerId] || 0,
            isWinner: (round.winnerIds || []).includes(sub.playerId),
          }
        : {}),
    }));
  }

  return {
    game: game.id,
    phase: round.phase,
    roundNo: round.roundNo,
    prompt: round.prompt,
    you: {
      id: meId,
      hand: toCards(myHand),
      submitted: submittedSet.has(meId),
      voted: round.votes[meId] !== undefined,
      score: room.scores[meId] || 0,
    },
    players,
    table,
    pick: round.prompt.pick || 1,
    // you're only truly "solo" if no other humans AND no AI opponents
    solo: onlineIds.size <= 1 && room.bots.length === 0,
    bots: room.bots.length,
    youWonRound:
      round.phase === "results" && !round.solo && (round.winnerIds || []).includes(meId),
  };
}

/* ---------- public entry points ---------- */
async function getActiveIds(gameId: string): Promise<Set<string>> {
  const presence = await presenceForGame(gameId);
  return new Set(presence.map((p) => p.id));
}

/** Heartbeat + auto-join + advance state machine, return personalised view. */
export async function tick(
  gameId: string,
  meId: string,
  meName: string
): Promise<RoomView> {
  const game = getGame(gameId)!;
  const room = await loadRoom(gameId);
  const onlineIds = await getActiveIds(gameId);
  onlineIds.add(meId); // include the caller even before presence propagates

  ensurePlayer(room, game, meId, meName);
  // Adjust the AI roster only at a clean round boundary so we never disturb a
  // round already in progress.
  if (room.round.phase === "submitting" && room.round.submissions.length === 0) {
    reconcileBots(room, onlineIds.size);
  }
  advance(room, game, [...onlineIds]);
  await saveRoom(room);
  return buildView(room, game, meId, onlineIds);
}

export type Action =
  | { type: "submit"; cardIds: string[] }
  | { type: "vote"; choiceKey: string } // table key, resolved to owner server-side
  | { type: "next" }
  | { type: "force" }
  | { type: "reset" };

export async function applyAction(
  gameId: string,
  meId: string,
  meName: string,
  action: Action
): Promise<RoomView> {
  const game = getGame(gameId)!;
  const room = await loadRoom(gameId);
  const onlineIds = await getActiveIds(gameId);
  onlineIds.add(meId);
  ensurePlayer(room, game, meId, meName);
  const round = room.round;

  switch (action.type) {
    case "submit": {
      if (round.phase === "submitting" && !round.submissions.some((s) => s.playerId === meId)) {
        const hand = room.hands[meId] || [];
        const valid = action.cardIds.filter((id) => hand.includes(id));
        const need = round.prompt.pick || 1;
        if (valid.length === need) {
          round.submissions.push({ playerId: meId, cardIds: valid });
          room.hands[meId] = hand.filter((id) => !valid.includes(id));
        }
      }
      break;
    }
    case "vote": {
      if (round.phase === "voting" && round.votes[meId] === undefined) {
        // resolve the anonymised table key (`${roundNo}-${index}`) to an owner
        const ordered = orderedSubmissions(round);
        const idx = Number(action.choiceKey.split("-").pop());
        const target = Number.isInteger(idx) ? ordered[idx] : undefined;
        if (target && target.playerId !== meId) {
          round.votes[meId] = target.playerId;
        }
      }
      break;
    }
    case "next": {
      if (round.phase === "results") {
        startNextRound(room, game, [...onlineIds]);
        reconcileBots(room, onlineIds.size); // refresh AI roster for the new round
      }
      break;
    }
    case "force": {
      advance(room, game, [...onlineIds], true);
      await saveRoom(room);
      return buildView(room, game, meId, onlineIds);
    }
    case "reset": {
      for (const id of Object.keys(room.scores)) room.scores[id] = 0;
      break;
    }
  }

  advance(room, game, [...onlineIds]);
  await saveRoom(room);
  return buildView(room, game, meId, onlineIds);
}
