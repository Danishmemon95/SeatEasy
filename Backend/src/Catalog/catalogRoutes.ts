import { Router } from "express";
import { getCities, getEventById, getEvents, getHome, getScreeningSeats } from "./catalogController";

// Public: buyers browse signed out, so no protectRoute on any of these.
const router = Router();

router.get("/cities", getCities)
router.get("/home", getHome)
router.get("/events", getEvents)
router.get("/events/:showId", getEventById)
router.get("/screenings/:screeningId/seats", getScreeningSeats)

export default router;
