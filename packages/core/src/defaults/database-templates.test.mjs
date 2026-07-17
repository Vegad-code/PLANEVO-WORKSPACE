import assert from "node:assert/strict";
import { DATABASE_TEMPLATES } from "../defaults/database-templates.ts";

const templateTypes = ["task", "notes", "project", "files", "custom"];

for (const templateType of templateTypes) {
  const template = DATABASE_TEMPLATES[templateType];
  assert.equal(template.templateType, templateType);

  const primaryProperties = template.properties.filter((property) => property.isPrimary);
  assert.equal(primaryProperties.length, 1, `${templateType} must have one primary property`);
  assert.equal(primaryProperties[0]?.type, "text", `${templateType} primary must be text`);

  assert.ok(template.views.length >= 1, `${templateType} must have at least one view`);

  const defaultViews = template.views.filter((view) => view.isDefault);
  assert.ok(defaultViews.length >= 1, `${templateType} must have a default view`);

  const boardViews = template.views.filter((view) => view.type === "board");
  for (const board of boardViews) {
    assert.ok(board.config.groupByRole, `${templateType} board must group by role`);
  }
}

console.log("database-templates: ok");
