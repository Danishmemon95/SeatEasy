import { Router } from "express";
import { protectRoute } from "../middleware/authMiddleware";
import { getMyHolds, holdSeats, releaseHolds } from "./holdController";

// Mounted at /api/screenings/:screeningId/holds; mergeParams exposes :screeningId.
// Any signed-in, verified user can buy, whatever their role.
const router = Router({ mergeParams: true });

router.post("/", protectRoute, holdSeats);
router.delete("/", protectRoute, releaseHolds);
router.get("/me", protectRoute, getMyHolds);

export default router;
