import type { Json } from "../types/database.types";
import type { PropertyType } from "../types/property-types";

export type PropertyValueResult =
  | { ok: true; value: Json | null }
  | { ok: false; error: string };

/**
 * Normalizes a raw user input (always a string from form/cell inputs) into the
 * Json shape stored in record_values.value_json for the property type.
 * Empty input clears the value (null).
 */
export function normalizePropertyValue(
  type: PropertyType,
  raw: string,
): PropertyValueResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  switch (type) {
    case "text":
    case "select":
      return { ok: true, value: trimmed };
    case "number": {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return { ok: false, error: "Enter a number." };
      return { ok: true, value: parsed };
    }
    case "checkbox": {
      if (trimmed === "true" || trimmed === "on" || trimmed === "1") {
        return { ok: true, value: true };
      }
      if (trimmed === "false" || trimmed === "off" || trimmed === "0") {
        return { ok: true, value: false };
      }
      return { ok: false, error: "Checkbox values must be true or false." };
    }
    case "date": {
      if (Number.isNaN(Date.parse(trimmed))) {
        return { ok: false, error: "Enter a valid date." };
      }
      return { ok: true, value: new Date(trimmed).toISOString() };
    }
    case "multi-select": {
      const items = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return { ok: true, value: items };
    }
    case "relation":
    case "person":
      // Stored as an id string in V1.
      return { ok: true, value: trimmed };
    case "formula":
    case "rollup":
      return { ok: false, error: "This property type isn't available yet." };
  }
}

/** Renders a stored value back to a display/input string. */
export function propertyValueToString(value: Json | undefined | null): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }
  return "";
}
