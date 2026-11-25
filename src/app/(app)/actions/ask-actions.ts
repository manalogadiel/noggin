"use server";

import { createContainer } from "@/composition/container";
import type {
  AskNogInput,
  AskNogResult,
} from "@/core/application/use-cases/ask-nog";

export async function askNogAction(input: AskNogInput): Promise<AskNogResult> {
  if (!input?.nogId || typeof input.question !== "string") {
    return { status: "not_found" };
  }

  const container = await createContainer();
  return container.askNog({
    nogId: input.nogId,
    question: input.question,
    topicId:
      typeof input.topicId === "string" && input.topicId.length > 0
        ? input.topicId
        : null,
  });
}
