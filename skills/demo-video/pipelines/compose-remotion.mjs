#!/usr/bin/env node
/**
 * Remotion compose pipeline — polished demo footage + title/captions/CTA → final MP4.
 *
 * Usage:
 *   node skills/demo-video/pipelines/compose-remotion.mjs \
 *     --composition LaunchVideo \
 *     --demo artifacts/polished/onboarding-create-task.mp4 \
 *     --title "Create tasks in seconds" \
 *     --out artifacts/final/onboarding-create-task-launch.mp4
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const REMOTION_ROOT = path.join(REPO_ROOT, "skills", "demo-video", "remotion");
const REMOTION_PUBLIC = path.join(REMOTION_ROOT, "public");
const ENTRY = path.join(REMOTION_ROOT, "src", "index.ts");

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
 * Copy demo footage into remotion/public for staticFile() resolution.
 *
 * @param {string} demoPath
 * @returns {{ absolute: string, publicName: string }}
 */
function stageDemoFootage(demoPath) {
  const absolute = path.resolve(demoPath);
  if (!existsSync(absolute)) {
    throw new Error(`Demo footage not found: ${absolute}`);
  }
  mkdirSync(REMOTION_PUBLIC, { recursive: true });
  const publicName = `demo-footage-${path.basename(absolute)}`;
  const staged = path.join(REMOTION_PUBLIC, publicName);
  copyFileSync(absolute, staged);
  return { absolute, publicName };
}

/**
 * @param {object} input
 * @param {string} input.composition LaunchVideo | SocialReel
 * @param {string} input.demo Path to polished/raw mp4
 * @param {string} [input.title]
 * @param {string[]} [input.captions]
 * @param {string} [input.cta]
 * @param {string} input.out Final mp4 path
 * @param {import('../lib/resolve-plan.mjs').DemoVideoPlan} [input.plan]
 * @param {string} [input.inputPath] Director alias for demo path
 */
export async function runCompose({
  composition,
  demo,
  title,
  captions,
  cta,
  out,
  plan,
  inputPath,
}) {
  const compositionId =
    composition ?? plan?.composition ?? "LaunchVideo";
  const demoPath = demo ?? inputPath ?? plan?.polishedOut;
  if (!demoPath) {
    throw new Error("runCompose requires --demo or inputPath.");
  }

  const { publicName } = stageDemoFootage(demoPath);
  const outPath = path.resolve(
    out ?? plan?.out ?? path.join(REPO_ROOT, "artifacts", "final", "composed.mp4"),
  );

  const props = {
    demoSrc: publicName,
    title: title ?? "Create tasks in seconds",
    cta: cta ?? "Try Planevo",
    captions: captions ?? plan?.captions ?? [],
  };

  mkdirSync(path.dirname(outPath), { recursive: true });

  const remotionBin = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "remotion.cmd" : "remotion",
  );

  const args = [
    "render",
    ENTRY,
    compositionId,
    outPath,
    "--props",
    JSON.stringify(props),
    "--config",
    path.join(REMOTION_ROOT, "remotion.config.ts"),
  ];

  const result = spawnSync(remotionBin, args, {
    cwd: REMOTION_ROOT,
    stdio: "inherit",
    env: { ...process.env, PLANEVO_DEMO_SRC: props.demoSrc },
  });

  if (result.status !== 0) {
    throw new Error(`remotion render failed (exit ${result.status ?? "unknown"}).`);
  }

  if (!existsSync(outPath)) {
    throw new Error(`Expected output missing after render: ${outPath}`);
  }

  const bytes = statSync(outPath).size;
  return { stage: "compose", pipeline: "remotion", composition: compositionId, out: outPath, bytes };
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const captions = args.captions
    ? args.captions.split("|").map((line) => line.trim()).filter(Boolean)
    : undefined;

  const result = await runCompose({
    composition: args.composition,
    demo: args.demo,
    title: args.title,
    captions,
    cta: args.cta,
    out: args.out,
  });

  const sizeMb = (result.bytes / (1024 * 1024)).toFixed(2);
  console.log(`Saved composed video: ${result.out} (${sizeMb} MB)`);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
