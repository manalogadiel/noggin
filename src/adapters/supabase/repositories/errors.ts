import type { PostgrestError } from "@supabase/supabase-js";

export type SupabaseErrorCode =
  | "CONFIG_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "BUSY"
  | "DATABASE_ERROR";

export class SupabaseAdapterError extends Error {
  readonly code: SupabaseErrorCode;
  readonly pgCode?: string;

  constructor(code: SupabaseErrorCode, message: string, pgCode?: string) {
    super(message);
    this.name = "SupabaseAdapterError";
    this.code = code;
    this.pgCode = pgCode;
  }
}

export class SupabaseConfigError extends SupabaseAdapterError {
  constructor(message: string) {
    super("CONFIG_ERROR", message);
    this.name = "SupabaseConfigError";
  }
}

export class NogBusyError extends SupabaseAdapterError {
  constructor() {
    super("BUSY", "Nog is currently busy with another quick check.");
    this.name = "NogBusyError";
  }
}

export function mapPostgrestError(
  error: Pick<PostgrestError, "code">,
  operation: string,
): SupabaseAdapterError {
  const pgCode = typeof error.code === "string" ? error.code : undefined;

  switch (pgCode) {
    case "23505":
      return new SupabaseAdapterError(
        "CONFLICT",
        `Resource conflict during ${operation}.`,
        pgCode,
      );
    case "42501":
      return new SupabaseAdapterError(
        "FORBIDDEN",
        `Permission denied during ${operation}.`,
        pgCode,
      );
    case "22023":
    case "22P02":
    case "23502":
    case "23503":
    case "23514":
      return new SupabaseAdapterError(
        "INVALID_INPUT",
        `Invalid input during ${operation}.`,
        pgCode,
      );
    case "PGRST116":
      return new SupabaseAdapterError(
        "NOT_FOUND",
        `Resource not found during ${operation}.`,
        pgCode,
      );
    default:
      return new SupabaseAdapterError(
        "DATABASE_ERROR",
        `Database operation failed during ${operation}.`,
        pgCode,
      );
  }
}

export function normalizeTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new SupabaseAdapterError(
      "DATABASE_ERROR",
      "Invalid timestamp returned by database.",
    );
  }
  return new Date(parsed).toISOString();
}
