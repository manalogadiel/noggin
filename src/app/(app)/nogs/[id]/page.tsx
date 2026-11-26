import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  petNogAction,
  saveProfileSettingsAction,
} from "@/app/(app)/actions/room-actions";
import { wakeNogAction } from "@/app/(app)/nogs/[id]/rest/actions";
import type { SanctuaryTeachMode } from "@/components/game-ui/game-ui-context";
import { NogRoomView } from "@/components/room/nog-room-view";
import { createContainer } from "@/composition/container";
import {
  DEFAULT_PROFILE_SETTINGS,
  type NogStageSlug,
  type ProfileSettings,
  type ThoughtCardRecord,
  type TopicSummary,
} from "@/core/application/ports";
import { DEFAULT_GROWTH_THRESHOLDS } from "@/core/domain/training";

export const metadata: Metadata = {
  title: "Nog Room",
};

export interface NogRoomPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    teach?: string | string[];
    topic?: string | string[];
    card?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function parseTeachMode(raw: string | null): SanctuaryTeachMode | null {
  if (raw === "hub" || raw === "feed" || raw === "live" || raw === "water" || raw === "bath") {
    return raw;
  }
  return null;
}

function stageProgressPercent(
  stage: NogStageSlug,
  masteredCount: number,
): number {
  const { sproutMastered, scholarMastered, geniusMastered } =
    DEFAULT_GROWTH_THRESHOLDS;

  if (stage === "genius") {
    return 100;
  }
  if (stage === "scholar") {
    const span = Math.max(1, geniusMastered - scholarMastered);
    return Math.max(
      0,
      Math.min(100, Math.round(((masteredCount - scholarMastered) / span) * 100)),
    );
  }
  if (stage === "sprout") {
    const span = Math.max(1, scholarMastered - sproutMastered);
    return Math.max(
      0,
      Math.min(100, Math.round(((masteredCount - sproutMastered) / span) * 100)),
    );
  }
  return Math.max(
    0,
    Math.min(100, Math.round((masteredCount / Math.max(1, sproutMastered)) * 100)),
  );
}

function RoomLoadError({ nogId }: { nogId: string }) {
  return (
    <div className="mx-auto w-full max-w-[680px] py-6">
      <section
        role="alert"
        className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-12"
      >
        <h1 className="noggin-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold text-[var(--noggin-forest)]">
          Brain fog 😵 — couldn&apos;t open the room.
        </h1>
        <Link
          href={`/nogs/${nogId}`}
          className="noggin-primary-pill noggin-display mt-6 inline-flex min-h-12 items-center justify-center px-7 text-[1.0625rem] font-bold"
        >
          Try again
        </Link>
      </section>
    </div>
  );
}

export default async function NogRoomPage({ params, searchParams }: NogRoomPageProps) {
  const [{ id }, resolvedSearch] = await Promise.all([
    params,
    searchParams ??
      Promise.resolve(
        {} as {
          teach?: string | string[];
          topic?: string | string[];
          card?: string | string[];
        },
      ),
  ]);

  const initialTeachMode = parseTeachMode(firstParam(resolvedSearch.teach));
  const initialTopicId = firstParam(resolvedSearch.topic);
  const initialCardId = firstParam(resolvedSearch.card);

  let roomResult;
  let masteredCount = 0;
  let initialSettings: ProfileSettings = DEFAULT_PROFILE_SETTINGS;
  let topics: TopicSummary[] = [];
  let dueCards: ThoughtCardRecord[] = [];
  let cards: ThoughtCardRecord[] = [];
  let now = new Date();

  try {
    const container = await createContainer();
    now = container.clock?.now() ?? new Date();
    const [room, analysisResult, settingsResult, topicsResult, dueResult] =
      await Promise.all([
        container.getNogRoom({ nogId: id }),
        container.getNogAnalysis({ nogId: id }).catch(() => null),
        container.getProfileSettings().catch(() => null),
        typeof container.listTopics === "function"
          ? container.listTopics({ nogId: id }).catch(() => null)
          : Promise.resolve(null),
        typeof container.listDueCards === "function"
          ? container.listDueCards({ nogId: id }).catch(() => null)
          : Promise.resolve(null),
      ]);
    roomResult = room;

    if (roomResult.status === "ok") {
      cards = roomResult.cards ?? [];
      if (analysisResult?.status === "ok") {
        masteredCount = analysisResult.masteredCount;
      }
      if (settingsResult?.status === "ok") {
        initialSettings = settingsResult.settings;
      }
      if (topicsResult?.status === "ok") {
        topics = topicsResult.topics;
      }
      if (dueResult?.status === "ok") {
        dueCards = dueResult.cards;
      }
    }
  } catch {
    return <RoomLoadError nogId={id} />;
  }

  if (roomResult.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}`)}`);
  }

  if (roomResult.status === "not_found") {
    notFound();
  }

  const { nog, vitals } = roomResult;
  const progress = stageProgressPercent(nog.stage, masteredCount);
  const onPet = petNogAction.bind(null, nog.id);

  return (
    <NogRoomView
      nog={nog}
      vitals={vitals}
      progress={progress}
      initialSettings={initialSettings}
      onSaveSettings={saveProfileSettingsAction}
      onPet={onPet}
      onWake={wakeNogAction.bind(null, nog.id)}
      topics={topics}
      dueCards={dueCards}
      thoughtCards={cards}
      initialTeachMode={initialTeachMode}
      initialTopicId={initialTopicId}
      initialCardId={initialCardId}
      now={now}
    />
  );
}
