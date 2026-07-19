import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { cleanupOwnedTaskAttachment } from "@/lib/tasks/task-attachment-cleanup.server";
import type { TaskAttachmentCleanupTarget } from "@/lib/tasks/task-attachment-cleanup";
import {
  requireTaskAttachmentCleanupCandidate,
  requireTaskAttachmentSize,
} from "@/lib/tasks/task-attachment-integrity";
import {
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENTS,
  TASK_ATTACHMENT_BUCKET,
  taskAttachmentObjectName,
} from "@/lib/tasks/task-attachments";

const uploadTargetSchema = z.object({
  operationKey: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255),
  sizeBytes: z
    .number()
    .finite()
    .int()
    .positive()
    .max(MAX_TASK_ATTACHMENT_BYTES),
});

const cleanupTargetSchema = z.object({
  sourceId: z.string().uuid(),
  storagePath: z.string().min(1).max(1_024),
});

const discardUploadsSchema = z.object({
  uploads: z
    .array(cleanupTargetSchema)
    .max(MAX_TASK_ATTACHMENTS)
    .superRefine((uploads, context) => {
      const sourceIds = new Set<string>();
      const storagePaths = new Set<string>();
      for (const [index, upload] of uploads.entries()) {
        if (
          sourceIds.has(upload.sourceId) ||
          storagePaths.has(upload.storagePath)
        ) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "Attachment cleanup targets must be unique.",
          });
        }
        sourceIds.add(upload.sourceId);
        storagePaths.add(upload.storagePath);
      }
    }),
});

const recoverySchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
});

const reservationResultSchema = z.object({
  id: z.string().uuid(),
  storage_path: z.string(),
});

function cleanFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "upload";
}

function routeError(cause: unknown, fallback: string) {
  const unauthenticated =
    cause instanceof Error && cause.message.startsWith("No mutation access");
  return NextResponse.json(
    { error: unauthenticated ? "Sign in to attach files." : fallback },
    { status: unauthenticated ? 401 : 500 },
  );
}

/**
 * Issue a short-lived Supabase signed-upload token. File bytes travel directly
 * from the browser to private storage, so the create-task Server Action stays
 * below Next's request-body limit even at the advertised attachment size.
 */
export async function POST(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    const current = await getCurrentWorkspace();
    if (!current || current.access.ownerId !== access.ownerId) {
      return NextResponse.json(
        { error: "Open a workspace before attaching files to a task." },
        { status: 409 },
      );
    }

    const parsed = uploadTargetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a file that is 25 MB or smaller." },
        { status: 400 },
      );
    }

    requireTaskAttachmentSize(parsed.data.sizeBytes);
    const proposedPath = `${current.workspace.id}/${randomUUID()}-${cleanFileName(parsed.data.name)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: reservation, error: sourceError } = await access.client.rpc(
      "reserve_task_attachment",
      {
        p_owner_id: access.ownerId,
        p_workspace_id: current.workspace.id,
        p_operation_key: parsed.data.operationKey,
        p_storage_path: proposedPath,
        p_name: parsed.data.name,
        p_mime_type: parsed.data.mimeType,
        p_size_bytes: parsed.data.sizeBytes,
        p_expires_at: expiresAt,
      },
    );
    if (sourceError) throw sourceError;
    const source = reservationResultSchema.parse(reservation);
    const storagePath = source.storage_path;

    const target = {
      sourceId: source.id,
      storagePath,
    } satisfies TaskAttachmentCleanupTarget;
    const { data, error } = await access.client.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.path || !data.token) {
      const cleanup = await cleanupOwnedTaskAttachment(access, target);
      if (!cleanup.ok) {
        return NextResponse.json(
          {
            error:
              "Could not prepare the upload, and attachment cleanup remains pending.",
            removed: 0,
            pending: [target],
          },
          { status: 503 },
        );
      }
      throw error ?? new Error("Signed upload target was incomplete.");
    }

    return NextResponse.json({
      sourceId: source.id,
      path: data.path,
      token: data.token,
    });
  } catch (cause) {
    return routeError(cause, "Could not prepare the attachment upload.");
  }
}

/** Confirmed cleanup for reserved uploads when task creation does not happen. */
export async function DELETE(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    const current = await getCurrentWorkspace();
    if (!current || current.access.ownerId !== access.ownerId) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    const parsed = discardUploadsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid attachment cleanup." }, { status: 400 });
    }

    const uploads = parsed.data.uploads;
    if (
      uploads.some(
        (upload) =>
          taskAttachmentObjectName(
            upload.storagePath,
            current.workspace.id,
          ) === null,
      )
    ) {
      return NextResponse.json({ error: "Invalid attachment path." }, { status: 400 });
    }

    if (uploads.length === 0) return NextResponse.json({ removed: 0 });

    const outcomes = [];
    for (const upload of uploads) {
      try {
        outcomes.push(await cleanupOwnedTaskAttachment(access, upload));
      } catch (cause) {
        outcomes.push({
          ok: false as const,
          target: upload,
          stage: "database" as const,
          operation: "mark_pending" as const,
          error: cause instanceof Error ? cause.message : "Cleanup failed.",
          cleanupPending: true as const,
        });
      }
    }
    const failures = outcomes.filter((outcome) => !outcome.ok);
    if (failures.length > 0) {
      return NextResponse.json(
        {
          error: "Attachment cleanup remains pending.",
          removed: outcomes.length - failures.length,
          pending: failures.map((failure) => failure.target),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ removed: outcomes.length });
  } catch (cause) {
    return routeError(cause, "Could not discard the attachment upload.");
  }
}

/** Inventory or reap this user's expired reservations; safe for operator retry. */
export async function PATCH(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    const current = await getCurrentWorkspace();
    if (!current || current.access.ownerId !== access.ownerId) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }
    const parsed = recoverySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid recovery request." }, { status: 400 });
    const { data, error } = await access.client
      .from("file_sources")
      .select("id,storage_path,metadata_json,reservation_expires_at")
      .eq("user_id", access.ownerId)
      .eq("workspace_id", current.workspace.id)
      .lte("reservation_expires_at", new Date().toISOString())
      .order("reservation_expires_at", { ascending: true })
      .limit(parsed.data.limit);
    if (error) throw error;
    const targets = (data ?? [])
      .filter((row) => {
        try { requireTaskAttachmentCleanupCandidate(row.metadata_json); return true; } catch { return false; }
      })
      .map((row) => ({ sourceId: row.id, storagePath: row.storage_path }));
    if (parsed.data.dryRun) return NextResponse.json({ dryRun: true, count: targets.length, targets });
    const outcomes = [];
    for (const target of targets) outcomes.push(await cleanupOwnedTaskAttachment(access, target));
    return NextResponse.json({ dryRun: false, count: targets.length, outcomes });
  } catch (cause) {
    return routeError(cause, "Could not recover abandoned attachments.");
  }
}
