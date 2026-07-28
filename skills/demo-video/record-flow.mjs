#!/usr/bin/env node
/**
 * Portable demo-video recorder CLI. Drives a real browser through a scripted flow and
 * saves a video of the viewport — the same kind of artifact a Cloud agent produces
 * with RecordScreen, but runnable from any terminal (Cloud OR local IDE).
 *
 * Why Playwright: it is the one recording path that works identically in Cursor
 * Cloud and the desktop IDE. It needs only Node + a Chromium download; no OS screen
 * grabber, no Cursor-only tools. Video recording works headless.
 *
 * Usage:
 *   node skills/demo-video/record-flow.mjs \
 *     --flow skills/demo-video/flows/onboarding-create-task.mjs \
 *     --url http://localhost:3000 \
 *     --out artifacts/demo.mp4
 *
 * For intent-aware routing (polished, launch, social, narrated), prefer the director:
 *   node skills/demo-video/pipelines/director.mjs --screen onboarding-create-task --intent polished
 *
 * A "flow" is a module that default-exports `async (page, ctx) => { ... }`, where
 * `ctx = { baseUrl, expect }`. Drive the page with normal Playwright calls.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureRecordFlow } from "./pipelines/capture-record-flow.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url ?? "http://localhost:3000";
  const flowPath = args.flow;
  const outPath = path.resolve(
    args.out ?? path.join(REPO_ROOT, "artifacts", `demo-${Date.now()}.mp4`),
  );
  const width = Number(args.width ?? 1280);
  const height = Number(args.height ?? 800);

  if (!flowPath) {
    throw new Error("Missing --flow <path to flow module>.");
  }

  const { out } = await captureRecordFlow({
    flow: flowPath,
    url: baseUrl,
    out: outPath,
    width,
    height,
  });
  console.log(`Saved demo video: ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
