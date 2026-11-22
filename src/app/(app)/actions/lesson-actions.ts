"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type {
  AnswerFollowUpInput,
  AnswerFollowUpResult,
} from "@/core/application/use-cases/answer-follow-up";
import type {
  ReviseLessonInput,
  ReviseLessonResult,
} from "@/core/application/use-cases/revise-lesson";
import type {
  TeachLessonInput,
  TeachLessonResult,
} from "@/core/application/use-cases/teach-lesson";

function revalidateNogLearningPaths(nogId: string) {
  revalidatePath(`/nogs/${nogId}`);
  revalidatePath(`/nogs/${nogId}/feed`);
  revalidatePath(`/nogs/${nogId}/notebook`);
  revalidatePath(`/nogs/${nogId}/analysis`);
}

export async function teachLessonAction(
  input: TeachLessonInput,
): Promise<TeachLessonResult> {
  if (!input?.nogId || !input?.topicId) {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.teachLesson(input);
  if (result.status === "ok" || result.status === "brain_fog") {
    revalidateNogLearningPaths(input.nogId);
  }
  return result;
}

export async function answerFollowUpAction(
  input: AnswerFollowUpInput,
): Promise<AnswerFollowUpResult> {
  if (!input?.nogId || !input?.topicId || !input?.lessonId) {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.answerFollowUp(input);
  if (result.status === "ok" || result.status === "brain_fog") {
    revalidateNogLearningPaths(input.nogId);
  }
  return result;
}

export async function reviseLessonAction(
  input: ReviseLessonInput,
): Promise<ReviseLessonResult> {
  if (!input?.nogId || !input?.topicId || !input?.lessonId) {
    return { status: "not_found" };
  }

  const container = await createContainer();
  const result = await container.reviseLesson(input);
  if (result.status === "ok" || result.status === "brain_fog") {
    revalidateNogLearningPaths(input.nogId);
  }
  return result;
}
