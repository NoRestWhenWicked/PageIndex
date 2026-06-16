import { NextResponse } from "next/server";
import { getJSON, setJSON } from "@/lib/store";
import { hashText } from "@/lib/hashText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand AI card art with caching.
 *
 * Disabled (returns {url:null}) unless OPENAI_API_KEY is set — the client then
 * keeps showing the procedural SVG icon. When enabled, each unique card text is
 * generated once and cached (Vercel KV if configured, else in-memory) so it
 * costs at most one generation per distinct card, ever.
 *
 * Env:
 *   OPENAI_API_KEY     required to enable
 *   CARD_ART_MODEL     default "dall-e-2" (cheap 256px). Use "gpt-image-1" for nicer art.
 *   CARD_ART_SIZE      default "256x256"
 */
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.CARD_ART_MODEL || "dall-e-2";
const SIZE = process.env.CARD_ART_SIZE || "256x256";
const ART_TTL = 60 * 60 * 24 * 30; // 30 days

export async function GET(req: Request) {
  const text = (new URL(req.url).searchParams.get("text") || "").slice(0, 120).trim();
  if (!text) return NextResponse.json({ url: null });
  if (!API_KEY) return NextResponse.json({ url: null });

  const cacheKey = `art:v1:${MODEL}:${hashText(text)}`;
  const cached = await getJSON<string>(cacheKey);
  if (cached) return NextResponse.json({ url: cached, cached: true });

  try {
    const prompt =
      `Minimalist flat sticker illustration of "${text}". ` +
      `Cute, playful, bold clean outlines, vibrant colors, centered on a plain white background, no text, no words.`;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        n: 1,
        size: SIZE,
        ...(MODEL === "dall-e-2" || MODEL === "dall-e-3" ? { response_format: "b64_json" } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ url: null });
    const data = await res.json();
    const item = data?.data?.[0];
    let url: string | null = null;
    if (item?.b64_json) url = `data:image/png;base64,${item.b64_json}`;
    else if (item?.url) url = item.url as string;
    if (!url) return NextResponse.json({ url: null });

    await setJSON(cacheKey, url, ART_TTL);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
