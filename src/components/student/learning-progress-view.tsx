import Link from "next/link";
import { NotebookCapacityPanel } from "@/components/student/notebook-capacity-panel";
import type {
  LearningProgressNogItem,
  LearningProgressSummary,
} from "@/core/application/use-cases/get-learning-progress";

export interface LearningProgressViewProps {
  summary: LearningProgressSummary;
  nogs: LearningProgressNogItem[];
}

export function LearningProgressView({
  summary,
  nogs,
}: LearningProgressViewProps) {
  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="ng-prof-kpi">
          <strong className="noggin-display block text-[1.75rem] font-extrabold text-[var(--noggin-leaf-strong)] tabular-nums">
            {summary.nogs}
          </strong>
          <span className="text-[0.8125rem] font-bold text-[var(--noggin-ink)]">
            Nogs
          </span>
        </div>

        <div className="ng-prof-kpi">
          <strong className="noggin-display block text-[1.75rem] font-extrabold text-[var(--noggin-leaf-strong)] tabular-nums">
            {summary.topicsWithProgress}
          </strong>
          <span className="text-[0.8125rem] font-bold text-[var(--noggin-ink)]">
            Topics with progress
          </span>
        </div>

        <div className="ng-prof-kpi">
          <strong className="noggin-display block text-[1.75rem] font-extrabold text-[var(--noggin-leaf-strong)] tabular-nums">
            {summary.mastered}
          </strong>
          <span className="text-[0.8125rem] font-bold text-[var(--noggin-ink)]">
            Questions mastered
          </span>
        </div>
      </div>

      {nogs.length === 0 ? (
        <section className="ng-prof-panel flex flex-col items-center p-8 text-center">
          <p className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
            No Nogs yet — hatch one to start tracking mastery!
          </p>
          <Link
            href="/adopt"
            className="ng-btn ng-btn--leaf mt-5 inline-flex min-h-11 items-center justify-center px-6"
          >
            Hatch a Nog
          </Link>
        </section>
      ) : (
        <>
          <NotebookCapacityPanel nogs={nogs} />

          <div className="flex flex-col gap-4">
            {nogs.map((nog) => {
              const clampedPercent = Math.max(
                0,
                Math.min(100, Math.round(nog.percent)),
              );

              return (
                <article
                  key={nog.id}
                  className="ng-prof-panel flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="noggin-display text-[1.35rem] font-extrabold text-[var(--noggin-forest)]">
                        {nog.name}
                      </h2>
                      <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.8125rem] font-bold text-[var(--noggin-forest)]">
                        {nog.subjectName}
                      </span>
                      <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-honey)] px-3 py-1 text-[0.8125rem] font-bold text-[var(--noggin-forest)]">
                        {nog.stage}
                      </span>
                    </div>

                    <Link
                      href={`/nogs/${nog.id}`}
                      className="ng-btn ng-btn--leaf ng-btn--sm"
                    >
                      Open room
                    </Link>
                  </div>

                  <div className="space-y-1.5">
                    {nog.nextStage && nog.nextThreshold !== null ? (
                      <>
                        <div className="flex items-center justify-between gap-2 text-[0.875rem] font-bold text-[var(--noggin-forest)]">
                          <span>Stage progress</span>
                          <span>
                            {nog.mastered}/{nog.nextThreshold} to{" "}
                            {nog.nextStage}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${nog.name}'s progress to ${nog.nextStage}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={clampedPercent}
                          className="h-3 w-full overflow-hidden rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)]"
                        >
                          <div
                            className="h-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] transition-all"
                            style={{ width: `${clampedPercent}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                        <span>Top stage reached!</span>
                        <span>{nog.mastered} mastered</span>
                      </div>
                    )}
                  </div>

                  {nog.topics.length > 0 && (
                    <div className="space-y-2.5">
                      {nog.topics.map((topic) => {
                        const topicPercent =
                          topic.total > 0
                            ? Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round(
                                    (topic.mastered / topic.total) * 100,
                                  ),
                                ),
                              )
                            : 0;

                        return (
                          <div
                            key={topic.id}
                            className="flex flex-col gap-1.5 rounded-[18px] bg-[var(--noggin-white)] px-4 py-3 shadow-[0_3px_10px_var(--noggin-shadow)]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
                                {topic.name}
                              </span>
                              {topic.total === 0 ? (
                                <span className="text-[0.8125rem] font-medium text-[var(--noggin-ink)]">
                                  Questions being written
                                </span>
                              ) : (
                                <span className="text-[0.875rem] font-bold text-[var(--noggin-forest)]">
                                  {topic.mastered}/{topic.total}
                                </span>
                              )}
                            </div>

                            {topic.total > 0 && (
                              <div
                                role="progressbar"
                                aria-label={`${topic.name}: ${topic.mastered} of ${topic.total} mastered`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={topicPercent}
                                className="h-2.5 w-full overflow-hidden rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)]"
                              >
                                <div
                                  className="h-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] transition-all"
                                  style={{ width: `${topicPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
