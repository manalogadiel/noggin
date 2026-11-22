import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateNogInput,
  NogRecord,
  NogRepository,
  NogStageSlug,
  UpdatePettingInput,
} from "@/core/application/ports";
import { mapPostgrestError, SupabaseAdapterError } from "./errors";

const NOG_COLUMNS =
  "id, owner_id, subject_id, name, stage, mood, happiness, happiness_today, happiness_day";

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
}

function mapNogRow(row: NogRow): NogRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    subjectId: row.subject_id,
    name: row.name,
    stage: row.stage,
    mood: row.mood,
    happiness: row.happiness,
    happinessToday: row.happiness_today,
    happinessDay: row.happiness_day ?? null,
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
  };
}
