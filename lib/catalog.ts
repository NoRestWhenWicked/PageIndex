import { GAMES } from "./games";

export type GameKind = "party" | "battle";

export interface CatalogEntry {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  accent: string;
  kind: GameKind;
}

const BATTLE: CatalogEntry[] = [
  {
    id: "deck-mayhem",
    name: "Deck Mayhem",
    emoji: "⚔️",
    tagline: "Pick a hero — Unicorn, Kitty & more — and battle to the last one standing.",
    accent: "#36d399",
    kind: "battle",
  },
];

export const CATALOG: CatalogEntry[] = [
  ...GAMES.map(
    (g): CatalogEntry => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      tagline: g.tagline,
      accent: g.accent,
      kind: "party",
    })
  ),
  ...BATTLE,
];

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.id === id);
}

export const ALL_GAME_IDS = CATALOG.map((c) => c.id);
