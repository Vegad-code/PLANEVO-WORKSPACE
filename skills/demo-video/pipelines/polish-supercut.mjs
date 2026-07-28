#!/usr/bin/env node
/**
 * Supercut launch-style polish pipeline. AI `generate` when an LLM key is set;
 * otherwise offline `record` + `render` against a checked-in recipe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCommand } from "../lib/spawn-cli.mjs";
import {
  REPO_ROOT,
  requireVendorCli,
  resolveSupercutCli,
} from "../lib/resolve-vendor-cli.mjs";

const SKILL_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_RECIPE = path.join(
  SKILL_ROOT,
  "recipes",
  "onboarding-create-task.recipe.json",
);

/**
 * @typedef {object} RunSupercutInput
 * @property {string} url App base URL (e.g. http://localhost:3000)
 * @property {string} [brief] Natural-language brief for AI generate
 * @property {string} out Final MP4 path
 * @property {string} [repo] Source repo for supercut analyze (defaults to REPO_ROOT)
 * @property {string} [recipe] Recipe JSON for offline record/render
 * @property {boolean} [forceGenerate] Skip offline path even without LLM
 * @property {boolean} [skipGenerate] Force offline record/render
 */

/**
 * Locate the MP4 supercut wrote under a generate outDir.
 *
 * @param {string} dir
 */
function findGeneratedMp4(dir) {
  const direct = path.join(dir, "final.mp4");
  if (existsSync(direct)) return direct;

  const entries = readdirSync(dir, { withFileTypes: true });
  const mp4s = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".mp4")) {
      mp4s.push(full);
      continue;
    }
    if (entry.isDirectory()) {
      const nested = path.join(full, "final.mp4");
      if (existsSync(nested)) return nested;
    }
  }
  if (mp4s.length === 1) return mp4s[0];
  throw new Error(`Could not find final.mp4 under supercut generate outDir: ${dir}`);
}

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
 * True when supercut's `generate` subcommand can call an LLM provider.
 */
function hasSupercutLlmConfig() {
  if (process.env.SUPERCUT_SKIP_GENERATE === "1") return false;
  if (process.env.SUPERCUT_FORCE_GENERATE === "1") return true;

  const provider = process.env.SUPERCUT_PROVIDER?.trim();
  if (provider === "deepseek" && process.env.DEEPSEEK_API_KEY) return true;
  if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) return true;
  if (provider === "custom" && process.env.SUPERCUT_LLM_BASE_URL && process.env.SUPERCUT_MODEL) {
    return true;
  }

  // Ambiguous multi-key setups require explicit SUPERCUT_PROVIDER per supercut docs.
  if (process.env.DEEPSEEK_API_KEY && provider === undefined) return true;
  if (process.env.OPENROUTER_API_KEY && provider === undefined) return true;
  if (process.env.OPENAI_API_KEY && provider === undefined) return true;

  return false;
}

/**
 * Patch recipe app_url / scene entry URLs to match the live base URL.
 *
 * @param {string} recipePath
 * @param {string} url
 * @param {string} workDir
 */
function materializeRecipe(recipePath, url, workDir) {
  const raw = JSON.parse(readFileSync(recipePath, "utf8"));
  const base = url.replace(/\/$/, "");
  raw.app_url = base;
  if (Array.isArray(raw.scenes)) {
    for (const scene of raw.scenes) {
      if (scene.entry?.url?.startsWith("http")) {
        const pathname = new URL(scene.entry.url).pathname;
        scene.entry.url = `${base}${pathname}`;
      }
    }
  }
  const outPath = path.join(workDir, "recipe.json");
  writeFileSync(outPath, `${JSON.stringify(raw, null, 2)}\n`);
  return outPath;
}

/**
 * @param {RunSupercutInput} input
 * @returns {Promise<{ out: string; mode: "generate" | "record-render" }>}
 */
export async function runSupercut(input) {
  const url = input.url ?? "http://localhost:3000";
  const out = path.resolve(input.out);
  const repo = path.resolve(input.repo ?? REPO_ROOT);
  const recipePath = path.resolve(input.recipe ?? DEFAULT_RECIPE);

  mkdirSync(path.dirname(out), { recursive: true });

  const cli = resolveSupercutCli() ?? requireVendorCli("supercut");

  const useGenerate =
    !input.skipGenerate &&
    (input.forceGenerate === true || (input.brief && hasSupercutLlmConfig()));

  if (useGenerate) {
    const generateOutDir = mkdtempSync(path.join(tmpdir(), "supercut-generate-"));
    const generateArgs = [
      cli.entry,
      "generate",
      "--url",
      url,
      "--repo",
      repo,
      "--out",
      generateOutDir,
      "--yes",
    ];
    if (input.brief) {
      console.log(`Supercut generate brief (informational): ${input.brief}`);
    }
    runCommand(process.execPath, generateArgs, { cwd: cli.root });

    const generated = findGeneratedMp4(generateOutDir);
    copyFileSync(generated, out);
    return { out, mode: "generate" };
  }

  if (!existsSync(recipePath)) {
    throw new Error(
      `Offline supercut path needs a recipe JSON (missing ${recipePath}). ` +
        "Set DEEPSEEK_API_KEY / OPENROUTER_API_KEY + SUPERCUT_PROVIDER for AI generate, " +
        "or pass --recipe.",
    );
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "supercut-take-"));
  const takeDir = path.join(workDir, "take");
  mkdirSync(takeDir, { recursive: true });

  const patchedRecipe = materializeRecipe(recipePath, url, workDir);

  runCommand(
    process.execPath,
    [cli.entry, "record", "--recipe", patchedRecipe, "--out", takeDir],
    { cwd: cli.root },
  );

  const renderArgs = [cli.entry, "render", "--take", takeDir, "--out", out];
  if (input.brief) {
    console.log(
      "No LLM provider configured — using offline record/render. " +
        `Brief was ignored: "${input.brief}"`,
    );
  }

  runCommand(process.execPath, renderArgs, { cwd: cli.root });
  return { out, mode: "record-render" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runSupercut({
    url: args.url,
    brief: args.brief,
    out: args.out ?? path.join(REPO_ROOT, "artifacts/polished/supercut.mp4"),
    recipe: args.recipe,
    skipGenerate: args["skip-generate"] === "true",
    forceGenerate: args["force-generate"] === "true",
  });
  console.log(`Supercut ${result.mode} finished: ${result.out}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
