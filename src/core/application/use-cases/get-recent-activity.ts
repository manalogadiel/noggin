import type {
  ActivityEvent,
  ActivityRepository,
  CurrentUser,
  NogRepository,
} from "../ports";

export interface GetRecentActivityInput {
  limit?: number;
}

export type GetRecentActivityResult =
  | { status: "unauthenticated" }
  | {
      status: "ok";
      events: ActivityEvent[];
    };

export interface GetRecentActivityDeps {
  currentUser: CurrentUser;
  activity?: Pick<ActivityRepository, "listRecent">;
  nogs?: Pick<NogRepository, "listByOwner">;
}

const DEFAULT_ACTIVITY_LIMIT = 30;

export async function getRecentActivity(
  deps: GetRecentActivityDeps,
  input: GetRecentActivityInput = {},
): Promise<GetRecentActivityResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const limit =
    typeof input.limit === "number" && input.limit > 0
      ? Math.floor(input.limit)
      : DEFAULT_ACTIVITY_LIMIT;

  const [rawEvents, ownedNogs] = await Promise.all([
    deps.activity ? deps.activity.listRecent(user.id, limit) : Promise.resolve([]),
    deps.nogs ? deps.nogs.listByOwner(user.id) : Promise.resolve(null),
  ]);

  const ownedNogIds =
    ownedNogs !== null ? new Set(ownedNogs.map((nog) => nog.id)) : null;

  const events = rawEvents
    .filter((event) => (ownedNogIds ? ownedNogIds.has(event.nogId) : true))
    .slice()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);

  return {
    status: "ok",
    events,
  };
}
