import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyNogsCard,
  HatchNewCard,
  NogCard,
  type NogCardSummary,
} from "@/components/nog/nog-card";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "My Nogs",
};

export default async function MyNogsPage() {
  let nogs: NogCardSummary[] | null = null;
  let error = false;
  let unauthenticated = false;

  try {
    const container = await createContainer();
    const result = await container.listNogs();
    if (result.status === "unauthenticated") {
      unauthenticated = true;
    } else if (result.status === "ok") {
      nogs = result.nogs.map((nog) => ({
        id: nog.id,
        name: nog.name,
        subjectName: nog.subjectName ?? "Custom subject",
        stage: nog.stage,
      }));
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  if (unauthenticated) {
    redirect("/login?next=%2Fnogs");
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="my-nogs-heading">
        <h1
          id="my-nogs-heading"
          className="noggin-display text-[clamp(2rem,4.4vw,3.25rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--noggin-leaf-title)]"
        >
          My Nogs
        </h1>
        <p className="mt-2 text-[1.125rem] leading-relaxed text-[var(--noggin-ink)]">
          Your collection of Nogs.
        </p>
      </section>

      {error ? (
        <section className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-6 text-center shadow-[0_14px_34px_var(--noggin-shadow)] md:p-10">
          <Image
            src="/nog/blob-closeup.png"
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 object-contain grayscale-[30%]"
          />
          <h2 className="noggin-display mt-4 text-[clamp(1.5rem,3vw,2rem)] font-bold text-[var(--noggin-forest)]">
            Brain fog
          </h2>
          <p
            role="alert"
            className="mt-2 text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)]"
          >
            We couldn&apos;t load your Nogs right now.
          </p>
          <Link
            href="/nogs"
            className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold"
          >
            Try again
          </Link>
        </section>
      ) : nogs && nogs.length > 0 ? (
        <section aria-label="Nog collection">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nogs.map((nog) => (
              <NogCard key={nog.id} nog={nog} />
            ))}
            <HatchNewCard />
          </div>
        </section>
      ) : (
        <section aria-label="Start your Nog collection">
          <EmptyNogsCard />
        </section>
      )}
    </div>
  );
}
