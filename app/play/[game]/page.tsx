import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import GameRoom from "./GameRoom";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { game: string } }) {
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
