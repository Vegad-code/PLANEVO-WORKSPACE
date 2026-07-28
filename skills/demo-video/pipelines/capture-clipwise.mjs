#!/usr/bin/env node
/**
 * Clipwise capture pipeline — YAML scenario in, polished MP4 out.
 *
 * Usage:
 *   node skills/demo-video/pipelines/capture-clipwise.mjs \
 *     --scenario scenarios/onboarding-create-task.yaml \
 *     --out artifacts/polished/onboarding-create-task.mp4
 *
 * Programmatic API (clipwise v0.12): loadScenario → ClipwiseRecorder →
 * CanvasRenderer.composeAll → encodeMp4. Falls back to CLI if the bundled
 * ConcurrentSession path is preferred for large scenarios.
 */
import {
  CanvasRenderer,
  ClipwiseRecorder,
  ConcurrentSession,
  encodeMp4,
  loadScenario,
} from "clipwise";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const SKILL_ROOT = path.join(REPO_ROOT, "skills", "demo-video");

/**
 * Clipwise shells out to `ffmpeg` on PATH — wire ffmpeg-static when present.
 */
function envWithFfmpeg() {
  const bundled = path.join(REPO_ROOT, "node_modules/ffmpeg-static/ffmpeg");
  if (!existsSync(bundled)) return process.env;
  const binDir = path.dirname(bundled);
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const args = /** @type {Record<string, string | undefined>} */ ({});
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

/**
 * Rewrite navigate URLs in a scenario so --url overrides localhost defaults.
 *
 * @param {import('clipwise').Scenario} scenario
 * @param {string} baseUrl
 */
function patchScenarioBaseUrl(scenario, baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  for (const step of scenario.steps) {
    for (const action of step.actions) {
      if (action.action === "navigate" && typeof action.url === "string") {
        if (action.url.startsWith("http://localhost:3000")) {
          action.url = action.url.replace("http://localhost:3000", base);
        }
      }
    }
  }
}

/**
 * @param {string} scenarioPath
 * @param {string} baseUrl
 * @returns {Promise<import('clipwise').Scenario>}
 */
async function loadScenarioWithUrl(scenarioPath, baseUrl) {
  const resolved = path.isAbsolute(scenarioPath)
    ? scenarioPath
    : path.join(SKILL_ROOT, scenarioPath);
  const scenario = await loadScenario(resolved);
  patchScenarioBaseUrl(scenario, baseUrl);
  return scenario;
}

/**
 * @param {import('clipwise').Scenario} scenario
 * @param {string} outPath
 */
async function recordWithClipwiseApi(scenario, outPath) {
  const previousEnv = process.env;
  process.env = envWithFfmpeg();

  try {
    const recorder = new ClipwiseRecorder();
    const renderer = new CanvasRenderer(
      scenario.effects,
      scenario.output,
      scenario.steps,
    );

    mkdirSync(path.dirname(outPath), { recursive: true });

    let mp4Buffer;
    if (scenario.output.format === "mp4" && renderer.canStreamOnline?.()) {
      const pipeline = new ConcurrentSession(recorder, scenario, renderer);
      const result = await pipeline.run();
      mp4Buffer = result.buffer;
    } else {
      const session = await recorder.record(scenario);
      const frames = await renderer.composeAll(session.frames);
      mp4Buffer = await encodeMp4(frames, scenario.output);
    }

    writeFileSync(outPath, mp4Buffer);
    return { out: outPath, bytes: mp4Buffer.length };
  } finally {
    process.env = previousEnv;
  }
}

/**
 * @param {object} input
 * @param {string} input.scenario Path to YAML (absolute or relative to skills/demo-video)
 * @param {string} input.out Output .mp4 path
 * @param {string} [input.url] Base app URL (default http://localhost:3000)
 */
export async function runCapture({ scenario, out, url = "http://localhost:3000", ...plan }) {
  const scenarioPath =
    scenario ??
    (plan.screen
      ? path.join(SKILL_ROOT, "scenarios", `${plan.screen}.yaml`)
      : undefined);
  const outPath = path.resolve(
    out ?? plan.polishedOut ?? path.join(REPO_ROOT, "artifacts", "polished", "capture.mp4"),
  );
  const baseUrl = url ?? plan.url ?? "http://localhost:3000";

  if (!scenarioPath) {
    throw new Error("runCapture requires --scenario or plan.screen.");
  }

  const scenarioObj = await loadScenarioWithUrl(scenarioPath, baseUrl);
  const result = await recordWithClipwiseApi(scenarioObj, outPath);
  return { stage: "capture", pipeline: "clipwise", ...result };
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const scenario =
    args.scenario ??
    (args.screen ? `scenarios/${args.screen}.yaml` : undefined);
  const out =
    args.out ??
    path.join(REPO_ROOT, "artifacts", "polished", "onboarding-create-task.mp4");

  const result = await runCapture({
    scenario,
    out,
    url: args.url,
  });

  const sizeMb = (result.bytes / (1024 * 1024)).toFixed(2);
  console.log(`Saved polished capture: ${result.out} (${sizeMb} MB)`);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
