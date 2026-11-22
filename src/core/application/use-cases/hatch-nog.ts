import type { CurrentUser, NogRecord, NogRepository } from "../ports";

export const MIN_NOG_NAME_LENGTH = 1;
export const MAX_NOG_NAME_LENGTH = 24;

export interface HatchNogDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findByOwnerAndSubject" | "create">;
}

export interface HatchNogInput {
  subjectId: string;
  name: string;
}

export type HatchNogResult =
  | { status: "unauthenticated" }
  | { status: "invalid_name" }
  | { status: "already_exists"; existing: NogRecord }
  | { status: "ok"; nog: NogRecord };

export async function hatchNog(
  deps: HatchNogDeps,
  input: HatchNogInput,
): Promise<HatchNogResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const trimmedName = input.name.trim();
  if (
    trimmedName.length < MIN_NOG_NAME_LENGTH ||
    trimmedName.length > MAX_NOG_NAME_LENGTH
  ) {
    return { status: "invalid_name" };
  }

  const existing = await deps.nogs.findByOwnerAndSubject(
    user.id,
    input.subjectId,
  );
  if (existing) {
    return { status: "already_exists", existing };
  }

  const nog = await deps.nogs.create({
    ownerId: user.id,
    subjectId: input.subjectId,
    name: trimmedName,
  });

  return { status: "ok", nog };
}
