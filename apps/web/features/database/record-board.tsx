import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { groupIntoColumns } from "@planevo/core/state/board-state";
import { deleteRecord } from "@/app/(workspace)/databases/[databaseId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { RecordDeleteHover } from "@/features/database/delete-record-control";

function RecordCard({
  record,
  databaseId,
  onOpen,
}: {
  record: DisplayRecord;
  databaseId?: string | null;
  onOpen?: (recordId: string) => void;
}) {
  const formattedDate = record.dueDate
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(record.dueDate),
      )
    : null;
  const label = record.title.trim() || "Untitled";

  return (
    <article
      className={`group rounded-xl border border-border bg-paper p-4 ${
        onOpen ? "cursor-pointer outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink" : ""
      }`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              onOpen(record.id);
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(record.id);
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-body font-medium">{record.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {record.priority && (
            <span className="rounded-full bg-slate-tint px-2 py-1 text-label text-ink">
              {record.priority}
            </span>
          )}
          {databaseId && (
            <div className="opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
              <DeleteEntityControl
                compact
                label={`Delete ${label}`}
                title={`Delete “${label}”?`}
                description="This permanently removes the record and all of its property values. This can't be undone."
                confirmLabel="Delete record"
                onConfirm={() => deleteRecord({ databaseId, recordId: record.id })}
              />
            </div>
          )}
        </div>
      </div>
      {record.description && (
        <p className="mt-2 line-clamp-2 text-small text-text-secondary">{record.description}</p>
      )}
      {(formattedDate || record.estimateMinutes !== null || record.tags.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-label text-text-muted">
          {formattedDate && <span>{formattedDate}</span>}
          {record.estimateMinutes !== null && <span>{record.estimateMinutes} min</span>}
          {record.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-1">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

/** Board over DisplayRecords: configured columns + orphan values + no-status
 *  lane — a record never disappears because its status string is unexpected. */
export function RecordBoard({
  records,
  statusOptions,
  databaseId,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  statusOptions: string[];
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
  const columns = groupIntoColumns(records, (record) => record.status, statusOptions);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:auto-cols-fr lg:grid-flow-col">
        {columns.map((column) => (
          <section
            key={column.key}
            className="w-72 shrink-0 rounded-card border border-border bg-surface-raised p-3 lg:w-auto"
          >
            <div className="flex items-center justify-between px-1 py-1">
              <h2 className="text-small font-medium">{column.label}</h2>
              <span className="text-label text-text-muted">{column.items.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {column.items.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  databaseId={databaseId}
                  onOpen={onOpenRecord}
                />
              ))}
              {column.items.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-small text-text-muted">
                  Nothing here
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function RecordList({
  records,
  databaseId,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
      {records.map((record) => {
        const row = (
          <div
            className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center ${
              onOpenRecord ? "cursor-pointer" : ""
            }`}
            role={onOpenRecord ? "button" : undefined}
            tabIndex={onOpenRecord ? 0 : undefined}
            onClick={
              onOpenRecord
                ? (event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    onOpenRecord(record.id);
                  }
                : undefined
            }
            onKeyDown={
              onOpenRecord
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenRecord(record.id);
                    }
                  }
                : undefined
            }
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium">{record.title}</p>
              {record.description && (
                <p className="mt-1 truncate text-small text-text-muted">{record.description}</p>
              )}
            </div>
            <span className="text-small text-text-secondary sm:w-32">
              {record.status ?? "No status"}
            </span>
            <span className="text-small text-text-muted sm:w-32">
              {record.priority ?? "No priority"}
            </span>
          </div>
        );

        if (!databaseId) {
          return (
            <div key={record.id} className="border-b border-border last:border-b-0">
              {row}
            </div>
          );
        }

        return (
          <RecordDeleteHover
            key={record.id}
            databaseId={databaseId}
            recordId={record.id}
            recordTitle={record.title}
            className="border-b border-border last:border-b-0"
          >
            {row}
          </RecordDeleteHover>
        );
      })}
    </div>
  );
}
