import {
  applyPettingHappiness,
  DEFAULT_PETTING_DAILY_CAP,
} from "../../domain/petting";
import type { Clock, CurrentUser, NogRecord, NogRepository } from "../ports";

export interface PetNogDeps {
  currentUser: CurrentUser;
  clock: Clock;
  nogs: Pick<NogRepository, "findOwned" | "updatePetting">;
}

export interface PetNogInput {
  nogId: string;
  delta?: number;
  dailyCap?: number;
}

export type PetNogResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: "ok";
      nog: NogRecord;
      happiness: number;
      happinessToday: number;
      deltaApplied: number;
    };

export async function petNog(
  deps: PetNogDeps,
  input: PetNogInput,
): Promise<PetNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const today = deps.clock.now().toISOString().slice(0, 10);
  const currentHappiness = nog.happiness ?? 70;
  const currentHappinessToday =
    nog.happinessDay === today ? (nog.happinessToday ?? 0) : 0;

  const next = applyPettingHappiness(
    { happiness: currentHappiness, happinessToday: currentHappinessToday },
    input.delta ?? 1,
    { dailyCap: input.dailyCap ?? DEFAULT_PETTING_DAILY_CAP },
  );

  const updated = await deps.nogs.updatePetting({
    nogId: nog.id,
    happiness: next.happiness,
    happinessToday: next.happinessToday,
    happinessDay: today,
  });

  return {
    status: "ok",
    nog: updated,
    happiness: next.happiness,
    happinessToday: next.happinessToday,
    deltaApplied: next.happiness - currentHappiness,
  };
}
