import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(message || "Validation failed", 422);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return fail("A record with this value already exists.", 409);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  ) {
    return fail("Record not found.", 404);
  }
  console.error(error);
  return fail("Something went wrong. Please try again.", 500);
}
