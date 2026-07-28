#!/usr/bin/env node
/**
 * auto_demo narrated capture pipeline: deterministic .demo.json replay + voice mux.
 * Uses mock narration when no ElevenLabs key is present.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCommand } from "../lib/spawn-cli.mjs";
import {
  REPO_ROOT,
  requireVendorCli,
  resolveAutoDemoCli,
} from "../lib/resolve-vendor-cli.mjs";

const SKILL_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * @typedef {object} RunNarratedInput
 * @property {string} flow Path to .demo.json flow file
 * @property {string} out Final narrated MP4 path
 * @property {string} [url] Base URL override (--base-url for auto_demo run)
 * @property {string} [script] Narration script path (start | duration | text)
 * @property {"mock" | "elevenlabs"} [voice] TTS backend
 * @property {string} [voiceId] ElevenLabs voice id when voice=elevenlabs
 * @property {boolean} [vertical] Also emit a 9:16 vertical cut beside `out`
 */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

/**
 * @param {string} flowPath
 */
function defaultNarrationScript(flowPath) {
  const sibling = flowPath.replace(/\.demo\.json$/i, ".narration.txt");
  if (existsSync(sibling)) return sibling;

  const fallback = path.join(SKILL_ROOT, "flows", "onboarding-create-task.narration.txt");
  if (existsSync(fallback)) return fallback;

  throw new Error(
    `No narration script found. Pass --script or add ${sibling}`,
  );
}

/**
 * Derive base URL from flow JSON when not passed explicitly.
 *
 * @param {string} flowPath
 */
function readFlowStartUrl(flowPath) {
  const flow = JSON.parse(readFileSync(flowPath, "utf8"));
  if (typeof flow.startUrl === "string" && flow.startUrl.startsWith("http")) {
    return flow.startUrl.replace(/\/tasks\/?$/, "");
  }
  return "http://localhost:3000";
}

/**
 * @param {RunNarratedInput} input
 * @returns {Promise<{ out: string; recording: string; voice: string; vertical?: string }>}
 */
export async function runNarrated(input) {
  const flowPath = path.resolve(input.flow);
  const out = path.resolve(input.out);
  const url = input.url ?? readFlowStartUrl(flowPath);
  const scriptPath = path.resolve(input.script ?? defaultNarrationScript(flowPath));

  if (!existsSync(flowPath)) {
    throw new Error(`Flow file not found: ${flowPath}`);
  }
  if (!existsSync(scriptPath)) {
    throw new Error(`Narration script not found: ${scriptPath}`);
  }

  mkdirSync(path.dirname(out), { recursive: true });

  const cli = resolveAutoDemoCli() ?? requireVendorCli("auto_demo");

  const workDir = mkdtempSync(path.join(tmpdir(), "auto-demo-"));
  const recordingDir = path.join(workDir, "recording");
  mkdirSync(recordingDir, { recursive: true });

  const runArgs = [
    cli.entry,
    "run",
    flowPath,
    "--output",
    recordingDir,
    "--base-url",
    url,
    "--speed",
    "1",
  ];

  runCommand(process.execPath, runArgs, { cwd: cli.root });

  const recordingWebm = path.join(recordingDir, "recording.webm");
  if (!existsSync(recordingWebm)) {
    rmSync(workDir, { recursive: true, force: true });
    throw new Error(
      `auto_demo run completed but recording.webm is missing in ${recordingDir}`,
    );
  }

  const voice =
    input.voice ??
    (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "mock");

  const narrateArgs = [
    cli.entry,
    "narrate",
    "--script",
    scriptPath,
    "--in",
    recordingWebm,
    "--out",
    out,
    "--voice",
    voice,
  ];
  if (voice === "elevenlabs" && input.voiceId) {
    narrateArgs.push("--voice-id", input.voiceId);
  }

  runCommand(process.execPath, narrateArgs, { cwd: cli.root });

  let verticalOut;
  if (input.vertical) {
    verticalOut = out.replace(/\.mp4$/i, "-vertical.mp4");
    runCommand(
      process.execPath,
      [
        cli.entry,
        "vertical",
        "--in",
        out,
        "--out",
        verticalOut,
        "--aspect",
        "9:16",
        "--fit",
        "crop",
      ],
      { cwd: cli.root },
    );
  }

  rmSync(workDir, { recursive: true, force: true });

  return {
    out,
    recording: recordingWebm,
    voice,
    vertical: verticalOut,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.flow) {
    throw new Error(
      "Missing --flow <path to .demo.json>. Example:\n" +
        "  node skills/demo-video/pipelines/narrate-autodemo.mjs \\\n" +
        "    --flow skills/demo-video/flows/onboarding-create-task.demo.json \\\n" +
        "    --out artifacts/polished/onboarding-create-task-narrated.mp4",
    );
  }

  const result = await runNarrated({
    flow: args.flow,
    out:
      args.out ??
      path.join(REPO_ROOT, "artifacts/polished/onboarding-create-task-narrated.mp4"),
    url: args.url,
    script: args.script,
    voice: args.voice === "elevenlabs" ? "elevenlabs" : "mock",
    voiceId: args["voice-id"],
    vertical: args.vertical === "true",
  });

  console.log(`Narrated demo (${result.voice}) saved: ${result.out}`);
  if (result.vertical) {
    console.log(`Vertical cut: ${result.vertical}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
