import { CATALOG } from "@/lib/catalog";
import Lobby from "./Lobby";

export const dynamic = "force-dynamic";

export default function Page() {
  const meta = CATALOG.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    accent: g.accent,
    kind: g.kind,
  }));
  return <Lobby games={meta} />;
}
