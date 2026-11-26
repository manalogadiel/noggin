import type { ConceptCheck } from "../domain/quiz";
import type { ThoughtCardStatus } from "../domain/thought-card";

export type NogStageSlug = "hatchling" | "sprout" | "scholar" | "genius";

export type UsageKind =
  | "listener"
  | "answer"
  | "grade"
  | "stt_seconds"
  | "tts_chars"
  | "pet"
  | "generate"
  | "ask";

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
}

export interface CurrentUser {
  get(): Promise<AuthenticatedUser | null>;
}

export type GrillMode = "roast" | "gentle";
export type MicMode = "tap" | "hold";

export interface ProfileSettings {
  grillMode: GrillMode;
  micMode: MicMode;
  voiceEnabled: boolean;
  soundsEnabled: boolean;
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  grillMode: "roast",
  micMode: "tap",
  voiceEnabled: true,
  soundsEnabled: true,
};

export interface ProfileRepository {
  getSettings(userId: string): Promise<ProfileSettings | null>;
  saveSettings(
    userId: string,
    settings: ProfileSettings,
  ): Promise<ProfileSettings>;
  updateDisplayName(userId: string, displayName: string): Promise<string>;
}

export interface TopicMasteryRow {
  nogId: string;
  topicId: string;
  topicName: string;
  mastered: number;
  total: number;
}

export interface ProgressRepository {
  listMastery(ownerId: string): Promise<TopicMasteryRow[]>;
}

export type ActivityEvent =
  | {
      kind: "lesson";
      id: string;
      nogId: string;
      nogName: string;
      topicName: string;
      at: string;
      followUp: boolean;
    }
  | {
      kind: "check";
      id: string;
      nogId: string;
      nogName: string;
      topicName: string;
      at: string;
      correct: number;
      total: number;
    };

export interface ActivityRepository {
  listRecent(ownerId: string, limit?: number): Promise<ActivityEvent[]>;
}

export interface Clock {
  now(): Date;
}

export interface NogColors {
  body?: string | null;
}

export interface NogRecord {
  id: string;
  ownerId: string;
  subjectId: string;
  subjectName?: string;
  name: string;
  stage: NogStageSlug;
  mood?: string;
  happiness?: number;
  happinessToday?: number;
  happinessDay?: string | null;
  vitality?: number;
  colors?: NogColors;
  restUntil?: string | null;
}

export interface SubjectRecord {
  id: string;
  ownerId: string | null;
  slug: string;
  name: string;
  available: boolean;
}

export interface CreateUserSubjectInput {
  ownerId: string;
  name: string;
  slug: string;
}

export interface SubjectRepository {
  findById(subjectId: string): Promise<SubjectRecord | null>;
  findBySlug(
    slug: string,
    ownerId?: string | null,
  ): Promise<SubjectRecord | null>;
  listAccessible(ownerId: string): Promise<SubjectRecord[]>;
  createUserSubject(input: CreateUserSubjectInput): Promise<SubjectRecord>;
}

export type TopicStatus = "ready" | "pending";

export interface TopicSummary {
  id: string;
  subjectId: string;
  slug: string;
  title: string;
  status: TopicStatus;
  questionCount: number;
}

export interface TopicRecord extends TopicSummary {
  ownerId: string | null;
}

export interface CreateUserTopicInput {
  ownerId: string;
  subjectId: string;
  title: string;
  slug: string;
}

export interface GeneratedQuestionDraft {
  position: number;
  prompt: string;
  referenceAnswer: string;
  sourceExcerpt: string;
  keyConcepts: string[];
}

export interface SaveGeneratedQuestionsInput {
  ownerId: string;
  topicId: string;
  questions: GeneratedQuestionDraft[];
}

export interface TopicRepository {
  findById(topicId: string): Promise<TopicRecord | null>;
  findBySubjectAndSlug(
    subjectId: string,
    slug: string,
    ownerId?: string | null,
  ): Promise<TopicRecord | null>;
  listBySubject(subjectId: string): Promise<TopicRecord[]>;
  createUserTopic(input: CreateUserTopicInput): Promise<TopicRecord>;
  saveGeneratedQuestions(
    input: SaveGeneratedQuestionsInput,
  ): Promise<TopicRecord>;
}

export interface CreateNogInput {
  ownerId: string;
  subjectId: string;
  name: string;
}

export interface UpdatePettingInput {
  nogId: string;
  happiness: number;
  happinessToday: number;
  happinessDay: string;
}

export interface NogRepository {
  findOwned(userId: string, nogId: string): Promise<NogRecord | null>;
  listByOwner(userId: string): Promise<NogRecord[]>;
  findByOwnerAndSubject(
    userId: string,
    subjectId: string,
  ): Promise<NogRecord | null>;
  create(input: CreateNogInput): Promise<NogRecord>;
  updatePetting(input: UpdatePettingInput): Promise<NogRecord>;
  updateColors?(
    ownerId: string,
    nogId: string,
    colors: NogColors,
  ): Promise<NogRecord | null>;
  updateCustomization?(
    ownerId: string,
    nogId: string,
    patch: { colors: NogColors; name?: string },
  ): Promise<NogRecord | null>;
  setRest(
    ownerId: string,
    nogId: string,
    restUntil: string | null,
  ): Promise<NogRecord | null>;
}

export type LessonKind = "lesson" | "follow_up_answer";

export interface NewPageInput {
  nogId: string;
  topicId: string;
  body: string;
  wordCount: number;
  kind: LessonKind;
  parentLessonId?: string | null;
  idempotencyKey: string;
}

export interface LessonPage extends NewPageInput {
  id: string;
  parentLessonId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveFollowUpPageResult =
  | { status: "saved" | "existing"; page: LessonPage }
  | { status: "limit_reached" }
  | { status: "conflict" };

export type DigestOperation =
  | {
      type: "create";
      label: string;
      paraphrase: string;
      status: ThoughtCardStatus;
      quote: string;
    }
  | {
      type: "update";
      cardId: string;
      label?: string;
      paraphrase?: string;
      status?: ThoughtCardStatus;
      quote?: string;
    }
  | {
      type: "conflict";
      cardId: string;
      paraphrase?: string;
      quote?: string;
    }
  | {
      type: "reinforce";
      cardId: string;
      quote: string;
      status?: ThoughtCardStatus;
    };

export interface DigestMessageInput {
  role: "nog" | "student";
  kind: "reply" | "question" | "answer" | "reaction";
  body: string;
  mood?: string;
}

export interface ApplyDigestInput {
  nogId: string;
  lessonId: string;
  idempotencyKey: string;
  operations: DigestOperation[];
  messages: DigestMessageInput[];
  digest?: ListenerDigest;
}

export interface ApplyDigestResult {
  applied: boolean;
  cardIds: string[];
  savedDigest?: ListenerDigest;
  replyMessageId?: string;
  followUpMessageIds?: string[];
}

export interface SavedDigestRecord {
  digest: ListenerDigest;
  cardIds: string[];
  replyMessageId?: string;
  followUpMessageIds?: string[];
}

export interface OwnedMessage {
  id: string;
  nogId: string;
  lessonId?: string | null;
  role: "nog" | "student";
  kind: "reply" | "question" | "answer" | "reaction" | "ask" | "ask_answer";
  body: string;
}

export interface NotebookRepository {
  savePage(input: NewPageInput): Promise<LessonPage>;
  saveFollowUpPage(
    input: NewPageInput & { parentLessonId: string; maxFollowUps: number },
  ): Promise<SaveFollowUpPageResult>;
  findPage(nogId: string, lessonId: string): Promise<LessonPage | null>;
  findPageByIdempotencyKey?(
    nogId: string,
    idempotencyKey: string,
  ): Promise<LessonPage | null>;
  findSavedDigest?(
    nogId: string,
    idempotencyKey: string,
  ): Promise<SavedDigestRecord | null>;
  listPages(nogId: string, topicId: string): Promise<LessonPage[]>;
  countFollowUps(nogId: string, rootLessonId: string): Promise<number>;
  countIssuedQuestions?(nogId: string, rootLessonId: string): Promise<number>;
  applyDigest(input: ApplyDigestInput): Promise<ApplyDigestResult>;
  findOwnedMessage(
    userId: string,
    messageId: string,
  ): Promise<OwnedMessage | null>;
  findPagesByIds?(nogId: string, lessonIds: string[]): Promise<LessonPage[]>;
}

export interface ThoughtCardRecord {
  id: string;
  nogId: string;
  topicId: string;
  label: string;
  paraphrase: string;
  status: ThoughtCardStatus;
  strength?: number;
  intervalDays?: number;
  nextReviewAt?: Date | string;
  sourceLessonId?: string;
  quote?: string;
  evidenceCount?: number;
  score?: number;
}

export type CardReviewOutcome = "remembered" | "forgot";

export interface ReviewThoughtCardInput {
  ownerId: string;
  nogId: string;
  cardId: string;
  outcome: CardReviewOutcome;
  now?: Date;
}

export interface ThoughtCardRepository {
  listByTopic(nogId: string, topicId: string): Promise<ThoughtCardRecord[]>;
  listByNog?(nogId: string): Promise<ThoughtCardRecord[]>;
  reviewCard?(input: ReviewThoughtCardInput): Promise<ThoughtCardRecord | null>;
  search?(
    nogId: string,
    topicId: string | null,
    query: string,
    limit: number,
  ): Promise<ThoughtCardRecord[]>;
  listEvidenceLessonIds?(cardIds: string[]): Promise<CardEvidenceLink[]>;
}

export interface CardEvidenceLink {
  cardId: string;
  lessonId: string;
}

export interface AskInput {
  nogId: string;
  question: string;
  cards: ThoughtCardRecord[];
  pages: LessonPage[];
}

export interface AskOutput {
  answer: string;
  mood: string;
  knows: boolean;
  citedCardIds: string[];
}

export interface NogAsker {
  ask(input: AskInput): Promise<AskOutput>;
}

export interface SaveAskExchangeInput {
  ownerId: string;
  nogId: string;
  question: string;
  answer: string;
  mood: string;
}

export interface SavedAskExchange {
  questionMessageId: string;
  answerMessageId: string;
}

export interface AskExchangeRecord extends SavedAskExchange {
  nogId: string;
  question: string;
  answer: string;
  mood: string | null;
  createdAt: string;
}

export interface AskHistoryRepository {
  save(input: SaveAskExchangeInput): Promise<SavedAskExchange>;
  listRecent(
    ownerId: string,
    nogId: string,
    limit: number,
  ): Promise<AskExchangeRecord[]>;
}

export interface AnswerQuestionPrompt {
  id: string;
  prompt: string;
}

export interface QuestionRecord extends AnswerQuestionPrompt {
  topicId: string;
  referenceAnswer: string;
  sourceExcerpt: string;
  keyConcepts: string[];
}

export interface QuestionBank {
  listByTopic(topicId: string): Promise<QuestionRecord[]>;
}

export interface GradedConcept extends ConceptCheck {
  concept: string;
}

export interface CheckAttemptDraft {
  questionId: string;
  nogAnswer: string;
  concepts: GradedConcept[];
  correct: boolean;
  notebookFingerprint: string;
}

export interface CheckAttemptRecord extends CheckAttemptDraft {
  id: string;
  nogId: string;
  topicId?: string;
  prompt?: string;
  createdAt: string;
}

export interface QuickCheckAttempt extends CheckAttemptRecord {
  prompt: string;
}

export interface CardCheckUpdate {
  cardId: string;
  strength: number;
  status: ThoughtCardStatus;
  intervalDays: number;
  nextReviewAt: string;
}

export interface RecordCheckInput {
  nogId: string;
  topicId: string;
  attempts: CheckAttemptDraft[];
  cardUpdates?: CardCheckUpdate[];
  topicQuestionCount?: number;
  model?: string;
  stage?: NogStageSlug;
}

export interface CheckReservationKey {
  nogId: string;
}

export interface OwnedCheckAttempt {
  id: string;
  nogId: string;
  nogAnswer: string;
}

export interface AttemptRepository {
  findLatest(nogId: string, topicId: string): Promise<CheckAttemptRecord[]>;
  recordCheck(input: RecordCheckInput): Promise<CheckAttemptRecord[]>;
  findOwned(
    userId: string,
    attemptId: string,
  ): Promise<OwnedCheckAttempt | null>;
  listByNog?(nogId: string): Promise<CheckAttemptRecord[]>;
  withCheckReservation?<T>(
    key: CheckReservationKey,
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  cap: number;
}

export interface UsageRepository {
  consumeQuota(
    userId: string,
    kind: UsageKind,
    amount: number,
  ): Promise<QuotaResult>;
}

export interface ListenContext {
  nogQuestion?: string;
  rootLesson?: string;
}

export interface ListenInput {
  nogId: string;
  topicId: string;
  topicTitle?: string;
  page: LessonPage;
  existingCards: ThoughtCardRecord[];
  context?: ListenContext;
}

export interface ListenerDigest {
  reply: string;
  mood: string;
  followUpQuestions: string[];
  operations: DigestOperation[];
  offTopic?: boolean;
}

export interface NogListener {
  listen(input: ListenInput): Promise<ListenerDigest>;
}

export interface AnswerInput {
  nogId: string;
  topicId: string;
  pages: LessonPage[];
  cards: ThoughtCardRecord[];
  questions: AnswerQuestionPrompt[];
}

export interface BrainAnswerItem {
  questionId: string;
  nogAnswer: string;
}

export interface BrainAnswerResult {
  answers: BrainAnswerItem[];
  model?: string;
}

export interface NogBrain {
  answer(input: AnswerInput): Promise<BrainAnswerResult>;
}

export interface GradeCardEvidence {
  label: string;
  paraphrase: string;
  quote?: string;
}

export interface GradeInput {
  topicId: string;
  pages: LessonPage[];
  cards?: GradeCardEvidence[];
  questions: QuestionRecord[];
  answers: BrainAnswerItem[];
}

export interface QuestionGradeItem {
  questionId: string;
  concepts: GradedConcept[];
}

export interface GraderResult {
  grades: QuestionGradeItem[];
}

export interface AnswerGrader {
  grade(input: GradeInput): Promise<GraderResult>;
}

export interface GenerateQuestionsInput {
  subjectName: string;
  topicTitle: string;
}

export interface QuestionWriter {
  generate(input: GenerateQuestionsInput): Promise<GeneratedQuestionDraft[]>;
}

export interface TranscribeInput {
  audio: Uint8Array;
  mimeType: string;
  durationSeconds: number;
  hint?: string;
}

export interface SpeechToText {
  transcribe(input: TranscribeInput): Promise<{ text: string }>;
}

export interface SpeakInput {
  text: string;
}

export interface SynthesizedAudio {
  audio: Uint8Array;
  mimeType: string;
}

export interface TextToSpeech {
  speak(input: SpeakInput): Promise<SynthesizedAudio>;
}

export interface VoiceCacheRepository {
  get(key: string): Promise<SynthesizedAudio | null>;
  put(key: string, audio: SynthesizedAudio): Promise<void>;
}

export type {
  AudioPrefs,
  BookCoverStyle,
  CoinLedgerEntry,
  NotebookBookPrefs,
  PlayerEconomyState,
  RoomBgId,
  ShopItemKind,
  SkinPackId,
} from "../domain/economy";

import type {
  AudioPrefs,
  CoinLedgerEntry,
  NotebookBookPrefs,
  PlayerEconomyState,
  RoomBgId,
  SkinPackId,
} from "../domain/economy";

export type EconomyPreferencesPatch = Partial<{
  activeRoomBg: RoomBgId;
  activeSkinPack: SkinPackId;
  equippedSlots: (string | null)[];
  notebookPrefs: Record<string, NotebookBookPrefs>;
  audioPrefs: AudioPrefs;
  streakRestores: number;
  streakMissedDays: number;
  streakDays: number;
  lastStudyDate: string | null;
}>;

export type EconomyStatePatch = EconomyPreferencesPatch &
  Partial<{
    level: number;
    xp: number;
    xpMax: number;
    ownedRooms: Record<RoomBgId, boolean>;
    ownedSkinPacks: Record<SkinPackId, boolean>;
    ownedAccessories: Record<string, boolean>;
    claimedTasks: Record<string, boolean>;
  }>;

export interface EconomyTransactionInput {
  delta: number;
  reason: string;
  itemRef?: string | null;
  patch?: EconomyStatePatch;
}

export interface EconomyRepository {
  getOrInit(userId: string): Promise<PlayerEconomyState>;
  applyTransaction(
    userId: string,
    input: EconomyTransactionInput,
  ): Promise<PlayerEconomyState>;
  savePreferences(
    userId: string,
    patch: EconomyPreferencesPatch,
  ): Promise<PlayerEconomyState>;
  listLedger(userId: string, limit?: number): Promise<CoinLedgerEntry[]>;
}

export type {
  BillingInterval,
  BillingOrder,
  BillingOrderStatus,
  BillingSummary,
  SalesProduct,
  SalesProductCode,
  SalesProductKind,
  SubscriptionRecord,
  SubscriptionStatus,
} from "../domain/billing";

import type {
  BillingOrder,
  SalesProduct,
  SalesProductCode,
  SubscriptionRecord,
} from "../domain/billing";

export interface PaymentIntentResult {
  provider: string;
  providerRef: string;
  checkoutUrl?: string | null;
  requiresRedirect?: boolean;
}

export interface PaymentGateway {
  readonly providerName: string;
  authorizePurchase(input: {
    userId: string;
    product: SalesProduct;
    idempotencyKey: string;
    orderId?: string;
  }): Promise<PaymentIntentResult>;
}

export interface BillingRepository {
  listProducts(): Promise<SalesProduct[]>;
  getActiveSubscription(userId: string): Promise<SubscriptionRecord | null>;
  listOrders(userId: string, limit?: number): Promise<BillingOrder[]>;
  createOrder(input: {
    userId: string;
    productCode: SalesProductCode;
    idempotencyKey: string;
    provider: string;
  }): Promise<BillingOrder>;
  attachProviderRef(input: {
    userId: string;
    orderId: string;
    providerRef: string;
  }): Promise<BillingOrder>;
  fulfillOrder(input: {
    userId: string;
    orderId: string;
    providerRef: string;
  }): Promise<BillingOrder>;
  fulfillOrderByProviderRef(providerRef: string): Promise<BillingOrder | null>;
  cancelSubscription(userId: string): Promise<SubscriptionRecord | null>;
}
