import Link from "next/link";
import { NogStage } from "@/components/nog-3d/nog-stage";

export interface RoomComingNextProps {
  nogId: string;
  title?: string;
}

export function RoomComingNext({ nogId, title }: RoomComingNextProps) {
  return (
    <div className="mx-auto w-full max-w-[680px] py-4 md:py-8">
      <section className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-12">
        <div className="w-[210px] sm:w-[250px]">
          <NogStage
            scene="thinking"
            alt="A Nog thinking"
            poster="/nog/thinking.png"
            width={1254}
            height={1254}
            sizes="(min-width: 640px) 250px, 210px"
            priority
            className="w-full"
          />
        </div>

        {title && (
          <h1 className="noggin-display mt-5 text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-tight text-[var(--noggin-leaf-title)]">
            {title}
          </h1>
        )}

        <p className="mt-3 max-w-[38ch] text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)]">
          This part of the room is being built
        </p>

        <Link
          href={`/nogs/${nogId}`}
          className="noggin-primary-pill noggin-display mt-7 inline-flex min-h-12 items-center justify-center px-7 text-[1.0625rem] font-bold"
        >
          Back to the room
        </Link>
      </section>
    </div>
  );
}
