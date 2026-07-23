import "server-only";

import type { UserPlan } from "@planevo/core/types/plans";
import { isUserPlan } from "@planevo/core/types/plans";
import type { DataAccess } from "@/lib/data/access";

/**
 * Resolve the billing plan that determines a user's storage cap. Reads
 * `user_billing.plan` (written server/webhook side once Stripe ships); no row
 * means free. `PLANEVO_DEV_USER_PLAN` overrides for local testing.
 */
export async function resolveUserPlan(access: DataAccess): Promise<UserPlan> {
  const override = process.env.PLANEVO_DEV_USER_PLAN?.trim();
  if (isUserPlan(override)) return override;

  const { data, error } = await access.client
    .from("user_billing")
    .select("plan")
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) {
    // Fail safe to the smallest cap rather than 500 the files page — e.g. if the
    // code deploys before the user_billing migration is applied.
    console.warn("[user-plan] falling back to free plan:", error.message);
    return "free";
  }
  return isUserPlan(data?.plan) ? data.plan : "free";
}
