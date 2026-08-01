/**
 * Non-test consumer of the PDF fidelity harness. Used by npm-discovered
 * tests so the harness is not orphaned behind its own unit file.
 *
 * PDF domain (markdown-shell): text integrity, packaging drift, degraded
 * body, unreadable packages, silent empty body, and a blind intact/degraded
 * pair. Never claims bit-identical page layout.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertPdfContentIntegrity,
  comparePdfPackages,
  evaluateMarkdownPdfRoundTrip,
  isPdfFidelityDegraded,
  summarizeMarkdownPdfRoundTripReport,
  summarizePdfContentIntegrityReport,
  summarizePdfFidelityReport,
  type PdfFidelityDiffKind,
  type PdfFidelityReport,
  type PdfFidelityVerdict,
} from "./pdf-fidelity.ts";

const CONTENT_LOSS_KINDS = new Set<PdfFidelityDiffKind>(["text_changed"]);

export type PdfRoundTripFidelityResult =
  | { kind: "ok"; report: PdfFidelityReport }
  | { kind: "failed"; report: PdfFidelityReport; message: string };

export type PdfFidelityQaCaseResult = {
  name: string;
  ok: boolean;
  expectedVerdict: PdfFidelityVerdict | string;
  report: PdfFidelityReport | null;
  detail: string;
};

export type PdfFidelityQaRun = {
  ok: boolean;
  cases: readonly PdfFidelityQaCaseResult[];
  lines: readonly string[];
};

/**
 * Gate a before/after pair. Text degradation always fails. Packaging
 * drift fails unless `allowPackagingDrift` is set (producer rewrite /
 * object recompression with preserved extractable text).
 */
export async function assertPdfRoundTripFidelity(input: {
  before: Uint8Array;
  after: Uint8Array;
  allowPackagingDrift?: boolean;
}): Promise<PdfRoundTripFidelityResult> {
  const report = await comparePdfPackages({
    before: input.before,
    after: input.after,
  });
  const summary = summarizePdfFidelityReport({ report });

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
 * Run the checked-in fixture matrix. Exit code of any QA script should
 * mirror `ok`: the harness must classify intact / packaging_drift /
 * degraded / unreadable correctly, never treat text loss as packaging
 * noise, and never pass a silent empty body when fragments were expected.
 */
export async function runPdfFidelityQa(input: {
  fixturesDir: string;
}): Promise<PdfFidelityQaRun> {
  const load = (name: string): Uint8Array =>
    new Uint8Array(readFileSync(join(input.fixturesDir, name)));

  const baseline = load("fidelity-harness-baseline.pdf");
  const metadataDrift = load("fidelity-metadata-drift.pdf");
  const mutatedBody = load("fidelity-mutated-body.pdf");
  const emptyBody = load("fidelity-empty-body.pdf");
  const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

  const cases: PdfFidelityQaCaseResult[] = [
    await expectVerdict({
      name: "baseline vs itself stays intact",
      before: baseline,
      after: baseline,
      expectedVerdict: "intact",
    }),
    await expectVerdict({
      name: "metadata rewrite is packaging drift only",
      before: baseline,
      after: metadataDrift,
      expectedVerdict: "packaging_drift",
      requireKinds: ["metadata_changed", "bytes_changed"],
      forbidKinds: [...CONTENT_LOSS_KINDS],
    }),
    await expectVerdict({
      name: "empty body vs baseline is degraded content loss",
      before: baseline,
      after: emptyBody,
      expectedVerdict: "degraded",
      requireKinds: ["text_changed"],
    }),
    await expectVerdict({
      name: "mutated document body is degraded",
      before: baseline,
      after: mutatedBody,
      expectedVerdict: "degraded",
      requireKinds: ["text_changed"],
    }),
    await expectVerdict({
      name: "unreadable after bytes are unreadable, not intact",
      before: baseline,
      after: garbage,
      expectedVerdict: "unreadable",
    }),
    await expectRoundTripGate({
      name: "round-trip gate accepts metadata drift when packaging drift is allowed",
      before: baseline,
      after: metadataDrift,
      allowPackagingDrift: true,
      expectOk: true,
    }),
    await expectRoundTripGate({
      name: "round-trip gate rejects mutated body as content loss",
      before: baseline,
      after: mutatedBody,
      allowPackagingDrift: true,
      expectOk: false,
    }),
    await expectRoundTripGate({
      name: "round-trip gate rejects empty body as content loss even when drift allowed",
      before: baseline,
      after: emptyBody,
      allowPackagingDrift: true,
      expectOk: false,
    }),
    await expectBlindPair({
      name: "blind pair tells intact baseline from mutated body",
      before: baseline,
      intactAfter: baseline,
      degradedAfter: mutatedBody,
    }),
    await expectSilentEmptyBodyFails({
      name: "silent empty body fails content integrity when fragments expected",
      bytes: emptyBody,
      requiredFragments: ["Must not be silently dropped"],
    }),
    await expectMarkdownRoundTrip({
      name: "markdown round-trip preserves heading and paragraph text",
      markdown: [
        "# QA Vendor Portal",
        "",
        "Body paragraph kept through PDF save-back.",
        "",
        "- alpha item",
      ].join("\n"),
    }),
  ];

  const ok = cases.every((entry) => entry.ok);
  const lines = [
    "PDF fidelity QA",
    ...cases.map(
      (entry) =>
        `${entry.ok ? "PASS" : "FAIL"}  ${entry.name} → ${entry.detail}`,
    ),
    ok ? "All fidelity QA cases passed." : "Fidelity QA failed.",
  ];

  return { ok, cases, lines };
}

async function expectVerdict(input: {
  name: string;
  before: Uint8Array;
  after: Uint8Array;
  expectedVerdict: PdfFidelityVerdict;
  requireKinds?: readonly PdfFidelityDiffKind[];
  forbidKinds?: readonly PdfFidelityDiffKind[];
}): Promise<PdfFidelityQaCaseResult> {
  const report = await comparePdfPackages({
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
      isPdfFidelityDegraded({ report }));

  return {
    name: input.name,
    ok,
    expectedVerdict: input.expectedVerdict,
    report,
    detail: ok
      ? summarizePdfFidelityReport({ report })
      : `expected ${input.expectedVerdict}, got ${report.verdict}` +
        (missingRequired.length
          ? `; missing kinds ${missingRequired.join(",")}`
          : "") +
        (forbiddenPresent.length
          ? `; forbidden kinds ${forbiddenPresent.join(",")}`
          : ""),
  };
}

async function expectRoundTripGate(input: {
  name: string;
  before: Uint8Array;
  after: Uint8Array;
  allowPackagingDrift: boolean;
  expectOk: boolean;
}): Promise<PdfFidelityQaCaseResult> {
  const result = await assertPdfRoundTripFidelity({
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
      ? summarizePdfFidelityReport({ report: result.report })
      : `gate ${passed ? "ok" : "failed"} but expected ${
          input.expectOk ? "ok" : "failed"
        }: ${
          result.kind === "failed"
            ? result.message
            : summarizePdfFidelityReport({ report: result.report })
        }`,
  };
}

async function expectBlindPair(input: {
  name: string;
  before: Uint8Array;
  intactAfter: Uint8Array;
  degradedAfter: Uint8Array;
}): Promise<PdfFidelityQaCaseResult> {
  const intact = await comparePdfPackages({
    before: input.before,
    after: input.intactAfter,
  });
  const degraded = await comparePdfPackages({
    before: input.before,
    after: input.degradedAfter,
  });
  const ok =
    intact.verdict === "intact" &&
    degraded.verdict === "degraded" &&
    isPdfFidelityDegraded({ report: degraded });

  return {
    name: input.name,
    ok,
    expectedVerdict: "intact≠degraded",
    report: degraded,
    detail: ok
      ? `intact vs ${summarizePdfFidelityReport({ report: degraded })}`
      : `blind pair collapsed: intact=${intact.verdict}, other=${degraded.verdict}`,
  };
}

async function expectSilentEmptyBodyFails(input: {
  name: string;
  bytes: Uint8Array;
  requiredFragments: readonly string[];
}): Promise<PdfFidelityQaCaseResult> {
  const integrity = await assertPdfContentIntegrity({
    bytes: input.bytes,
    requiredFragments: input.requiredFragments,
  });
  const ok =
    integrity.verdict === "content_lost" &&
    integrity.emptyBody === true &&
    input.requiredFragments.every((fragment) =>
      integrity.missingFragments.includes(fragment),
    );

  return {
    name: input.name,
    ok,
    expectedVerdict: "content_lost",
    report: null,
    detail: ok
      ? summarizePdfContentIntegrityReport({ report: integrity })
      : `expected content_lost empty body, got ${integrity.verdict}` +
        ` emptyBody=${integrity.emptyBody}`,
  };
}

async function expectMarkdownRoundTrip(input: {
  name: string;
  markdown: string;
}): Promise<PdfFidelityQaCaseResult> {
  const trip = await evaluateMarkdownPdfRoundTrip({
    markdown: input.markdown,
  });
  const ok = trip.verdict === "content_preserved";

  return {
    name: input.name,
    ok,
    expectedVerdict: "content_preserved",
    report: trip.packageCompare,
    detail: ok
      ? summarizeMarkdownPdfRoundTripReport({ report: trip })
      : summarizeMarkdownPdfRoundTripReport({ report: trip }),
  };
}
