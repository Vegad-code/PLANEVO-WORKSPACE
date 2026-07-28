import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("./markdown-to-planevo.ts");
  } catch (error) {
    assert.fail(`Markdown conversion must load: ${String(error)}`);
  }
}

test("maps headings, lists, checks, quotes, and code to Planevo blocks", async () => {
  const { markdownToPlanevoBlocks } = await loadModule();
  const blocks = markdownToPlanevoBlocks(
    "# Brief\n\n- item\n- [x] done\n> note\n```ts\nconst value = 1\n```",
  );

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "bulletListItem", "checkListItem", "quote", "codeBlock"],
  );
  assert.deepEqual(blocks[0].props, { level: 1 });
  assert.deepEqual(blocks[2].props, { checked: true });
  assert.deepEqual(blocks[4].props, { language: "ts" });
});

test("keeps malformed or unsupported Markdown as paragraph text", async () => {
  const { markdownToPlanevoBlocks } = await loadModule();
  const blocks = markdownToPlanevoBlocks("Text with <custom-tag> and **markers**.");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].content[0].text, "Text with <custom-tag> and **markers**.");
});
