export interface PromptCard {
  id: string;
  text: string; // may contain "___" to indicate a blank
  pick?: number; // number of answer cards to play (default 1)
}

export interface AnswerCard {
  id: string;
  text: string;
}

export interface GameDef {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** CSS accent color used across the UI for this game */
  accent: string;
  /** Label shown above the prompt card, e.g. "The situation" */
  promptLabel: string;
  /** Label shown above the player's hand, e.g. "Your terrible advice" */
  answerLabel: string;
  prompts: PromptCard[];
  answers: AnswerCard[];
}

export interface PresenceEntry {
  id: string;
  name: string;
  game: string; // game id, or "lobby"
  lastSeen: number;
}

export type Phase = "submitting" | "voting" | "results";

export interface Submission {
  playerId: string;
  cardIds: string[];
}

export interface RoundState {
  roundNo: number;
  phase: Phase;
  prompt: PromptCard;
  submissions: Submission[];
  votes: Record<string, string>; // voterId -> submission ownerId
  winnerId?: string;
  /** all top-voted players (length > 1 means a tie) */
  winnerIds?: string[];
  /** true once results were reached for a solo (single-player) round */
  solo?: boolean;
  /** ms timestamp the current phase began (drives AI "thinking" delays) */
  phaseSince?: number;
}

/** An automated opponent that fills the table when you'd otherwise be solo. */
export interface BotInfo {
  id: string; // always starts with "bot:"
  name: string;
}

export interface RoomState {
  game: string;
  round: RoundState;
  hands: Record<string, string[]>; // playerId -> answer card ids
  scores: Record<string, number>;
  names: Record<string, string>; // playerId -> last known display name
  recentPromptIds: string[]; // to avoid repeats
  bots: BotInfo[]; // active AI players
}

/** What the client renders. Trimmed/personalised per requesting player. */
export interface RoomView {
  game: string;
  phase: Phase;
  roundNo: number;
  prompt: PromptCard;
  you: {
    id: string;
    hand: AnswerCard[];
    submitted: boolean;
    voted: boolean;
    score: number;
  };
  players: Array<{
    id: string;
    name: string;
    score: number;
    submitted: boolean;
    online: boolean;
    isBot: boolean;
  }>;
  /** number of AI opponents currently filling the table */
  bots: number;
  /** Submissions shown during voting (anonymised) and results (revealed). */
  table: Array<{
    /** stable key for this submission within the round */
    key: string;
    cards: AnswerCard[];
    ownerName?: string; // only present at results
    ownerId?: string; // only present at results
    votes?: number; // only present at results
    isWinner?: boolean; // only present at results
    isYours: boolean;
  }>;
  pick: number;
  solo: boolean;
}

/* ───────────────────────────── Deck Mayhem (battler) ─────────────────────── */
export type CardEffect =
  | { kind: "attack"; value: number }
  | { kind: "shield"; value: number }
  | { kind: "heal"; value: number }
  | { kind: "draw"; value: number };

export interface BattleCard {
  id: string; // `${heroId}:${n}`
  name: string;
  icon: string;
  desc: string;
  effects: CardEffect[];
}

export interface Hero {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  blurb: string;
  deck: BattleCard[];
}

export interface BattleSeat {
  id: string;
  name: string;
  heroId: string;
  hp: number;
  shield: number;
  alive: boolean;
  isBot: boolean;
}

export interface BattleState {
  game: string;
  phase: "select" | "playing" | "over";
  seats: BattleSeat[];
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  discards: Record<string, string[]>;
  turn: string;
  turnSince: number;
  log: string[];
  winnerId?: string;
  matchNo: number;
  picks: Record<string, string>; // humanId -> heroId (during selection)
}

export interface BattleView {
  game: string;
  phase: "select" | "playing" | "over";
  matchNo: number;
  maxHp: number;
  you: {
    id: string;
    seated: boolean;
    heroId?: string;
    hand: BattleCard[];
    isTurn: boolean;
    alive: boolean;
  };
  seats: Array<{
    id: string;
    name: string;
    heroId: string;
    heroName: string;
    heroEmoji: string;
    accent: string;
    hp: number;
    shield: number;
    alive: boolean;
    isBot: boolean;
    isYou: boolean;
    isTurn: boolean;
    handCount: number;
  }>;
  heroes: Array<{ id: string; name: string; emoji: string; accent: string; blurb: string }>;
  yourPick?: string;
  turnName: string;
  log: string[];
  winnerName?: string;
}
