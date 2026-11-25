import { createHash } from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentResult,
} from "@/core/application/ports";

export function createSandboxPaymentGateway(): PaymentGateway {
  return {
    providerName: "sandbox",
    async authorizePurchase(input): Promise<PaymentIntentResult> {
      const digest = createHash("sha256")
        .update(`${input.userId}:${input.product.code}:${input.idempotencyKey}`)
        .digest("hex")
        .slice(0, 16);

      return {
        provider: "sandbox",
        providerRef: `sbx_${digest}`,
      };
    },
  };
}
