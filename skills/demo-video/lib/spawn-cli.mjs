/**
 * Small spawn helpers for demo-video vendor CLIs (supercut, auto_demo).
 */
import { spawnSync } from "node:child_process";

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string; env?: NodeJS.ProcessEnv; stdio?: "inherit" | "pipe" }} [options]
 */
export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? "inherit",
    encoding: options.stdio === "pipe" ? "utf8" : undefined,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail =
      options.stdio === "pipe"
        ? (result.stderr || result.stdout || "").trim()
        : "";
    throw new Error(
      detail
        ? `Command failed (${result.status}): ${command} ${args.join(" ")}\n${detail}`
        : `Command failed (${result.status}): ${command} ${args.join(" ")}`,
    );
  }

  return result;
}

/**
 * @param {string} command
 */
export function commandExists(command) {
  const probe = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return probe.status === 0;
}
