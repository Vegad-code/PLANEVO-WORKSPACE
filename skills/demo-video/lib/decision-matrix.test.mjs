import test from "node:test";
import assert from "node:assert/strict";
import {
  INTENT_MATRIX,
  captureFallbackChain,
  isDemoIntent,
  resolvePipelineDefaults,
} from "../lib/decision-matrix.mjs";

test("resolvePipelineDefaults maps recording to record-flow + none", () => {
  const plan = resolvePipelineDefaults({ intent: "recording" });
  assert.equal(plan.capture, "record-flow");
  assert.equal(plan.compose, "none");
  assert.equal(plan.composition, null);
});

test("resolvePipelineDefaults maps launch to clipwise + remotion LaunchVideo", () => {
  const plan = resolvePipelineDefaults({ intent: "launch" });
  assert.equal(plan.capture, "clipwise");
  assert.equal(plan.compose, "remotion");
  assert.equal(plan.composition, "LaunchVideo");
});

test("resolvePipelineDefaults maps social to vertical 9:16", () => {
  const plan = resolvePipelineDefaults({ intent: "social" });
  assert.equal(plan.platform, "vertical");
  assert.equal(plan.composition, "SocialReel");
});

test("explicit overrides win over matrix defaults", () => {
  const plan = resolvePipelineDefaults({
    intent: "recording",
    capture: "clipwise",
    compose: "remotion",
    composition: "CustomComp",
  });
  assert.equal(plan.capture, "clipwise");
  assert.equal(plan.compose, "remotion");
  assert.equal(plan.composition, "CustomComp");
});

test("captureFallbackChain falls back to record-flow for polished", () => {
  assert.deepEqual(captureFallbackChain("polished", "clipwise"), ["clipwise", "record-flow"]);
});

test("captureFallbackChain falls back to record-flow for narrated auto_demo", () => {
  assert.deepEqual(captureFallbackChain("narrated", "auto_demo"), ["auto_demo", "record-flow"]);
});

test("isDemoIntent rejects unknown values", () => {
  assert.equal(isDemoIntent("recording"), true);
  assert.equal(isDemoIntent("bogus"), false);
});

test("every intent has matrix defaults", () => {
  for (const intent of Object.keys(INTENT_MATRIX)) {
    const plan = resolvePipelineDefaults({ intent: /** @type {import('../lib/decision-matrix.mjs').DemoIntent} */ (intent) });
    assert.ok(plan.capture);
    assert.ok(plan.compose);
  }
});
