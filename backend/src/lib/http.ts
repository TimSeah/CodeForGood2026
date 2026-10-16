import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Throw from anywhere in a handler to return a specific status code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Success envelope: `{ data: ... }`. Every route returns this shape. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Error envelope: `{ error: { message, details? } }`. */
export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

/**
 * Wrap every route handler with this so validation and unexpected errors
 * come back in the standard error envelope instead of an HTML 500 page.
 */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response> | Response) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) return fail(400, "Invalid request", err.issues);
      if (err instanceof HttpError) return fail(err.status, err.message, err.details);
      console.error(err);
      return fail(500, "Internal server error");
    }
  };
}

/** Parse URL search params into a plain object for zod validation. */
export function queryOf(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}
