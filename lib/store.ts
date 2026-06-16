/**
 * Tiny persistence layer.
 *
 * - Locally / on a single serverless instance it uses an in-memory Map.
 * - If Vercel KV / Upstash Redis env vars are present it transparently uses
 *   their REST API, which makes presence + rooms work across serverless
 *   instances (i.e. real multiplayer in production).
 *
 * Set either:
 *   KV_REST_API_URL / KV_REST_API_TOKEN              (Vercel KV)
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash)
 */
import type { PresenceEntry } from "./types";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = Boolean(KV_URL && KV_TOKEN);

// ---- in-memory fallback -----------------------------------------------------
type MemEntry = { value: string; expires: number };
const mem = new Map<string, MemEntry>();

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expires && e.expires < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

function memSet(key: string, value: string, ttlSec: number) {
  mem.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}

// ---- Upstash/Vercel KV REST -------------------------------------------------
async function kv(command: (string | number)[]): Promise<any> {
  const res = await fetch(KV_URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV error ${res.status}`);
  const data = await res.json();
  return data.result;
}

// ---- public JSON helpers (used for room state) ------------------------------
export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = useKV ? ((await kv(["GET", key])) as string | null) : memGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(key: string, value: T, ttlSec = 3600): Promise<void> {
  const raw = JSON.stringify(value);
  if (useKV) {
    await kv(["SET", key, raw, "EX", ttlSec]);
  } else {
    memSet(key, raw, ttlSec);
  }
}

// ---- presence ---------------------------------------------------------------
// Each player is one short-lived key so heartbeats don't race each other.
const PRESENCE_TTL = 15; // seconds; clients heartbeat every ~5s
const presenceKey = (id: string) => `pr:${id}`;

export async function heartbeat(id: string, name: string, game: string): Promise<void> {
  const entry: PresenceEntry = { id, name, game, lastSeen: Date.now() };
  await setJSON(presenceKey(id), entry, PRESENCE_TTL);
}

export async function listPresence(): Promise<PresenceEntry[]> {
  if (useKV) {
    const keys = (await kv(["KEYS", "pr:*"])) as string[] | null;
    if (!keys || keys.length === 0) return [];
    const values = (await kv(["MGET", ...keys])) as (string | null)[];
    const out: PresenceEntry[] = [];
    for (const v of values) {
      if (!v) continue;
      try {
        out.push(JSON.parse(v) as PresenceEntry);
      } catch {
        /* ignore */
      }
    }
    return out;
  }
  const out: PresenceEntry[] = [];
  const now = Date.now();
  for (const [key, e] of mem.entries()) {
    if (!key.startsWith("pr:")) continue;
    if (e.expires && e.expires < now) {
      mem.delete(key);
      continue;
    }
    try {
      out.push(JSON.parse(e.value) as PresenceEntry);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function presenceForGame(game: string): Promise<PresenceEntry[]> {
  const all = await listPresence();
  return all.filter((p) => p.game === game);
}
