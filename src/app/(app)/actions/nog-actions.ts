"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContainer } from "@/composition/container";
import type { BookCoverStyle } from "@/core/application/ports";
import {
  type HatchNogResult,
  MAX_NOG_NAME_LENGTH,
  MIN_NOG_NAME_LENGTH,
} from "@/core/application/use-cases/hatch-nog";
import {
  MAX_SUBJECT_NAME_LENGTH,
  validateSubjectName,
  validateTopicName,
} from "@/core/domain/topic-name";

export type HatchNogFormState = {
  status?:
    | "idle"
    | "already_exists"
    | "invalid_subject"
    | "invalid_name"
    | "error";
  error?: string;
  subjectName?: string;
  name?: string;
  attempt?: number;
};

export interface CompleteOnboardingInput {
  name: string;
  bodyColor: string | null;
  notebookTitle: string;
  coverStyle?: BookCoverStyle;
  equippedSlots?: (string | null)[];
}

export type CompleteOnboardingResult =
  | { status: "unauthenticated" }
  | { status: "invalid_name"; error: string }
  | { status: "invalid_notebook"; error: string }
  | { status: "error"; error: string }
  | { status: "ok"; nogId: string; topicId: string | null };

const VALID_BOOK_COVERS = new Set<BookCoverStyle>([
  "sage",
  "honey",
  "gingham",
  "berry",
  "denim",
  "forest",
]);

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function deriveBackingSubjectName(notebookTitle: string, suffix?: string): string {
  const cleanSuffix = suffix ? ` ${suffix}` : "";
  const maxBaseLen = Math.max(1, MAX_SUBJECT_NAME_LENGTH - cleanSuffix.length);
  const base = notebookTitle.slice(0, maxBaseLen).trim();
  const candidate = `${base}${cleanSuffix}`.trim();
  if (validateSubjectName(candidate).ok) {
    return candidate;
  }
  const fallback = `Study Notebook${cleanSuffix}`.slice(0, MAX_SUBJECT_NAME_LENGTH).trim();
  return fallback;
}

export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const trimmedName = typeof input?.name === "string" ? input.name.trim() : "";
  if (
    trimmedName.length < MIN_NOG_NAME_LENGTH ||
    trimmedName.length > MAX_NOG_NAME_LENGTH
  ) {
    return {
      status: "invalid_name",
      error: "Give your Nog a name between 1 and 24 characters.",
    };
  }

  const rawNotebookTitle =
    typeof input?.notebookTitle === "string" ? input.notebookTitle : "";
  const validatedTopic = validateTopicName(rawNotebookTitle);
  if (!validatedTopic.ok) {
    return {
      status: "invalid_notebook",
      error: "Use 1 to 60 letters or numbers for your notebook title.",
    };
  }

  const coverStyle: BookCoverStyle =
    input.coverStyle && VALID_BOOK_COVERS.has(input.coverStyle)
      ? input.coverStyle
      : "sage";

  try {
    const container = await createContainer();

    const suffixAttempts: (string | undefined)[] = [
      undefined,
      "2",
      "3",
      Date.now().toString(36).slice(-4),
    ];

    let hatchResult: HatchNogResult = { status: "invalid_subject" };
    for (const suffix of suffixAttempts) {
      const subjectName = deriveBackingSubjectName(validatedTopic.value, suffix);
      hatchResult = await container.hatchNog({
        subjectName,
        name: trimmedName,
      });
      if (hatchResult.status !== "already_exists") {
        break;
      }
    }

    if (hatchResult.status === "unauthenticated") {
      return { status: "unauthenticated" };
    }

    if (hatchResult.status === "invalid_name") {
      return {
        status: "invalid_name",
        error: "Give your Nog a name between 1 and 24 characters.",
      };
    }

    if (hatchResult.status !== "ok") {
      return {
        status: "error",
        error: "Brain fog! We couldn't finish hatching your Nog just now. Please try again.",
      };
    }

    const nogId = hatchResult.nog.id;

    if (input.bodyColor !== null && typeof container.customizeNog === "function") {
      try {
        await container.customizeNog({
          nogId,
          body: input.bodyColor,
        });
      } catch {
        // Initial tint is best-effort; user can adjust again in Customize.
      }
    }

    let topicId: string | null = null;
    if (typeof container.addTopic === "function") {
      try {
        const topicResult = await container.addTopic({
          nogId,
          title: validatedTopic.value,
        });
        if (
          topicResult.status === "ok" ||
          topicResult.status === "pending" ||
          topicResult.status === "already_exists"
        ) {
          topicId = topicResult.topic.id;
        }
      } catch {
        // Keep the hatched Nog even if background topic creation fails transiently.
      }
    }

    if (typeof container.updatePlayerPreferences === "function") {
      try {
        const existingPrefs =
          typeof container.getPlayerEconomy === "function"
            ? await container.getPlayerEconomy().then((res) =>
                res.status === "ok" ? res.state.notebookPrefs : {},
              )
            : {};

        const cleanSlots = Array.isArray(input.equippedSlots)
          ? input.equippedSlots
              .slice(0, 4)
              .map((slot) => (typeof slot === "string" ? slot : null))
          : undefined;

        await container.updatePlayerPreferences({
          ...(cleanSlots ? { equippedSlots: cleanSlots } : {}),
          ...(topicId
            ? {
                notebookPrefs: {
                  ...existingPrefs,
                  [topicId]: {
                    cover: coverStyle,
                    title: validatedTopic.value,
                  },
                },
              }
            : {}),
        });
      } catch {
        // Economy preferences persist locally as a fallback.
      }
    }

    revalidatePath("/home");
    revalidatePath("/nogs");
    revalidatePath(`/nogs/${nogId}`);
    revalidatePath(`/nogs/${nogId}/notebook`);

    return { status: "ok", nogId, topicId };
  } catch {
    return {
      status: "error",
      error: "Brain fog! We couldn't finish setting up your Nog just now. Please try again.",
    };
  }
}

export async function hatchNogAction(
  prevState: HatchNogFormState,
  formData: FormData,
): Promise<HatchNogFormState> {
  const attempt = (prevState?.attempt ?? 0) + 1;

  if (!(formData instanceof FormData)) {
    return {
      status: "error",
      error: "We couldn't hatch your Nog just now. Please try again.",
      attempt,
    };
  }

  const subjectName = readFormString(formData, "subjectName");
  const name = readFormString(formData, "name");

  let result: HatchNogResult;
  try {
    const container = await createContainer();
    result = await container.hatchNog({ subjectName, name });
  } catch {
    return {
      status: "error",
      error: "Brain fog! We couldn't hatch your Nog just now. Please try again.",
      subjectName,
      name,
      attempt,
    };
  }

  if (result.status === "unauthenticated") {
    redirect("/login?next=%2Fadopt");
  }

  if (result.status === "ok") {
    revalidatePath("/home");
    revalidatePath("/nogs");
    redirect(`/nogs/${result.nog.id}/customize`);
  }

  if (result.status === "already_exists") {
    const existingSubject =
      result.existing.subjectName?.trim() || subjectName.trim() || "this subject";
    return {
      status: "already_exists",
      error: `You already have a Nog for ${existingSubject} (${result.existing.name}). Pick a different subject.`,
      subjectName,
      name,
      attempt,
    };
  }

  if (result.status === "invalid_subject" || result.status === "not_found") {
    return {
      status: "invalid_subject",
      error: "Please enter a valid subject between 1 and 40 characters.",
      subjectName,
      name,
      attempt,
    };
  }

  return {
    status: "invalid_name",
    error: "Give your Nog a name between 1 and 24 characters.",
    subjectName,
    name,
    attempt,
  };
}
