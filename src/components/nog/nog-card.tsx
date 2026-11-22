import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { NogStageSlug } from "@/core/application/ports";

export interface NogCardSummary {
  id: string;
  name: string;
  subjectName: string;
  stage: NogStageSlug;
}

const STAGE_LABELS: Record<NogStageSlug, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

export function formatNogStage(stage: NogStageSlug): string {
  return STAGE_LABELS[stage];
}

export function nogRenderForStage(stage: NogStageSlug): string {
  return stage === "hatchling" ? "/nog/blob-closeup.png" : "/nog/thinking.png";
}

export function NogCard({ nog }: { nog: NogCardSummary }) {
  const stageLabel = formatNogStage(nog.stage);
  const imageSrc = nogRenderForStage(nog.stage);

  return (
    <Link
      href={`/nogs/${nog.id}`}
      aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}`}
      className="group flex h-full flex-col items-center justify-between rounded-[28px] bg-[var(--noggin-mint-light)] p-6 text-center shadow-[0_10px_26px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex flex-col items-center">
        <Image
          src={imageSrc}
          alt=""
          width={128}
          height={128}
          className="h-32 w-32 object-contain"
        />

        <p className="noggin-display mt-4 max-w-full text-[1.375rem] font-extrabold leading-tight text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
          {nog.name}
        </p>{" "}

        <p className="mt-1.5 max-w-full text-[1rem] text-[var(--noggin-ink)] [overflow-wrap:anywhere]">
          {nog.subjectName}
        </p>{" "}
      </div>{" "}

      <span className="mt-4 inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] px-4 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)] shadow-[0_2px_8px_var(--noggin-shadow)]">
        {stageLabel}
      </span>
    </Link>
  );
}

export function HatchNewCard() {
  return (
    <Link
      href="/adopt"
      className="group flex h-full min-h-[260px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[var(--noggin-leaf)] bg-[var(--noggin-white)] p-6 text-center shadow-[0_10px_26px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_8px_20px_var(--noggin-shadow)] transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </span>

      <span className="noggin-display mt-4 text-[1.25rem] font-extrabold text-[var(--noggin-forest)]">
        Hatch New
      </span>
    </Link>
  );
}

export function EmptyNogsCard() {
  return (
    <div className="group relative flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[linear-gradient(135deg,var(--noggin-mint-light)_0%,var(--noggin-mint)_100%)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-12">
      <Image
        src="/nog/egg-peek.png"
        alt=""
        width={180}
        height={200}
        priority
        className="h-44 w-auto object-contain"
      />

      <h2 className="noggin-display mt-5 text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-[var(--noggin-forest)]">
        No Nogs yet
      </h2>

      <p className="mt-2 max-w-[38ch] text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
        Pick a subject, tap the egg, and give your first Nog a name.
      </p>

      <Link
        href="/adopt"
        className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold after:absolute after:inset-0 after:rounded-[var(--noggin-radius-card)]"
      >
        Hatch your first Nog
      </Link>
    </div>
  );
}
