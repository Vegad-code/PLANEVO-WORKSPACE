"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  CalendarRow,
  CalendarViewRow,
} from "@planevo/core/types/calendar";
import { Check, ChevronDown, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { VIEW_LAYOUTS, type ViewConfig } from "@/lib/calendar/view-config";
import {
  SAVED_VIEW_PRESETS,
  presetForSavedView,
  resolveSavedViewDraft,
  viewOverridesForPreset,
  type SavedViewPreset,
} from "@/lib/calendar/saved-view-form";

export type CalendarSavedViewInput = {
  name: string;
  preset: SavedViewPreset;
  config: Partial<ViewConfig>;
  sourceCalendarIds: string[];
  includeTaskDues: boolean;
};

export type CalendarSavedViewMenuProps = {
  views: CalendarViewRow[];
  calendars: CalendarRow[];
  activeViewId: string | null;
  defaultViewId: string | null;
  onSelect: (viewId: string | null) => void;
  onCreate: (input: CalendarSavedViewInput) => void | Promise<void>;
  onUpdate: (
    viewId: string,
    input: CalendarSavedViewInput,
  ) => void | Promise<void>;
  onDelete: (viewId: string) => void | Promise<void>;
  onSetDefault: (viewId: string) => void | Promise<void>;
};

type EditorState = { kind: "create" } | { kind: "edit"; view: CalendarViewRow };

type EditorDraft = {
  name: string;
  preset: SavedViewPreset;
  config: ViewConfig;
  sourceCalendarIds: string[];
  includeTaskDues: boolean;
};

const PRESET_LABELS: Record<SavedViewPreset, string> = {
  classic: "Classic",
  planner: "Planner",
  flow: "Flow",
};

const PRESET_DESCRIPTIONS: Record<SavedViewPreset, string> = {
  classic: "Familiar calendar grid",
  planner: "One-day plan with tasks",
  flow: "Vertical daily timeline",
};

const TIME_AXIS_MODES = [
  { value: "fixed-24h", label: "Fixed 24 hours" },
  { value: "cropped-working-hours", label: "Working hours" },
  { value: "auto-scale-to-content", label: "Fit to content" },
  { value: "none", label: "No time axis" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["timeAxis"]["mode"];
  label: string;
}>;

const ROW_HEIGHTS = [
  { value: "fixed", label: "Fixed" },
  { value: "proportional-to-duration", label: "By duration" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["timeAxis"]["rowHeight"];
  label: string;
}>;

const SIDEBAR_MODES = [
  { value: "none", label: "None" },
  { value: "calendar-list", label: "Calendar list" },
  { value: "task-backlog", label: "Task backlog" },
  { value: "inbox-capture", label: "Inbox capture" },
  { value: "command-palette", label: "Command palette" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["sidebarMode"];
  label: string;
}>;

const GROUPING_KEYS = [
  { value: "time", label: "Time" },
  { value: "day", label: "Day" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
  { value: "calendar-source", label: "Calendar source" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["groupingKey"];
  label: string;
}>;

const COLOR_SOURCES = [
  { value: "calendar", label: "Calendar" },
  { value: "project", label: "Project" },
  { value: "priority", label: "Priority" },
  { value: "category", label: "Category" },
  { value: "none", label: "None" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["colorSource"];
  label: string;
}>;

const CARD_DENSITIES = [
  { value: "minimal", label: "Minimal" },
  { value: "standard", label: "Standard" },
  { value: "rich", label: "Rich" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["cardDensity"];
  label: string;
}>;

const INTERACTION_OPTIONS = [
  { value: "drag-from-backlog", label: "Drag from backlog" },
  { value: "auto-schedule", label: "Auto-schedule" },
  { value: "natural-language-create", label: "Natural-language create" },
  { value: "command-bar", label: "Command bar" },
  { value: "click-empty-to-create", label: "Click empty space to create" },
  { value: "swipe-nav", label: "Swipe navigation" },
  { value: "plan-wizard", label: "Plan wizard" },
] as const satisfies ReadonlyArray<{
  value: ViewConfig["interactionSet"][number];
  label: string;
}>;

const FIELD_CLASS =
  "h-9 w-full rounded-md border border-border bg-paper px-2.5 text-product-body text-ink outline-none focus-visible:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";

function createDraft(editor: EditorState): EditorDraft {
  if (editor.kind === "create") {
    return {
      name: "",
      preset: "classic",
      config: resolveSavedViewDraft("classic", {}),
      sourceCalendarIds: [],
      includeTaskDues: true,
    };
  }

  const preset = presetForSavedView(editor.view.preset);
  return {
    name: editor.view.name,
    preset,
    config: resolveSavedViewDraft(preset, editor.view.config),
    sourceCalendarIds: [...editor.view.source_calendar_ids],
    includeTaskDues: editor.view.include_task_dues,
  };
}

function AxisSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-product-meta font-medium text-text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        className={FIELD_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SavedViewEditor({
  editor,
  calendars,
  isDefault,
  onCancel,
  onSubmit,
  onDelete,
  onSetDefault,
}: {
  editor: EditorState;
  calendars: CalendarRow[];
  isDefault: boolean;
  onCancel: () => void;
  onSubmit: (input: CalendarSavedViewInput) => void | Promise<void>;
  onDelete: (() => void | Promise<void>) | null;
  onSetDefault: (() => void | Promise<void>) | null;
}) {
  const nameId = useId();
  const [draft, setDraft] = useState(() => createDraft(editor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function patchConfig(patch: Partial<ViewConfig>) {
    setDraft((current) => ({
      ...current,
      config: { ...current.config, ...patch },
    }));
  }

  async function run(action: () => void | Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("That change could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label={
        editor.kind === "create" ? "Create calendar view" : "Edit calendar view"
      }
      className="flex flex-col gap-4 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const name = draft.name.trim();
        if (!name || busy) return;
        void run(async () => {
          await onSubmit({
            name,
            preset: draft.preset,
            config: viewOverridesForPreset(draft.preset, draft.config),
            sourceCalendarIds: draft.sourceCalendarIds,
            includeTaskDues: draft.includeTaskDues,
          });
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-product-body font-semibold text-ink">
          {editor.kind === "create" ? "New view" : "Edit view"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Cancel
        </button>
      </div>

      <label htmlFor={nameId} className="flex flex-col gap-1">
        <span className="text-product-meta font-medium text-text-secondary">
          Name
        </span>
        <input
          id={nameId}
          autoFocus
          required
          maxLength={80}
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="My calendar view"
          className={FIELD_CLASS}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-product-meta font-medium text-text-secondary">
          Preset
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {SAVED_VIEW_PRESETS.map((preset) => (
            <label key={preset} className="cursor-pointer">
              <input
                type="radio"
                name="calendar-view-preset"
                value={preset}
                checked={draft.preset === preset}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    preset,
                    config: resolveSavedViewDraft(preset, {}),
                  }))
                }
                className="peer sr-only"
              />
              <span className="flex min-h-16 flex-col gap-1 rounded-lg border border-border bg-paper p-2 text-left outline-none peer-checked:border-border-strong peer-checked:bg-surface-raised peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="text-product-meta font-semibold text-ink">
                  {PRESET_LABELS[preset]}
                </span>
                <span className="text-label leading-snug text-text-muted">
                  {PRESET_DESCRIPTIONS[preset]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-product-meta font-medium text-text-secondary">
          Calendars
        </legend>
        <p className="text-label text-text-muted">
          None selected means every visible calendar.
        </p>
        {calendars.length === 0 ? (
          <p className="rounded-md bg-surface-raised px-2.5 py-2 text-product-meta text-text-muted">
            No calendars available
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {calendars.map((calendar) => {
              const checked = draft.sourceCalendarIds.includes(calendar.id);
              return (
                <label
                  key={calendar.id}
                  className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-product-meta text-ink hover:bg-surface-raised"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sourceCalendarIds: event.target.checked
                          ? [...current.sourceCalendarIds, calendar.id]
                          : current.sourceCalendarIds.filter(
                              (id) => id !== calendar.id,
                            ),
                      }))
                    }
                    className="size-3.5 shrink-0 accent-ink"
                  />
                  <span className="truncate">{calendar.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span>
          <span className="block text-product-meta font-medium text-ink">
            Show task due dates
          </span>
          <span className="block text-label text-text-muted">
            Include due-date chips in this view
          </span>
        </span>
        <input
          type="checkbox"
          checked={draft.includeTaskDues}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              includeTaskDues: event.target.checked,
            }))
          }
          className="size-4 shrink-0 accent-ink"
        />
      </label>

      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-product-meta font-medium text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
          Customize
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-text-secondary transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
          <AxisSelect
            label="Layout"
            value={draft.config.layout}
            options={VIEW_LAYOUTS.map((value) => ({
              value,
              label: value
                .split("-")
                .map((part) => part[0]?.toUpperCase() + part.slice(1))
                .join(" "),
            }))}
            onChange={(layout) => patchConfig({ layout })}
          />
          <AxisSelect
            label="Time axis"
            value={draft.config.timeAxis.mode}
            options={TIME_AXIS_MODES}
            onChange={(mode) =>
              patchConfig({
                timeAxis: { ...draft.config.timeAxis, mode },
              })
            }
          />
          <AxisSelect
            label="Row height"
            value={draft.config.timeAxis.rowHeight}
            options={ROW_HEIGHTS}
            onChange={(rowHeight) =>
              patchConfig({
                timeAxis: { ...draft.config.timeAxis, rowHeight },
              })
            }
          />
          <label className="flex flex-col gap-1">
            <span className="text-product-meta font-medium text-text-secondary">
              Day count
            </span>
            <select
              value={String(draft.config.dayCount)}
              onChange={(event) => {
                const raw = event.target.value;
                patchConfig({
                  dayCount:
                    raw === "month" || raw === "year" ? raw : Number(raw),
                });
              }}
              className={FIELD_CLASS}
            >
              {Array.from({ length: 14 }, (_, index) => index + 1).map(
                (count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "day" : "days"}
                  </option>
                ),
              )}
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </label>
          <AxisSelect
            label="Sidebar"
            value={draft.config.sidebarMode}
            options={SIDEBAR_MODES}
            onChange={(sidebarMode) => patchConfig({ sidebarMode })}
          />
          <AxisSelect
            label="Group by"
            value={draft.config.groupingKey}
            options={GROUPING_KEYS}
            onChange={(groupingKey) => patchConfig({ groupingKey })}
          />
          <AxisSelect
            label="Color by"
            value={draft.config.colorSource}
            options={COLOR_SOURCES}
            onChange={(colorSource) => patchConfig({ colorSource })}
          />
          <AxisSelect
            label="Card density"
            value={draft.config.cardDensity}
            options={CARD_DENSITIES}
            onChange={(cardDensity) => patchConfig({ cardDensity })}
          />
          <fieldset className="col-span-2 flex flex-col gap-1">
            <legend className="text-product-meta font-medium text-text-secondary">
              Interactions
            </legend>
            <div className="grid grid-cols-2 gap-1">
              {INTERACTION_OPTIONS.map((option) => {
                const checked = draft.config.interactionSet.includes(
                  option.value,
                );
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-product-meta text-ink hover:bg-surface-raised"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = INTERACTION_OPTIONS.filter((candidate) =>
                          candidate.value === option.value
                            ? event.target.checked
                            : draft.config.interactionSet.includes(
                                candidate.value,
                              ),
                        ).map((candidate) => candidate.value);
                        patchConfig({ interactionSet: next });
                      }}
                      className="size-3.5 shrink-0 accent-ink"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </details>

      {error ? (
        <p role="alert" className="text-product-meta text-brick">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1">
          {onSetDefault && !isDefault ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onSetDefault)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-product-meta font-medium text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              <Star aria-hidden="true" className="size-3.5" />
              Make default
            </button>
          ) : null}
          {onDelete ? (
            deleteConfirm ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(onDelete)}
                  className="rounded-md bg-brick-tint px-2 py-1.5 text-product-meta font-medium text-brick outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brick disabled:opacity-50"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded-md px-2 py-1.5 text-product-meta text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                aria-label="Delete calendar view"
                onClick={() => setDeleteConfirm(true)}
                className="flex size-8 items-center justify-center rounded-md text-text-muted outline-none hover:bg-brick-tint hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brick disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            )
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy || !draft.name.trim()}
          className="rounded-md bg-ink px-3 py-1.5 text-product-meta font-semibold text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          {busy
            ? "Saving…"
            : editor.kind === "create"
              ? "Create view"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function CalendarSavedViewMenu({
  views,
  calendars,
  activeViewId,
  defaultViewId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: CalendarSavedViewMenuProps) {
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeView = views.find((view) => view.id === activeViewId) ?? null;
  const currentName =
    activeViewId === null
      ? "Classic"
      : (activeView?.name ??
        views.find((view) => view.id === defaultViewId)?.name ??
        views[0]?.name ??
        "Classic");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setEditor(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (editor) {
        setEditor(null);
      } else {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="calendar-saved-view-menu"
        onClick={() => {
          setOpen((current) => !current);
          setEditor(null);
        }}
        className="flex items-center gap-1.5 rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {currentName}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-text-secondary transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id="calendar-saved-view-menu"
          role="dialog"
          aria-label="Saved calendar views"
          className="absolute right-0 z-30 mt-2 max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-paper shadow-spotlight"
        >
          {editor ? (
            <SavedViewEditor
              key={
                editor.kind === "create" ? "create" : `edit-${editor.view.id}`
              }
              editor={editor}
              calendars={calendars}
              isDefault={
                editor.kind === "edit" && editor.view.id === defaultViewId
              }
              onCancel={() => setEditor(null)}
              onSubmit={async (input) => {
                if (editor.kind === "create") {
                  await onCreate(input);
                } else {
                  await onUpdate(editor.view.id, input);
                }
                setEditor(null);
              }}
              onDelete={
                editor.kind === "edit"
                  ? async () => {
                      await onDelete(editor.view.id);
                      setEditor(null);
                    }
                  : null
              }
              onSetDefault={
                editor.kind === "edit"
                  ? async () => {
                      await onSetDefault(editor.view.id);
                    }
                  : null
              }
            />
          ) : (
            <div className="flex flex-col gap-1 p-1">
              <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                <span className="text-product-meta font-semibold text-text-secondary">
                  Saved views
                </span>
                <button
                  type="button"
                  onClick={() => setEditor({ kind: "create" })}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-product-meta font-medium text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  New
                </button>
              </div>

              <button
                type="button"
                aria-current={activeViewId === null ? "true" : undefined}
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span>
                  <span className="block font-medium">Classic</span>
                  <span className="block text-product-meta text-text-muted">
                    Built-in fallback
                  </span>
                </span>
                {activeViewId === null ? (
                  <Check
                    aria-label="Current view"
                    className="size-4 text-text-secondary"
                  />
                ) : null}
              </button>

              {views.length === 0 ? (
                <p className="px-3 py-2 text-product-meta text-text-muted">
                  Create a view to save a preset and filters.
                </p>
              ) : (
                views.map((view) => {
                  const active = view.id === activeViewId;
                  const isDefault = view.id === defaultViewId;
                  return (
                    <div
                      key={view.id}
                      className="group flex items-center rounded-md hover:bg-surface-raised"
                    >
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => {
                          onSelect(view.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {view.name}
                          </span>
                          <span className="block text-product-meta capitalize text-text-muted">
                            {PRESET_LABELS[presetForSavedView(view.preset)]}
                            {isDefault ? " · Default" : ""}
                          </span>
                        </span>
                        {active ? (
                          <Check
                            aria-label="Current view"
                            className="size-4 shrink-0 text-text-secondary"
                          />
                        ) : isDefault ? (
                          <Star
                            aria-label="Default view"
                            className="size-4 shrink-0 text-text-muted"
                          />
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${view.name}`}
                        onClick={() => setEditor({ kind: "edit", view })}
                        className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 outline-none hover:bg-paper hover:text-ink focus-visible:opacity-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink group-hover:opacity-100"
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
