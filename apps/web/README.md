# Planevo web

The Next.js app. Repo-wide steering lives in the root `AGENTS.md`; product truth
in `docs/planevo-prd.md`.

## Layout

- `app/` — routes only (layouts, pages, route handlers, error/loading boundaries)
- `features/` — feature-owned UI + client components (shell, home, tasks,
  calendar, files, editor, database, settings, search)
- `components/ui/` — shared primitives (dialog, icons, empty/error states,
  theme controls)
- `lib/` — Next-coupled server glue (data access, current-workspace resolution,
  cached query binders)
- `../../packages/core` — platform-agnostic types, state machines, queries,
  mutations (all unit tests live here)
- `../../packages/api` — typed RPC wrappers shared by future clients

## Local development

```bash
npm install            # from the repo root
npm run dev            # starts this app
npm test               # pure-logic tests across all workspaces
npm run test:rls       # two-user RLS isolation check (needs env keys)
```

`apps/web/.env.local` needs the Supabase URL + publishable key. For pre-auth
dev mode add `PLANEVO_DEV_MODE=1`, `PLANEVO_DEV_OWNER_ID`, and a server secret
key — dev mode is hard-disabled in production builds. If calendar or file
mutations intermittently fail with `bad_jwt`, also set `PLANEVO_DEV_OWNER_UUID`
to the dev user's auth UUID (from Supabase Auth → Users) so the app skips Auth
Admin lookups on every drag.

Database changes are migrations in `supabase/migrations/`, applied with
`npm run db:push` (one-time `npx supabase login` first). After schema changes
run `npm run db:types` and commit the diff. Performance acceptance queries:
`supabase/performance-checks.md`; seed a 10k-record sandbox with
`npm run db:seed`.

## Production checklist

- Env: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  only. **Never** set `PLANEVO_DEV_MODE`, `PLANEVO_DEV_OWNER_ID`, or a
  service/secret key in the app's production environment.
- Migrations pushed (`npm run db:push`) and `npm run db:types` clean.
- `npm run test:rls` green against the production project (creates and deletes
  two throwaway users).
- Supabase Auth email templates point confirmation links at `/auth/confirm`
  (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`)
  and the site URL is the production domain (used by `/auth/callback`).
- `next build` clean; sign-up → bootstrap → workspace flow clicked through.
