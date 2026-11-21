import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateUserSubjectInput,
  SubjectRecord,
  SubjectRepository,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

const SUBJECT_COLUMNS = "id, owner_id, slug, name, available";

interface SubjectRow {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  available: boolean;
}

function mapSubjectRow(row: SubjectRow): SubjectRecord {
  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    slug: row.slug,
    name: row.name,
    available: Boolean(row.available),
  };
}

export function createSubjectRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): SubjectRepository {
  const { session, service, userId } = options;

  return {
    async findById(subjectId: string): Promise<SubjectRecord | null> {
      const { data, error } = await session
        .from("subjects")
        .select(SUBJECT_COLUMNS)
        .eq("id", subjectId)
        .maybeSingle<SubjectRow>();

      if (error) {
        throw mapPostgrestError(error, "subjects.findById");
      }
      return data ? mapSubjectRow(data) : null;
    },

    async findBySlug(
      slug: string,
      ownerId?: string | null,
    ): Promise<SubjectRecord | null> {
      const normalizedSlug = slug.trim().toLowerCase();
      let query = session
        .from("subjects")
        .select(SUBJECT_COLUMNS)
        .eq("slug", normalizedSlug);

      if (ownerId === null) {
        query = query.is("owner_id", null);
      } else if (ownerId !== undefined) {
        query = query.eq("owner_id", ownerId);
      } else {
        query = query.order("owner_id", { ascending: true, nullsFirst: true });
      }

      const { data, error } = await query.limit(1).returns<SubjectRow[]>();
      if (error) {
        throw mapPostgrestError(error, "subjects.findBySlug");
      }
      const row = data?.[0];
      return row ? mapSubjectRow(row) : null;
    },

    async listAccessible(ownerId: string): Promise<SubjectRecord[]> {
      if (ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot list subjects for another user.",
        );
      }

      const { data, error } = await session
        .from("subjects")
        .select(SUBJECT_COLUMNS)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .returns<SubjectRow[]>();

      if (error) {
        throw mapPostgrestError(error, "subjects.listAccessible");
      }
      return (data ?? []).map(mapSubjectRow);
    },

    async createUserSubject(
      input: CreateUserSubjectInput,
    ): Promise<SubjectRecord> {
      if (input.ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot create a subject for another user.",
        );
      }

      const { data, error } = await service.rpc("create_user_subject", {
        p_owner_id: input.ownerId,
        p_name: input.name,
        p_slug: input.slug,
      });

      if (error) {
        throw mapPostgrestError(error, "subjects.createUserSubject");
      }

      const payload = data as SubjectRow | null;
      if (!payload || typeof payload.id !== "string") {
        throw new SupabaseAdapterError(
          "DATABASE_ERROR",
          "Malformed response from create_user_subject.",
        );
      }
      return mapSubjectRow(payload);
    },
  };
}
