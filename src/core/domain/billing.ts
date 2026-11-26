export type SalesProductCode =
  | "coins_100"
  | "coins_300"
  | "coins_750"
  | "coins_1800"
  | "plus_monthly"
  | "plus_yearly";

export type SalesProductKind = "coin_pack" | "subscription";
export type BillingInterval = "month" | "year";
export type BillingOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "past_due";

export interface SalesProduct {
  code: SalesProductCode;
  uiId: string;
  kind: SalesProductKind;
  name: string;
  priceCentavos: number;
  currency: "PHP";
  coinsGrant: number;
  bonusCoins: number;
  billingInterval: BillingInterval | null;
  active: boolean;
}

export interface BillingOrder {
  id: string;
  userId: string;
  productCode: SalesProductCode;
  idempotencyKey: string;
  status: BillingOrderStatus;
  amountCentavos: number;
  currency: string;
  provider: string;
  providerRef: string | null;
  coinsCredited: number;
  paidAt: string | null;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  planCode: "free" | "plus";
  productCode: SalesProductCode;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: string;
  providerSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  planCode: "free" | "plus";
  subscription: SubscriptionRecord | null;
  recentOrders: BillingOrder[];
  products: SalesProduct[];
}

export const SALES_CATALOG: readonly SalesProduct[] = [
  {
    code: "coins_100",
    uiId: "c100",
    kind: "coin_pack",
    name: "100 Coins",
    priceCentavos: 4900,
    currency: "PHP",
    coinsGrant: 100,
    bonusCoins: 0,
    billingInterval: null,
    active: true,
  },
  {
    code: "coins_300",
    uiId: "c300",
    kind: "coin_pack",
    name: "300 Coins + 20 Bonus",
    priceCentavos: 11900,
    currency: "PHP",
    coinsGrant: 300,
    bonusCoins: 20,
    billingInterval: null,
    active: true,
  },
  {
    code: "coins_750",
    uiId: "c750",
    kind: "coin_pack",
    name: "750 Coins + 100 Bonus",
    priceCentavos: 24900,
    currency: "PHP",
    coinsGrant: 750,
    bonusCoins: 100,
    billingInterval: null,
    active: true,
  },
  {
    code: "coins_1800",
    uiId: "c1800",
    kind: "coin_pack",
    name: "1,800 Coins + 350 Bonus",
    priceCentavos: 49900,
    currency: "PHP",
    coinsGrant: 1800,
    bonusCoins: 350,
    billingInterval: null,
    active: true,
  },
  {
    code: "plus_monthly",
    uiId: "plus_monthly",
    kind: "subscription",
    name: "Noggin Plus Monthly",
    priceCentavos: 24900,
    currency: "PHP",
    coinsGrant: 0,
    bonusCoins: 0,
    billingInterval: "month",
    active: true,
  },
  {
    code: "plus_yearly",
    uiId: "plus_yearly",
    kind: "subscription",
    name: "Noggin Plus Yearly",
    priceCentavos: 199000,
    currency: "PHP",
    coinsGrant: 0,
    bonusCoins: 0,
    billingInterval: "year",
    active: true,
  },
] as const;

export function findSalesProduct(codeOrUiId: string): SalesProduct | null {
  return (
    SALES_CATALOG.find(
      (item) => item.active && (item.code === codeOrUiId || item.uiId === codeOrUiId),
    ) ?? null
  );
}

export function totalCoinsForProduct(product: SalesProduct): number {
  return product.kind === "coin_pack"
    ? product.coinsGrant + product.bonusCoins
    : 0;
}

export function formatPhpCentavos(centavos: number): string {
  const wholePesos = Math.round(centavos / 100);
  return `₱${wholePesos.toLocaleString("en-US")}`;
}

export function computePeriodEnd(start: Date, interval: BillingInterval): Date {
  const end = new Date(start.getTime());
  if (interval === "year") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

export function yearlySavingsPercent(
  monthlyCentavos: number,
  yearlyCentavos: number,
): number {
  const annualized = monthlyCentavos * 12;
  if (annualized <= 0) return 0;
  return Math.max(0, Math.round(((annualized - yearlyCentavos) / annualized) * 100));
}
