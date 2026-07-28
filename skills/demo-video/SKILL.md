---
name: demo-video
description: Use when you need to produce a screen-recording / demo video of a web UI flow (feature walkthrough, PR artifact, bug repro) that works from both Cursor Cloud agents and the desktop IDE agent
---

# Demo Video (portable web-UI recording)

## Director (unified router)

For intent-aware production (polished, launch, social, narrated), use the **director**
instead of calling `record-flow.mjs` directly:

```bash
node skills/demo-video/pipelines/director.mjs \
  --screen onboarding-create-task \
  --intent polished \
  --out artifacts/final/onboarding-create-task.mp4
```

Plans live at `skills/demo-video/plans/` (schema in `plans/schema.json`). The Cursor
skill with the full decision matrix and workflow lives at
`.cursor/skills/demo-video/SKILL.md`.

## Overview

Record a real browser walking through an app flow and save it as a video artifact —
the kind of walkthrough you attach to a PR. The **portable** path is Playwright with
`recordVideo`: just Node + a Chromium download, driven from the terminal, so it runs
identically in Cursor Cloud and the desktop IDE. Cloud agents also have a native
shortcut (`RecordScreen` + `computerUse`); use it only when those tools exist.

## When to use

- Demonstrating a UI feature/fix end-to-end for a PR or for the user.
- Reproducing a UI bug as a video.
- You want a deterministic, re-runnable recording (scripted, not hand-driven).

When NOT to use: pure backend/CLI changes (use logs/test output); a single static
screenshot suffices (just screenshot the page).

## Which path

- **Portable (default, works everywhere):** Playwright `record-flow.mjs` + a flow file.
- **Cloud-only shortcut:** `RecordScreen(START)` → drive with the `computerUse` subagent
  → `RecordScreen(SAVE)`. Higher fidelity cursor motion, but not available in the IDE and
  non-deterministic. Prefer the portable path so the same skill works in both places.

## Quick reference (portable path)

One-time per machine (Chromium + its OS libs):
```bash
npm install -D playwright              # already in this repo's devDependencies
sudo env "PATH=$PATH" node_modules/.bin/playwright install-deps chromium
npx playwright install chromium
```

Record a flow (app must already be running, e.g. `npm run dev` on :3000):
```bash
node skills/demo-video/record-flow.mjs \
  --flow skills/demo-video/flows/onboarding-create-task.mjs \
  --url  http://localhost:3000 \
  --out  artifacts/my-demo.mp4      # .mp4 → transcoded via ffmpeg; else .webm
```

Then reference it in your answer / PR body: `<video src="artifacts/my-demo.mp4" controls></video>`.

## Writing your own flow

A flow is a module that default-exports `async (page, ctx) => {}` where
`ctx = { baseUrl }`. Drive `page` with normal Playwright calls. Copy
`flows/onboarding-create-task.mjs` as a starting point. The harness owns the browser,
viewport, video capture, and WebM→MP4 transcode — you only script the interaction.

## Common mistakes (learned building this)

| Symptom | Cause | Fix |
|---|---|---|
| Action clicks the wrong control (e.g. a Close/"X" button) | `getByRole("button",{name:/create task/i})` also matches an `aria-label="Close create task"` | Target precisely: `locator('button[type="submit"]')`, `getByRole(...).nth()`, or scope to the dialog |
| Click "intercepted by dialog" / hits background | A page button stays in the DOM behind an open modal and matches first | Scope locators to the modal: `const d = page.getByRole("dialog")` then query inside `d` |
| Form submits but nothing persists | `fill()` set the value but you clicked the wrong button, or the input has no accessible name so `{name:/title/}` matched nothing | Use the first textbox in the dialog; verify persistence (DB/API) not just that the modal closed |
| Video is blank / missing | Video is only finalized on `context.close()` | Always `await context.close()` before reading `page.video().path()` (the harness does this) |
| Modal/typing flashes by too fast to see | `fill()` is instant | `pressSequentially(text,{delay:45})` and add short `waitForTimeout` pauses on key states |
| Created item not visible in final frame | It rendered below the fold | `await locator.scrollIntoViewIfNeeded()` then hold ~2s before the flow ends |

## Notes

- Video recording works headless — no display/X server needed.
- Output is WebM natively; the harness transcodes to MP4 when ffmpeg is on PATH
  or when `ffmpeg-static` is installed (`npm install` at repo root). MP4 plays
  inline in PR/GitHub; WebM is the fallback.
- Make each run deterministic and idempotent (unique titles, reset/seed as needed) so
  the recording is repeatable.
