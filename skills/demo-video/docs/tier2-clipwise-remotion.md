# Tier 2 — Clipwise capture + Remotion compose

Integration notes for Agent 1 to merge into `.cursor/skills/demo-video/SKILL.md`.

## Overview

| Tier | Pipeline | Input | Output |
|------|----------|-------|--------|
| 1 (raw) | `record-flow.mjs` | `.mjs` flow | `artifacts/raw/*.mp4` |
| 2 (polished) | `capture-clipwise.mjs` | `.yaml` scenario | `artifacts/polished/*.mp4` |
| 2 (marketing) | `compose-remotion.mjs` | polished mp4 + props | `artifacts/final/*.mp4` |

The director (`pipelines/director.mjs`) already routes `clipwise` → `remotion` via dynamic imports of `runCapture` / `runCompose`.

## Dependencies (root `package.json`)

```bash
npm install -D clipwise remotion @remotion/cli @remotion/player
npx playwright install chromium
```

`ffmpeg` (or `ffmpeg-static` at repo root) is required for Clipwise MP4 output.

## Clipwise scenarios

- Location: `skills/demo-video/scenarios/<screen>.yaml`
- Reference: `onboarding-create-task.yaml` mirrors `flows/onboarding-create-task.mjs`
- Onboarding is optional: a `waitForFunction` step clicks the first organizing card only when `/onboarding` is shown (same resilience as the Playwright flow).

### Capture CLI

```bash
node skills/demo-video/pipelines/capture-clipwise.mjs \
  --scenario scenarios/onboarding-create-task.yaml \
  --out artifacts/polished/onboarding-create-task.mp4 \
  --url http://localhost:3000
```

### Programmatic API

```js
import { runCapture } from "./pipelines/capture-clipwise.mjs";

await runCapture({
  scenario: "scenarios/onboarding-create-task.yaml",
  out: "artifacts/polished/onboarding-create-task.mp4",
  url: "http://localhost:3000",
});
```

Director passes `plan.screen` → auto-resolves `scenarios/${screen}.yaml` and `plan.polishedOut`.

### Clipwise gotchas

1. **CSS selectors only** — no Playwright `getByRole`. Use attribute selectors (`[role="dialog"]`, `button[type="submit"]`). Scope modal actions to `[role="dialog"]` so background buttons are not hit.
2. **Static task titles** — YAML `type` text is fixed; unlike the `.mjs` flow there is no `Math.random()` suffix. Use a distinctive string and `waitForFunction` to confirm it appears.
3. **Programmatic API** — `clipwise` exports `loadScenario`, `ClipwiseRecorder`, `CanvasRenderer`, `ConcurrentSession`, `encodeMp4`. `capture-clipwise.mjs` uses the concurrent path when `renderer.canStreamOnline()` is true (MP4 + effects).
4. **URL override** — `runCapture` patches `http://localhost:3000` navigate URLs when `--url` is passed.
5. **ffmpeg** — Clipwise MP4 encode shells out to `ffmpeg` on PATH. `capture-clipwise.mjs` prepends `node_modules/ffmpeg-static` when present.
6. **Create task button** — `button[aria-haspopup="dialog"]` matches many controls on `/tasks`; use a `waitForFunction` that finds the button whose text matches `/create task/i`.
7. **Native `<dialog>`** — Planevo uses `<dialog open>` not `[role="dialog"]`; scope inputs with `dialog[open] input[maxlength="500"]`.

## Remotion compositions

- Project root: `skills/demo-video/remotion/`
- Entry: `src/index.ts` → `Root.tsx` registers `LaunchVideo` and `SocialReel`
- Tokens: `src/tokens.css` mirrors Planevo `@theme` names (`--color-paper`, `--color-ink`, `--color-marigold`, etc.)

| Composition | Size | Structure |
|-------------|------|-----------|
| `LaunchVideo` | 1280×720 | Intro title card → demo slot → CTA outro |
| `SocialReel` | 1080×1920 (9:16) | Full-bleed demo + caption pills + CTA |

### Props (both compositions)

| Prop | Type | Description |
|------|------|-------------|
| `demoSrc` | string | `file://` URL to polished/raw mp4 (set by compose wrapper) |
| `title` | string | Headline on intro / fallback caption |
| `cta` | string | Outro call-to-action |
| `captions` | string[] | SocialReel caption rotation (`LaunchVideo` accepts but does not require) |

### Compose CLI

```bash
node skills/demo-video/pipelines/compose-remotion.mjs \
  --composition LaunchVideo \
  --demo artifacts/polished/onboarding-create-task.mp4 \
  --title "Create tasks in seconds" \
  --cta "Try Planevo" \
  --out artifacts/final/onboarding-create-task-launch.mp4
```

Social reel with captions (`|` delimiter):

```bash
node skills/demo-video/pipelines/compose-remotion.mjs \
  --composition SocialReel \
  --demo artifacts/polished/onboarding-create-task.mp4 \
  --title "Create tasks in seconds" \
  --captions "Organize your work|Tasks in seconds|Try Planevo" \
  --cta "planevo.com" \
  --out artifacts/final/onboarding-create-task-reel.mp4
```

### Remotion gotchas

1. **Demo path** — `compose-remotion.mjs` copies footage into `remotion/public/` and passes the basename; compositions resolve via `staticFile()`. Absolute paths and `file://` URLs fail during render.
2. **tsconfig** — `skills/demo-video/remotion/tsconfig.json` is required for `remotion render`.
3. **Duration** — compositions use fixed frame budgets (`LaunchVideo` ≈ 8.5s at 30fps for a short test). Extend `DEMO_FRAMES` in `Root.tsx` for longer footage.
4. **CWD** — render runs with `cwd: skills/demo-video/remotion`; deps resolve from repo root `node_modules`.
5. **One marigold accent** — intro underline + CTA button use `--color-marigold` only on outro/intro accents per Planevo design law.
6. **First render** — Remotion downloads Chrome Headless Shell (~94 MB) on first compose.

## Suggested director intents

| Intent | capture | compose | composition |
|--------|---------|---------|-------------|
| `polished` | clipwise | none | — |
| `launch` | clipwise | remotion | LaunchVideo |
| `social` | clipwise | remotion | SocialReel |

## Verification checklist

1. App on `:3000` (`npm run dev`)
2. `node skills/demo-video/pipelines/capture-clipwise.mjs --scenario scenarios/onboarding-create-task.yaml --out artifacts/polished/onboarding-create-task.mp4`
3. `node skills/demo-video/pipelines/compose-remotion.mjs --composition LaunchVideo --demo artifacts/polished/onboarding-create-task.mp4 --title "Create tasks in seconds" --out artifacts/final/onboarding-create-task-launch.mp4`
4. Confirm artifact sizes under `artifacts/polished/` and `artifacts/final/`.
