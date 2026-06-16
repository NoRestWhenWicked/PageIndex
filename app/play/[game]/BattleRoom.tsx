"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getIdentity } from "@/lib/identity";
import type { BattleView, BattleCard } from "@/lib/types";
import { HeroBadge } from "../../components/art";

type Meta = { id: string; name: string; emoji: string; accent: string };

function cardKind(card: BattleCard): "attack" | "shield" | "heal" | "draw" {
  if (card.effects.some((e) => e.kind === "attack")) return "attack";
  if (card.effects.some((e) => e.kind === "heal")) return "heal";
  if (card.effects.some((e) => e.kind === "shield")) return "shield";
  return "draw";
}

export default function BattleRoom({ meta }: { meta: Meta }) {
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [view, setView] = useState<BattleView | null>(null);
  const [pending, setPending] = useState<string | null>(null); // cardId awaiting target
  const [busy, setBusy] = useState(false);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => setMe(getIdentity()), []);

  const poll = useCallback(async () => {
    const id = meRef.current.id;
    if (!id) return;
    try {
      const res = await fetch(
        `/api/battle/${meta.id}?id=${encodeURIComponent(id)}&name=${encodeURIComponent(meRef.current.name)}`,
        { cache: "no-store" }
      );
      if (res.ok) setView((await res.json()) as BattleView);
    } catch {
      /* keep last */
    }
  }, [meta.id]);

  useEffect(() => {
    if (!me.id) return;
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [me.id, poll]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const id = meRef.current.id;
      if (!id) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/battle/${meta.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: meRef.current.name, ...body }),
        });
        if (res.ok) setView((await res.json()) as BattleView);
      } finally {
        setBusy(false);
      }
    },
    [meta.id]
  );

  function playCard(card: BattleCard) {
    if (!view) return;
    const opponents = view.seats.filter((s) => s.alive && !s.isYou);
    if (cardKind(card) === "attack" && opponents.length > 1) {
      setPending(card.id); // need a target
    } else {
      const target = cardKind(card) === "attack" ? opponents[0]?.id : undefined;
      act({ action: "play", cardId: card.id, targetId: target });
      setPending(null);
    }
  }

  function chooseTarget(seatId: string) {
    if (!pending) return;
    act({ action: "play", cardId: pending, targetId: seatId });
    setPending(null);
  }

  if (!view) {
    return (
      <div className="wrap" style={{ ["--accent" as any]: meta.accent }}>
        <BattleHeader meta={meta} />
        <div className="loading">Entering the arena…</div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ ["--accent" as any]: meta.accent }}>
      <BattleHeader meta={meta} />

      {/* HERO SELECT */}
      {view.phase === "select" && (
        <div className="panel">
          <p className="phase-label">Choose your hero</p>
          <div className="hero-grid">
            {view.heroes.map((h) => (
              <button
                key={h.id}
                className={`hero-card ${view.yourPick === h.id ? "picked" : ""}`}
                style={{ ["--accent" as any]: h.accent }}
                onClick={() => act({ action: "pick", heroId: h.id })}
              >
                <HeroBadge emoji={h.emoji} accent={h.accent} size={64} />
                <h3>{h.name}</h3>
                <p>{h.blurb}</p>
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={() => act({ action: "start" })}>
              {view.yourPick ? "Start match →" : "Pick a hero to start"}
            </button>
            <span className="hint">You + AI opponents (5 fighters). Last hero standing wins.</span>
          </div>
        </div>
      )}

      {/* PLAYING / OVER */}
      {view.phase !== "select" && (
        <div className="battle-layout">
          <main className="panel">
            {view.phase === "over" ? (
              <div className="banner big-win">
                🏆 {view.winnerName === view.seats.find((s) => s.isYou)?.name ? "You win!" : `${view.winnerName} wins!`}
              </div>
            ) : view.you.isTurn ? (
              <div className="banner your-turn">
                ⚔️ Your turn — play cards, then end your turn{pending ? " · pick a target!" : ""}
              </div>
            ) : (
              <div className="banner">⏳ {view.turnName}&apos;s turn…</div>
            )}

            <div className="arena">
              {view.seats.map((s) => {
                const targetable = !!pending && s.alive && !s.isYou;
                return (
                  <div
                    key={s.id}
                    className={`fighter ${s.isTurn ? "active" : ""} ${s.alive ? "" : "dead"} ${
                      s.isYou ? "you" : ""
                    } ${targetable ? "targetable" : ""}`}
                    style={{ ["--accent" as any]: s.accent }}
                    onClick={() => targetable && chooseTarget(s.id)}
                  >
                    <HeroBadge emoji={s.heroEmoji} accent={s.accent} size={48} />
                    <div className="fighter-info">
                      <div className="fighter-name">
                        {s.name}
                        {s.isYou ? " (you)" : s.isBot ? " 🤖" : ""}
                      </div>
                      <div className="hp-bar">
                        <span style={{ width: `${(s.hp / view.maxHp) * 100}%` }} />
                      </div>
                      <div className="fighter-stats">
                        ❤️ {s.hp}/{view.maxHp}
                        {s.shield > 0 && <span className="shield">🛡️ {s.shield}</span>}
                        <span className="cards-left">🂠 {s.handCount}</span>
                      </div>
                    </div>
                    {!s.alive && <div className="ko">K.O.</div>}
                  </div>
                );
              })}
            </div>

            {view.phase === "over" && (
              <div className="btn-row">
                <button className="btn" disabled={busy} onClick={() => act({ action: "again" })}>
                  Play again →
                </button>
              </div>
            )}

            {view.phase === "playing" && view.you.seated && view.you.alive && (
              <>
                <p className="section-label">
                  Your hand {view.you.isTurn ? "" : "(wait for your turn)"}
                </p>
                <div className="battle-hand">
                  {view.you.hand.map((c, i) => (
                    <button
                      key={c.id + i}
                      className={`battle-card k-${cardKind(c)} ${pending === c.id ? "selected" : ""}`}
                      disabled={!view.you.isTurn || busy}
                      onClick={() => playCard(c)}
                    >
                      <span className="bc-icon">{c.icon}</span>
                      <span className="bc-name">{c.name}</span>
                      <span className="bc-desc">{c.desc}</span>
                    </button>
                  ))}
                </div>
                {view.you.isTurn && (
                  <div className="btn-row">
                    <button className="btn ghost" disabled={busy} onClick={() => { setPending(null); act({ action: "end" }); }}>
                      End turn →
                    </button>
                    {pending && (
                      <button className="btn ghost" onClick={() => setPending(null)}>
                        Cancel target
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {view.phase === "playing" && !view.you.seated && (
              <div className="banner" style={{ marginTop: 16 }}>
                👀 You&apos;re spectating this match. Hit{" "}
                <b>Play again</b> when it ends to jump in.
              </div>
            )}
            {view.phase === "playing" && view.you.seated && !view.you.alive && (
              <div className="banner" style={{ marginTop: 16 }}>💀 You&apos;re out — watch who wins!</div>
            )}
          </main>

          <aside className="panel">
            <p className="phase-label">Battle log</p>
            <div className="battle-log">
              {[...view.log].reverse().map((line, i) => (
                <div key={i} className="log-line">
                  {line}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function BattleHeader({ meta }: { meta: Meta }) {
  return (
    <div className="room-head">
      <div className="room-title">
        <span className="emoji">{meta.emoji}</span>
        <div>
          <h2>{meta.name}</h2>
          <Link className="back" href="/">
            ← all games
          </Link>
        </div>
      </div>
    </div>
  );
}
