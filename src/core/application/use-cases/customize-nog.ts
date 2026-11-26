import { parseBodyColor } from "../../domain/nog-colors";
import type { CurrentUser, NogRecord, NogRepository } from "../ports";
import { MAX_NOG_NAME_LENGTH, MIN_NOG_NAME_LENGTH } from "./hatch-nog";

export interface CustomizeNogDeps {
  currentUser: CurrentUser;
  nogs: NogRepository;
}

export interface CustomizeNogInput {
  nogId: string;
  body: string | null;
  name?: string;
}

export type CustomizeNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "invalid_name" }
  | { status: "ok"; nog: NogRecord };

export async function customizeNog(
  deps: CustomizeNogDeps,
  input: CustomizeNogInput,
): Promise<CustomizeNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const parsed = parseBodyColor(input.body);
  if (!parsed.ok) {
    return { status: "invalid" };
  }

  const trimmedName = input.name !== undefined ? input.name.trim() : undefined;
  if (
    trimmedName !== undefined &&
    (trimmedName.length < MIN_NOG_NAME_LENGTH ||
      trimmedName.length > MAX_NOG_NAME_LENGTH)
  ) {
    return { status: "invalid_name" };
  }

  if (typeof deps.nogs.updateCustomization === "function") {
    const updated = await deps.nogs.updateCustomization(user.id, input.nogId, {
      colors: { body: parsed.value },
      ...(trimmedName !== undefined ? { name: trimmedName } : {}),
    });
    if (!updated) {
      return { status: "not_found" };
    }
    return { status: "ok", nog: updated };
  }

  if (typeof deps.nogs.updateColors === "function") {
    const updated = await deps.nogs.updateColors(user.id, input.nogId, {
      body: parsed.value,
    });
    if (!updated) {
      return { status: "not_found" };
    }
    return {
      status: "ok",
      nog: trimmedName !== undefined ? { ...updated, name: trimmedName } : updated,
    };
  }

  const owned = await deps.nogs.findOwned(user.id, input.nogId);
  if (!owned) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    nog: {
      ...owned,
      ...(trimmedName !== undefined ? { name: trimmedName } : {}),
      colors: { ...owned.colors, body: parsed.value },
    },
  };
}
