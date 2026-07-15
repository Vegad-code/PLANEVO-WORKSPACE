import type { DatabasePropertyRow } from "./database.types";

/**
 * Stable role keys stored in database_properties.config_json ->> 'role'.
 * Reads and writes key on roles, never display names — renaming a property
 * must never break behavior.
 */
export type PropertyRole =
  | "title"
  | "status"
  | "priority"
  | "due_date"
  | "description"
  | "estimate"
  | "tags"
  | "attachments"
  | "event_date";

function configValue(property: DatabasePropertyRow, key: string): unknown {
  const config = property.config_json;
  if (!config || typeof config !== "object" || Array.isArray(config)) return undefined;
  return (config as Record<string, unknown>)[key];
}

export function propertyRole(property: DatabasePropertyRow): PropertyRole | null {
  const role = configValue(property, "role");
  return typeof role === "string" ? (role as PropertyRole) : null;
}

export function findPropertyByRole(
  properties: DatabasePropertyRow[],
  role: PropertyRole,
): DatabasePropertyRow | null {
  if (role === "title") {
    return (
      properties.find((property) => property.is_primary) ??
      properties.find((property) => propertyRole(property) === "title") ??
      null
    );
  }
  return properties.find((property) => propertyRole(property) === role) ?? null;
}

/** Configured options for a select/multi-select property. */
export function selectOptions(property: DatabasePropertyRow): string[] {
  const options = configValue(property, "options");
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === "string")
    : [];
}
