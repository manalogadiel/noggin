import { describe, expect, it } from "vitest";
import {
  computePeriodEnd,
  findSalesProduct,
  formatPhpCentavos,
  SALES_CATALOG,
  totalCoinsForProduct,
  yearlySavingsPercent,
} from "@/core/domain/billing";

describe("billing domain rules", () => {
  it("resolves products by canonical code or UI pack id", () => {
    const c750 = findSalesProduct("c750");
    expect(c750).not.toBeNull();
    expect(c750?.code).toBe("coins_750");
    expect(c750 ? totalCoinsForProduct(c750) : 0).toBe(850);

    const plusYearly = findSalesProduct("plus_yearly");
    expect(plusYearly?.billingInterval).toBe("year");
    expect(plusYearly ? totalCoinsForProduct(plusYearly) : -1).toBe(0);

    expect(findSalesProduct("nonexistent")).toBeNull();
  });

  it("formats PHP centavos and computes yearly subscription savings", () => {
    expect(SALES_CATALOG).toHaveLength(6);
    expect(formatPhpCentavos(24900)).toBe("₱249");
    expect(formatPhpCentavos(199000)).toBe("₱1,990");
    expect(yearlySavingsPercent(24900, 199000)).toBe(33);
  });

  it("computes monthly and yearly billing period end dates cleanly", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    expect(computePeriodEnd(start, "month").toISOString()).toBe(
      "2026-02-15T00:00:00.000Z",
    );
    expect(computePeriodEnd(start, "year").toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
  });
});
