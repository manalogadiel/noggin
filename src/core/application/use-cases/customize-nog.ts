import { parseBodyColor } from "../../domain/nog-colors";
import type { CurrentUser, NogRecord, NogRepository } from "../ports";

export interface CustomizeNogDeps {
  currentUser: CurrentUser;
  nogs: NogRepository;
}

export interface CustomizeNogInput {
  nogId: string;
  body: string | null;
}

export type CustomizeNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "invalid" }
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

  if (typeof deps.nogs.updateColors === "function") {
    const updated = await deps.nogs.updateColors(user.id, input.nogId, {
      body: parsed.value,
    });
    if (!updated) {
      return { status: "not_found" };
    }
    return { status: "ok", nog: updated };
  }

  const owned = await deps.nogs.findOwned(user.id, input.nogId);
  if (!owned) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    nog: {
      ...owned,
      colors: { ...owned.colors, body: parsed.value },
    },
  };
}
