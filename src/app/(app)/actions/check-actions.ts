"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type {
  RunQuickCheckInput,
  RunQuickCheckResult,
} from "@/core/application/use-cases/run-quick-check";

function revalidateNogCheckPaths(nogId: string) {
  revalidatePath("/home");
  revalidatePath(`/nogs/${nogId}`);
  revalidatePath(`/nogs/${nogId}/play`);
  revalidatePath(`/nogs/${nogId}/analysis`);
  revalidatePath(`/nogs/${nogId}/notebook`);
  revalidatePath("/profile", "layout");
}

export async function runQuickCheckAction(
  input: RunQuickCheckInput,
): Promise<RunQuickCheckResult> {
  if (!input?.nogId || !input?.topicId) {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.runQuickCheck(input);
  if (result.status === "ok") {
    revalidateNogCheckPaths(input.nogId);
  }
  return result;
}
