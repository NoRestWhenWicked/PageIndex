import { NextResponse } from "next/server";
import { getGame } from "@/lib/games";
import { tick, applyAction, type Action } from "@/lib/room";
import { heartbeat } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeName(name: unknown): string {
  return (typeof name === "string" ? name : "Player").slice(0, 24) || "Player";
}

export async function GET(
  req: Request,
  { params }: { params: { game: string } }
) {
  const game = getGame(params.game);
  if (!game) return NextResponse.json({ error: "unknown game" }, { status: 404 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const name = sanitizeName(url.searchParams.get("name"));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // GET doubles as a heartbeat so presence stays fresh while polling.
  await heartbeat(id, name, game.id);
  const view = await tick(game.id, id, name);
  return NextResponse.json(view);
}

export async function POST(
  req: Request,
  { params }: { params: { game: string } }
) {
  const game = getGame(params.game);
  if (!game) return NextResponse.json({ error: "unknown game" }, { status: 404 });

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

  let action: Action | null = null;
  switch (body?.action) {
    case "submit":
      if (Array.isArray(body.cardIds)) action = { type: "submit", cardIds: body.cardIds };
      break;
    case "vote":
      if (typeof body.choiceKey === "string") action = { type: "vote", choiceKey: body.choiceKey };
      break;
    case "next":
      action = { type: "next" };
      break;
    case "force":
      action = { type: "force" };
      break;
    case "reset":
      action = { type: "reset" };
      break;
  }
  if (!action) return NextResponse.json({ error: "bad action" }, { status: 400 });

  await heartbeat(id, name, game.id);
  const view = await applyAction(game.id, id, name, action);
  return NextResponse.json(view);
}
