import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  documentFormatForFile,
  isEditableDocumentFormat,
  type DocumentDescriptor,
  type DocumentFormat,
} from "@planevo/core/files/document-descriptor";
import { documentCapabilitiesForPlan } from "@planevo/core/files/document-capabilities";
import {
  decodeEditableText,
  encodeEditableText,
  type EditableTextDocument,
} from "@planevo/core/files/text-roundtrip";
import type { Json } from "@planevo/core/types/database.types";
import { storageCapBytesForPlan } from "@planevo/core/types/plans";
import {
  requireDataAccess,
  requireMutationDataAccess,
} from "@/lib/data/access";
import {
  MAX_PRODUCT_FILE_BYTES,
  PRODUCT_FILES_BUCKET,
} from "@/lib/files/product-files";
import { resolveUserPlan } from "@/lib/files/user-plan";
import {
  enforceRateLimit,
  RATE_LIMITS,
} from "@/lib/security/rate-limit.server";

const MAX_NATIVE_DOCUMENT_BYTES = 2 * 1024 * 1024;
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;

const textMetadataSchema = z.object({
  hasUtf8Bom: z.boolean(),
  newline: z.enum(["lf", "crlf"]),
  trailingNewline: z.boolean(),
});

const saveDocumentSchema = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("planevo"),
    baseVersion: z.number().int().nonnegative(),
    content: z.array(z.unknown()),
    checkpointReason: z
      .enum(["checkpoint", "close", "import", "restore"])
      .optional(),
  }),
  z.object({
    format: z.enum(["markdown", "text"]),
    baseVersion: z.number().int().nonnegative(),
    content: z.string(),
    textMetadata: textMetadataSchema,
    checkpointReason: z
      .enum(["checkpoint", "close", "import", "restore"])
      .optional(),
  }),
]);

const updateDocumentSidebarSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save-note"),
    content: z.string().max(262144),
  }),
  z.object({
    action: z.literal("create-comment"),
    body: z.string().trim().min(1).max(10000),
    anchor: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("resolve-comment"),
    threadId: z.string().uuid(),
    resolved: z.boolean(),
  }),
]);

const restoreRevisionSchema = z.object({
  revisionId: z.string().uuid(),
  baseVersion: z.number().int().nonnegative(),
});

type OwnedFileSource = {
  id: string;
  workspace_id: string;
  page_id: string | null;
  storage_path: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type DocumentState = {
  format: string;
  current_version: number;
  content_hash: string | null;
  indexed_version: number | null;
  last_checkpoint_at: string | null;
  encoding_json: Json;
};

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashJson(value: unknown): { hash: string; serialized: string } {
  const serialized = JSON.stringify(value);
  return {
    hash: createHash("sha256").update(serialized).digest("hex"),
    serialized,
  };
}

function routeError(cause: unknown, fallback: string) {
  const error =
    cause && typeof cause === "object"
      ? (cause as { message?: string; details?: string })
      : null;
  const unauthenticated =
    error?.message?.startsWith("No data access") ||
    error?.message?.startsWith("No mutation access");
  const conflict = error?.message?.includes("document version conflict");
  let currentVersion: number | undefined;

  if (conflict && error?.details) {
    try {
      const detail = JSON.parse(error.details) as { currentVersion?: number };
      currentVersion = detail.currentVersion;
    } catch {
      // The conflict response remains useful without a parsed server version.
    }
  }

  return NextResponse.json(
    {
      error: unauthenticated
        ? "Sign in to edit this file."
        : conflict
          ? "This document changed somewhere else."
          : fallback,
      ...(currentVersion === undefined ? {} : { currentVersion }),
    },
    { status: unauthenticated ? 401 : conflict ? 409 : 500 },
  );
}

async function ownedFileSource(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  fileSourceId: string,
): Promise<OwnedFileSource | null> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("id,workspace_id,page_id,storage_path,name,mime_type,size_bytes")
    .eq("id", fileSourceId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function documentState(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  fileSourceId: string,
): Promise<DocumentState | null> {
  const { data, error } = await access.client
    .from("file_document_state")
    .select(
      "format,current_version,content_hash,indexed_version,last_checkpoint_at,encoding_json",
    )
    .eq("file_source_id", fileSourceId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function descriptorFor(
  source: OwnedFileSource,
  format: DocumentFormat,
  state: DocumentState | null,
  capabilities: ReturnType<typeof documentCapabilitiesForPlan>,
): DocumentDescriptor {
  return {
    fileSourceId: source.id,
    pageId: source.page_id,
    name: source.name,
    mimeType: source.mime_type,
    format,
    currentVersion: state?.current_version ?? 0,
    contentHash: state?.content_hash ?? null,
    indexedVersion: state?.indexed_version ?? null,
    capabilities,
    canonicalSource: source.page_id ? "planevo" : "storage",
  };
}

async function loadNativeContent(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  pageId: string,
): Promise<Json> {
  const { data, error } = await access.client
    .from("pages")
    .select("content_json")
    .eq("id", pageId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Page not found.");
  return data.content_json;
}

async function loadTextContent(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  storagePath: string,
): Promise<EditableTextDocument> {
  const { data, error } = await access.client.storage
    .from(PRODUCT_FILES_BUCKET)
    .download(storagePath);
  if (error) throw error;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > MAX_PRODUCT_FILE_BYTES) {
    throw new Error("This file is too large to edit.");
  }
  return decodeEditableText(bytes);
}

async function loadDocumentSidebarData(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  fileSourceId: string,
) {
  const [noteResult, revisionsResult, threadsResult] = await Promise.all([
    access.client
      .from("file_notes")
      .select("content,updated_at")
      .eq("file_source_id", fileSourceId)
      .eq("user_id", access.ownerId)
      .maybeSingle(),
    access.client
      .from("file_revisions")
      .select("id,version,size_bytes,reason,created_at,expires_at")
      .eq("file_source_id", fileSourceId)
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: false })
      .limit(50),
    access.client
      .from("file_comment_threads")
      .select("id,anchor_json,resolved_at,created_at,updated_at")
      .eq("file_source_id", fileSourceId)
      .eq("user_id", access.ownerId)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);
  if (noteResult.error) throw noteResult.error;
  if (revisionsResult.error) throw revisionsResult.error;
  if (threadsResult.error) throw threadsResult.error;

  const threadIds = (threadsResult.data ?? []).map((thread) => thread.id);
  const commentsResult =
    threadIds.length === 0
      ? { data: [], error: null }
      : await access.client
          .from("file_comments")
          .select("id,thread_id,body,created_at,updated_at")
          .eq("user_id", access.ownerId)
          .in("thread_id", threadIds)
          .order("created_at", { ascending: true });
  if (commentsResult.error) throw commentsResult.error;

  return {
    note: noteResult.data ?? null,
    revisions: revisionsResult.data ?? [],
    commentThreads: (threadsResult.data ?? []).map((thread) => ({
      ...thread,
      comments: (commentsResult.data ?? []).filter(
        (comment) => comment.thread_id === thread.id,
      ),
    })),
  };
}

function shouldCheckpoint(
  state: DocumentState | null,
  reason: "checkpoint" | "close" | "import" | "restore",
): boolean {
  if (reason !== "checkpoint") return true;
  if (!state?.last_checkpoint_at) return true;
  return (
    Date.now() - new Date(state.last_checkpoint_at).getTime() >=
    CHECKPOINT_INTERVAL_MS
  );
}

async function revisionExpiry(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
): Promise<string> {
  const plan = await resolveUserPlan(access);
  const days = plan === "pro" ? 180 : plan === "plus" ? 30 : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function replacementFitsStorageCap(
  access: Awaited<ReturnType<typeof requireMutationDataAccess>>,
  currentSize: number,
  nextSize: number,
): Promise<boolean> {
  if (nextSize <= currentSize) return true;
  const [{ data, error }, plan] = await Promise.all([
    access.client
      .from("file_sources")
      .select("size_bytes")
      .eq("user_id", access.ownerId),
    resolveUserPlan(access),
  ]);
  if (error) throw error;
  const usedBytes = (data ?? []).reduce(
    (total, file) => total + (file.size_bytes ?? 0),
    0,
  );
  return usedBytes - currentSize + nextSize <= storageCapBytesForPlan(plan);
}

async function recordRevision(input: {
  access: Awaited<ReturnType<typeof requireMutationDataAccess>>;
  source: OwnedFileSource;
  version: number;
  path: string;
  sizeBytes: number;
  contentHash: string | null;
  reason: "checkpoint" | "close" | "import" | "restore";
}): Promise<boolean> {
  const expiresAt = await revisionExpiry(input.access);
  const { error } = await input.access.client.from("file_revisions").insert({
    file_source_id: input.source.id,
    user_id: input.access.ownerId,
    version: input.version,
    storage_path: input.path,
    size_bytes: input.sizeBytes,
    content_hash: input.contentHash,
    reason: input.reason,
    expires_at: expiresAt,
  });
  if (error?.code === "23505") return false;
  if (error) throw error;

  const { error: checkpointError } = await input.access.client
    .from("file_document_state")
    .update({ last_checkpoint_at: new Date().toISOString() })
    .eq("file_source_id", input.source.id)
    .eq("user_id", input.access.ownerId);
  if (checkpointError) {
    console.warn("[files:document-save] checkpoint timestamp update failed", {
      fileSourceId: input.source.id,
      version: input.version,
      message: checkpointError.message,
    });
  }
  return true;
}

async function tryRecordRevision(
  input: Parameters<typeof recordRevision>[0],
): Promise<boolean> {
  try {
    return await recordRevision(input);
  } catch (cause) {
    console.warn("[files:document-save] revision checkpoint failed", {
      fileSourceId: input.source.id,
      version: input.version,
      message: cause instanceof Error ? cause.message : "Unknown error",
    });
    return false;
  }
}

async function enqueueDocumentIndex(
  access: Awaited<ReturnType<typeof requireMutationDataAccess>>,
  fileSourceId: string,
  version: number,
): Promise<boolean> {
  try {
    const plan = await resolveUserPlan(access);
    if (!documentCapabilitiesForPlan(plan).automaticIndexing) return false;
    const { error } = await access.client.from("file_index_jobs").upsert(
      {
        file_source_id: fileSourceId,
        user_id: access.ownerId,
        target_version: version,
        status: "queued",
        attempts: 0,
        available_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "file_source_id,target_version" },
    );
    if (error) throw error;
    return true;
  } catch (cause) {
    console.warn("[files:document-save] indexing enqueue failed", {
      fileSourceId,
      version,
      message: cause instanceof Error ? cause.message : "Unknown error",
    });
    return false;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  try {
    const access = await requireDataAccess();
    const { fileSourceId } = await context.params;
    const source = await ownedFileSource(access, fileSourceId);
    if (!source) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const [state, plan, sidebar] = await Promise.all([
      documentState(access, source.id),
      resolveUserPlan(access),
      loadDocumentSidebarData(access, source.id),
    ]);
    const format = documentFormatForFile({
      name: source.name,
      mimeType: source.mime_type,
      pageId: source.page_id,
    });
    const descriptor = descriptorFor(
      source,
      format,
      state,
      documentCapabilitiesForPlan(plan),
    );

    if (!isEditableDocumentFormat(format)) {
      return NextResponse.json({ descriptor, content: null, ...sidebar });
    }

    if (format === "planevo") {
      if (!source.page_id) throw new Error("Planevo document has no page.");
      return NextResponse.json({
        descriptor,
        content: await loadNativeContent(access, source.page_id),
        ...sidebar,
      });
    }

    const textDocument = await loadTextContent(access, source.storage_path);
    return NextResponse.json({
      descriptor,
      content: textDocument.text,
      textMetadata: {
        hasUtf8Bom: textDocument.hasUtf8Bom,
        newline: textDocument.newline,
        trailingNewline: textDocument.trailingNewline,
      },
      ...sidebar,
    });
  } catch (cause) {
    return routeError(cause, "Could not open this document.");
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  let stagedPath: string | null = null;

  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(
      access,
      "product-files:document-save",
      RATE_LIMITS.mutate,
    );
    const { fileSourceId } = await context.params;
    const parsed = saveDocumentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The document save was invalid." },
        { status: 400 },
      );
    }

    const source = await ownedFileSource(access, fileSourceId);
    if (!source) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    const expectedFormat = documentFormatForFile({
      name: source.name,
      mimeType: source.mime_type,
      pageId: source.page_id,
    });
    if (expectedFormat !== parsed.data.format) {
      return NextResponse.json(
        { error: "This file cannot be saved with that editor." },
        { status: 409 },
      );
    }

    const state = await documentState(access, source.id);
    const checkpointReason = parsed.data.checkpointReason ?? "checkpoint";
    const checkpoint = shouldCheckpoint(state, checkpointReason);

    if (parsed.data.format === "planevo") {
      const { hash, serialized } = hashJson(parsed.data.content);
      if (Buffer.byteLength(serialized) > MAX_NATIVE_DOCUMENT_BYTES) {
        return NextResponse.json(
          { error: "This document is too large to save." },
          { status: 413 },
        );
      }
      if (state?.content_hash === hash) {
        const indexQueued =
          state.indexed_version === state.current_version
            ? false
            : await enqueueDocumentIndex(
                access,
                source.id,
                state.current_version,
              );
        return NextResponse.json({
          version: state.current_version,
          contentHash: hash,
          checkpointed: false,
          indexQueued,
        });
      }

      let revisionPath: string | null = null;
      let previousContent: Json | null = null;
      if (checkpoint && source.page_id) {
        previousContent = await loadNativeContent(access, source.page_id);
        const previous = hashJson(previousContent);
        revisionPath = `${source.workspace_id}/revisions/${source.id}/${parsed.data.baseVersion}-${randomUUID()}.json`;
        const { error: revisionUploadError } = await access.client.storage
          .from(PRODUCT_FILES_BUCKET)
          .upload(revisionPath, previous.serialized, {
            contentType: "application/json",
            upsert: false,
          });
        if (revisionUploadError) throw revisionUploadError;
        stagedPath = revisionPath;
      }

      const { data, error } = await access.client.rpc(
        "save_file_page_document",
        {
          p_owner_id: access.ownerId,
          p_file_source_id: source.id,
          p_base_version: parsed.data.baseVersion,
          p_content_json: parsed.data.content as Json,
          p_content_hash: hash,
        },
      );
      if (error) throw error;

      if (revisionPath && previousContent !== null) {
        const previous = hashJson(previousContent);
        const revisionRecorded = await tryRecordRevision({
          access,
          source,
          version: parsed.data.baseVersion,
          path: revisionPath,
          sizeBytes: Buffer.byteLength(previous.serialized),
          contentHash: state?.content_hash ?? previous.hash,
          reason: checkpointReason,
        });
        if (!revisionRecorded) {
          await access.client.storage
            .from(PRODUCT_FILES_BUCKET)
            .remove([revisionPath]);
        }
        stagedPath = null;
      }

      const result = data as { version?: number; contentHash?: string } | null;
      const version = result?.version ?? parsed.data.baseVersion + 1;
      const indexQueued = await enqueueDocumentIndex(
        access,
        source.id,
        version,
      );
      return NextResponse.json({
        version,
        contentHash: result?.contentHash ?? hash,
        checkpointed: Boolean(revisionPath),
        indexQueued,
      });
    }

    const editable: EditableTextDocument = {
      text: parsed.data.content,
      ...parsed.data.textMetadata,
    };
    const bytes = encodeEditableText(editable);
    if (bytes.byteLength > MAX_PRODUCT_FILE_BYTES) {
      return NextResponse.json(
        { error: "This file is larger than the 25 MB editing limit." },
        { status: 413 },
      );
    }
    if (
      !(await replacementFitsStorageCap(
        access,
        source.size_bytes ?? 0,
        bytes.byteLength,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "This edit would exceed your Planevo storage limit. Free space or upgrade before saving.",
        },
        { status: 413 },
      );
    }

    const hash = hashBytes(bytes);
    if (state?.content_hash === hash) {
      const indexQueued =
        state.indexed_version === state.current_version
          ? false
          : await enqueueDocumentIndex(
              access,
              source.id,
              state.current_version,
            );
      return NextResponse.json({
        version: state.current_version,
        contentHash: hash,
        checkpointed: false,
        indexQueued,
      });
    }
    stagedPath = `${source.workspace_id}/edits/${source.id}/${randomUUID()}-${source.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const { error: uploadError } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .upload(stagedPath, bytes, {
        contentType:
          parsed.data.format === "markdown" ? "text/markdown" : "text/plain",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await access.client.rpc(
      "finalize_file_text_document",
      {
        p_owner_id: access.ownerId,
        p_file_source_id: source.id,
        p_base_version: parsed.data.baseVersion,
        p_storage_path: stagedPath,
        p_size_bytes: bytes.byteLength,
        p_content_hash: hash,
        p_format: parsed.data.format,
        p_encoding_json: parsed.data.textMetadata,
      },
    );
    if (error) throw error;

    const result = data as {
      version?: number;
      contentHash?: string;
      previousStoragePath?: string;
    } | null;
    const previousPath = result?.previousStoragePath ?? source.storage_path;
    stagedPath = null;

    if (checkpoint) {
      const revisionRecorded = await tryRecordRevision({
        access,
        source,
        version: parsed.data.baseVersion,
        path: previousPath,
        sizeBytes: source.size_bytes ?? 0,
        contentHash: state?.content_hash ?? null,
        reason: checkpointReason,
      });
      if (!revisionRecorded) {
        const { error: removeError } = await access.client.storage
          .from(PRODUCT_FILES_BUCKET)
          .remove([previousPath]);
        if (removeError) {
          console.warn(
            "[files:document-save] uncheckpointed object cleanup failed",
            {
              fileSourceId: source.id,
              previousPath,
              message: removeError.message,
            },
          );
        }
      }
    } else {
      const { error: removeError } = await access.client.storage
        .from(PRODUCT_FILES_BUCKET)
        .remove([previousPath]);
      if (removeError) {
        console.warn("[files:document-save] previous object cleanup failed", {
          fileSourceId: source.id,
          previousPath,
          message: removeError.message,
        });
      }
    }

    const version = result?.version ?? parsed.data.baseVersion + 1;
    const indexQueued = await enqueueDocumentIndex(access, source.id, version);
    return NextResponse.json({
      version,
      contentHash: result?.contentHash ?? hash,
      checkpointed: checkpoint,
      indexQueued,
    });
  } catch (cause) {
    if (stagedPath) {
      try {
        const access = await requireMutationDataAccess();
        await access.client.storage
          .from(PRODUCT_FILES_BUCKET)
          .remove([stagedPath]);
      } catch {
        // A cleanup job can reap abandoned edit objects by their path prefix.
      }
    }
    return routeError(cause, "Could not save this document.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(
      access,
      "product-files:document-sidebar",
      RATE_LIMITS.mutate,
    );
    const { fileSourceId } = await context.params;
    const parsed = updateDocumentSidebarSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The document update was invalid." },
        { status: 400 },
      );
    }
    const source = await ownedFileSource(access, fileSourceId);
    if (!source) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (parsed.data.action === "save-note") {
      const { error } = await access.client.from("file_notes").upsert(
        {
          file_source_id: source.id,
          user_id: access.ownerId,
          content: parsed.data.content,
        },
        { onConflict: "file_source_id" },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const plan = await resolveUserPlan(access);
    const capabilities = documentCapabilitiesForPlan(plan);
    if (!capabilities.createCommentThreads) {
      return NextResponse.json(
        {
          error:
            "Comment threads are available on Plus and Pro. Existing threads stay readable.",
        },
        { status: 403 },
      );
    }

    if (parsed.data.action === "create-comment") {
      const { data: thread, error: threadError } = await access.client
        .from("file_comment_threads")
        .insert({
          file_source_id: source.id,
          user_id: access.ownerId,
          anchor_json: (parsed.data.anchor ?? {}) as Json,
        })
        .select("id")
        .single();
      if (threadError) throw threadError;

      const { error: commentError } = await access.client
        .from("file_comments")
        .insert({
          thread_id: thread.id,
          user_id: access.ownerId,
          body: parsed.data.body,
        });
      if (commentError) {
        await access.client
          .from("file_comment_threads")
          .delete()
          .eq("id", thread.id)
          .eq("user_id", access.ownerId);
        throw commentError;
      }
      return NextResponse.json({ ok: true, threadId: thread.id });
    }

    const { error } = await access.client
      .from("file_comment_threads")
      .update({
        resolved_at: parsed.data.resolved ? new Date().toISOString() : null,
      })
      .eq("id", parsed.data.threadId)
      .eq("file_source_id", source.id)
      .eq("user_id", access.ownerId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return routeError(cause, "Could not update this document.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  let stagedPath: string | null = null;

  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(
      access,
      "product-files:document-restore",
      RATE_LIMITS.mutate,
    );
    const { fileSourceId } = await context.params;
    const parsed = restoreRevisionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid version to restore." },
        { status: 400 },
      );
    }
    const source = await ownedFileSource(access, fileSourceId);
    if (!source) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    const [state, revisionResult] = await Promise.all([
      documentState(access, source.id),
      access.client
        .from("file_revisions")
        .select("id,storage_path,version")
        .eq("id", parsed.data.revisionId)
        .eq("file_source_id", source.id)
        .eq("user_id", access.ownerId)
        .maybeSingle(),
    ]);
    if (revisionResult.error) throw revisionResult.error;
    if (!revisionResult.data) {
      return NextResponse.json(
        { error: "That version is no longer available." },
        { status: 404 },
      );
    }
    const currentVersion = state?.current_version ?? 0;
    if (currentVersion !== parsed.data.baseVersion) {
      return NextResponse.json(
        {
          error: "This document changed somewhere else.",
          currentVersion,
        },
        { status: 409 },
      );
    }
    const { data: revisionBlob, error: downloadError } =
      await access.client.storage
        .from(PRODUCT_FILES_BUCKET)
        .download(revisionResult.data.storage_path);
    if (downloadError) throw downloadError;
    const revisionBytes = new Uint8Array(await revisionBlob.arrayBuffer());

    if (state?.format === "planevo" || source.page_id) {
      const restoredContent = JSON.parse(
        new TextDecoder().decode(revisionBytes),
      ) as unknown;
      if (!Array.isArray(restoredContent)) {
        throw new Error("The saved version is not a Planevo document.");
      }
      const restored = hashJson(restoredContent);
      if (Buffer.byteLength(restored.serialized) > MAX_NATIVE_DOCUMENT_BYTES) {
        throw new Error("The saved version is too large to restore.");
      }

      if (!source.page_id) throw new Error("Planevo document has no page.");
      const currentContent = await loadNativeContent(access, source.page_id);
      const current = hashJson(currentContent);
      stagedPath = `${source.workspace_id}/revisions/${source.id}/${currentVersion}-${randomUUID()}.json`;
      const { error: uploadError } = await access.client.storage
        .from(PRODUCT_FILES_BUCKET)
        .upload(stagedPath, current.serialized, {
          contentType: "application/json",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await access.client.rpc(
        "save_file_page_document",
        {
          p_owner_id: access.ownerId,
          p_file_source_id: source.id,
          p_base_version: currentVersion,
          p_content_json: restoredContent as Json,
          p_content_hash: restored.hash,
        },
      );
      if (error) throw error;
      const revisionRecorded = await tryRecordRevision({
        access,
        source,
        version: currentVersion,
        path: stagedPath,
        sizeBytes: Buffer.byteLength(current.serialized),
        contentHash: state?.content_hash ?? current.hash,
        reason: "restore",
      });
      if (!revisionRecorded) {
        await access.client.storage
          .from(PRODUCT_FILES_BUCKET)
          .remove([stagedPath]);
      }
      stagedPath = null;
      const result = data as { version?: number } | null;
      const version = result?.version ?? currentVersion + 1;
      await enqueueDocumentIndex(access, source.id, version);
      return NextResponse.json({ ok: true, version });
    }

    if (state?.format !== "markdown" && state?.format !== "text") {
      return NextResponse.json(
        { error: "This file type cannot be restored in the editor." },
        { status: 409 },
      );
    }
    if (revisionBytes.byteLength > MAX_PRODUCT_FILE_BYTES) {
      throw new Error("The saved version is too large to restore.");
    }
    const restoredText = decodeEditableText(revisionBytes);
    const restoredHash = hashBytes(revisionBytes);
    stagedPath = `${source.workspace_id}/edits/${source.id}/${randomUUID()}-${source.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const { error: uploadError } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .upload(stagedPath, revisionBytes, {
        contentType:
          state.format === "markdown" ? "text/markdown" : "text/plain",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { data, error } = await access.client.rpc(
      "finalize_file_text_document",
      {
        p_owner_id: access.ownerId,
        p_file_source_id: source.id,
        p_base_version: currentVersion,
        p_storage_path: stagedPath,
        p_size_bytes: revisionBytes.byteLength,
        p_content_hash: restoredHash,
        p_format: state.format,
        p_encoding_json: {
          hasUtf8Bom: restoredText.hasUtf8Bom,
          newline: restoredText.newline,
          trailingNewline: restoredText.trailingNewline,
        },
      },
    );
    if (error) throw error;
    const result = data as {
      version?: number;
      previousStoragePath?: string;
    } | null;
    stagedPath = null;
    const revisionRecorded = await tryRecordRevision({
      access,
      source,
      version: currentVersion,
      path: result?.previousStoragePath ?? source.storage_path,
      sizeBytes: source.size_bytes ?? 0,
      contentHash: state.content_hash,
      reason: "restore",
    });
    if (!revisionRecorded) {
      await access.client.storage
        .from(PRODUCT_FILES_BUCKET)
        .remove([result?.previousStoragePath ?? source.storage_path]);
    }
    const version = result?.version ?? currentVersion + 1;
    await enqueueDocumentIndex(access, source.id, version);
    return NextResponse.json({ ok: true, version });
  } catch (cause) {
    if (stagedPath) {
      try {
        const access = await requireMutationDataAccess();
        await access.client.storage
          .from(PRODUCT_FILES_BUCKET)
          .remove([stagedPath]);
      } catch {
        // Maintenance cleans abandoned staged objects.
      }
    }
    return routeError(cause, "Could not restore this version.");
  }
}
