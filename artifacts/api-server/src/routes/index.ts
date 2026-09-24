import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campusCartRouter from "./campus-cart";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campusCartRouter);

export default router;
