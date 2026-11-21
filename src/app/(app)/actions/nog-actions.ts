"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContainer } from "@/composition/container";
import type { HatchNogResult } from "@/core/application/use-cases/hatch-nog";

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

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
    redirect(`/nogs/${result.nog.id}`);
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
