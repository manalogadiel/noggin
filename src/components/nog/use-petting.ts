"use client";

import { useCallback, useRef, useState } from "react";

export type PetReaction = "idle" | "giggle" | "tickle" | "annoyed";

export const PET_CANNED_LINES = [
  "Hehe, that tickles!",
  "Again! Again!",
  "Teach me something?",
  "I'm all ears… sort of.",
  "Boop!",
  "Feed me knowledge!",
] as const;

export const ANNOYED_FEED_HINT =
  "Whoa, easy on the poking! Try Feed if you want my attention.";

const TICKLE_WINDOW_MS = 2000;
const TICKLE_THRESHOLD = 5;
const ANNOYED_WINDOW_MS = 5000;
const ANNOYED_THRESHOLD = 15;

export interface UsePettingOptions {
  onPet: () => Promise<void>;
}

export interface UsePettingResult {
  reaction: PetReaction;
  message: string | null;
  tapCount: number;
  pet: () => void;
}

export function usePetting({ onPet }: UsePettingOptions): UsePettingResult {
  const tapTimestampsRef = useRef<number[]>([]);
  const lineIndexRef = useRef(0);
  const [reaction, setReaction] = useState<PetReaction>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);

  const pet = useCallback(() => {
    const now = Date.now();
    const recent5s = tapTimestampsRef.current.filter(
      (timestamp) => now - timestamp <= ANNOYED_WINDOW_MS,
    );
    recent5s.push(now);
    tapTimestampsRef.current = recent5s;

    const recent2sCount = recent5s.filter(
      (timestamp) => now - timestamp <= TICKLE_WINDOW_MS,
    ).length;

    let nextReaction: PetReaction = "giggle";
    if (recent5s.length >= ANNOYED_THRESHOLD) {
      nextReaction = "annoyed";
    } else if (recent2sCount >= TICKLE_THRESHOLD) {
      nextReaction = "tickle";
    }

    setReaction(nextReaction);
    setTapCount((count) => count + 1);

    if (nextReaction === "annoyed") {
      setMessage(ANNOYED_FEED_HINT);
    } else {
      const nextLine =
        PET_CANNED_LINES[lineIndexRef.current % PET_CANNED_LINES.length];
      lineIndexRef.current += 1;
      setMessage(nextLine);
    }

    Promise.resolve(onPet()).catch(() => undefined);
  }, [onPet]);

  return {
    reaction,
    message,
    tapCount,
    pet,
  };
}
