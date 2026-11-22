import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  petNogAction,
  saveProfileSettingsAction,
} from "@/app/(app)/actions/room-actions";
import { NogRoomView } from "@/components/room/nog-room-view";
import { createContainer } from "@/composition/container";
import {
  DEFAULT_PROFILE_SETTINGS,
  type NogStageSlug,
  type ProfileSettings,
} from "@/core/application/ports";
import { DEFAULT_GROWTH_THRESHOLDS } from "@/core/domain/training";

export const metadata: Metadata = {
  title: "Nog Room",
};

export interface NogRoomPageProps {
  params: Promise<{ id: string }>;
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

export default async function NogRoomPage({ params }: NogRoomPageProps) {
  const { id } = await params;

  let roomResult;
  let masteredCount = 0;
  let initialSettings: ProfileSettings = DEFAULT_PROFILE_SETTINGS;
  let now = new Date();

  try {
    const container = await createContainer();
    now = container.clock?.now() ?? new Date();
    roomResult = await container.getNogRoom({ nogId: id });

    if (roomResult.status === "ok") {
      const [analysisResult, settingsResult] = await Promise.all([
        container.getNogAnalysis({ nogId: id }).catch(() => null),
        container.getProfileSettings().catch(() => null),
      ]);

      if (analysisResult?.status === "ok") {
        masteredCount = analysisResult.masteredCount;
      }
      if (settingsResult?.status === "ok") {
        initialSettings = settingsResult.settings;
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
      now={now}
    />
  );
}
