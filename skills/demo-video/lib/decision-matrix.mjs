/**
 * Maps demo-video intent to default capture/compose pipelines and platform hints.
 * Pure logic — no I/O.
 */

/** @typedef {'recording' | 'polished' | 'launch' | 'social' | 'narrated'} DemoIntent */
/** @typedef {'record-flow' | 'clipwise' | 'demowright' | 'auto_demo'} CapturePipeline */
/** @typedef {'none' | 'remotion'} ComposePipeline */
/** @typedef {'landscape' | 'vertical' | 'square'} Platform */

/**
 * @typedef {object} PipelineDefaults
 * @property {CapturePipeline} capture
 * @property {ComposePipeline} compose
 * @property {string | null} composition
 * @property {Platform} [platform]
 * @property {string} notes
 */

/** @type {Record<DemoIntent, PipelineDefaults>} */
export const INTENT_MATRIX = {
  recording: {
    capture: "record-flow",
    compose: "none",
    composition: null,
    notes: "Fast PR/debug capture via Playwright record-flow.",
  },
  polished: {
    capture: "clipwise",
    compose: "none",
    composition: null,
    notes: "Clipwise polish; falls back to record-flow when unavailable.",
  },
  launch: {
    capture: "clipwise",
    compose: "remotion",
    composition: "LaunchVideo",
    notes: "Launch trailer; falls back to polished-only when Remotion unavailable.",
  },
  social: {
    capture: "clipwise",
    compose: "remotion",
    composition: "SocialReel",
    platform: "vertical",
    notes: "9:16 social reel via Remotion SocialReel.",
  },
  narrated: {
    capture: "auto_demo",
    compose: "none",
    composition: null,
    notes: "Auto-demo narration; falls back to record-flow when unavailable.",
  },
};

/** @type {DemoIntent[]} */
export const DEMO_INTENTS = Object.keys(INTENT_MATRIX);

/**
 * @param {unknown} value
 * @returns {value is DemoIntent}
 */
export function isDemoIntent(value) {
  return typeof value === "string" && value in INTENT_MATRIX;
}

/**
 * Resolve capture/compose defaults for an intent. Explicit plan fields win.
 *
 * @param {object} input
 * @param {DemoIntent} input.intent
 * @param {CapturePipeline} [input.capture]
 * @param {ComposePipeline} [input.compose]
 * @param {string | null} [input.composition]
 * @param {Platform} [input.platform]
 */
export function resolvePipelineDefaults({
  intent,
  capture,
  compose,
  composition,
  platform,
}) {
  const defaults = INTENT_MATRIX[intent];
  return {
    intent,
    capture: capture ?? defaults.capture,
    compose: compose ?? defaults.compose,
    composition: composition ?? defaults.composition,
    platform: platform ?? defaults.platform ?? "landscape",
    notes: defaults.notes,
  };
}

/**
 * Ordered fallback capture pipelines when the primary module is missing.
 *
 * @param {DemoIntent} intent
 * @param {CapturePipeline} primary
 * @returns {CapturePipeline[]}
 */
export function captureFallbackChain(intent, primary) {
  switch (intent) {
    case "polished":
      return primary === "clipwise" ? ["clipwise", "record-flow"] : [primary];
    case "launch":
      return primary === "clipwise" ? ["clipwise", "record-flow"] : [primary];
    case "social":
      return primary === "clipwise" ? ["clipwise", "record-flow"] : [primary];
    case "narrated":
      return primary === "auto_demo" ? ["auto_demo", "record-flow"] : [primary];
    case "recording":
      return [primary];
    default: {
      const _exhaustive = intent;
      return [_exhaustive];
    }
  }
}

/**
 * Whether compose should be skipped when the Remotion module is unavailable.
 *
 * @param {DemoIntent} intent
 */
export function allowsComposeFallback(intent) {
  return intent === "launch" || intent === "social";
}
