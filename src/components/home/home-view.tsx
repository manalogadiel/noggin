import Image from "next/image";
import Link from "next/link";

export type HomeNogStage = "hatchling" | "sprout" | "scholar" | "genius";

export interface HomeNogSummary {
  id: string;
  name: string;
  stage: HomeNogStage;
}

export interface HomeViewProps {
  firstName: string | null;
  nogs: HomeNogSummary[] | null;
  error: boolean;
}

const STAGE_LABELS: Record<HomeNogStage, string> = {
  hatchling: "Hatchling",
  sprout: "Sprout",
  scholar: "Scholar",
  genius: "Genius",
};

export function HomeView({ firstName, nogs, error }: HomeViewProps) {
  const greeting = firstName ? `Hi, ${firstName}!` : "Hi there!";
  const visibleNogs = !error && nogs ? nogs.slice(0, 3) : [];
  const firstNog = visibleNogs[0] ?? null;

  return (
    <div className="space-y-8 md:space-y-10">
      <section aria-labelledby="home-greeting">
        <h1
          id="home-greeting"
          className="noggin-display text-[clamp(2rem,4.4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--noggin-leaf-title)]"
        >
          {greeting}
        </h1>
        {!error ? (
          <p className="mt-2 text-[1.125rem] leading-relaxed text-[var(--noggin-ink)]">
            {firstNog
              ? "Your Nogs are ready to learn."
              : "Let's hatch your first Nog."}
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
          <p
            role="alert"
            className="mt-2 text-[1.0625rem] leading-relaxed text-[var(--noggin-ink)]"
          >
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
        <>
          <section className="rounded-[var(--noggin-radius-card)] bg-[linear-gradient(135deg,var(--noggin-mint-light)_0%,var(--noggin-mint)_100%)] p-6 shadow-[0_14px_34px_var(--noggin-shadow),inset_0_-2px_12px_var(--noggin-shadow-inset)] md:p-10">
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1.2fr_0.8fr] md:gap-10">
              <div className="order-1 flex justify-center md:order-2 md:justify-end">
                <div className="nog-bob h-[160px] w-[160px] md:h-[220px] md:w-[220px]">
                  <Image
                    src={firstNog ? "/nog/thinking.png" : "/nog/egg-peek.png"}
                    alt=""
                    width={220}
                    height={220}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="order-2 flex flex-col items-start md:order-1">
                {firstNog ? (
                  <>
                    <h2 className="noggin-display text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                      Ready to teach {firstNog.name}?
                    </h2>
                    <p className="mt-3 text-[1rem] leading-relaxed text-[var(--noggin-ink)] md:text-[1.125rem]">
                      Every lesson makes your Nog a little smarter.
                    </p>
                    <Link
                      href={`/nogs/${firstNog.id}`}
                      className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold md:h-14 md:px-8"
                    >
                      Continue teaching
                    </Link>
                  </>
                ) : (
                  <>
                    <h2 className="noggin-display text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] text-[var(--noggin-forest)]">
                      No Nogs yet
                    </h2>
                    <p className="mt-3 text-[1rem] leading-relaxed text-[var(--noggin-ink)] md:text-[1.125rem]">
                      Pick a subject, tap the egg, and give your Nog a name.
                    </p>
                    <Link
                      href="/adopt"
                      className="noggin-primary-pill noggin-display mt-6 inline-flex h-12 min-h-11 items-center justify-center px-7 text-[1.0625rem] font-bold md:h-14 md:px-8"
                    >
                      Hatch your first Nog
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>

          {visibleNogs.length > 0 ? (
            <section aria-labelledby="your-nogs-heading">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="your-nogs-heading"
                  className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]"
                >
                  Your Nogs
                </h2>
                <Link
                  href="/nogs"
                  className="noggin-display inline-flex min-h-11 items-center rounded-[var(--noggin-radius-pill)] px-2 text-[1rem] font-semibold text-[var(--noggin-forest)] underline-offset-4 hover:underline"
                >
                  See all
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleNogs.map((nog) => {
                  const stageLabel = STAGE_LABELS[nog.stage];
                  const imageSrc =
                    nog.stage === "hatchling"
                      ? "/nog/blob-closeup.png"
                      : "/nog/thinking.png";

                  return (
                    <Link
                      key={nog.id}
                      href={`/nogs/${nog.id}`}
                      aria-label={`${nog.name}, ${stageLabel}`}
                      className="group flex flex-col items-center rounded-[28px] bg-[var(--noggin-white)] p-5 text-center shadow-[0_8px_24px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <Image
                        src={imageSrc}
                        alt=""
                        width={96}
                        height={96}
                        className="h-24 w-24 object-contain"
                      />
                      <span className="noggin-display mt-3 max-w-full text-[1.25rem] font-bold text-[var(--noggin-forest)] [overflow-wrap:anywhere]">
                        {nog.name}
                      </span>
                      <span className="mt-2 inline-flex items-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-3.5 py-1 text-[0.9375rem] text-[var(--noggin-ink)]">
                        {stageLabel}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
