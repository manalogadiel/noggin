import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-16 md:px-10 lg:pt-10 lg:pb-24">
        <article className="mx-auto max-w-[68ch] rounded-[32px] bg-[var(--noggin-cream)] px-6 py-8 shadow-[0_18px_48px_var(--noggin-shadow)] sm:px-10 sm:py-12 lg:rounded-[48px] lg:px-14 lg:py-14">
          <header>
            <h1 className="noggin-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
              Terms of Service
            </h1>
            <p className="mt-2 text-[0.9375rem] text-[var(--noggin-ink)]">
              Last updated: 26 November 2026
            </p>
            <p className="mt-5 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
              These Terms govern your access to and use of Noggin
              (playnoggin.vercel.app), an AI-powered educational study web
              application operated by the Noggin team in the Philippines. By
              creating an account or using Noggin, you agree to these Terms and
              our{" "}
              <Link
                href="/privacy"
                className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
              >
                Privacy notice
              </Link>
              .
            </p>
          </header>

          <div className="mt-8 space-y-7 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                1. The Service
              </h2>
              <p className="mt-2">
                Noggin helps learners master subjects using the Feynman teaching
                technique: you teach concepts to a digital study companion
                (&ldquo;Nog&rdquo;), organize structured study notebooks, and
                verify retention with AI-assisted follow-up questions and
                practice quizzes. Noggin is strictly an educational study tool
                and is not a gambling or real-money wagering service.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                2. Accounts &amp; Age Eligibility
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Ages 6–12 (Under 13):
                  </strong>{" "}
                  Requires a valid parent or guardian email address at sign-up.
                  Accounts remain private with restricted social features (no
                  public Arena leaderboards or friend lists) and no data
                  collected for ads.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Ages 13 and older:
                  </strong>{" "}
                  Eligible to create a standard Noggin account with an email
                  address and password.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Under 6:
                  </strong>{" "}
                  Not permitted to create an account.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Paid Upgrades:
                  </strong>{" "}
                  Any optional purchase of Noggin Plus or digital Study Coin
                  packs requires an adult (18+) or parent/guardian permission.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                3. Pricing, Billing &amp; Digital Delivery
              </h2>
              <p className="mt-2">
                Noggin offers a free tier alongside optional paid Noggin Plus
                subscriptions (Monthly or Yearly) and one-time digital Study
                Coin packs as listed on our{" "}
                <Link
                  href="/pricing"
                  className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  Pricing page
                </Link>
                . Our order process and tax compliance are handled by our
                Merchant of Record,{" "}
                <strong className="font-bold text-[var(--noggin-forest)]">
                  Dodo Payments
                </strong>
                . All purchased subscriptions and digital Study Coins are
                delivered electronically inside your Noggin account immediately
                upon payment confirmation. Digital Study Coins have no monetary
                value outside Noggin and cannot be redeemed for cash or
                transferred between accounts.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                4. Cancellations &amp; Refunds
              </h2>
              <p className="mt-2">
                You may cancel a Noggin Plus subscription at any time before
                your next renewal date. Refund eligibility and request steps are
                detailed in our{" "}
                <Link
                  href="/refund"
                  className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  Refund &amp; Cancellation Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                5. Acceptable Use
              </h2>
              <p className="mt-2">
                You agree not to misuse Noggin, attempt to bypass rate limits or
                security controls, scrape or reverse-engineer our APIs, upload
                harmful or unlawful content, or use Noggin for academic
                dishonesty. We may suspend accounts that violate these rules.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                6. Your Content &amp; AI Output
              </h2>
              <p className="mt-2">
                You retain ownership of the study notes and lessons you write in
                Noggin. AI-generated follow-ups and quiz feedback are provided
                for educational study support and may occasionally be
                imperfect; always verify critical facts against official course
                materials.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                7. Governing Law &amp; Contact
              </h2>
              <p className="mt-2">
                These Terms are governed by the laws of the Republic of the
                Philippines. For questions, account help, or legal inquiries,
                email{" "}
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
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
