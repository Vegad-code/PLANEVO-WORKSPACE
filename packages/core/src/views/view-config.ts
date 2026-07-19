/**
 * Canonical ViewConfig contract (F-05). views.config_json is user-writable
 * jsonb, so `normalizeViewConfig` tolerates anything ({}, junk, partial) and
 * never throws — it is the trust boundary between stored config and the engine.
 */

import type { Json } from "../types/database.types";
import type { PropertyType } from "../types/property-types";

export type ViewFilter = {
  id: string;
  property_id: string;
  operator: string;
  value: Json;
};

export type ViewSort = {
  property_id: string;
  direction: "asc" | "desc";
};

export type ViewConfig = {
  filters: ViewFilter[]; // implicit AND (V1)
  sorts: ViewSort[]; // multi-level, ordered
  group_by_property_id: string | null;
  visible_properties: string[] | null; // null = all; ordering doubles as column order
  column_widths: Record<string, number>;
  calendar_date_property_id: string | null;
  collapsed_groups: string[];
};

/** Operator sets per property type (F-05). UI drives its options from this. */
export const OPERATORS_BY_TYPE: Record<PropertyType, readonly string[]> = {
  text: ["is", "is_not", "contains", "not_contains", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", "is_empty", "is_not_empty"],
  select: ["is", "is_not", "is_empty", "is_not_empty"],
  "multi-select": ["contains", "not_contains", "is_empty", "is_not_empty"],
  relation: ["contains", "not_contains", "is_empty", "is_not_empty"],
  person: ["contains", "not_contains", "is_empty", "is_not_empty"],
  date: [
    "is",
    "is_before",
    "is_after",
    "is_on_or_before",
    "is_on_or_after",
    "is_within",
    "is_empty",
    "is_not_empty",
  ],
  checkbox: ["is"],
  // ponytail: formula/rollup unimplemented in V1 — no filter operators yet.
  formula: [],
  rollup: [],
};

/** Presets for the date `is_within` operator value. */
export const DATE_WITHIN_PRESETS = [
  "today",
  "this_week",
  "next_week",
  "this_month",
  "overdue",
] as const;

export const EMPTY_VIEW_CONFIG: ViewConfig = {
  filters: [],
  sorts: [],
  group_by_property_id: null,
  visible_properties: null,
  column_widths: {},
  calendar_date_property_id: null,
  collapsed_groups: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeFilter(raw: unknown): ViewFilter | null {
  if (!isObject(raw)) return null;
  const property_id = asString(raw.property_id);
  const operator = asString(raw.operator);
  if (!property_id || !operator) return null;
  const id = asString(raw.id) ?? `${property_id}:${operator}`;
  const value = (raw.value ?? null) as Json;
  return { id, property_id, operator, value };
}

function normalizeSort(raw: unknown): ViewSort | null {
  if (!isObject(raw)) return null;
  const property_id = asString(raw.property_id);
  if (!property_id) return null;
  const direction = raw.direction === "desc" ? "desc" : "asc";
  return { property_id, direction };
}

/** Coerce arbitrary stored jsonb into a complete, safe ViewConfig. Never throws. */
export function normalizeViewConfig(raw: unknown): ViewConfig {
  if (!isObject(raw)) return { ...EMPTY_VIEW_CONFIG };

  const filters = Array.isArray(raw.filters)
    ? raw.filters.map(normalizeFilter).filter((f): f is ViewFilter => f !== null)
    : [];

  const sorts = Array.isArray(raw.sorts)
    ? raw.sorts.map(normalizeSort).filter((s): s is ViewSort => s !== null)
    : [];

  const visible_properties = Array.isArray(raw.visible_properties)
    ? raw.visible_properties.filter((id): id is string => typeof id === "string")
    : null;

  const column_widths: Record<string, number> = {};
  if (isObject(raw.column_widths)) {
    for (const [key, value] of Object.entries(raw.column_widths)) {
      if (typeof value === "number" && Number.isFinite(value)) column_widths[key] = value;
    }
  }

  const collapsed_groups = Array.isArray(raw.collapsed_groups)
    ? raw.collapsed_groups.filter((g): g is string => typeof g === "string")
    : [];

  return {
    filters,
    sorts,
    group_by_property_id: asString(raw.group_by_property_id),
    visible_properties,
    column_widths,
    calendar_date_property_id: asString(raw.calendar_date_property_id),
    collapsed_groups,
  };
}

/** Apply a partial patch, re-normalizing so the result is always valid. */
export function updateViewConfig(
  config: ViewConfig,
  patch: Partial<ViewConfig>,
): ViewConfig {
  return normalizeViewConfig({ ...config, ...patch });
}

/** Drop every reference to a property that no longer exists. */
export function pruneViewConfig(
  config: ViewConfig,
  existingPropertyIds: Set<string>,
): ViewConfig {
  const has = (id: string | null): boolean => id !== null && existingPropertyIds.has(id);

  const column_widths: Record<string, number> = {};
  for (const [key, value] of Object.entries(config.column_widths)) {
    if (existingPropertyIds.has(key)) column_widths[key] = value;
  }

  return {
    filters: config.filters.filter((f) => existingPropertyIds.has(f.property_id)),
    sorts: config.sorts.filter((s) => existingPropertyIds.has(s.property_id)),
    group_by_property_id: has(config.group_by_property_id)
      ? config.group_by_property_id
      : null,
    visible_properties: config.visible_properties
      ? config.visible_properties.filter((id) => existingPropertyIds.has(id))
      : null,
    column_widths,
    calendar_date_property_id: has(config.calendar_date_property_id)
      ? config.calendar_date_property_id
      : null,
    collapsed_groups: config.collapsed_groups,
  };
}
