# Demo Video Plans

JSON briefs consumed by the demo-video **director** (`pipelines/director.mjs`). A plan
names the screen, declares intent, and optionally overrides capture/compose pipelines.

Schema: [`schema.json`](./schema.json)

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `screen` | yes | Flow slug → `skills/demo-video/flows/<screen>.mjs` |
| `intent` | yes | `recording` · `polished` · `launch` · `social` · `narrated` |
| `audience` | no | Who the video is for |
| `platform` | no | `landscape` (default) · `vertical` · `square` |
| `duration` | no | Target length in seconds |
| `capture` | no | Override: `record-flow` · `clipwise` · `demowright` · `auto_demo` |
| `compose` | no | Override: `none` · `remotion` |
| `composition` | no | Remotion composition name (e.g. `LaunchVideo`) |
| `music` | no | Include background music |
| `voiceover` | no | Include generated narration |
| `captions` | no | Caption lines or `["auto"]` |
| `url` | no | App base URL (default `http://localhost:3000`) |
| `out` | no | Final artifact path |

When `capture` / `compose` are omitted, the director applies the intent decision matrix.

## Example plan

Save as `skills/demo-video/plans/onboarding-create-task.json`:

```json
{
  "screen": "onboarding-create-task",
  "intent": "polished",
  "audience": "new users evaluating Tasks",
  "platform": "landscape",
  "duration": 45,
  "music": false,
  "voiceover": false,
  "captions": [],
  "url": "http://localhost:3000",
  "out": "artifacts/final/onboarding-create-task.mp4"
}
```

Run:

```bash
node skills/demo-video/pipelines/director.mjs \
  --plan skills/demo-video/plans/onboarding-create-task.json
```

Or pass flags directly (no plan file):

```bash
node skills/demo-video/pipelines/director.mjs \
  --screen onboarding-create-task \
  --intent polished \
  --brief "polished marketing walkthrough for new users" \
  --out artifacts/final/onboarding-create-task.mp4
```

## Artifact layout

The director writes intermediate and final outputs under:

- `artifacts/raw/<screen>.mp4` — Playwright record-flow capture
- `artifacts/polished/<screen>.mp4` — clipwise-polished capture (when available)
- `artifacts/final/<screen>.mp4` — composed or promoted final deliverable
