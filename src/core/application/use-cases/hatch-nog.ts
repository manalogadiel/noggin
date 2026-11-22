import { validateSubjectName } from "../../domain/topic-name";
import type {
  CurrentUser,
  NogRecord,
  NogRepository,
  SubjectRecord,
  SubjectRepository,
} from "../ports";

export const MIN_NOG_NAME_LENGTH = 1;
export const MAX_NOG_NAME_LENGTH = 24;

export interface HatchNogDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findByOwnerAndSubject" | "create">;
  subjects?: Pick<
    SubjectRepository,
    "findById" | "findBySlug" | "createUserSubject"
  >;
}

export type HatchNogInput =
  | { subjectId: string; subjectName?: undefined; name: string }
  | { subjectName: string; subjectId?: undefined; name: string };

export type HatchNogResult =
  | { status: "unauthenticated" }
  | { status: "invalid_name" }
  | { status: "invalid_subject" }
  | { status: "not_found" }
  | { status: "already_exists"; existing: NogRecord }
  | { status: "ok"; nog: NogRecord };

function isConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const record = error as { code?: unknown; pgCode?: unknown; message?: unknown };
  if (record.code === "CONFLICT" || record.pgCode === "23505") {
    return true;
  }
  return (
    typeof record.message === "string" &&
    /already exists|conflict/i.test(record.message)
  );
}

async function resolveSubjectById(
  deps: HatchNogDeps,
  userId: string,
  subjectId: string,
): Promise<{ ok: true; subjectId: string } | { ok: false; result: HatchNogResult }> {
  const trimmedId = subjectId.trim();
  if (trimmedId.length === 0) {
    return { ok: false, result: { status: "invalid_subject" } };
  }

  if (deps.subjects) {
    const subject = await deps.subjects.findById(trimmedId);
    if (
      !subject ||
      (subject.ownerId !== null && subject.ownerId !== userId) ||
      (subject.ownerId === null && !subject.available)
    ) {
      return { ok: false, result: { status: "not_found" } };
    }
  }

  return { ok: true, subjectId: trimmedId };
}

async function resolveOrCreateSubjectByName(
  deps: HatchNogDeps,
  userId: string,
  subjectName: string,
): Promise<{ ok: true; subject: SubjectRecord } | { ok: false; result: HatchNogResult }> {
  const validated = validateSubjectName(subjectName);
  if (!validated.ok) {
    return { ok: false, result: { status: "invalid_subject" } };
  }

  if (!deps.subjects) {
    throw new Error("Subject repository is required when hatching by subjectName.");
  }

  const existingSubject = await deps.subjects.findBySlug(validated.slug);
  if (
    existingSubject &&
    ((existingSubject.ownerId === null && existingSubject.available) ||
      existingSubject.ownerId === userId)
  ) {
    return { ok: true, subject: existingSubject };
  }

  try {
    const created = await deps.subjects.createUserSubject({
      ownerId: userId,
      name: validated.value,
      slug: validated.slug,
    });
    return { ok: true, subject: created };
  } catch (error) {
    if (isConflictError(error)) {
      const concurrent = await deps.subjects.findBySlug(validated.slug, userId);
      if (concurrent) {
        return { ok: true, subject: concurrent };
      }
    }
    throw error;
  }
}

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

  let subjectId: string;
  if ("subjectName" in input && input.subjectName !== undefined) {
    const resolved = await resolveOrCreateSubjectByName(
      deps,
      user.id,
      input.subjectName,
    );
    if (!resolved.ok) {
      return resolved.result;
    }
    subjectId = resolved.subject.id;
  } else {
    const resolved = await resolveSubjectById(deps, user.id, input.subjectId);
    if (!resolved.ok) {
      return resolved.result;
    }
    subjectId = resolved.subjectId;
  }

  const existing = await deps.nogs.findByOwnerAndSubject(user.id, subjectId);
  if (existing) {
    return { status: "already_exists", existing };
  }

  try {
    const nog = await deps.nogs.create({
      ownerId: user.id,
      subjectId,
      name: trimmedName,
    });
    return { status: "ok", nog };
  } catch (error) {
    if (isConflictError(error)) {
      const concurrent = await deps.nogs.findByOwnerAndSubject(
        user.id,
        subjectId,
      );
      if (concurrent) {
        return { status: "already_exists", existing: concurrent };
      }
    }
    throw error;
  }
}
