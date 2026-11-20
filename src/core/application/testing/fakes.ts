import type {
  AnswerGrader,
  ApplyDigestInput,
  ApplyDigestResult,
  AttemptRepository,
  BrainAnswerResult,
  CheckAttemptRecord,
  Clock,
  CreateNogInput,
  CurrentUser,
  GraderResult,
  LessonPage,
  ListenerDigest,
  NewPageInput,
  NogBrain,
  NogListener,
  NogRecord,
  NogRepository,
  NotebookRepository,
  OwnedCheckAttempt,
  OwnedMessage,
  QuestionBank,
  QuestionRecord,
  QuotaResult,
  RecordCheckInput,
  SpeechToText,
  SynthesizedAudio,
  TextToSpeech,
  ThoughtCardRecord,
  ThoughtCardRepository,
  UpdatePettingInput,
  UsageKind,
  UsageRepository,
  VoiceCacheRepository,
} from "../ports";

export interface InMemoryPortsOptions {
  userId?: string | null;
  now?: Date;
  caps?: Partial<Record<UsageKind, number>>;
  nogs?: NogRecord[];
  pages?: LessonPage[];
  cards?: ThoughtCardRecord[];
  messages?: OwnedMessage[];
  questions?: QuestionRecord[];
  attempts?: CheckAttemptRecord[];
  listenerDigest?: ListenerDigest;
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
};

export function createInMemoryPorts(options: InMemoryPortsOptions = {}) {
  let currentUserId = options.userId ?? "student-1";
  let currentNow = options.now ?? new Date("2026-11-21T03:00:00.000Z");

  const nogStore = [...(options.nogs ?? [])];
  const pageStore = [...(options.pages ?? [])];
  const cardStore = [...(options.cards ?? [])];
  const messageStore = [...(options.messages ?? [])];
  const questionStore = [...(options.questions ?? [])];
  const attemptStore = [...(options.attempts ?? [])];
  const usageCounts = new Map<string, number>();
  const voiceCacheStore = new Map<string, SynthesizedAudio>();
  const appliedDigests = new Set<string>();
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
  };

  const notebook: NotebookRepository = {
    async savePage(input: NewPageInput) {
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
    async listPages(nogId: string, topicId: string) {
      return pageStore.filter((p) => p.nogId === nogId && p.topicId === topicId);
    },
    async countFollowUps(nogId: string, rootLessonId: string) {
      return pageStore.filter(
        (p) =>
          p.nogId === nogId &&
          p.parentLessonId === rootLessonId &&
          p.kind === "follow_up_answer",
      ).length;
    },
    async applyDigest(input: ApplyDigestInput): Promise<ApplyDigestResult> {
      const digestKey = `${input.nogId}:${input.idempotencyKey}`;
      if (appliedDigests.has(digestKey)) {
        return { applied: false, cardIds: [] };
      }

      const lesson = pageStore.find(
        (p) => p.id === input.lessonId && p.nogId === input.nogId,
      );
      const topicId = lesson?.topicId ?? "";
      const cardIds: string[] = [];

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
          };
          cardStore.push(card);
          cardIds.push(card.id);
        } else if (op.type === "update") {
          const existing = cardStore.find(
            (c) => c.id === op.cardId && c.nogId === input.nogId,
          );
          if (existing) {
            if (op.label !== undefined) existing.label = op.label;
            if (op.paraphrase !== undefined) existing.paraphrase = op.paraphrase;
            if (op.status !== undefined) existing.status = op.status;
            if (op.quote !== undefined) existing.quote = op.quote;
            cardIds.push(existing.id);
          }
        } else if (op.type === "conflict") {
          const existing = cardStore.find(
            (c) => c.id === op.cardId && c.nogId === input.nogId,
          );
          if (existing) {
            existing.status = "confused";
            if (op.paraphrase !== undefined) existing.paraphrase = op.paraphrase;
            cardIds.push(existing.id);
          }
        }
      }

      for (const msg of input.messages) {
        messageStore.push({
          id: nextId("msg"),
          nogId: input.nogId,
          role: msg.role,
          kind: msg.kind,
          body: msg.body,
        });
      }

      appliedDigests.add(digestKey);
      return { applied: true, cardIds };
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
  };

  const questions: QuestionBank = {
    async listByTopic(topicId: string) {
      return questionStore.filter((q) => q.topicId === topicId);
    },
  };

  const attempts: AttemptRepository = {
    async findLatest(nogId: string, topicId: string) {
      const topicQuestionIds = new Set(
        questionStore.filter((q) => q.topicId === topicId).map((q) => q.id),
      );
      const latestByQuestion = new Map<string, CheckAttemptRecord>();
      for (const attempt of attemptStore) {
        if (attempt.nogId !== nogId) continue;
        if (
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
        createdAt: nowIso,
      }));
      attemptStore.push(...recorded);
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
      return attemptStore.filter((a) => a.nogId === nogId);
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
    async answer({ questions: asked }): Promise<BrainAnswerResult> {
      return {
        answers: asked.map((q) => ({
          questionId: q.id,
          nogAnswer: q.referenceAnswer,
        })),
        model: "in-memory-fake",
      };
    },
  };

  const grader: AnswerGrader = {
    async grade({ questions: asked }): Promise<GraderResult> {
      return {
        grades: asked.map((q) => ({
          questionId: q.id,
          concepts: q.keyConcepts.map((concept) => ({
            concept,
            inAnswer: true,
            inPages: true,
            consistentWithReference: true,
          })),
        })),
      };
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

  return {
    deps: {
      currentUser,
      clock,
      nogs,
      notebook,
      thoughtCards,
      questions,
      attempts,
      usage,
      listener,
      brain,
      grader,
      speechToText,
      textToSpeech,
      voiceCache,
    },
    stores: {
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
