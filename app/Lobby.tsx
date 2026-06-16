"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getIdentity, saveName } from "@/lib/identity";
import { Avatar, GameEmblem, HeroArt } from "./components/art";

type GameMeta = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  accent: string;
};

type Counts = {
  total: number;
  lobby: number;
  games: Record<string, { count: number; names: string[] }>;
};

export default function Lobby({ games }: { games: GameMeta[] }) {
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [counts, setCounts] = useState<Counts | null>(null);
  const nameRef = useRef<string>("");

  useEffect(() => {
    const id = getIdentity();
    setMe(id);
    nameRef.current = id.name;
  }, []);

  useEffect(() => {
    if (!me.id) return;
    let alive = true;

    async function beat() {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: me.id, name: nameRef.current, game: "lobby" }),
        });
        const data = (await res.json()) as Counts;
        if (alive) setCounts(data);
      } catch {
        /* offline; keep last */
      }
    }

    beat();
    const t = setInterval(beat, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [me.id]);

  function onNameChange(v: string) {
    const clean = saveName(v);
    nameRef.current = clean;
    setMe((m) => ({ ...m, name: clean }));
  }

  const total = counts?.total ?? 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <span className="logo">🎉</span> Party Card Games
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="online-pill">
            <span className="dot" /> {total} {total === 1 ? "person" : "people"} online
          </span>
          <span className="me-chip">
            <Avatar seed={me.id || "me"} size={28} />
            <input
              className="name-edit"
              value={me.name}
              onChange={(e) => onNameChange(e.target.value)}
              aria-label="Your display name"
              placeholder="Your name"
            />
          </span>
        </div>
      </div>

      <div className="hero">
        <div className="hero-text">
          <h1>Pick a game. Play solo, or wait for chaos.</h1>
          <p>
            Absurd party card games you can absolutely enjoy alone — AI players
            jump in to keep you company — and if real people wander in, you&apos;ll
            see them appear and play the same round together, live. No sign-up,
            just bad decisions.
          </p>
        </div>
        <HeroArt />
      </div>

      <div className="grid">
        {games.map((g) => {
          const info = counts?.games[g.id];
          const n = info?.count ?? 0;
          return (
            <Link
              key={g.id}
              href={`/play/${g.id}`}
              className="game-card"
              style={{ ["--game-accent" as any]: g.accent }}
            >
              <span className="accent-bar" />
              <GameEmblem accent={g.accent} emoji={g.emoji} />
              <h3>{g.name}</h3>
              <p className="tag">{g.tagline}</p>
              <div className="card-foot">
                <span className={`players-now ${n > 0 ? "active" : ""}`}>
                  {n > 0 ? (
                    <>
                      <span className="dot" /> {n} playing now
                    </>
                  ) : (
                    <>· nobody yet — start it</>
                  )}
                </span>
                <span className="play-btn">Play →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
