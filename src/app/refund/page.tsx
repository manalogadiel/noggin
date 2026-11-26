import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
};

export default function RefundPolicyPage() {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-16 md:px-10 lg:pt-10 lg:pb-24">
        <article className="mx-auto max-w-[68ch] rounded-[32px] bg-[var(--noggin-cream)] px-6 py-8 shadow-[0_18px_48px_var(--noggin-shadow)] sm:px-10 sm:py-12 lg:rounded-[48px] lg:px-14 lg:py-14">
          <header>
            <h1 className="noggin-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
              Refund &amp; Cancellation Policy
            </h1>
            <p className="mt-2 text-[0.9375rem] text-[var(--noggin-ink)]">
              Last updated: 26 November 2026
            </p>
            <p className="mt-5 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
              We want every learner and family to feel confident using Noggin.
              Payments for Noggin Plus and digital Study Coin packs are
              processed by our Merchant of Record,{" "}
              <strong className="font-bold text-[var(--noggin-forest)]">
                Dodo Payments
              </strong>
              .
            </p>
          </header>

          <div className="mt-8 space-y-7 text-[1rem] leading-[1.65] text-[var(--noggin-ink)]">
            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                1. Cancelling Noggin Plus
              </h2>
              <p className="mt-2">
                You can cancel your Monthly or Yearly Noggin Plus subscription
                at any time from your Noggin account billing settings or by
                emailing{" "}
                <a
                  href="mailto:gadielmanalo19@gmail.com"
                  className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  gadielmanalo19@gmail.com
                </a>
                . After cancellation, you keep full Noggin Plus access until the
                end of your current paid billing period, and you will not be
                charged again.
              </p>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                2. 14-Day Refund Eligibility
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Noggin Plus Subscriptions:
                  </strong>{" "}
                  Eligible for a full refund within{" "}
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    14 days
                  </strong>{" "}
                  of your initial purchase or an accidental renewal.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Digital Study Coin Packs:
                  </strong>{" "}
                  Eligible for a full refund within{" "}
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    14 days
                  </strong>{" "}
                  of purchase if the coins have not been spent in-app.
                </li>
                <li>
                  <strong className="font-bold text-[var(--noggin-forest)]">
                    Billing Errors or Failed Delivery:
                  </strong>{" "}
                  Duplicate charges, unauthorized purchases (including
                  unapproved purchases made by minors), or technical delivery
                  failures are always eligible for a full refund regardless of
                  timing.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="noggin-display text-[1.375rem] font-bold text-[var(--noggin-forest)]">
                3. How to Request a Refund
              </h2>
              <p className="mt-2">
                Send an email to{" "}
                <a
                  href="mailto:gadielmanalo19@gmail.com"
                  className="font-bold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4"
                >
                  gadielmanalo19@gmail.com
                </a>{" "}
                with the email address on your Noggin account and your Dodo
                Payments receipt or order ID. We review requests within 2
                business days, and approved refunds are returned via Dodo
                Payments to your original payment method (typically within 5–10
                business days depending on your bank or e-wallet).
              </p>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap gap-6 border-t border-[var(--noggin-panel)] pt-6">
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
            >
              View Pricing
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center font-semibold text-[var(--noggin-forest)] underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
            >
              Terms of Service
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
