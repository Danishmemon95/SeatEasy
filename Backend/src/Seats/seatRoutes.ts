import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import { addSeatRows, deleteSeat, deleteSeatRow, getSeats, updateSeat } from "./seatController";

// Mounted under /api/venues/:venueId/seats; mergeParams exposes :venueId here.
// Venue ownership is checked in the controller: organizers manage the seats of
// their own venues, admins of any venue.
const router = Router({ mergeParams: true })

router.get("/", protectRoute, requireRole("organizer", "admin"), getSeats)
router.post("/", protectRoute, requireRole("organizer", "admin"), addSeatRows)
router.delete("/rows/:row", protectRoute, requireRole("organizer", "admin"), deleteSeatRow)
router.patch("/:seatId", protectRoute, requireRole("organizer", "admin"), updateSeat)
router.delete("/:seatId", protectRoute, requireRole("organizer", "admin"), deleteSeat)

export default router
