import { describe, expect, it } from "vitest";
import { createInMemoryPorts } from "@/core/application/testing/fakes";
import {
  cancelNogginPlus,
  checkoutCoinPack,
  getBillingSummary,
  subscribeNogginPlus,
} from "@/core/application/use-cases/billing";

describe("billing & business sales use cases", () => {
  it("rejects unauthenticated callers consistently", async () => {
    const { deps, setUser } = createInMemoryPorts();
    setUser(null);

    await expect(
      getBillingSummary({ currentUser: deps.currentUser, billing: deps.billing }),
    ).resolves.toEqual({ status: "unauthenticated" });
    await expect(
      checkoutCoinPack(
        {
          currentUser: deps.currentUser,
          billing: deps.billing,
          paymentGateway: deps.paymentGateway,
        },
        { productCode: "coins_300", idempotencyKey: "key-1" },
      ),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("fulfills coin pack checkouts idempotently and credits player economy balance", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "buyer-1" });
    const ctx = {
      currentUser: deps.currentUser,
      billing: deps.billing,
      paymentGateway: deps.paymentGateway,
    };

    const wrongKind = await checkoutCoinPack(ctx, {
      productCode: "plus_monthly",
      idempotencyKey: "k-wrong",
    });
    expect(wrongKind).toMatchObject({ status: "invalid", code: "wrong_product_kind" });

    const first = await checkoutCoinPack(ctx, {
      productCode: "c300",
      idempotencyKey: "k-topup-1",
    });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expect(first.coinsAdded).toBe(320);
    expect(first.order.status).toBe("paid");
    expect(stores.economy.get("buyer-1")?.coins).toBe(560);

    const replay = await checkoutCoinPack(ctx, {
      productCode: "c300",
      idempotencyKey: "k-topup-1",
    });
    expect(replay.status).toBe("ok");
    if (replay.status === "ok") {
      expect(replay.order.id).toBe(first.order.id);
    }
    expect(stores.economy.get("buyer-1")?.coins).toBe(560);
  });

  it("activates Noggin Plus, unlocks all skin packs, exposes summary, and cancels renewal cleanly", async () => {
    const { deps, stores } = createInMemoryPorts({ userId: "plus-user" });
    const ctx = {
      currentUser: deps.currentUser,
      billing: deps.billing,
      paymentGateway: deps.paymentGateway,
    };

    const sub = await subscribeNogginPlus(ctx, {
      productCode: "plus_yearly",
      idempotencyKey: "sub-key-1",
    });
    expect(sub.status).toBe("ok");
    if (sub.status === "ok") {
      expect(sub.planCode).toBe("plus");
    }

    const econ = stores.economy.get("plus-user");
    expect(econ?.ownedSkinPacks).toEqual({
      pastel: true,
      neon: true,
      dark: true,
      sunset: true,
    });

    const summary = await getBillingSummary({
      currentUser: deps.currentUser,
      billing: deps.billing,
    });
    expect(summary.status).toBe("ok");
    if (summary.status === "ok") {
      expect(summary.summary.planCode).toBe("plus");
      expect(summary.summary.subscription?.cancelAtPeriodEnd).toBe(false);
      expect(summary.summary.recentOrders).toHaveLength(1);
      expect(summary.summary.products).toHaveLength(6);
    }

    const cancelled = await cancelNogginPlus({
      currentUser: deps.currentUser,
      billing: deps.billing,
    });
    expect(cancelled.status).toBe("ok");
    if (cancelled.status === "ok") {
      expect(cancelled.subscription.cancelAtPeriodEnd).toBe(true);
    }
  });
});
