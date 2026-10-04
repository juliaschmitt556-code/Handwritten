import { Router, type IRouter } from "express";
import { GenerateCardArtworkBody, GenerateCardArtworkResponse } from "@workspace/api-zod";
import { generateCardArtwork } from "../lib/card-artwork-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/card-artwork/generate", async (req, res) => {
  const parsed = GenerateCardArtworkBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose a valid artwork style, decoration, and paper tone." });
  }

  try {
    const artwork = await generateCardArtwork(parsed.data);
    const validated = GenerateCardArtworkResponse.parse(artwork);
    return res.status(200).json(validated);
  } catch {
    logger.error({ route: "card-artwork/generate" }, "All artwork providers failed");
    return res.status(502).json({
      error: "Artwork could not be generated. Check provider configuration and try again.",
    });
  }
});

export default router;