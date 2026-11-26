import Link from "next/link";
import { NogStage } from "@/components/nog-3d/nog-stage";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export default function LandingPage() {
  return (
    <div className="game-world game-world--public">
      <PublicHeader active="home" />

      <main className="landing-stage">
        <h1 className="sr-only">Noggin: raise a genius by teaching it</h1>

        <div className="hero-giant" aria-hidden="true">
          <span>RAISE A</span>
          <span>GENIUS</span>
        </div>

        <div className="landing-visual">
          <span className="glass-chip glass-chip--learn nog-float" aria-hidden="true">
            Learn
          </span>

          <div className="nog-bob w-full flex justify-center">
            <NogStage
              scene="trio"
              alt="Three Nogs waving: a round baby Nog and two sprouting Nogs"
              poster="/nog/landing-trio.png"
              width={1024}
              height={646}
              priority
              sizes="(min-width: 1024px) 740px, 90vw"
              className="mx-auto w-full max-w-[740px]"
            />
          </div>

          <span className="glass-chip glass-chip--teach nog-float nog-float-delay-1" aria-hidden="true">
            Teach
          </span>
        </div>

        <div className="landing-cta-anchor">
          <Link href="/signup" className="pub-cta-pill pub-cta-pill--hero">
            Hatch a Nog
          </Link>
          <Link href="/discover" className="link-soft">
            <span>
              See how <strong>Noggin</strong> works ↓
            </span>
          </Link>
        </div>
      </main>

      <PublicFooter compact />
    </div>
  );
}
