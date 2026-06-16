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
  /** true once results were reached for a solo (single-player) round */
  solo?: boolean;
}

export interface RoomState {
  game: string;
  round: RoundState;
  hands: Record<string, string[]>; // playerId -> answer card ids
  scores: Record<string, number>;
  names: Record<string, string>; // playerId -> last known display name
  recentPromptIds: string[]; // to avoid repeats
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
  }>;
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
