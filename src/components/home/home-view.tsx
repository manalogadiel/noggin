import Image from "next/image";
import Link from "next/link";
import { NogRoomView } from "@/components/room/nog-room-view";
import type { SaveProfileSettingsHandler } from "@/components/settings/settings-sheet";
import type { NogRecord, ProfileSettings } from "@/core/application/ports";
import type { VitalsResult } from "@/core/domain/vitals";

export type HomeNogStage = "hatchling" | "sprout" | "scholar" | "genius";

export interface HomeNogSummary {
  id: string;
  name: string;
  stage: HomeNogStage;
}

export interface HomeActiveRoomData {
  nog: NogRecord;
  vitals: VitalsResult;
  progress: number;
  initialSettings: ProfileSettings;
  now?: Date;
}

export interface HomeViewProps {
  firstName: string | null;
  nogs: HomeNogSummary[] | null;
  error: boolean;
  activeRoomData?: HomeActiveRoomData | null;
  onSaveSettings?: SaveProfileSettingsHandler;
  onPet?: () => Promise<void>;
  onWake?: () => Promise<unknown>;
}

const STAGE_LABELS: Record<HomeNogStage, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

export function HomeView({
  firstName,
  nogs,
  error,
  activeRoomData,
  onSaveSettings,
  onPet,
  onWake,
}: HomeViewProps) {
  if (!error && activeRoomData && onSaveSettings && onPet) {
    return (
      <NogRoomView
        nog={activeRoomData.nog}
        vitals={activeRoomData.vitals}
        progress={activeRoomData.progress}
        initialSettings={activeRoomData.initialSettings}
        onSaveSettings={onSaveSettings}
        onPet={onPet}
        onWake={onWake}
        now={activeRoomData.now}
      />
    );
  }

  const greeting = firstName ? `Hi, ${firstName}!` : "Hi there!";
  const visibleNogs = !error && nogs ? nogs.slice(0, 3) : [];
  const firstNog = visibleNogs[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-8 px-6 py-8">
      <section aria-labelledby="home-greeting">
        <h1
          id="home-greeting"
          className="noggin-display text-[clamp(2rem,4.4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--noggin-leaf-title)]"
        >
          {greeting}
        </h1>
        {!error ? (
          <p className="mt-2 text-[1.125rem] leading-relaxed text-[var(--noggin-ink)]">
            {firstNog ? "Your Nogs are ready to learn." : "Let's hatch your first Nog."}
          </p>
        ) : null}
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
            Brain fog 😵
          </h2>
          <p role="alert" className="mt-2 text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)]">
            We couldn&apos;t load your Nogs.
          </p>
          <Link
            href="/home"
            className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold"
          >
            Try again
          </Link>
        </section>
      ) : (
        <section className="rounded-[var(--noggin-radius-card)] bg-[linear-gradient(135deg,var(--noggin-mint-light)_0%,var(--noggin-mint)_100%)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] md:p-10">
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col items-start">
              <h2 className="noggin-display text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] text-[var(--noggin-forest)]">
                {firstNog ? `Ready to teach ${firstNog.name}?` : "No Nogs yet"}
              </h2>
              <p className="mt-3 text-[1rem] leading-relaxed text-[var(--noggin-ink)]">
                {firstNog
                  ? `Stage: ${STAGE_LABELS[firstNog.stage]}. Enter your Living Sanctuary!`
                  : "Pick a subject, tap the egg, and give your Nog a name."}
              </p>
              <Link
                href={firstNog ? `/nogs/${firstNog.id}` : "/adopt"}
                className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 items-center justify-center px-7 text-[1.0625rem] font-bold"
              >
                {firstNog ? "Continue teaching" : "Hatch your first Nog"}
              </Link>
            </div>
            <div className="flex justify-center">
              <Image
                src={firstNog ? "/nog/thinking.png" : "/nog/egg-peek.png"}
                alt=""
                width={200}
                height={200}
                priority
                className="h-[180px] w-[180px] object-contain"
              />
            </div>
          </div>

          {visibleNogs.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="noggin-display text-lg font-bold text-[var(--noggin-forest)]">
                  Your Nogs
                </h2>
                <Link
                  href="/nogs"
                  className="text-sm font-semibold text-[var(--noggin-leaf-strong)] underline-offset-4 hover:underline"
                >
                  See all
                </Link>
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {visibleNogs.map((nog) => (
                  <li key={nog.id}>
                    <Link
                      href={`/nogs/${nog.id}`}
                      aria-label={`${nog.name}, ${STAGE_LABELS[nog.stage]}`}
                      className="flex items-center justify-between rounded-2xl bg-[var(--noggin-white)] px-4 py-3 font-semibold text-[var(--noggin-forest)] shadow-sm transition hover:-translate-y-0.5"
                    >
                      <span>{nog.name}</span>
                      <span className="text-xs text-[var(--noggin-ink)]">{STAGE_LABELS[nog.stage]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
