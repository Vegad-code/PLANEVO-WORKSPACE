import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  FoundationMutationError,
  createFoundationMutations,
} from "./create-foundations.ts";

function fakeClient(results) {
  const calls = [];
  return {
    calls,
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      const result = results[functionName];
      return result ?? { data: null, error: { message: "Unexpected RPC" } };
    },
  };
}

test("task database creation uses F-11 create_database_from_template", async () => {
  const client = fakeClient({
    create_database_from_template: {
      data: {
        workspace_id: "workspace-1",
        page_id: "page-1",
        database_id: "database-1",
      },
      error: null,
    },
  });
  const mutations = createFoundationMutations(client, "owner-1");

  assert.deepEqual(
    await mutations.createTaskDatabaseWithViews({ workspaceId: "workspace-1" }),
    {
      workspaceId: "workspace-1",
      pageId: "page-1",
      databaseId: "database-1",
    },
  );
  assert.deepEqual(client.calls.map((call) => call.functionName), [
    "create_database_from_template",
  ]);
  assert.equal(client.calls[0].args.p_template.templateType, "task");
});

test("a record is requested only when a real task is submitted", async () => {
  const client = fakeClient({
    create_task_with_required_foundation: {
      data: {
        workspace_id: "workspace-1",
        database_id: "database-1",
        record_id: "record-1",
      },
      error: null,
    },
  });
  const mutations = createFoundationMutations(client, "owner-1");

  const result = await mutations.createTaskWithRequiredFoundation({
    title: "Prepare launch notes",
    description: "Summarize the final decisions",
    tags: ["launch"],
    attachments: [{ name: "brief.pdf" }],
  });

  assert.deepEqual(result, {
    workspaceId: "workspace-1",
    databaseId: "database-1",
    recordId: "record-1",
  });
  assert.equal(client.calls[0].functionName, "create_task_with_required_foundation");
  assert.equal(client.calls[0].args.p_title, "Prepare launch notes");
  assert.deepEqual(client.calls[0].args.p_tags, ["launch"]);
});

test("invalid task input is rejected before any database call", async () => {
  const client = fakeClient({});
  const mutations = createFoundationMutations(client, "owner-1");

  await assert.rejects(
    mutations.createTaskWithRequiredFoundation({ title: "   " }),
    (error) => error instanceof FoundationMutationError && error.code === "VALIDATION",
  );
  assert.deepEqual(client.calls, []);
});

test("no migration ever introduces a security definer function", () => {
  const migrationsDir = new URL("../../../../supabase/migrations/", import.meta.url);
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
  assert.ok(files.length >= 4, "expected the known migration set");
  for (const name of files) {
    const sql = readFileSync(new URL(name, migrationsDir), "utf8").toLowerCase();
    assert.equal(sql.includes("security definer"), false, `${name} uses security definer`);
    assert.equal(
      sql.includes("grant") && sql.includes("to anon"),
      false,
      `${name} grants to anon`,
    );
  }
});

test("migration keeps RPCs invoker-scoped and task foundations empty", () => {
  const sql = readFileSync(
    new URL(
      "../../../../supabase/migrations/20260715004609_planevo_app_foundations.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();

  assert.equal(sql.includes("security definer"), false);
  assert.match(sql, /create or replace function public\.create_task_database_with_views[\s\S]*?security invoker/);

  const taskFoundation = sql.split(
    "create or replace function public.create_task_database_with_views",
  )[1].split("create or replace function public.create_calendar_database_with_views")[0];
  assert.match(taskFoundation, /'board'/);
  assert.match(taskFoundation, /'list'/);
  assert.match(taskFoundation, /'calendar'/);
  assert.equal(taskFoundation.includes("insert into public.records"), false);
});
