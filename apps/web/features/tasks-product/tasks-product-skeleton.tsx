"use client";

import Skeleton from "react-loading-skeleton";
import { TASK_STATUS_LABELS } from "@planevo/core/types/tasks";
import { ProductSkeletonTheme } from "@/components/ui/product-skeleton-theme";
import { getTasksPageLayoutClass } from "./tasks-page-layout";

const BOARD_COLUMN_STATUSES = [
  "not_started",
  "in_progress",
  "in_review",
  "done",
] as const;

const SKELETON_CARDS_PER_COLUMN = [2, 1, 3, 1] as const;

function TasksToolbarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-paper px-3 py-1.5 text-product-body font-medium text-ink">
            Board
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-product-body font-medium text-text-secondary">
            List
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-product-body font-medium text-text-secondary">
            Table
          </span>
        </div>
        <Skeleton width={96} height={36} borderRadius="0.5rem" />
      </div>
      <Skeleton width={112} height={36} borderRadius="0.5rem" />
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-paper p-3">
      <div className="flex items-start gap-2.5">
        <Skeleton width={16} height={16} borderRadius="0.25rem" inline />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton height={14} width="80%" containerClassName="leading-none" />
          <Skeleton height={12} width="50%" containerClassName="leading-none" />
        </div>
      </div>
    </div>
  );
}

function TaskBoardColumnSkeleton({
  status,
  cardCount,
}: {
  status: (typeof BOARD_COLUMN_STATUSES)[number];
  cardCount: number;
}) {
  const headingId = `task-skeleton-column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 w-72 shrink-0 flex-col rounded-2xl border border-border bg-sidebar p-4 md:w-auto md:min-h-[70vh] md:flex-1"
    >
      <div className="flex items-center justify-between gap-3 px-1 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={headingId} className="truncate text-product-title text-ink">
            {TASK_STATUS_LABELS[status]}
          </h2>
          <Skeleton width={28} height={20} borderRadius="999px" inline />
        </div>
        <Skeleton width={28} height={28} borderRadius="0.5rem" inline />
      </div>

      <div className="mt-3 flex min-h-32 flex-1 flex-col gap-3">
        {Array.from({ length: cardCount }).map((_, index) => (
          <TaskCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function TaskBoardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-card border border-border bg-paper p-4 pb-6"
    >
      <div className="flex min-h-0 min-w-max flex-1 items-stretch gap-4 md:grid md:min-w-0 md:grid-cols-4 md:gap-6">
        {BOARD_COLUMN_STATUSES.map((status, index) => (
          <TaskBoardColumnSkeleton
            key={status}
            status={status}
            cardCount={SKELETON_CARDS_PER_COLUMN[index] ?? 1}
          />
        ))}
      </div>
    </div>
  );
}

/** Route-level loading outline for the Tasks product surface. */
export function TasksProductSkeleton() {
  return (
    <ProductSkeletonTheme>
      <section
        aria-labelledby="tasks-product-title"
        aria-busy="true"
        className={`tasks-product-ui ${getTasksPageLayoutClass("board", true)}`}
      >
        <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-product-meta text-text-muted">All tasks</p>
            <div className="mt-1 flex items-center gap-2.5">
              <h1
                id="tasks-product-title"
                className="text-h1 font-medium tracking-tight text-ink"
              >
                Tasks
              </h1>
              <Skeleton width={32} height={24} borderRadius="999px" inline />
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-20 -mx-5 mb-4 shrink-0 border-b border-border/80 bg-paper/95 px-5 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <TasksToolbarSkeleton />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <TaskBoardSkeleton />
        </div>
      </section>
    </ProductSkeletonTheme>
  );
}
