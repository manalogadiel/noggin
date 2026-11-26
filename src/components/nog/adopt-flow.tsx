"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { completeOnboardingAction } from "@/app/(app)/actions/nog-actions";
import {
  NogCustomizeStage,
  type NogCustomizeSubmitPayload,
} from "@/components/customize/nog-customize-stage";
import {
  type BookCoverStyle,
  useGameUi,
} from "@/components/game-ui/game-ui-context";
import { EggHatch } from "@/components/nog/egg";
import { FirstNotebookStep } from "@/components/nog/first-notebook-step";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { MAX_TOPIC_NAME_LENGTH } from "@/core/domain/topic-name";

type AdoptStep = 1 | 2 | 3 | 4;

function FluffySproutCloud({
  headingId,
  headingRef,
  title,
  subtitle,
}: {
  headingId: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="hatch-cloud">
      <svg
        className="hatch-cloud__svg"
        viewBox="0 0 460 132"
        fill="none"
        aria-hidden="true"
      >
        {/* Twin-leaf botanical sprout perched on top-right cloud lobe */}
        <path
          d="M326 24 C320 11, 308 7, 302 15 C307 24, 318 27, 326 24 Z"
          fill="var(--noggin-leaf)"
        />
        <path
          d="M328 24 C335 9, 349 6, 355 15 C349 24, 338 27, 328 24 Z"
          fill="var(--ng-c-6f9e36)"
        />
        {/* 3D soft leaf extrusion underneath sculpted cloud */}
        <path
          d="M92 36 C104 15, 146 11, 174 27 C194 13, 240 11, 266 25 C294 11, 344 15, 360 37 C398 35, 424 57, 418 83 C424 109, 396 127, 360 121 C340 133, 294 133, 268 122 C242 133, 198 133, 174 122 C142 133, 102 129, 88 113 C54 117, 32 95, 40 71 C32 47, 58 31, 92 36 Z"
          fill="var(--noggin-leaf)"
        />
        {/* Main sculpted puffy cream cloud */}
        <path
          d="M92 30 C104 10, 146 6, 174 21 C194 7, 240 6, 266 19 C294 6, 344 10, 360 31 C398 29, 424 51, 418 77 C424 103, 396 121, 360 115 C340 127, 294 127, 268 116 C242 127, 198 127, 174 116 C142 127, 102 123, 88 107 C54 111, 32 89, 40 65 C32 41, 58 25, 92 30 Z"
          fill="var(--ng-c-fffef9)"
        />
      </svg>
      <div className="hatch-cloud__content">
        <h1
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="stage-h1 focus:outline-none"
        >
          {title}
        </h1>
        <p className="stage-sub">{subtitle}</p>
      </div>
      <div className="hatch-cloud__dots" aria-hidden="true">
        <span className="hatch-cloud__dot-lg" />
        <span className="hatch-cloud__dot-sm" />
      </div>
    </div>
  );
}

export function AdoptFlow() {
  const router = useRouter();
  const { state, updateState } = useGameUi();

  const [step, setStep] = useState<AdoptStep>(1);
  const [eggTaps, setEggTaps] = useState(0);
  const [nogName, setNogName] = useState("");
  const [bodyColor, setBodyColor] = useState<string | null>(null);
  const [equippedSlots, setEquippedSlots] = useState<(string | null)[]>(
    () => state.equippedSlots,
  );
  const [notebookTitle, setNotebookTitle] = useState("");
  const [coverStyle, setCoverStyle] = useState<BookCoverStyle>("sage");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [step4Error, setStep4Error] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<AdoptStep>(1);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  function handleCustomizeNext(payload: NogCustomizeSubmitPayload) {
    setNogName(payload.name);
    setBodyColor(payload.bodyColor);
    setEquippedSlots(payload.equippedSlots);
    setStep3Error(null);
    setStep4Error(null);
    setStep(4);
  }

  async function handleNotebookSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = notebookTitle.trim();
    if (trimmedTitle.length === 0) {
      setStep4Error("Enter a lesson title for your first notebook.");
      return;
    }
    if (trimmedTitle.length > MAX_TOPIC_NAME_LENGTH) {
      setStep4Error(
        `Keep your notebook title to ${MAX_TOPIC_NAME_LENGTH} characters or fewer.`,
      );
      return;
    }

    setStep4Error(null);
    setIsSubmitting(true);

    try {
      const result = await completeOnboardingAction({
        name: nogName,
        bodyColor,
        notebookTitle: trimmedTitle,
        coverStyle,
        equippedSlots,
      });

      if (result.status === "unauthenticated") {
        router.push("/login?next=%2Fadopt");
        return;
      }

      if (result.status === "invalid_name") {
        setStep3Error(result.error);
        setStep(3);
        setIsSubmitting(false);
        return;
      }

      if (result.status !== "ok") {
        setStep4Error(result.error);
        setIsSubmitting(false);
        return;
      }

      updateState((prev) => ({
        ...prev,
        equippedSlots,
        ...(result.topicId
          ? {
              notebookCovers: {
                ...prev.notebookCovers,
                [result.topicId]: coverStyle,
              },
              notebookTitles: {
                ...prev.notebookTitles,
                [result.topicId]: trimmedTitle,
              },
            }
          : {}),
      }));

      router.push(`/nogs/${result.nogId}`);
    } catch {
      setStep4Error(
        "Brain fog! We couldn't create your notebook just now. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  const stageTop = (
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
  );

  if (step === 3) {
    return (
      <NogCustomizeStage
        mode="onboarding"
        stage="hatchling"
        initialName={nogName}
        initialBodyColor={bodyColor}
        initialEquippedSlots={equippedSlots}
        submitLabel="Next: Name Your Notebook →"
        headingId="adopt-step-heading"
        headingRef={headingRef}
        topChrome={stageTop}
        errorMessage={step3Error}
        onClearError={() => setStep3Error(null)}
        onSubmit={handleCustomizeNext}
      />
    );
  }

  const remainingTaps = Math.max(0, 3 - eggTaps);
  const eggCloudSub =
    eggTaps === 0
      ? "Give the egg 3 taps to crack the shell"
      : remainingTaps > 1
        ? `${remainingTaps} more taps to crack the shell`
        : remainingTaps === 1
          ? "1 more tap to crack the shell"
          : "Here comes your new Nog!";

  return (
    <div className="game-world game-world--hatch">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-day.jpg"
        alt=""
        className="scene-bg-img scene-bg-img--sanctuary"
      />
      <div
        className={
          step === 4
            ? "scene-bg-scrim scene-bg-scrim--notebook-onboard"
            : "scene-bg-scrim scene-bg-scrim--hatch"
        }
        aria-hidden="true"
      />

      {stageTop}

      <div className="stage-body items-center text-center">
        {step === 1 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="flex flex-col items-center text-center"
          >
            <FluffySproutCloud
              headingId="adopt-step-heading"
              headingRef={headingRef}
              title="Tap to hatch"
              subtitle={eggCloudSub}
            />

            <div className="mt-5 w-full">
              <EggHatch
                onTapChange={setEggTaps}
                onHatched={() => setStep(2)}
              />
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section
            aria-labelledby="adopt-step-heading"
            className="flex flex-col items-center text-center"
          >
            <FluffySproutCloud
              headingId="adopt-step-heading"
              headingRef={headingRef}
              title="Meet your Nog"
              subtitle="Freshly hatched and ready to learn with you"
            />

            <div className="mt-4 flex w-full justify-center nog-bob">
              <NogStage
                scene="hatched"
                alt="Your newly hatched Nog smiling between two eggshell halves"
                poster="/nog/hatched-shells.png"
                width={1583}
                height={994}
                sizes="(min-width: 768px) 580px, 92vw"
                priority
                className="w-full max-w-[520px]"
              />
            </div>

            <div className="mt-4 flex w-full justify-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="cust-done-btn"
              >
                Customize Your Nog →
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <FirstNotebookStep
            nogName={nogName}
            bodyColor={bodyColor}
            notebookTitle={notebookTitle}
            coverStyle={coverStyle}
            pending={isSubmitting}
            error={step4Error}
            headingRef={headingRef}
            onNotebookTitleChange={(value) => {
              setNotebookTitle(value);
              if (step4Error) setStep4Error(null);
            }}
            onCoverStyleChange={setCoverStyle}
            onSubmit={handleNotebookSubmit}
          />
        ) : null}
      </div>
    </div>
  );
}
