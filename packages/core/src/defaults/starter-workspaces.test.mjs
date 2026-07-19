import assert from "node:assert/strict";
import {
  buildStarterSeedPayload,
  buildWorkspaceName,
  getStarterWorkspaceConfig,
  isOrganizingAnswer,
  ORGANIZING_ANSWERS,
} from "./starter-workspaces.ts";
import { buildGettingStartedContent } from "./getting-started-content.ts";

assert.equal(isOrganizingAnswer("school"), true);
assert.equal(isOrganizingAnswer("hobby"), false);

for (const answer of ORGANIZING_ANSWERS) {
  const config = getStarterWorkspaceConfig(answer);
  assert.equal(config.organizing, answer);
  assert.ok(config.taskStatusOptions.length >= 3);
  assert.ok(config.defaultStatusName);
  assert.ok(config.doneStatusName);
}

assert.equal(
  buildWorkspaceName("Anthony Jabbour", "school"),
  "Anthony's School Workspace",
);
assert.equal(buildWorkspaceName(null, "other"), "My Workspace");
assert.equal(buildWorkspaceName("  Ada  Lovelace", "work"), "Ada's Work Workspace");

const payload = buildStarterSeedPayload("school", "Sam");
assert.equal(payload.workspaceName, "Sam's School Workspace");
assert.equal(payload.gettingStarted.title, "Getting Started");
assert.equal(payload.notes.title, "Notes");
assert.ok(Array.isArray(payload.gettingStarted.content));
assert.ok(payload.gettingStarted.content.length >= 5);

// F-45: seed is pages/checklist only — no product-database keys or payloads.
assert.equal("taskDatabase" in payload, false);
assert.equal("calendarDatabase" in payload, false);
assert.equal("filesDatabase" in payload, false);
assert.equal("taskTemplate" in payload, false);
assert.equal("calendarTemplate" in payload, false);
assert.equal("filesTemplate" in payload, false);
assert.equal("onboardingTasks" in payload, false);
assert.deepEqual(Object.keys(payload).sort(), [
  "gettingStarted",
  "notes",
  "organizing",
  "workspaceIcon",
  "workspaceName",
]);

const payloadJson = JSON.stringify(payload);
for (const templateType of ["task", "calendar", "files"]) {
  assert.equal(
    payloadJson.includes(`"templateType":"${templateType}"`),
    false,
    `seed payload must not carry a template_type "${templateType}" entry`,
  );
}

const content = buildGettingStartedContent();
const checked = content.filter(
  (block) =>
    block &&
    typeof block === "object" &&
    block.type === "checkListItem" &&
    block.props?.checked === true,
);
assert.equal(checked.length, 1);

console.log("starter-workspaces: ok");
