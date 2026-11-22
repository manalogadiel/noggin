"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
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
  const submitLabel = pending
    ? "Hatching…"
    : trimmedName.length > 0
      ? `Meet ${trimmedName}`
      : "Meet your Nog";

  return (
    <div className="mx-auto w-full max-w-[780px] py-2 md:py-6">
      <div className="rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setStep4Error(null);
                setStep((current) => (current > 1 ? ((current - 1) as AdoptStep) : 1));
              }}
              className="noggin-display inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--noggin-radius-pill)] px-3 text-[1rem] font-semibold text-[var(--noggin-forest)] transition-colors hover:bg-[var(--noggin-mint)]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <p className="noggin-display rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] px-3.5 py-1.5 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
            Step {step} of 4
          </p>
        </div>

        {step === 1 ? (
          <section aria-labelledby="adopt-step-heading" className="mx-auto max-w-[540px]">
            <h1
              id="adopt-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="noggin-display text-center text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-[var(--noggin-leaf-title)] focus:outline-none"
            >
              What should your Nog learn?
            </h1>

            <p className="mt-3 text-center text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
              Type any subject or pick a starter below.
            </p>

            <form onSubmit={handleSubjectSubmit} className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={subjectInputId}
                  className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]"
                >
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
                  className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.0625rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[0.9375rem] font-medium text-[var(--noggin-ink)]">
                  Quick pick:
                </span>
                <button
                  type="button"
                  onClick={handleQuickPick}
                  aria-pressed={isNetworkingSelected}
                  className={cn(
                    "noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--noggin-radius-pill)] px-5 text-[0.9375rem] font-bold transition-colors",
                    isNetworkingSelected
                      ? "bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow)]"
                      : "bg-[var(--noggin-mint-light)] text-[var(--noggin-forest)] hover:bg-[var(--noggin-panel)]",
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
                  className="noggin-primary-pill noggin-display inline-flex h-14 min-h-11 w-full max-w-[320px] cursor-pointer items-center justify-center px-8 text-[1.125rem] font-bold"
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
            <h1
              id="adopt-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="noggin-display text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-[var(--noggin-leaf-title)] focus:outline-none"
            >
              Tap to hatch
            </h1>

            <p className="mt-2 text-[1rem] text-[var(--noggin-ink)]">
              Subject:{" "}
              <span className="font-semibold text-[var(--noggin-forest)]">
                {subject}
              </span>
            </p>

            <div className="mt-6 w-full">
              <EggHatch onHatched={() => setStep(3)} />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="flex flex-col items-center text-center"
          >
            <h1
              id="adopt-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="noggin-display text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-[var(--noggin-leaf-title)] focus:outline-none"
            >
              Meet your Nog
            </h1>

            <p className="mt-2 text-[1rem] text-[var(--noggin-ink)]">
              Fresh out of its shell and curious about{" "}
              <span className="font-semibold text-[var(--noggin-forest)]">
                {subject}
              </span>
              .
            </p>

            <div className="mt-6 flex w-full justify-center">
              <NogStage
                scene="hatched"
                alt="Your newly hatched Nog smiling between two eggshell halves"
                poster="/nog/hatched-shells.png"
                width={1583}
                height={994}
                sizes="(min-width: 768px) 520px, 90vw"
                priority
                className="w-full max-w-[480px]"
              />
            </div>

            <div className="mt-8 flex w-full justify-center">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="noggin-primary-pill noggin-display inline-flex h-14 min-h-11 w-full max-w-[320px] cursor-pointer items-center justify-center px-8 text-[1.125rem] font-bold"
              >
                Name your Nog
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section aria-labelledby="adopt-step-heading">
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
              <div className="order-1 flex justify-center md:order-2">
                <div className="nog-bob flex h-[196px] w-[196px] items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--noggin-sun-top)_0%,var(--noggin-mint-light)_100%)] p-4 md:h-[248px] md:w-[248px]">
                  <Image
                    src="/nog/blob-closeup.png"
                    alt="Your new Nog"
                    width={240}
                    height={240}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="order-2 md:order-1">
                <h1
                  id="adopt-step-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="noggin-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.12] tracking-tight text-[var(--noggin-leaf-title)] focus:outline-none"
                >
                  What will you call me?
                </h1>

                <p
                  id={nameHelpId}
                  className="mt-2 text-[1rem] leading-relaxed text-[var(--noggin-ink)]"
                >
                  Enter the name of your Nog
                </p>

                <form action={formAction} className="mt-6 flex flex-col gap-5">
                  <input type="hidden" name="subjectName" value={subject} />

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={nameInputId}
                      className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]"
                    >
                      Nog name
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
                      className="h-14 w-full rounded-[20px] border-2 border-[var(--noggin-leaf-strong)] bg-[var(--noggin-white)] px-4 text-[1.0625rem] text-[var(--noggin-forest)] placeholder:text-[var(--noggin-ink)] focus:outline-[3px] focus:outline-offset-2 focus:outline-[var(--noggin-leaf-strong)]"
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
                    className="noggin-primary-pill noggin-display inline-flex h-14 min-h-11 w-full cursor-pointer items-center justify-center px-8 text-[1.125rem] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitLabel}
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
