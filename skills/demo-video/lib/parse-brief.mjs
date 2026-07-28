/**
 * Parse natural-language demo brief hints into plan field overrides.
 * Heuristic only — explicit CLI flags and plan JSON always win.
 */

/** @typedef {import('./decision-matrix.mjs').DemoIntent} DemoIntent */
/** @typedef {import('./decision-matrix.mjs').Platform} Platform */

/**
 * @typedef {object} BriefHints
 * @property {DemoIntent} [intent]
 * @property {Platform} [platform]
 * @property {number} [duration]
 * @property {boolean} [music]
 * @property {boolean} [voiceover]
 * @property {string[]} [captions]
 */

const INTENT_PATTERNS = [
  { intent: "social", pattern: /\b(social|reel|tiktok|instagram|shorts|9:16|vertical video)\b/i },
  { intent: "launch", pattern: /\b(launch|trailer|announcement|product hunt)\b/i },
  { intent: "narrated", pattern: /\b(narrat(?:ed|ion)|voice[\s-]?over|vo\b|spoken)\b/i },
  { intent: "polished", pattern: /\b(polish(?:ed)?|marketing|promo|slick|professional)\b/i },
  { intent: "recording", pattern: /\b(recording|debug|pr demo|quick|raw)\b/i },
];

const PLATFORM_PATTERNS = [
  { platform: "vertical", pattern: /\b(vertical|9:16|portrait|tiktok|reels?|shorts)\b/i },
  { platform: "square", pattern: /\b(square|1:1|instagram feed)\b/i },
  { platform: "landscape", pattern: /\b(landscape|16:9|youtube|widescreen)\b/i },
];

/**
 * @param {string | undefined} brief
 * @returns {BriefHints}
 */
export function parseBriefHints(brief) {
  if (!brief?.trim()) return {};

  const hints = /** @type {BriefHints} */ ({});

  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(brief)) {
      hints.intent = intent;
      break;
    }
  }

  for (const { platform, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(brief)) {
      hints.platform = platform;
      break;
    }
  }

  const durationMatch = brief.match(/\b(\d+(?:\.\d+)?)\s*(?:s|sec(?:onds?)?|min(?:ute)?s?)\b/i);
  if (durationMatch) {
    const value = Number(durationMatch[1]);
    const unit = durationMatch[0].toLowerCase();
    hints.duration = unit.includes("min") ? Math.round(value * 60) : Math.round(value);
  }

  if (/\b(with music|background music|soundtrack)\b/i.test(brief)) {
    hints.music = true;
  }

  if (/\b(voice[\s-]?over|narrat(?:ed|ion)|spoken)\b/i.test(brief)) {
    hints.voiceover = true;
    hints.intent = hints.intent ?? "narrated";
  }

  if (/\b(captions?|subtitles?|closed captions?)\b/i.test(brief)) {
    hints.captions = ["auto"];
  }

  return hints;
}
