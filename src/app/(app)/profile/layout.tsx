import type { ReactNode } from "react";
import { ProfileHeroSidebar } from "@/components/student/profile-hero-sidebar";
import { ProfileTabs } from "@/components/student/profile-tabs";
import { createContainer } from "@/composition/container";

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const container = await createContainer();
  const [displayName, progressResult] = await Promise.all([
    container.getDisplayName(),
    container.getLearningProgress(),
  ]);

  const studentName = displayName?.trim() || "Student";
  const totalMastered =
    progressResult.status === "ok" ? progressResult.summary.mastered : 0;
  const nogCount =
    progressResult.status === "ok" ? progressResult.summary.nogs : 0;
  const level = 1 + Math.floor(Math.max(0, totalMastered) / 5);

  return (
    <div className="game-world game-world--profile nb-textured-bg">
      <div className="game-main-pane flex min-h-0 flex-1 flex-col">
        <div className="stage-body max-w-[1200px] gap-4">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h1 className="stage-h1" style={{ fontSize: 32 }}>
              Student Profile
            </h1>
            <ProfileTabs />
          </header>

          <div className="profile-layout">
            <ProfileHeroSidebar
              displayName={studentName}
              level={level}
              nogCount={nogCount}
              mastered={totalMastered}
            />

            <div className="prof-content">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
