#!/usr/bin/env node
/**
 * Portable demo-video recorder. Drives a real browser through a scripted flow and
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
 *     --out /opt/cursor/artifacts/demo.mp4
 *
 * A "flow" is a module that default-exports `async (page, ctx) => { ... }`, where
 * `ctx = { baseUrl, expect }`. Drive the page with normal Playwright calls.
 *
 * The raw capture is WebM (Playwright's native format). If ffmpeg is on PATH the
 * script transcodes to the requested .mp4 (better for PR/artifact playback);
 * otherwise it keeps the .webm and tells you.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

function hasFfmpeg() {
  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url ?? "http://localhost:3000";
  const flowPath = args.flow;
  const outPath = path.resolve(
    args.out ?? `/opt/cursor/artifacts/demo-${Date.now()}.mp4`,
  );
  const width = Number(args.width ?? 1280);
  const height = Number(args.height ?? 800);

  if (!flowPath) {
    throw new Error("Missing --flow <path to flow module>.");
  }

  const flowModule = await import(pathToFileURL(path.resolve(flowPath)).href);
  const flow = flowModule.default;
  if (typeof flow !== "function") {
    throw new Error(`Flow ${flowPath} must default-export an async function.`);
  }

  const videoDir = mkdtempSync(path.join(tmpdir(), "demo-video-"));
  mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: videoDir, size: { width, height } },
  });
  const page = await context.newPage();

  let failure = null;
  try {
    await flow(page, { baseUrl });
  } catch (error) {
    failure = error;
  }

  // Video is only finalized on context.close(); always close before reading it.
  const video = page.video();
  await context.close();
  await browser.close();

  const rawWebm = video ? await video.path() : null;
  if (!rawWebm) {
    rmSync(videoDir, { recursive: true, force: true });
    throw failure ?? new Error("No video was captured.");
  }

  const wantMp4 = outPath.toLowerCase().endsWith(".mp4");
  if (wantMp4 && hasFfmpeg()) {
    const code = spawnSync(
      "ffmpeg",
      ["-y", "-i", rawWebm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath],
      { stdio: "inherit" },
    ).status;
    if (code !== 0) throw new Error("ffmpeg transcode failed.");
  } else {
    const finalOut = wantMp4 ? outPath.replace(/\.mp4$/i, ".webm") : outPath;
    renameSync(rawWebm, finalOut);
    if (wantMp4) {
      console.log(`ffmpeg not found — kept WebM at ${finalOut}`);
    }
  }

  rmSync(videoDir, { recursive: true, force: true });

  if (failure) {
    console.error(`Flow failed AFTER capture; video saved for debugging: ${outPath}`);
    throw failure;
  }
  console.log(`Saved demo video: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
