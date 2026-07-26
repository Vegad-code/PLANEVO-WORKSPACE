# Natural-Language Capture Engine + Voice Dictation

**Date:** 2026-07-24  
**Status:** Design — awaiting founder review before implementation plan  
**Related:** [Calendar shortcuts & features research](./2026-07-24-calendar-shortcuts-features-research-design.md) (wishlist context only) · [Quick Capture Overlay](./2026-07-24-quick-capture-overlay-design.md) (UI shell)  
**Products:** Tasks (F-03), Calendar (F-04), Spotlight / quick capture (F-15)  
**Constraint:** Manual-first (`AGENTS.md`) — parse and preview; never silent create from speech or NLP.

---

## Goal

Ship a **shared Capture Engine** that turns natural language (typed or spoken) into a confirmable draft for events and tasks — reusable on:

- Web (now)
- Mac / Windows desktop (later, per PRD roadmap)
- Mobile (later)

Mic/STT is a **pluggable adapter**. The engine only ever sees **text**.

---

## Architecture

```
Platform shell (web / desktop / mobile)
  Mic UI → STT adapter → transcript text
                │
                ▼
packages/core — Capture Engine (shared, deterministic)
  parseCalendarCapture / parseQuickCapture → CaptureDraft
  + confidence · never writes DB
                │
                ▼
UI — preview card → user edits → confirm → product mutation
  create event (F-04) · create task (F-03) · schedule link
```

**Invariant:** Speech → text → parse → **preview** → confirm → create.  
No auto-save from dictation. No LLM required for V1 parse.

---

## Product framing

| Mode | User says / types | Result after confirm |
|------|-------------------|----------------------|
| **Event** | “Lunch with Dana Friday at 1pm” | `calendar_events` row |
| **Task** | “Physics homework Friday #school” | `tasks` row (existing F-15 path) |
| **Schedule task** | “Schedule wireframes tomorrow 2–3” | Event with `task_id` (continuity handshake) |

Tasks and Calendar stay separate products. The engine produces drafts; product mutations own writes.

---

## Capture Engine (shared core)

### Location

- Extend `packages/core/src/parsing/` next to existing `natural-capture.ts`
- New: `calendar-capture.ts` (or unified `capture-engine.ts` with mode discriminant)
- Keep **task** path: existing `parseQuickCapture` (deterministic, no LLM)
- Add **calendar** path: chrono-backed datetime extraction

### Draft types (conceptual)

```ts
type CaptureMode = "task" | "event" | "schedule-task"

type CaptureDraft = {
  mode: CaptureMode
  title: string
  // task
  dueAt?: string | null
  priority?: string | null
  // event / schedule
  startsAt?: string | null
  endsAt?: string | null
  allDay?: boolean
  // meta
  confidence: "high" | "medium" | "low"
  rawText: string
  warnings?: string[] // e.g. "assumed 1 hour duration"
}
```

### Parse rules (V1 — deterministic)

| Input cue | Behavior |
|-----------|----------|
| Relative dates | today, tomorrow, weekday names |
| Absolute | chrono-node (`Friday at 1pm`, `next Tue 3-4`) |
| Duration missing | default 1 hour (warn in preview) |
| No time | all-day or due-date only (mode-dependent) |
| Ambiguous | `confidence: low` → force edit before confirm |
| Title | leftover string after stripping date/time spans |

**Out of V1:** attendee resolution, location geocoding, recurrence NLP, LLM rewrite. Optional later if chrono fails.

### Open-source — parsing

| Library | License | Role |
|---------|---------|------|
| **[chrono-node](https://github.com/wanasit/chrono)** | MIT | Date/time/range parse (calendar path) |
| Existing `natural-capture.ts` | Planevo | Task quick capture (keep) |
| `date-fns` (already in app) | MIT | Normalize / format for preview |

Do **not** put Web Speech or Whisper inside `packages/core`.

---

## Speech-to-text port (platform adapters)

### Contract

```ts
interface SpeechToTextPort {
  /** Start capture; platform owns mic permission UX */
  start(): Promise<void>
  stop(): Promise<{ transcript: string; interim?: boolean }>
  /** Optional streaming for live caption in the bar */
  onPartial?(text: string): void
  cancel(): void
}
```

Engine never imports this. UI / shell injects an adapter and feeds `transcript` into the same text field as typing.

### Adapters by platform

| Platform | Adapter options | Preferred for Planevo |
|----------|-----------------|------------------------|
| **Web (now)** | Web Speech API · Groq/OpenAI Whisper API · transformers.js Whisper | **Whisper API** for quality; Web Speech as free fallback |
| **Mac desktop** | Apple Speech · Whisper.cpp native | Whisper.cpp or Apple Speech behind same port |
| **Windows desktop** | Whisper.cpp · Windows Speech | Whisper.cpp for parity with Mac |
| **Mobile** | Cloud Whisper · on-device Whisper | Cloud first; on-device when device class allows |

### Why not bake Web Speech into the engine

Chromium-biased, uneven Safari/Firefox, not available as the desktop/mobile story. Keep it as **one adapter**. The durable path is **Whisper-class STT** (API now, native/WASM later) behind `SpeechToTextPort`.

### Open-source / services — STT

| Tool | License / model | Use |
|------|-----------------|-----|
| **OpenAI Whisper API** / **Groq Whisper** | Hosted | Web + mobile V1 quality |
| **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** | MIT | Desktop native / optional mobile |
| **[transformers.js](https://github.com/huggingface/transformers.js)** | Apache-2.0 | Optional in-browser Whisper (privacy, heavy) |
| **Web Speech API** | Browser | Fallback adapter only |

Audio stays on-device until user finishes a utterance; transcript is editable before parse.

---

## UX (all platforms)

1. Open capture bar (`q` calendar · `⌘K` / F-15 global · mic from calendar/tasks)  
2. Type **or** hold mic → live transcript fills the bar  
3. Engine parses on idle / on stop  
4. Preview card: title, time range, mode (task vs event), confidence  
5. User edits fields if needed  
6. Confirm → mutation; Esc cancels  

**Voice-specific**

- Hold-to-talk (primary); tap-to-toggle optional on mobile  
- Partial captions while listening  
- “Didn’t catch that” + retry — never invent an event  
- Offline: typing always works; STT shows “voice needs network” if adapter is cloud-only  

Token-themed UI; no second accent; mic is calm chrome (not marigold sparkle).

---

## Platform rollout

| Phase | Surface | Ship |
|-------|---------|------|
| **P0** | Web | Typed NLP bar + chrono calendar parse + confirm |
| **P1** | Web | Mic → Whisper (or Groq) adapter → same bar |
| **P2** | Web | Web Speech fallback when no API key |
| **P3** | Desktop | Same engine; Whisper.cpp / OS Speech adapter |
| **P4** | Mobile | Same engine; record → Whisper adapter |

Desktop and mobile are **adapter + shell work**, not a second parser.

---

## Relation to existing code

| Existing | Role after this design |
|----------|------------------------|
| `packages/core/src/parsing/natural-capture.ts` | Keep for tasks; optionally share weekday helpers |
| Spotlight `parseQuickCapture` | Keep; calendar mode uses new parse |
| `schedule_task_idempotent` | Confirm path for “schedule task” drafts |
| Calendar create event actions | Confirm path for event drafts |

---

## Explicitly out of scope

- Merging Tasks and Calendar into one capture product  
- Silent create from voice without preview  
- LLM-only parsing as the only path  
- Auto-linking capture to workspace without toast consent (F-02)  
- Full offline local-first calendar (PRD V1 excludes local-first)  

---

## Testing

- Unit: chrono fixtures (“lunch Friday 1pm”, “tomorrow 9-10”, ambiguous “Friday”)  
- Unit: title leftover after date strip  
- Contract: STT adapter mock → draft → confirm calls create once  
- A11y: mic button labels; keyboard-only path without mic  

---

## Success criteria

1. Same draft shape on web today and desktop/mobile later  
2. Typed and spoken input share one bar and one parser  
3. User always confirms before write  
4. Swapping STT adapter requires zero changes to parse logic  

---

## Next step

After approval → **writing-plans** → `docs/superpowers/plans/2026-07-24-natural-language-capture-engine.md` (P0 parse + bar, then P1 Whisper adapter).
