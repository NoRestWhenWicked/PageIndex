import type { Hero, BattleCard, CardEffect } from "./types";

type Spec = [count: number, name: string, icon: string, desc: string, effects: CardEffect[]];

function buildDeck(heroId: string, specs: Spec[]): BattleCard[] {
  const deck: BattleCard[] = [];
  let n = 0;
  for (const [count, name, icon, desc, effects] of specs) {
    for (let i = 0; i < count; i++) {
      deck.push({ id: `${heroId}:${n++}`, name, icon, desc, effects });
    }
  }
  return deck;
}

const unicorn: Hero = {
  id: "unicorn",
  name: "Sparklemane",
  emoji: "🦄",
  accent: "#ff8fd4",
  blurb: "Glittery healer who fights with weaponized friendship.",
  deck: buildDeck("unicorn", [
    [3, "Rainbow Blast", "🌈", "Deal 3 damage.", [{ kind: "attack", value: 3 }]],
    [4, "Glitter Bolt", "✨", "Deal 2 damage.", [{ kind: "attack", value: 2 }]],
    [3, "Shield of Friendship", "🛡️", "Gain 3 shields.", [{ kind: "shield", value: 3 }]],
    [3, "Healing Sparkles", "💖", "Heal 3 HP.", [{ kind: "heal", value: 3 }]],
    [2, "Extra Sparkle", "🔮", "Draw 2 cards.", [{ kind: "draw", value: 2 }]],
    [1, "Prismatic Surge", "🌟", "Deal 2 and draw 1.", [{ kind: "attack", value: 2 }, { kind: "draw", value: 1 }]],
  ]),
};

const kitty: Hero = {
  id: "kitty",
  name: "Sir Pounce",
  emoji: "🐱",
  accent: "#ffb454",
  blurb: "Chaotic feline — big pounces, naps, and nine lives.",
  deck: buildDeck("kitty", [
    [4, "Claw Swipe", "🐾", "Deal 2 damage.", [{ kind: "attack", value: 2 }]],
    [2, "Pounce", "😼", "Deal 4 damage.", [{ kind: "attack", value: 4 }]],
    [3, "Catnap", "😴", "Gain 3 shields.", [{ kind: "shield", value: 3 }]],
    [3, "Nine Lives", "💗", "Heal 3 HP.", [{ kind: "heal", value: 3 }]],
    [2, "Knock It Off", "🧶", "Deal 1 and draw 1.", [{ kind: "attack", value: 1 }, { kind: "draw", value: 1 }]],
    [2, "Curiosity", "🐈", "Draw 2 cards.", [{ kind: "draw", value: 2 }]],
  ]),
};

const knight: Hero = {
  id: "knight",
  name: "Sir Bonk",
  emoji: "🛡️",
  accent: "#9fb3c8",
  blurb: "Sturdy bruiser who hits hard and turtles up.",
  deck: buildDeck("knight", [
    [4, "Sword Strike", "⚔️", "Deal 2 damage.", [{ kind: "attack", value: 2 }]],
    [2, "Heavy Blow", "🔨", "Deal 4 damage.", [{ kind: "attack", value: 4 }]],
    [4, "Shield Wall", "🛡️", "Gain 3 shields.", [{ kind: "shield", value: 3 }]],
    [2, "Second Wind", "❤️", "Heal 4 HP.", [{ kind: "heal", value: 4 }]],
    [2, "Battle Cry", "📯", "Draw 2 cards.", [{ kind: "draw", value: 2 }]],
    [1, "Bash", "💥", "Deal 3 and gain 1 shield.", [{ kind: "attack", value: 3 }, { kind: "shield", value: 1 }]],
  ]),
};

const wizard: Hero = {
  id: "wizard",
  name: "Zappy",
  emoji: "🔮",
  accent: "#7c5cff",
  blurb: "Glass cannon with burst damage and life drain.",
  deck: buildDeck("wizard", [
    [4, "Arcane Bolt", "🔮", "Deal 2 damage.", [{ kind: "attack", value: 2 }]],
    [2, "Fireball", "🔥", "Deal 4 damage.", [{ kind: "attack", value: 4 }]],
    [3, "Mana Shield", "🛡️", "Gain 3 shields.", [{ kind: "shield", value: 3 }]],
    [2, "Life Drain", "🧛", "Deal 2 and heal 2.", [{ kind: "attack", value: 2 }, { kind: "heal", value: 2 }]],
    [3, "Foresight", "👁️", "Draw 2 cards.", [{ kind: "draw", value: 2 }]],
    [1, "Meteor", "☄️", "Deal 5 damage.", [{ kind: "attack", value: 5 }]],
  ]),
};

const golem: Hero = {
  id: "golem",
  name: "Rocky",
  emoji: "🪨",
  accent: "#a98467",
  blurb: "Immovable wall — stacks shields and grinds foes down.",
  deck: buildDeck("golem", [
    [5, "Boulder Toss", "🪨", "Deal 2 damage.", [{ kind: "attack", value: 2 }]],
    [2, "Rockslide", "⛰️", "Deal 4 damage.", [{ kind: "attack", value: 4 }]],
    [4, "Stone Skin", "🛡️", "Gain 4 shields.", [{ kind: "shield", value: 4 }]],
    [2, "Regenerate", "🌱", "Heal 3 HP.", [{ kind: "heal", value: 3 }]],
    [2, "Tremor", "💢", "Draw 2 cards.", [{ kind: "draw", value: 2 }]],
    [1, "Avalanche", "🏔️", "Deal 3 and gain 2 shields.", [{ kind: "attack", value: 3 }, { kind: "shield", value: 2 }]],
  ]),
};

export const HEROES: Hero[] = [unicorn, kitty, knight, wizard, golem];

export function getHero(id: string): Hero | undefined {
  return HEROES.find((h) => h.id === id);
}

const CARD_INDEX = new Map<string, BattleCard>();
for (const h of HEROES) for (const c of h.deck) CARD_INDEX.set(c.id, c);

export function getCard(id: string): BattleCard | undefined {
  return CARD_INDEX.get(id);
}
