"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { runQuickCheckAction } from "@/app/(app)/actions/check-actions";
import type { AddTopicActionResult } from "@/app/(app)/actions/topic-actions";
import type {
  NogRecord,
  NogStageSlug,
  QuickCheckAttempt,
  TopicSummary,
} from "@/core/application/ports";
import type {
  RunQuickCheckInput,
} from "@/core/application/use-cases/run-quick-check";
import type {
  TeachLessonInput,
  TeachLessonResult,
} from "@/core/application/use-cases/teach-lesson";
import {
  DEFAULT_LESSON_WORD_LIMIT,
  splitLesson,
} from "@/core/domain/lesson";
import { QUICK_CHECK_SIZE } from "@/core/domain/quiz";
import { AnswerReveal } from "./answer-reveal";
import { ResultsView } from "./results-view";
import {
  type CheckFeedback,
  type SetupActionStatus,
  type StartQuizOptions,
  TopicSelectStep,
} from "./topic-select-step";

const MAX_UPLOAD_CHUNKS = 5;

let uploadKeySeq = 0;
function nextUploadKey(): string {
  uploadKeySeq += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `play-file-${crypto.randomUUID()}`;
  }
  return `play-file-${Date.now()}-${uploadKeySeq}`;
}

export interface PlayViewProps {
  nog: NogRecord;
  topics: ReadonlyArray<TopicSummary>;
  initialTopicId: string | null;
  onAddTopic?: (nogId: string, title: string) => Promise<AddTopicActionResult>;
  onTeachFile?: (input: TeachLessonInput) => Promise<TeachLessonResult>;
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

export function PlayView({
  nog,
  topics,
  initialTopicId,
  onAddTopic,
  onTeachFile,
}: PlayViewProps) {
  const router = useRouter();
  const [topicList, setTopicList] = useState<TopicSummary[]>(() => [...topics]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialTopicId,
  );
  const [step, setStep] = useState<PlayStep>("setup");
  const [feedback, setFeedback] = useState<CheckFeedback | null>(null);
  const [checkData, setCheckData] = useState<CompletedCheck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const lastOptionsRef = useRef<StartQuizOptions | undefined>(undefined);

  const handleSelectTopic = useCallback((topicId: string) => {
    setSelectedTopicId(topicId);
    setFeedback(null);
  }, []);

  const executeCheck = useCallback(
    async (topicId: string, options?: StartQuizOptions) => {
      const targetTopic = topicList.find((topic) => topic.id === topicId);
      if (!targetTopic || targetTopic.status !== "ready") {
        return;
      }

      lastOptionsRef.current = options;
      setStep("thinking");
      setFeedback(null);

      const payload: RunQuickCheckInput = {
        nogId: nog.id,
        topicId,
        ...(options?.questionCount && options.questionCount !== QUICK_CHECK_SIZE
          ? { questionCount: options.questionCount }
          : {}),
        ...(options?.formats &&
        options.formats.length > 0 &&
        options.formats.length < 3
          ? { formats: options.formats }
          : {}),
      };

      try {
        const result = await runQuickCheckAction(payload);

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
    [nog.id, router, topicList],
  );

  const handleStart = useCallback(
    (options?: StartQuizOptions) => {
      if (!selectedTopicId) {
        return;
      }
      void executeCheck(selectedTopicId, options);
    },
    [executeCheck, selectedTopicId],
  );

  const handleRetry = useCallback(() => {
    const topicId = feedback?.topicId ?? selectedTopicId;
    if (!topicId) {
      return;
    }
    void executeCheck(topicId, lastOptionsRef.current);
  }, [executeCheck, feedback?.topicId, selectedTopicId]);

  const handleGenerateTopic = useCallback(
    async (title: string): Promise<SetupActionStatus> => {
      const cleaned = title.trim();
      if (!cleaned) {
        return { ok: false, message: "Enter a topic name first." };
      }
      if (!onAddTopic) {
        return { ok: false, message: "Topic generation is unavailable right now." };
      }

      try {
        const result = await onAddTopic(nog.id, cleaned);
        if (result.status === "unauthenticated") {
          router.push(`/login?next=${encodeURIComponent(`/nogs/${nog.id}/play`)}`);
          return { ok: false, message: "Please sign in to continue." };
        }
        if (result.status === "ok" || result.status === "pending") {
          const nextTopic = result.topic;
          setTopicList((prev) => {
            const exists = prev.some((t) => t.id === nextTopic.id);
            return exists
              ? prev.map((t) => (t.id === nextTopic.id ? nextTopic : t))
              : [...prev, nextTopic];
          });
          if (nextTopic.status === "ready") {
            setSelectedTopicId(nextTopic.id);
            setFeedback(null);
            return {
              ok: true,
              message: `Ready! "${nextTopic.title}" has ${nextTopic.questionCount} questions.`,
            };
          }
          return {
            ok: true,
            message: `Saved "${nextTopic.title}" — questions are still finishing up.`,
          };
        }
        if (result.status === "tired_for_today") {
          return {
            ok: false,
            message: `${nog.name} hit today's question generation limit.`,
          };
        }
        if (result.status === "already_exists") {
          const existingTopic = result.topic;
          setTopicList((prev) =>
            prev.some((t) => t.id === existingTopic.id)
              ? prev.map((t) => (t.id === existingTopic.id ? existingTopic : t))
              : [...prev, existingTopic],
          );
          if (existingTopic.status === "ready") {
            setSelectedTopicId(existingTopic.id);
          }
          return {
            ok: true,
            message: `"${existingTopic.title}" is already ready in your topic list.`,
          };
        }
        if (result.status === "invalid_title") {
          return { ok: false, message: "Use a clear 2–60 character topic name." };
        }
        if (result.status === "error") {
          return { ok: false, message: result.error };
        }
        return { ok: false, message: "Couldn't generate questions for that topic." };
      } catch {
        return { ok: false, message: "Couldn't generate questions right now. Try again." };
      }
    },
    [nog.id, nog.name, onAddTopic, router],
  );

  const handleUploadNotes = useCallback(
    async (topicId: string, rawText: string): Promise<SetupActionStatus> => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        return { ok: false, message: "That file has no readable text." };
      }
      if (!onTeachFile) {
        return { ok: false, message: "Study file upload is unavailable right now." };
      }

      const chunks = splitLesson(trimmed, DEFAULT_LESSON_WORD_LIMIT)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
        .slice(0, MAX_UPLOAD_CHUNKS);

      if (chunks.length === 0) {
        return { ok: false, message: "That file has no readable text." };
      }

      let savedChunks = 0;
      let skippedDuplicate = 0;
      for (const body of chunks) {
        try {
          const res = await onTeachFile({
            nogId: nog.id,
            topicId,
            body,
            idempotencyKey: nextUploadKey(),
          });
          if (res.status === "unauthenticated") {
            router.push(`/login?next=${encodeURIComponent(`/nogs/${nog.id}/play`)}`);
            return { ok: false, message: "Please sign in to continue." };
          }
          if (res.status === "ok" || res.status === "brain_fog") {
            savedChunks += 1;
            continue;
          }
          if (res.status === "already_taught") {
            skippedDuplicate += 1;
            continue;
          }
          if (res.status === "tired_for_today") {
            return {
              ok: savedChunks > 0,
              message:
                savedChunks > 0
                  ? `Taught ${savedChunks} note${savedChunks === 1 ? "" : "s"} before hitting today's limit.`
                  : `${nog.name} is full for today — try again tomorrow.`,
            };
          }
          if (res.status === "questions_pending") {
            return {
              ok: false,
              message: "Questions for this topic are still being written.",
            };
          }
          return {
            ok: savedChunks > 0,
            message:
              savedChunks > 0
                ? `Taught ${savedChunks} note${savedChunks === 1 ? "" : "s"} from your file.`
                : "Couldn't teach those notes right now.",
          };
        } catch {
          return {
            ok: savedChunks > 0,
            message:
              savedChunks > 0
                ? `Taught ${savedChunks} note${savedChunks === 1 ? "" : "s"} before hitting a snag.`
                : "Couldn't upload those study notes right now.",
          };
        }
      }

      if (savedChunks > 0) {
        setFeedback(null);
        return {
          ok: true,
          message: `Taught ${savedChunks} study note${savedChunks === 1 ? "" : "s"} to ${nog.name}! Ready to quiz.`,
        };
      }
      if (skippedDuplicate > 0) {
        return {
          ok: true,
          message: `${nog.name} already knows those notes — ready to quiz!`,
        };
      }
      return { ok: false, message: "No new notes were saved from that file." };
    },
    [nog.id, nog.name, onTeachFile, router],
  );

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
    <div className="game-world game-world--hub qs-world">
      {/* Quiz Show Stage Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/quiz-field-stage.jpg"
        alt=""
        className="scene-bg-img"
      />
      <div className="scene-bg-scrim qs-scrim" aria-hidden="true" />

      <div className="relative z-10 flex w-full flex-1 flex-col min-w-0">
        {(step === "setup" || step === "thinking") && (
          <TopicSelectStep
            nog={nog}
            topics={topicList}
            selectedTopicId={selectedTopicId}
            isThinking={step === "thinking"}
            feedback={feedback}
            onSelectTopic={handleSelectTopic}
            onStart={handleStart}
            onRetry={handleRetry}
            onGenerateTopic={onAddTopic ? handleGenerateTopic : undefined}
            onUploadNotes={onTeachFile ? handleUploadNotes : undefined}
          />
        )}

        {step === "quiz" && checkData && currentAttempt && (
          <AnswerReveal
            key={currentAttempt.id}
            nogId={nog.id}
            nogName={nog.name}
            nogStage={nog.stage}
            nogTint={nog.colors?.body ?? null}
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
