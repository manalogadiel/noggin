"use client";

import { NogStage } from "@/components/nog-3d/nog-stage";
import { cn } from "@/lib/utils";
import styles from "./nog-avatar.module.css";
import type { PetReaction } from "./use-petting";

export interface NogAvatarProps {
  name: string;
  reaction: PetReaction;
  message: string | null;
  tapCount: number;
  onTap: () => void;
  tint?: string | null;
  className?: string;
}

export function NogAvatar({
  name,
  reaction,
  message,
  tapCount,
  onTap,
  tint,
  className,
}: NogAvatarProps) {
  const reactionClass =
    reaction === "giggle"
      ? styles.giggle
      : reaction === "tickle"
        ? styles.tickle
        : reaction === "annoyed"
          ? styles.annoyed
          : "";

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-3 flex min-h-14 items-end justify-center px-2"
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
        className="group relative flex w-full max-w-[280px] cursor-pointer items-center justify-center rounded-[48px] bg-[radial-gradient(circle_at_50%_62%,var(--noggin-sun-top)_0%,var(--noggin-mint)_65%,transparent_100%)] p-3 transition-transform duration-150 ease-out focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--noggin-leaf-strong)] motion-reduce:transition-none lg:max-w-[520px] lg:p-6"
      >
        <div
          key={tapCount > 0 ? `${reaction}-${tapCount}` : "idle"}
          className={cn("w-full", reactionClass)}
        >
          <NogStage
            scene="room"
            alt=""
            poster="/nog/blob-closeup.png"
            width={1254}
            height={1254}
            sizes="(min-width: 1024px) 520px, 280px"
            tint={tint}
            priority
            decorative
            className="w-full"
          />
        </div>
      </button>
    </div>
  );
}
