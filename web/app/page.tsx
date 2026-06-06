import { GAMES } from "@/lib/games";
import Lobby from "./Lobby";

export const dynamic = "force-dynamic";

export default function Page() {
  const meta = GAMES.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    accent: g.accent,
  }));
  return <Lobby games={meta} />;
}
