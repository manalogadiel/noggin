import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatNogStage, nogRenderForStage } from "@/components/nog/nog-card";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Nog Room",
};

export interface NogRoomPageProps {
  params: Promise<{ id: string }>;
}

export default async function NogRoomPlaceholderPage({
  params,
}: NogRoomPageProps) {
  const { id } = await params;
  const container = await createContainer();
  const result = await container.getNogRoom({ nogId: id });

  if (result.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(`/nogs/${id}`)}`);
  }

  if (result.status === "not_found") {
    notFound();
  }

  const { nog } = result;
  const stageLabel = formatNogStage(nog.stage);
  const subjectLabel = nog.subjectName ?? "Custom subject";

  return (
    <div className="mx-auto w-full max-w-[720px] py-2 md:py-6">
      <section
        aria-labelledby="nog-room-heading"
        className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-12"
      >
        <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--noggin-sun-top)_0%,var(--noggin-mint-light)_100%)] p-4">
          <Image
            src={nogRenderForStage(nog.stage)}
            alt=""
            width={160}
            height={160}
            priority
            className="h-full w-full object-contain"
          />
        </div>

        <h1
          id="nog-room-heading"
          className="noggin-display mt-6 max-w-full text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.1] text-[var(--noggin-leaf-title)] [overflow-wrap:anywhere]"
        >
          {nog.name}
        </h1>

        <p className="mt-2 text-[1.125rem] font-medium text-[var(--noggin-forest)]">
          {subjectLabel}
        </p>

        <span className="mt-3 inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-4 py-1 text-[0.875rem] font-semibold text-[var(--noggin-forest)]">
          {stageLabel}
        </span>

        <p className="mt-6 text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
          Your room is being built
        </p>

        <Link
          href="/nogs"
          className="noggin-primary-pill noggin-display mt-8 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold"
        >
          Back to My Nogs
        </Link>
      </section>
    </div>
  );
}
