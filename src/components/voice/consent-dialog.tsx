"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import Link from "next/link";
import type { RefObject } from "react";

export interface ConsentDialogProps {
  open: boolean;
  onAllow: () => void;
  onDecline: () => void;
  declineFocusRef?: RefObject<HTMLElement | null>;
}

export function ConsentDialog({
  open,
  onAllow,
  onDecline,
  declineFocusRef,
}: ConsentDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onDecline();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--noggin-forest)_35%,transparent)] backdrop-blur-[2px]" />
        <Dialog.Popup
          finalFocus={declineFocusRef ?? false}
          className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[32px] bg-[var(--noggin-cream)] p-6 text-center text-[var(--noggin-forest)] shadow-[0_20px_48px_var(--noggin-shadow-strong)] outline-none sm:p-7"
        >
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--noggin-mint)] p-2 shadow-[0_8px_20px_var(--noggin-shadow)]">
            <Image
              src="/nog/hatchling-happy.png"
              alt="Listening Nog"
              width={96}
              height={96}
              unoptimized
              className="h-20 w-20 object-contain"
            />
          </div>

          <Dialog.Title className="noggin-display mt-4 text-[1.5rem] font-extrabold leading-tight text-[var(--noggin-forest)]">
            Can I hear you?
          </Dialog.Title>

          <Dialog.Description className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--noggin-ink)]">
            I&rsquo;ll turn what you say into text for your lesson. Your recording
            isn&rsquo;t kept — only the words.
          </Dialog.Description>

          <p className="mt-2 text-[0.875rem]">
            <Link
              href="/privacy"
              className="font-semibold text-[var(--noggin-leaf-strong)] underline underline-offset-4 hover:text-[var(--noggin-forest)]"
            >
              Privacy
            </Link>
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-center">
            <button
              type="button"
              onClick={onAllow}
              className="noggin-primary-pill noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center px-6 py-2.5 text-[0.9375rem] font-bold"
            >
              Allow mic
            </button>

            <button
              type="button"
              onClick={onDecline}
              className="noggin-display inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-5 py-2.5 text-[0.9375rem] font-semibold text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)] transition-colors hover:bg-[var(--noggin-mint)] motion-reduce:transition-none"
            >
              I&rsquo;ll type instead
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
