"use client";

import { useMemo } from "react";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import type { PropertyType } from "@planevo/core/types/property-types";
import { selectOptions } from "@planevo/core/types/property-roles";
import {
  DATE_WITHIN_PRESETS,
  OPERATORS_BY_TYPE,
  type ViewFilter,
} from "@planevo/core/views/view-config";

const INPUT_CLASS =
  "h-8 w-full rounded-md border border-border-strong bg-paper px-2 text-small outline-none focus:border-ink";

function operatorLabel(operator: string): string {
  return operator.replaceAll("_", " ");
}

function defaultOperator(type: PropertyType): string {
  const operators = OPERATORS_BY_TYPE[type];
  return operators[0] ?? "is";
}

function FilterValueInput({
  property,
  filter,
  onChange,
}: {
  property: DatabasePropertyRow;
  filter: ViewFilter;
  onChange: (value: ViewFilter["value"]) => void;
}) {
  if (filter.operator === "is_empty" || filter.operator === "is_not_empty") {
    return null;
  }

  const type = property.type as PropertyType;

  if (type === "checkbox") {
    return (
      <select
        aria-label="Filter value"
        value={filter.value === true ? "true" : "false"}
        onChange={(event) => onChange(event.target.value === "true")}
        className={INPUT_CLASS}
      >
        <option value="true">Checked</option>
        <option value="false">Unchecked</option>
      </select>
    );
  }

  if (type === "date" && filter.operator === "is_within") {
    return (
      <select
        aria-label="Date preset"
        value={typeof filter.value === "string" ? filter.value : "today"}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        {DATE_WITHIN_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    );
  }

  if (type === "select") {
    const options = selectOptions(property);
    return (
      <select
        aria-label="Filter value"
        value={typeof filter.value === "string" ? filter.value : ""}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      aria-label="Filter value"
      value={filter.value == null ? "" : String(filter.value)}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    />
  );
}

export function FilterEditor({
  filters,
  properties,
  onChange,
}: {
  filters: ViewFilter[];
  properties: DatabasePropertyRow[];
  onChange: (filters: ViewFilter[]) => void;
}) {
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );

  function updateFilter(index: number, patch: Partial<ViewFilter>): void {
    onChange(filters.map((filter, i) => (i === index ? { ...filter, ...patch } : filter)));
  }

  function addFilter(): void {
    const property = properties.find((item) => OPERATORS_BY_TYPE[item.type as PropertyType]?.length);
    if (!property) return;
    const type = property.type as PropertyType;
    onChange([
      ...filters,
      {
        id: crypto.randomUUID(),
        property_id: property.id,
        operator: defaultOperator(type),
        value: type === "checkbox" ? true : "",
      },
    ]);
  }

  return (
    <div className="flex w-80 flex-col gap-3 p-1">
      {filters.length === 0 && (
        <p className="text-small text-text-muted">No filters yet. Records match everything.</p>
      )}
      {filters.map((filter, index) => {
        const property = propertyById.get(filter.property_id) ?? properties[0];
        if (!property) return null;
        const type = property.type as PropertyType;
        const operators = OPERATORS_BY_TYPE[type] ?? [];

        return (
          <div key={filter.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter property"
                value={filter.property_id}
                onChange={(event) => {
                  const next = propertyById.get(event.target.value);
                  if (!next) return;
                  const nextType = next.type as PropertyType;
                  updateFilter(index, {
                    property_id: next.id,
                    operator: defaultOperator(nextType),
                    value: nextType === "checkbox" ? true : "",
                  });
                }}
                className={INPUT_CLASS}
              >
                {properties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remove filter"
                onClick={() => onChange(filters.filter((_, i) => i !== index))}
                className="shrink-0 rounded-md px-2 text-small text-text-muted hover:text-ink"
              >
                Remove
              </button>
            </div>
            <select
              aria-label="Filter operator"
              value={filter.operator}
              onChange={(event) => updateFilter(index, { operator: event.target.value })}
              className={INPUT_CLASS}
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operatorLabel(operator)}
                </option>
              ))}
            </select>
            <FilterValueInput
              property={property}
              filter={filter}
              onChange={(value) => updateFilter(index, { value })}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={addFilter}
        disabled={properties.length === 0}
        className="h-8 rounded-lg border border-border-strong px-3 text-left text-small font-medium text-text-secondary outline-none hover:border-ink hover:text-ink disabled:opacity-50"
      >
        Add filter
      </button>
    </div>
  );
}
