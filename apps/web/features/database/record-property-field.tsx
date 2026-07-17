"use client";

import { useState, useTransition } from "react";
import type { Json } from "@planevo/core/types/database.types";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { selectOptions } from "@planevo/core/types/property-roles";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { saveRecordProperty } from "@/app/(workspace)/records/[recordId]/actions";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-paper px-3 py-1.5 text-small outline-none focus-visible:border-ink";

export function RecordPropertyField({
  recordId,
  property,
  value,
}: {
  recordId: string;
  property: DatabasePropertyRow;
  value: Json | undefined;
}) {
  const stored = propertyValueToString(value);
  const [draft, setDraft] = useState(stored);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    startTransition(async () => {
      const result = await saveRecordProperty({
        recordId,
        propertyId: property.id,
        rawValue: next,
      });
      if (!result.ok) setError(result.error ?? "Failed to save.");
      else setError(null);
    });
  }

  function field() {
    if (property.type === "checkbox") {
      return (
        <input
          type="checkbox"
          defaultChecked={stored === "true"}
          disabled={pending}
          onChange={(event) => save(event.target.checked ? "true" : "false")}
          className="size-4 accent-ink"
          aria-label={property.name}
        />
      );
    }

    if (property.type === "select") {
      const options = selectOptions(property);
      return (
        <select
          defaultValue={stored}
          disabled={pending}
          onChange={(event) => save(event.target.value)}
          aria-label={property.name}
          className={FIELD_CLASS}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {stored && !options.includes(stored) && <option value={stored}>{stored}</option>}
        </select>
      );
    }

    if (property.type === "date") {
      return (
        <input
          type="datetime-local"
          defaultValue={stored ? stored.slice(0, 16) : ""}
          disabled={pending}
          onBlur={(event) => save(event.target.value)}
          aria-label={property.name}
          className={FIELD_CLASS}
        />
      );
    }

    return (
      <input
        type={property.type === "number" ? "number" : "text"}
        value={draft}
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save(draft)}
        aria-label={property.name}
        placeholder={property.type === "multi-select" ? "a, b, c" : ""}
        className={FIELD_CLASS}
      />
    );
  }

  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
      <dt className="text-small text-text-muted">{property.name}</dt>
      <dd>
        {field()}
        {error && (
          <p className="mt-1 text-label text-brick" role="alert">
            {error}
          </p>
        )}
      </dd>
    </div>
  );
}
