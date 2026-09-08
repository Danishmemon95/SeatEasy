import { pgTable, serial, varchar, boolean, date, text, timestamp, integer, pgEnum, decimal, unique } from "drizzle-orm/pg-core";

export const seatCategoryEnum = pgEnum("seat_category", ["gold", "platinum", "sofa"]);
export const userRolesEnum = pgEnum("user_roles", ["admin", "organizer", "buyer"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "cancelled"]);
export const seatStatusEnum = pgEnum("seat_status", ["available", "held", "booked"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "rejected"]);

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    email: varchar("email", { length: 150 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRolesEnum("role").notNull().default("buyer"),
    dob: date("dob"),
    address: text("address"),
    isVerified: boolean("is_verified").notNull().default(false),
    verificationToken: varchar("verification_token", { length: 512 }),
    verificationTokenExpires: timestamp("verification_token_expires"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const venues = pgTable("venues", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    address: text("address").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})

export const seats = pgTable("seats", {
    id: serial("id").primaryKey(),
    seatNumber: varchar("seat_number", { length: 10 }).notNull(),
    venueId: integer("venue_id").notNull().references(() => venues.id),
    category: seatCategoryEnum("category").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})

export const shows = pgTable("shows", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => users.id),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})

export const screenings = pgTable("screenings", {
    id: serial("id").primaryKey(),
    showId: integer("show_id").notNull().references(() => shows.id),
    venueId: integer("venue_id").notNull().references(() => venues.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})

export const bookings = pgTable("bookings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    status: bookingStatusEnum("status").notNull().default("pending"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})

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
    approverId: integer("approver_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
})