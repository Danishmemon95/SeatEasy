import jwt from "jsonwebtoken";
import { db } from "../../src/config/db";
import { screeningPrices, screenings, screeningSeats, seats, shows, users, venues, type SeatCategory, type UserRole } from "../../src/db/schema";
import { asc, eq } from "drizzle-orm";

let counter = 0;

/**
 * A user inserted straight into the database, with a signed session cookie.
 * Skips /register and /login, so no bcrypt and no rate limiter.
 */
export const createUser = async (role: UserRole = "buyer", { verified = true } = {}) => {
    counter += 1;
    const [user] = await db.insert(users).values({
        username: `user${counter}`,
        email: `user${counter}@example.com`,
        passwordHash: "not-a-real-hash",
        role,
        isVerified: verified,
    }).returning();

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    return { id: user.id, user, cookie: `jwt=${token}` };
};

export type TestUser = Awaited<ReturnType<typeof createUser>>;

type SeedOptions = {
    /** One entry per row, labelled A, B, C… */
    rows?: SeatCategory[];
    seatsPerRow?: number;
    prices?: Partial<Record<SeatCategory, string>>;
    showStatus?: "draft" | "published";
};

/**
 * A bookable screening with its seat inventory: organizer, venue, seats,
 * show, screening, prices and screening_seats. Starts tomorrow.
 * `seatIds` are screening_seats ids in seat-map order (A1, A2, … B1, …).
 */
export const seedScreening = async ({
    rows = ["gold", "platinum"],
    seatsPerRow = 6,
    prices = { gold: "250.00", platinum: "400.00", sofa: "600.00" },
    showStatus = "published",
}: SeedOptions = {}) => {
    const organizer = await createUser("organizer");

    const [venue] = await db.insert(venues)
        .values({ ownerId: organizer.id, name: "Test Hall", city: "Ahmedabad", address: "1 Test Road" })
        .returning();

    const seatValues = rows.flatMap((category, rowIndex) =>
        Array.from({ length: seatsPerRow }, (_, i) => ({
            venueId: venue.id,
            rowLabel: String.fromCharCode(65 + rowIndex),
            seatNumber: i + 1,
            category,
        })),
    );
    const venueSeats = await db.insert(seats).values(seatValues).returning();

    const [show] = await db.insert(shows).values({
        orgId: organizer.id,
        title: "Test Show",
        description: "A show for the tests",
        type: "movie",
        language: "English",
        durationMinutes: 120,
        ageRating: "UA",
        status: showStatus,
        publishedAt: showStatus === "published" ? new Date() : null,
    }).returning();

    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [screening] = await db.insert(screenings).values({
        showId: show.id,
        venueId: venue.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 120 * 60 * 1000),
    }).returning();

    const categories = [...new Set(rows)];
    await db.insert(screeningPrices).values(
        categories.map((category) => ({ screeningId: screening.id, category, price: prices[category]! })),
    );

    await db.insert(screeningSeats).values(
        venueSeats.map((seat) => ({ screeningId: screening.id, seatId: seat.id, price: prices[seat.category]! })),
    );

    const inventory = await db.select({ id: screeningSeats.id, category: seats.category, price: screeningSeats.price })
        .from(screeningSeats)
        .innerJoin(seats, eq(screeningSeats.seatId, seats.id))
        .where(eq(screeningSeats.screeningId, screening.id))
        .orderBy(asc(seats.rowLabel), asc(seats.seatNumber));

    return {
        organizer,
        venueId: venue.id,
        showId: show.id,
        screeningId: screening.id,
        seatIds: inventory.map((s) => s.id),
        inventory,
    };
};
