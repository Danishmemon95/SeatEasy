import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import { applicationDecision, applicationList, applyOrg } from "./orgApplicationController";

const router = Router()

router.get("/", protectRoute, requireRole("admin"), applicationList)
router.post("/", protectRoute, requireRole("buyer"), applyOrg)
router.post("/decision", protectRoute, requireRole("admin"), applicationDecision)

export default router;