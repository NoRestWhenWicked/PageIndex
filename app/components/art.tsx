import React from "react";

/* Small deterministic hash so a given seed always yields the same art. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Procedural avatar: a friendly monster for humans, a robot for AI players.   */
/* Deterministic from `seed`, so every player gets their own unique look.      */
/* ────────────────────────────────────────────────────────────────────────── */
export function Avatar({
  seed,
  isBot = false,
  size = 32,
}: {
  seed: string;
  isBot?: boolean;
  size?: number;
}) {
  const h = hash(seed || "x");
  const uid = "a" + h.toString(36);

  if (isBot) {
    const accent = `hsl(${h % 360} 90% 60%)`;
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9d2e0" />
            <stop offset="1" stopColor="#8b97ab" />
          </linearGradient>
        </defs>
        {/* antenna */}
        <line x1="32" y1="6" x2="32" y2="14" stroke="#6b7688" strokeWidth="2.5" />
        <circle cx="32" cy="5" r="3" fill={accent} />
        {/* head */}
        <rect x="12" y="14" width="40" height="38" rx="10" fill={`url(#${uid})`} stroke="#6b7688" strokeWidth="2" />
        {/* ears */}
        <rect x="6" y="26" width="6" height="14" rx="3" fill="#8b97ab" />
        <rect x="52" y="26" width="6" height="14" rx="3" fill="#8b97ab" />
        {/* eyes */}
        <rect x="20" y="26" width="9" height="9" rx="2" fill="#10131c" />
        <rect x="35" y="26" width="9" height="9" rx="2" fill="#10131c" />
        <rect x="22" y="28" width="3.5" height="3.5" rx="1" fill={accent} />
        <rect x="37" y="28" width="3.5" height="3.5" rx="1" fill={accent} />
        {/* mouth grille */}
        <rect x="22" y="42" width="20" height="6" rx="2" fill="#10131c" />
        <line x1="27" y1="42" x2="27" y2="48" stroke="#8b97ab" strokeWidth="1.5" />
        <line x1="32" y1="42" x2="32" y2="48" stroke="#8b97ab" strokeWidth="1.5" />
        <line x1="37" y1="42" x2="37" y2="48" stroke="#8b97ab" strokeWidth="1.5" />
      </svg>
    );
  }

  const hueA = h % 360;
  const hueB = (Math.floor(h / 7) % 360);
  const eyes = h % 3; // 0:two 1:three 2:big
  const mouth = Math.floor(h / 3) % 4;
  const horns = Math.floor(h / 11) % 2 === 0;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hueA} 75% 60%)`} />
          <stop offset="1" stopColor={`hsl(${hueB} 70% 45%)`} />
        </linearGradient>
      </defs>
      {horns && (
        <>
          <path d="M18 10 L22 20 L13 18 Z" fill={`hsl(${hueB} 70% 40%)`} />
          <path d="M46 10 L42 20 L51 18 Z" fill={`hsl(${hueB} 70% 40%)`} />
        </>
      )}
      <rect x="6" y="8" width="52" height="50" rx="18" fill={`url(#${uid})`} />
      {/* eyes */}
      {eyes === 0 && (
        <>
          <circle cx="25" cy="30" r="6" fill="#fff" />
          <circle cx="39" cy="30" r="6" fill="#fff" />
          <circle cx="26" cy="31" r="2.6" fill="#16121f" />
          <circle cx="40" cy="31" r="2.6" fill="#16121f" />
        </>
      )}
      {eyes === 1 && (
        <>
          <circle cx="20" cy="29" r="4.5" fill="#fff" />
          <circle cx="32" cy="27" r="4.5" fill="#fff" />
          <circle cx="44" cy="29" r="4.5" fill="#fff" />
          <circle cx="20" cy="29" r="2" fill="#16121f" />
          <circle cx="32" cy="27" r="2" fill="#16121f" />
          <circle cx="44" cy="29" r="2" fill="#16121f" />
        </>
      )}
      {eyes === 2 && (
        <>
          <circle cx="32" cy="29" r="9" fill="#fff" />
          <circle cx="33" cy="30" r="4" fill="#16121f" />
          <circle cx="35" cy="28" r="1.4" fill="#fff" />
        </>
      )}
      {/* mouth */}
      {mouth === 0 && (
        <path d="M22 42 Q32 50 42 42" stroke="#16121f" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mouth === 1 && <ellipse cx="32" cy="44" rx="7" ry="5" fill="#16121f" />}
      {mouth === 2 && (
        <polyline points="22,44 27,40 32,44 37,40 42,44" stroke="#16121f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {mouth === 3 && (
        <>
          <path d="M22 41 Q32 49 42 41" stroke="#16121f" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="29" y="42" width="6" height="5" fill="#fff" />
        </>
      )}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Illustrated game emblem: a little fan of cards tinted with the game accent,  */
/* the game's emoji on the front card.                                          */
/* ────────────────────────────────────────────────────────────────────────── */
export function GameEmblem({
  accent,
  emoji,
  size = 64,
}: {
  accent: string;
  emoji: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-16 24 40)">
        <rect x="12" y="20" width="26" height="36" rx="5" fill="#0c0a17" stroke={accent} strokeWidth="2" />
      </g>
      <g transform="rotate(-2 30 38)">
        <rect x="18" y="16" width="26" height="38" rx="5" fill="#1a1530" stroke={accent} strokeWidth="2" />
      </g>
      <g transform="rotate(12 40 36)">
        <rect x="24" y="12" width="28" height="40" rx="6" fill={accent} />
        <text x="38" y="38" fontSize="20" textAnchor="middle" dominantBaseline="central">
          {emoji}
        </text>
      </g>
    </svg>
  );
}

/* A round hero badge (emoji on an accent gradient) for the battler. */
export function HeroBadge({
  emoji,
  accent,
  size = 56,
}: {
  emoji: string;
  accent: string;
  size?: number;
}) {
  const uid = "h" + hash(accent + emoji).toString(36);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={uid} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="35%" stopColor={accent} />
          <stop offset="100%" stopColor="#10131c" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${uid})`} stroke={accent} strokeWidth="2.5" />
      <text x="32" y="35" fontSize="30" textAnchor="middle" dominantBaseline="central">
        {emoji}
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Lobby hero illustration: a fan of playing cards with confetti.              */
/* ────────────────────────────────────────────────────────────────────────── */
export function HeroArt() {
  const cards = [
    { rot: -28, x: 40, fill: "#f5c518", suit: "♠", sx: "#0c0a17" },
    { rot: -14, x: 86, fill: "#faf7ff", suit: "♥", sx: "#ff5470" },
    { rot: 0, x: 132, fill: "#7c5cff", suit: "♣", sx: "#faf7ff" },
    { rot: 14, x: 178, fill: "#faf7ff", suit: "♦", sx: "#ff5470" },
    { rot: 28, x: 224, fill: "#36d399", suit: "★", sx: "#0c0a17" },
  ];
  const confetti = [
    [30, 30, "#f5c518"], [250, 24, "#ff5470"], [150, 12, "#7c5cff"],
    [60, 150, "#36d399"], [240, 150, "#f5c518"], [120, 165, "#ff5470"],
    [200, 8, "#36d399"], [10, 90, "#7c5cff"],
  ] as const;
  return (
    <svg viewBox="0 0 300 200" className="hero-art" aria-hidden="true">
      {confetti.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="9" height="9" rx="2" fill={c as string} transform={`rotate(${(i * 47) % 90} ${x} ${y})`} opacity="0.9" />
      ))}
      {cards.map((c, i) => (
        <g key={i} transform={`rotate(${c.rot} ${c.x} 110)`}>
          <rect x={c.x - 32} y={70} width="64" height="92" rx="9" fill={c.fill} stroke="#00000022" strokeWidth="1.5" />
          <text x={c.x} y={122} fontSize="40" textAnchor="middle" dominantBaseline="central" fill={c.sx} fontWeight="bold">
            {c.suit}
          </text>
        </g>
      ))}
    </svg>
  );
}
