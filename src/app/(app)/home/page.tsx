import type { Metadata } from "next";
import {
  petNogAction,
  saveProfileSettingsAction,
} from "@/app/(app)/actions/room-actions";
import { wakeNogAction } from "@/app/(app)/nogs/[id]/rest/actions";
import { HomeView, type HomeActiveRoomData, type HomeNogSummary } from "@/components/home/home-view";
import { createContainer } from "@/composition/container";
import { DEFAULT_PROFILE_SETTINGS, type NogStageSlug } from "@/core/application/ports";
import { DEFAULT_GROWTH_THRESHOLDS } from "@/core/domain/training";

export const metadata: Metadata = {
  title: "Home",
};

function extractFirstName(displayName: string | null): string | null {
  if (!displayName) return null;
  const first = displayName.trim().split(/\s+/)[0];
  return first ? first : null;
}

function stageProgressPercent(stage: NogStageSlug, masteredCount: number): number {
  const { sproutMastered, scholarMastered, geniusMastered } = DEFAULT_GROWTH_THRESHOLDS;
  if (stage === "genius") return 100;
  if (stage === "scholar") {
    return Math.max(0, Math.min(100, Math.round(((masteredCount - scholarMastered) / Math.max(1, geniusMastered - scholarMastered)) * 100)));
  }
  if (stage === "sprout") {
    return Math.max(0, Math.min(100, Math.round(((masteredCount - sproutMastered) / Math.max(1, scholarMastered - sproutMastered)) * 100)));
  }
  return Math.max(0, Math.min(100, Math.round((masteredCount / Math.max(1, sproutMastered)) * 100)));
}

export default async function HomePage() {
  const container = await createContainer();
  const now = container.clock?.now() ?? new Date();

  let nogs: HomeNogSummary[] | null = null;
  let activeRoomData: HomeActiveRoomData | null = null;
  let error = false;

  const [displayName, listResult, settingsResult] = await Promise.all([
    container.getDisplayName(),
    container.listNogs().catch(() => null),
    typeof container.getProfileSettings === "function"
      ? container.getProfileSettings().catch(() => null)
      : Promise.resolve(null),
  ]);
  const firstName = extractFirstName(displayName);

  try {
    if (listResult?.status === "ok") {
      nogs = listResult.nogs.map((nog) => ({
        id: nog.id,
        name: nog.name,
        stage: nog.stage,
      }));
      const first = listResult.nogs[0];
      if (first && typeof container.getNogRoom === "function") {
        const [roomResult, analysisResult] = await Promise.all([
          container.getNogRoom({ nogId: first.id }).catch(() => null),
          typeof container.getNogAnalysis === "function"
            ? container.getNogAnalysis({ nogId: first.id }).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (roomResult?.status === "ok") {
          const masteredCount = analysisResult?.status === "ok" ? analysisResult.masteredCount : 0;
          activeRoomData = {
            nog: roomResult.nog,
            vitals: roomResult.vitals,
            progress: stageProgressPercent(roomResult.nog.stage, masteredCount),
            initialSettings: settingsResult?.status === "ok" ? settingsResult.settings : DEFAULT_PROFILE_SETTINGS,
            now,
          };
        }
      }
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  return (
    <HomeView
      firstName={firstName}
      nogs={nogs}
      error={error}
      activeRoomData={activeRoomData}
      onSaveSettings={saveProfileSettingsAction}
      onPet={activeRoomData ? petNogAction.bind(null, activeRoomData.nog.id) : undefined}
      onWake={activeRoomData ? wakeNogAction.bind(null, activeRoomData.nog.id) : undefined}
    />
  );
}
