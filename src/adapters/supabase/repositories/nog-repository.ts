import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateNogInput,
  NogColors,
  NogRecord,
  NogRepository,
  NogStageSlug,
  UpdatePettingInput,
} from "@/core/application/ports";
import { parseBodyColor } from "@/core/domain/nog-colors";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

const NOG_COLUMNS =
  "id, owner_id, subject_id, name, stage, mood, happiness, happiness_today, happiness_day, colors, rest_until, subjects(name)";

interface SubjectJoinRow {
  name: string;
}

interface NogRow {
  id: string;
  owner_id: string;
  subject_id: string;
  name: string;
  stage: NogStageSlug;
  mood: string;
  happiness: number;
  happiness_today: number;
  happiness_day: string | null;
  colors?: unknown;
  rest_until?: string | null;
  subjects?: SubjectJoinRow | SubjectJoinRow[] | null;
}

function extractSubjectName(
  subjects: NogRow["subjects"],
): string | undefined {
  if (!subjects) {
    return undefined;
  }
  const entry = Array.isArray(subjects) ? subjects[0] : subjects;
  return typeof entry?.name === "string" ? entry.name : undefined;
}

function mapNogColors(raw: unknown): NogColors {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const candidate = (raw as { body?: unknown }).body;
  if (candidate === null) {
    return { body: null };
  }
  if (typeof candidate === "string") {
    const parsed = parseBodyColor(candidate);
    if (parsed.ok) {
      return { body: parsed.value };
    }
  }
  return {};
}

function mapNogRow(row: NogRow): NogRecord {
  const subjectName = extractSubjectName(row.subjects);
  return {
    id: row.id,
    ownerId: row.owner_id,
    subjectId: row.subject_id,
    ...(subjectName !== undefined ? { subjectName } : {}),
    name: row.name,
    stage: row.stage,
    mood: row.mood,
    happiness: row.happiness,
    happinessToday: row.happiness_today,
    happinessDay: row.happiness_day ?? null,
    colors: mapNogColors(row.colors),
    restUntil: row.rest_until ?? null,
  };
}

export function createNogRepository(options: {
  session: SupabaseClient;
  service: SupabaseClient;
  userId: string;
}): NogRepository {
  const { session, service, userId } = options;

  return {
    async findOwned(ownerId: string, nogId: string): Promise<NogRecord | null> {
      const { data, error } = await session
        .from("nogs")
        .select(NOG_COLUMNS)
        .eq("id", nogId)
        .eq("owner_id", ownerId)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.findOwned");
      }
      return data ? mapNogRow(data) : null;
    },

    async listByOwner(ownerId: string): Promise<NogRecord[]> {
      const { data, error } = await session
        .from("nogs")
        .select(NOG_COLUMNS)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<NogRow[]>();

      if (error) {
        throw mapPostgrestError(error, "nogs.listByOwner");
      }
      return (data ?? []).map(mapNogRow);
    },

    async findByOwnerAndSubject(
      ownerId: string,
      subjectId: string,
    ): Promise<NogRecord | null> {
      const { data, error } = await session
        .from("nogs")
        .select(NOG_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("subject_id", subjectId)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.findByOwnerAndSubject");
      }
      return data ? mapNogRow(data) : null;
    },

    async create(input: CreateNogInput): Promise<NogRecord> {
      if (input.ownerId !== userId) {
        throw new SupabaseAdapterError(
          "FORBIDDEN",
          "Cannot create a Nog for another user.",
        );
      }

      const { data, error } = await session
        .from("nogs")
        .insert({
          subject_id: input.subjectId,
          name: input.name,
        })
        .select(NOG_COLUMNS)
        .single<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.create");
      }
      return mapNogRow(data);
    },

    async updatePetting(input: UpdatePettingInput): Promise<NogRecord> {
      const { data: owned, error: ownershipError } = await session
        .from("nogs")
        .select("id")
        .eq("id", input.nogId)
        .eq("owner_id", userId)
        .maybeSingle<{ id: string }>();

      if (ownershipError) {
        throw mapPostgrestError(ownershipError, "nogs.updatePetting");
      }
      if (!owned) {
        throw new SupabaseAdapterError("NOT_FOUND", "Nog not found for owner.");
      }

      const { data, error } = await service
        .from("nogs")
        .update({
          happiness: input.happiness,
          happiness_today: input.happinessToday,
          happiness_day: input.happinessDay,
          last_care_at: new Date().toISOString(),
        })
        .eq("id", input.nogId)
        .eq("owner_id", userId)
        .select(NOG_COLUMNS)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.updatePetting");
      }
      if (!data) {
        throw new SupabaseAdapterError("NOT_FOUND", "Nog not found for owner.");
      }
      return mapNogRow(data);
    },

    async updateColors(
      ownerId: string,
      nogId: string,
      colors: NogColors,
    ): Promise<NogRecord | null> {
      if (ownerId !== userId) {
        return null;
      }

      const { data, error } = await session
        .from("nogs")
        .update({
          colors: { body: colors.body ?? null },
        })
        .eq("id", nogId)
        .eq("owner_id", ownerId)
        .select(NOG_COLUMNS)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.updateColors");
      }
      return data ? mapNogRow(data) : null;
    },

    async updateCustomization(
      ownerId: string,
      nogId: string,
      patch: { colors: NogColors; name?: string },
    ): Promise<NogRecord | null> {
      if (ownerId !== userId) {
        return null;
      }

      const updatePayload: { colors: { body: string | null }; name?: string } = {
        colors: { body: patch.colors.body ?? null },
      };
      if (patch.name !== undefined) {
        updatePayload.name = patch.name;
      }

      const { data, error } = await session
        .from("nogs")
        .update(updatePayload)
        .eq("id", nogId)
        .eq("owner_id", ownerId)
        .select(NOG_COLUMNS)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.updateCustomization");
      }
      return data ? mapNogRow(data) : null;
    },

    async setRest(
      ownerId: string,
      nogId: string,
      restUntil: string | null,
    ): Promise<NogRecord | null> {
      if (ownerId !== userId) {
        return null;
      }

      const { data, error } = await session
        .from("nogs")
        .update({
          rest_until: restUntil,
        })
        .eq("id", nogId)
        .eq("owner_id", ownerId)
        .select(NOG_COLUMNS)
        .maybeSingle<NogRow>();

      if (error) {
        throw mapPostgrestError(error, "nogs.setRest");
      }
      return data ? mapNogRow(data) : null;
    },
  };
}
