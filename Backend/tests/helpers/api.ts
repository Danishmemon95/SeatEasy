import request from "supertest";
import app from "../../src/app";
import type { TestUser } from "./factories";

/** The buyer endpoints, called as one user (or signed out when `user` is omitted). */
export const as = (user?: TestUser) => {
    const send = (method: "get" | "post" | "delete", path: string, body?: object) => {
        const req = request(app)[method](path);
        if (user) req.set("Cookie", user.cookie);
        return body ? req.send(body) : req;
    };

    return {
        hold: (screeningId: number | string, seatIds: unknown) =>
            send("post", `/api/screenings/${screeningId}/holds`, { seatIds }),
        holdBody: (screeningId: number | string, body: object) =>
            send("post", `/api/screenings/${screeningId}/holds`, body),
        release: (screeningId: number | string) => send("delete", `/api/screenings/${screeningId}/holds`),
        myHolds: (screeningId: number | string) => send("get", `/api/screenings/${screeningId}/holds/me`),
        seatMap: (screeningId: number | string) => send("get", `/api/catalog/screenings/${screeningId}/seats`),
        createBooking: (screeningId: number, extra: object = {}) =>
            send("post", "/api/bookings", { screeningId, ...extra }),
        pay: (bookingId: number | string) => send("post", `/api/bookings/${bookingId}/pay`),
        booking: (bookingId: number | string) => send("get", `/api/bookings/${bookingId}`),
        myBookings: (query = "") => send("get", `/api/bookings/me${query}`),
    };
};

/** Seat-map status for each of the given seat ids. */
export const mapStatuses = async (screeningId: number, ids: number[]) => {
    const res = await as().seatMap(screeningId);
    const byId = new Map<number, string>(res.body.seats.map((s: { id: number; status: string }) => [s.id, s.status]));
    return ids.map((id) => byId.get(id));
};
