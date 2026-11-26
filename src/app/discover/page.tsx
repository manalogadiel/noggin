import type { Metadata } from "next";
import Link from "next/link";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export const metadata: Metadata = {
  title: "Discover",
};

export default function DiscoverPage() {
  return (
    <div className="game-world game-world--public game-world--scroll">
      <PublicHeader active="discover" />

      <main>
        <section className="discover-hero-band">
          <div className="discover-hero">
            <div className="discover-hero__copy">
              <h1 className="discover-h1">
                Hello, your
                <br />
                <span className="nog-boxed">
                  NOG
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                </span>{" "}
                is
                <br />
                waiting
              </h1>
              <Link href="/signup" className="pub-cta-pill pub-cta-pill--discover-hero">
                Hatch a Nog
              </Link>
            </div>

            <div className="discover-art">
              <div className="sun-disc" aria-hidden="true" />
              <div className="nog-bob relative z-[2] w-full flex justify-center">
                <NogStage
                  scene="flying"
                  alt="A sprouting Nog flying with a book"
                  poster="/nog/flying-book.png"
                  width={1254}
                  height={1254}
                  priority
                  sizes="(min-width: 1024px) 675px, 88vw"
                  className="w-full max-w-[675px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="discover-cream-band">
          <div className="discover-cream-band__inner">
            <h2 className="m-0">
              <span className="discover-kicker block">Big things hatch at </span>
              <span className="discover-brand-big block">Noggin</span>
            </h2>

            <p className="discover-copy">
              Whether you&apos;re <strong>mastering a subject</strong> or{" "}
              <strong>challenging your classmates</strong>, <strong>Noggin</strong> turns learning
              into a growing friendship. <strong>Hatch your Nog</strong>, teach it in your own
              words, and watch it grow from a curious little creature into a genius.{" "}
              <strong>
                Make it yours, put its knowledge to the test, and grow smarter together.
              </strong>
            </p>

            <div className="discover-showcase discover-showcase--unified">
              <ul className="discover-feature-grid" aria-label="What you can do">
                <li className="discover-pill discover-pill--l1">Make it Yours</li>
                <li className="discover-pill discover-pill--l2">Watch It Grow</li>
                <li className="discover-pill discover-pill--l3">Teach a Lesson</li>
                <li className="discover-pill discover-pill--r1">Hatch a Nog</li>
                <li className="discover-pill discover-pill--r2">Challenge Friends</li>
                <li className="discover-pill discover-pill--r3">Climb the Ranks</li>
              </ul>

              <div className="discover-pedestal-wrap discover-pedestal-wrap--center">
                <div className="nog-bob relative z-[2] w-[300px]">
                  <NogStage
                    scene="thinking"
                    alt="A Nog thinking"
                    poster="/nog/thinking.png"
                    width={1254}
                    height={1254}
                    sizes="300px"
                    className="w-full"
                  />
                </div>
                <div className="discover-pedestal" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="discover-cta-band">
          <div className="discover-cta-card">
            <div className="nog-bob mx-auto w-[270px]">
              <NogStage
                scene="peek"
                alt="A Nog peeking out of its eggshell"
                poster="/nog/egg-peek.png"
                width={1192}
                height={1320}
                sizes="270px"
                className="w-full"
              />
            </div>
            <div>
              <h2
                className="stage-h1"
                style={{ fontSize: "clamp(28px, 3.6vw, 44px)", color: "var(--ng-c-7ca847)" }}
              >
                Ready to hatch your own Nog?
              </h2>
              <p className="stage-sub" style={{ margin: "8px 0 22px", fontSize: 17 }}>
                Start learning, growing, and competing today.
              </p>
              <Link href="/signup" className="pub-cta-pill pub-cta-pill--md">
                Get Started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
