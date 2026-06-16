import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { catalogEntry } from "@/lib/catalog";
import GameRoom from "./GameRoom";
import BattleRoom from "./BattleRoom";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { game: string } }) {
  const entry = catalogEntry(params.game);
  if (!entry) notFound();

  if (entry.kind === "battle") {
    return <BattleRoom meta={{ id: entry.id, name: entry.name, emoji: entry.emoji, accent: entry.accent }} />;
  }

  const game = getGame(params.game);
  if (!game) notFound();
  return (
    <GameRoom
      meta={{
        id: game.id,
        name: game.name,
        emoji: game.emoji,
        tagline: game.tagline,
        accent: game.accent,
        promptLabel: game.promptLabel,
        answerLabel: game.answerLabel,
      }}
    />
  );
}
