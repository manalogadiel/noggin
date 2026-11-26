"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  hatchNogAction,
  type HatchNogFormState,
} from "@/app/(app)/actions/nog-actions";
import { EggHatch } from "@/components/nog/egg";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { cn } from "@/lib/utils";

type AdoptStep = 1 | 2 | 3 | 4;

const INITIAL_ACTION_STATE: HatchNogFormState = { status: "idle" };
const QUICK_PICK_SUBJECT = "Networking";
const MAX_SUBJECT_LENGTH = 40;
const MAX_NAME_LENGTH = 24;

export function AdoptFlow() {
  const [step, setStep] = useState<AdoptStep>(1);
  const [subject, setSubject] = useState("");
  const [nogName, setNogName] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step4Error, setStep4Error] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<AdoptStep>(1);

  const subjectInputId = useId();
  const subjectErrorId = useId();
  const nameInputId = useId();
  const nameHelpId = useId();
  const nameErrorId = useId();

  const [, formAction, pending] = useActionState(
    async (prevState: HatchNogFormState, formData: FormData) => {
      const next = await hatchNogAction(prevState, formData);
      if (next.status === "already_exists" || next.status === "invalid_subject") {
        setStep1Error(next.error ?? "Please pick another subject.");
        setStep4Error(null);
        setStep(1);
      } else if (next.error) {
        setStep4Error(next.error);
      }
      return next;
    },
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  function handleSubjectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = subject.trim();
    if (trimmed.length === 0) {
      setStep1Error("Enter a subject for your Nog to learn.");
      return;
    }
    if (trimmed.length > MAX_SUBJECT_LENGTH) {
      setStep1Error(`Keep your subject to ${MAX_SUBJECT_LENGTH} characters or fewer.`);
      return;
    }
    setSubject(trimmed);
    setStep1Error(null);
    setStep4Error(null);
    setStep(2);
  }

  function handleQuickPick() {
    setSubject(QUICK_PICK_SUBJECT);
    setStep1Error(null);
  }

  const trimmedName = nogName.trim();
  const isNetworkingSelected =
    subject.trim().toLowerCase() === QUICK_PICK_SUBJECT.toLowerCase();
  const submitLabel = pending ? "Hatching…" : "Start Customizing →";

  return (
    <div className="game-world game-world--hatch">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-day.jpg"
        alt=""
        className="scene-bg-img scene-bg-img--sanctuary"
      />
      <div className="scene-bg-scrim scene-bg-scrim--hatch" aria-hidden="true" />

      <div className="stage-top">
        <Link
          href="/nogs"
          className="stage-close-btn"
          aria-label="Exit to My Nogs"
        >
          <span aria-hidden="true">×</span>
        </Link>
        <div className="stage-progress-track" aria-hidden="true">
          <div
            className="stage-progress-fill"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="stage-body items-center text-center">
        {step === 1 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="hatch-panel mx-auto flex w-full max-w-[560px] flex-col items-center text-center"
          >
            <h1
              id="adopt-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="stage-h1 focus:outline-none"
            >
              What should your Nog learn?
            </h1>

            <p className="stage-sub mt-3 max-w-[440px]">
              Type any subject or pick a starter below.
            </p>

            <form
              onSubmit={handleSubjectSubmit}
              className="mt-7 flex w-full max-w-[460px] flex-col gap-5 text-left"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor={subjectInputId} className="figma-auth-label">
                  Subject
                </label>
                <input
                  id={subjectInputId}
                  name="subject"
                  type="text"
                  autoComplete="off"
                  minLength={1}
                  maxLength={MAX_SUBJECT_LENGTH}
                  required
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    if (step1Error) setStep1Error(null);
                  }}
                  placeholder="e.g. Networking, Biology, Filipino History"
                  aria-invalid={Boolean(step1Error) || undefined}
                  aria-describedby={step1Error ? subjectErrorId : undefined}
                  className="g-input"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="text-[0.875rem] font-semibold text-[var(--noggin-muted)]">
                  Quick pick:
                </span>
                <button
                  type="button"
                  onClick={handleQuickPick}
                  aria-pressed={isNetworkingSelected}
                  className={cn(
                    "gbtn gbtn--sm",
                    isNetworkingSelected ? "gbtn--leaf" : "gbtn--mint",
                  )}
                >
                  {QUICK_PICK_SUBJECT}
                </button>
              </div>

              {step1Error ? (
                <div
                  id={subjectErrorId}
                  role="alert"
                  className="rounded-2xl bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-danger)]"
                >
                  {step1Error}
                </div>
              ) : null}

              <div className="mt-2 flex justify-center">
                <button
                  type="submit"
                  className="pub-cta-pill pub-cta-pill--md w-full max-w-[300px]"
                >
                  Next
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {step === 2 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="flex flex-col items-center text-center"
          >
            <div className="hatch-cloud">
              <svg
                className="hatch-cloud__svg"
                viewBox="0 0 460 136"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M230 10C226 4 218 2 213 8C217 14 224 15 230 10Z"
                  fill="var(--noggin-leaf)"
                />
                <path
                  d="M230 10C234 4 242 2 247 8C243 14 236 15 230 10Z"
                  fill="var(--ng-c-6f9e36)"
                />
                <rect
                  x="16"
                  y="14"
                  width="428"
                  height="112"
                  rx="56"
                  fill="var(--ng-c-fffef9)"
                  stroke="var(--noggin-leaf)"
                  strokeWidth="5"
                />
                <rect
                  x="24"
                  y="22"
                  width="412"
                  height="96"
                  rx="48"
                  fill="var(--ng-c-f7f4e6)"
                  opacity="0.45"
                />
              </svg>
              <div className="hatch-cloud__content">
                <h1
                  id="adopt-step-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="stage-h1 focus:outline-none"
                >
                  Tap to hatch
                </h1>
                <p className="stage-sub">
                  Learning <strong>{subject}</strong> together
                </p>
              </div>
              <div className="hatch-cloud__dots" aria-hidden="true">
                <span className="hatch-cloud__dot-lg" />
                <span className="hatch-cloud__dot-sm" />
              </div>
            </div>

            <div className="mt-7 w-full">
              <EggHatch onHatched={() => setStep(3)} />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="flex flex-col items-center text-center"
          >
            <div className="hatch-cloud">
              <svg
                className="hatch-cloud__svg"
                viewBox="0 0 460 136"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M230 10C226 4 218 2 213 8C217 14 224 15 230 10Z"
                  fill="var(--noggin-leaf)"
                />
                <path
                  d="M230 10C234 4 242 2 247 8C243 14 236 15 230 10Z"
                  fill="var(--ng-c-6f9e36)"
                />
                <rect
                  x="16"
                  y="14"
                  width="428"
                  height="112"
                  rx="56"
                  fill="var(--ng-c-fffef9)"
                  stroke="var(--noggin-leaf)"
                  strokeWidth="5"
                />
              </svg>
              <div className="hatch-cloud__content">
                <h1
                  id="adopt-step-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="stage-h1 focus:outline-none"
                >
                  Meet your Nog
                </h1>
                <p className="stage-sub">
                  Ready to master <strong>{subject}</strong>
                </p>
              </div>
              <div className="hatch-cloud__dots" aria-hidden="true">
                <span className="hatch-cloud__dot-lg" />
                <span className="hatch-cloud__dot-sm" />
              </div>
            </div>

            <div className="mt-4 flex w-full justify-center nog-bob">
              <NogStage
                scene="hatched"
                alt="Your newly hatched Nog smiling between two eggshell halves"
                poster="/nog/hatched-shells.png"
                width={1583}
                height={994}
                sizes="(min-width: 768px) 620px, 92vw"
                priority
                className="w-full max-w-[540px]"
              />
            </div>

            <div className="mt-4 flex w-full justify-center">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="pub-cta-pill pub-cta-pill--md w-full max-w-[300px]"
              >
                Name your Nog
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="split-game mx-auto w-full max-w-[900px] text-left"
          >
            <div className="hatch-panel order-2 md:order-1">
              <h1
                id="adopt-step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="stage-h1 text-left focus:outline-none"
              >
                What will you call me?
              </h1>

              <p id={nameHelpId} className="stage-sub mt-2 text-left">
                Enter the name of your Nog
              </p>

              <form action={formAction} className="mt-6 flex max-w-[460px] flex-col gap-5">
                <input type="hidden" name="subjectName" value={subject} />

                <div className="flex flex-col gap-2">
                  <label htmlFor={nameInputId} className="figma-auth-label">
                    Nog Name
                  </label>
                  <input
                    id={nameInputId}
                    name="name"
                    type="text"
                    autoComplete="off"
                    minLength={1}
                    maxLength={MAX_NAME_LENGTH}
                    required
                    value={nogName}
                    onChange={(event) => {
                      setNogName(event.target.value);
                      if (step4Error) setStep4Error(null);
                    }}
                    placeholder="e.g. Pingu, Coral, Packet"
                    aria-invalid={Boolean(step4Error) || undefined}
                    aria-describedby={
                      step4Error ? `${nameHelpId} ${nameErrorId}` : nameHelpId
                    }
                    className="g-input"
                  />
                </div>

                {step4Error ? (
                  <div
                    id={nameErrorId}
                    role="alert"
                    className="rounded-2xl bg-[var(--noggin-danger-soft)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--noggin-danger)]"
                  >
                    {step4Error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending || trimmedName.length === 0}
                  aria-busy={pending}
                  className="pub-cta-pill pub-cta-pill--md mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitLabel}
                </button>
              </form>
            </div>

            <div className="order-1 flex justify-center md:order-2">
              <div className="w-full max-w-[260px] md:max-w-[400px] nog-bob">
                <NogStage
                  scene="room"
                  alt="Your new Nog"
                  poster="/nog/blob-closeup.png"
                  width={1254}
                  height={1254}
                  sizes="(min-width: 768px) 400px, 260px"
                  priority
                  className="w-full"
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
