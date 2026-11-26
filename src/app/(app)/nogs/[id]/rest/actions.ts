"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type { RestNogResult } from "@/core/application/use-cases/rest-nog";

export async function startRestAction(
  nogId: string,
  days: number,
): Promise<RestNogResult> {
  if (!nogId || typeof nogId !== "string") {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.startRest({ nogId, days });

  if (result.status === "ok") {
    revalidatePath("/home");
    revalidatePath(`/nogs/${nogId}`);
    revalidatePath(`/nogs/${nogId}/rest`);
  }

  return result;
}

export async function wakeNogAction(nogId: string): Promise<RestNogResult> {
  if (!nogId || typeof nogId !== "string") {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.wakeNog({ nogId });

  if (result.status === "ok") {
    revalidatePath("/home");
    revalidatePath(`/nogs/${nogId}`);
    revalidatePath(`/nogs/${nogId}/rest`);
  }

  return result;
}
