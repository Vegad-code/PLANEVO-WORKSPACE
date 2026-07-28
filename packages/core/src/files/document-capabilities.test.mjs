import assert from "node:assert/strict";
import test from "node:test";

import {
  documentCapabilitiesForPlan,
  revisionRetentionDaysForPlan,
} from "./document-capabilities.ts";

test("free keeps core editing available without paid document powers", () => {
  assert.deepEqual(documentCapabilitiesForPlan("free"), {
    editPlanevoDocuments: true,
    editTextDocuments: true,
    automaticIndexing: false,
    createCommentThreads: false,
    localMirror: true,
    pdfAnnotations: false,
  });
  assert.equal(revisionRetentionDaysForPlan("free"), 7);
});

test("plus unlocks document powers with 30-day history", () => {
  assert.deepEqual(documentCapabilitiesForPlan("plus"), {
    editPlanevoDocuments: true,
    editTextDocuments: true,
    automaticIndexing: true,
    createCommentThreads: true,
    localMirror: true,
    pdfAnnotations: true,
  });
  assert.equal(revisionRetentionDaysForPlan("plus"), 30);
});

test("pro keeps document powers with 180-day history", () => {
  assert.deepEqual(documentCapabilitiesForPlan("pro"), {
    editPlanevoDocuments: true,
    editTextDocuments: true,
    automaticIndexing: true,
    createCommentThreads: true,
    localMirror: true,
    pdfAnnotations: true,
  });
  assert.equal(revisionRetentionDaysForPlan("pro"), 180);
});
