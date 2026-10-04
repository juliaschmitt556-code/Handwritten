import type { CardArtworkRequest } from "@workspace/api-zod";
import { logger } from "./logger";
import { generateGeminiArtwork } from "./gemini-image-provider";
import { generateGroqSvgArtwork } from "./groq-svg-provider";

const TRANSPARENT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';

export async function generateCardArtwork(request: CardArtworkRequest) {
  if (request.decoration === "none") {
    return {
      b64_json: Buffer.from(TRANSPARENT_SVG, "utf8").toString("base64"),
      mimeType: "image/svg+xml",
      provider: "none" as const,
    };
  }

  let geminiFailure: unknown;
  if (process.env.GEMINI_API_KEY) {
    try {
      const image = await generateGeminiArtwork(request);
      return { ...image, provider: "gemini" as const };
    } catch (error) {
      geminiFailure = error;
      logger.warn({ provider: "gemini" }, "Primary artwork provider failed; trying Groq SVG fallback");
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const image = await generateGroqSvgArtwork(request);
      return { ...image, provider: "groq-svg" as const };
    } catch {
      logger.error({ provider: "groq-svg" }, "Fallback artwork provider failed");
    }
  }

  if (geminiFailure) {
    throw new Error("Artwork generation failed with both configured providers.");
  }
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    throw new Error("No artwork provider is configured.");
  }
  throw new Error("Artwork generation failed.");
}