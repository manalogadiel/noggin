import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser, CurrentUser } from "@/core/application/ports";
import { createServerSupabaseClient } from "./server-client";

export function createSupabaseCurrentUser(
  session?: Pick<SupabaseClient, "auth">,
): CurrentUser {
  return {
    async get(): Promise<AuthenticatedUser | null> {
      const client = session ?? (await createServerSupabaseClient());
      const {
        data: { user },
        error,
      } = await client.auth.getUser();

      if (error || !user?.id) {
        return null;
      }

      return { id: user.id };
    },
  };
}

export async function getCurrentUser(
  session?: Pick<SupabaseClient, "auth">,
): Promise<AuthenticatedUser | null> {
  return createSupabaseCurrentUser(session).get();
}
