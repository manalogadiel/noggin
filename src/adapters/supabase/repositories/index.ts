import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityRepository,
  AskHistoryRepository,
  EconomyRepository,
  NogRepository,
  ProfileRepository,
  ProgressRepository,
  QuestionBank,
  SubjectRepository,
  TopicRepository,
  UsageRepository,
} from "@/core/application/ports";
import { createActivityRepository } from "./activity-repository";
import { createAskHistoryRepository } from "./ask-history-repository";
import {
  createAttemptRepository,
  type SupabaseAttemptRepository,
} from "./attempt-repository";
import { createEconomyRepository } from "./economy-repository";
import { createNogRepository } from "./nog-repository";
import {
  createNotebookRepository,
  type SupabaseNotebookRepository,
} from "./notebook-repository";
import { createProfileRepository } from "./profile-repository";
import { createProgressRepository } from "./progress-repository";
import { createQuestionBank } from "./question-bank";
import { createSubjectRepository } from "./subject-repository";
import {
  createThoughtCardRepository,
  type SupabaseThoughtCardRepository,
} from "./thought-card-repository";
import { createTopicRepository } from "./topic-repository";
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
  profiles: ProfileRepository;
  progress: ProgressRepository;
  activity: ActivityRepository;
  subjects: SubjectRepository;
  topics: TopicRepository;
  nogs: NogRepository;
  notebook: SupabaseNotebookRepository;
  thoughtCards: SupabaseThoughtCardRepository;
  questions: QuestionBank;
  attempts: SupabaseAttemptRepository;
  usage: UsageRepository;
  askHistory: AskHistoryRepository;
  economy: EconomyRepository;
}

export function createSupabaseRepositories(
  options: CreateSupabaseRepositoriesOptions,
): SupabaseRepositories {
  const { session, service, userId } = options;

  return {
    profiles: createProfileRepository({ session, userId }),
    progress: createProgressRepository({ session, service, userId }),
    activity: createActivityRepository({ session, service, userId }),
    subjects: createSubjectRepository({ session, service, userId }),
    topics: createTopicRepository({ session, service, userId }),
    nogs: createNogRepository({ session, service, userId }),
    notebook: createNotebookRepository({ session, service, userId }),
    thoughtCards: createThoughtCardRepository({ session, service, userId }),
    questions: createQuestionBank({ service }),
    attempts: createAttemptRepository({ session, service, userId }),
    usage: createUsageRepository({ service, userId }),
    askHistory: createAskHistoryRepository({ session, service, userId }),
    economy: createEconomyRepository({ session, userId }),
  };
}
