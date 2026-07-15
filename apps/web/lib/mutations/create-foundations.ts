import {
  createFoundationMutations,
  type CreateTaskWithRequiredFoundationInput,
  type DatabaseFoundationResult,
  type DocumentCreationResult,
  type FoundationRpcClient,
  type TaskCreationResult,
  type WorkspaceCreationResult,
} from "@planevo/core/mutations/create-foundations";

export * from "@planevo/core/mutations/create-foundations";

async function mutationsForCurrentActor() {
  const { requireMutationDataAccess } = await import("../data/access");
  const access = await requireMutationDataAccess();
  return createFoundationMutations(
    access.client as unknown as FoundationRpcClient,
    access.ownerId,
  );
}

export async function createWorkspace(input: {
  name: string;
  icon?: string | null;
}): Promise<WorkspaceCreationResult> {
  return (await mutationsForCurrentActor()).createWorkspace(input);
}

export async function createCalendarDatabaseWithViews(input: {
  workspaceId: string;
  name?: string;
}): Promise<DatabaseFoundationResult> {
  return (await mutationsForCurrentActor()).createCalendarDatabaseWithViews(input);
}

export async function createDocumentPage(input: {
  workspaceId: string;
  title?: string;
}): Promise<DocumentCreationResult> {
  return (await mutationsForCurrentActor()).createDocumentPage(input);
}

export async function createTaskWithRequiredFoundation(
  input: CreateTaskWithRequiredFoundationInput,
): Promise<TaskCreationResult> {
  return (await mutationsForCurrentActor()).createTaskWithRequiredFoundation(input);
}
