"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getIdentity } from "@/lib/identity";
import type { RoomView } from "@/lib/types";
import { Avatar, CardIcon } from "../../components/art";

type Meta = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  accent: string;
  promptLabel: string;
  answerLabel: string;
};

function renderPrompt(text: string) {
  const parts = text.split("___");
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && <span className="blank">&nbsp;______&nbsp;</span>}
    </Fragment>
  ));
}

export default function GameRoom({ meta }: { meta: Meta }) {
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [view, setView] = useState<RoomView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const meRef = useRef(me);
  meRef.current = me;
  const phaseRef = useRef<string>("");

  useEffect(() => {
    setMe(getIdentity());
  }, []);

  const poll = useCallback(async () => {
    const id = meRef.current.id;
    if (!id) return;
    try {
      const res = await fetch(
        `/api/room/${meta.id}?id=${encodeURIComponent(id)}&name=${encodeURIComponent(
          meRef.current.name
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as RoomView;
      // clear stale selection when the round/phase changes
      if (phaseRef.current && phaseRef.current !== `${data.roundNo}-${data.phase}`) {
        setSelected([]);
      }
      phaseRef.current = `${data.roundNo}-${data.phase}`;
      setView(data);
    } catch {
      /* keep last view */
    }
  }, [meta.id]);

  useEffect(() => {
    if (!me.id) return;
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [me.id, poll]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const id = meRef.current.id;
      if (!id) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/room/${meta.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: meRef.current.name, ...body }),
        });
        if (res.ok) {
          const data = (await res.json()) as RoomView;
          phaseRef.current = `${data.roundNo}-${data.phase}`;
          setSelected([]);
          setView(data);
        }
      } finally {
        setBusy(false);
      }
    },
    [meta.id]
  );

  function toggleCard(cardId: string) {
    if (!view) return;
    const pick = view.pick;
    setSelected((cur) => {
      if (cur.includes(cardId)) return cur.filter((c) => c !== cardId);
      if (cur.length >= pick) {
        // replace oldest when picking single, otherwise ignore extra
        return pick === 1 ? [cardId] : cur;
      }
      return [...cur, cardId];
    });
  }

  if (!view) {
    return (
      <div className="wrap">
        <Header meta={meta} online={1} />
        <div className="loading">Dealing you in…</div>
      </div>
    );
  }

  const onlineCount = view.players.filter((p) => p.online).length;
  const pick = view.pick;

  return (
    <div
      className="wrap"
      style={{ ["--accent" as any]: meta.accent }}
    >
      <Header meta={meta} online={onlineCount} />

      {view.bots > 0 && (
        <div className="banner">
          🤖 You&apos;re the only human here, so {view.bots} AI player
          {view.bots === 1 ? "" : "s"} joined to play against you. They&apos;ll
          leave automatically when other people show up.
        </div>
      )}

      <div className="layout">
        <main className="panel">
          <p className="phase-label">
            Round {view.roundNo} · {meta.promptLabel}
          </p>
          <div className="prompt-card">{renderPrompt(view.prompt.text)}</div>

          {/* SUBMITTING */}
          {view.phase === "submitting" && !view.you.submitted && (
            <>
              <p className="section-label">
                {meta.answerLabel} — pick {pick}
              </p>
              <div className="hand">
                {view.you.hand.map((c) => {
                  const idx = selected.indexOf(c.id);
                  return (
                    <button
                      key={c.id}
                      className={`answer-card ${idx >= 0 ? "selected" : ""}`}
                      onClick={() => toggleCard(c.id)}
                    >
                      <span className="ac-top">
                        <CardIcon text={c.text} />
                        {idx >= 0 && pick > 1 && <span className="pick-num">{idx + 1}</span>}
                      </span>
                      <span className="ac-text">{c.text}</span>
                    </button>
                  );
                })}
              </div>
              <div className="btn-row">
                <button
                  className="btn"
                  disabled={selected.length !== pick || busy}
                  onClick={() => act({ action: "submit", cardIds: selected })}
                >
                  Play {pick > 1 ? `${pick} cards` : "card"}
                </button>
                <span className="hint">
                  {selected.length}/{pick} selected
                </span>
              </div>
            </>
          )}

          {view.phase === "submitting" && view.you.submitted && (
            <>
              <div className="banner" style={{ marginTop: 18 }}>
                ✅ Locked in. {view.solo
                  ? "Revealing…"
                  : "Waiting for everyone else to play their card…"}
              </div>
              {!view.solo && (
                <div className="btn-row">
                  <button className="btn ghost" disabled={busy} onClick={() => act({ action: "force" })}>
                    Skip waiting & reveal →
                  </button>
                </div>
              )}
            </>
          )}

          {/* VOTING */}
          {view.phase === "voting" && (
            <>
              <p className="section-label">
                {view.you.voted ? "Votes are in — waiting on the rest" : "Vote for the best answer"}
              </p>
              <div className="table">
                {view.table.map((sub) => {
                  const canVote = !view.you.voted && !sub.isYours;
                  return (
                    <button
                      key={sub.key}
                      className={`sub-card ${sub.isYours ? "yours" : ""} ${
                        canVote ? "" : "notallowed"
                      }`}
                      disabled={!canVote || busy}
                      onClick={() => act({ action: "vote", choiceKey: sub.key })}
                    >
                      <div className="sub-cards-text">
                        {sub.cards.map((c, i) => (
                          <span key={i} className="sub-line">
                            <CardIcon text={c.text} size={22} />
                            {c.text}
                          </span>
                        ))}
                      </div>
                      {sub.isYours && (
                        <div className="sub-meta">
                          <span>your card</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {view.you.voted && !view.solo && (
                <div className="btn-row">
                  <button className="btn ghost" disabled={busy} onClick={() => act({ action: "force" })}>
                    Skip waiting & tally →
                  </button>
                </div>
              )}
            </>
          )}

          {/* RESULTS */}
          {view.phase === "results" && (
            <>
              <p className="section-label">
                {view.solo
                  ? "Your masterpiece"
                  : view.table.filter((t) => t.isWinner).length > 1
                  ? `🤝 It's a tie! ${view.table.filter((t) => t.isWinner).length} winners — they each score`
                  : "The results"}
              </p>
              <div className="table">
                {view.table.map((sub) => (
                  <div
                    key={sub.key}
                    className={`sub-card notallowed ${sub.isWinner ? "winner" : ""} ${
                      sub.isYours ? "yours" : ""
                    }`}
                  >
                    <div className="sub-cards-text">
                      {sub.cards.map((c, i) => (
                        <span key={i}>{c.text}</span>
                      ))}
                    </div>
                    <div className="sub-meta">
                      <span>
                        {sub.ownerName}
                        {sub.isYours ? " (you)" : ""}
                      </span>
                      {sub.isWinner ? (
                        <span className="winner-tag">👑 winner</span>
                      ) : (
                        <span className="vote-count">{sub.votes} ▲</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="btn-row">
                <button className="btn" disabled={busy} onClick={() => act({ action: "next" })}>
                  Next round →
                </button>
                {view.solo && (
                  <span className="hint">Playing solo — invite a friend and they&apos;ll drop right in.</span>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="panel">
          <p className="phase-label">
            Players · {onlineCount} online
          </p>
          <div className="players-list">
            {view.players.map((p) => (
              <div className="player-row" key={p.id}>
                <span className="row-avatar">
                  <Avatar seed={p.id} isBot={p.isBot} size={28} />
                  <span className={`status-dot float ${p.online ? "on" : ""}`} />
                </span>
                <span className="pname">
                  {p.name}
                  {p.id === view.you.id ? " (you)" : ""}
                </span>
                {view.phase === "submitting" && p.online && (
                  <span className={p.submitted ? "tick" : "waiting"}>
                    {p.submitted ? "✓" : "…"}
                  </span>
                )}
                <span className="pscore">{p.score}</span>
              </div>
            ))}
          </div>

          <div className="share-box">
            🔗 Invite people by sharing this page&apos;s URL. Anyone who opens it
            joins the same live game.
          </div>

          <div className="btn-row">
            <button className="btn ghost" disabled={busy} onClick={() => act({ action: "reset" })}>
              Reset scores
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Header({ meta, online }: { meta: Meta; online: number }) {
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
      <span className="online-pill">
        <span className="dot" /> {online} here now
      </span>
    </div>
  );
}
