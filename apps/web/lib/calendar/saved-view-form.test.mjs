import assert from "node:assert/strict";
import test from "node:test";
import { PRESET_CONFIGS, resolveViewConfig } from "./view-config.ts";
import {
  presetForSavedView,
  resolveSavedViewDraft,
  viewOverridesForPreset,
} from "./saved-view-form.ts";

test("a saved-view draft resolves partial config over its preset", () => {
  // Arrange / Act
  const draft = resolveSavedViewDraft("planner", {
    cardDensity: "minimal",
  });

  // Assert
  assert.equal(draft.layout, PRESET_CONFIGS.planner.layout);
  assert.equal(draft.cardDensity, "minimal");
});

test("submitting a customized preset stores only changed axes", () => {
  // Arrange
  const draft = {
    ...PRESET_CONFIGS.classic,
    dayCount: 5,
    timeAxis: { ...PRESET_CONFIGS.classic.timeAxis },
    interactionSet: [...PRESET_CONFIGS.classic.interactionSet],
  };

  // Act
  const overrides = viewOverridesForPreset("classic", draft);

  // Assert
  assert.deepEqual(overrides, { dayCount: 5 });
  assert.deepEqual(resolveViewConfig("classic", overrides), draft);
});

test("invalid persisted preset names degrade to Classic", () => {
  // Arrange / Act / Assert
  assert.equal(presetForSavedView("custom"), "classic");
  assert.equal(presetForSavedView("unknown"), "classic");
  assert.equal(presetForSavedView("flow"), "flow");
});
