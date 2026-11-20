import type { CurrentUser, NogRecord, NogRepository } from "../ports";

export interface ListNogsDeps {
  currentUser: CurrentUser;
  nogs: Pick<NogRepository, "listByOwner">;
}

export type ListNogsResult =
  | { status: "unauthenticated" }
  | { status: "ok"; nogs: NogRecord[] };

export async function listNogs(deps: ListNogsDeps): Promise<ListNogsResult> {
  const user = await deps.currentUser.get();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const nogs = await deps.nogs.listByOwner(user.id);
  return { status: "ok", nogs };
}
