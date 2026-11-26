import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArenaPreview } from "@/components/arena/arena-preview";
import { createContainer } from "@/composition/container";

export const metadata: Metadata = {
  title: "Arena",
};

export default async function ArenaPage() {
  const container = await createContainer();
  const [features, ageTier] = await Promise.all([
    container.getFeatures(),
    typeof container.getAgeTier === "function"
      ? container.getAgeTier().catch((): "under_13" | "standard" => "standard")
      : Promise.resolve<"under_13" | "standard">("standard"),
  ]);

  if (!features.arena) {
    redirect("/home");
  }

  if (ageTier === "under_13") {
    return (
      <div className="game-world game-world--hub flex items-center justify-center px-4 py-12">
        <section className="hatch-panel flex max-w-[520px] flex-col items-center gap-4 text-center">
          <h1 className="stage-h1 text-[1.75rem]">Private Learner Account</h1>
          <p className="stage-sub">
            Public Arena leaderboards and social lobbies are turned off for
            learners under 13 to keep your profile private and safe. You can
            still teach your Nog, build your Notebook, and play solo Practice
            Quizzes!
          </p>
          <Link href="/home" className="gbtn gbtn--leaf no-underline">
            Back to Home
          </Link>
        </section>
      </div>
    );
  }

  return <ArenaPreview />;
}
