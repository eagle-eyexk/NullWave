import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securityRouter from "./security";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securityRouter);
router.use(conversationsRouter);

export default router;
