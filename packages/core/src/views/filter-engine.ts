/**
 * Client-side filter/sort engine for the loaded record page (F-05).
 *
 * Codes against the pivoted shape get_database_records returns (see
 * queries/records.ts RecordItem): values keyed by property id, relation /
 * multi-select / person values as arrays, select as a string, number as a
 * number, date as an ISO string, checkbox as a boolean.
 *
 * // ponytail: client filter over the loaded page; the same ViewFilter[]
 * // compiles to EXISTS subqueries on get_database_records when a db paginates.
 */

import type { Json } from "../types/database.types";
import type { ViewConfig, ViewFilter, ViewSort } from "./view-config";

/** Minimal record shape — the pivoted row from get_database_records. */
export type ViewRecord = {
  id: string;
  values: Record<string, Json | undefined>;
  createdAt?: string;
  updatedAt?: string;
  position?: number;
};

/** Minimal property shape — a database_properties row. */
export type ViewProperty = {
  id: string;
  type: string;
  config_json: Json;
};

function isEmpty(value: Json | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asArray(value: Json | undefined): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value !== "") return [value];
  return [];
}

function toBool(value: Json | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "on" || value === "1" || value === 1) return true;
  return false;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** [start, end) range for the date `is_within` presets, plus overdue. */
function withinRange(
  preset: string,
  now: Date,
): { start: number; end: number } | { overdue: true } | null {
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { start: today.getTime(), end: addDays(today, 1).getTime() };
    case "this_week": {
      const start = addDays(today, -today.getDay());
      return { start: start.getTime(), end: addDays(start, 7).getTime() };
    }
    case "next_week": {
      const start = addDays(today, 7 - today.getDay());
      return { start: start.getTime(), end: addDays(start, 7).getTime() };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: start.getTime(), end: end.getTime() };
    }
    case "overdue":
      return { overdue: true };
    default:
      return null;
  }
}

function matchDate(operator: string, value: Json | undefined, filterValue: Json, now: Date): boolean {
  if (operator === "is_within") {
    const recTime = typeof value === "string" ? Date.parse(value) : NaN;
    if (Number.isNaN(recTime)) return false;
    const range = withinRange(String(filterValue), now);
    if (!range) return false;
    if ("overdue" in range) {
      return startOfDay(new Date(recTime)).getTime() < startOfDay(now).getTime();
    }
    return recTime >= range.start && recTime < range.end;
  }

  const recTime = typeof value === "string" ? Date.parse(value) : NaN;
  const filterTime = typeof filterValue === "string" ? Date.parse(filterValue) : NaN;
  if (Number.isNaN(recTime) || Number.isNaN(filterTime)) return false;
  // Compare at day granularity so time-of-day noise never flips a day filter.
  const rec = startOfDay(new Date(recTime)).getTime();
  const fil = startOfDay(new Date(filterTime)).getTime();
  switch (operator) {
    case "is":
      return rec === fil;
    case "is_before":
      return rec < fil;
    case "is_after":
      return rec > fil;
    case "is_on_or_before":
      return rec <= fil;
    case "is_on_or_after":
      return rec >= fil;
    default:
      return false;
  }
}

function matchNumber(operator: string, value: Json | undefined, filterValue: Json): boolean {
  const rec = typeof value === "number" ? value : Number(value);
  const fil = typeof filterValue === "number" ? filterValue : Number(filterValue);
  if (Number.isNaN(rec)) return operator === "neq";
  if (Number.isNaN(fil)) return false;
  switch (operator) {
    case "eq":
      return rec === fil;
    case "neq":
      return rec !== fil;
    case "gt":
      return rec > fil;
    case "lt":
      return rec < fil;
    case "gte":
      return rec >= fil;
    case "lte":
      return rec <= fil;
    default:
      return false;
  }
}

function matchText(operator: string, value: Json | undefined, filterValue: Json): boolean {
  const rec = value == null ? "" : String(value);
  const fil = filterValue == null ? "" : String(filterValue);
  switch (operator) {
    case "is":
      return rec === fil;
    case "is_not":
      return rec !== fil;
    case "contains":
      return rec.toLowerCase().includes(fil.toLowerCase());
    case "not_contains":
      return !rec.toLowerCase().includes(fil.toLowerCase());
    default:
      return false;
  }
}

function matchFilter(
  filter: ViewFilter,
  property: ViewProperty | undefined,
  record: ViewRecord,
  now: Date,
): boolean {
  const value = record.values[filter.property_id];

  if (filter.operator === "is_empty") return isEmpty(value);
  if (filter.operator === "is_not_empty") return !isEmpty(value);
  if (!property) return true; // unknown property never filters anything out

  switch (property.type) {
    case "number":
      return matchNumber(filter.operator, value, filter.value);
    case "date":
      return matchDate(filter.operator, value, filter.value, now);
    case "checkbox":
      return filter.operator === "is" ? toBool(value) === toBool(filter.value) : false;
    case "select":
      // Stored as a single string; is/is_not are exact.
      return matchText(filter.operator, value, filter.value);
    case "multi-select":
    case "relation":
    case "person": {
      const members = asArray(value);
      const target = filter.value == null ? "" : String(filter.value);
      if (filter.operator === "contains") return members.includes(target);
      if (filter.operator === "not_contains") return !members.includes(target);
      return false;
    }
    case "text":
    default:
      return matchText(filter.operator, value, filter.value);
  }
}

/** Compile filters (implicit AND) into a record predicate. */
export function compileFilter(
  filters: ViewFilter[],
  properties: ViewProperty[],
  now: Date = new Date(),
): (record: ViewRecord) => boolean {
  const byId = new Map(properties.map((p) => [p.id, p]));
  return (record) =>
    filters.every((filter) => matchFilter(filter, byId.get(filter.property_id), record, now));
}

function optionOrder(config: Json): Map<string, number> {
  const order = new Map<string, number>();
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const options = (config as { options?: unknown }).options;
    if (Array.isArray(options)) {
      options.forEach((opt, index) => {
        const name = opt && typeof opt === "object" ? (opt as { name?: unknown }).name : opt;
        if (typeof name === "string") order.set(name, index);
      });
    }
  }
  return order;
}

/**
 * Compare two record values for a property. Empty always sorts last (both
 * directions); the caller applies direction to the non-empty comparison.
 */
function compareValues(
  property: ViewProperty | undefined,
  a: Json | undefined,
  b: Json | undefined,
): number {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  switch (property?.type) {
    case "number":
      return Number(a) - Number(b);
    case "date": {
      const at = typeof a === "string" ? Date.parse(a) : NaN;
      const bt = typeof b === "string" ? Date.parse(b) : NaN;
      return (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
    }
    case "checkbox":
      return Number(toBool(a)) - Number(toBool(b));
    case "select": {
      const order = optionOrder(property.config_json);
      const ai = order.has(String(a)) ? order.get(String(a))! : Number.MAX_SAFE_INTEGER;
      const bi = order.has(String(b)) ? order.get(String(b))! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a).localeCompare(String(b));
    }
    case "multi-select":
    case "relation":
    case "person":
      return asArray(a).join(",").localeCompare(asArray(b).join(","));
    default:
      return String(a).localeCompare(String(b));
  }
}

/** Compile a multi-level sort into a comparator. */
export function compileSort(
  sorts: ViewSort[],
  properties: ViewProperty[],
): (a: ViewRecord, b: ViewRecord) => number {
  const byId = new Map(properties.map((p) => [p.id, p]));
  return (a, b) => {
    for (const sort of sorts) {
      const av = a.values[sort.property_id];
      const bv = b.values[sort.property_id];
      // Empty always sorts last, independent of direction.
      const aEmpty = isEmpty(av);
      const bEmpty = isEmpty(bv);
      if (aEmpty && bEmpty) continue;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const cmp = compareValues(byId.get(sort.property_id), av, bv);
      if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  };
}

/** Filter then sort a loaded record page against a normalized ViewConfig. */
export function applyView<T extends ViewRecord>(
  records: T[],
  config: ViewConfig,
  properties: ViewProperty[],
  now: Date = new Date(),
): T[] {
  const predicate = compileFilter(config.filters, properties, now);
  const filtered = records.filter(predicate);
  if (config.sorts.length === 0) return filtered;
  const comparator = compileSort(config.sorts, properties);
  // Stable sort: Array.prototype.sort is stable in modern engines.
  return [...filtered].sort(comparator);
}
