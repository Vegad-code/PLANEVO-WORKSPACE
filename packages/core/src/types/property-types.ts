export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "checkbox"
  | "relation"
  | "person"
  | "formula"
  | "rollup";

export const IMPLEMENTED_PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multi-select",
  "date",
  "checkbox",
  "relation",
  "person",
] as const satisfies readonly PropertyType[];

export type DatabaseTemplateType =
  | "task"
  | "notes"
  | "project"
  | "files"
  | "custom";

export type ViewType = "table" | "board" | "calendar" | "list";

export type AgentActionStatus =
  | "proposed"
  | "confirmed"
  | "executed"
  | "rejected";

export type CreditLedgerReason =
  | "message"
  | "agent_run"
  | "describe_build"
  | "grant"
  | "reset";
