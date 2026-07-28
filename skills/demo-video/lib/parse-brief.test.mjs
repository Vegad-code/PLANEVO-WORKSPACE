import test from "node:test";
import assert from "node:assert/strict";
import { parseBriefHints } from "../lib/parse-brief.mjs";

test("parseBriefHints detects social vertical intent", () => {
  const hints = parseBriefHints("9:16 TikTok reel for launch week");
  assert.equal(hints.intent, "social");
  assert.equal(hints.platform, "vertical");
});

test("parseBriefHints detects narrated voiceover", () => {
  const hints = parseBriefHints("narrated walkthrough with voiceover");
  assert.equal(hints.intent, "narrated");
  assert.equal(hints.voiceover, true);
});

test("parseBriefHints parses duration in seconds", () => {
  const hints = parseBriefHints("keep it under 30s");
  assert.equal(hints.duration, 30);
});

test("parseBriefHints parses duration in minutes", () => {
  const hints = parseBriefHints("about 1 minute long");
  assert.equal(hints.duration, 60);
});

test("parseBriefHints detects music and captions", () => {
  const hints = parseBriefHints("polished promo with background music and subtitles");
  assert.equal(hints.intent, "polished");
  assert.equal(hints.music, true);
  assert.deepEqual(hints.captions, ["auto"]);
});

test("parseBriefHints returns empty object for blank brief", () => {
  assert.deepEqual(parseBriefHints(""), {});
  assert.deepEqual(parseBriefHints(undefined), {});
});
