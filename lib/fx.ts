/**
 * Client-side game "juice": tiny synthesized sound effects (Web Audio, no
 * asset files), haptic buzzes, and a lightweight confetti burst.
 *
 * Everything is feature-detected and wrapped so it is safe to call during SSR
 * or in browsers without the relevant APIs, and it respects the user's
 * sound preference and prefers-reduced-motion.
 */

let ctx: AudioContext | null = null;
let enabled = true;
let loaded = false;

const STORE_KEY = "pcg-sound";

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "off") enabled = false;
  } catch {
    /* ignore */
  }
}

export function soundEnabled(): boolean {
  ensureLoaded();
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  ensureLoaded();
  enabled = on;
  try {
    localStorage.setItem(STORE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (on) blip(660, 0.06, "triangle", 0.2); // little confirmation chirp
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // browsers start the context suspended until a user gesture
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** One short tone. */
function blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.25, delay = 0) {
  ensureLoaded();
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** A quick ascending/descending arpeggio. */
function arp(freqs: number[], step = 0.09, type: OscillatorType = "triangle", gain = 0.22) {
  freqs.forEach((f, i) => blip(f, step * 1.4, type, gain, i * step));
}

export type Sfx =
  | "select"
  | "deselect"
  | "submit"
  | "reveal"
  | "win"
  | "lose"
  | "hit"
  | "shield"
  | "heal"
  | "draw"
  | "turn"
  | "click";

export function sfx(name: Sfx) {
  switch (name) {
    case "select":
      blip(520, 0.08, "triangle", 0.2);
      break;
    case "deselect":
      blip(360, 0.07, "triangle", 0.16);
      break;
    case "click":
      blip(440, 0.05, "square", 0.12);
      break;
    case "submit":
      arp([523, 784], 0.07, "triangle", 0.2);
      break;
    case "reveal":
      arp([392, 523, 659], 0.08, "sine", 0.18);
      break;
    case "win":
      arp([523, 659, 784, 1047], 0.1, "triangle", 0.25);
      break;
    case "lose":
      arp([392, 311, 247], 0.12, "sawtooth", 0.16);
      break;
    case "hit":
      blip(160, 0.14, "sawtooth", 0.22);
      break;
    case "shield":
      blip(300, 0.16, "sine", 0.2);
      break;
    case "heal":
      arp([523, 698], 0.08, "sine", 0.18);
      break;
    case "draw":
      blip(880, 0.06, "triangle", 0.14);
      break;
    case "turn":
      arp([440, 587], 0.08, "triangle", 0.18);
      break;
  }
}

/** Haptic buzz on supporting devices. */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A short, dependency-free confetti burst rendered on a transient full-screen
 * canvas. No-ops when reduced motion is requested.
 */
export function confetti(opts: { count?: number; duration?: number } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (reducedMotion()) return;

  const count = opts.count ?? 120;
  const duration = opts.duration ?? 2200;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
  document.body.appendChild(canvas);
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    canvas.remove();
    return;
  }
  const W = (canvas.width = window.innerWidth * dpr);
  const H = (canvas.height = window.innerHeight * dpr);
  ctx2d.scale(dpr, dpr);

  const colors = ["#f5c518", "#ff5470", "#7c5cff", "#ff8fd4", "#42d392", "#54b4ff"];
  const w = window.innerWidth;
  const parts = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.4,
    y: window.innerHeight * 0.35 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -11 - 4,
    size: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[(Math.random() * colors.length) | 0],
  }));

  const start = performance.now();
  function frame(now: number) {
    const elapsed = now - start;
    ctx2d!.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx2d!.save();
      ctx2d!.translate(p.x, p.y);
      ctx2d!.rotate(p.rot);
      ctx2d!.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx2d!.fillStyle = p.color;
      ctx2d!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx2d!.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}
