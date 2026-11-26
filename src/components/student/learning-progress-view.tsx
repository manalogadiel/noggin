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
    <div className="flex flex-col gap-4 pb-4">
      <div className="prof-kpi-row">
        <div className="prof-kpi">
          <strong className="tnum">{summary.nogs}</strong>
          <span>Nogs</span>
        </div>

        <div className="prof-kpi">
          <strong className="tnum">{summary.topicsWithProgress}</strong>
          <span>Topics with progress</span>
        </div>

        <div className="prof-kpi">
          <strong className="tnum">{summary.mastered}</strong>
          <span>Questions mastered</span>
        </div>
      </div>

      {nogs.length === 0 ? (
        <section className="prof-panel items-center p-8 text-center">
          <p className="noggin-display text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
            No Nogs yet — hatch one to start tracking mastery!
          </p>
          <Link href="/adopt" className="gbtn gbtn--leaf mt-3 no-underline">
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
                <article key={nog.id} className="prof-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="prof-panel__title m-0 text-[1.35rem]">
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
                      className="gbtn gbtn--leaf gbtn--sm no-underline"
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
                            {nog.mastered}/{nog.nextThreshold} to {nog.nextStage}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${nog.name}'s progress to ${nog.nextStage}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={clampedPercent}
                          className="meter"
                        >
                          <i style={{ width: `${clampedPercent}%` }} />
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
                                className="meter"
                              >
                                <i style={{ width: `${topicPercent}%` }} />
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
