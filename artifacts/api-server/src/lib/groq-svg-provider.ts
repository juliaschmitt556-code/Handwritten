import type { CardArtworkRequest } from "@workspace/api-zod";

type LeafTone = "sage" | "olive" | "eucalyptus";
type BloomTone = "rose" | "blush" | "cream" | "lavender";

interface SvgArtDirection {
  leafCount: number;
  flowerCount: number;
  petalCount: number;
  stemBend: number;
  leafTone: LeafTone;
  bloomTone: BloomTone;
}

const leafColors: Record<LeafTone, string> = {
  sage: "#7e8b6a",
  olive: "#85825e",
  eucalyptus: "#788b83",
};

const bloomColors: Record<BloomTone, string> = {
  rose: "#b77c80",
  blush: "#d4a3a0",
  cream: "#d7c69e",
  lavender: "#a594a9",
};

const validLeafTones: LeafTone[] = ["sage", "olive", "eucalyptus"];
const validBloomTones: BloomTone[] = ["rose", "blush", "cream", "lavender"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArtDirection(raw: string, request: CardArtworkRequest): SvgArtDirection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Groq did not return valid artwork settings.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Groq returned invalid artwork settings.");
  }

  const { leafCount, flowerCount, petalCount, stemBend, leafTone, bloomTone } = parsed;
  if (
    !Number.isInteger(leafCount) ||
    (leafCount as number) < 3 ||
    (leafCount as number) > 8 ||
    !Number.isInteger(flowerCount) ||
    (flowerCount as number) < 0 ||
    (flowerCount as number) > 3 ||
    !Number.isInteger(petalCount) ||
    (petalCount as number) < 5 ||
    (petalCount as number) > 9 ||
    typeof stemBend !== "number" ||
    !Number.isFinite(stemBend) ||
    stemBend < -28 ||
    stemBend > 28 ||
    typeof leafTone !== "string" ||
    !validLeafTones.includes(leafTone as LeafTone) ||
    typeof bloomTone !== "string" ||
    !validBloomTones.includes(bloomTone as BloomTone)
  ) {
    throw new Error("Groq returned artwork settings outside the allowed range.");
  }

  return {
    leafCount: leafCount as number,
    flowerCount: request.decoration === "olive-branch" ? 0 : flowerCount as number,
    petalCount: petalCount as number,
    stemBend: stemBend as number,
    leafTone: leafTone as LeafTone,
    bloomTone: bloomTone as BloomTone,
  };
}

function createLeaf(x: number, y: number, angle: number, color: string, outlineOnly: boolean): string {
  const fill = outlineOnly ? "none" : color;
  const stroke = outlineOnly ? color : "#5f6955";
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M0 0 C-8 -10 -22 -27 -17 -40 C-1 -39 10 -24 0 0Z" fill="${fill}" stroke="${stroke}" stroke-width="2.3" stroke-linejoin="round"/><path d="M0 0 C-4 -12 -8 -23 -15 -34" fill="none" stroke="${stroke}" stroke-width="1.25" opacity=".76"/></g>`;
}

function createFlower(
  x: number,
  y: number,
  petalCount: number,
  color: string,
  outlineOnly: boolean,
): string {
  const petals = Array.from({ length: petalCount }, (_, index) => {
    const angle = (360 / petalCount) * index;
    return `<ellipse cx="0" cy="-8" rx="5.5" ry="10" transform="rotate(${angle})" fill="${outlineOnly ? "none" : color}" stroke="#977273" stroke-width="1.15" opacity=".94"/>`;
  }).join("");
  return `<g transform="translate(${x} ${y})">${petals}<circle r="4.1" fill="#b58a67" stroke="#91785f" stroke-width="1"/></g>`;
}

function buildSvg(request: CardArtworkRequest, art: SvgArtDirection): string {
  const linework = request.artworkStyle === "botanical-linework";
  const pressed = request.artworkStyle === "pressed-petals";
  const leaves = Array.from({ length: art.leafCount }, (_, index) => {
    const t = (index + 1) / (art.leafCount + 1);
    const x = 105 + t * 300;
    const y = 414 - t * 320 + Math.sin(t * Math.PI) * art.stemBend;
    const side = index % 2 === 0 ? -1 : 1;
    return createLeaf(x, y, side * (28 + t * 25), leafColors[art.leafTone], linework);
  }).join("");

  const flowers = Array.from({ length: art.flowerCount }, (_, index) => {
    const t = art.flowerCount === 1 ? 0.76 : 0.64 + index * 0.1;
    const x = 105 + t * 300 + (index - (art.flowerCount - 1) / 2) * 19;
    const y = 414 - t * 320 + Math.sin(t * Math.PI) * art.stemBend - 7;
    return createFlower(x, y, art.petalCount, bloomColors[art.bloomTone], linework);
  }).join("");

  const watercolorOpacity = request.artworkStyle === "watercolor" ? 0.78 : 1;
  const pressedDetail = pressed
    ? '<path d="M202 285 C235 240 279 184 342 136" fill="none" stroke="#d3c8b5" stroke-width="1.2" opacity=".65"/>'
    : "";
  const background = request.paperTone === "blush-ivory" ? "#9a7778" : "#887c63";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img"><g opacity="${watercolorOpacity}"><path d="M82 445 C176 377 ${230 + art.stemBend} 250 424 72" fill="none" stroke="${background}" stroke-width="5" stroke-linecap="round"/>${leaves}${flowers}${pressedDetail}</g></svg>`;
}

export async function generateGroqSvgArtwork(
  request: CardArtworkRequest,
): Promise<{ b64_json: string; mimeType: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Groq API key is not configured.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: "qwen/qwen3.8-27b",
      messages: [
        {
          role: "system",
          content:
            "You create concise art direction for a romantic botanical keepsake card. Return only one JSON object with keys leafCount, flowerCount, petalCount, stemBend, leafTone, bloomTone. leafCount is an integer 3–8; flowerCount is an integer 0–3; petalCount is an integer 5–9; stemBend is a number from -28 to 28; leafTone is sage, olive, or eucalyptus; bloomTone is rose, blush, cream, or lavender. Never include text, SVG, markup, scripts, or extra keys.",
        },
        {
          role: "user",
          content: `Create a restrained ${request.artworkStyle} ${request.decoration} illustration direction for ${request.paperTone} card stock. ${
            request.decoration === "olive-branch" ? "Set flowerCount to 0." : ""
          }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.72,
      max_completion_tokens: 300,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq artwork generation returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq did not return artwork settings.");
  }

  const art = parseArtDirection(content, request);
  const svg = buildSvg(request, art);
  return { b64_json: Buffer.from(svg, "utf8").toString("base64"), mimeType: "image/svg+xml" };
}