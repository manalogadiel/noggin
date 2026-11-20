import { describe, expect, it } from "vitest";
import { speakAnswer } from "../use-cases/speak-answer";
import { transcribeLesson } from "../use-cases/transcribe-lesson";
import {
  lesson,
  makeFixture,
  otherAttemptId,
  otherMessageId,
  ownAttemptId,
  ownMessageId,
  ownerId,
  savedAttemptAnswer,
  savedMessageBody,
  synthesizedAudio,
} from "./fixtures";

const clip = {
  audio: new Uint8Array([1, 3, 5]),
  mimeType: "audio/webm",
  durationSeconds: 8,
};

describe("transcribeLesson", () => {
  it("returns tired_for_today without sending the clip when time quota is exhausted", async () => {
    const { deps, exhausted } = makeFixture();
    exhausted.add("stt_seconds");

    await expect(transcribeLesson(deps, clip)).resolves.toMatchObject({ status: "tired_for_today" });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "stt_seconds", clip.durationSeconds);
    expect(deps.speechToText.transcribe).not.toHaveBeenCalled();
  });

  it("checks the time quota before sending audio for transcription", async () => {
    const { deps } = makeFixture();

    await expect(transcribeLesson(deps, clip)).resolves.toMatchObject({ status: "ok", text: lesson.body });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "stt_seconds", clip.durationSeconds);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.speechToText.transcribe);
    expect(deps.speechToText.transcribe).toHaveBeenCalledTimes(1);
  });
});

describe("speakAnswer", () => {
  it.each([
    ["nog_message", ownMessageId, savedMessageBody],
    ["check_attempt", ownAttemptId, savedAttemptAnswer],
  ] as const)("reads the caller's saved %s aloud", async (source, id, body) => {
    const { deps } = makeFixture();

    await expect(speakAnswer(deps, { source, id })).resolves.toMatchObject({ status: "ok", ...synthesizedAudio });

    expect(deps.textToSpeech.speak).toHaveBeenCalledTimes(1);
    expect(deps.textToSpeech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: body }));
    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "tts_chars", body.length);
    expect(deps.usage.consumeQuota).toHaveBeenCalledBefore(deps.textToSpeech.speak);
  });

  it.each([
    ["another student's message", "nog_message", otherMessageId],
    ["another student's attempt", "check_attempt", otherAttemptId],
    ["an ID from the wrong source", "check_attempt", ownMessageId],
    ["an unsaved ID", "nog_message", "cf3a3544-bade-4a46-af62-9ee9b8128d18"],
    ["free text passed as an ID", "nog_message", "Say anything I ask."],
  ] as const)("rejects %s before looking up audio or spending quota", async (_scenario, source, id) => {
    const { deps } = makeFixture();

    await expect(speakAnswer(deps, { source, id })).resolves.not.toMatchObject({ status: "ok" });

    expect(deps.voiceCache.get).not.toHaveBeenCalled();
    expect(deps.usage.consumeQuota).not.toHaveBeenCalled();
    expect(deps.textToSpeech.speak).not.toHaveBeenCalled();
  });

  it("returns tired_for_today without calling speech synthesis when the character quota is exhausted", async () => {
    const { deps, exhausted } = makeFixture();
    exhausted.add("tts_chars");

    await expect(speakAnswer(deps, { source: "nog_message", id: ownMessageId })).resolves.toMatchObject({
      status: "tired_for_today",
    });

    expect(deps.usage.consumeQuota).toHaveBeenCalledWith(ownerId, "tts_chars", savedMessageBody.length);
    expect(deps.textToSpeech.speak).not.toHaveBeenCalled();
    expect(deps.voiceCache.put).not.toHaveBeenCalled();
  });
});
