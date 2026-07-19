import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyTaskIcon,
  mergeTaskIconOnUpdate,
  parseTaskIconRef,
  resolveTaskIcon,
} from "./task-icon-classifier.ts";
import { emojiToId } from "./task-icon-types.ts";

test("classifyTaskIcon maps explicit tags before keywords", () => {
  const result = classifyTaskIcon({
    title: "Fix login bug",
    tags: ["Design"],
  });
  assert.equal(result.id, emojiToId("🎨"));
  assert.equal(result.emoji, "🎨");
  assert.equal(result.style, "emoji");
  assert.equal(result.source, "auto");
});

test("classifyTaskIcon detects bug keywords in title", () => {
  const result = classifyTaskIcon({ title: "Fix login bug" });
  assert.equal(result.emoji, "🐛");
  assert.equal(result.style, "emoji");
});

test("classifyTaskIcon detects homework intent", () => {
  const result = classifyTaskIcon({ title: "do homework" });
  assert.equal(result.id, emojiToId("📚"));
  assert.equal(result.emoji, "📚");
  assert.equal(result.style, "emoji");
});

test("classifyTaskIcon detects meeting keywords", () => {
  const result = classifyTaskIcon({ title: "Weekly team sync" });
  assert.equal(result.emoji, "👥");
  assert.equal(result.style, "emoji");
});

test("classifyTaskIcon falls back to default emoji", () => {
  const result = classifyTaskIcon({ title: "asdf qwer zxcv" });
  assert.equal(result.emoji, "📁");
  assert.equal(result.style, "emoji");
});

test("classifyTaskIcon reads description keywords", () => {
  const result = classifyTaskIcon({
    title: "Q3 planning",
    description: "Update the product roadmap milestones",
  });
  assert.equal(result.emoji, "🚀");
  assert.equal(result.style, "emoji");
});

test("parseTaskIconRef validates stored icon", () => {
  assert.deepEqual(parseTaskIconRef({ id: "bug", source: "user" }), {
    id: "bug",
    source: "user",
    style: "plain",
  });
  assert.deepEqual(
    parseTaskIconRef({
      id: emojiToId("📚"),
      source: "auto",
      style: "emoji",
      emoji: "📚",
    }),
    {
      id: emojiToId("📚"),
      source: "auto",
      style: "emoji",
      emoji: "📚",
    },
  );
  assert.deepEqual(
    parseTaskIconRef({
      id: "fa:solid:book",
      source: "auto",
      style: "colorful",
      colorToken: "marigold",
    }),
    {
      id: "fa:solid:book",
      source: "auto",
      style: "plain",
    },
  );
  assert.equal(parseTaskIconRef({ id: "invalid", source: "user" }), null);
  assert.equal(parseTaskIconRef(null), null);
});

test("resolveTaskIcon uses stored icon when valid", () => {
  const resolved = resolveTaskIcon(
    {
      title: "Anything",
      description_json: { icon: { id: "meeting", source: "user" } },
    },
    0,
  );
  assert.equal(resolved.ref.id, "meeting");
  assert.equal(resolved.ref.source, "user");
  assert.equal(resolved.active, false);
});

test("resolveTaskIcon classifies legacy tasks without icon", () => {
  const resolved = resolveTaskIcon(
    {
      title: "Investigate spike in errors",
      description_json: {},
    },
    2,
  );
  assert.equal(resolved.ref.emoji, "🔬");
  assert.equal(resolved.ref.style, "emoji");
  assert.equal(resolved.active, true);
});

test("mergeTaskIconOnUpdate preserves user icon", () => {
  const icon = mergeTaskIconOnUpdate({
    title: "New title about bugs",
    description: "",
    existingDescriptionJson: {
      icon: { id: "design", source: "user" },
    },
  });
  assert.deepEqual(icon, {
    id: "design",
    source: "user",
    style: "plain",
  });
});

test("mergeTaskIconOnUpdate re-classifies auto icon", () => {
  const icon = mergeTaskIconOnUpdate({
    title: "Deploy staging release",
    description: "",
    existingDescriptionJson: {
      icon: { id: "default", source: "auto" },
    },
  });
  assert.equal(icon.id, "ops");
  assert.equal(icon.source, "auto");
  assert.equal(icon.style, "plain");
});
