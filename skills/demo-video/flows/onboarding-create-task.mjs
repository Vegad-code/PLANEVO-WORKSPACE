/**
 * Example flow: first-run onboarding (if shown) → Tasks → create a task.
 * This is the reference demo. Copy it to author your own flow; the harness
 * (record-flow.mjs) handles the browser + video, you just drive the page.
 *
 * Resilient by design: it completes onboarding only if the app redirects there,
 * so it works whether or not the dev user has already been onboarded.
 */
export default async function onboardingCreateTask(page, { baseUrl }) {
  const title = `Hello world from Cursor Cloud demo ${Math.floor(Math.random() * 1000)}`;

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  // Onboarding gate: pick the first organizing card if we landed there.
  if (page.url().includes("/onboarding")) {
    await page.waitForTimeout(1200); // let the reviewer see the question
    const firstCard = page.getByRole("button").first();
    await firstCard.click();
    // Seeding redirects to a getting-started page; wait for it to settle.
    await page.waitForURL((url) => !url.pathname.startsWith("/onboarding"), {
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }

  // Go to the Tasks product.
  await page.goto(`${baseUrl}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Open the create-task affordance. Try the labelled button, then common fallbacks.
  const createButton = page
    .getByRole("button", { name: /create task|new task|add task/i })
    .first();
  await createButton.click({ timeout: 15_000 });

  // Scope everything else to the dialog — the page's own "+ Create task" button
  // stays in the DOM behind the modal and would otherwise intercept the submit click.
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800); // let the modal be visible in the recording

  // The title input has no accessible label — it is the first textbox in the dialog.
  const titleField = dialog.getByRole("textbox").first();
  await titleField.waitFor({ state: "visible", timeout: 10_000 });
  // Type character-by-character so the recording shows real typing (fill() is instant).
  await titleField.pressSequentially(title, { delay: 45 });
  await page.waitForTimeout(600);

  // Submit by type — the header's "Close create task" button also matches a
  // /create task/i name, so target the actual submit control. It stays disabled
  // until the title is filled; click() auto-waits for it to become enabled.
  const submit = dialog.locator('button[type="submit"]');
  await submit.click();

  // Confirm the new task shows up, scroll it into view, and hold on it so the
  // final frames clearly show the created task.
  const created = page.getByText(title, { exact: false }).first();
  await created.waitFor({ state: "visible", timeout: 15_000 });
  await created.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
}
