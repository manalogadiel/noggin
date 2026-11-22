import { validateTopicName } from "../../domain/topic-name";
import type {
  CurrentUser,
  GeneratedQuestionDraft,
  NogRepository,
  QuestionWriter,
  SubjectRepository,
  TopicRecord,
  TopicRepository,
  TopicSummary,
  UsageRepository,
} from "../ports";
import { EntitlementService } from "../services/entitlement";

export interface AddTopicDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  subjects: Pick<SubjectRepository, "findById">;
  topics: Pick<
    TopicRepository,
    "findBySubjectAndSlug" | "createUserTopic" | "saveGeneratedQuestions"
  >;
  usage: UsageRepository;
  questionWriter: QuestionWriter;
}

export interface AddTopicInput {
  nogId: string;
  title: string;
}

export type AddTopicResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "invalid_title" }
  | { status: "already_exists"; topic: TopicSummary }
  | { status: "tired_for_today" }
  | { status: "pending"; topic: TopicSummary }
  | { status: "ok"; topic: TopicSummary };

export function toTopicSummary(record: TopicRecord): TopicSummary {
  return {
    id: record.id,
    subjectId: record.subjectId,
    slug: record.slug,
    title: record.title,
    status: record.status,
    questionCount: record.questionCount,
  };
}

function isConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const record = error as { code?: unknown; pgCode?: unknown; message?: unknown };
  if (record.code === "CONFLICT" || record.pgCode === "23505") {
    return true;
  }
  return (
    typeof record.message === "string" &&
    /already exists|collides|conflict/i.test(record.message)
  );
}

export async function addTopic(
  deps: AddTopicDeps,
  input: AddTopicInput,
): Promise<AddTopicResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const validated = validateTopicName(input.title);
  if (!validated.ok) {
    return { status: "invalid_title" };
  }

  const existing = await deps.topics.findBySubjectAndSlug(
    nog.subjectId,
    validated.slug,
  );
  if (existing && (existing.ownerId === null || existing.ownerId === user.id)) {
    if (existing.status === "ready") {
      return { status: "already_exists", topic: toTopicSummary(existing) };
    }
  }

  const pendingToRetry =
    existing && existing.ownerId === user.id && existing.status === "pending"
      ? existing
      : null;

  const entitlement = new EntitlementService(deps.usage);
  const quota = await entitlement.consume(user.id, "generate", 1);
  if (!quota.allowed) {
    return { status: "tired_for_today" };
  }

  let topic: TopicRecord;
  if (pendingToRetry) {
    topic = pendingToRetry;
  } else {
    try {
      topic = await deps.topics.createUserTopic({
        ownerId: user.id,
        subjectId: nog.subjectId,
        title: validated.value,
        slug: validated.slug,
      });
    } catch (error) {
      if (isConflictError(error)) {
        const concurrent = await deps.topics.findBySubjectAndSlug(
          nog.subjectId,
          validated.slug,
        );
        if (
          concurrent &&
          (concurrent.ownerId === null || concurrent.ownerId === user.id)
        ) {
          if (concurrent.status === "ready") {
            return {
              status: "already_exists",
              topic: toTopicSummary(concurrent),
            };
          }
          if (concurrent.ownerId === user.id) {
            topic = concurrent;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  const subjectName =
    nog.subjectName ??
    (await deps.subjects.findById(nog.subjectId))?.name ??
    "General";

  let generated: GeneratedQuestionDraft[];
  try {
    generated = await deps.questionWriter.generate({
      subjectName,
      topicTitle: topic.title,
    });
  } catch {
    return { status: "pending", topic: toTopicSummary(topic) };
  }

  if (generated.length !== 8) {
    return { status: "pending", topic: toTopicSummary(topic) };
  }

  const saved = await deps.topics.saveGeneratedQuestions({
    ownerId: user.id,
    topicId: topic.id,
    questions: generated,
  });

  return { status: "ok", topic: toTopicSummary(saved) };
}
