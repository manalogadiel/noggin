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
    <div className="game-world nap-world">
      {/* Blurred Starry Night Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-night.jpg"
        alt=""
        className="scene-bg-img nap-bg-img"
      />
      <div className="nap-bg-blur" aria-hidden="true" />
      <div className="nap-stars" aria-hidden="true">
        <span className="nap-star nap-star--1">✦</span>
        <span className="nap-star nap-star--2">✧</span>
        <span className="nap-star nap-star--3">✦</span>
        <span className="nap-moon">🌙</span>
      </div>

      <div className="nap-stage">
        {resting ? (
          <section className="nap-resting-center">
            <p className="nap-resting-badge">🌙 RESTING · STREAK PAUSED</p>
            <h1 className="nap-hero-title">Nog Resting</h1>
            <p className="stage-sub m-0 text-[var(--ng-c-e9e4ff)]">
              Sweet Dreams, {nog.name}
            </p>

            <div className="nap-nog-bed w-full max-w-[420px]">
              <span aria-hidden="true" className="nap-zzz-float">
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
                className="nap-nog-img"
              />
              <div className="nap-bed-shadow" aria-hidden="true" />
            </div>

            <p aria-live="polite" className="nap-back-note">
              Back on {backOnDate}
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[rgb(185_28_28_/_0.25)] px-4 py-2 text-sm font-semibold text-white"
              >
                {error}
              </p>
            )}

            <div className="nap-resting-actions">
              <Link href={roomHref} className="nap-cta-btn no-underline">
                Return to Nog Room
              </Link>
              <Link href={notebookHref} className="nap-wake-btn no-underline">
                View Notebook
              </Link>
              <button
                type="button"
                onClick={handleWake}
                disabled={pending}
                className="nap-wake-btn"
              >
                {pending ? "Waking…" : "Wake Nog"}
              </button>
            </div>
          </section>
        ) : (
          <section className="nap-split">
            {/* Tapered Purple Rest Shell */}
            <div className="qs-sc-shell qs-sc-shell--nap w-full">
              <header className="qs-sc-header">
                <span className="qs-sc-badge">🌙 REST MODE</span>
                <h1 className="qs-sc-title">TAKE A REST!</h1>
                <span aria-hidden="true" />
              </header>

              <div className="qs-sc-body qs-sc-body--nap">
                <div
                  className="nap-dur-grid"
                  role="group"
                  aria-label="Rest duration options"
                >
                  {REST_OPTIONS.map((opt) => {
                    const isActive = selectedDays === opt.days;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        aria-pressed={isActive}
                        disabled={pending}
                        onClick={() => setSelectedDays(opt.days)}
                        className={cn("nap-dur-btn", isActive && "is-on")}
                      >
                        <strong>{opt.cardTitle}</strong>
                        <span>{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ng-c-efe3c4)] px-3.5 py-2">
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
                  className="nap-cta-btn w-full"
                >
                  {pending ? "Starting…" : "🌙 Start Resting →"}
                </button>
              </div>
            </div>

            {/* Grounded Sleeping Nog */}
            <div className="nap-nog-bed">
              <span aria-hidden="true" className="nap-zzz-float">
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
                className="nap-nog-img"
              />
              <div className="nap-bed-shadow" aria-hidden="true" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
