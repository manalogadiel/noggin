import type {
  CurrentUser,
  LessonPage,
  NogRepository,
  NotebookRepository,
  ThoughtCardRecord,
  ThoughtCardRepository,
  TopicRepository,
  TopicSummary,
} from "../ports";
import { toTopicSummary } from "./add-topic";

export interface GetTopicNotebookDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  topics: Pick<TopicRepository, "findById">;
  notebook: Pick<NotebookRepository, "listPages">;
  thoughtCards: Pick<ThoughtCardRepository, "listByTopic">;
}

export interface GetTopicNotebookInput {
  nogId: string;
  topicId: string;
}

export type GetTopicNotebookResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: "ok";
      topic: TopicSummary;
      pages: LessonPage[];
      thoughtCards: ThoughtCardRecord[];
    };

function comparePagesOldestFirst(a: LessonPage, b: LessonPage): number {
  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  const isoDiff = a.createdAt.localeCompare(b.createdAt);
  if (isoDiff !== 0) {
    return isoDiff;
  }
  return a.id.localeCompare(b.id);
}

export async function getTopicNotebook(
  deps: GetTopicNotebookDeps,
  input: GetTopicNotebookInput,
): Promise<GetTopicNotebookResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const topic = await deps.topics.findById(input.topicId);
  if (
    !topic ||
    topic.subjectId !== nog.subjectId ||
    (topic.ownerId !== null && topic.ownerId !== user.id)
  ) {
    return { status: "not_found" };
  }

  const [rawPages, rawCards] = await Promise.all([
    deps.notebook.listPages(nog.id, topic.id),
    deps.thoughtCards.listByTopic(nog.id, topic.id),
  ]);

  const pages = rawPages
    .filter((page) => page.nogId === nog.id && page.topicId === topic.id)
    .sort(comparePagesOldestFirst);

  const thoughtCards = rawCards.filter(
    (card) => card.nogId === nog.id && card.topicId === topic.id,
  );

  return {
    status: "ok",
    topic: toTopicSummary(topic),
    pages,
    thoughtCards,
  };
}
