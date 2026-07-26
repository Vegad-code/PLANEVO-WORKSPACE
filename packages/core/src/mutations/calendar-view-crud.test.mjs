import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createCalendarView,
  deleteCalendarView,
  setDefaultCalendar,
  setDefaultCalendarView,
  updateCalendarDetails,
  updateCalendarView,
} from "./product-calendar.ts";
import { listCalendarViews } from "../queries/product-calendar.ts";

function insertedCalendarViewClient() {
  let inserted;
  return {
    get inserted() {
      return inserted;
    },
    client: {
      from(table) {
        assert.equal(table, "calendar_views");
        return {
          insert(row) {
            inserted = row;
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: {
                        id: "view-1",
                        is_default: false,
                        created_at: "2026-07-26T00:00:00.000Z",
                        updated_at: "2026-07-26T00:00:00.000Z",
                        ...row,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test("saved views round-trip only partial preset overrides", async () => {
  const fixture = insertedCalendarViewClient();
  const config = {
    dayCount: 3,
    timeAxis: { mode: "cropped-working-hours", rowHeight: "fixed" },
  };
  const sourceCalendarIds = ["calendar-1"];

  const view = await createCalendarView(fixture.client, "user-1", {
    name: "Three-day plan",
    preset: "classic",
    config,
    sourceCalendarIds,
    includeTaskDues: false,
    position: 4,
  });

  assert.deepEqual(view.config, config);
  assert.deepEqual(Object.keys(view.config).sort(), ["dayCount", "timeAxis"]);
  assert.equal(view.config.layout, undefined);
  assert.deepEqual(fixture.inserted.config, config);
  assert.deepEqual(fixture.inserted.source_calendar_ids, sourceCalendarIds);
  assert.equal(fixture.inserted.user_id, "user-1");

  config.timeAxis.mode = "fixed-24h";
  sourceCalendarIds.push("calendar-2");
  assert.equal(fixture.inserted.config.timeAxis.mode, "cropped-working-hours");
  assert.deepEqual(fixture.inserted.source_calendar_ids, ["calendar-1"]);
});

test("updating a view replaces only fields explicitly supplied by the caller", async () => {
  let patch;
  const filters = [];
  const chain = {
    eq(...args) {
      filters.push(args);
      return chain;
    },
    select() {
      return chain;
    },
    async maybeSingle() {
      return {
        data: {
          id: "view-1",
          user_id: "user-1",
          name: "Focus",
          preset: "flow",
          config: patch.config,
          source_calendar_ids: [],
          include_task_dues: true,
          is_default: false,
          position: 0,
          created_at: "",
          updated_at: patch.updated_at,
        },
        error: null,
      };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, "calendar_views");
      return {
        update(value) {
          patch = value;
          return chain;
        },
      };
    },
  };

  const view = await updateCalendarView(client, "user-1", "view-1", {
    preset: "flow",
    config: { cardDensity: "minimal" },
  });

  assert.equal(patch.preset, "flow");
  assert.deepEqual(patch.config, { cardDensity: "minimal" });
  assert.equal("name" in patch, false);
  assert.equal("source_calendar_ids" in patch, false);
  assert.equal(view.config.cardDensity, "minimal");
  assert.deepEqual(filters, [
    ["id", "view-1"],
    ["user_id", "user-1"],
  ]);
});

function defaultMutationClient({ rpcName, targetError = null }) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(actualName, args) {
        assert.equal(actualName, rpcName);
        calls.push({ name: actualName, args });
        return { data: null, error: targetError };
      },
    },
  };
}

test("setting a default view delegates clearing and selection to one atomic RPC", async () => {
  const { client, calls } = defaultMutationClient({
    rpcName: "set_default_calendar_view",
  });

  await setDefaultCalendarView(client, "user-1", "view-2");

  assert.deepEqual(calls, [
    {
      name: "set_default_calendar_view",
      args: { p_owner_id: "user-1", p_view_id: "view-2" },
    },
  ]);
});

test("concurrent default-view uniqueness violations are surfaced to the caller", async () => {
  const uniqueViolation = {
    code: "23505",
    message: "duplicate key violates unique constraint",
  };
  const { client } = defaultMutationClient({
    rpcName: "set_default_calendar_view",
    targetError: uniqueViolation,
  });

  await assert.rejects(
    setDefaultCalendarView(client, "user-1", "view-2"),
    (error) => error === uniqueViolation,
  );
});

test("calendar details and default target remain owner scoped", async () => {
  const detailFilters = [];
  let detailPatch;
  const detailsChain = {
    eq(...args) {
      detailFilters.push(args);
      return detailsChain;
    },
    select() {
      return detailsChain;
    },
    async maybeSingle() {
      return {
        data: {
          id: "calendar-2",
          user_id: "user-1",
          name: detailPatch.name,
          color: detailPatch.color,
          is_visible: true,
          is_default: false,
          position: 1,
          created_at: "",
        },
        error: null,
      };
    },
  };
  const detailsClient = {
    from(table) {
      assert.equal(table, "calendars");
      return {
        update(value) {
          detailPatch = value;
          return detailsChain;
        },
      };
    },
  };

  const calendar = await updateCalendarDetails(
    detailsClient,
    "user-1",
    "calendar-2",
    { name: "Life", color: "meadow" },
  );
  assert.equal(calendar.name, "Life");
  assert.equal(calendar.color, "meadow");
  assert.deepEqual(detailFilters, [
    ["id", "calendar-2"],
    ["user_id", "user-1"],
  ]);

  const defaultClient = defaultMutationClient({
    rpcName: "set_default_calendar",
  });
  await setDefaultCalendar(defaultClient.client, "user-1", "calendar-2");
  assert.deepEqual(defaultClient.calls, [
    {
      name: "set_default_calendar",
      args: { p_owner_id: "user-1", p_calendar_id: "calendar-2" },
    },
  ]);
});

test("view deletion is owner scoped and reports a missing row", async () => {
  const filters = [];
  const chain = {
    eq(...args) {
      filters.push(args);
      return chain;
    },
    select() {
      return chain;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, "calendar_views");
      return {
        delete() {
          return chain;
        },
      };
    },
  };

  await assert.rejects(
    deleteCalendarView(client, "user-1", "view-1"),
    /Calendar view not found/,
  );
  assert.deepEqual(filters, [
    ["id", "view-1"],
    ["user_id", "user-1"],
  ]);
});

function queryResult(rows, calls, table) {
  const chain = {
    select(...args) {
      calls.push({ table, method: "select", args });
      return chain;
    },
    eq(...args) {
      calls.push({ table, method: "eq", args });
      return chain;
    },
    order(...args) {
      calls.push({ table, method: "order", args });
      return Promise.resolve({ data: rows, error: null });
    },
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return chain;
}

test("zero saved views returns an empty list for the Classic UI fallback", async () => {
  const calls = [];
  const client = {
    from(table) {
      return queryResult([], calls, table);
    },
  };

  assert.deepEqual(await listCalendarViews(client, "user-1"), []);
});

test("saved views quietly discard source ids for calendars that were deleted", async () => {
  const calls = [];
  const rowsByTable = {
    calendar_views: [
      {
        id: "view-1",
        user_id: "user-1",
        name: "Work week",
        preset: "classic",
        config: { dayCount: 5 },
        source_calendar_ids: ["calendar-live", "calendar-deleted"],
        include_task_dues: true,
        is_default: true,
        position: 0,
        created_at: "",
        updated_at: "",
      },
    ],
    calendars: [{ id: "calendar-live" }],
  };
  const client = {
    from(table) {
      return queryResult(rowsByTable[table], calls, table);
    },
  };

  const views = await listCalendarViews(client, "user-1");

  assert.deepEqual(views[0].source_calendar_ids, ["calendar-live"]);
  assert.equal(
    calls.some(
      ({ table, method, args }) =>
        table === "calendar_views" &&
        method === "eq" &&
        args[0] === "user_id" &&
        args[1] === "user-1",
    ),
    true,
  );
  assert.equal(
    calls.some(
      ({ table, method, args }) =>
        table === "calendars" &&
        method === "eq" &&
        args[0] === "user_id" &&
        args[1] === "user-1",
    ),
    true,
  );
});

test("default-target migration serializes owner writes and excludes anonymous callers", () => {
  const sql = readFileSync(
    new URL(
      "../../../../supabase/migrations/20260726100000_calendar_default_targets.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /security invoker/gi);
  assert.match(sql, /pg_advisory_xact_lock/g);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/g);
  assert.match(
    sql,
    /revoke all on function public\.set_default_calendar_view\(uuid, uuid\) from anon/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.set_default_calendar\(uuid, uuid\) from anon/i,
  );
});
