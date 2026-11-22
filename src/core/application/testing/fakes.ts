import { nextReviewIntervalDays } from "../../domain/thought-card";
import { growthStage, trainingMeter } from "../../domain/training";
import type {
  ActivityEvent,
  ActivityRepository,
  AnswerGrader,
  ApplyDigestInput,
  ApplyDigestResult,
  AttemptRepository,
  BrainAnswerResult,
  CheckAttemptRecord,
  CheckReservationKey,
  Clock,
  CreateNogInput,
  CreateUserSubjectInput,
  CreateUserTopicInput,
  CurrentUser,
  GeneratedQuestionDraft,
  GenerateQuestionsInput,
  GraderResult,
  LessonPage,
  ListenerDigest,
  NewPageInput,
  NogBrain,
  NogColors,
  NogListener,
  NogRecord,
  NogRepository,
  NogStageSlug,
  NotebookRepository,
  OwnedCheckAttempt,
  OwnedMessage,
  ProfileRepository,
  ProfileSettings,
  ProgressRepository,
  QuestionBank,
  QuestionRecord,
  QuestionWriter,
  QuotaResult,
  RecordCheckInput,
  ReviewThoughtCardInput,
  SavedDigestRecord,
  SaveFollowUpPageResult,
  SaveGeneratedQuestionsInput,
  SpeechToText,
  SubjectRecord,
  SubjectRepository,
  SynthesizedAudio,
  TextToSpeech,
  ThoughtCardRecord,
  ThoughtCardRepository,
  TopicMasteryRow,
  TopicRecord,
  TopicRepository,
  UpdatePettingInput,
  UsageKind,
  UsageRepository,
  VoiceCacheRepository,
} from "../ports";

export interface InMemoryPortsOptions {
  userId?: string | null;
  now?: Date;
  caps?: Partial<Record<UsageKind, number>>;
  features?: Record<string, boolean>;
  subjects?: SubjectRecord[];
  topics?: TopicRecord[];
  nogs?: NogRecord[];
  pages?: LessonPage[];
  cards?: ThoughtCardRecord[];
  messages?: OwnedMessage[];
  questions?: QuestionRecord[];
  attempts?: CheckAttemptRecord[];
  mastery?: TopicMasteryRow[];
  activity?: ActivityEvent[];
  displayNames?: Record<string, string>;
  profileSettings?: Record<string, ProfileSettings>;
  listenerDigest?: ListenerDigest;
  generatedQuestions?: GeneratedQuestionDraft[];
  transcript?: string;
  audio?: SynthesizedAudio;
}

const DEFAULT_CAPS: Record<UsageKind, number> = {
  listener: 10,
  answer: 5,
  grade: 5,
  stt_seconds: 300,
  tts_chars: 1000,
  pet: 50,
  generate: 5,
  ask: 15,
};

export function createInMemoryPorts(options: InMemoryPortsOptions = {}) {
  let currentUserId = options.userId ?? "student-1";
  let currentNow = options.now ?? new Date("2026-11-21T03:00:00.000Z");

  const subjectStore = [...(options.subjects ?? [])];
  const topicStore = (options.topics ?? []).map((topic) => ({ ...topic }));
  const nogStore = [...(options.nogs ?? [])];
  const pageStore = [...(options.pages ?? [])];
  const cardStore = [...(options.cards ?? [])];
  const messageStore = [...(options.messages ?? [])];
  const questionStore = [...(options.questions ?? [])];
  const attemptStore = [...(options.attempts ?? [])];
  const profileSettingsStore = new Map<string, ProfileSettings>(
    Object.entries(options.profileSettings ?? {}).map(([key, value]) => [
      key,
      { ...value },
    ]),
  );
  const usageCounts = new Map<string, number>();
  const voiceCacheStore = new Map<string, SynthesizedAudio>();
  const appliedDigests = new Map<string, SavedDigestRecord>();
  const reservationQueues = new Map<string, Promise<void>>();
  const caps: Record<UsageKind, number> = { ...DEFAULT_CAPS, ...options.caps };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

  const currentUser: CurrentUser = {
    async get() {
      return currentUserId ? { id: currentUserId } : null;
    },
  };

  const clock: Clock = {
    now() {
      return new Date(currentNow.getTime());
    },
  };

  const subjects: SubjectRepository = {
    async findById(subjectId: string) {
      return subjectStore.find((s) => s.id === subjectId) ?? null;
    },
    async findBySlug(slug: string, ownerId?: string | null) {
      const normalized = slug.trim().toLowerCase();
      if (ownerId !== undefined) {
        return (
          subjectStore.find(
            (s) => s.slug === normalized && s.ownerId === ownerId,
          ) ?? null
        );
      }
      return (
        subjectStore.find(
          (s) =>
            s.slug === normalized &&
            (s.ownerId === null || s.ownerId === currentUserId),
        ) ?? null
      );
    },
    async listAccessible(ownerId: string) {
      return subjectStore.filter(
        (s) => (s.ownerId === null && s.available) || s.ownerId === ownerId,
      );
    },
    async createUserSubject(input: CreateUserSubjectInput) {
      const name = input.name.trim();
      const slug = input.slug.trim().toLowerCase();
      if (name.length < 1 || name.length > 40) {
        throw new Error("Subject name must be 1 to 40 characters");
      }
      const duplicate = subjectStore.some(
        (s) =>
          s.ownerId === input.ownerId &&
          (s.slug === slug || s.name.trim().toLowerCase() === name.toLowerCase()),
      );
      if (duplicate) {
        throw new Error("Subject already exists for owner");
      }
      const created: SubjectRecord = {
        id: nextId("subject"),
        ownerId: input.ownerId,
        slug,
        name,
        available: true,
      };
      subjectStore.push(created);
      return created;
    },
  };

  const topics: TopicRepository = {
    async findById(topicId: string) {
      return topicStore.find((t) => t.id === topicId) ?? null;
    },
    async findBySubjectAndSlug(
      subjectId: string,
      slug: string,
      ownerId?: string | null,
    ) {
      const normalized = slug.trim().toLowerCase();
      if (ownerId !== undefined) {
        return (
          topicStore.find(
            (t) =>
              t.subjectId === subjectId &&
              t.slug === normalized &&
              t.ownerId === ownerId,
          ) ?? null
        );
      }
      return (
        topicStore.find(
          (t) =>
            t.subjectId === subjectId &&
            t.slug === normalized &&
            (t.ownerId === null || t.ownerId === currentUserId),
        ) ?? null
      );
    },
    async listBySubject(subjectId: string) {
      return topicStore.filter(
        (t) =>
          t.subjectId === subjectId &&
          (t.ownerId === null || t.ownerId === currentUserId),
      );
    },
    async createUserTopic(input: CreateUserTopicInput) {
      const title = input.title.trim();
      const slug = input.slug.trim().toLowerCase();
      if (title.length < 1 || title.length > 60) {
        throw new Error("Topic title must be 1 to 60 characters");
      }
      const subject = subjectStore.find(
        (s) =>
          s.id === input.subjectId &&
          ((s.ownerId === null && s.available) || s.ownerId === input.ownerId),
      );
      if (subjectStore.length > 0 && !subject) {
        throw new Error("Subject not accessible for owner");
      }
      const officialCollision = topicStore.some(
        (t) =>
          t.subjectId === input.subjectId &&
          t.ownerId === null &&
          t.slug === slug,
      );
      if (officialCollision) {
        throw new Error("Topic slug collides with an official topic");
      }
      const existing = topicStore.find(
        (t) =>
          t.subjectId === input.subjectId &&
          t.ownerId === input.ownerId &&
          t.slug === slug,
      );
      if (existing) {
        if (existing.status === "pending") {
          return { ...existing };
        }
        throw new Error("Topic already exists for owner");
      }
      const created: TopicRecord = {
        id: nextId("topic"),
        subjectId: input.subjectId,
        ownerId: input.ownerId,
        slug,
        title,
        status: "pending",
        questionCount: 0,
      };
      topicStore.push(created);
      return { ...created };
    },
    async saveGeneratedQuestions(input: SaveGeneratedQuestionsInput) {
      const topic = topicStore.find(
        (t) => t.id === input.topicId && t.ownerId === input.ownerId,
      );
      if (!topic) {
        throw new Error("Topic not found for owner");
      }
      if (topic.status !== "pending") {
        throw new Error("Topic is already ready");
      }
      if (input.questions.length !== 8) {
        throw new Error("Exactly 8 questions are required");
      }
      for (const draft of input.questions) {
        if (draft.keyConcepts.length < 2 || draft.keyConcepts.length > 4) {
          throw new Error("Each question must have 2 to 4 key concepts");
        }
      }
      for (const draft of input.questions) {
        questionStore.push({
          id: nextId("question"),
          topicId: topic.id,
          prompt: draft.prompt,
          referenceAnswer: draft.referenceAnswer,
          sourceExcerpt: draft.sourceExcerpt,
          keyConcepts: [...draft.keyConcepts],
        });
      }
      topic.status = "ready";
      topic.questionCount = input.questions.length;
      return { ...topic };
    },
  };

  const nogs: NogRepository = {
    async findOwned(userId: string, nogId: string) {
      return (
        nogStore.find((n) => n.id === nogId && n.ownerId === userId) ?? null
      );
    },
    async listByOwner(userId: string) {
      return nogStore.filter((n) => n.ownerId === userId);
    },
    async findByOwnerAndSubject(userId: string, subjectId: string) {
      return (
        nogStore.find(
          (n) => n.ownerId === userId && n.subjectId === subjectId,
        ) ?? null
      );
    },
    async create(input: CreateNogInput) {
      const created: NogRecord = {
        id: nextId("nog"),
        ownerId: input.ownerId,
        subjectId: input.subjectId,
        name: input.name,
        stage: "hatchling",
        mood: "happy",
        happiness: 70,
        happinessToday: 0,
        happinessDay: null,
        vitality: 1,
      };
      nogStore.push(created);
      return created;
    },
    async updatePetting(input: UpdatePettingInput) {
      const target = nogStore.find((n) => n.id === input.nogId);
      if (!target) {
        throw new Error(`Nog ${input.nogId} not found`);
      }
      target.happiness = input.happiness;
      target.happinessToday = input.happinessToday;
      target.happinessDay = input.happinessDay;
      return { ...target };
    },
    async updateColors(ownerId: string, nogId: string, colors: NogColors) {
      const target = nogStore.find(
        (n) => n.id === nogId && n.ownerId === ownerId,
      );
      if (!target) {
        return null;
      }
      target.colors = { ...target.colors, ...colors };
      return { ...target, colors: { ...target.colors } };
    },
    async setRest(ownerId: string, nogId: string, restUntil: string | null) {
      const target = nogStore.find(
        (n) => n.id === nogId && n.ownerId === ownerId,
      );
      if (!target) {
        return null;
      }
      target.restUntil = restUntil;
      return { ...target };
    },
  };

  const notebook: NotebookRepository = {
    async savePage(input: NewPageInput) {
      const existing = pageStore.find(
        (p) =>
          p.nogId === input.nogId && p.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        return existing;
      }
      const nowIso = clock.now().toISOString();
      const page: LessonPage = {
        ...input,
        id: nextId("page"),
        parentLessonId: input.parentLessonId ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      pageStore.push(page);
      return page;
    },
    async findPage(nogId: string, lessonId: string) {
      return (
        pageStore.find((p) => p.nogId === nogId && p.id === lessonId) ?? null
      );
    },
    async findPageByIdempotencyKey(nogId: string, idempotencyKey: string) {
      return (
        pageStore.find(
          (p) => p.nogId === nogId && p.idempotencyKey === idempotencyKey,
        ) ?? null
      );
    },
    async findSavedDigest(nogId: string, idempotencyKey: string) {
      return appliedDigests.get(`${nogId}:${idempotencyKey}`) ?? null;
    },
    async saveFollowUpPage(
      input: NewPageInput & { parentLessonId: string; maxFollowUps: number },
    ): Promise<SaveFollowUpPageResult> {
      const existing = pageStore.find(
        (p) =>
          p.nogId === input.nogId && p.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        if (
          existing.kind !== "follow_up_answer" ||
          existing.parentLessonId !== input.parentLessonId ||
          existing.topicId !== input.topicId ||
          existing.body !== input.body
        ) {
          return { status: "conflict" };
        }
        return { status: "existing", page: existing };
      }

      const currentCount = pageStore.filter(
        (p) =>
          p.nogId === input.nogId &&
          p.parentLessonId === input.parentLessonId &&
          p.kind === "follow_up_answer",
      ).length;
      if (currentCount >= input.maxFollowUps) {
        return { status: "limit_reached" };
      }

      const nowIso = clock.now().toISOString();
      const page: LessonPage = {
        nogId: input.nogId,
        topicId: input.topicId,
        body: input.body,
        wordCount: input.wordCount,
        kind: "follow_up_answer",
        parentLessonId: input.parentLessonId,
        idempotencyKey: input.idempotencyKey,
        id: nextId("page"),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      pageStore.push(page);
      return { status: "saved", page };
    },
    async listPages(nogId: string, topicId: string) {
      return pageStore
        .filter((p) => p.nogId === nogId && p.topicId === topicId)
        .sort((a, b) => {
          const timeA = Date.parse(a.createdAt);
          const timeB = Date.parse(b.createdAt);
          if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
            return timeA - timeB;
          }
          const isoDiff = a.createdAt.localeCompare(b.createdAt);
          return isoDiff !== 0 ? isoDiff : a.id.localeCompare(b.id);
        });
    },
    async countFollowUps(nogId: string, rootLessonId: string) {
      return pageStore.filter(
        (p) =>
          p.nogId === nogId &&
          p.parentLessonId === rootLessonId &&
          p.kind === "follow_up_answer",
      ).length;
    },
    async countIssuedQuestions(nogId: string, rootLessonId: string) {
      const threadIds = new Set<string>([rootLessonId]);
      for (const page of pageStore) {
        if (
          page.nogId === nogId &&
          page.parentLessonId === rootLessonId &&
          page.kind === "follow_up_answer"
        ) {
          threadIds.add(page.id);
        }
      }
      return messageStore.filter(
        (m) =>
          m.nogId === nogId &&
          m.kind === "question" &&
          m.lessonId !== undefined &&
          m.lessonId !== null &&
          threadIds.has(m.lessonId),
      ).length;
    },
    async applyDigest(input: ApplyDigestInput): Promise<ApplyDigestResult> {
      const digestKey = `${input.nogId}:${input.idempotencyKey}`;
      const existingDigest = appliedDigests.get(digestKey);
      if (existingDigest) {
        return {
          applied: false,
          cardIds: existingDigest.cardIds,
          savedDigest: existingDigest.digest,
        };
      }

      const lesson = pageStore.find(
        (p) => p.id === input.lessonId && p.nogId === input.nogId,
      );
      const topicId = lesson?.topicId ?? "";
      const cardIds: string[] = [];

      const seenEvidence = new Set<string>();
      const recordEvidence = (
        card: ThoughtCardRecord,
        kind: "reinforced" | "merged" | "conflict",
      ) => {
        const key = `${card.id}:${input.lessonId}:${kind}`;
        if (!seenEvidence.has(key)) {
          seenEvidence.add(key);
          card.evidenceCount = (card.evidenceCount ?? 1) + 1;
        }
      };

      for (const op of input.operations) {
        if (op.type === "create") {
          const card: ThoughtCardRecord = {
            id: nextId("card"),
            nogId: input.nogId,
            topicId,
            label: op.label,
            paraphrase: op.paraphrase,
            status: op.status,
            strength: 1,
            intervalDays: 1,
            sourceLessonId: input.lessonId,
            quote: op.quote,
            evidenceCount: 1,
          };
          cardStore.push(card);
          cardIds.push(card.id);
        } else if (op.type === "reinforce") {
          const existing = cardStore.find(
            (c) =>
              c.id === op.cardId &&
              c.nogId === input.nogId &&
              c.topicId === topicId,
          );
          if (existing) {
            existing.strength = (existing.strength ?? 1) + 1;
            if (op.status !== undefined) existing.status = op.status;
            recordEvidence(existing, "reinforced");
            cardIds.push(existing.id);
          }
        } else if (op.type === "update") {
          const existing = cardStore.find(
            (c) =>
              c.id === op.cardId &&
              c.nogId === input.nogId &&
              c.topicId === topicId,
          );
          if (existing) {
            if (op.label !== undefined) existing.label = op.label;
            if (op.paraphrase !== undefined) existing.paraphrase = op.paraphrase;
            if (op.status !== undefined) existing.status = op.status;
            if (op.quote !== undefined) {
              existing.quote = op.quote;
              recordEvidence(existing, "merged");
            }
            cardIds.push(existing.id);
          }
        } else if (op.type === "conflict") {
          const existing = cardStore.find(
            (c) =>
              c.id === op.cardId &&
              c.nogId === input.nogId &&
              c.topicId === topicId,
          );
          if (existing) {
            existing.status = "confused";
            if (op.paraphrase !== undefined) existing.paraphrase = op.paraphrase;
            if (op.quote !== undefined) {
              recordEvidence(existing, "conflict");
            }
            cardIds.push(existing.id);
          }
        }
      }

      for (const msg of input.messages) {
        messageStore.push({
          id: nextId("msg"),
          nogId: input.nogId,
          lessonId: input.lessonId,
          role: msg.role,
          kind: msg.kind,
          body: msg.body,
        });
      }

      const savedDigest: ListenerDigest = input.digest ?? {
        reply:
          input.messages.find((m) => m.role === "nog" && m.kind === "reply")
            ?.body ?? "",
        mood:
          input.messages.find((m) => m.mood !== undefined)?.mood ?? "happy",
        followUpQuestions: input.messages
          .filter((m) => m.role === "nog" && m.kind === "question")
          .map((m) => m.body),
        operations: [...input.operations],
      };

      appliedDigests.set(digestKey, { digest: savedDigest, cardIds });
      return { applied: true, cardIds, savedDigest };
    },
    async findOwnedMessage(userId: string, messageId: string) {
      const message = messageStore.find((m) => m.id === messageId);
      if (!message) {
        return null;
      }
      const owned = nogStore.some(
        (n) => n.id === message.nogId && n.ownerId === userId,
      );
      return owned ? message : null;
    },
  };

  const thoughtCards: ThoughtCardRepository = {
    async listByTopic(nogId: string, topicId: string) {
      return cardStore.filter((c) => c.nogId === nogId && c.topicId === topicId);
    },
    async listByNog(nogId: string) {
      return cardStore.filter((c) => c.nogId === nogId);
    },
    async reviewCard(input: ReviewThoughtCardInput) {
      const owned = nogStore.some(
        (n) => n.id === input.nogId && n.ownerId === input.ownerId,
      );
      if (!owned) {
        return null;
      }

      const card = cardStore.find(
        (c) => c.id === input.cardId && c.nogId === input.nogId,
      );
      if (!card) {
        return null;
      }

      const nowDate = input.now ?? clock.now();
      const dayMs = 24 * 60 * 60 * 1000;

      if (input.outcome === "remembered") {
        const nextInterval = nextReviewIntervalDays(
          card.intervalDays ?? 1,
          true,
        );
        card.strength = (card.strength ?? 1) + 1;
        card.intervalDays = nextInterval;
        card.nextReviewAt = new Date(
          nowDate.getTime() + nextInterval * dayMs,
        ).toISOString();
      } else {
        const nextInterval = nextReviewIntervalDays(
          card.intervalDays ?? 1,
          false,
        );
        card.status = "shaky";
        card.intervalDays = nextInterval;
        card.nextReviewAt = new Date(
          nowDate.getTime() + nextInterval * dayMs,
        ).toISOString();
      }

      return { ...card };
    },
  };

  const questions: QuestionBank = {
    async listByTopic(topicId: string) {
      return questionStore.filter((q) => q.topicId === topicId);
    },
  };

  function recomputeStageForNog(nogId: string): NogStageSlug {
    const nogAttempts = attemptStore.filter((a) => a.nogId === nogId);
    const mastered = trainingMeter(
      nogAttempts.map((a) => ({
        questionId: a.questionId,
        attemptedAt: a.createdAt,
        correct: a.correct,
      })),
    );

    const byTopic = new Map<
      string,
      Array<{ questionId: string; attemptedAt: string; correct: boolean }>
    >();
    for (const attempt of nogAttempts) {
      const questionTopic =
        attempt.topicId ??
        questionStore.find((q) => q.id === attempt.questionId)?.topicId ??
        "__default__";
      const list = byTopic.get(questionTopic) ?? [];
      list.push({
        questionId: attempt.questionId,
        attemptedAt: attempt.createdAt,
        correct: attempt.correct,
      });
      byTopic.set(questionTopic, list);
    }

    const topicRatios: number[] = [];
    for (const [topicKey, list] of byTopic.entries()) {
      const bankCount = questionStore.filter(
        (q) => q.topicId === topicKey,
      ).length;
      const distinctCount = new Set(list.map((a) => a.questionId)).size;
      const denominator = Math.max(bankCount, distinctCount);
      if (denominator > 0) {
        topicRatios.push(trainingMeter(list) / denominator);
      }
    }

    return growthStage(mastered, topicRatios).toLowerCase() as NogStageSlug;
  }

  const attempts: AttemptRepository = {
    async findLatest(nogId: string, topicId: string) {
      const topicQuestionIds = new Set(
        questionStore.filter((q) => q.topicId === topicId).map((q) => q.id),
      );
      const latestByQuestion = new Map<string, CheckAttemptRecord>();
      for (const attempt of attemptStore) {
        if (attempt.nogId !== nogId) continue;
        if (
          attempt.topicId !== undefined &&
          attempt.topicId !== topicId
        ) {
          continue;
        }
        if (
          attempt.topicId === undefined &&
          topicQuestionIds.size > 0 &&
          !topicQuestionIds.has(attempt.questionId)
        ) {
          continue;
        }
        latestByQuestion.set(attempt.questionId, attempt);
      }
      return Array.from(latestByQuestion.values());
    },
    async recordCheck(input: RecordCheckInput) {
      const nowIso = clock.now().toISOString();
      const recorded: CheckAttemptRecord[] = input.attempts.map((draft) => ({
        ...draft,
        id: nextId("attempt"),
        nogId: input.nogId,
        topicId: input.topicId,
        createdAt: nowIso,
      }));
      attemptStore.push(...recorded);

      if (input.cardUpdates) {
        for (const update of input.cardUpdates) {
          const card = cardStore.find(
            (c) => c.id === update.cardId && c.nogId === input.nogId,
          );
          if (card) {
            card.strength = update.strength;
            card.status = update.status;
            card.intervalDays = update.intervalDays;
            card.nextReviewAt = update.nextReviewAt;
          }
        }
      }

      const targetNog = nogStore.find((n) => n.id === input.nogId);
      if (targetNog) {
        targetNog.stage = input.stage ?? recomputeStageForNog(input.nogId);
      }

      return recorded;
    },
    async findOwned(
      userId: string,
      attemptId: string,
    ): Promise<OwnedCheckAttempt | null> {
      const attempt = attemptStore.find((a) => a.id === attemptId);
      if (!attempt) {
        return null;
      }
      const owned = nogStore.some(
        (n) => n.id === attempt.nogId && n.ownerId === userId,
      );
      return owned
        ? { id: attempt.id, nogId: attempt.nogId, nogAnswer: attempt.nogAnswer }
        : null;
    },
    async listByNog(nogId: string) {
      return attemptStore
        .filter((a) => a.nogId === nogId)
        .map((attempt) => {
          if (attempt.prompt !== undefined) {
            return attempt;
          }
          const prompt = questionStore.find(
            (q) => q.id === attempt.questionId,
          )?.prompt;
          return prompt !== undefined ? { ...attempt, prompt } : attempt;
        });
    },
    async withCheckReservation<T>(
      key: CheckReservationKey,
      work: () => Promise<T>,
    ): Promise<T> {
      const queueKey = key.nogId;
      const previous = reservationQueues.get(queueKey) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const chained = previous.then(() => current);
      reservationQueues.set(queueKey, chained);

      await previous;
      try {
        return await work();
      } finally {
        release();
        if (reservationQueues.get(queueKey) === chained) {
          reservationQueues.delete(queueKey);
        }
      }
    },
  };

  const usage: UsageRepository = {
    async consumeQuota(
      userId: string,
      kind: UsageKind,
      amount: number,
    ): Promise<QuotaResult> {
      const key = `${userId}:${kind}`;
      const cap = caps[kind];
      const used = usageCounts.get(key) ?? 0;
      if (used + amount > cap) {
        return { allowed: false, used, cap };
      }
      const nextUsed = used + amount;
      usageCounts.set(key, nextUsed);
      return { allowed: true, used: nextUsed, cap };
    },
  };

  const listener: NogListener = {
    async listen() {
      return (
        options.listenerDigest ?? {
          reply: "Got it!",
          mood: "happy",
          followUpQuestions: [],
          operations: [],
        }
      );
    },
  };

  const brain: NogBrain = {
    async answer({ pages, cards, questions: asked }): Promise<BrainAnswerResult> {
      const cardNotes = cards.map((card) => `${card.label}: ${card.paraphrase}`);
      const pageNotes = pages.map((page) => page.body.trim()).filter(Boolean);
      const summary =
        cardNotes.length > 0
          ? cardNotes.join(" ")
          : pageNotes.join(" ") || "I am not sure yet.";

      return {
        answers: asked.map((q) => ({
          questionId: q.id,
          nogAnswer: summary,
        })),
        model: "in-memory-fake",
      };
    },
  };

  const grader: AnswerGrader = {
    async grade({ pages, questions: asked, answers }): Promise<GraderResult> {
      const answerMap = new Map(
        answers.map((entry) => [entry.questionId, entry.nogAnswer.toLowerCase()]),
      );
      const pageText = pages.map((p) => p.body.toLowerCase()).join(" ");

      return {
        grades: asked.map((q) => {
          const answerText = answerMap.get(q.id) ?? "";
          const referenceText = `${q.referenceAnswer} ${q.sourceExcerpt}`.toLowerCase();
          return {
            questionId: q.id,
            concepts: q.keyConcepts.map((concept) => {
              const needle = concept.toLowerCase();
              return {
                concept,
                inAnswer: answerText.includes(needle),
                inPages: pageText.includes(needle),
                consistentWithReference: referenceText.includes(needle),
              };
            }),
          };
        }),
      };
    },
  };

  const questionWriter: QuestionWriter = {
    async generate(
      input: GenerateQuestionsInput,
    ): Promise<GeneratedQuestionDraft[]> {
      if (options.generatedQuestions) {
        return options.generatedQuestions.map((draft) => ({
          ...draft,
          keyConcepts: [...draft.keyConcepts],
        }));
      }
      return Array.from({ length: 8 }, (_, index) => ({
        position: index + 1,
        prompt: `What core idea about ${input.topicTitle} is tested in question ${index + 1}?`,
        referenceAnswer: `${input.topicTitle} in ${input.subjectName} covers concept ${index + 1}.`,
        sourceExcerpt: `Study note ${index + 1} for ${input.topicTitle} in ${input.subjectName}.`,
        keyConcepts: [`${input.topicTitle} concept ${index + 1}`, input.subjectName],
      }));
    },
  };

  const speechToText: SpeechToText = {
    async transcribe() {
      return { text: options.transcript ?? "" };
    },
  };

  const textToSpeech: TextToSpeech = {
    async speak() {
      return (
        options.audio ?? {
          audio: new Uint8Array([1, 2, 3]),
          mimeType: "audio/mpeg",
        }
      );
    },
  };

  const voiceCache: VoiceCacheRepository = {
    async get(key: string) {
      return voiceCacheStore.get(key) ?? null;
    },
    async put(key: string, audio: SynthesizedAudio) {
      voiceCacheStore.set(key, audio);
    },
  };

  const profiles: ProfileRepository = {
    async getSettings(userId: string) {
      const stored = profileSettingsStore.get(userId);
      return stored ? { ...stored } : null;
    },
    async saveSettings(userId: string, settings: ProfileSettings) {
      const next: ProfileSettings = { ...settings };
      profileSettingsStore.set(userId, next);
      return { ...next };
    },
    async updateDisplayName(userId: string, displayName: string) {
      const trimmed = displayName.trim();
      displayNameStore.set(userId, trimmed);
      return trimmed;
    },
  };

  const masteryStore = (options.mastery ?? []).map((row) => ({ ...row }));
  const activityStore = (options.activity ?? []).map((event) => ({ ...event }));
  const displayNameStore = new Map<string, string>(
    Object.entries(options.displayNames ?? {}),
  );

  const progress: ProgressRepository = {
    async listMastery(ownerId: string): Promise<TopicMasteryRow[]> {
      const ownedNogs = nogStore.filter((n) => n.ownerId === ownerId);
      const ownedNogIds = new Set(ownedNogs.map((n) => n.id));
      if (ownedNogIds.size === 0) {
        return [];
      }

      if (options.mastery !== undefined) {
        return masteryStore
          .filter((row) => ownedNogIds.has(row.nogId))
          .map((row) => ({ ...row }));
      }

      const rows: TopicMasteryRow[] = [];
      for (const nog of ownedNogs) {
        const nogTopics = topicStore.filter(
          (t) =>
            t.subjectId === nog.subjectId &&
            (t.ownerId === null || t.ownerId === ownerId),
        );
        for (const topic of nogTopics) {
          const topicQuestions = questionStore.filter(
            (q) => q.topicId === topic.id,
          );
          const total =
            topicQuestions.length > 0
              ? topicQuestions.length
              : topic.questionCount;
          const topicQuestionIds = new Set(topicQuestions.map((q) => q.id));
          const relevantAttempts = attemptStore.filter(
            (a) =>
              a.nogId === nog.id &&
              (a.topicId === topic.id || topicQuestionIds.has(a.questionId)),
          );
          const mastered = trainingMeter(
            relevantAttempts.map((a) => ({
              questionId: a.questionId,
              attemptedAt: a.createdAt,
              correct: a.correct,
            })),
          );
          rows.push({
            nogId: nog.id,
            topicId: topic.id,
            topicName: topic.title,
            mastered,
            total,
          });
        }
      }
      return rows;
    },
  };

  const activity: ActivityRepository = {
    async listRecent(
      ownerId: string,
      limit = 30,
    ): Promise<ActivityEvent[]> {
      const ownedNogs = nogStore.filter((n) => n.ownerId === ownerId);
      const ownedNogMap = new Map(ownedNogs.map((n) => [n.id, n]));
      if (ownedNogMap.size === 0) {
        return [];
      }

      if (options.activity !== undefined) {
        return activityStore
          .filter((event) => ownedNogMap.has(event.nogId))
          .map((event) => ({ ...event }))
          .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
          .slice(0, limit);
      }

      const topicMap = new Map(topicStore.map((t) => [t.id, t.title]));
      const questionTopicMap = new Map(
        questionStore.map((q) => [q.id, q.topicId]),
      );

      const events: ActivityEvent[] = [];

      for (const page of pageStore) {
        const nog = ownedNogMap.get(page.nogId);
        if (!nog) continue;
        events.push({
          kind: "lesson",
          id: page.id,
          nogId: nog.id,
          nogName: nog.name,
          topicName: topicMap.get(page.topicId) ?? "Topic",
          at: page.createdAt,
          followUp: page.kind === "follow_up_answer",
        });
      }

      const checkGroups = new Map<
        string,
        {
          id: string;
          nogId: string;
          nogName: string;
          topicName: string;
          at: string;
          correct: number;
          total: number;
        }
      >();

      for (const attempt of attemptStore) {
        const nog = ownedNogMap.get(attempt.nogId);
        if (!nog) continue;
        const resolvedTopicId =
          attempt.topicId ?? questionTopicMap.get(attempt.questionId) ?? "";
        const groupKey = `${attempt.nogId}:${resolvedTopicId}:${attempt.createdAt}`;
        const existing = checkGroups.get(groupKey);
        if (existing) {
          existing.total += 1;
          if (attempt.correct) {
            existing.correct += 1;
          }
        } else {
          checkGroups.set(groupKey, {
            id: attempt.id,
            nogId: nog.id,
            nogName: nog.name,
            topicName: topicMap.get(resolvedTopicId) ?? "Topic",
            at: attempt.createdAt,
            correct: attempt.correct ? 1 : 0,
            total: 1,
          });
        }
      }

      for (const group of checkGroups.values()) {
        events.push({
          kind: "check",
          ...group,
        });
      }

      return events
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, limit);
    },
  };

  return {
    deps: {
      currentUser,
      clock,
      getFeatures: async () => ({ ...(options.features ?? {}) }),
      profiles,
      progress,
      activity,
      subjects,
      topics: options.topics !== undefined ? topics : undefined,
      nogs,
      notebook,
      thoughtCards,
      questions,
      attempts,
      usage,
      listener,
      brain,
      grader,
      questionWriter,
      speechToText,
      textToSpeech,
      voiceCache,
    },
    stores: {
      profiles: profileSettingsStore,
      displayNames: displayNameStore,
      mastery: masteryStore,
      activity: activityStore,
      subjects: subjectStore,
      topics: topicStore,
      nogs: nogStore,
      pages: pageStore,
      cards: cardStore,
      messages: messageStore,
      questions: questionStore,
      attempts: attemptStore,
      voiceCache: voiceCacheStore,
    },
    setUser(userId: string | null) {
      currentUserId = userId ?? "";
    },
    setNow(date: Date) {
      currentNow = date;
    },
  };
}
