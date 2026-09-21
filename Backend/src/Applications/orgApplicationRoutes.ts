import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import { applicationDecision, applicationList, applyOrg, myApplication } from "./orgApplicationController";

const router = Router()

router.get("/", protectRoute, myApplication)
router.get("/all", protectRoute, requireRole("admin"), applicationList)
router.post("/", protectRoute, requireRole("buyer"), applyOrg)
router.post("/decision", protectRoute, requireRole("admin"), applicationDecision)

export default router;