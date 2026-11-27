"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { NogSpeciesId } from "@/components/nog-3d/model-manifest";
import { type NogRoomTheme, NogStage } from "@/components/nog-3d/nog-stage";
import type { NogStageSlug } from "@/core/application/ports";
import { cn } from "@/lib/utils";
import styles from "./nog-avatar.module.css";
import type { PetReaction } from "./use-petting";

export interface NogAvatarProps {
  name: string;
  reaction: PetReaction;
  message: string | null;
  tapCount: number;
  onTap: () => void;
  stage?: NogStageSlug;
  species?: NogSpeciesId;
  tint?: string | null;
  equippedAccessories?: readonly (string | null)[];
  mood?: string | null;
  speaking?: boolean;
  roomTheme?: NogRoomTheme;
  className?: string;
  variant?: "default" | "sanctuary";
  children?: ReactNode;
}

export function NogAvatar({
  name,
  reaction,
  message,
  tapCount,
  onTap,
  stage,
  species,
  tint,
  equippedAccessories,
  mood,
  speaking,
  roomTheme,
  className,
  variant = "default",
  children,
}: NogAvatarProps) {
  const animWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = animWrapRef.current;
    if (!el || tapCount <= 0 || reaction === "idle") return;
    // Replay CSS fallback reaction animation without remounting the WebGL canvas.
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }, [tapCount, reaction]);

  const reactionClass =
    reaction === "giggle"
      ? styles.giggle
      : reaction === "tickle"
        ? styles.tickle
        : reaction === "annoyed"
          ? styles.annoyed
          : "";

  if (variant === "sanctuary") {
    return (
      <button
        type="button"
        aria-label={`Pet ${name}`}
        data-reaction={reaction}
        onClick={onTap}
        className={cn("sanctuary-pet-btn", className)}
      >
        <div
          ref={animWrapRef}
          className={cn("nog-bob", reactionClass)}
        >
          <NogStage
            scene="room"
            stage={stage}
            species={species}
            alt=""
            poster="/nog/blob-closeup.png"
            width={1254}
            height={1254}
            sizes="400px"
            tint={tint}
            equippedAccessories={equippedAccessories}
            reaction={reaction}
            tapCount={tapCount}
            mood={mood}
            speaking={speaking}
            roomTheme={roomTheme}
            priority
            decorative
            className="w-full"
          />
        </div>
        {children}
      </button>
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="relative z-10 mb-3 flex min-h-14 items-end justify-center px-2"
      >
        {message && (
          <p className="noggin-display relative max-w-[30ch] rounded-[24px] bg-[var(--noggin-white)] px-5 py-3 text-center text-[1rem] font-semibold leading-snug text-[var(--noggin-forest)] shadow-[0_10px_24px_var(--noggin-shadow)] sm:text-[1.0625rem]">
            {message}
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label={`Pet ${name}`}
        data-reaction={reaction}
        onClick={onTap}
        className="group relative -mt-[22%] flex w-full max-w-[340px] cursor-pointer items-center justify-center rounded-[48px] bg-transparent p-2 transition-transform duration-150 ease-out focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--noggin-leaf-strong)] motion-reduce:transition-none lg:max-w-[600px] lg:p-3"
      >
        <div
          ref={animWrapRef}
          className={cn("w-full", reactionClass)}
        >
          <NogStage
            scene="room"
            stage={stage}
            species={species}
            alt=""
            poster="/nog/blob-closeup.png"
            width={1254}
            height={1254}
            sizes="(min-width: 1024px) 600px, 340px"
            tint={tint}
            equippedAccessories={equippedAccessories}
            reaction={reaction}
            tapCount={tapCount}
            mood={mood}
            speaking={speaking}
            roomTheme={roomTheme}
            priority
            decorative
            className="w-full"
          />
        </div>
        {children}
      </button>
    </div>
  );
}
