import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/shell/public-header";

export const metadata: Metadata = {
  title: "Discover",
};

const FEATURES = [
  {
    label: "Make it Yours",
    position: "lg:top-[10%] lg:left-[2%] xl:left-[4%]",
    tilt: "-rotate-[0.6deg]",
    delay: "",
  },
  {
    label: "Hatch a Nog",
    position: "lg:top-[10%] lg:right-[2%] xl:right-[4%]",
    tilt: "rotate-[0.6deg]",
    delay: "nog-float-delay-1",
  },
  {
    label: "Watch It Grow",
    position: "lg:top-[44%] lg:left-0 xl:left-[1%]",
    tilt: "-rotate-[0.4deg]",
    delay: "nog-float-delay-2",
  },
  {
    label: "Challenge Friends",
    position: "lg:top-[44%] lg:right-0 xl:right-[1%]",
    tilt: "rotate-[0.4deg]",
    delay: "",
  },
  {
    label: "Teach a Lesson",
    position: "lg:bottom-[10%] lg:left-[3%] xl:left-[5%]",
    tilt: "-rotate-[0.5deg]",
    delay: "nog-float-delay-1",
  },
  {
    label: "Climb the Ranks",
    position: "lg:bottom-[10%] lg:right-[3%] xl:right-[5%]",
    tilt: "rotate-[0.5deg]",
    delay: "nog-float-delay-2",
  },
] as const;

export default function DiscoverPage() {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader active="discover" />

      <main className="flex-1 overflow-x-clip">
        <section className="relative overflow-x-clip">
          <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 pt-10 pb-16 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:pt-12 lg:pb-24">
            <div className="relative z-10 flex flex-col items-start">
              <h1 className="noggin-display text-[clamp(2.75rem,7vw,6.5625rem)] font-semibold leading-[0.88] tracking-tight text-[var(--noggin-forest)]">
                <span className="block">Hello, your </span>
                <span className="my-3 flex flex-wrap items-baseline gap-x-4 sm:my-4 sm:gap-x-6">
                  <span className="relative inline-block -rotate-4 border-[6px] border-[var(--noggin-leaf)] px-3 py-0.5 leading-[0.95] sm:border-[8px] sm:px-5">
                    <span
                      aria-hidden="true"
                      className="absolute -top-[10px] -left-[10px] h-[15px] w-[15px] bg-[var(--noggin-leaf)]"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -top-[10px] -right-[10px] h-[15px] w-[15px] bg-[var(--noggin-leaf)]"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[10px] -left-[10px] h-[15px] w-[15px] bg-[var(--noggin-leaf)]"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -right-[10px] -bottom-[10px] h-[15px] w-[15px] bg-[var(--noggin-leaf)]"
                    />
                    <span className="font-bold text-[clamp(3.75rem,10vw,9.375rem)] text-[var(--noggin-leaf-strong)]">
                      NOG
                    </span>
                  </span>{" "}
                  <span>is </span>
                </span>
                <span className="block">waiting</span>
              </h1>

              <Link
                href="/signup"
                className="noggin-primary-pill noggin-display mt-8 inline-flex h-14 min-h-11 items-center justify-center px-9 text-[1.375rem] font-bold lg:mt-10 lg:h-[73px] lg:px-12 lg:text-[1.875rem]"
              >
                Hatch a Nog
              </Link>
            </div>

            <div className="relative flex items-center justify-center">
              <div
                aria-hidden="true"
                className="noggin-sun-disc pointer-events-none absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 sm:h-[480px] sm:w-[480px] lg:left-[58%] lg:h-[920px] lg:w-[920px]"
              />
              <div className="nog-float relative z-10 w-[88vw] max-w-[680px] lg:w-full">
                <Image
                  src="/nog/flying-book.png"
                  alt="A sprouting Nog flying with a book"
                  width={1254}
                  height={1254}
                  priority
                  sizes="(min-width: 1024px) 680px, 88vw"
                  className="h-auto w-full rotate-[3.4deg] object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-[var(--noggin-cream)] px-4 py-16 md:px-10 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="noggin-display text-center font-bold text-[var(--noggin-leaf-title)]">
              <span className="block text-[clamp(2.25rem,6.4vw,5.75rem)] leading-[1.02] tracking-tight">
                Big things hatch at{" "}
              </span>
              <span className="block text-[clamp(4rem,11vw,9.875rem)] leading-[0.95] tracking-[-0.03em]">
                Noggin
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-[62ch] text-center text-[clamp(1.0625rem,1.8vw,1.5625rem)] leading-[1.5] text-[var(--noggin-ink)] lg:mt-8">
              Whether you&apos;re{" "}
              <strong className="font-bold">mastering a subject</strong> or{" "}
              <strong className="font-bold">challenging your classmates</strong>
              , <strong className="font-bold">Noggin</strong> turns learning
              into a growing friendship.{" "}
              <strong className="font-bold">Hatch your Nog</strong>, teach it in
              your own words, and watch it grow from a curious little creature
              into a genius.{" "}
              <strong className="font-bold">
                Make it yours, put its knowledge to the test, and grow smarter
                together.
              </strong>
            </p>

            <div className="relative mt-12 lg:mt-16 lg:min-h-[600px] lg:py-6">
              <div className="relative mx-auto flex max-w-[828px] flex-col items-center justify-end">
                <div className="nog-bob relative z-10 w-[76vw] max-w-[460px] lg:max-w-[500px]">
                  <Image
                    src="/nog/thinking.png"
                    alt="A Nog thinking"
                    width={1254}
                    height={1254}
                    sizes="(min-width: 1024px) 500px, 76vw"
                    className="h-auto w-full object-contain"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="noggin-sun-disc -mt-10 h-16 w-[80vw] max-w-[680px] rounded-[188px] shadow-[0_18px_36px_var(--noggin-shadow)] sm:-mt-14 sm:h-24 lg:-mt-16 lg:h-28 lg:w-full lg:max-w-[740px]"
                />
              </div>

              <ul
                aria-label="What you can do"
                className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:static lg:mt-0 lg:block"
              >
                {FEATURES.map((feature) => (
                  <li
                    key={feature.label}
                    className={`lg:absolute ${feature.position} z-20`}
                  >
                    <div className={`nog-float-lg ${feature.delay}`}>
                      <span
                        className={`noggin-feature-pill noggin-display flex min-h-14 items-center justify-center px-4 py-3 text-center text-[0.9375rem] font-bold sm:px-6 sm:text-[1.25rem] lg:px-8 lg:py-4 lg:text-[1.625rem] xl:text-[1.875rem] ${feature.tilt}`}
                      >
                        {feature.label}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-10 lg:py-24">
          <div className="noggin-cta-card relative mx-auto max-w-[1220px] rounded-[32px] px-6 py-10 sm:px-10 lg:rounded-[55px] lg:py-16 lg:pr-14 lg:pl-[40%]">
            <div className="mx-auto mb-6 w-[220px] lg:pointer-events-none lg:absolute lg:bottom-0 lg:-left-10 lg:mb-0 lg:w-[460px] xl:w-[510px]">
              <div className="nog-bob">
                <Image
                  src="/nog/egg-peek.png"
                  alt="A Nog peeking out of its eggshell"
                  width={1192}
                  height={1320}
                  sizes="(min-width: 1024px) 510px, 220px"
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center lg:items-start lg:text-left">
              <h2 className="noggin-display text-[clamp(1.75rem,3.8vw,3.4375rem)] font-bold leading-[1.1] tracking-tight text-[var(--noggin-leaf-title)]">
                Ready to hatch your own Nog?
              </h2>

              <p className="noggin-display mt-3 text-[clamp(1.0625rem,2vw,1.875rem)] font-normal leading-[1.35] text-[var(--noggin-forest)] lg:mt-4">
                Start learning, growing, and competing today.
              </p>

              <Link
                href="/signup"
                className="noggin-primary-pill noggin-display mt-7 inline-flex h-16 min-h-11 w-full max-w-[320px] items-center justify-center px-10 text-[1.375rem] font-extrabold lg:mt-9 lg:h-[104px] lg:w-auto lg:max-w-none lg:px-16 lg:text-[2.25rem]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex h-16 w-full items-center justify-center bg-[var(--noggin-leaf-strong)] lg:h-[95px]">
        <p className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-white)] lg:text-[2.125rem]">
          @Noggin
        </p>
      </footer>
    </div>
  );
}
