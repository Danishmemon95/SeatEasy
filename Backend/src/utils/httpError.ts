/**
 * An error that carries the HTTP response it should become.
 *
 * Thrown inside a db.transaction() callback it does two jobs at once: the
 * throw rolls the transaction back, and the handler's catch turns it into the
 * right status code instead of a 500.
 */
export class HttpError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = "HttpError";
    }
}
