/**
 * Build-time AI card art generator.
 *
 * Pre-generates one PNG per unique card and writes them to public/cardart/,
 * plus a manifest.json mapping card-text hash -> filename. The app prefers
 * these static images (instant, zero runtime cost); commit them after running.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npm run gen:art
 *
 * Optional env:
 *   CARD_ART_MODEL  default "dall-e-2" (cheap 256px). Try "gpt-image-1".
 *   CARD_ART_SIZE   default "256x256"
 *
 * Re-runnable: already-generated cards are skipped, so it only fills gaps
 * (e.g. after you add new cards).
 */
import fs from "node:fs";
import path from "node:path";
import { GAMES } from "../lib/games";
import { hashText } from "../lib/hashText";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("✖ Set OPENAI_API_KEY to generate card art.");
  process.exit(1);
}
const MODEL = process.env.CARD_ART_MODEL || "dall-e-2";
const SIZE = process.env.CARD_ART_SIZE || "256x256";

const outDir = path.join(process.cwd(), "public", "cardart");
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, "manifest.json");
const manifest: Record<string, string> = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};

// collect every unique answer-card text across all party games
const texts = new Set<string>();
for (const g of GAMES) for (const a of g.answers) texts.add(a.text);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(text: string): Promise<Buffer | null> {
  const prompt =
    `Minimalist flat sticker illustration of "${text}". ` +
    `Cute, playful, bold clean outlines, vibrant colors, centered on a plain white background, no text, no words.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      size: SIZE,
      ...(MODEL.startsWith("dall-e") ? { response_format: "b64_json" } : {}),
    }),
  });
  if (!res.ok) {
    console.warn(`  ! ${res.status} for "${text}" — skipping`);
    return null;
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.warn(`  ! no image returned for "${text}" — skipping`);
    return null;
  }
  return Buffer.from(b64, "base64");
}

async function main() {
  let made = 0;
  const all = [...texts];
  for (let i = 0; i < all.length; i++) {
    const text = all[i];
    const key = String(hashText(text));
    const file = `${key}.png`;
    if (manifest[key] && fs.existsSync(path.join(outDir, file))) continue;

    process.stdout.write(`(${i + 1}/${all.length}) ${text} … `);
    const buf = await generate(text);
    if (buf) {
      fs.writeFileSync(path.join(outDir, file), buf);
      manifest[key] = file;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      made++;
      console.log("✓");
      await sleep(1200); // be gentle with rate limits
    }
  }
  console.log(`\nDone. Generated ${made} new image(s); ${Object.keys(manifest).length} total.`);
  console.log("Commit public/cardart/ to ship the art.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
