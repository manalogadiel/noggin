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

const STAGE_LEVELS: Record<NogStageSlug, number> = {
  hatchling: 1,
  sprout: 2,
  scholar: 3,
  genius: 4,
};

export function formatNogStage(stage: NogStageSlug): string {
  return STAGE_LABELS[stage];
}

export function nogLevelForStage(stage: NogStageSlug): number {
  return STAGE_LEVELS[stage] ?? 1;
}

export function nogRenderForStage(stage: NogStageSlug): string {
  return stage === "hatchling" ? "/nog/blob-closeup.png" : "/nog/thinking.png";
}

export function NogCard({ nog }: { nog: NogCardSummary }) {
  const stageLabel = formatNogStage(nog.stage);
  const level = nogLevelForStage(nog.stage);
  const imageSrc = nogRenderForStage(nog.stage);

  return (
    <Link
      href={`/nogs/${nog.id}`}
      aria-label={`${nog.name}, ${nog.subjectName}, ${stageLabel}`}
      className="group flex h-full min-h-[320px] flex-col items-center justify-between rounded-[24px] bg-[var(--noggin-mint-light)] p-6 text-center shadow-[0_12px_28px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <Image
          src={imageSrc}
          alt=""
          width={220}
          height={220}
          className="mb-6 h-[156px] w-[156px] scale-[1.45] object-contain"
        />

        <p className="noggin-display mt-4 max-w-full text-[1.75rem] font-extrabold leading-tight text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
          {nog.name}
        </p>

        <p className="noggin-display mt-1 text-[1rem] font-bold text-[var(--noggin-forest)]">
          Lvl. {level}
        </p>

        <p className="mt-1.5 max-w-full text-[0.875rem] font-medium text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
          {nog.subjectName}
        </p>
      </div>
    </Link>
  );
}

export function HatchNewCard() {
  return (
    <Link
      href="/adopt"
      className="group flex h-full min-h-[320px] flex-col items-center justify-center rounded-[24px] bg-[var(--noggin-mint-light)] p-6 text-center shadow-[0_12px_28px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--noggin-sage)] text-[var(--noggin-leaf-strong)] shadow-[0_8px_20px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <Plus className="h-11 w-11" strokeWidth={2.75} />
      </span>

      <span className="noggin-display mt-5 text-[1.5rem] font-extrabold text-[var(--noggin-forest)]">
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
