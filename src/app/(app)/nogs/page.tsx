import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyNogsCard,
  type NogCardSummary,
} from "@/components/nog/nog-card";
import { NogCollection } from "@/components/nog/nog-collection";
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

  if (nogs && nogs.length > 0) {
    return <NogCollection nogs={nogs} />;
  }

  return (
    <div className="game-world game-world--hatch">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-day.jpg"
        alt=""
        className="scene-bg-img scene-bg-img--sanctuary"
      />
      <div className="scene-bg-scrim scene-bg-scrim--hatch" aria-hidden="true" />

      <div className="stage-body items-center text-center">
        <div className="mb-6">
          <h1 id="my-nogs-heading" className="stage-h1">
            My Nogs
          </h1>
          <p className="stage-sub">Your collection of Nogs.</p>
        </div>

        {error ? (
          <section className="hatch-panel flex max-w-[520px] flex-col items-center text-center">
            <Image
              src="/nog/blob-closeup.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain grayscale-[30%]"
            />
            <h2 className="stage-h1 mt-4 text-[1.75rem]">Brain fog</h2>
            <p role="alert" className="stage-sub mt-2">
              We couldn&apos;t load your Nogs right now.
            </p>
            <Link href="/nogs" className="pub-cta-pill pub-cta-pill--md mt-6">
              Try again
            </Link>
          </section>
        ) : (
          <section aria-label="Start your Nog collection" className="w-full max-w-[640px]">
            <EmptyNogsCard />
          </section>
        )}
      </div>
    </div>
  );
}
