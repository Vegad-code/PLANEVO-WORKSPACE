# Planevo review rules

## Product architecture

- Tasks, Calendar, Files, and Workspace are separate products (ecosystem model).
- Do not turn product UIs into workspace database faces.
- Prefer smallest coherent change; no drive-by refactors.

## Design tokens

- Colors, fonts, spacing, and radii come from `apps/web/app/globals.css` tokens.
- At most one `marigold` accent per screen.

## Safety

- No secrets, service-role keys, or personal tokens in source.
- Migrations target Supabase project `aixvpsmpiucticxutngp` only unless the founder names another.

## Tests

- Pure logic lives in `lib/` with colocated `*.test.mjs` (`node:test`).
- Prefer scenario-named tests and failure-mode assertions.
