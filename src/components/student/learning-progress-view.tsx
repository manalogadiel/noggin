import Image from "next/image";
import Link from "next/link";
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
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="rounded-[24px] bg-[var(--noggin-cream)] px-5 py-4 shadow-[0_8px_22px_var(--noggin-shadow)]">
          <p className="text-[0.875rem] font-semibold text-[var(--noggin-ink)]">
            Nogs
          </p>
          <p className="noggin-display mt-1 text-[1.75rem] font-extrabold leading-none text-[var(--noggin-forest)]">
            {summary.nogs}
          </p>
        </div>

        <div className="rounded-[24px] bg-[var(--noggin-cream)] px-5 py-4 shadow-[0_8px_22px_var(--noggin-shadow)]">
          <p className="text-[0.875rem] font-semibold text-[var(--noggin-ink)]">
            Topics with progress
          </p>
          <p className="noggin-display mt-1 text-[1.75rem] font-extrabold leading-none text-[var(--noggin-forest)]">
            {summary.topicsWithProgress}
          </p>
        </div>

        <div className="rounded-[24px] bg-[var(--noggin-cream)] px-5 py-4 shadow-[0_8px_22px_var(--noggin-shadow)]">
          <p className="text-[0.875rem] font-semibold text-[var(--noggin-ink)]">
            Questions mastered
          </p>
          <p className="noggin-display mt-1 text-[1.75rem] font-extrabold leading-none text-[var(--noggin-forest)]">
            {summary.mastered}
          </p>
        </div>
      </div>

      {nogs.length === 0 ? (
        <section className="flex flex-col items-center rounded-[28px] bg-[var(--noggin-cream)] p-8 text-center shadow-[0_12px_28px_var(--noggin-shadow)] sm:p-10">
          <Image
            src="/nog/peek-card.png"
            alt=""
            width={140}
            height={110}
            className="h-24 w-auto object-contain"
          />
          <h2 className="noggin-display mt-4 text-[1.375rem] font-extrabold text-[var(--noggin-forest)]">
            No Nogs yet
          </h2>
          <p className="mt-1 text-[0.9375rem] text-[var(--noggin-ink)]">
            Adopt your first Nog to start tracking mastery across subjects.
          </p>
          <Link
            href="/adopt"
            className="noggin-primary-pill noggin-display mt-5 inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-[1rem] font-bold"
          >
            Hatch a Nog
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {nogs.map((nog) => {
            const clampedPercent = Math.max(0, Math.min(100, nog.percent));
            return (
              <article
                key={nog.id}
                className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-cream)] p-6 shadow-[0_12px_28px_var(--noggin-shadow)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="noggin-display text-[1.375rem] font-extrabold text-[var(--noggin-forest)]">
                      {nog.name}
                    </h2>
                    <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3 py-1 text-[0.8125rem] font-bold text-[var(--noggin-forest)]">
                      {nog.subjectName}
                    </span>
                    <span className="rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-3 py-1 text-[0.8125rem] font-bold text-[var(--noggin-white)]">
                      {nog.stage}
                    </span>
                  </div>

                  <Link
                    href={`/nogs/${nog.id}`}
                    className="noggin-display inline-flex min-h-11 items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 py-2 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors hover:bg-[var(--noggin-mint)]"
                  >
                    Open room
                  </Link>
                </div>

                <div className="space-y-2 rounded-[20px] bg-[var(--noggin-white)] p-4">
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
                          className="flex flex-col gap-1.5 rounded-[18px] bg-[var(--noggin-white)] px-4 py-3"
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
      )}
    </div>
  );
}
