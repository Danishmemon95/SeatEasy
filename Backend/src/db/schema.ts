import { pgTable, serial, varchar, boolean, date, text, timestamp, integer, pgEnum, decimal, unique, index } from "drizzle-orm/pg-core";

export const seatCategoryEnum = pgEnum("seat_category", ["gold", "platinum", "sofa"]);
export const userRolesEnum = pgEnum("user_roles", ["admin", "organizer", "buyer"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "cancelled"]);
export const seatStatusEnum = pgEnum("seat_status", ["available", "held", "booked"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "rejected"]);
export const showTypeEnum = pgEnum("show_type", ["movie", "concert", "play", "comedy", "sports", "other"]);
export const ageRatingEnum = pgEnum("age_rating", ["U", "UA", "A"]);
export const showStatusEnum = pgEnum("show_status", ["draft", "published"]);
export const screeningStatusEnum = pgEnum("screening_status", ["scheduled", "cancelled"]);

export type UserRole = (typeof userRolesEnum.enumValues)[number];
export type SeatCategory = (typeof seatCategoryEnum.enumValues)[number];

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    email: varchar("email", { length: 150 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRolesEnum("role").notNull().default("buyer"),
    dob: date("dob"),
    address: text("address"),
    isVerified: boolean("is_verified").notNull().default(false),
    verificationTokenHash: varchar("verification_token_hash", { length: 64 }),
    verificationTokenExpires: timestamp("verification_token_expires", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    index("users_verification_token_hash_idx").on(table.verificationTokenHash),
]);

// Venues belong to the organizer who created them; screenings can only be
// scheduled at venues owned by the same organizer as the show.
export const venues = pgTable("venues", {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id").notNull().references(() => users.id),
    name: varchar("name", { length: 100 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    address: text("address").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    index("venues_owner_id_idx").on(table.ownerId),
])

// One row per physical seat. A seat is identified by its row label and its
// position in that row ("A" + 5 → A5), stored apart so a seat map can be drawn
// without parsing strings.
export const seats = pgTable("seats", {
    id: serial("id").primaryKey(),
    // Seats belong to their venue: deleting a venue removes its seats. A venue
    // with screenings is still protected by the screenings foreign key.
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    rowLabel: varchar("row_label", { length: 3 }).notNull(),
    seatNumber: integer("seat_number").notNull(),
    category: seatCategoryEnum("category").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    unique("seats_venue_row_number_unique").on(table.venueId, table.rowLabel, table.seatNumber),
])

// A show is any live event (the UI calls them "events"). Drafts are visible
// only to their organizer and admins; publishing is one-way.
export const shows = pgTable("shows", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => users.id),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description").notNull(),
    type: showTypeEnum("type").notNull(),
    genre: varchar("genre", { length: 50 }),
    language: varchar("language", { length: 50 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    ageRating: ageRatingEnum("age_rating").notNull(),
    posterUrl: text("poster_url"),
    status: showStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    index("shows_org_id_idx").on(table.orgId),
])

export const screenings = pgTable("screenings", {
    id: serial("id").primaryKey(),
    showId: integer("show_id").notNull().references(() => shows.id),
    venueId: integer("venue_id").notNull().references(() => venues.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // Stored rather than derived so overlap checks are a plain range query.
    // Safe from drift: a show's duration is locked once it has screenings.
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: screeningStatusEnum("status").notNull().default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    index("screenings_venue_starts_at_idx").on(table.venueId, table.startsAt),
    index("screenings_show_id_idx").on(table.showId),
])

// The price per seat category the organizer set for a screening. Each
// screening_seats row copies its price from here when the inventory is built.
export const screeningPrices = pgTable("screening_prices", {
    id: serial("id").primaryKey(),
    screeningId: integer("screening_id").notNull().references(() => screenings.id),
    category: seatCategoryEnum("category").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    unique("screening_prices_screening_category_unique").on(table.screeningId, table.category),
])

export const bookings = pgTable("bookings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    screeningId: integer("screening_id").notNull().references(() => screenings.id),
    status: bookingStatusEnum("status").notNull().default("pending"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    index("bookings_screening_id_idx").on(table.screeningId),
])

export const screeningSeats = pgTable("screening_seats", {
    id: serial("id").primaryKey(),
    screeningId: integer("screening_id").notNull().references(() => screenings.id),
    seatId: integer("seat_id").notNull().references(() => seats.id),
    bookingId: integer("booking_id").references(() => bookings.id),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    status: seatStatusEnum("status").notNull().default("available"),
    heldUntil: timestamp("held_until", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    unique("screening_seat_unique").on(table.screeningId, table.seatId)
])

export const orgApplications = pgTable("org_applications", {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id").notNull().references(() => users.id),
    description: text("description").notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    reviewerId: integer("approver_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})