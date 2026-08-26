# NEDB — National Energy Data Bank

The Energy Commission of Nigeria's platform for collecting, checking, publishing
and correcting national energy statistics.

Live at [nedb.vercel.app](https://nedb.vercel.app).

---

## What it is

A statistics platform, not a dashboard. The distinction shows up everywhere in
the design:

- **No one person can both prepare and publish a figure.** Editors upload and
  validate, administrators commit. Enforced in the API, not by convention.
- **Every consequential act is recorded** to an append-only audit log, and
  changes to published figures appear on a public revision log.
- **The database enforces one figure per series, period and region.** A second
  figure for the same period is rejected rather than added.
- **Where the platform cannot support a claim it says so** rather than filling
  the gap. The planning model marks every input as measured, derived or assumed.

Published commitments live at `/code-of-practice`, `/statistical-confidentiality`
and `/release-calendar`.

## Layout

```
frontend/     Next.js 16 App Router, TypeScript. The whole application.
migrations/   Numbered SQL, applied in filename order. See below.
scripts/      Operational tooling, including the migration runner.
```

## Running it

```bash
cd frontend
cp .env.local.example .env.local     # then fill it in
npm install
npm run dev
```

`.env.local.example` documents every variable the application reads and, for
each one, what breaks in its absence. A missing variable degrades a feature
silently rather than failing at boot, so read the notes.

Check what is actually working:

```bash
curl -s localhost:3000/api/health | jq
```

That endpoint probes each dependency for real. It used to report the cache as
healthy without contacting it, which is why it now returns 503 when anything it
depends on is down.

## Migrations

Numbered SQL in `migrations/`, applied in filename order, each exactly once.

**Always use the runner.** Migrations were applied by hand for a long time and
it cost: five separate migrations reintroduced a security policy an earlier one
had removed, and one migration ran twice and put 36 duplicate rows into the data
bank unnoticed. The runner records what it applies and refuses to apply anything
twice.

```bash
# What is applied, what is pending, and whether any applied file has been edited
DATABASE_URL=postgres://... node scripts/migrate.mjs status

# Show what would run, without running it
DATABASE_URL=postgres://... node scripts/migrate.mjs up --dry-run

# Apply everything pending, oldest first, each in its own transaction
DATABASE_URL=postgres://... node scripts/migrate.mjs up
```

`DATABASE_URL` is the session pooler string from the Supabase dashboard. Pass it
on the command line; do not commit it.

For a database that was migrated by hand before the runner existed:

```bash
DATABASE_URL=postgres://... node scripts/migrate.mjs backfill
```

That marks every existing file as applied **without executing anything**. Only
correct if the schema really is up to date.

### Writing a migration

- Number it in sequence and describe *why* at the top, not just what.
- **Never write a catch-all RLS policy.** `CREATE POLICY x ON t USING (true)`
  with no `FOR`/`TO` clause means `FOR ALL TO PUBLIC`, so anyone holding the
  anon key can read and write the table through PostgREST. The application uses
  the service role key, which bypasses RLS and needs no policy at all. Enable
  RLS, add nothing.
- Back up anything you delete into a `*_backup` table so the change is
  inspectable rather than destructive.
- If it corrects published figures, write a row to `audit_log`. The public
  revision log reads it, and a correction that is not disclosed is not a
  correction.

## Roles

`viewer` < `editor` < `admin` < `superadmin`. Guarded twice: `middleware.ts`
gates page loads, and every API route re-checks. Both are needed, because
middleware protects pages and not data.

Superadmin exists to separate the levers that can rewrite the record or open a
door from day-to-day administration. Only a superadmin may:

- change any account's role, or create an account at admin level or above
- issue or revoke a public API key
- freeze or unfreeze a period

## Security notes

- The Supabase **service role key bypasses RLS**. It is server-side only and
  there is no browser-side Supabase client anywhere in this codebase.
- **API keys are stored hashed.** The secret is shown once at issue and cannot
  be retrieved afterwards, including by an administrator.
- **Rate limiting fails safe.** With Redis unavailable it falls back to an
  in-process limiter rather than failing open.
- Cron routes are fail-closed: without `CRON_SECRET` they refuse every request.
