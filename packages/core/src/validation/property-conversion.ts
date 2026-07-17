/**
 * Plans an atomic property type conversion (F-04/F-10). Pure and deterministic:
 * decides per-record value rewrites, which records to clear, the new config,
 * and a human summary. The plan is executed atomically by the
 * apply_property_conversion RPC. Final value shapes go through
 * normalizePropertyValue so stored jsonb always matches the target type.
 */

import type { Json } from "../types/database.types";
import type { PropertyType } from "../types/property-types";
import { normalizePropertyValue, propertyValueToString } from "./property-values.ts";

export type ConversionValue = { recordId: string; value: Json };
export type ConversionUpdate = { record_id: string; value: Json };

export type PropertyConversionPlan = {
  updates: ConversionUpdate[];
  clearRecordIds: string[];
  newConfig: Json;
  summary: string;
};

const OPTION_COLORS = ["slate", "marigold", "meadow", "brick", "ink"] as const;

function isEmpty(value: Json): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

/** Convert one non-empty value to the target type; null means "clear it". */
function convertOne(from: PropertyType, to: PropertyType, value: Json): Json | null {
  const str = propertyValueToString(value);

  if (to === "checkbox") {
    const s = str.trim().toLowerCase();
    if (s === "yes" || s === "true") return true;
    if (s === "no" || s === "false") return false;
    return null;
  }

  switch (`${from}->${to}`) {
    case "text->number": {
      const result = normalizePropertyValue("number", str);
      return result.ok && result.value !== null ? result.value : null;
    }
    case "text->date": {
      const result = normalizePropertyValue("date", str);
      return result.ok && result.value !== null ? result.value : null;
    }
    case "number->text":
    case "select->text":
    case "date->text":
      return str === "" ? null : str;
    case "text->select":
      return str.trim() === "" ? null : str.trim();
    case "select->multi-select":
      return str === "" ? null : [str];
    case "multi-select->select": {
      const first = Array.isArray(value)
        ? value.find((v): v is string => typeof v === "string" && v.trim() !== "")
        : undefined;
      return first ?? null;
    }
    default:
      return null; // incompatible pair -> clear
  }
}

export function planPropertyConversion(
  fromType: PropertyType,
  toType: PropertyType,
  currentConfig: Json,
  values: ConversionValue[],
): PropertyConversionPlan {
  if (fromType === toType) {
    return {
      updates: [],
      clearRecordIds: [],
      newConfig: currentConfig ?? {},
      summary: `All ${values.length} values convert cleanly.`,
    };
  }

  const updates: ConversionUpdate[] = [];
  const clearRecordIds: string[] = [];

  for (const { recordId, value } of values) {
    if (isEmpty(value)) continue; // empty stays empty — always clean
    const converted = convertOne(fromType, toType, value);
    if (converted === null) clearRecordIds.push(recordId);
    else updates.push({ record_id: recordId, value: converted });
  }

  // Generate select options from the distinct converted values when needed.
  let newConfig: Json = currentConfig ?? {};
  if (fromType === "text" && toType === "select") {
    const names = [...new Set(updates.map((u) => String(u.value)))];
    newConfig = {
      ...asObject(currentConfig),
      options: names.map((name, index) => ({
        name,
        color: OPTION_COLORS[index % OPTION_COLORS.length],
      })),
    };
  }

  const summary =
    clearRecordIds.length > 0
      ? `${clearRecordIds.length} values can't be converted and will be cleared.`
      : `All ${values.length} values convert cleanly.`;

  return { updates, clearRecordIds, newConfig, summary };
}
