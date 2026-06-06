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
  };
}

function freshRoom(gameId: string): RoomState {
  const game = getGame(gameId)!;
  return {
    game: gameId,
    round: newRoundState(game, []),
    hands: {},
    scores: {},
    names: {},
    recentPromptIds: [],
  };
}

async function loadRoom(gameId: string): Promise<RoomState> {
  const existing = await getJSON<RoomState>(roomKey(gameId));
  if (existing) {
    // backfill any fields added since the room was created
    existing.names ||= {};
    existing.recentPromptIds ||= [];
    return existing;
  }
  return freshRoom(gameId);
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

function tally(round: RoundState): { winnerId?: string; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const sub of round.submissions) counts[sub.playerId] = 0;
  for (const owner of Object.values(round.votes)) {
    if (counts[owner] !== undefined) counts[owner] += 1;
  }
  let winnerId: string | undefined;
  let best = -1;
  // stable-ish: iterate submissions order, ties keep first
  for (const sub of round.submissions) {
    const c = counts[sub.playerId];
    if (c > best) {
      best = c;
      winnerId = sub.playerId;
    }
  }
  return { winnerId, counts };
}

/* ---------- state machine ---------- */
function advance(room: RoomState, game: GameDef, activeIds: string[], force = false) {
  const round = room.round;
  const participants = activeIds;
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
      } else {
        round.phase = "voting";
      }
    }
    return;
  }

  if (round.phase === "voting") {
    const votedSet = new Set(Object.keys(round.votes));
    const allVoted =
      participants.length > 0 && participants.every((id) => votedSet.has(id));
    if (allVoted || force) {
      const { winnerId } = tally(round);
      round.phase = "results";
      round.solo = false;
      round.winnerId = winnerId;
      if (winnerId && room.scores[winnerId] !== undefined) {
        room.scores[winnerId] += 1;
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

  // player list: everyone online + anyone with a score
  const ids = new Set<string>([...onlineIds, ...Object.keys(room.scores)]);
  const players = [...ids]
    .map((id) => ({
      id,
      name: room.names[id] || "Player",
      score: room.scores[id] || 0,
      submitted: submittedSet.has(id),
      online: onlineIds.has(id),
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
            isWinner: sub.playerId === round.winnerId,
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
    solo: onlineIds.size <= 1,
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
