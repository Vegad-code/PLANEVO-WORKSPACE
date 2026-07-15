"use client";

import { useState, useTransition } from "react";
import type { DatabaseBundle, RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { selectOptions } from "@planevo/core/types/property-roles";
import { IMPLEMENTED_PROPERTY_TYPES } from "@planevo/core/types/property-types";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import {
  createProperty,
  createRecord,
  upsertRecordValue,
} from "@/app/(workspace)/databases/[databaseId]/actions";

const CELL_INPUT_CLASS =
  "h-8 w-full min-w-28 rounded-md border border-transparent bg-transparent px-2 text-small outline-none transition-colors hover:border-border focus:border-ink focus:bg-surface-raised motion-reduce:transition-none";

function Cell({
  record,
  property,
}: {
  record: RecordItem;
  property: DatabasePropertyRow;
}) {
  const stored = propertyValueToString(record.values[property.id]);
  const [error, setError] = useState<string | null>(null);

  async function commit(rawValue: string) {
    if (rawValue === stored) return;
    const result = await upsertRecordValue({
      recordId: record.id,
      propertyId: property.id,
      rawValue,
    });
    setError(result.ok ? null : (result.error ?? "Couldn't save."));
  }

  const errorProps = error
    ? { "aria-invalid": true as const, title: error }
    : {};

  if (property.type === "checkbox") {
    return (
      <input
        type="checkbox"
        defaultChecked={stored === "true"}
        onChange={(event) => void commit(event.target.checked ? "true" : "false")}
        aria-label={property.name}
        className="size-4 accent-ink"
        {...errorProps}
      />
    );
  }

  if (property.type === "select") {
    const options = selectOptions(property);
    if (options.length > 0) {
      return (
        <select
          defaultValue={stored}
          onChange={(event) => void commit(event.target.value)}
          aria-label={property.name}
          className={CELL_INPUT_CLASS}
          {...errorProps}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {stored && !options.includes(stored) && (
            <option value={stored}>{stored}</option>
          )}
        </select>
      );
    }
  }

  return (
    <input
      type={property.type === "number" ? "number" : property.type === "date" ? "datetime-local" : "text"}
      defaultValue={property.type === "date" && stored ? stored.slice(0, 16) : stored}
      onBlur={(event) => void commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      aria-label={property.name}
      placeholder={property.type === "multi-select" ? "a, b, c" : ""}
      className={`${CELL_INPUT_CLASS} ${error ? "border-brick" : ""}`}
      {...errorProps}
    />
  );
}

function AddPropertyMenu({ databaseId }: { databaseId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createProperty({
        databaseId,
        name: String(formData.get("name") ?? ""),
        type: String(formData.get("type") ?? "text"),
      });
      if (result.ok) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Couldn't add the property.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 whitespace-nowrap rounded-lg px-2 text-small font-medium text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        + Property
      </button>
    );
  }

  return (
    <form action={submit} className="flex items-center gap-1">
      <input
        autoFocus
        required
        name="name"
        placeholder="Name"
        className="h-8 w-28 rounded-md border border-border-strong bg-surface-raised px-2 text-small outline-none focus:border-ink"
      />
      <select
        name="type"
        defaultValue="text"
        aria-label="Property type"
        className="h-8 rounded-md border border-border-strong bg-surface-raised px-1 text-small outline-none focus:border-ink"
      >
        {IMPLEMENTED_PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="h-8 rounded-md bg-ink px-2 text-small font-medium text-paper disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        aria-label="Cancel adding property"
        className="h-8 rounded-md px-2 text-small text-text-muted hover:text-ink"
      >
        ✕
      </button>
      {error && (
        <span role="alert" className="text-small text-ink">
          {error}
        </span>
      )}
    </form>
  );
}

export function TableView({ bundle }: { bundle: DatabaseBundle }) {
  const { database, properties, records } = bundle;
  const [isPending, startTransition] = useTransition();

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {properties.map((property) => (
              <th
                key={property.id}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-label uppercase text-text-muted"
              >
                {property.name}
                <span className="ml-1.5 font-normal normal-case text-text-muted/70">
                  {property.type}
                </span>
              </th>
            ))}
            <th scope="col" className="w-full px-2 py-2">
              <AddPropertyMenu databaseId={database.id} />
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-border last:border-b-0">
              {properties.map((property) => (
                <td key={property.id} className="px-1.5 py-1 align-middle">
                  <Cell record={record} property={property} />
                </td>
              ))}
              <td aria-hidden="true" />
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td
                colSpan={properties.length + 1}
                className="px-4 py-10 text-center text-small text-text-muted"
              >
                {/* Signature law: empty structure renders as faint line art. */}
                <div className="mx-auto max-w-xs space-y-2 opacity-60">
                  <div className="h-2 rounded border border-dashed border-border-strong" />
                  <div className="h-2 w-4/5 rounded border border-dashed border-border-strong" />
                  <div className="h-2 w-3/5 rounded border border-dashed border-border-strong" />
                </div>
                <p className="mt-4">No records yet — add the first one below.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => createRecord(database.id))}
          className="h-8 rounded-lg px-3 text-small font-medium text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          + New record
        </button>
      </div>
    </div>
  );
}
