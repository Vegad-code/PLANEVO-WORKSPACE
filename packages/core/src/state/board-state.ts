export type BoardColumn<T> = {
  key: string;
  label: string;
  items: T[];
};

export const NO_GROUP_LABEL = "No status";

/**
 * Groups items into board columns: every configured option gets a column (in
 * configured order, even when empty), values outside the configured options
 * get appended columns in first-seen order, and items with no group value land
 * in a trailing "No status" lane. Nothing is ever silently dropped.
 */
export function groupIntoColumns<T>(
  items: T[],
  getGroupValue: (item: T) => string | null,
  configuredOptions: string[],
): BoardColumn<T>[] {
  const columns = new Map<string, T[]>(
    configuredOptions.map((option) => [option, []]),
  );
  const ungrouped: T[] = [];

  for (const item of items) {
    const value = getGroupValue(item)?.trim() || null;
    if (value === null) {
      ungrouped.push(item);
      continue;
    }
    const bucket = columns.get(value) ?? [];
    if (!columns.has(value)) columns.set(value, bucket);
    bucket.push(item);
  }

  const result: BoardColumn<T>[] = [...columns.entries()].map(([key, bucket]) => ({
    key,
    label: key,
    items: bucket,
  }));
  if (ungrouped.length > 0) {
    result.push({ key: "__no_group__", label: NO_GROUP_LABEL, items: ungrouped });
  }
  return result;
}
