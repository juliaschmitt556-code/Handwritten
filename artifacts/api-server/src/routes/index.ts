import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cardArtworkRouter from "./card-artwork";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cardArtworkRouter);

export default router;
