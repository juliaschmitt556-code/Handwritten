import type { CardArtworkRequest } from "@workspace/api-zod";

type GeminiPart = {
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};

const styleDescriptions: Record<CardArtworkRequest["artworkStyle"], string> = {
  watercolor: "soft translucent watercolor washes with delicate paper-like pigment edges",
  "botanical-linework": "fine vintage botanical ink linework with restrained watercolor accents",
  "pressed-petals": "a small arrangement of pressed rose petals and finely detailed leaves",
};

const decorationDescriptions: Record<CardArtworkRequest["decoration"], string> = {
  "rose-sprig": "one slender rose sprig with a few small leaves",
  wildflower: "a restrained small cluster of delicate wildflowers",
  "olive-branch": "one graceful olive branch with muted leaves",
  none: "no decorative object",
};

const paperDescriptions: Record<CardArtworkRequest["paperTone"], string> = {
  "warm-cream": "warm cream",
  ivory: "soft ivory",
  "blush-ivory": "subtle blush ivory",
};

function buildPrompt(request: CardArtworkRequest): string {
  return [
    "Create one refined, romantic decorative illustration layer for an elegant handwritten keepsake card.",
    `Artwork style: ${styleDescriptions[request.artworkStyle]}.`,
    `Motif: ${decorationDescriptions[request.decoration]}.`,
    `The intended card paper is ${paperDescriptions[request.paperTone]}.`,
    "Square 1:1 composition, small centered botanical motif with ample clear space around it, restrained antique-rose and sage palette.",
    "Use a plain pure-white background so the client can blend the artwork onto paper. No paper sheet, card mockup, frame, or border.",
    "Do not include any text, letters, pseudo-lettering, calligraphy, words, labels, logos, watermarks, signatures, or typography.",
    "Return an image only; the card message is rendered separately by the application.",
  ].join(" ");
}

export async function generateGeminiArtwork(
  request: CardArtworkRequest,
): Promise<{ b64_json: string; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(request) }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini image generation returned ${response.status}.`);
  }

  const payload = (await response.json()) as GeminiResponse;
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const image = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const b64_json = image?.inlineData?.data ?? image?.inline_data?.data;
  const mimeType = image?.inlineData?.mimeType ?? image?.inline_data?.mime_type ?? "image/png";

  if (!b64_json || !mimeType.startsWith("image/")) {
    throw new Error("Gemini did not return a valid image.");
  }

  return { b64_json, mimeType };
}