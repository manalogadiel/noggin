"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { formatRestBackOnDate, isNogResting } from "@/lib/rest-schedule";
import { cn } from "@/lib/utils";

const REST_OPTIONS = [
  { days: 1, label: "In 1 day", cardTitle: "1 Day", sub: "Quick nap" },
  { days: 2, label: "In 2 days", cardTitle: "2 Days", sub: "Weekend rest" },
  { days: 3, label: "In 3 days", cardTitle: "3 Days", sub: "Deep recharge" },
  { days: 7, label: "In 1 week", cardTitle: "1 Week", sub: "Exam break" },
] as const;

export interface RestViewProps {
  nog: { id: string; name: string };
  restUntil: string | null;
  now?: Date;
  onStartRest: (days: number) => unknown;
  onWake: () => unknown;
}

function extractUpdatedRestUntil(
  result: unknown,
): { found: true; value: string | null } | { found: false } {
  if (typeof result !== "object" || result === null) {
    return { found: false };
  }
  const candidate = result as {
    status?: unknown;
    nog?: { restUntil?: string | null };
  };
  if (candidate.status === "ok" && candidate.nog) {
    return { found: true, value: candidate.nog.restUntil ?? null };
  }
  return { found: false };
}

function extractActionError(result: unknown): string | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }
  const status = (result as { status?: unknown }).status;
  if (status === "unauthenticated") {
    return "Please log in again to update rest.";
  }
  if (status === "not_found") {
    return "We couldn't find this Nog right now.";
  }
  if (status === "invalid") {
    return "Choose one of the rest lengths listed.";
  }
  return null;
}

export function RestView({
  nog,
  restUntil,
  now,
  onStartRest,
  onWake,
}: RestViewProps) {
  const selectId = useId();
  const [fallbackNow] = useState<Date>(() => new Date());
  const [selectedDays, setSelectedDays] = useState<number>(2);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<{
    base: string | null;
    value: string | null;
  } | null>(null);

  const currentRestUntil =
    override && override.base === restUntil ? override.value : restUntil;
  const effectiveNow = now ?? fallbackNow;
  const resting = isNogResting(currentRestUntil, effectiveNow);
  const backOnDate =
    resting && currentRestUntil ? formatRestBackOnDate(currentRestUntil) : "";

  const roomHref = `/nogs/${nog.id}`;
  const notebookHref = `/nogs/${nog.id}/notebook`;

  async function handleStartRest() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onStartRest(selectedDays);
      const updated = extractUpdatedRestUntil(result);
      if (updated.found) {
        setOverride({ base: restUntil, value: updated.value });
      } else {
        const message = extractActionError(result);
        if (message) setError(message);
      }
    } catch {
      setError("Couldn't start resting right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleWake() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onWake();
      const updated = extractUpdatedRestUntil(result);
      if (updated.found) {
        setOverride({ base: restUntil, value: updated.value });
      } else {
        const message = extractActionError(result);
        if (message) setError(message);
      }
    } catch {
      setError("Couldn't wake your Nog right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-76px)] items-center justify-center overflow-hidden rounded-[28px] px-4 py-8 md:px-8">
      {/* Blurred Starry Night Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-night.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover blur-[5px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgb(14_16_46_/_0.64)] via-[rgb(24_24_68_/_0.58)] to-[rgb(12_14_40_/_0.76)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-[var(--ng-c-ffe588)] opacity-75">
        <span className="absolute top-[14%] left-[12%] text-xl">✦</span>
        <span className="absolute top-[22%] left-[48%] text-base">✧</span>
        <span className="absolute right-[10%] bottom-[24%] text-lg">✦</span>
        <span className="absolute top-[10%] right-[12%] text-3xl">🌙</span>
      </div>

      <div className="relative z-10 w-full max-w-[1080px]">
        {resting ? (
          <section className="mx-auto flex max-w-[720px] flex-col items-center text-center text-white">
            <p className="m-0 text-xs font-black tracking-[0.14em] text-[var(--ng-c-ffe588)] uppercase">
              🌙 RESTING · STREAK PAUSED
            </p>
            <h1
              className="mt-2 text-[clamp(2.5rem,6vw,4.25rem)] font-black tracking-tight text-white drop-shadow-[0_4px_0_rgb(20_18_54)]"
              style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
            >
              Nog Resting
            </h1>
            <p className="mt-1 text-base font-semibold text-[var(--ng-c-fff4d9)]">
              Sweet Dreams, {nog.name}
            </p>

            <div className="relative mt-5 flex w-full max-w-[420px] flex-col items-center">
              <span
                aria-hidden="true"
                className="nog-float mb-1 text-lg font-black tracking-[0.25em] text-[var(--ng-c-ffe588)]"
              >
                Z z z
              </span>
              <NogStage
                scene="sleeping"
                poster="/nog/sleeping-books.png"
                alt={`${nog.name} curled up asleep next to a stack of books`}
                width={908}
                height={721}
                sizes="(max-width: 768px) 88vw, 420px"
                priority
                className="mx-auto w-full"
              />
            </div>

            <p
              aria-live="polite"
              className="mt-4 text-lg font-extrabold text-[var(--ng-c-ffe588)]"
            >
              Back on {backOnDate}
            </p>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-[rgb(185_28_28_/_0.25)] px-4 py-2 text-sm font-semibold text-white"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
              <Link href={roomHref} className="ng-btn ng-btn--gold px-6 py-3 text-sm">
                Return to Nog Room
              </Link>
              <Link href={notebookHref} className="ng-btn ng-btn--leaf px-6 py-3 text-sm">
                View Notebook
              </Link>
              <button
                type="button"
                onClick={handleWake}
                disabled={pending}
                className="ng-btn ng-btn--purple px-6 py-3 text-sm"
              >
                {pending ? "Waking…" : "Wake Nog"}
              </button>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Tapered Purple Rest Shell */}
            <div className="ng-shell ng-shell--purple max-w-[540px]">
              <header className="ng-shell__head">
                <span className="ng-shell__badge">🌙 REST MODE</span>
                <h1 className="ng-shell__title">TAKE A REST!</h1>
                <span aria-hidden="true" />
              </header>

              <div className="ng-shell__body flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3" role="group" aria-label="Rest duration options">
                  {REST_OPTIONS.map((opt) => {
                    const isActive = selectedDays === opt.days;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        aria-pressed={isActive}
                        disabled={pending}
                        onClick={() => setSelectedDays(opt.days)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3.5 text-center transition",
                          isActive
                            ? "border-[var(--ng-c-f5be2c)] bg-[var(--ng-c-fffdf5)] text-[var(--noggin-forest)] shadow-[0_5px_0_rgb(194_134_10_/_0.42)]"
                            : "border-[var(--ng-c-e3d6b4)] bg-white/80 text-[var(--noggin-forest)] shadow-[0_4px_0_rgb(201_188_154)] hover:-translate-y-0.5",
                        )}
                      >
                        <strong
                          className="text-lg font-black"
                          style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
                        >
                          {opt.cardTitle}
                        </strong>
                        <span className="text-xs font-bold text-[var(--noggin-ink)]">
                          {opt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ng-c-efe7cf)] px-3.5 py-2">
                  <label
                    htmlFor={selectId}
                    className="text-xs font-black tracking-wide text-[var(--noggin-forest)] uppercase"
                  >
                    Return Later
                  </label>
                  <select
                    id={selectId}
                    value={String(selectedDays)}
                    onChange={(event) => setSelectedDays(Number(event.target.value))}
                    disabled={pending}
                    className="rounded-xl border border-[var(--ng-c-d7c9a3)] bg-white px-3 py-1.5 text-xs font-extrabold text-[var(--noggin-forest)]"
                  >
                    {REST_OPTIONS.map((option) => (
                      <option key={option.days} value={String(option.days)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[var(--noggin-danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--noggin-danger)]"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleStartRest}
                  disabled={pending}
                  className="ng-btn ng-btn--gold w-full py-3.5 text-base"
                >
                  {pending ? "Starting…" : "🌙 Start Resting →"}
                </button>
              </div>
            </div>

            {/* Grounded Sleeping Nog */}
            <div className="relative flex flex-col items-center justify-center">
              <span
                aria-hidden="true"
                className="nog-float mb-2 text-lg font-black tracking-[0.25em] text-[var(--ng-c-ffe588)]"
              >
                Z z z
              </span>
              <NogStage
                scene="sleeping"
                poster="/nog/sleeping-books.png"
                alt={`${nog.name} curled up asleep next to a stack of books`}
                width={908}
                height={721}
                sizes="(max-width: 1024px) 90vw, 480px"
                priority
                className="mx-auto w-full max-w-[460px]"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
