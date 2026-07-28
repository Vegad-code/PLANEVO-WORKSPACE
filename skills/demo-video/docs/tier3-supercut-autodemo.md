# Tier 3: Supercut + auto_demo integration

Phase 3 pipelines add **launch-style AI polish** (Supercut) and **deterministic narrated demos** (auto_demo / `ui-demo-runner`). Both are optional vendors — the Planevo director imports them when `intent` maps to `launch` / `polished` (supercut) or `narrated` (auto_demo).

## When to use which

| Goal | Pipeline | Director intent | Offline? |
|------|----------|-----------------|----------|
| Cinematic launch trailer, spring zoom, music | `polish-supercut.mjs` | `launch`, `polished` | `record` + `render` yes; `generate` needs LLM |
| Scripted walkthrough + voiceover + captions | `narrate-autodemo.mjs` | `narrated` | Yes — mock voice without API keys |
| Fast PR capture | `capture-record-flow.mjs` | `recording` | Yes |

**Supercut** is best when you want a ≤60s launch film: AI picks money moments (with `generate`), or you hand a recipe for offline `record`/`render`.

**auto_demo** is best when the flow must be **checked in and replayable** after every UI change. The `.demo.json` is the source of truth; narration is muxed afterward.

Neither package is published to npm. Install from git into `.vendor/` (gitignored) or point env roots at an existing checkout.

## One-time vendor setup

### Supercut

```bash
git clone https://github.com/Co-Messi/supercut .vendor/supercut
cd .vendor/supercut
npm install && npm run build
npx playwright install chromium   # repo root already has playwright
# ffmpeg: brew install ffmpeg OR use repo ffmpeg-static on PATH
node dist/cli/index.js doctor
```

Optional env:

| Variable | Purpose |
|----------|---------|
| `SUPERCUT_ROOT` | Override vendor path (default `.vendor/supercut`) |
| `SUPERCUT_PROVIDER` | `deepseek`, `openrouter`, or `custom` |
| `DEEPSEEK_API_KEY` | DeepSeek text director |
| `OPENROUTER_API_KEY` | OpenRouter / vision models |
| `SUPERCUT_LLM_BASE_URL` + `SUPERCUT_MODEL` | Custom OpenAI-compatible endpoint |
| `SUPERCUT_FORCE_GENERATE=1` | Always run AI `generate` |
| `SUPERCUT_SKIP_GENERATE=1` | Force offline `record`/`render` |

### auto_demo (ui-demo-runner)

```bash
git clone https://github.com/wranngle/auto_demo .vendor/auto_demo
cd .vendor/auto_demo
npm install && npm run build
npx playwright install chromium
# ffmpeg + ffprobe required for narrate/vertical
```

Optional env:

| Variable | Purpose |
|----------|---------|
| `AUTO_DEMO_ROOT` / `UI_DEMO_RUNNER_ROOT` | Override vendor path |
| `ELEVENLABS_API_KEY` | Real TTS (falls back to deterministic mock tone) |

## Planevo flows

### Playwright module (full onboarding + task)

`flows/onboarding-create-task.mjs` — handles optional `/onboarding` gate **and** task creation. Use for raw `record-flow` capture.

### auto_demo JSON (tasks-only, narrated)

`flows/onboarding-create-task.demo.json` — equivalent **task-creation beat** for narrated demos. Starts at `/tasks` (assumes dev user already onboarded — typical with `PLANEVO_DEV_MODE` after first run).

**Why not full onboarding in JSON?** auto_demo has no conditional steps. `waitForText("What are you organizing?")` fails when the user is already past onboarding. For first-run onboarding on camera, keep using the `.mjs` flow or seed the dev user once before recording.

Companion files:

- `flows/onboarding-create-task.narration.txt` — `start | duration | text` cues for `narrate`
- `recipes/onboarding-create-task.recipe.json` — Supercut offline recipe (tasks create scene)

## CLI usage

App must be running (`npm run dev` → `http://localhost:3000`).

### Supercut polish

```bash
node skills/demo-video/pipelines/polish-supercut.mjs \
  --url http://localhost:3000 \
  --brief "show task creation speed" \
  --out artifacts/polished/onboarding-create-task-supercut.mp4
```

**Behavior:**

1. If an LLM key is configured → `supercut generate --url … --repo … --out …`
2. Else → patch `recipes/onboarding-create-task.recipe.json` to the live URL, then `record` + `render` (fully offline; brief is logged and ignored)

Force offline:

```bash
node skills/demo-video/pipelines/polish-supercut.mjs \
  --url http://localhost:3000 \
  --skip-generate \
  --out artifacts/polished/onboarding-create-task-supercut.mp4
```

### Narrated auto_demo

```bash
node skills/demo-video/pipelines/narrate-autodemo.mjs \
  --flow skills/demo-video/flows/onboarding-create-task.demo.json \
  --out artifacts/polished/onboarding-create-task-narrated.mp4
```

**Behavior:**

1. `auto_demo run` → `recording.webm` + manifest under a temp dir
2. `auto_demo narrate` → MP4 with mock sine-tone VO (no key) or ElevenLabs (with `ELEVENLABS_API_KEY`)

Optional vertical export:

```bash
node skills/demo-video/pipelines/narrate-autodemo.mjs \
  --flow skills/demo-video/flows/onboarding-create-task.demo.json \
  --out artifacts/polished/onboarding-create-task-narrated.mp4 \
  --vertical
```

## Director integration

Both pipelines export async functions for dynamic import:

```js
import { runSupercut } from "../pipelines/polish-supercut.mjs";
import { runNarrated } from "../pipelines/narrate-autodemo.mjs";

await runSupercut({
  url: plan.url,
  brief: plan.brief,
  out: plan.polishedOut,
});

await runNarrated({
  flow: path.join(SKILL_ROOT, "flows", `${plan.screen}.demo.json`),
  out: plan.out,
  url: plan.url,
});
```

Missing vendor checkouts throw with install instructions (no silent fallback).

## Fallbacks

| Missing | Behavior |
|---------|----------|
| `.vendor/supercut` | `runSupercut` throws setup hint |
| LLM keys | Supercut uses offline recipe `record`/`render` |
| `.vendor/auto_demo` | `runNarrated` throws setup hint |
| `ELEVENLABS_API_KEY` | auto_demo `narrate --voice mock` (deterministic tone) |
| `ffmpeg` | Supercut `render` / auto_demo `narrate` fail — install ffmpeg or ensure `ffmpeg-static` is on PATH |

Planevo `decision-matrix.mjs` already maps `narrated` → `auto_demo` with `record-flow` as capture fallback when the vendor is absent.

## Verification status (this repo)

| Check | Status |
|-------|--------|
| Pipeline modules load (`import`) | Verified |
| CLI arg parsing / help errors | Verified |
| Vendor CLIs without `.vendor/*` | Expected clear error with setup doc |
| End-to-end supercut/auto_demo render | Requires one-time vendor clone + running dev server |

To smoke-test after vendor install:

```bash
npm run dev   # separate terminal
node skills/demo-video/pipelines/narrate-autodemo.mjs \
  --flow skills/demo-video/flows/onboarding-create-task.demo.json \
  --out artifacts/polished/smoke-narrated.mp4
```

## npm dependencies

Neither **supercut** nor **ui-demo-runner** is on the public npm registry. This repo does **not** add them as `devDependencies`; use the git clone paths above. Existing repo deps used by all tiers: `playwright`, `ffmpeg-static`.
