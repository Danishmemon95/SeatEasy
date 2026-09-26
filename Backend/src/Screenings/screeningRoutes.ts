import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import {
    cancelScreening,
    createScreening,
    deleteScreening,
    getScreeningById,
    getShowScreenings,
    updateScreening,
} from "./screeningController";

// Show ownership is checked in the controller: organizers manage screenings of
// their own shows, admins of any show.

// Mounted under /api/shows/:showId/screenings; mergeParams exposes :showId.
export const showScreeningRoutes = Router({ mergeParams: true })

showScreeningRoutes.get("/", protectRoute, requireRole("organizer", "admin"), getShowScreenings)
showScreeningRoutes.post("/", protectRoute, requireRole("organizer", "admin"), createScreening)

// Mounted at /api/screenings.
const router = Router()

router.get("/:screeningId", protectRoute, requireRole("organizer", "admin"), getScreeningById)
router.put("/:screeningId", protectRoute, requireRole("organizer", "admin"), updateScreening)
router.post("/:screeningId/cancel", protectRoute, requireRole("organizer", "admin"), cancelScreening)
router.delete("/:screeningId", protectRoute, requireRole("organizer", "admin"), deleteScreening)

export default router
