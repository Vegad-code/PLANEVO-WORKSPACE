type PageTreeNode = {
  id: string;
  label: string;
  parentPageId: string | null;
};

/** Semantic breadcrumb labels from page-tree ancestry (root → current). */
export function pageBreadcrumbLabels(
  pages: PageTreeNode[],
  pageId: string,
): string[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const crumbs: string[] = [];
  let current = byId.get(pageId);
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    crumbs.unshift(current.label.trim() || "Untitled");
    current = current.parentPageId
      ? byId.get(current.parentPageId)
      : undefined;
  }

  return crumbs;
}
