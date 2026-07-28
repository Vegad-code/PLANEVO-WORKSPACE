#!/usr/bin/env node
/**
 * Playwright record-flow capture pipeline. Wraps the portable recorder so the
 * director can import it dynamically. Also usable standalone via record-flow.mjs.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * @typedef {object} CaptureRecordFlowInput
 * @property {string} flow Path to flow module
 * @property {string} url Base app URL
 * @property {string} out Output video path (.mp4 or .webm)
 * @property {number} [width]
 * @property {number} [height]
 */

function resolveFfmpeg() {
  const bundled = path.join(REPO_ROOT, "node_modules/ffmpeg-static/ffmpeg");
  if (existsSync(bundled)) return bundled;
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) {
    return "ffmpeg";
  }
  return null;
}

/**
 * @param {CaptureRecordFlowInput} input
 * @returns {Promise<{ out: string }>}
 */
export async function captureRecordFlow({
  flow,
  url,
  out,
  width = 1280,
  height = 800,
}) {
  const flowPath = path.resolve(flow);
  const outPath = path.resolve(out);

  const flowModule = await import(pathToFileURL(flowPath).href);
  const runFlow = flowModule.default;
  if (typeof runFlow !== "function") {
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
    await runFlow(page, { baseUrl: url });
  } catch (error) {
    failure = error;
  }

  const video = page.video();
  await context.close();
  await browser.close();

  const rawWebm = video ? await video.path() : null;
  if (!rawWebm) {
    rmSync(videoDir, { recursive: true, force: true });
    throw failure ?? new Error("No video was captured.");
  }

  const wantMp4 = outPath.toLowerCase().endsWith(".mp4");
  const ffmpeg = resolveFfmpeg();
  let finalPath = outPath;

  if (wantMp4 && ffmpeg) {
    const code = spawnSync(
      ffmpeg,
      ["-y", "-i", rawWebm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath],
      { stdio: "inherit" },
    ).status;
    if (code !== 0) throw new Error("ffmpeg transcode failed.");
  } else {
    finalPath = wantMp4 ? outPath.replace(/\.mp4$/i, ".webm") : outPath;
    renameSync(rawWebm, finalPath);
    if (wantMp4) {
      console.log(`ffmpeg not found — kept WebM at ${finalPath}`);
    }
  }

  rmSync(videoDir, { recursive: true, force: true });

  if (failure) {
    console.error(`Flow failed AFTER capture; video saved for debugging: ${finalPath}`);
    throw failure;
  }

  return { out: finalPath };
}

/**
 * Director-facing entry: maps a demo plan to record-flow capture.
 *
 * @param {import('../lib/resolve-plan.mjs').DemoVideoPlan} plan
 */
export async function runCapture(plan) {
  const viewport = viewportForPlatform(plan.platform);
  const result = await captureRecordFlow({
    flow: plan.flow,
    url: plan.url,
    out: plan.rawOut,
    width: viewport.width,
    height: viewport.height,
  });
  return { stage: "capture", pipeline: "record-flow", ...result };
}

/**
 * @param {import('../lib/decision-matrix.mjs').Platform} platform
 */
function viewportForPlatform(platform) {
  switch (platform) {
    case "vertical":
      return { width: 1080, height: 1920 };
    case "square":
      return { width: 1080, height: 1080 };
    case "landscape":
      return { width: 1280, height: 800 };
    default: {
      const _exhaustive = platform;
      return { width: 1280, height: 800 };
    }
  }
}
