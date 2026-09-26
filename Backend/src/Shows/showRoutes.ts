import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import { createShow, deleteShow, getShowById, getShows, publishShow, updateShow } from "./showController";
import { showScreeningRoutes } from "../Screenings/screeningRoutes";

// Organizers manage their own shows; admins can view and manage all of them.
// Only organizers create shows, because every show needs an organizer owner.
const router = Router()

router.use("/:showId/screenings", showScreeningRoutes)

router.get("/", protectRoute, requireRole("organizer", "admin"), getShows)
router.get("/:showId", protectRoute, requireRole("organizer", "admin"), getShowById)
router.post("/", protectRoute, requireRole("organizer"), createShow)
router.put("/:showId", protectRoute, requireRole("organizer", "admin"), updateShow)
router.post("/:showId/publish", protectRoute, requireRole("organizer", "admin"), publishShow)
router.delete("/:showId", protectRoute, requireRole("organizer", "admin"), deleteShow)

export default router
