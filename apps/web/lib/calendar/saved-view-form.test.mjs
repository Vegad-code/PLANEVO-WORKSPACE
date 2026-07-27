import assert from "node:assert/strict";
import test from "node:test";
import { PRESET_CONFIGS, resolveViewConfig } from "./view-config.ts";
import {
  presetForSavedView,
  resolveSavedViewDraft,
  viewOverridesForPreset,
} from "./saved-view-form.ts";

test("a saved-view draft resolves partial config over Classic", () => {
  const draft = resolveSavedViewDraft("classic", {
    cardDensity: "minimal",
  });

  assert.equal(draft.layout, PRESET_CONFIGS.classic.layout);
  assert.equal(draft.cardDensity, "minimal");
});

test("submitting a customized preset stores only changed axes", () => {
  const draft = {
    ...PRESET_CONFIGS.classic,
    dayCount: 5,
    timeAxis: { ...PRESET_CONFIGS.classic.timeAxis },
    interactionSet: [...PRESET_CONFIGS.classic.interactionSet],
  };

  const overrides = viewOverridesForPreset("classic", draft);

  assert.deepEqual(overrides, { dayCount: 5 });
  assert.deepEqual(resolveViewConfig("classic", overrides), draft);
});

test("invalid and retired preset names degrade to Classic", () => {
  assert.equal(presetForSavedView("custom"), "classic");
  assert.equal(presetForSavedView("unknown"), "classic");
  assert.equal(presetForSavedView("flow"), "classic");
  assert.equal(presetForSavedView("planner"), "classic");
});
