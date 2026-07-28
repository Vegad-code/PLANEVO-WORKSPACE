/**
 * Merge plan JSON, CLI flags, and brief hints into a director-ready plan.
 */

import { isDemoIntent, resolvePipelineDefaults } from "./decision-matrix.mjs";
import { parseBriefHints } from "./parse-brief.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * @typedef {import('./decision-matrix.mjs').DemoIntent} DemoIntent
 * @typedef {import('./decision-matrix.mjs').CapturePipeline} CapturePipeline
 * @typedef {import('./decision-matrix.mjs').ComposePipeline} ComposePipeline
 * @typedef {import('./decision-matrix.mjs').Platform} Platform
 *
 * @typedef {object} DemoVideoPlan
 * @property {string} screen
 * @property {DemoIntent} intent
 * @property {string} [audience]
 * @property {Platform} platform
 * @property {number} [duration]
 * @property {CapturePipeline} capture
 * @property {ComposePipeline} compose
 * @property {string | null} composition
 * @property {boolean} [music]
 * @property {boolean} [voiceover]
 * @property {string[]} [captions]
 * @property {string} url
 * @property {string} out
 * @property {string} flow
 * @property {string} rawOut
 * @property {string} polishedOut
 * @property {string} [brief]
 * @property {string} notes
 */

/**
 * @param {Record<string, string | undefined>} args
 */
export function parseCliArgs(args) {
  const truthy = (value) =>
    value === "true" || value === "1" || value === "yes";

  const intentFlag = [
    args.intent,
    args.recording && "recording",
    args.polished && "polished",
    args.launch && "launch",
    args.social && "social",
    args.narrated && "narrated",
  ].find((value) => value && value !== "true" && value !== "false");

  return {
    screen: args.screen,
    intent: intentFlag,
    audience: args.audience,
    platform: args.platform,
    duration: args.duration ? Number(args.duration) : undefined,
    capture: args.capture,
    compose: args.compose,
    composition: args.composition,
    music: args.music !== undefined ? truthy(args.music) : undefined,
    voiceover: args.voiceover !== undefined ? truthy(args.voiceover) : undefined,
    captions: args.captions ? args.captions.split(",").map((s) => s.trim()) : undefined,
    url: args.url,
    out: args.out,
    plan: args.plan,
    brief: args.brief,
  };
}

/**
 * @param {Partial<DemoVideoPlan> & Record<string, unknown>} filePlan
 * @param {ReturnType<typeof parseCliArgs>} cli
 */
export function mergePlan(filePlan, cli) {
  const briefHints = parseBriefHints(cli.brief ?? (typeof filePlan.brief === "string" ? filePlan.brief : undefined));

  const screen = cli.screen ?? (typeof filePlan.screen === "string" ? filePlan.screen : undefined);
  if (!screen) {
    throw new Error("Missing required --screen or plan.screen.");
  }

  const intentRaw =
    cli.intent ??
    briefHints.intent ??
    (typeof filePlan.intent === "string" ? filePlan.intent : undefined) ??
    "recording";

  if (!isDemoIntent(intentRaw)) {
    throw new Error(`Unknown intent "${intentRaw}". Expected one of: recording, polished, launch, social, narrated.`);
  }

  const pipeline = resolvePipelineDefaults({
    intent: intentRaw,
    capture: cli.capture ?? (typeof filePlan.capture === "string" ? /** @type {CapturePipeline} */ (filePlan.capture) : undefined),
    compose: cli.compose ?? (typeof filePlan.compose === "string" ? /** @type {ComposePipeline} */ (filePlan.compose) : undefined),
    composition:
      cli.composition ??
      (typeof filePlan.composition === "string" ? filePlan.composition : undefined) ??
      null,
    platform:
      cli.platform ??
      briefHints.platform ??
      (typeof filePlan.platform === "string" ? /** @type {Platform} */ (filePlan.platform) : undefined),
  });

  const out =
    cli.out ??
    (typeof filePlan.out === "string" ? filePlan.out : undefined) ??
    path.join(REPO_ROOT, "artifacts", "final", `${screen}.mp4`);

  const resolvedOut = path.isAbsolute(out) ? out : path.join(REPO_ROOT, out);

  return /** @type {DemoVideoPlan} */ ({
    screen,
    intent: pipeline.intent,
    audience: cli.audience ?? (typeof filePlan.audience === "string" ? filePlan.audience : undefined),
    platform: pipeline.platform,
    duration: cli.duration ?? briefHints.duration ?? (typeof filePlan.duration === "number" ? filePlan.duration : undefined),
    capture: pipeline.capture,
    compose: pipeline.compose,
    composition: pipeline.composition,
    music: cli.music ?? briefHints.music ?? (typeof filePlan.music === "boolean" ? filePlan.music : undefined),
    voiceover: cli.voiceover ?? briefHints.voiceover ?? (typeof filePlan.voiceover === "boolean" ? filePlan.voiceover : undefined),
    captions: cli.captions ?? briefHints.captions ?? (Array.isArray(filePlan.captions) ? filePlan.captions : undefined),
    url: cli.url ?? (typeof filePlan.url === "string" ? filePlan.url : undefined) ?? "http://localhost:3000",
    out: resolvedOut,
    flow: path.join(REPO_ROOT, "skills", "demo-video", "flows", `${screen}.mjs`),
    rawOut: path.join(REPO_ROOT, "artifacts", "raw", `${screen}.mp4`),
    polishedOut: path.join(REPO_ROOT, "artifacts", "polished", `${screen}.mp4`),
    brief: cli.brief ?? (typeof filePlan.brief === "string" ? filePlan.brief : undefined),
    notes: pipeline.notes,
  });
}
