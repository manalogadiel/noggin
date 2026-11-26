import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";
import {
  formatPhpCentavos,
  SALES_CATALOG,
  yearlySavingsPercent,
} from "@/core/domain/billing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Noggin AI study plans and optional digital Study Coin packs.",
};

export default function PricingPage() {
  const coinPacks = SALES_CATALOG.filter((item) => item.kind === "coin_pack");
  const plusMonthly = SALES_CATALOG.find((item) => item.code === "plus_monthly");
  const plusYearly = SALES_CATALOG.find((item) => item.code === "plus_yearly");
  const savingsPct =
    plusMonthly && plusYearly
      ? yearlySavingsPercent(plusMonthly.priceCentavos, plusYearly.priceCentavos)
      : 33;

  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pt-6 pb-14 md:px-10 lg:pt-10 lg:pb-20">
        <section className="mx-auto rounded-[32px] bg-[var(--noggin-cream)] px-6 py-8 shadow-[0_18px_48px_var(--noggin-shadow)] sm:px-10 sm:py-12 lg:rounded-[48px] lg:px-14 lg:py-14">
          <header className="max-w-[64ch]">
            <h1 className="noggin-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
              Simple Pricing for Smarter Studying
            </h1>
            <p className="mt-3 text-[1.0625rem] leading-[1.6] text-[var(--noggin-ink)]">
              Noggin is an AI-powered educational study web app built around the
              Feynman teaching technique. Start free forever, or upgrade anytime
              for unlimited study notebooks and extra digital study tools.
            </p>
          </header>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <article className="flex flex-col justify-between rounded-[24px] bg-[var(--noggin-white)] p-6 shadow-[0_6px_0_var(--ng-c-e4d8ba),0_14px_28px_var(--noggin-shadow)]">
              <div>
                <p className="text-[0.8125rem] font-bold uppercase tracking-wider text-[var(--noggin-leaf-strong)]">
                  Free Plan
                </p>
                <h2 className="noggin-display mt-1 text-[1.75rem] font-bold text-[var(--noggin-forest)]">
                  ₱0{" "}
                  <span className="text-[1rem] font-medium text-[var(--noggin-ink)]">
                    / forever
                  </span>
                </h2>
                <p className="mt-2 text-[0.95rem] text-[var(--noggin-ink)]">
                  Everything you need to start teaching your Nog and testing your
                  understanding.
                </p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-[0.95rem] text-[var(--noggin-ink)]">
                  <li>Teach lessons in your own words (text or voice)</li>
                  <li>AI follow-up questions and interactive practice quizzes</li>
                  <li>Up to 5 study notebooks (20 thought-card pages each)</li>
                  <li>
                    Private, ad-free learner mode automatically enabled for ages
                    6–12
                  </li>
                </ul>
              </div>
              <div className="mt-6">
                <Link
                  href="/signup"
                  className="gbtn gbtn--leaf inline-flex min-h-11 items-center justify-center px-6 no-underline"
                >
                  Start Free
                </Link>
              </div>
            </article>

            <article className="flex flex-col justify-between rounded-[24px] bg-[var(--noggin-mint)] p-6 shadow-[0_6px_0_var(--lip-leaf),0_16px_32px_var(--noggin-shadow)]">
              <div>
                <p className="text-[0.8125rem] font-bold uppercase tracking-wider text-[var(--noggin-forest)]">
                  Noggin Plus Subscription
                </p>
                <h2 className="noggin-display mt-1 text-[1.75rem] font-bold text-[var(--noggin-forest)]">
                  {plusMonthly
                    ? formatPhpCentavos(plusMonthly.priceCentavos)
                    : "₱249"}{" "}
                  <span className="text-[1rem] font-medium text-[var(--noggin-ink)]">
                    / month
                  </span>
                </h2>
                <p className="mt-1 text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
                  Or{" "}
                  {plusYearly
                    ? formatPhpCentavos(plusYearly.priceCentavos)
                    : "₱1,990"}{" "}
                  / year (Save {savingsPct}%)
                </p>
                <p className="mt-2 text-[0.95rem] text-[var(--noggin-ink)]">
                  Built for students preparing for exams across multiple
                  subjects.
                </p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-[0.95rem] text-[var(--noggin-ink)]">
                  <li>Unlimited study notebooks (up to 60 pages per notebook)</li>
                  <li>Extended AI study context and higher daily allowances</li>
                  <li>2× monthly Streak Restore shields included</li>
                  <li>All 4 Nog companion color packs unlocked automatically</li>
                  <li>Cancel anytime with no lock-in</li>
                </ul>
              </div>
              <div className="mt-6">
                <Link
                  href="/signup"
                  className="pub-cta-pill pub-cta-pill--md inline-flex min-h-11 items-center justify-center px-6 no-underline"
                >
                  Get Noggin Plus
                </Link>
              </div>
            </article>
          </div>

          <section className="mt-12">
            <h2 className="noggin-display text-[1.5rem] font-bold text-[var(--noggin-forest)]">
              One-Time Digital Study Coin Packs
            </h2>
            <p className="mt-2 max-w-[66ch] text-[0.95rem] text-[var(--noggin-ink)]">
              Optional one-time digital study credits used inside the Noggin web
              app to expand individual notebook page limits, purchase Streak
              Restore shields, and unlock study companion accessories — no
              subscription required.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {coinPacks.map((pack) => (
                <div
                  key={pack.code}
                  className="flex flex-col justify-between rounded-[20px] bg-[var(--noggin-white)] p-5 shadow-[0_5px_0_var(--ng-c-e4d8ba),0_12px_24px_var(--noggin-shadow)]"
                >
                  <div>
                    <h3 className="noggin-display text-[1.0625rem] font-bold text-[var(--noggin-forest)]">
                      {pack.name}
                    </h3>
                    <p className="mt-1 text-[0.875rem] text-[var(--noggin-ink)]">
                      One-time digital delivery
                    </p>
                  </div>
                  <p className="noggin-display mt-4 text-[1.5rem] font-bold text-[var(--noggin-forest)]">
                    {formatPhpCentavos(pack.priceCentavos)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-[20px] bg-[var(--noggin-white)] p-6 text-[0.9375rem] leading-[1.6] text-[var(--noggin-ink)] shadow-[0_5px_0_var(--ng-c-e4d8ba),0_12px_24px_var(--noggin-shadow)]">
            <h2 className="noggin-display text-[1.125rem] font-bold text-[var(--noggin-forest)]">
              Billing, Delivery &amp; Policies
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-[var(--noggin-forest)]">
                  Instant Digital Delivery:
                </strong>{" "}
                Noggin Plus access and digital Study Coins are delivered
                instantly to your account in the web app upon payment
                confirmation.
              </li>
              <li>
                <strong className="text-[var(--noggin-forest)]">
                  Secure Merchant of Record:
                </strong>{" "}
                All payments, invoicing, and applicable sales taxes are
                processed by{" "}
                <strong className="text-[var(--noggin-forest)]">
                  Dodo Payments
                </strong>{" "}
                (supporting major cards and Philippine e-wallets including
                GCash).
              </li>
              <li>
                <strong className="text-[var(--noggin-forest)]">
                  Eligibility &amp; Refunds:
                </strong>{" "}
                Optional paid purchases require an adult (18+) or
                parent/guardian permission. See our{" "}
                <Link
                  href="/refund"
                  className="font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  Refund &amp; Cancellation Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  className="font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  Terms of Service
                </Link>
                , or contact{" "}
                <a
                  href="mailto:gadielmanalo19@gmail.com"
                  className="font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  gadielmanalo19@gmail.com
                </a>
                .
              </li>
            </ul>
          </section>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
