import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-16 md:px-10 lg:pt-10 lg:pb-24">
        <article className="mx-auto max-w-[68ch] rounded-[32px] bg-[var(--noggin-cream)] px-6 py-8 shadow-[0_18px_48px_var(--noggin-shadow)] sm:px-10 sm:py-12 lg:rounded-[48px] lg:px-14 lg:py-14">
          <header>
            <h1 className="noggin-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
              Privacy notice
            </h1>
            <p className="mt-2 text-[0.9375rem] text-[var(--noggin-ink)]">
              Last updated: 26 November 2026
            </p>
            <p className="mt-5 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
              This notice explains in plain language how Noggin collects, uses,
              and protects your personal information under the Philippine Data
              Privacy Act (RA 10173).
            </p>
          </header>

          <div className="mt-8 space-y-7 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Who we are
              </h2>
              <p className="mt-2">
                Noggin is a learning app made by a student team (Gadiel Manalo,
                Aldred De Castro, Cindy Pauleen Mortel). Gadiel acts as our data
                protection officer.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                What we collect
              </h2>
              <p className="mt-2">
                We collect your email, name, and birthday; the lessons you teach
                your Nog and its thought cards; your quiz results; and how much
                you use the AI features (counts only). Mic recordings are turned
                into text and <strong className="font-bold text-[var(--noggin-forest)]">not kept</strong>.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Why
              </h2>
              <p className="mt-2">
                We use this information to run your account, let your Nog learn
                from your lessons, grade quizzes, keep the free daily limits
                fair, and keep Noggin safe.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Who helps us
              </h2>
              <p className="mt-2">
                We rely on trusted service providers to run Noggin: Supabase
                (database and sign-in, Singapore), Vercel (website hosting),
                Dodo Payments (payment processing and Merchant of Record for
                Noggin Plus and Coin Packs), Groq (AI that reads your lessons
                and turns speech into text; it does not train on our data), and
                Google Gemini (reads the Nog&apos;s answers aloud; it only
                receives the answer text). Data may be processed outside the
                Philippines.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                How long we keep it
              </h2>
              <p className="mt-2">
                We keep your account and learning data while your account is
                active. Usage counts are kept for 30 days. Delete your account
                and we erase your data within 30 days.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Your rights
              </h2>
              <p className="mt-2">
                Under the Philippine Data Privacy Act (RA 10173), you have the
                right to be informed, access, correct, erase or block, object,
                request data portability, and complain to the National Privacy
                Commission (privacy.gov.ph).
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Age &amp; Child Privacy
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Ages 6–12 (Under 13):
                  </strong>{" "}
                  Younger learners can use Noggin with a required parent or
                  guardian email address at sign-up (used for parent oversight
                  and account recovery). Under-13 accounts receive private
                  profiles, restricted social features (no public Arena
                  leaderboards, no adding friends, and no public sharing), and
                  stricter privacy protections — no personal information is
                  collected for ads or third-party marketing.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Ages 13 and older:
                  </strong>{" "}
                  Teens and adults (13+) can create a standard account with an
                  email address and password without needing a parent email,
                  with full access to Noggin features.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Under 18 &amp; Purchases:
                  </strong>{" "}
                  Users under 18 do not sign in using restricted
                  school-administered credentials and may still join lessons or
                  practice quizzes directly via browser. Any optional paid
                  upgrades require an adult (18+) or parent/guardian permission.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Security
              </h2>
              <p className="mt-2">
                We protect your data with encrypted connections, data encrypted
                at rest, and strict access rules so only you can see your
                Nog&apos;s notebook.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                Contact
              </h2>
              <p className="mt-2">
                Questions or requests: email the Noggin team at{" "}
                <a
                  href="mailto:gadielmanalo19@gmail.com"
                  className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  gadielmanalo19@gmail.com
                </a>
                .
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-[var(--noggin-panel)] pt-6">
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
            >
              Back to Sign up
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
