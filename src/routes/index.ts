import { Router } from "express";

import { getApy } from "../protocols";

const router = Router();

router.get("/zerolend", getApy);

export default router;
