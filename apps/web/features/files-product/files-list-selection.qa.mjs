/**
 * Browser smoke for Files list: portaled row menu + checkbox multi-select.
 *
 * Checkboxes are hover/selection-reveal (not always visible). QA moves the
 * pointer away to assert rest opacity, then hovers before checking.
 *
 * Requires a running app: `npm run dev` then
 * `node apps/web/features/files-product/files-list-selection.qa.mjs`
 *
 * Not part of `npm test` (needs Chromium + localhost). Exit 0 on pass.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PLANEVO_QA_BASE ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "tmp/files-menu-qa");

function menuAnchoredNearTrigger(menuBox, triggerBox) {
  if (!menuBox || !triggerBox) return false;
  const rightAligned =
    Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width)) < 96;
  const below =
    Math.abs(menuBox.y - (triggerBox.y + triggerBox.height)) < 140;
  // Flip-up: menu sits above the trigger (bottom near trigger top).
  const above =
    Math.abs(menuBox.y + menuBox.height - triggerBox.y) < 140;
  return rightAligned && (below || above);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const report = { ok: false, checks: {}, errors: [] };

  try {
    await page.goto(`${BASE}/files`, { waitUntil: "networkidle", timeout: 60000 });

    const table = page.locator('[data-product="files"] table[aria-label="Files"]');
    await table.waitFor({ timeout: 30000 });

    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();
    report.checks.rowCount = rowCount;
    if (rowCount < 3) {
      report.errors.push("Need at least 3 file rows for selection QA");
      return;
    }

    // --- Checkbox visibility at rest (hover-reveal, not always-on) ---
    const selectAll = table.locator(
      'thead input[type="checkbox"][aria-label="Select all visible files"]',
    );
    const firstRowCheckbox = rows.nth(0).locator('input[type="checkbox"]');
    // Move pointer away so no row/header hover reveals checkboxes.
    await page.mouse.move(8, 8);
    await page.waitForTimeout(80);
    const restOpacity = await Promise.all([
      selectAll.evaluate((el) => getComputedStyle(el).opacity),
      firstRowCheckbox.evaluate((el) => getComputedStyle(el).opacity),
    ]);
    report.checks.checkboxesHiddenAtRest =
      Number(restOpacity[0]) < 0.05 && Number(restOpacity[1]) < 0.05;

    // --- Header select-all checkbox (hover to reveal, then check) ---
    await table.locator("thead").hover();
    await page.waitForTimeout(60);
    await selectAll.check({ force: true });
    await page.waitForTimeout(120);
    const allSelected = await table.locator('tr[aria-selected="true"]').count();
    report.checks.selectAllChecksAll = allSelected === rowCount;

    const toolbar = page.locator('[role="toolbar"][aria-label="Selected files"]');
    report.checks.selectAllShowsToolbar = await toolbar.isVisible();

    await selectAll.uncheck();
    await page.waitForTimeout(120);
    report.checks.selectAllClears =
      (await table.locator('tr[aria-selected="true"]').count()) === 0;

    // --- Per-row checkboxes drive selection (not row click) ---
    // Hover reveals the target row checkbox; once any selection is active,
    // all checkboxes stay visible (selection mode).
    const pick = [0, 1, 2];
    for (const idx of pick) {
      await rows.nth(idx).hover();
      await page.waitForTimeout(40);
      await rows.nth(idx).locator('input[type="checkbox"]').check({ force: true });
      await page.waitForTimeout(60);
    }
    const selectedCount = await table.locator('tr[aria-selected="true"]').count();
    const toolbarVisible = await toolbar.isVisible();
    const toolbarText = toolbarVisible ? await toolbar.innerText() : "";

    report.checks.selectedCount = selectedCount;
    report.checks.toolbarVisible = toolbarVisible;
    report.checks.toolbarHasDownload = /Download/i.test(toolbarText);
    report.checks.toolbarHasAttach = /Attach to task/i.test(toolbarText);
    report.checks.toolbarHasMove = /Move to folder/i.test(toolbarText);
    report.checks.toolbarHasLink = /Link to event/i.test(toolbarText);
    report.checks.toolbarHasDelete = /Delete/i.test(toolbarText);

    // Selection mode: all checkboxes stay visible even without hover
    // (including unselected rows when any selection is active).
    await page.mouse.move(8, 8);
    await page.waitForTimeout(80);
    const unselectedRow = table.locator('tbody tr:not([aria-selected="true"])').first();
    const hasUnselected = (await unselectedRow.count()) > 0;
    const activeOpacity = await Promise.all([
      selectAll.evaluate((el) => getComputedStyle(el).opacity),
      firstRowCheckbox.evaluate((el) => getComputedStyle(el).opacity),
      hasUnselected
        ? unselectedRow
            .locator('input[type="checkbox"]')
            .evaluate((el) => getComputedStyle(el).opacity)
        : Promise.resolve("1"),
    ]);
    report.checks.checkboxesVisibleWhileSelected =
      Number(activeOpacity[0]) > 0.95 &&
      Number(activeOpacity[1]) > 0.95 &&
      Number(activeOpacity[2]) > 0.95;

    // Partial selection → header indeterminate
    report.checks.headerIndeterminate = await selectAll.evaluate(
      (el) => el.indeterminate === true,
    );

    // Bulk Delete opens confirm dialog
    if (toolbarVisible) {
      await toolbar.getByRole("button", { name: "Delete" }).click();
      await page.waitForTimeout(200);
      const deleteDialog = page.locator("#delete-files-title");
      report.checks.bulkDeleteConfirm = await deleteDialog
        .isVisible()
        .catch(() => false);
      if (report.checks.bulkDeleteConfirm) {
        await page.getByRole("button", { name: "Cancel" }).click();
        await page.waitForTimeout(120);
      }
    }

    await page.screenshot({
      path: path.join(OUT_DIR, "multi-select-toolbar.png"),
      fullPage: false,
    });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    report.checks.escapeClears =
      (await table.locator('tr[aria-selected="true"]').count()) === 0;

    // --- Row click opens file (does not toggle selection) ---
    await page.goto(`${BASE}/files`, { waitUntil: "networkidle", timeout: 60000 });
    await table.waitFor({ timeout: 30000 });
    const openRow = table.locator("tbody tr").nth(1);
    const selectedBeforeClick = await openRow.getAttribute("aria-selected");
    await openRow.click({ position: { x: 120, y: 20 } });
    try {
      await page.waitForURL(/[?&]file=/, { timeout: 5000 });
      report.checks.rowClickSetsFileParam = true;
    } catch {
      report.checks.rowClickSetsFileParam = Boolean(
        new URL(page.url()).searchParams.get("file"),
      );
    }
    report.checks.rowClickDoesNotSelect =
      (await openRow.getAttribute("aria-selected")) === selectedBeforeClick ||
      (await openRow.getAttribute("aria-selected")) !== "true" ||
      selectedBeforeClick === "true";
    // Stronger: after a clean navigate, row click should leave aria-selected false
    // unless the checkbox was used — re-check from a fresh load below.

    await page.goto(`${BASE}/files`, { waitUntil: "networkidle", timeout: 60000 });
    await table.waitFor({ timeout: 30000 });
    await page.waitForTimeout(200);
    const freshRow = table.locator("tbody tr").nth(1);
    await freshRow.click({ position: { x: 120, y: 20 } });
    await page.waitForTimeout(200);
    report.checks.rowClickKeepsUnselected =
      (await freshRow.getAttribute("aria-selected")) !== "true";
    report.checks.rowClickUrl = page.url();

    // --- Row menu portal / collision on last row ---
    await page.goto(`${BASE}/files`, { waitUntil: "networkidle", timeout: 60000 });
    await table.waitFor({ timeout: 30000 });
    const scrollContainer = page
      .locator('[data-product="files"] .overflow-y-auto')
      .first();
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    const lastRow = rows.nth(rowCount - 1);
    const trigger = lastRow.locator('button[aria-label^="Actions for"]');
    await trigger.scrollIntoViewIfNeeded();
    const scrollBefore = await scrollContainer.evaluate((el) => el.scrollTop);
    await trigger.click();
    await page.waitForTimeout(200);

    const menu = page.locator('[role="menu"]').last();
    await menu.waitFor({ state: "visible", timeout: 5000 });

    const scrollAfter = await scrollContainer.evaluate((el) => el.scrollTop);
    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    const viewport = page.viewportSize();

    const menuInPortal = await page.evaluate(() => {
      const menuEl = document.querySelector('[role="menu"]');
      if (!menuEl) return null;
      const scrollParent = document.querySelector(
        '[data-product="files"] .overflow-y-auto',
      );
      return {
        menuParentTag: menuEl.parentElement?.tagName ?? null,
        menuInScrollParent: scrollParent?.contains(menuEl) ?? null,
        menuDataRadix: menuEl.getAttribute("data-radix-menu-content") !== null,
      };
    });

    const menuFullyVisible =
      !!menuBox &&
      !!viewport &&
      menuBox.y >= 0 &&
      menuBox.y + menuBox.height <= viewport.height &&
      menuBox.x >= 0 &&
      menuBox.x + menuBox.width <= viewport.width;

    report.checks.menuPortal = menuInPortal;
    report.checks.scrollUnchanged = Math.abs(scrollAfter - scrollBefore) < 2;
    report.checks.menuFullyVisible = menuFullyVisible;
    report.checks.menuNearTrigger = menuAnchoredNearTrigger(menuBox, triggerBox);
    report.checks.noGridRole = (await table.getAttribute("role")) !== "grid";

    await page.screenshot({
      path: path.join(OUT_DIR, "row-menu-last-row.png"),
      fullPage: false,
    });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    // --- Enter still opens ---
    await page.goto(`${BASE}/files`, { waitUntil: "networkidle", timeout: 60000 });
    await table.waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    const enterRow = table.locator("tbody tr").nth(2);
    await enterRow.focus();
    await page.keyboard.press("Enter");
    try {
      await page.waitForURL(/[?&]file=/, { timeout: 5000 });
      report.checks.enterOpensFile = true;
    } catch {
      report.checks.enterOpensFile = Boolean(
        new URL(page.url()).searchParams.get("file"),
      );
    }
    report.checks.enterUrl = page.url();

    report.ok =
      report.checks.checkboxesHiddenAtRest === true &&
      report.checks.checkboxesVisibleWhileSelected === true &&
      report.checks.selectAllChecksAll === true &&
      report.checks.selectAllShowsToolbar === true &&
      report.checks.selectAllClears === true &&
      selectedCount === pick.length &&
      toolbarVisible &&
      report.checks.toolbarHasDownload &&
      report.checks.toolbarHasAttach &&
      report.checks.toolbarHasMove &&
      report.checks.toolbarHasLink &&
      report.checks.headerIndeterminate === true &&
      report.checks.bulkDeleteConfirm === true &&
      report.checks.escapeClears === true &&
      report.checks.rowClickSetsFileParam === true &&
      report.checks.rowClickKeepsUnselected === true &&
      menuInPortal?.menuInScrollParent === false &&
      report.checks.scrollUnchanged === true &&
      report.checks.menuFullyVisible === true &&
      report.checks.menuNearTrigger === true &&
      report.checks.noGridRole === true &&
      report.checks.enterOpensFile === true;
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    await page
      .screenshot({ path: path.join(OUT_DIR, "error.png") })
      .catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();
