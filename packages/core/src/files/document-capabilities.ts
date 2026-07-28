import type { UserPlan } from "../types/plans.ts";

export type DocumentCapabilities = {
  editPlanevoDocuments: true;
  editTextDocuments: true;
  automaticIndexing: boolean;
  createCommentThreads: boolean;
  localMirror: boolean;
  pdfAnnotations: boolean;
};

const PAID_DOCUMENT_CAPABILITIES = {
  editPlanevoDocuments: true,
  editTextDocuments: true,
  automaticIndexing: true,
  createCommentThreads: true,
  localMirror: true,
  pdfAnnotations: true,
} as const satisfies DocumentCapabilities;

const DOCUMENT_CAPABILITIES_BY_PLAN = {
  free: {
    editPlanevoDocuments: true,
    editTextDocuments: true,
    automaticIndexing: false,
    createCommentThreads: false,
    localMirror: true,
    pdfAnnotations: false,
  },
  plus: PAID_DOCUMENT_CAPABILITIES,
  pro: PAID_DOCUMENT_CAPABILITIES,
} as const satisfies Record<UserPlan, DocumentCapabilities>;

const REVISION_RETENTION_DAYS_BY_PLAN = {
  free: 7,
  plus: 30,
  pro: 180,
} as const satisfies Record<UserPlan, number>;

export function documentCapabilitiesForPlan(
  plan: UserPlan,
): DocumentCapabilities {
  return { ...DOCUMENT_CAPABILITIES_BY_PLAN[plan] };
}

export function revisionRetentionDaysForPlan(plan: UserPlan): number {
  return REVISION_RETENTION_DAYS_BY_PLAN[plan];
}
