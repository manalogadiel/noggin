import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/shell/public-header";

export default function LandingPage() {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader active="home" />

      <main className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-between px-4 pt-6 pb-6 md:px-10 lg:pt-2 lg:pb-10">
        <h1 className="sr-only">Noggin: raise a genius by teaching it</h1>

        <div className="relative flex flex-1 flex-col items-center justify-center lg:justify-end">
          <div
            aria-hidden="true"
            className="pointer-events-none select-none text-center lg:mb-[-7.5rem] xl:mb-[-10rem]"
          >
            <p className="noggin-display noggin-hero-gradient-text text-[clamp(3.75rem,15.5vw,14rem)] font-extrabold leading-[0.82] tracking-[-0.03em]">
              RAISE A
            </p>
            <p className="noggin-display noggin-hero-gradient-text text-[clamp(4.5rem,20.5vw,19.1875rem)] font-extrabold leading-[0.82] tracking-[-0.035em]">
              GENIUS
            </p>
          </div>

          <div className="relative z-10 -mt-5 w-full max-w-[1193px] sm:-mt-10 lg:mt-0">
            <div className="nog-bob">
              <Image
                src="/nog/landing-trio.png"
                alt="Three Nogs waving: a round baby Nog and two sprouting Nogs"
                width={1024}
                height={646}
                priority
                sizes="(min-width: 1024px) 1193px, 100vw"
                className="mx-auto h-auto w-full object-contain"
              />
            </div>

            <div
              aria-hidden="true"
              className="nog-float pointer-events-none absolute top-[6%] right-[2%] z-20 sm:top-[12%] sm:right-[10%] lg:top-[16%] lg:right-[16%]"
            >
              <div className="noggin-glass-pill flex h-14 items-center justify-center px-6 md:h-24 md:px-12">
                <span className="noggin-display text-[clamp(1.75rem,3vw,2.6875rem)] font-extrabold leading-none text-[var(--noggin-leaf-title)]">
                  Teach
                </span>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="nog-float nog-float-delay-1 pointer-events-none absolute bottom-[8%] left-[2%] z-20 sm:bottom-[14%] sm:left-[6%] lg:bottom-[22%] lg:left-[8%]"
            >
              <div className="noggin-glass-pill flex h-14 items-center justify-center px-6 md:h-24 md:px-12">
                <span className="noggin-display text-[clamp(1.75rem,3vw,2.6875rem)] font-extrabold leading-none text-[var(--noggin-leaf-title)]">
                  Learn
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-30 mt-6 flex w-full flex-col items-center gap-3 lg:absolute lg:right-8 lg:bottom-4 lg:mt-0 lg:w-auto lg:items-end xl:right-12 xl:bottom-8">
            <Link
              href="/signup"
              className="noggin-primary-pill noggin-display inline-flex h-16 min-h-11 w-full max-w-[343px] items-center justify-center px-8 text-[clamp(1.5rem,3vw,2.6875rem)] font-extrabold tracking-tight lg:h-[92px] lg:w-auto lg:max-w-none lg:px-12"
            >
              Hatch a Nog
            </Link>

            <Link
              href="/discover"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--noggin-radius-pill)] px-3 text-[1rem] text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80 lg:text-[1.25rem]"
            >
              <span>
                See how <strong className="font-bold">Noggin</strong> works ↓
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
