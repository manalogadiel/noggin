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
    <div className="ng-botanical-bg ng-prof-shell">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 min-h-0 flex-col gap-4">
        <header className="shrink-0">
          <h1 className="noggin-display text-[clamp(1.75rem,3.4vw,2.4rem)] font-extrabold text-[var(--noggin-leaf-title)]">
            Student Profile
          </h1>
        </header>

        <div className="ng-prof-grid grid grid-cols-1 gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <ProfileHeroSidebar
            displayName={studentName}
            level={level}
            nogCount={nogCount}
            mastered={totalMastered}
          />

          <div className="ng-prof-scroll-pane">
            <div className="shrink-0">
              <ProfileTabs />
            </div>
            <div className="ng-profile-scroll">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
