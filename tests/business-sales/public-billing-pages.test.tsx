// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PricingPage from "@/app/pricing/page";
import RefundPolicyPage from "@/app/refund/page";
import TermsPage from "@/app/terms/page";
import { PublicFooter } from "@/components/shell/public-footer";

afterEach(cleanup);

describe("Public billing compliance pages", () => {
  it("renders /pricing with Free tier, Noggin Plus plans, all 4 Study Coin packs, and Dodo Payments MoR notice", () => {
    render(<PricingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Simple Pricing/i }),
    ).toBeVisible();
    expect(screen.getByText(/₱0/)).toBeVisible();
    expect(screen.getAllByText(/₱249/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/₱1,990/)).toBeVisible();
    expect(screen.getByText("₱49")).toBeVisible();
    expect(screen.getByText("₱119")).toBeVisible();
    expect(screen.getByText("₱499")).toBeVisible();
    expect(screen.getAllByText(/Dodo Payments/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /Refund & Cancellation Policy/i })).toHaveAttribute(
      "href",
      "/refund",
    );
  });

  it("renders /terms with EdTech service scope, tiered age rules, Dodo Payments, and contact email", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeVisible();
    expect(screen.getByText(/Ages 6–12/i)).toBeVisible();
    expect(screen.getByText(/Ages 13 and older/i)).toBeVisible();
    expect(screen.getByText(/Dodo Payments/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "gadielmanalo19@gmail.com" }),
    ).toHaveAttribute("href", "mailto:gadielmanalo19@gmail.com");
  });

  it("renders /refund with cancellation steps, 14-day refund eligibility, and support email", () => {
    render(<RefundPolicyPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Refund & Cancellation Policy",
      }),
    ).toBeVisible();
    expect(screen.getAllByText(/14 days/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Dodo Payments/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole("link", { name: "gadielmanalo19@gmail.com" })[0],
    ).toHaveAttribute("href", "mailto:gadielmanalo19@gmail.com");
  });

  it("renders PublicFooter with @Noggin and links to Pricing, Terms, Refunds, Privacy, and Support", () => {
    render(<PublicFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("@Noggin");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Refunds" })).toHaveAttribute("href", "/refund");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "mailto:gadielmanalo19@gmail.com",
    );
  });
});
