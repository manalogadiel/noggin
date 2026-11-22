"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type { AddTopicResult } from "@/core/application/use-cases/add-topic";

export type AddTopicActionResult =
  | AddTopicResult
  | { status: "error"; error: string };

export async function addTopicAction(
  nogId: string,
  title: string,
): Promise<AddTopicActionResult> {
  if (!nogId || typeof nogId !== "string") {
    return { status: "not_found" };
  }

  try {
    const container = await createContainer();
    const result = await container.addTopic({ nogId, title });
    if (result.status === "ok" || result.status === "pending") {
      revalidatePath(`/nogs/${nogId}/notebook`);
      revalidatePath(`/nogs/${nogId}/feed`);
    }
    return result;
  } catch {
    return {
      status: "error",
      error: "Brain fog — couldn't add that topic right now. Try again.",
    };
  }
}
