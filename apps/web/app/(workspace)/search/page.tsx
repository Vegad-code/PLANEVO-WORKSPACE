import Link from "next/link";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { Icon } from "@/app/components/planevo-icon";

type Result = { id: string; title: string; kind: "Page" | "Database" | "File"; href: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const current = await getCurrentWorkspace();
  let results: Result[] = [];

  if (current && query) {
    const { access, workspace } = current;
    const [{ data: pages }, { data: databases }, { data: files }] = await Promise.all([
      access.client.from("pages").select("id,title").eq("workspace_id", workspace.id).eq("is_archived", false).ilike("title", `%${query}%`).limit(8),
      access.client.from("databases").select("id,name").eq("workspace_id", workspace.id).ilike("name", `%${query}%`).limit(8),
      access.client.from("file_sources").select("id,name,page_id").eq("workspace_id", workspace.id).ilike("name", `%${query}%`).limit(8),
    ]);
    results = [
      ...(pages ?? []).map((page) => ({ id: page.id, title: page.title, kind: "Page" as const, href: `/pages/${page.id}` })),
      ...(databases ?? []).map((database) => ({ id: database.id, title: database.name, kind: "Database" as const, href: `/databases/${database.id}` })),
      ...(files ?? []).map((file) => ({ id: file.id, title: file.name, kind: "File" as const, href: file.page_id ? `/pages/${file.page_id}` : "/files" })),
    ];
  }

  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-label uppercase text-text-muted">Universal search</p>
      <h1 className="mt-2 text-h1">Find anything</h1>
      <form className="mt-6 flex min-h-12 items-center gap-3 rounded-card border border-border-strong bg-surface-raised px-4"><Icon name="search" className="size-5 text-text-muted" /><input autoFocus name="q" defaultValue={query} placeholder="Search pages, databases, and files" className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted" /><button type="submit" className="h-8 rounded-lg bg-ink px-3 text-small font-medium text-paper">Search</button></form>
      <div className="mt-8 space-y-2">
        {!query ? <p className="text-body text-text-muted">Search uses only real content in your owned workspaces.</p> : results.length === 0 ? <p className="text-body text-text-muted">No matching workspace content.</p> : results.map((result) => <Link key={`${result.kind}:${result.id}`} href={result.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-4 outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"><Icon name={result.kind === "File" ? "files" : result.kind === "Database" ? "workspace" : "page"} /><span className="min-w-0 flex-1 truncate text-body font-medium">{result.title}</span><span className="text-label uppercase text-text-muted">{result.kind}</span></Link>)}
      </div>
    </div>
  );
}
