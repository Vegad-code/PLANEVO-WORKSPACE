import "server-only";

import { summarizeStorageBytes } from "@planevo/core/queries/product-files";
import {
  exceedsStorageCap,
  storageCapBytesForPlan,
} from "@planevo/core/types/plans";
import type { UserPlan } from "@planevo/core/types/plans";
import type { DataAccess } from "@/lib/data/access";
import { formatBytes } from "@/features/files-product/storage-meter";
import { resolveUserPlan } from "@/lib/files/user-plan";

/** Thrown when an upload would push a user past their plan's storage cap (→ 413). */
export class StorageQuotaError extends Error {
  readonly plan: UserPlan;
  readonly capBytes: number;
  constructor(plan: UserPlan, capBytes: number) {
    super(
      `Storage limit reached (${formatBytes(capBytes)} on the ${plan} plan). Delete files or upgrade to add more.`,
    );
    this.name = "StorageQuotaError";
    this.plan = plan;
    this.capBytes = capBytes;
  }
}

/**
 * Total stored bytes across ALL of a user's files — every bucket, every upload
 * path — since each path writes a `file_sources` row. This is the number that
 * both the storage meter and the quota guard measure against the plan cap.
 */
export async function loadUsedStorageBytes(access: DataAccess): Promise<number> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("size_bytes,storage_path")
    .eq("user_id", access.ownerId);
  if (error) throw error;
  return summarizeStorageBytes(
    (data ?? []).filter((file) => !file.storage_path.startsWith("local:")),
  );
}

/**
 * Reject an upload that would exceed the caller's plan storage cap. Call from
 * every upload entry point before minting a signed URL or storing bytes.
 *
 * ponytail: read-then-check with no lock — racy under concurrent uploads, but
 * every path caps a single file at 25 MB, so the worst-case overshoot is bounded.
 * Upgrade path: fold the sum + reservation into one SQL RPC if metering ever
 * bills real money.
 */
export async function enforceStorageQuota(
  access: DataAccess,
  incomingBytes: number,
): Promise<void> {
  const [usedBytes, plan] = await Promise.all([
    loadUsedStorageBytes(access),
    resolveUserPlan(access),
  ]);
  if (exceedsStorageCap(usedBytes, incomingBytes, plan)) {
    throw new StorageQuotaError(plan, storageCapBytesForPlan(plan));
  }
}
