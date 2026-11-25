"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { runQuickCheckAction } from "@/app/(app)/actions/check-actions";
import type {
  NogRecord,
  NogStageSlug,
  QuickCheckAttempt,
  TopicSummary,
} from "@/core/application/ports";
import { AnswerReveal } from "./answer-reveal";
import { ResultsView } from "./results-view";
import { type CheckFeedback, TopicSelectStep } from "./topic-select-step";

export interface PlayViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  initialTopicId: string | null;
}

type PlayStep = "setup" | "thinking" | "quiz" | "results";

interface CompletedCheck {
  topic: TopicSummary;
  attempts: QuickCheckAttempt[];
  meterBefore: number;
  meterAfter: number;
  stage: NogStageSlug;
  reused: boolean;
}

export function PlayView({ nog, topics, initialTopicId }: PlayViewProps) {
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialTopicId,
  );
  const [step, setStep] = useState<PlayStep>("setup");
  const [feedback, setFeedback] = useState<CheckFeedback | null>(null);
  const [checkData, setCheckData] = useState<CompletedCheck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const handleSelectTopic = useCallback((topicId: string) => {
    setSelectedTopicId(topicId);
    setFeedback(null);
  }, []);

  const executeCheck = useCallback(
    async (topicId: string) => {
      const targetTopic = topics.find((topic) => topic.id === topicId);
      if (!targetTopic || targetTopic.status !== "ready") {
        return;
      }

      setStep("thinking");
      setFeedback(null);

      try {
        const result = await runQuickCheckAction({
          nogId: nog.id,
          topicId,
        });

        if (result.status === "unauthenticated") {
          router.push(
            `/login?next=${encodeURIComponent(`/nogs/${nog.id}/play?topic=${encodeURIComponent(topicId)}`)}`,
          );
          return;
        }

        if (result.status !== "ok") {
          setFeedback({ kind: result.status, topicId });
          setStep("setup");
          return;
        }

        if (result.attempts.length === 0) {
          setFeedback({ kind: "no_questions", topicId });
          setStep("setup");
          return;
        }

        setCheckData({
          topic: targetTopic,
          attempts: result.attempts,
          meterBefore: result.meterBefore,
          meterAfter: result.meterAfter,
          stage: result.stage,
          reused: result.reused,
        });
        setCurrentIndex(0);
        setRevealedIds(new Set());
        setStep("quiz");
      } catch {
        setFeedback({ kind: "sleepy", topicId });
        setStep("setup");
      }
    },
    [nog.id, router, topics],
  );

  const handleStart = useCallback(() => {
    if (!selectedTopicId) {
      return;
    }
    void executeCheck(selectedTopicId);
  }, [executeCheck, selectedTopicId]);

  const handleRetry = useCallback(() => {
    const topicId = feedback?.topicId ?? selectedTopicId;
    if (!topicId) {
      return;
    }
    void executeCheck(topicId);
  }, [executeCheck, feedback?.topicId, selectedTopicId]);

  const handleMarkRevealed = useCallback((attemptId: string) => {
    setRevealedIds((current) => {
      if (current.has(attemptId)) {
        return current;
      }
      const next = new Set(current);
      next.add(attemptId);
      return next;
    });
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (!checkData) {
      return;
    }
    if (currentIndex + 1 >= checkData.attempts.length) {
      setStep("results");
      return;
    }
    setCurrentIndex((index) => index + 1);
  }, [checkData, currentIndex]);

  const handleChooseAnother = useCallback(() => {
    setStep("setup");
    setFeedback(null);
    setCurrentIndex(0);
  }, []);

  const currentAttempt =
    step === "quiz" && checkData ? checkData.attempts[currentIndex] : null;

  return (
    <div className="relative min-h-[calc(100dvh-76px)] overflow-hidden rounded-[28px] px-4 py-5 md:px-7 md:py-7">
      {/* Quiz Show Stage Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/quiz-field-stage.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgb(245_251_232_/_0.78)] via-[rgb(255_253_244_/_0.72)] to-[rgb(228_241_202_/_0.8)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1160px] min-w-0">
        {(step === "setup" || step === "thinking") && (
          <TopicSelectStep
            nog={nog}
            topics={topics}
            selectedTopicId={selectedTopicId}
            isThinking={step === "thinking"}
            feedback={feedback}
            onSelectTopic={handleSelectTopic}
            onStart={handleStart}
            onRetry={handleRetry}
          />
        )}

        {step === "quiz" && checkData && currentAttempt && (
          <AnswerReveal
            key={currentAttempt.id}
            nogId={nog.id}
            nogName={nog.name}
            topicTitle={checkData.topic.title}
            attempt={currentAttempt}
            questionNumber={currentIndex + 1}
            totalQuestions={checkData.attempts.length}
            alreadyRevealed={revealedIds.has(currentAttempt.id)}
            onRevealed={handleMarkRevealed}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        )}

        {step === "results" && checkData && (
          <ResultsView
            nog={nog}
            topic={checkData.topic}
            attempts={checkData.attempts}
            meterBefore={checkData.meterBefore}
            meterAfter={checkData.meterAfter}
            stage={checkData.stage}
            reused={checkData.reused}
            onChooseAnother={handleChooseAnother}
          />
        )}
      </div>
    </div>
  );
}
