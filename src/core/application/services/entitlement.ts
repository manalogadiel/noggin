import type { QuotaResult, UsageKind, UsageRepository } from "../ports";

export class EntitlementService {
  constructor(private readonly usage: UsageRepository) {}

  async consume(
    userId: string,
    kind: UsageKind,
    amount: number = 1,
  ): Promise<QuotaResult> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Quota amount must be a positive number");
    }
    return this.usage.consumeQuota(userId, kind, amount);
  }
}

export function createEntitlementService(
  usage: UsageRepository,
): EntitlementService {
  return new EntitlementService(usage);
}
