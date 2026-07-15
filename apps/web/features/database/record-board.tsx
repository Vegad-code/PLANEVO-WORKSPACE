import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { groupIntoColumns } from "@planevo/core/state/board-state";

function RecordCard({ record }: { record: DisplayRecord }) {
  const formattedDate = record.dueDate
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(record.dueDate),
      )
    : null;

  return (
    <article className="rounded-xl border border-border bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body font-medium">{record.title}</h3>
        {record.priority && (
          <span className="shrink-0 rounded-full bg-slate-tint px-2 py-1 text-label text-ink">
            {record.priority}
          </span>
        )}
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
}: {
  records: DisplayRecord[];
  statusOptions: string[];
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
            <div className="mt-3 space-y-3">
              {column.items.map((record) => (
                <RecordCard key={record.id} record={record} />
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

export function RecordList({ records }: { records: DisplayRecord[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
      {records.map((record) => (
        <div
          key={record.id}
          className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-body font-medium">{record.title}</p>
            {record.description && (
              <p className="mt-1 truncate text-small text-text-muted">{record.description}</p>
            )}
          </div>
          <span className="text-small text-text-secondary sm:ml-auto sm:w-32">
            {record.status ?? "No status"}
          </span>
          <span className="text-small text-text-muted sm:w-32">
            {record.priority ?? "No priority"}
          </span>
        </div>
      ))}
    </div>
  );
}
