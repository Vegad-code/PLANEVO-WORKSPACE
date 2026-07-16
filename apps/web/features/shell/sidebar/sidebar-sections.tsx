"use client";

import type { PageTreeItem } from "@/lib/queries/workspace-shell";
import type { SidebarSectionId } from "@planevo/core/state/sidebar-section-state";
import type { SidebarSectionState } from "@planevo/core/state/sidebar-section-state";
import { CollapsibleSection } from "@/features/shell/sidebar/collapsible-section";
import { PageNavItem } from "@/features/shell/page-nav-item";

type SidebarSectionsProps = {
  pages: PageTreeItem[];
  sectionState: SidebarSectionState;
  onToggleSection: (id: SidebarSectionId) => void;
  onNavigate?: () => void;
};

export function SidebarSections({
  pages,
  sectionState,
  onToggleSection,
  onNavigate,
}: SidebarSectionsProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-2">
      <CollapsibleSection
        id="pinned"
        title="Pinned"
        collapsed={sectionState.pinned}
        onToggle={() => onToggleSection("pinned")}
        empty={
          <p className="px-5 py-2 text-small text-text-muted">
            Pin a page to keep it close.
          </p>
        }
      >
        {null}
      </CollapsibleSection>

      <CollapsibleSection
        id="pages"
        title="My space"
        collapsed={sectionState.pages}
        onToggle={() => onToggleSection("pages")}
      >
        <nav aria-label="My space" className="flex flex-col gap-0.5">
          {pages.map((page) => (
            <PageNavItem
              key={page.id}
              pageId={page.id}
              label={page.label}
              depth={page.depth}
              onNavigate={onNavigate}
            />
          ))}
          {pages.length === 0 && (
            <p className="px-5 py-2 text-small text-text-muted">
              Your pages will appear here.
            </p>
          )}
        </nav>
      </CollapsibleSection>

      <CollapsibleSection
        id="private"
        title="Private"
        collapsed={sectionState.private}
        onToggle={() => onToggleSection("private")}
        empty={
          <p className="px-5 py-2 text-small text-text-muted">
            No private pages yet.
          </p>
        }
      >
        {null}
      </CollapsibleSection>
    </div>
  );
}
