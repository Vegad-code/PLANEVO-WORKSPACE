/**
 * Locate optional third-party demo CLIs (supercut, auto_demo / ui-demo-runner).
 * Neither is published to npm — install from git into .vendor/ or set env roots.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const VENDOR_DIR = path.join(REPO_ROOT, ".vendor");

/**
 * @typedef {object} VendorCli
 * @property {string} root Vendor checkout root
 * @property {string} entry Absolute path to built CLI entry
 * @property {"supercut" | "auto_demo"} kind
 */

/**
 * @param {string} root
 * @param {string} relativeEntry
 */
function cliIfBuilt(root, relativeEntry) {
  const entry = path.join(root, relativeEntry);
  return existsSync(entry) ? entry : null;
}

/**
 * @returns {VendorCli | null}
 */
export function resolveSupercutCli() {
  const candidates = [
    process.env.SUPERCUT_ROOT,
    path.join(VENDOR_DIR, "supercut"),
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const root of candidates) {
    const entry = cliIfBuilt(root, "dist/cli/index.js");
    if (entry) {
      return { root, entry, kind: "supercut" };
    }
  }
  return null;
}

/**
 * @returns {VendorCli | null}
 */
export function resolveAutoDemoCli() {
  const candidates = [
    process.env.AUTO_DEMO_ROOT,
    process.env.UI_DEMO_RUNNER_ROOT,
    path.join(VENDOR_DIR, "auto_demo"),
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const root of candidates) {
    const entry = cliIfBuilt(root, "dist/cli.js");
    if (entry) {
      return { root, entry, kind: "auto_demo" };
    }
  }
  return null;
}

/**
 * @param {"supercut" | "auto_demo"} kind
 */
export function vendorSetupHint(kind) {
  if (kind === "supercut") {
    return [
      "Supercut is not on npm. Install once:",
      "  git clone https://github.com/Co-Messi/supercut .vendor/supercut",
      "  cd .vendor/supercut && npm install && npm run build",
      "  npx playwright install chromium",
      "Or set SUPERCUT_ROOT to an existing checkout.",
      "See skills/demo-video/docs/tier3-supercut-autodemo.md",
    ].join("\n");
  }

  return [
    "auto_demo (ui-demo-runner) is not on npm. Install once:",
    "  git clone https://github.com/wranngle/auto_demo .vendor/auto_demo",
    "  cd .vendor/auto_demo && npm install && npm run build",
    "  npx playwright install chromium",
    "Or set AUTO_DEMO_ROOT to an existing checkout.",
    "See skills/demo-video/docs/tier3-supercut-autodemo.md",
  ].join("\n");
}

/**
 * @param {"supercut" | "auto_demo"} kind
 */
export function requireVendorCli(kind) {
  const resolved =
    kind === "supercut" ? resolveSupercutCli() : resolveAutoDemoCli();
  if (!resolved) {
    throw new Error(
      `${kind} CLI not found.\n\n${vendorSetupHint(kind)}`,
    );
  }
  return resolved;
}

export { REPO_ROOT, VENDOR_DIR };
