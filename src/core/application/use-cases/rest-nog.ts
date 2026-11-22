import type { Clock, CurrentUser, NogRecord, NogRepository } from "../ports";

export const REST_DAY_OPTIONS = [1, 2, 3, 7] as const;

export type RestDayOption = (typeof REST_DAY_OPTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RestNogDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "setRest">;
  clock: Clock;
}

export interface StartRestInput {
  nogId: string;
  days: number;
}

export interface WakeNogInput {
  nogId: string;
}

export type RestNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "ok"; nog: NogRecord };

function isAllowedRestDays(days: number): days is RestDayOption {
  return (
    typeof days === "number" &&
    Number.isInteger(days) &&
    (REST_DAY_OPTIONS as readonly number[]).includes(days)
  );
}

export async function startRest(
  deps: RestNogDeps,
  input: StartRestInput,
): Promise<RestNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  if (!isAllowedRestDays(input.days)) {
    return { status: "invalid" };
  }

  const restUntil = new Date(
    deps.clock.now().getTime() + input.days * DAY_MS,
  ).toISOString();

  const updated = await deps.nogs.setRest(user.id, input.nogId, restUntil);
  if (!updated) {
    return { status: "not_found" };
  }

  return { status: "ok", nog: updated };
}

export async function wakeNog(
  deps: RestNogDeps,
  input: WakeNogInput,
): Promise<RestNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const updated = await deps.nogs.setRest(user.id, input.nogId, null);
  if (!updated) {
    return { status: "not_found" };
  }

  return { status: "ok", nog: updated };
}
