# Notion product typography (craft reference)

Craft-only reference for Tasks / database table / board / list UI typography.
Not layout or IA — Planevo keeps workspace-first structure.

Sources: [Layout Kit — Notion](https://layout.design/gallery/notion),
[DesignMD Notion benchmark](https://designmd.cc/benchmarks/notion),
[Refero Notion styles](https://styles.refero.design/style/f58e99d1-940d-4254-8822-5d856bba6505).

## Font stack

Notion ships **NotionInter** (proprietary). Public fallback stack:

```
NotionInter, Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
"Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif
```

Planevo uses **Inter** (next/font) as the open substitute via `--font-product`.

## Product UI scale (database / table / board)

| Role | Size | Line height | Weight | Tracking | Use |
|------|------|-------------|--------|----------|-----|
| Cell body | 14px | 20px | 400 | -0.006em | Property values, due dates |
| Cell title | 14px | 20px | 500 | -0.006em | Task / row title |
| Column header | 12px | 16px | 500 | +0.0078125em | Table column labels (sentence case) |
| Caption / meta | 12px | 16px | 400 | +0.0078125em | Empty states, footnotes |
| Stat / count | 14px | 20px | 400 | -0.006em | `0 / 0`, column counts — tabular nums |

## Not Notion

- No ALL CAPS column headers in database views
- Counts use sans tabular figures, not monospace
- Empty due date copy: **No due date** (not "None")

## Planevo token mapping

| Token | Utility |
|-------|---------|
| `--font-product` | Inter stack on `.tasks-product-ui` |
| `--text-product-body` | `text-product-body` |
| `--text-product-title` | `text-product-title` |
| `--text-product-column` | `text-product-column` |
| `--text-product-meta` | `text-product-meta` |
| `--text-product-stat` | `text-product-stat` + `tabular-nums` |
