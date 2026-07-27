"use client";

import { useLayoutEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { Folder, PanelLeft, Plus, Search } from "lucide-react";
import { ProductSkeletonTheme } from "@/components/ui/product-skeleton-theme";
import {
  DEFAULT_LIBRARY_COLLAPSED,
  DEFAULT_LIBRARY_WIDTH,
  getLibraryCollapsed,
  getLibraryWidth,
} from "@/lib/files/library-prefs";
import { cn } from "@/lib/utils";

const SKELETON_FOLDER_TREE_ROWS = 4;
const SKELETON_FOLDER_CARDS = 3;
const SKELETON_FILE_ROWS = 5;

/**
 * Library rail chrome. Kept mounted at width 0 when collapsed — same geometry
 * contract as FilesProductView — so the files pane does not jump on restore.
 */
function LibraryRailSkeleton({
  collapsed,
  width,
  prefsRestored,
}: {
  collapsed: boolean;
  width: number;
  prefsRestored: boolean;
}) {
  return (
    <aside
      aria-hidden="true"
      className={cn(
        "hidden shrink-0 overflow-hidden bg-files-bg lg:flex lg:flex-col",
        !prefsRestored && "library-rail-boot",
        collapsed && "pointer-events-none",
      )}
      style={
        prefsRestored
          ? { width: collapsed ? 0 : width }
          : collapsed
            ? { width: 0 }
            : undefined
      }
    >
      <div
        className="relative flex h-full shrink-0 flex-col border-r border-files-border"
        style={{ width }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <h2 className="text-h3 font-semibold text-files-text">Library</h2>
            <div className="flex items-center gap-0.5 text-files-text-muted">
              <span className="flex size-7 items-center justify-center rounded-lg">
                <Plus aria-hidden="true" className="size-4" />
              </span>
              <span className="flex size-7 items-center justify-center rounded-lg">
                <PanelLeft aria-hidden="true" className="size-4" />
              </span>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 rounded-lg border border-files-border bg-files-surface-muted py-2.5 pl-3 pr-3">
            <Search
              aria-hidden="true"
              className="size-4 shrink-0 text-files-text-muted"
            />
            <Skeleton
              height={14}
              width="40%"
              containerClassName="flex-1 leading-none"
            />
          </div>

          <div
            role="tablist"
            aria-label="Library view"
            className="flex rounded-xl border border-files-border bg-files-surface-muted p-1"
          >
            <span className="flex-1 rounded-lg bg-files-surface px-3 py-1.5 text-center text-product-body font-medium text-files-text shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              Folders
            </span>
            <span className="flex-1 rounded-lg px-3 py-1.5 text-center text-product-body font-medium text-files-text-muted">
              Tags
            </span>
          </div>

          <nav
            aria-label="Folders and tags"
            className="-mx-1 min-h-0 flex-1 overflow-hidden px-1"
          >
            <ul className="flex flex-col gap-0.5">
              <li>
                <span className="flex w-full items-center gap-2 rounded-lg bg-files-surface-muted px-2 py-1.5 text-product-body font-medium text-files-text">
                  <Folder aria-hidden="true" className="size-4 shrink-0" />
                  All files
                </span>
              </li>
            </ul>
            <div className="mt-2 flex flex-col gap-1">
              {Array.from({ length: SKELETON_FOLDER_TREE_ROWS }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{ paddingLeft: `${(index % 2) * 12 + 8}px` }}
                  >
                    <Folder
                      aria-hidden="true"
                      className="size-4 shrink-0 text-files-text-muted"
                    />
                    <Skeleton
                      height={14}
                      width={`${56 + (index % 3) * 20}%`}
                      containerClassName="flex-1 leading-none"
                    />
                  </div>
                ),
              )}
            </div>
          </nav>
        </div>

        <div className="relative w-full shrink-0 bg-files-bg shadow-[inset_0_1px_0_0_var(--color-files-border-strong)]">
          <div className="flex flex-col gap-2 p-3">
            <Skeleton height={10} borderRadius="999px" />
            <Skeleton height={12} width="66%" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function MainHeaderSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="sticky top-0 z-10 bg-files-bg/95 px-6 pt-4 pb-3 backdrop-blur-sm lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {collapsed ? (
            <span
              aria-hidden="true"
              className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-files-text-muted lg:flex"
            >
              <PanelLeft className="size-4" />
            </span>
          ) : null}
          <h1 className="text-h3 font-semibold text-files-text">All files</h1>
        </div>
        <div aria-hidden="true" className="flex shrink-0 items-center gap-2">
          <Skeleton
            width={96}
            height={36}
            borderRadius="var(--radius-files-card)"
          />
          <Skeleton
            width={96}
            height={36}
            borderRadius="var(--radius-files-card)"
          />
          <Skeleton
            width={96}
            height={36}
            borderRadius="var(--radius-files-card)"
          />
        </div>
      </div>
    </div>
  );
}

function FolderCardSkeleton() {
  return (
    <div className="flex w-56 shrink-0 flex-col rounded-2xl border border-files-border bg-files-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-center pt-2">
        <Skeleton width={176} height={112} borderRadius="1rem" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5 px-1">
        <Skeleton height={14} width="75%" />
        <Skeleton height={12} width="33%" />
      </div>
    </div>
  );
}

function FileRowSkeleton() {
  return (
    <tr className="border-b border-files-border/70">
      <td className="w-8 py-4 pl-4 pr-0">
        <Skeleton width={24} height={24} />
      </td>
      <td className="px-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton width={20} height={20} borderRadius="0.25rem" inline />
          <Skeleton height={14} width={160} containerClassName="leading-none" />
        </div>
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <div className="flex items-center gap-2.5">
          <Skeleton circle width={24} height={24} inline />
          <Skeleton height={14} width={80} containerClassName="leading-none" />
        </div>
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <Skeleton height={14} width={56} />
      </td>
      <td className="hidden px-3 py-4 md:table-cell">
        <Skeleton height={14} width={96} />
      </td>
      <td className="w-12 px-3 py-4">
        <div className="ml-auto">
          <Skeleton width={28} height={28} borderRadius="0.5rem" />
        </div>
      </td>
    </tr>
  );
}

function FilesTableSkeleton() {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-files-border text-left">
          <th scope="col" className="w-8 py-3 pl-4 pr-0" aria-label="Drag" />
          <th
            scope="col"
            className="px-3 py-3 text-product-column font-medium text-files-text-muted"
          >
            Name
          </th>
          <th
            scope="col"
            className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted sm:table-cell"
          >
            Added by
          </th>
          <th
            scope="col"
            className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted sm:table-cell"
          >
            File size
          </th>
          <th
            scope="col"
            className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted md:table-cell"
          >
            Modified
          </th>
          <th
            scope="col"
            className="w-12 px-3 py-3 text-right text-product-column font-medium text-files-text-muted"
            aria-label="Actions"
          >
            Action
          </th>
        </tr>
      </thead>
      <tbody aria-hidden="true">
        {Array.from({ length: SKELETON_FILE_ROWS }).map((_, index) => (
          <FileRowSkeleton key={index} />
        ))}
      </tbody>
    </table>
  );
}

/**
 * Route-level loading outline for the Files product surface.
 * If Library was collapsed, the rail stays at width 0 — only the files pane
 * reads as the loading surface (Calendar Agenda parity).
 *
 * `initialCollapsed` comes from the collapsed cookie so hard-refresh SSR HTML
 * is already width 0 (localStorage alone cannot fix Server Component HTML).
 */
export function FilesProductSkeleton({
  initialCollapsed = DEFAULT_LIBRARY_COLLAPSED,
  initialWidth = DEFAULT_LIBRARY_WIDTH,
}: {
  initialCollapsed?: boolean;
  initialWidth?: number;
} = {}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  const [libraryWidth, setLibraryWidth] = useState(initialWidth);
  const [prefsRestored, setPrefsRestored] = useState(false);

  useLayoutEffect(() => {
    setSidebarCollapsed(getLibraryCollapsed());
    setLibraryWidth(getLibraryWidth());
    setPrefsRestored(true);
  }, []);

  return (
    <ProductSkeletonTheme
      baseColor="var(--color-files-surface-muted)"
      highlightColor="var(--color-files-surface)"
    >
      <section
        data-product="files"
        aria-label="Files"
        aria-busy="true"
        className="files-product-ui flex h-full w-full overflow-hidden"
      >
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <LibraryRailSkeleton
            collapsed={sidebarCollapsed}
            width={libraryWidth}
            prefsRestored={prefsRestored}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-files-bg">
            <MainHeaderSkeleton collapsed={sidebarCollapsed} />

            <div className="px-6 pb-16 pt-2 lg:px-8">
              <section aria-label="Folders">
                <h2 className="text-product-body font-medium text-files-text-muted">
                  Folders
                </h2>
                <div
                  aria-hidden="true"
                  className="-mx-1 mt-4 flex gap-4 overflow-x-auto px-1 pb-2"
                >
                  {Array.from({ length: SKELETON_FOLDER_CARDS }).map(
                    (_, index) => (
                      <FolderCardSkeleton key={index} />
                    ),
                  )}
                </div>
              </section>

              <section className="mt-10" aria-label="Files">
                <h2 className="text-product-body font-medium text-files-text-muted">
                  Files
                </h2>
                <div className="mt-3">
                  <FilesTableSkeleton />
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </ProductSkeletonTheme>
  );
}
