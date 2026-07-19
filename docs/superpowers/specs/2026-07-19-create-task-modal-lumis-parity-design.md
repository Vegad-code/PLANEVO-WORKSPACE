# Create Task Modal — Lumis Parity Design

> **Status:** Approved for implementation planning · July 19, 2026  
> **Authority:** Founder visual override (Lumis create-modal layout for `/tasks`), `AGENTS.md` tokens, F-03 Tasks product  
> **Scope:** Visual + size parity of `CreateTaskDialog` only (not Lumis sidebar IA)

---

## Goal

Make Planevo’s **Create new task** modal match the Lumis reference for **look and size** (narrow tall card, Apple spacing, ink primary CTA), while keeping Planevo product tokens, tag vocabulary, and existing create/upload wiring.

---

## Locked decisions (founder)

| Decision | Choice |
|----------|--------|
| Primary CTA | **Ink / black** (`bg-ink text-paper`) for this modal only — founder override of marigold-on-primary for the open dialog |
| Modal width | **Narrow Lumis column** — `max-w-md` (~448px shell; ~420px content feel) |
| Remaining choices | Closest to Lumis |
| Approach | **A — Reskin in place** on `create-task-dialog.tsx` |

Toolbar **+ Create task** remains **marigold** when the dialog is closed. When the dialog is open, the modal’s ink Create Task owns the single strong accent on screen.

---

## Out of scope

- Lumis sidebar, AI threads, usage meter, agent tags as IA
- Adding Lumis AI tag labels (`AI Assigned`, `AI Drafted`, `AI Reviewer`) — Planevo tags stay Product / Design / Components / User / Other
- Board / list / table card redesign (separate pass unless requested)
- Hardcoded hex or arbitrary `text-[Npx]` — tokens only (`ink`, `paper`, `surface-raised`, `border`, type scale)

---

## Architecture

Single presentational component:

- **File:** `apps/web/features/tasks-product/create-task-dialog.tsx`
- **Host:** `TasksProductView` (unchanged submit / attachment pipeline)
- **Primitives:** Existing `Dialog`, `Button` (`variant="ink"` / `outline`), Lucide icons
- **No new server actions** — layout/CSS/copy only

`/design` `TasksProductPreview` must show the updated modal so kitchen-sink review stays in sync.

---

## Pixel contract (Lumis → Planevo)

### Shell

| Property | Spec |
|----------|------|
| Max width | `max-w-md` |
| Radius | `rounded-2xl` |
| Background | `bg-surface-raised` |
| Border | `border border-border` |
| Shadow | Soft float using theme-safe shadow (no glow, no heavy multi-layer) |
| Backdrop | Keep `backdrop:bg-ink/30` |
| Header / footer pad | `px-6 py-5` |
| Body pad | `px-6 py-6` |
| Body stack | `flex flex-col gap-5` |

### Header

- Remove `NEW TASK` eyebrow
- Left: small filled **ink** square (~`size-3` / `size-3.5`) + title **Create New Task**
- Title type: `text-h3` (or equivalent ~16–18px medium) — not oversized `text-h2`
- Right: Lucide `X`, quiet muted, `size-9` hit target

### Fields (order unchanged)

1. Task title — input `h-11`, placeholder `e.g. Weekly progress...`
2. Description — textarea `rows={5}`, placeholder closest to Lumis workflow copy or keep current end-to-end line if already clear
3. Priority — full-width select `h-11`
4. Due date + Estimate — `grid grid-cols-2 gap-3`, due trailing calendar icon
5. Tags — chip wrap; chips `px-3 py-1.5`; leading square (ink when selected, muted when not)
6. Attachments — dashed dropzone `min-h-32`, `py-8`, cloud ~24px; title **Drop Your File Here**; helper keeps 5 files / 25 MB

### Labels

Keep Planevo uppercase `text-label text-text-muted` system (Lumis craft via spacing/size, not Inter/raw hex).

### Inputs

- Height: **h-11** (44px)
- Radius: `rounded-lg`
- Border: `border-border` (softer default than `border-strong`)
- Focus: `focus:border-ink` + existing focus-visible outline

### Footer

| Control | Spec |
|---------|------|
| Cancel | Left, outline / bordered (`Button variant="outline"`) |
| Create Task | Right, **`Button variant="ink"`** — solid ink, paper text; pending → “Creating…” |

---

## Marigold rule (explicit)

- **Closed dialog:** toolbar Create task = marigold (one accent).
- **Open dialog:** toolbar Create task may demote to ink/quiet (existing pattern); modal primary = **ink**. Marigold must not also appear as the modal primary.

---

## Error handling / a11y

- Keep existing file size / count errors
- Keep `labelledBy`, Escape → close when not pending
- Chip buttons remain `aria-pressed`
- Dropzone remains keyboard-activatable (button)

---

## Testing

1. Visual: `/design` Tasks product section — modal matches Lumis proportions
2. Visual: `/tasks` — open Create from toolbar and from column `+`
3. Functional: create with title only; with tags + estimate + attachment still works
4. Accent: with dialog open, no second marigold primary competing with ink Create Task
5. `cd apps/web && npx tsc --noEmit`

---

## Implementation note

Prefer Approach A only. Do not introduce a parallel dialog component unless the reskin file exceeds maintainability after the pass.

---

*Design v1.0 · July 19, 2026 · Approved in conversation*


