export const USER_PLANS = ["free", "plus", "pro"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

/** Storage caps per PRD tier (Free 5 GB; Plus/Pro per product economics). */
export const STORAGE_CAP_BYTES_BY_PLAN = {
  free: 5 * 1024 * 1024 * 1024,
  plus: 50 * 1024 * 1024 * 1024,
  pro: 200 * 1024 * 1024 * 1024,
} as const satisfies Record<UserPlan, number>;

export function isUserPlan(value: string | null | undefined): value is UserPlan {
  return value === "free" || value === "plus" || value === "pro";
}

export function storageCapBytesForPlan(plan: UserPlan): number {
  return STORAGE_CAP_BYTES_BY_PLAN[plan];
}

/** True when adding `incomingBytes` to `usedBytes` would exceed the plan cap. */
export function exceedsStorageCap(
  usedBytes: number,
  incomingBytes: number,
  plan: UserPlan,
): boolean {
  return usedBytes + incomingBytes > storageCapBytesForPlan(plan);
}
