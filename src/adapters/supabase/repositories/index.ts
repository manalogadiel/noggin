import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NogRepository,
  QuestionBank,
  UsageRepository,
} from "@/core/application/ports";
import {
  createAttemptRepository,
  type SupabaseAttemptRepository,
} from "./attempt-repository";
import { createNogRepository } from "./nog-repository";
import {
  createNotebookRepository,
  type SupabaseNotebookRepository,
} from "./notebook-repository";
import { createQuestionBank } from "./question-bank";
import {
  createThoughtCardRepository,
  type SupabaseThoughtCardRepository,
} from "./thought-card-repository";
import { createUsageRepository } from "./usage-repository";

export {
  NogBusyError,
  SupabaseAdapterError,
  SupabaseConfigError,
  type SupabaseErrorCode,
} from "./errors";

export interface CreateSupabaseRepositoriesOptions {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}

export interface SupabaseRepositories {
  nogs: NogRepository;
  notebook: SupabaseNotebookRepository;
  thoughtCards: SupabaseThoughtCardRepository;
  questions: QuestionBank;
  attempts: SupabaseAttemptRepository;
  usage: UsageRepository;
}

export function createSupabaseRepositories(
  options: CreateSupabaseRepositoriesOptions,
): SupabaseRepositories {
  const { session, service, userId } = options;

  return {
    nogs: createNogRepository({ session, service, userId }),
    notebook: createNotebookRepository({ session, service, userId }),
    thoughtCards: createThoughtCardRepository({ session }),
    questions: createQuestionBank({ service }),
    attempts: createAttemptRepository({ session, service, userId }),
    usage: createUsageRepository({ service, userId }),
  };
}
