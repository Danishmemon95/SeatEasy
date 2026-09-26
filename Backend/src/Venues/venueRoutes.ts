import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import { createVenue, deleteVenue, getVenueById, getVenues, updateVenue } from "./venueController";
import seatRoutes from "../Seats/seatRoutes";

// Organizers manage their own venues; admins can view and manage all of them.
// Only organizers create venues, because every venue needs an organizer owner.
const router = Router()

router.use("/:venueId/seats", seatRoutes)

router.get("/", protectRoute, requireRole("organizer", "admin"), getVenues)
router.get("/:venueId", protectRoute, requireRole("organizer", "admin"), getVenueById)
router.post("/", protectRoute, requireRole("organizer"), createVenue)
router.put("/:venueId", protectRoute, requireRole("organizer", "admin"), updateVenue)
router.delete("/:venueId", protectRoute, requireRole("organizer", "admin"), deleteVenue)

export default router
