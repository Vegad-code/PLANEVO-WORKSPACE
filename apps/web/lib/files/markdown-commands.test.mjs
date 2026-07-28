import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("./markdown-commands.ts");
  } catch (error) {
    assert.fail(`Markdown commands must load: ${String(error)}`);
  }
}

test("wraps a selection without changing surrounding source", async () => {
  const { applyMarkdownCommand } = await loadModule();

  assert.deepEqual(
    applyMarkdownCommand({
      text: "Keep this source exact",
      from: 5,
      to: 9,
      command: "bold",
    }),
    {
      text: "Keep **this** source exact",
      selection: { from: 7, to: 11 },
    },
  );
});

test("prefixes every selected line as a checklist", async () => {
  const { applyMarkdownCommand } = await loadModule();

  assert.equal(
    applyMarkdownCommand({
      text: "first\nsecond\nthird",
      from: 0,
      to: 12,
      command: "check-list",
    }).text,
    "- [ ] first\n- [ ] second\nthird",
  );
});

test("inserts a usable placeholder for an empty link selection", async () => {
  const { applyMarkdownCommand } = await loadModule();

  assert.deepEqual(
    applyMarkdownCommand({
      text: "",
      from: 0,
      to: 0,
      command: "link",
    }),
    {
      text: "[link text](https://)",
      selection: { from: 1, to: 10 },
    },
  );
});

test("continues numbered lists and increments their marker", async () => {
  const { continueMarkdownList } = await loadModule();

  assert.deepEqual(
    continueMarkdownList({
      text: "1. first",
      cursor: 8,
    }),
    {
      text: "1. first\n2. ",
      cursor: 12,
    },
  );
});

test("continues checklists with an unchecked item", async () => {
  const { continueMarkdownList } = await loadModule();

  assert.deepEqual(
    continueMarkdownList({
      text: "- [x] done",
      cursor: 10,
    }),
    {
      text: "- [x] done\n- [ ] ",
      cursor: 17,
    },
  );
});

test("ends a list when its current item is empty", async () => {
  const { continueMarkdownList } = await loadModule();

  assert.deepEqual(
    continueMarkdownList({
      text: "intro\n- ",
      cursor: 8,
    }),
    {
      text: "intro\n",
      cursor: 6,
    },
  );
});

test("reports bold as active when the selection sits inside ** markers", async () => {
  const { activeMarkdownMarks } = await loadModule();

  const active = activeMarkdownMarks({ text: "a **bold** b", from: 4, to: 8 });
  assert.equal(active.has("bold"), true);
  assert.equal(active.has("italic"), false);
});

test("reports no inline marks for plain prose", async () => {
  const { activeMarkdownMarks } = await loadModule();

  const active = activeMarkdownMarks({ text: "just words", from: 0, to: 4 });
  assert.equal(active.size, 0);
});

test("prefers checklist over bullet, since '- [ ] ' also starts with '- '", async () => {
  const { activeMarkdownMarks } = await loadModule();

  const active = activeMarkdownMarks({ text: "- [ ] task", from: 6, to: 10 });
  assert.equal(active.has("check-list"), true);
  assert.equal(active.has("bullet-list"), false);
});

test("distinguishes heading levels by their prefix length", async () => {
  const { activeMarkdownMarks } = await loadModule();

  assert.equal(
    activeMarkdownMarks({ text: "## Status", from: 3, to: 9 }).has("heading-2"),
    true,
  );
  assert.equal(
    activeMarkdownMarks({ text: "# Title", from: 2, to: 7 }).has("heading-1"),
    true,
  );
  assert.equal(
    activeMarkdownMarks({ text: "## Status", from: 3, to: 9 }).has("heading-1"),
    false,
  );
});

test("detects a numbered list item", async () => {
  const { activeMarkdownMarks } = await loadModule();

  assert.equal(
    activeMarkdownMarks({ text: "3. third", from: 3, to: 8 }).has(
      "numbered-list",
    ),
    true,
  );
});

test("clamps out-of-range offsets instead of throwing", async () => {
  const { activeMarkdownMarks } = await loadModule();

  assert.equal(activeMarkdownMarks({ text: "", from: 9, to: 99 }).size, 0);
});
