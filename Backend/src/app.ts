// Imported first so an invalid environment fails before anything else boots.
import { env } from "./config/env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./Auth/authRoutes";
import OrgApplicationRoutes from "./Applications/orgApplicationRoutes";
import venueRoutes from "./Venues/venueRoutes"
import showRoutes from "./Shows/showRoutes";
import screeningRoutes from "./Screenings/screeningRoutes";
import catalogRoutes from "./Catalog/catalogRoutes";
import holdRoutes from "./Holds/holdRoutes";
import bookingRoutes from "./Bookings/bookingRoutes";

// The Express app, without listening: server.ts starts it, and the tests
// drive it directly.
const app = express();

// Render and similar hosts sit behind a proxy; without this req.ip is the
// proxy's address and every client shares one rate-limit bucket.
app.set("trust proxy", 1);

app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
}));

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Database-free health probe for UptimeRobot keep-alive and Render startup checks
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/application", OrgApplicationRoutes);
app.use("/api/venues", venueRoutes)
app.use("/api/shows", showRoutes);
app.use("/api/screenings", screeningRoutes);
// Buyer holds live under a screening; the organizer routes above only match /:screeningId[/cancel].
app.use("/api/screenings/:screeningId/holds", holdRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/bookings", bookingRoutes);

export default app;
