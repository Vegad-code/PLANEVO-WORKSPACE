import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("calendar page uses multi-calendar product chrome not DatabaseFace", () => {
  const source = read("app/(workspace)/calendar/page.tsx");
  assert.match(source, /CalendarProductPage/);
  assert.doesNotMatch(source, /DatabaseFace/);
  assert.doesNotMatch(source, /getCalendarFaceBundle/);
});

test("files page uses product view not DatabaseFace", () => {
  const source = read("app/(workspace)/files/page.tsx");
  assert.match(source, /FilesProductView/);
  assert.doesNotMatch(source, /DatabaseFace/);
  assert.doesNotMatch(source, /getFilesFaceBundle/);
});

test("ecosystem entry points route to product files", () => {
  const home = read("features/home/home-command-center.tsx");
  assert.match(home, /href="\/files"/);
  assert.doesNotMatch(home, /href="\/files\/new"/);

  const sidebar = read("features/shell/sidebar/sidebar-new-button.tsx");
  assert.match(sidebar, /href: "\/files"/);

  const legacyNew = read("app/(workspace)/files/new/page.tsx");
  assert.match(legacyNew, /redirect\("\/files"\)/);
});
