import { Router } from "express";
import { protectRoute } from "../middleware/authMiddleware";
import { createBooking, getBookingById, getMyBookings, payBooking } from "./bookingController";

// Mounted at /api/bookings. Any signed-in, verified user can book.
const router = Router();

router.post("/", protectRoute, createBooking);
router.get("/me", protectRoute, getMyBookings);
router.get("/:bookingId", protectRoute, getBookingById);
router.post("/:bookingId/pay", protectRoute, payBooking);

export default router;
