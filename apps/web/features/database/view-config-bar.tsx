"use client";

import { useRef, useState, type ReactNode } from "react";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import {
  updateViewConfig,
  type ViewConfig,
} from "@planevo/core/views/view-config";
import { Icon } from "@/components/ui/planevo-icon";
import { FilterEditor } from "./filter-editor";
import { SortEditor } from "./sort-editor";
import { useOutsidePointer } from "./use-outside-pointer";

const CHIP_CLASS =
  "h-8 rounded-lg border border-border-strong px-3 text-small font-medium outline-none transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";

function PopoverButton({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsidePointer(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${CHIP_CLASS} ${
          active || open
            ? "border-ink bg-surface-raised text-ink"
            : "bg-paper text-text-secondary"
        }`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(24rem,70vh)] overflow-y-auto rounded-lg border border-border bg-paper p-2">
          {children}
        </div>
      )}
    </div>
  );
}

function resolvedVisibleProperties(
  config: ViewConfig,
  properties: DatabasePropertyRow[],
): string[] {
  if (config.visible_properties?.length) return config.visible_properties;
  return properties.map((property) => property.id);
}

export function ViewConfigBar({
  config,
  properties,
  searchQuery,
  onSearchChange,
  onConfigChange,
}: {
  config: ViewConfig;
  properties: DatabasePropertyRow[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onConfigChange: (config: ViewConfig) => void;
}) {
  function patchConfig(patch: Partial<ViewConfig>): void {
    onConfigChange(updateViewConfig(config, patch));
  }

  const visibleIds = resolvedVisibleProperties(config, properties);
  const groupable = properties.filter(
    (property) => property.type === "select" || property.type === "multi-select",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-10 min-w-48 flex-1 items-center gap-3 rounded-card border border-border-strong bg-surface-raised px-4">
          <Icon name="search" className="size-4 shrink-0 text-text-muted" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search records"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
          />
        </label>

        <PopoverButton label={`Filter${config.filters.length ? ` · ${config.filters.length}` : ""}`} active={config.filters.length > 0}>
          <FilterEditor
            filters={config.filters}
            properties={properties}
            onChange={(filters) => patchConfig({ filters })}
          />
        </PopoverButton>

        <PopoverButton label={`Sort${config.sorts.length ? ` · ${config.sorts.length}` : ""}`} active={config.sorts.length > 0}>
          <SortEditor
            sorts={config.sorts}
            properties={properties}
            onChange={(sorts) => patchConfig({ sorts })}
          />
        </PopoverButton>

        <PopoverButton
          label={config.group_by_property_id ? "Grouped" : "Group"}
          active={Boolean(config.group_by_property_id)}
        >
          <div className="flex w-56 flex-col gap-2 p-1">
            <select
              aria-label="Group by property"
              value={config.group_by_property_id ?? ""}
              onChange={(event) =>
                patchConfig({
                  group_by_property_id: event.target.value || null,
                  collapsed_groups: [],
                })
              }
              className="h-8 rounded-md border border-border-strong bg-paper px-2 text-small outline-none focus:border-ink"
            >
              <option value="">No grouping</option>
              {groupable.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        </PopoverButton>

        <PopoverButton
          label={`Properties${visibleIds.length < properties.length ? ` · ${visibleIds.length}` : ""}`}
          active={visibleIds.length < properties.length}
        >
          <div className="flex w-56 flex-col gap-1 p-1">
            {properties.map((property) => {
              const visible = visibleIds.includes(property.id);
              return (
                <label
                  key={property.id}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-small hover:bg-surface-raised"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => {
                      const next = visible
                        ? visibleIds.filter((id) => id !== property.id)
                        : [...visibleIds, property.id];
                      patchConfig({
                        visible_properties: next.length === properties.length ? null : next,
                      });
                    }}
                    className="size-4 accent-ink"
                  />
                  <span className="truncate">{property.name}</span>
                </label>
              );
            })}
          </div>
        </PopoverButton>
      </div>
    </div>
  );
}
