import { NextResponse } from "next/server";
import { heartbeat, listPresence } from "@/lib/store";
import { CATALOG } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summarise(presence: Awaited<ReturnType<typeof listPresence>>) {
  const games: Record<string, { count: number; names: string[] }> = {};
  for (const g of CATALOG) games[g.id] = { count: 0, names: [] };
  let lobby = 0;
  for (const p of presence) {
    if (p.game === "lobby") {
      lobby += 1;
      continue;
    }
    const bucket = games[p.game];
    if (bucket) {
      bucket.count += 1;
      if (bucket.names.length < 12) bucket.names.push(p.name);
    }
  }
  return { total: presence.length, lobby, games };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const { id, name, game } = body || {};
  if (typeof id === "string" && typeof name === "string" && typeof game === "string") {
    await heartbeat(id, name.slice(0, 24), game);
  }
  const presence = await listPresence();
  return NextResponse.json(summarise(presence));
}

export async function GET() {
  const presence = await listPresence();
  return NextResponse.json(summarise(presence));
}
