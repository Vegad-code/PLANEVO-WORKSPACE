import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "workspace-files";
const CHUNK_CHARACTERS = 4000;
const PREFIXED_BUCKETS = new Set(["page-assets"]);

function storageLocation(storagePath: string): {
  bucket: string;
  path: string;
} {
  const colon = storagePath.indexOf(":");
  if (colon > 0) {
    const prefix = storagePath.slice(0, colon);
    if (PREFIXED_BUCKETS.has(prefix)) {
      return { bucket: prefix, path: storagePath.slice(colon + 1) };
    }
  }
  return { bucket: BUCKET, path: storagePath };
}

function jsonText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(jsonText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  return Object.values(value as Record<string, unknown>)
    .map(jsonText)
    .filter(Boolean)
    .join(" ");
}

function chunks(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const result: string[] = [];
  for (let start = 0; start < normalized.length; start += CHUNK_CHARACTERS) {
    result.push(normalized.slice(start, start + CHUNK_CHARACTERS));
  }
  return result;
}

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("FILE_MAINTENANCE_CRON_SECRET");
  if (
    !expectedSecret ||
    request.headers.get("x-planevo-cron-secret") !== expectedSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing Supabase function configuration", {
      status: 500,
    });
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: jobs, error: claimError } = await client.rpc(
    "claim_file_index_jobs",
    { p_limit: 10 },
  );
  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  let indexed = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      const [
        { data: source, error: sourceError },
        { data: state, error: stateError },
      ] = await Promise.all([
        client
          .from("file_sources")
          .select("id,user_id,page_id,storage_path,mime_type,name")
          .eq("id", job.file_source_id)
          .single(),
        client
          .from("file_document_state")
          .select("format,current_version")
          .eq("file_source_id", job.file_source_id)
          .single(),
      ]);
      if (sourceError) throw sourceError;
      if (stateError) throw stateError;

      const { data: billing } = await client
        .from("user_billing")
        .select("plan")
        .eq("user_id", source.user_id)
        .maybeSingle();
      if (!billing || billing.plan === "free") {
        throw new Error("Automatic indexing requires Plus or Pro.");
      }
      if (state.current_version !== job.target_version) {
        await client
          .from("file_index_jobs")
          .update({ status: "ready" })
          .eq("id", job.id);
        continue;
      }

      let content = "";
      if (state.format === "planevo" && source.page_id) {
        const { data: page, error } = await client
          .from("pages")
          .select("content_json")
          .eq("id", source.page_id)
          .single();
        if (error) throw error;
        content = jsonText(page.content_json);
      } else if (state.format === "markdown" || state.format === "text") {
        const { data: body, error } = await client.storage
          .from(BUCKET)
          .download(source.storage_path);
        if (error) throw error;
        content = await body.text();
      } else {
        throw new Error("This format is not indexable yet.");
      }

      const rows = chunks(content).map((chunk, position) => ({
        position,
        content: chunk,
        token_count: Math.ceil(chunk.length / 4),
        metadata_json: {
          document_version: job.target_version,
          source: "file-document-maintenance",
        },
      }));
      const { error: replaceError } = await client.rpc(
        "replace_file_source_chunks",
        {
          p_file_source_id: source.id,
          p_target_version: job.target_version,
          p_chunks: rows,
        },
      );
      if (replaceError) throw replaceError;
      const { error: jobUpdateError } = await client
        .from("file_index_jobs")
        .update({ status: "ready", last_error: null })
        .eq("id", job.id);
      if (jobUpdateError) throw jobUpdateError;
      indexed += 1;
    } catch (cause) {
      failed += 1;
      const attempts = Number(job.attempts ?? 1);
      await client
        .from("file_index_jobs")
        .update({
          status: attempts >= 5 ? "failed" : "queued",
          available_at: new Date(
            Date.now() + Math.min(60, 2 ** attempts) * 60_000,
          ).toISOString(),
          last_error:
            cause instanceof Error
              ? cause.message.slice(0, 1000)
              : "Index failed",
        })
        .eq("id", job.id);
    }
  }

  const { data: cleanupJobs, error: cleanupClaimError } = await client.rpc(
    "claim_file_storage_cleanup_jobs",
    { p_limit: 10 },
  );
  if (cleanupClaimError) {
    return Response.json({ error: cleanupClaimError.message }, { status: 500 });
  }

  let storageCleanups = 0;
  let storageCleanupFailures = 0;
  for (const cleanup of cleanupJobs ?? []) {
    try {
      const paths = Array.isArray(cleanup.storage_paths)
        ? cleanup.storage_paths.filter(
            (path: unknown): path is string => typeof path === "string",
          )
        : [];
      const { data: ownedWorkspaces, error: workspaceError } = await client
        .from("workspaces")
        .select("id")
        .eq("owner_id", cleanup.user_id);
      if (workspaceError) throw workspaceError;
      const workspacePrefixes = (ownedWorkspaces ?? []).map(
        (workspace) => `${workspace.id}/`,
      );
      for (const storagePath of paths) {
        const isOwnedPageAsset = storagePath.startsWith(
          `page-assets:${cleanup.user_id}/`,
        );
        const isOwnedWorkspaceFile = workspacePrefixes.some((prefix) =>
          storagePath.startsWith(prefix),
        );
        if (!isOwnedPageAsset && !isOwnedWorkspaceFile) {
          throw new Error(
            "Storage cleanup path is outside the owner's namespace.",
          );
        }
      }
      const pathsByBucket = new Map<string, string[]>();
      for (const storagePath of paths) {
        const location = storageLocation(storagePath);
        pathsByBucket.set(location.bucket, [
          ...(pathsByBucket.get(location.bucket) ?? []),
          location.path,
        ]);
      }
      for (const [bucket, bucketPaths] of pathsByBucket) {
        for (let start = 0; start < bucketPaths.length; start += 100) {
          const { error: removeError } = await client.storage
            .from(bucket)
            .remove(bucketPaths.slice(start, start + 100));
          if (removeError) throw removeError;
        }
      }
      const { error: deleteError } = await client
        .from("file_storage_cleanup_jobs")
        .delete()
        .eq("id", cleanup.id);
      if (deleteError) throw deleteError;
      storageCleanups += 1;
    } catch (cause) {
      storageCleanupFailures += 1;
      const attempts = Number(cleanup.attempts ?? 1);
      await client
        .from("file_storage_cleanup_jobs")
        .update({
          status: attempts >= 10 ? "failed" : "queued",
          available_at: new Date(
            Date.now() + Math.min(60, 2 ** attempts) * 60_000,
          ).toISOString(),
          last_error:
            cause instanceof Error
              ? cause.message.slice(0, 1000)
              : "Storage cleanup failed",
        })
        .eq("id", cleanup.id);
    }
  }

  const { data: expired } = await client
    .from("file_revisions")
    .select("id,storage_path")
    .lte("expires_at", new Date().toISOString())
    .limit(100);
  if (expired && expired.length > 0) {
    const paths = expired.map((revision) => revision.storage_path);
    const { error: removeError } = await client.storage
      .from(BUCKET)
      .remove(paths);
    if (!removeError) {
      await client
        .from("file_revisions")
        .delete()
        .in(
          "id",
          expired.map((revision) => revision.id),
        );
    }
  }

  return Response.json({
    claimed: (jobs ?? []).length,
    indexed,
    failed,
    storageCleanups,
    storageCleanupFailures,
    expiredRevisions: expired?.length ?? 0,
  });
});
