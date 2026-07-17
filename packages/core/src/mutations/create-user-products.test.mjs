import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateUserProductsError,
  createUserProducts,
} from "./create-user-products.ts";

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

test("createUserProducts builds the seed payload and calls create_user_products", async () => {
  const client = fakeClient({
    create_user_products: {
      data: {
        calendar_id: "calendar-1",
        task_ids: ["task-1", "task-2", "task-3", "task-4"],
        created: true,
      },
      error: null,
    },
  });

  const result = await createUserProducts(client, {
    userId: "user-1",
    organizing: "school",
  });

  assert.deepEqual(result, {
    calendarId: "calendar-1",
    taskIds: ["task-1", "task-2", "task-3", "task-4"],
    created: true,
  });
  assert.equal(client.calls[0].functionName, "create_user_products");
  assert.equal(client.calls[0].args.p_user_id, "user-1");
  assert.equal(client.calls[0].args.p_seed.calendarName, "My Calendar");
  assert.ok(
    client.calls[0].args.p_seed.starterTasks.some((task) =>
      /move a task across the board/i.test(task.title),
    ),
  );
});

test("createUserProducts surfaces an idempotent created:false result", async () => {
  const client = fakeClient({
    create_user_products: {
      data: { calendar_id: "calendar-1", task_ids: [], created: false },
      error: null,
    },
  });

  const result = await createUserProducts(client, {
    userId: "user-1",
    organizing: null,
  });

  assert.equal(result.created, false);
  assert.deepEqual(result.taskIds, []);
});

test("RPC errors are wrapped in CreateUserProductsError", async () => {
  const client = fakeClient({
    create_user_products: {
      data: null,
      error: { message: "denied", code: "42501" },
    },
  });

  await assert.rejects(
    createUserProducts(client, { userId: "user-1", organizing: "work" }),
    (error) => error instanceof CreateUserProductsError && error.code === "42501",
  );
});

test("an invalid RPC result shape is rejected", async () => {
  const client = fakeClient({
    create_user_products: { data: { calendar_id: "calendar-1" }, error: null },
  });

  await assert.rejects(
    createUserProducts(client, { userId: "user-1", organizing: "work" }),
    (error) => error instanceof CreateUserProductsError,
  );
});
