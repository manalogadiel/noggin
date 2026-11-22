"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type {
  ReviewCardInput,
  ReviewCardResult,
} from "@/core/application/use-cases/review-cards";

export async function reviewCardAction(
  input: ReviewCardInput,
): Promise<ReviewCardResult> {
  if (!input?.nogId || !input?.cardId) {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.reviewCard(input);

  if (result.status === "ok") {
    revalidatePath(`/nogs/${input.nogId}`);
    revalidatePath(`/nogs/${input.nogId}/water`);
    revalidatePath(`/nogs/${input.nogId}/analysis`);
    revalidatePath(`/nogs/${input.nogId}/bath`);
  }

  return result;
}
