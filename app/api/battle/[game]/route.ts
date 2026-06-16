import { NextResponse } from "next/server";
import { catalogEntry } from "@/lib/catalog";
import { battleTick, battleAction, type BattleActionInput } from "@/lib/battle";
import { heartbeat } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeName(name: unknown): string {
  return (typeof name === "string" ? name : "Player").slice(0, 24) || "Player";
}

function valid(game: string) {
  const entry = catalogEntry(game);
  return entry && entry.kind === "battle";
}

export async function GET(req: Request, { params }: { params: { game: string } }) {
  if (!valid(params.game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const name = sanitizeName(url.searchParams.get("name"));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await heartbeat(id, name, params.game);
  const view = await battleTick(params.game, id, name);
  return NextResponse.json(view);
}

export async function POST(req: Request, { params }: { params: { game: string } }) {
  if (!valid(params.game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const id = body?.id;
  const name = sanitizeName(body?.name);
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  let action: BattleActionInput | null = null;
  switch (body?.action) {
    case "pick":
      if (typeof body.heroId === "string") action = { type: "pick", heroId: body.heroId };
      break;
    case "start":
      action = { type: "start" };
      break;
    case "play":
      if (typeof body.cardId === "string")
        action = { type: "play", cardId: body.cardId, targetId: typeof body.targetId === "string" ? body.targetId : undefined };
      break;
    case "end":
      action = { type: "end" };
      break;
    case "again":
      action = { type: "again" };
      break;
  }
  if (!action) return NextResponse.json({ error: "bad action" }, { status: 400 });

  await heartbeat(id, name, params.game);
  const view = await battleAction(params.game, id, name, action);
  return NextResponse.json(view);
}
