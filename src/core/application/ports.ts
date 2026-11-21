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
  | "generate";

export interface AuthenticatedUser {
  id: string;
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
}

export interface SavedDigestRecord {
  digest: ListenerDigest;
  cardIds: string[];
}

export interface OwnedMessage {
  id: string;
  nogId: string;
  lessonId?: string | null;
  role: "nog" | "student";
  kind: "reply" | "question" | "answer" | "reaction";
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

export interface ListenInput {
  nogId: string;
  topicId: string;
  page: LessonPage;
  existingCards: ThoughtCardRecord[];
}

export interface ListenerDigest {
  reply: string;
  mood: string;
  followUpQuestions: string[];
  operations: DigestOperation[];
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

export interface GradeInput {
  topicId: string;
  pages: LessonPage[];
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
