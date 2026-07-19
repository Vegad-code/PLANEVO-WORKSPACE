// Seeds throwaway dev workspaces for QA and perf checks.
//
//   npm run db:seed                         — perf sandbox (~10k task records)
//   npm run db:seed -- --revamp             — QA revamp workspace (faces, views, relations)
//   npm run db:seed -- --records 5000       — perf record count override
//
// Uses the service key from apps/web/.env.local. Re-running wipes and reseeds only the
// named sandbox workspace — your real workspaces are never touched.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  getDatabaseTemplate,
  serializeTemplateForRpc,
} from "../packages/core/src/defaults/database-templates.ts";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv(new URL("../apps/web/.env.local", import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey) {
  console.error("Missing Supabase keys in apps/web/.env.local");
  process.exit(1);
}

const REVAMP = process.argv.includes("--revamp");
const recordsArg = process.argv.indexOf("--records");
const RECORD_COUNT = recordsArg > -1 ? Number(process.argv[recordsArg + 1]) : 10_000;
const SEED_WORKSPACE_NAME = REVAMP ? "QA revamp (seed)" : "Perf sandbox (seed)";
const TASK_RECORD_COUNT = REVAMP ? 60 : RECORD_COUNT;
const STATUSES = ["To do", "In progress", "In review", "Done"];
const PRIORITIES = ["Low", "Medium", "High"];
const TAG_POOL = ["launch", "ops", "design", "research", "urgent"];

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const alias = env.PLANEVO_DEV_OWNER_ID;
let ownerId = null;
for (let page = 1; page <= 10 && !ownerId; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  ownerId = data.users.find(
    (user) => user.user_metadata?.planevo_dev_owner_alias === alias,
  )?.id;
  if (data.users.length < 1000) break;
}
if (!ownerId) {
  console.error("Dev owner not found — open the app once in dev mode first.");
  process.exit(1);
}

const { data: existing } = await admin
  .from("workspaces")
  .select("id")
  .eq("owner_id", ownerId)
  .eq("name", SEED_WORKSPACE_NAME);
for (const workspace of existing ?? []) {
  await admin.from("workspaces").delete().eq("id", workspace.id);
}

const { data: workspace, error: workspaceError } = await admin
  .from("workspaces")
  .insert({ owner_id: ownerId, name: SEED_WORKSPACE_NAME, icon: REVAMP ? "🧪" : null })
  .select("id")
  .single();
if (workspaceError) throw workspaceError;

const { data: foundation, error: foundationError } = await admin.rpc(
  "create_task_database_with_views",
  { p_owner_id: ownerId, p_workspace_id: workspace.id, p_name: "Tasks" },
);
if (foundationError) throw foundationError;
const taskDatabaseId = foundation.database_id;

const { data: properties, error: propertiesError } = await admin
  .from("database_properties")
  .select("id,name,type,is_primary,config_json")
  .eq("database_id", taskDatabaseId);
if (propertiesError) throw propertiesError;

const byRole = (role) =>
  properties.find((property) => property.config_json?.role === role)?.id ?? null;

const titlePropertyId = properties.find((property) => property.is_primary)?.id;
const descriptionPropertyId = byRole("description");
const statusPropertyId = byRole("status");
const priorityPropertyId = byRole("priority");
const duePropertyId = byRole("due_date");
const estimatePropertyId = byRole("estimate");
const tagsPropertyId = byRole("tags");
const attachmentsPropertyId = byRole("attachments");

if (!titlePropertyId || !statusPropertyId) {
  throw new Error("Task database is missing required properties.");
}

console.log(`Seeding ${TASK_RECORD_COUNT} task records into workspace ${workspace.id}…`);
const CHUNK = 500;
const startDate = Date.now();
for (let offset = 0; offset < TASK_RECORD_COUNT; offset += CHUNK) {
  const size = Math.min(CHUNK, TASK_RECORD_COUNT - offset);
  const recordRows = Array.from({ length: size }, (_, index) => ({
    database_id: taskDatabaseId,
    position: offset + index + 1,
    created_by: ownerId,
  }));
  const { data: inserted, error: recordError } = await admin
    .from("records")
    .insert(recordRows)
    .select("id");
  if (recordError) throw recordError;

  const valueRows = inserted.flatMap((record, index) => {
    const n = offset + index;
    const rows = [
      { record_id: record.id, property_id: titlePropertyId, value_json: `QA task ${n + 1}` },
      {
        record_id: record.id,
        property_id: statusPropertyId,
        value_json: STATUSES[n % STATUSES.length],
      },
    ];
    if (descriptionPropertyId) {
      rows.push({
        record_id: record.id,
        property_id: descriptionPropertyId,
        value_json: `Notes for task ${n + 1}`,
      });
    }
    if (priorityPropertyId) {
      rows.push({
        record_id: record.id,
        property_id: priorityPropertyId,
        value_json: PRIORITIES[n % PRIORITIES.length],
      });
    }
    if (duePropertyId && n % 2 === 0) {
      rows.push({
        record_id: record.id,
        property_id: duePropertyId,
        value_json: new Date(startDate + n * 86_400_000).toISOString(),
      });
    }
    if (estimatePropertyId) {
      rows.push({
        record_id: record.id,
        property_id: estimatePropertyId,
        value_json: (n % 8) * 30 + 15,
      });
    }
    if (tagsPropertyId) {
      rows.push({
        record_id: record.id,
        property_id: tagsPropertyId,
        value_json: [TAG_POOL[n % TAG_POOL.length], TAG_POOL[(n + 2) % TAG_POOL.length]],
      });
    }
    if (attachmentsPropertyId && n % 5 === 0) {
      rows.push({
        record_id: record.id,
        property_id: attachmentsPropertyId,
        value_json: `brief-${n + 1}.pdf`,
      });
    }
    return rows;
  });
  const { error: valueError } = await admin.from("record_values").insert(valueRows);
  if (valueError) throw valueError;
  process.stdout.write(`\r${Math.min(offset + size, TASK_RECORD_COUNT)}/${TASK_RECORD_COUNT}`);
}

if (REVAMP) {
  const { data: views, error: viewsError } = await admin
    .from("views")
    .select("id,type,name")
    .eq("database_id", taskDatabaseId);
  if (viewsError) throw viewsError;

  const boardView = views.find((view) => view.type === "board");
  const listView = views.find((view) => view.type === "list");
  const tableView = views.find((view) => view.type === "table");

  if (boardView && priorityPropertyId && statusPropertyId) {
    await admin
      .from("views")
      .update({
        config_json: {
          filters: [
            {
              id: "filter-active",
              property_id: statusPropertyId,
              operator: "is_not",
              value: "Done",
            },
          ],
          sorts: [{ property_id: priorityPropertyId, direction: "desc" }],
          group_by_property_id: statusPropertyId,
          visible_properties: null,
          column_widths: {},
          calendar_date_property_id: duePropertyId,
          collapsed_groups: [],
        },
      })
      .eq("id", boardView.id);
  }

  if (listView && duePropertyId) {
    await admin
      .from("views")
      .update({
        config_json: {
          filters: [],
          sorts: [{ property_id: duePropertyId, direction: "asc" }],
          group_by_property_id: null,
          visible_properties: [titlePropertyId, statusPropertyId, duePropertyId],
          column_widths: {},
          calendar_date_property_id: duePropertyId,
          collapsed_groups: [],
        },
      })
      .eq("id", listView.id);
  }

  if (tableView && statusPropertyId) {
    await admin
      .from("views")
      .update({
        config_json: {
          filters: [
            {
              id: "filter-in-progress",
              property_id: statusPropertyId,
              operator: "is",
              value: "In progress",
            },
          ],
          sorts: [{ property_id: titlePropertyId, direction: "asc" }],
          group_by_property_id: null,
          visible_properties: properties.map((property) => property.id),
          column_widths: {},
          calendar_date_property_id: duePropertyId,
          collapsed_groups: [],
        },
      })
      .eq("id", tableView.id);
  }

  const projectTemplate = serializeTemplateForRpc(getDatabaseTemplate("project"), {
    name: "Projects",
  });
  const { data: projectFoundation, error: projectError } = await admin.rpc(
    "create_database_from_template",
    {
      p_owner_id: ownerId,
      p_workspace_id: workspace.id,
      p_template: projectTemplate,
    },
  );
  if (projectError) throw projectError;

  const projectDatabaseId = projectFoundation.database_id;
  const { data: projectProperties, error: projectPropsError } = await admin
    .from("database_properties")
    .select("id,config_json")
    .eq("database_id", projectDatabaseId);
  if (projectPropsError) throw projectPropsError;

  const projectTitleId = projectProperties.find(
    (property) => property.config_json?.role === "title",
  )?.id;
  const projectStatusId = projectProperties.find(
    (property) => property.config_json?.role === "status",
  )?.id;
  const projectTasksRelationId = projectProperties.find(
    (property) => property.config_json?.role === "tasks",
  )?.id;

  const { data: projectRecords, error: projectRecordError } = await admin
    .from("records")
    .insert(
      ["Launch prep", "Research sprint", "Design polish"].map((title, index) => ({
        database_id: projectDatabaseId,
        position: index + 1,
        created_by: ownerId,
      })),
    )
    .select("id");
  if (projectRecordError) throw projectRecordError;

  const projectValueRows = projectRecords.flatMap((record, index) => {
    const rows = [];
    if (projectTitleId) {
      rows.push({
        record_id: record.id,
        property_id: projectTitleId,
        value_json: ["Launch prep", "Research sprint", "Design polish"][index],
      });
    }
    if (projectStatusId) {
      rows.push({
        record_id: record.id,
        property_id: projectStatusId,
        value_json: ["Planning", "Active", "Complete"][index],
      });
    }
    return rows;
  });
  const { error: projectValuesError } = await admin
    .from("record_values")
    .insert(projectValueRows);
  if (projectValuesError) throw projectValuesError;

  if (projectTasksRelationId) {
    const { data: taskRecords, error: taskRecordsError } = await admin
      .from("records")
      .select("id")
      .eq("database_id", taskDatabaseId)
      .order("position", { ascending: true })
      .limit(9);
    if (taskRecordsError) throw taskRecordsError;

    const relationRows = projectRecords.flatMap((project, projectIndex) =>
      (taskRecords ?? [])
        .slice(projectIndex * 3, projectIndex * 3 + 3)
        .map((task) => ({
          source_record_id: project.id,
          source_property_id: projectTasksRelationId,
          target_record_id: task.id,
        })),
    );
    if (relationRows.length) {
      const { error: relationError } = await admin.from("relations").insert(relationRows);
      if (relationError) throw relationError;
    }
  }

  const { data: notesPage, error: notesPageError } = await admin.rpc("create_document_page", {
    p_owner_id: ownerId,
    p_workspace_id: workspace.id,
    p_title: "Meeting notes — promotable",
  });
  if (notesPageError) throw notesPageError;

  const bulletLines = [
    "Email Sarah about pricing — friday",
    "Draft launch checklist — monday",
    "Review sidebar tree connectors",
    "Seed QA workspace for faces",
  ];
  const contentJson = [
    {
      id: crypto.randomUUID(),
      type: "bulletListItem",
      props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: bulletLines[0], styles: {} }],
      children: [],
    },
    ...bulletLines.slice(1).map((line) => ({
      id: crypto.randomUUID(),
      type: "bulletListItem",
      props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: line, styles: {} }],
      children: [],
    })),
  ];

  await admin
    .from("pages")
    .update({ content_json: contentJson, icon: "📝" })
    .eq("id", notesPage.page_id);

  await admin.rpc("create_calendar_database_with_views", {
    p_owner_id: ownerId,
    p_workspace_id: workspace.id,
    p_name: "Calendar",
  });

  const filesTemplate = serializeTemplateForRpc(getDatabaseTemplate("files"), { name: "Files" });
  await admin.rpc("create_database_from_template", {
    p_owner_id: ownerId,
    p_workspace_id: workspace.id,
    p_template: filesTemplate,
  });
}

console.log(`\nDone. Sandbox workspace: ${workspace.id}, task database: ${taskDatabaseId}`);
if (REVAMP) {
  console.log("QA revamp seed includes tasks, projects, calendar, files, and a promotable notes page.");
} else {
  console.log("Run the EXPLAIN checks in supabase/performance-checks.md against it.");
}
