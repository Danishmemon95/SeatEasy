import type { Request } from "express";
import { eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** The user protectRoute attaches to the request. */
export type AuthedUser = NonNullable<Request["user"]>;

export const isAdmin = (user: AuthedUser) => user.role === "admin";

/**
 * Restricts a query to rows the user owns. Admins manage everything, so they
 * get no restriction. Drizzle's and() skips undefined, so the result can be
 * passed straight into a where clause alongside other conditions.
 *
 * Rows owned by someone else simply don't match, which surfaces as a 404: an
 * organizer can't tell another organizer's resource apart from a missing one.
 */
export const ownerScope = (column: AnyPgColumn, user: AuthedUser): SQL | undefined =>
    isAdmin(user) ? undefined : eq(column, user.id);
