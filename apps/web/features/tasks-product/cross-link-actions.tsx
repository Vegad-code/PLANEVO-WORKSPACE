"use client";

import {
  Calendar,
  LayoutGrid,
  Paperclip,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  attachFileToProductTaskAction,
  linkProductTaskToWorkspaceAction,
  loadTaskCrossLinkOptionsAction,
  scheduleProductTaskAction,
} from "@/app/(workspace)/tasks/actions";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  formatTaskFileSize,
  scheduleRangeFromLocalInputs,
  type TaskCrossLinkOptions,
  type TaskFileOption,
  type TaskWorkspaceOption,
} from "@/lib/tasks/task-cross-link-contracts";

type CrossLinkPanel = "schedule" | "files" | "workspace";
type PendingAction = "schedule" | `file:${string}` | `workspace:${string}`;

type CrossLinkActionButtonsProps = {
  fileCount: number;
  disabled?: boolean;
  onSchedule: () => void;
  onAttachFile: () => void;
  onAddToWorkspace: () => void;
};

const actionButtonClassName =
  "flex min-h-20 flex-col items-start justify-between gap-3 rounded-card border border-border bg-paper p-3 text-left text-small font-medium text-ink outline-none hover:border-border-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "w-full rounded-lg border border-border-strong bg-paper px-3 py-2 text-body text-ink outline-none focus:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

function CrossLinkActionButtons({
  fileCount,
  disabled = false,
  onSchedule,
  onAttachFile,
  onAddToWorkspace,
}: CrossLinkActionButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onSchedule}
        className={actionButtonClassName}
      >
        <Calendar aria-hidden="true" className="size-5 text-text-muted" />
        <span>Schedule</span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onAttachFile}
        className={actionButtonClassName}
      >
        <Paperclip aria-hidden="true" className="size-5 text-text-muted" />
        <span>
          Attach file
          <span className="ml-1 font-mono text-mono text-text-muted">
            {fileCount}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onAddToWorkspace}
        className={actionButtonClassName}
      >
        <LayoutGrid aria-hidden="true" className="size-5 text-text-muted" />
        <span>Add to workspace</span>
      </button>
    </div>
  );
}

function ScheduleFields({
  date,
  startTime,
  endTime,
  disabled,
  focusDate = false,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: {
  date: string;
  startTime: string;
  endTime: string;
  disabled: boolean;
  focusDate?: boolean;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-label uppercase text-text-muted">Date</span>
        <input
          autoFocus={focusDate}
          required
          type="date"
          value={date}
          disabled={disabled}
          onChange={(event) => onDateChange(event.target.value)}
          className={fieldClassName}
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-label uppercase text-text-muted">Starts</span>
        <input
          required
          type="time"
          value={startTime}
          disabled={disabled}
          onChange={(event) => onStartTimeChange(event.target.value)}
          className={fieldClassName}
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-label uppercase text-text-muted">Ends</span>
        <input
          required
          type="time"
          value={endTime}
          disabled={disabled}
          onChange={(event) => onEndTimeChange(event.target.value)}
          className={fieldClassName}
        />
      </label>
    </div>
  );
}

function FileOptionsList({
  files,
  pendingAction,
  onAttach,
}: {
  files: readonly TaskFileOption[];
  pendingAction: PendingAction | null;
  onAttach: (file: TaskFileOption) => void;
}) {
  if (files.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-paper px-4 py-8 text-center">
        <p className="text-body font-medium text-ink">No available files</p>
        <p className="mt-1 text-small text-text-muted">
          Every visible file is already attached, or your file library is empty.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto">
      {files.map((file) => {
        const isPending = pendingAction === `file:${file.id}`;
        return (
          <li key={file.id}>
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => onAttach(file)}
              className="flex w-full items-center gap-3 rounded-card border border-border bg-paper p-3 text-left outline-none hover:border-border-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted">
                <Paperclip aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-medium text-ink">
                  {file.name}
                </span>
                <span className="mt-0.5 block text-label text-text-muted">
                  {formatTaskFileSize(file.sizeBytes)}
                  {file.mimeType ? ` · ${file.mimeType}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-small font-medium text-text-secondary">
                {isPending ? "Attaching…" : "Attach"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WorkspaceOptionsList({
  workspaces,
  pendingAction,
  onAdd,
}: {
  workspaces: readonly TaskWorkspaceOption[];
  pendingAction: PendingAction | null;
  onAdd: (workspace: TaskWorkspaceOption) => void;
}) {
  if (workspaces.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-paper px-4 py-8 text-center">
        <p className="text-body font-medium text-ink">No workspace available</p>
        <p className="mt-1 text-small text-text-muted">
          Create a workspace before linking this task.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto">
      {workspaces.map((workspace) => {
        const isPending = pendingAction === `workspace:${workspace.id}`;
        return (
          <li key={workspace.id}>
            <button
              type="button"
              disabled={workspace.isLinked || pendingAction !== null}
              onClick={() => onAdd(workspace)}
              className="flex w-full items-center gap-3 rounded-card border border-border bg-paper p-3 text-left outline-none hover:border-border-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted">
                <LayoutGrid aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-medium text-ink">
                  {workspace.name}
                </span>
                <span className="mt-0.5 block text-label text-text-muted">
                  {workspace.isCurrent ? "Current workspace" : "Workspace"}
                </span>
              </span>
              <span className="shrink-0 text-small font-medium text-text-secondary">
                {workspace.isLinked
                  ? "Added"
                  : isPending
                    ? "Adding…"
                    : "Add"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-brick bg-brick-tint px-3 py-2 text-small text-ink"
    >
      {message}
    </p>
  );
}

function DialogHeader({
  titleId,
  title,
  description,
  disabled,
  focusClose = false,
  onClose,
}: {
  titleId: string;
  title: string;
  description: string;
  disabled: boolean;
  focusClose?: boolean;
  onClose: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        <p className="mt-1 text-small text-text-secondary">{description}</p>
      </div>
      <button
        autoFocus={focusClose}
        type="button"
        disabled={disabled}
        onClick={onClose}
        aria-label={`Close ${title.toLowerCase()}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </header>
  );
}

function initialLocalDate(dueAt: string | null): string {
  const dueDate = dueAt ? new Date(dueAt) : new Date();
  const value = Number.isNaN(dueDate.getTime()) ? new Date() : dueDate;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TaskCrossLinkActions({
  taskId,
  dueAt,
  initialFileCount,
}: {
  taskId: string;
  dueAt: string | null;
  initialFileCount: number;
}) {
  const router = useRouter();
  const scheduleTitleId = useId();
  const filesTitleId = useId();
  const workspaceTitleId = useId();
  const requestId = useRef(0);
  const scheduleOperationKey = useRef<string | null>(null);
  const [activePanel, setActivePanel] = useState<CrossLinkPanel | null>(null);
  const [options, setOptions] = useState<TaskCrossLinkOptions | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [fileCount, setFileCount] = useState(initialFileCount);
  const [scheduleDate, setScheduleDate] = useState(() => initialLocalDate(dueAt));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  function closePanel() {
    if (pendingAction) return;
    requestId.current += 1;
    setActivePanel(null);
    setOptions(null);
    setIsLoadingOptions(false);
    setLoadError(null);
    setActionError(null);
    scheduleOperationKey.current = null;
  }

  function openSchedule() {
    setActionError(null);
    setActivePanel("schedule");
  }

  async function loadOptions(panel: "files" | "workspace") {
    const nextRequest = requestId.current + 1;
    requestId.current = nextRequest;
    setActivePanel(panel);
    setOptions(null);
    setLoadError(null);
    setActionError(null);
    setIsLoadingOptions(true);

    try {
      const result = await loadTaskCrossLinkOptionsAction({ taskId });
      if (requestId.current !== nextRequest) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setOptions(result.data);
    } catch (cause) {
      if (requestId.current !== nextRequest) return;
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Could not load cross-feature options.",
      );
    } finally {
      if (requestId.current === nextRequest) setIsLoadingOptions(false);
    }
  }

  async function submitSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const range = scheduleRangeFromLocalInputs({
      date: scheduleDate,
      startTime,
      endTime,
    });
    if (!range.ok) {
      setActionError(range.error);
      return;
    }

    setActionError(null);
    setPendingAction("schedule");
    try {
      scheduleOperationKey.current ??= crypto.randomUUID();
      const result = await scheduleProductTaskAction({
        taskId,
        operationKey: scheduleOperationKey.current,
        ...range,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      requestId.current += 1;
      scheduleOperationKey.current = null;
      setActivePanel(null);
      toast("Scheduled on your calendar");
      router.refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not schedule the task.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function attachFile(file: TaskFileOption) {
    setActionError(null);
    setPendingAction(`file:${file.id}`);
    try {
      const result = await attachFileToProductTaskAction({
        taskId,
        fileSourceId: file.id,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setFileCount(result.data.fileCount);
      requestId.current += 1;
      setActivePanel(null);
      setOptions(null);
      toast(`Attached ${result.data.fileName}`);
      router.refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not attach the file.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function addToWorkspace(workspace: TaskWorkspaceOption) {
    setActionError(null);
    setPendingAction(`workspace:${workspace.id}`);
    try {
      const result = await linkProductTaskToWorkspaceAction({
        taskId,
        workspaceId: workspace.id,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      requestId.current += 1;
      setActivePanel(null);
      setOptions(null);
      toast(`Added to ${result.data.workspaceName}`);
      router.refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Could not add the task to the workspace.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const dialogClassName =
    "m-auto w-full max-w-md rounded-card border border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30";

  return (
    <section aria-labelledby="task-cross-link-title" className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="task-cross-link-title" className="text-h3">
            Connect
          </h3>
          <p className="mt-1 text-small text-text-muted">
            Link this task without leaving your board.
          </p>
        </div>
      </div>

      <CrossLinkActionButtons
        fileCount={fileCount}
        disabled={pendingAction !== null}
        onSchedule={openSchedule}
        onAttachFile={() => void loadOptions("files")}
        onAddToWorkspace={() => void loadOptions("workspace")}
      />

      {activePanel === "schedule" ? (
        <Dialog
          open
          onClose={closePanel}
          labelledBy={scheduleTitleId}
          className={dialogClassName}
        >
          <form onSubmit={submitSchedule}>
            <DialogHeader
              titleId={scheduleTitleId}
              title="Schedule task"
              description="Reserve a focused block on your default calendar."
              disabled={pendingAction !== null}
              onClose={closePanel}
            />
            <div className="space-y-4 px-5 py-5">
              <ScheduleFields
                date={scheduleDate}
                startTime={startTime}
                endTime={endTime}
                disabled={pendingAction !== null}
                focusDate
                onDateChange={setScheduleDate}
                onStartTimeChange={setStartTime}
                onEndTimeChange={setEndTime}
              />
              {actionError ? <InlineError message={actionError} /> : null}
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={closePanel}
                className="rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingAction !== null}
                className="rounded-lg bg-ink px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                {pendingAction === "schedule" ? "Scheduling…" : "Schedule"}
              </button>
            </footer>
          </form>
        </Dialog>
      ) : null}

      {activePanel === "files" ? (
        <Dialog
          open
          onClose={closePanel}
          labelledBy={filesTitleId}
          className={dialogClassName}
        >
          <DialogHeader
            titleId={filesTitleId}
            title="Attach a file"
            description="Choose from your visible file library."
            disabled={pendingAction !== null}
            focusClose
            onClose={closePanel}
          />
          <div className="space-y-4 px-5 py-5">
            {isLoadingOptions ? (
              <p role="status" className="py-8 text-center text-small text-text-muted">
                Loading files…
              </p>
            ) : loadError ? (
              <div className="space-y-3">
                <InlineError message={loadError} />
                <button
                  type="button"
                  onClick={() => void loadOptions("files")}
                  className="rounded-lg border border-border-strong bg-paper px-3 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <FileOptionsList
                  files={options?.files ?? []}
                  pendingAction={pendingAction}
                  onAttach={(file) => void attachFile(file)}
                />
                {actionError ? <InlineError message={actionError} /> : null}
              </>
            )}
          </div>
          <footer className="flex justify-end border-t border-border px-5 py-4">
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={closePanel}
              className="rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              Cancel
            </button>
          </footer>
        </Dialog>
      ) : null}

      {activePanel === "workspace" ? (
        <Dialog
          open
          onClose={closePanel}
          labelledBy={workspaceTitleId}
          className={dialogClassName}
        >
          <DialogHeader
            titleId={workspaceTitleId}
            title="Add to workspace"
            description="Link this global task into one of your workspaces."
            disabled={pendingAction !== null}
            focusClose
            onClose={closePanel}
          />
          <div className="space-y-4 px-5 py-5">
            {isLoadingOptions ? (
              <p role="status" className="py-8 text-center text-small text-text-muted">
                Loading workspaces…
              </p>
            ) : loadError ? (
              <div className="space-y-3">
                <InlineError message={loadError} />
                <button
                  type="button"
                  onClick={() => void loadOptions("workspace")}
                  className="rounded-lg border border-border-strong bg-paper px-3 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <WorkspaceOptionsList
                  workspaces={options?.workspaces ?? []}
                  pendingAction={pendingAction}
                  onAdd={(workspace) => void addToWorkspace(workspace)}
                />
                {actionError ? <InlineError message={actionError} /> : null}
              </>
            )}
          </div>
          <footer className="flex justify-end border-t border-border px-5 py-4">
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={closePanel}
              className="rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              Cancel
            </button>
          </footer>
        </Dialog>
      ) : null}
    </section>
  );
}

export type TaskCrossLinkActionsPreviewState =
  | "default"
  | "schedule"
  | "files"
  | "files-empty"
  | "workspace"
  | "workspace-empty"
  | "loading"
  | "pending"
  | "success"
  | "error";

const PREVIEW_FILES: TaskFileOption[] = [
  {
    id: "preview-file-brief",
    name: "Launch brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_621_440,
  },
  {
    id: "preview-file-notes",
    name: "Research notes.txt",
    mimeType: "text/plain",
    sizeBytes: 8_192,
  },
];

const PREVIEW_WORKSPACES: TaskWorkspaceOption[] = [
  {
    id: "preview-workspace-school",
    name: "School",
    isCurrent: true,
    isLinked: false,
  },
  {
    id: "preview-workspace-personal",
    name: "Personal",
    isCurrent: false,
    isLinked: true,
  },
];

export function TaskCrossLinkActionsPreview({
  state,
}: {
  state: TaskCrossLinkActionsPreviewState;
}) {
  const noOp = () => undefined;
  const panelClassName =
    "rounded-card border border-border bg-surface-raised p-4 text-ink";

  if (state === "schedule") {
    return (
      <div className={panelClassName}>
        <h4 className="text-h3">Schedule task</h4>
        <p className="mt-1 text-small text-text-secondary">
          Open state with local date and time controls.
        </p>
        <div className="mt-4">
          <ScheduleFields
            date="2099-07-21"
            startTime="09:00"
            endTime="10:00"
            disabled={false}
            onDateChange={noOp}
            onStartTimeChange={noOp}
            onEndTimeChange={noOp}
          />
        </div>
      </div>
    );
  }

  if (state === "files" || state === "files-empty") {
    return (
      <div className={panelClassName}>
        <h4 className="text-h3">Attach a file</h4>
        <p className="mt-1 text-small text-text-secondary">
          {state === "files" ? "Populated picker state." : "Empty picker state."}
        </p>
        <div className="mt-4">
          <FileOptionsList
            files={state === "files" ? PREVIEW_FILES : []}
            pendingAction={null}
            onAttach={noOp}
          />
        </div>
      </div>
    );
  }

  if (state === "workspace" || state === "workspace-empty") {
    return (
      <div className={panelClassName}>
        <h4 className="text-h3">Add to workspace</h4>
        <p className="mt-1 text-small text-text-secondary">
          {state === "workspace"
            ? "Current workspace first; existing links stay visible and disabled."
            : "Empty picker state."}
        </p>
        <div className="mt-4">
          <WorkspaceOptionsList
            workspaces={state === "workspace" ? PREVIEW_WORKSPACES : []}
            pendingAction={null}
            onAdd={noOp}
          />
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={panelClassName}>
        <h4 className="text-h3">Attach a file</h4>
        <p role="status" className="py-8 text-center text-small text-text-muted">
          Loading files…
        </p>
      </div>
    );
  }

  const status =
    state === "pending"
      ? { message: "Attaching Launch brief.pdf…", tone: "pending" }
      : state === "success"
        ? { message: "Added to School", tone: "success" }
        : state === "error"
          ? { message: "Could not attach the file. Try again.", tone: "error" }
          : null;

  return (
    <div className={panelClassName}>
      <CrossLinkActionButtons
        fileCount={2}
        disabled={state === "pending"}
        onSchedule={noOp}
        onAttachFile={noOp}
        onAddToWorkspace={noOp}
      />
      {status ? (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg border px-3 py-2 text-small text-ink ${
            status.tone === "error"
              ? "border-brick bg-brick-tint"
              : status.tone === "success"
                ? "border-meadow bg-meadow-tint"
                : "border-border bg-paper text-text-secondary"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
