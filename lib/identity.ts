"use client";

const ID_KEY = "pcg_player_id";
const NAME_KEY = "pcg_player_name";

const ADJ = [
  "Sneaky", "Feral", "Cosmic", "Mildly Concerning", "Unhinged", "Velvet",
  "Spicy", "Forbidden", "Anxious", "Glittery", "Suspicious", "Chaotic",
  "Damp", "Regal", "Sleepy", "Turbo",
];
const NOUN = [
  "Raccoon", "Goblin", "Pigeon", "Goose", "Wizard", "Possum", "Llama",
  "Gremlin", "Otter", "Crow", "Hedgehog", "Walrus", "Ferret", "Moth",
  "Capybara", "Newt",
];

function randomName(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getIdentity(): { id: string; name: string } {
  if (typeof window === "undefined") return { id: "", name: "" };
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(ID_KEY, id);
  }
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = randomName();
    localStorage.setItem(NAME_KEY, name);
  }
  return { id, name };
}

export function saveName(name: string): string {
  const clean = name.trim().slice(0, 24) || randomName();
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, clean);
  return clean;
}
