import type { ReactNode } from "react";
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
  const level = 1 + Math.floor(Math.max(0, totalMastered) / 5);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 py-4">
      <h1 className="noggin-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold text-[var(--noggin-leaf-title)]">
        Student Profile
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col items-center rounded-[36px] bg-[var(--noggin-panel)] p-7 text-center shadow-[0_14px_34px_var(--noggin-shadow)]">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nog/head.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
            />
          </div>

          <p className="noggin-display mt-4 text-[1.375rem] font-extrabold text-[var(--noggin-forest)]">
            {studentName}
          </p>
          <p className="mt-0.5 text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
            Student
          </p>
          <span className="noggin-display mt-3 inline-flex items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-white)]">
            Lvl. {level}
          </span>
        </aside>

        <div className="flex flex-col gap-5">
          <ProfileTabs />
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
