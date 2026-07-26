# Quick Capture Overlay

**Date:** 2026-07-24  
**Status:** Design — short; awaiting approval before plan  
**Depends on:** [Natural-language Capture Engine](./2026-07-24-natural-language-capture-engine-design.md)  
**Related:** [Calendar shortcuts research](./2026-07-24-calendar-shortcuts-features-research-design.md)  
**Constraint:** Manual-first — preview then Confirm; AI polish optional, never silent write. One accent max. Craft may reference glass overlays; IA stays Planevo (not a cloned widget).

---

## Goal

A floating capture panel so users can quickly create a **note, task, or event** by typing or speaking — keyboard-first — without navigating away from what they’re doing.

| Surface | When it works |
|---------|----------------|
| **Web (now)** | Planevo tab (or PWA) focused |
| **Desktop (later)** | OS-wide hotkey even outside Planevo |

Same UI pattern and Capture Engine. Different shell for global hotkey.

---

## User flow

1. Open overlay (`⌘K` capture mode · `q` on calendar · later: global desktop hotkey)  
2. Type **or** hold mic → transcript fills the field  
3. Engine parses → **preview draft** (title, time/due, type)  
4. Edit if needed  
5. **Enter** confirms → write to product  
6. **Esc** dismisses; focus returns  

Optional second step: **Ask follow-up** / polish (AI) → new preview → Enter again.

---

## Modes

| Mode | Confirm writes |
|------|----------------|
| **Task** | `tasks` (F-03) |
| **Event** | `calendar_events` (F-04) |
| **Note** | Workspace page or Files doc (pick one owner at plan time; no new kernel table) |
| **Schedule task** | Event + `task_id` (continuity handshake) |

Default mode from context (Calendar → event; Tasks → task; global → last used or picker).

---

## UI (minimal)

```
┌─────────────────────────────────────┐
│  [Task | Event | Note]     Esc / ✕  │
│  ┌───────────────────────────────┐  │
│  │ Type or speak…            mic │  │
│  └───────────────────────────────┘  │
│  Preview: title · when · warnings   │
│  [Ask follow-up ⌘↩]     [Confirm ⏎] │
└─────────────────────────────────────┘
```

- Glass panel using existing spotlight-glass tokens (calm, not decorative excess)  
- Shortcut hints on primary actions (`⏎` Confirm)  
- No marigold sparkle; mic is quiet chrome  

---

## Keyboard

| Key | Action |
|-----|--------|
| `⌘K` | Open (capture / spotlight — scope TBD in plan) |
| `q` | Open on Calendar (event bias) |
| `⏎` | Confirm draft |
| `Esc` | Close |
| `⌘⏎` | Ask follow-up / AI polish (optional) |
| Hold mic / platform bind | Dictation into field |

Desktop later: same keys inside overlay; **global open** via OS shortcut (e.g. `⌘⇧Space`).

---

## Architecture

```
Hotkey (in-app or OS)
    → Overlay shell
    → Text / STT adapter
    → Capture Engine (packages/core)
    → Preview
    → Confirm → product mutation
```

- **Parse / draft:** Capture Engine doc (chrono-node, no STT in core)  
- **STT:** `SpeechToTextPort` (Whisper API now; whisper.cpp on desktop later)  
- **AI polish:** Vercel AI SDK — only on explicit “Ask follow-up”  

---

## Open source / stack

| Piece | Tool |
|-------|------|
| Overlay / focus | Existing Dialog + spotlight patterns |
| Hotkeys | `react-hotkeys-hook` or `tinykeys` |
| Parse | chrono-node + Capture Engine |
| Voice | Whisper / Groq; whisper.cpp desktop |
| AI polish | Vercel AI SDK |
| Desktop shell | **Tauri 2** + global shortcut (preferred over Electron) |

---

## Platform limits

- **Web:** cannot capture OS-global hotkeys when another app is focused. Honest UX: works while Planevo is active.  
- **Desktop:** Tauri global shortcut unlocks “from anywhere.”  

---

## Phases

| Phase | Ship |
|-------|------|
| **P0** | In-tab overlay: type → parse → Confirm (task + event) |
| **P1** | Mic → same field |
| **P2** | Note mode + optional AI polish |
| **P3** | Tauri desktop + global hotkey |

---

## Out of scope

- Cloning reference IA (menubar calendar widget layout)  
- Silent create from voice/AI  
- Browser extension as V1 global capture (optional later)  
- Merging Tasks/Calendar into one product  

---

## Success

1. Create a task or event in ≤3 keys + short type + Enter while in Planevo  
2. Typed and spoken share one field and one Confirm  
3. Desktop later reuses the same overlay with zero second parser  

---

## Next

Approve → **writing-plans** → `docs/superpowers/plans/2026-07-24-quick-capture-overlay.md`
