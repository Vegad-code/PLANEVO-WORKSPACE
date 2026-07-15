import type { Json } from "../types/database.types";

type RpcError = { message: string; code?: string; details?: string; hint?: string };

export type FoundationRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
};

export type WorkspaceCreationResult = { workspaceId: string };
export type DatabaseFoundationResult = {
  workspaceId: string;
  pageId: string;
  databaseId: string;
};
export type DocumentCreationResult = { workspaceId: string; pageId: string };
export type TaskCreationResult = {
  workspaceId: string;
  databaseId: string;
  recordId: string;
};

export type CreateTaskWithRequiredFoundationInput = {
  workspaceId?: string | null;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  tags?: string[];
  attachments?: unknown[];
};

export class FoundationMutationError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "FoundationMutationError";
    this.code = code;
  }
}

function requireText(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new FoundationMutationError(`${label} is required`, "VALIDATION");
  return result;
}

function optionalText(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function requireResultObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FoundationMutationError("The database returned an invalid mutation result.");
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown, key: string): string {
  if (typeof value !== "string" || !value) {
    throw new FoundationMutationError(`The database did not return ${key}.`);
  }
  return value;
}

function toJsonArray(values: unknown[], label: string): Json[] {
  try {
    const serialized = JSON.stringify(values);
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed as Json[];
  } catch {
    throw new FoundationMutationError(`${label} must be JSON serializable.`, "VALIDATION");
  }
}

async function callRpc(
  client: FoundationRpcClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new FoundationMutationError(error.message, error.code);
  return requireResultObject(data);
}

export function createFoundationMutations(client: FoundationRpcClient, ownerId: string) {
  return {
    async createWorkspace(input: {
      name: string;
      icon?: string | null;
    }): Promise<WorkspaceCreationResult> {
      const result = await callRpc(client, "create_planevo_workspace", {
        p_owner_id: ownerId,
        p_name: requireText(input.name, "Workspace name"),
        p_icon: input.icon ?? null,
      });
      return { workspaceId: requireId(result.workspace_id, "workspace_id") };
    },

    async createTaskDatabaseWithViews(input: {
      workspaceId: string;
      name?: string;
    }): Promise<DatabaseFoundationResult> {
      const result = await callRpc(client, "create_task_database_with_views", {
        p_owner_id: ownerId,
        p_workspace_id: input.workspaceId,
        p_name: input.name?.trim() || "Tasks",
      });
      return {
        workspaceId: requireId(result.workspace_id, "workspace_id"),
        pageId: requireId(result.page_id, "page_id"),
        databaseId: requireId(result.database_id, "database_id"),
      };
    },

    async createCalendarDatabaseWithViews(input: {
      workspaceId: string;
      name?: string;
    }): Promise<DatabaseFoundationResult> {
      const result = await callRpc(client, "create_calendar_database_with_views", {
        p_owner_id: ownerId,
        p_workspace_id: input.workspaceId,
        p_name: input.name?.trim() || "Calendar",
      });
      return {
        workspaceId: requireId(result.workspace_id, "workspace_id"),
        pageId: requireId(result.page_id, "page_id"),
        databaseId: requireId(result.database_id, "database_id"),
      };
    },

    async createDocumentPage(input: {
      workspaceId: string;
      title?: string;
    }): Promise<DocumentCreationResult> {
      const result = await callRpc(client, "create_document_page", {
        p_owner_id: ownerId,
        p_workspace_id: input.workspaceId,
        p_title: input.title?.trim() || "Untitled",
      });
      return {
        workspaceId: requireId(result.workspace_id, "workspace_id"),
        pageId: requireId(result.page_id, "page_id"),
      };
    },

    async createTaskWithRequiredFoundation(
      input: CreateTaskWithRequiredFoundationInput,
    ): Promise<TaskCreationResult> {
      const title = requireText(input.title, "Task title");
      if (
        input.estimateMinutes !== undefined &&
        input.estimateMinutes !== null &&
        (!Number.isInteger(input.estimateMinutes) || input.estimateMinutes < 0)
      ) {
        throw new FoundationMutationError(
          "Estimate minutes must be a non-negative integer.",
          "VALIDATION",
        );
      }
      if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) {
        throw new FoundationMutationError("Due date is invalid.", "VALIDATION");
      }

      const result = await callRpc(client, "create_task_with_required_foundation", {
        p_owner_id: ownerId,
        p_workspace_id: input.workspaceId ?? null,
        p_title: title,
        p_description: optionalText(input.description),
        p_status: input.status?.trim() || "To do",
        p_priority: optionalText(input.priority),
        p_due_date: input.dueDate ?? null,
        p_estimate_minutes: input.estimateMinutes ?? null,
        p_tags: toJsonArray(input.tags ?? [], "Tags"),
        p_attachments: toJsonArray(input.attachments ?? [], "Attachments"),
      });
      return {
        workspaceId: requireId(result.workspace_id, "workspace_id"),
        databaseId: requireId(result.database_id, "database_id"),
        recordId: requireId(result.record_id, "record_id"),
      };
    },
  };
}
