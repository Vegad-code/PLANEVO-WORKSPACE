import type { DatabaseTemplateType, PropertyType, ViewType } from "../types/property-types";

export type SelectOption = {
  name: string;
  color: string;
};

export type PropertyRole =
  | "title"
  | "status"
  | "priority"
  | "due_date"
  | "tags"
  | "created"
  | "owner"
  | "timeline"
  | "type"
  | "added"
  | "related"
  | "tasks";

export type TemplatePropertyConfig = {
  role?: PropertyRole;
  options?: SelectOption[];
  includeTime?: boolean;
  dateRange?: boolean;
  targetDatabaseRole?: PropertyRole;
  allowMultiple?: boolean;
};

export type TemplateProperty = {
  name: string;
  type: PropertyType;
  position: number;
  isPrimary?: boolean;
  config: TemplatePropertyConfig;
};

export type TemplateViewConfig = {
  groupByRole?: PropertyRole;
  dateRole?: PropertyRole;
  sorts?: Array<{ role: PropertyRole; direction: "asc" | "desc" }>;
};

export type TemplateView = {
  type: ViewType;
  name: string;
  position: number;
  isDefault?: boolean;
  config: TemplateViewConfig;
};

export type DatabaseTemplate = {
  templateType: DatabaseTemplateType;
  name: string;
  icon: string;
  properties: TemplateProperty[];
  views: TemplateView[];
};

const STATUS_TASK: SelectOption[] = [
  { name: "Not started", color: "slate" },
  { name: "In progress", color: "marigold" },
  { name: "Done", color: "meadow" },
];

const PRIORITY: SelectOption[] = [
  { name: "Low", color: "slate" },
  { name: "Medium", color: "marigold" },
  { name: "High", color: "brick" },
];

const PROJECT_STATUS: SelectOption[] = [
  { name: "Planning", color: "slate" },
  { name: "Active", color: "marigold" },
  { name: "Complete", color: "meadow" },
];

const FILE_TYPES: SelectOption[] = [
  { name: "Document", color: "slate" },
  { name: "Image", color: "marigold" },
  { name: "Spreadsheet", color: "meadow" },
  { name: "Other", color: "ink" },
];

export const DATABASE_TEMPLATES: Record<DatabaseTemplateType, DatabaseTemplate> = {
  task: {
    templateType: "task",
    name: "Tasks",
    icon: "check-circle",
    properties: [
      {
        name: "Name",
        type: "text",
        position: 0,
        isPrimary: true,
        config: { role: "title" },
      },
      {
        name: "Status",
        type: "select",
        position: 1,
        config: { role: "status", options: STATUS_TASK },
      },
      {
        name: "Due",
        type: "date",
        position: 2,
        config: { role: "due_date" },
      },
      {
        name: "Priority",
        type: "select",
        position: 3,
        config: { role: "priority", options: PRIORITY },
      },
    ],
    views: [
      {
        type: "board",
        name: "Board",
        position: 0,
        isDefault: true,
        config: { groupByRole: "status", sorts: [{ role: "priority", direction: "desc" }] },
      },
      { type: "list", name: "List", position: 1, config: {} },
      { type: "calendar", name: "Calendar", position: 2, config: { dateRole: "due_date" } },
      { type: "table", name: "Table", position: 3, config: {} },
    ],
  },

  notes: {
    templateType: "notes",
    name: "Notes",
    icon: "page",
    properties: [
      {
        name: "Name",
        type: "text",
        position: 0,
        isPrimary: true,
        config: { role: "title" },
      },
      {
        name: "Tags",
        type: "multi-select",
        position: 1,
        config: { role: "tags", options: [] },
      },
      {
        name: "Created",
        type: "date",
        position: 2,
        config: { role: "created" },
      },
    ],
    views: [
      {
        type: "list",
        name: "List",
        position: 0,
        isDefault: true,
        config: { sorts: [{ role: "created", direction: "desc" }] },
      },
      { type: "table", name: "Table", position: 1, config: {} },
    ],
  },

  project: {
    templateType: "project",
    name: "Projects",
    icon: "workspace",
    properties: [
      {
        name: "Name",
        type: "text",
        position: 0,
        isPrimary: true,
        config: { role: "title" },
      },
      {
        name: "Status",
        type: "select",
        position: 1,
        config: { role: "status", options: PROJECT_STATUS },
      },
      {
        name: "Owner",
        type: "person",
        position: 2,
        config: { role: "owner", allowMultiple: false },
      },
      {
        name: "Timeline",
        type: "date",
        position: 3,
        config: { role: "timeline", dateRange: true },
      },
      {
        name: "Tasks",
        type: "relation",
        position: 4,
        config: { role: "tasks", targetDatabaseRole: "title", allowMultiple: true },
      },
    ],
    views: [
      {
        type: "board",
        name: "Board",
        position: 0,
        isDefault: true,
        config: { groupByRole: "status" },
      },
      { type: "table", name: "Table", position: 1, config: {} },
      {
        type: "calendar",
        name: "Calendar",
        position: 2,
        config: { dateRole: "timeline" },
      },
    ],
  },

  files: {
    templateType: "files",
    name: "Files",
    icon: "files",
    properties: [
      {
        name: "Name",
        type: "text",
        position: 0,
        isPrimary: true,
        config: { role: "title" },
      },
      {
        name: "Type",
        type: "select",
        position: 1,
        config: { role: "type", options: FILE_TYPES },
      },
      {
        name: "Tags",
        type: "multi-select",
        position: 2,
        config: { role: "tags", options: [] },
      },
      {
        name: "Added",
        type: "date",
        position: 3,
        config: { role: "added" },
      },
      {
        name: "Related",
        type: "relation",
        position: 4,
        config: { role: "related", allowMultiple: true },
      },
    ],
    views: [
      { type: "table", name: "Table", position: 0, isDefault: true, config: {} },
      { type: "list", name: "List", position: 1, config: {} },
    ],
  },

  custom: {
    templateType: "custom",
    name: "Untitled",
    icon: "page",
    properties: [
      {
        name: "Name",
        type: "text",
        position: 0,
        isPrimary: true,
        config: { role: "title" },
      },
    ],
    views: [{ type: "table", name: "Table", position: 0, isDefault: true, config: {} }],
  },
};

export function getDatabaseTemplate(templateType: DatabaseTemplateType): DatabaseTemplate {
  return DATABASE_TEMPLATES[templateType];
}

/** Serializes a template for the create_database_from_template RPC. */
export function serializeTemplateForRpc(
  template: DatabaseTemplate,
  overrides?: {
    name?: string;
    icon?: string;
    parentPageId?: string | null;
    pagePosition?: number;
    createPage?: boolean;
    pageId?: string | null;
  },
): Record<string, unknown> {
  return {
    templateType: template.templateType,
    name: overrides?.name?.trim() || template.name,
    icon: overrides?.icon ?? template.icon,
    createPage: overrides?.createPage ?? true,
    parentPageId: overrides?.parentPageId ?? null,
    pageId: overrides?.pageId ?? null,
    pagePosition: overrides?.pagePosition ?? 0,
    properties: template.properties.map((property) => ({
      name: property.name,
      type: property.type,
      position: property.position,
      isPrimary: property.isPrimary ?? false,
      config: property.config,
    })),
    views: template.views.map((view) => ({
      type: view.type,
      name: view.name,
      position: view.position,
      isDefault: view.isDefault ?? false,
      config: view.config,
    })),
  };
}
