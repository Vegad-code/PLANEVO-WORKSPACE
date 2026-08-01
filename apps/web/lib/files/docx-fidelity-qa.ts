/**
 * Non-test consumer of the OOXML fidelity harness. Used by the round-trip QA
 * script and by npm-discovered tests so the harness is not orphaned behind
 * its own unit file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  compareDocxPackages,
  isDocxFidelityDegraded,
  summarizeDocxFidelityReport,
  type DocxFidelityDiffKind,
  type DocxFidelityReport,
  type DocxFidelityVerdict,
} from "./docx-fidelity.ts";

const CONTENT_LOSS_KINDS = new Set<DocxFidelityDiffKind>([
  "missing_in_after",
  "crc_changed",
  "uncompressed_size_changed",
]);

export type DocxRoundTripFidelityResult =
  | { kind: "ok"; report: DocxFidelityReport }
  | { kind: "failed"; report: DocxFidelityReport; message: string };

export type DocxFidelityQaCaseResult = {
  name: string;
  ok: boolean;
  expectedVerdict: DocxFidelityVerdict;
  report: DocxFidelityReport;
  detail: string;
};

export type DocxFidelityQaRun = {
  ok: boolean;
  cases: readonly DocxFidelityQaCaseResult[];
  lines: readonly string[];
};

/**
 * Gate a before/after pair. Content degradation always fails. Packaging
 * drift fails unless `allowPackagingDrift` is set (Word/Google Docs rewrite).
 */
export function assertDocxRoundTripFidelity(input: {
  before: Uint8Array;
  after: Uint8Array;
  allowPackagingDrift?: boolean;
}): DocxRoundTripFidelityResult {
  const report = compareDocxPackages({
    before: input.before,
    after: input.after,
  });
  const summary = summarizeDocxFidelityReport({ report });

  switch (report.verdict) {
    case "intact":
      return { kind: "ok", report };
    case "packaging_drift":
      if (input.allowPackagingDrift) {
        return { kind: "ok", report };
      }
      return {
        kind: "failed",
        report,
        message: `Unexpected packaging drift: ${summary}`,
      };
    case "degraded":
      return {
        kind: "failed",
        report,
        message: `Content degraded: ${summary}`,
      };
    case "unreadable":
      return {
        kind: "failed",
        report,
        message: `Unreadable package: ${summary}`,
      };
    default: {
      const _exhaustive: never = report.verdict;
      return _exhaustive;
    }
  }
}

/**
 * Run the checked-in fixture matrix. Exit code of the QA script mirrors
 * `ok`: the harness must classify intact / packaging_drift / degraded
 * correctly, and must never treat content loss as packaging noise.
 */
export function runDocxFidelityQa(input: {
  fixturesDir: string;
}): DocxFidelityQaRun {
  const load = (name: string): Uint8Array =>
    new Uint8Array(readFileSync(join(input.fixturesDir, name)));

  const baseline = load("minimal-baseline.docx");
  const missingStyles = load("missing-styles.docx");
  const mutatedDocument = load("mutated-document.docx");
  const addedCustomPart = load("added-custom-part.docx");
  const recompressed = load("recompressed-baseline.docx");

  const cases: DocxFidelityQaCaseResult[] = [
    expectVerdict({
      name: "baseline vs itself stays intact",
      before: baseline,
      after: baseline,
      expectedVerdict: "intact",
    }),
    expectVerdict({
      name: "recompressed baseline is packaging drift only",
      before: baseline,
      after: recompressed,
      expectedVerdict: "packaging_drift",
      requireKinds: ["compression_method_changed", "payload_changed"],
      forbidKinds: [...CONTENT_LOSS_KINDS],
    }),
    expectVerdict({
      name: "missing styles is degraded content loss",
      before: baseline,
      after: missingStyles,
      expectedVerdict: "degraded",
      requireKinds: ["missing_in_after"],
    }),
    expectVerdict({
      name: "mutated document body is degraded",
      before: baseline,
      after: mutatedDocument,
      expectedVerdict: "degraded",
      requireKinds: ["crc_changed"],
    }),
    expectVerdict({
      name: "added customXml part is packaging drift",
      before: baseline,
      after: addedCustomPart,
      expectedVerdict: "packaging_drift",
      requireKinds: ["added_in_after"],
      forbidKinds: [...CONTENT_LOSS_KINDS],
    }),
    expectRoundTripGate({
      name: "round-trip gate accepts recompression when packaging drift is allowed",
      before: baseline,
      after: recompressed,
      allowPackagingDrift: true,
      expectOk: true,
    }),
    expectRoundTripGate({
      name: "round-trip gate rejects missing styles as content loss",
      before: baseline,
      after: missingStyles,
      allowPackagingDrift: true,
      expectOk: false,
    }),
  ];

  const ok = cases.every((entry) => entry.ok);
  const lines = [
    "DOCX fidelity QA",
    ...cases.map(
      (entry) =>
        `${entry.ok ? "PASS" : "FAIL"}  ${entry.name} → ${entry.detail}`,
    ),
    ok ? "All fidelity QA cases passed." : "Fidelity QA failed.",
  ];

  return { ok, cases, lines };
}

function expectVerdict(input: {
  name: string;
  before: Uint8Array;
  after: Uint8Array;
  expectedVerdict: DocxFidelityVerdict;
  requireKinds?: readonly DocxFidelityDiffKind[];
  forbidKinds?: readonly DocxFidelityDiffKind[];
}): DocxFidelityQaCaseResult {
  const report = compareDocxPackages({
    before: input.before,
    after: input.after,
  });
  const kinds = new Set(report.diffs.map((diff) => diff.kind));
  const missingRequired = (input.requireKinds ?? []).filter(
    (kind) => !kinds.has(kind),
  );
  const forbiddenPresent = (input.forbidKinds ?? []).filter((kind) =>
    kinds.has(kind),
  );
  const ok =
    report.verdict === input.expectedVerdict &&
    missingRequired.length === 0 &&
    forbiddenPresent.length === 0 &&
    (input.expectedVerdict !== "degraded" ||
      isDocxFidelityDegraded({ report }));

  return {
    name: input.name,
    ok,
    expectedVerdict: input.expectedVerdict,
    report,
    detail: ok
      ? summarizeDocxFidelityReport({ report })
      : `expected ${input.expectedVerdict}, got ${report.verdict}` +
        (missingRequired.length
          ? `; missing kinds ${missingRequired.join(",")}`
          : "") +
        (forbiddenPresent.length
          ? `; forbidden kinds ${forbiddenPresent.join(",")}`
          : ""),
  };
}

function expectRoundTripGate(input: {
  name: string;
  before: Uint8Array;
  after: Uint8Array;
  allowPackagingDrift: boolean;
  expectOk: boolean;
}): DocxFidelityQaCaseResult {
  const result = assertDocxRoundTripFidelity({
    before: input.before,
    after: input.after,
    allowPackagingDrift: input.allowPackagingDrift,
  });
  const passed = result.kind === "ok";
  const ok = passed === input.expectOk;
  return {
    name: input.name,
    ok,
    expectedVerdict: result.report.verdict,
    report: result.report,
    detail: ok
      ? summarizeDocxFidelityReport({ report: result.report })
      : `gate ${passed ? "ok" : "failed"} but expected ${
          input.expectOk ? "ok" : "failed"
        }: ${
          result.kind === "failed"
            ? result.message
            : summarizeDocxFidelityReport({ report: result.report })
        }`,
  };
}
