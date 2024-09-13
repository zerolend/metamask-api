import { Router } from "express";

import { getApy } from "../controller/protocols/zerolend";

const router= Router()

router.get('/zerolend',getApy)

export default router