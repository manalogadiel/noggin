import type {
  CurrentUser,
  NogRepository,
  TopicRepository,
  TopicSummary,
} from "../ports";
import { toTopicSummary } from "./add-topic";

export interface ListTopicsDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "findOwned">;
  topics: Pick<TopicRepository, "listBySubject">;
}

export interface ListTopicsInput {
  nogId: string;
}

export type ListTopicsResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; topics: TopicSummary[] };

export async function listTopics(
  deps: ListTopicsDeps,
  input: ListTopicsInput,
): Promise<ListTopicsResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nog = await deps.nogs.findOwned(user.id, input.nogId);
  if (!nog) {
    return { status: "not_found" };
  }

  const records = await deps.topics.listBySubject(nog.subjectId);
  const topics = records
    .filter(
      (record) =>
        record.subjectId === nog.subjectId &&
        (record.ownerId === null || record.ownerId === user.id),
    )
    .map(toTopicSummary);

  return { status: "ok", topics };
}
