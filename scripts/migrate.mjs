#!/usr/bin/env node
// ── scripts/migrate.mjs ─────────────────────────────────────────────────────
// Apply pending migrations, in order, exactly once each.
//
// Migrations used to be pasted into the Supabase SQL editor by hand with no
// record of what had been applied. That is how 040, 043, 044, 045 and 046 each
// reintroduced a security policy that 037 had removed, and how one migration
// ran twice and put 36 duplicate rows into the data bank unnoticed.
//
// Usage, from the repository root:
//
//   DATABASE_URL=postgres://...  node scripts/migrate.mjs status
//   DATABASE_URL=postgres://...  node scripts/migrate.mjs up
//   DATABASE_URL=postgres://...  node scripts/migrate.mjs up --dry-run
//   DATABASE_URL=postgres://...  node scripts/migrate.mjs backfill
//
//   status    list every migration and whether it has been applied
//   up        apply everything pending, oldest first, each in a transaction
//   accept    record that an ALREADY-APPLIED file was edited deliberately and
//             the edit does not change the resulting schema, e.g. fixing a
//             comment or removing a statement whose effect was undone by hand.
//             It refreshes the stored checksum and nothing else. Never use it
//             to make a real schema change stop showing as drift: write a new
//             migration for that.
//               node scripts/migrate.mjs accept 052_schema_migrations.sql
//   backfill  mark existing files as applied WITHOUT running them, for a
//             database that was migrated by hand before this script existed.
//             Use --through <prefix> to stop at a file, so anything genuinely
//             pending still gets applied by `up`:
//               node scripts/migrate.mjs backfill --through 051
//
// The connection string is read from DATABASE_URL and is never written to disk
// or logged. Pass it on the command line for a one-off, or export it in the
// shell; do not commit it.
//
// Requires: npm i pg   (dev dependency, not shipped to the browser)

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(HERE, "..", "migrations");

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL is not set.\n\n  DATABASE_URL=postgres://... node scripts/migrate.mjs status\n");
  process.exit(1);
}

const command = process.argv[2] ?? "status";
const dryRun = process.argv.includes("--dry-run");

const files = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();   // filenames are zero-padded, so lexical order is apply order

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();

async function ensureTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_by  TEXT,
      backfilled  BOOLEAN NOT NULL DEFAULT false,
      checksum    TEXT,
      notes       TEXT
    )`);
  await client.query(`ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY`);
}

async function appliedSet() {
  const { rows } = await client.query("SELECT filename, checksum, backfilled FROM schema_migrations");
  return new Map(rows.map((r) => [r.filename, r]));
}

const who = process.env.USER || process.env.USERNAME || "unknown";

try {
  await ensureTable();
  const applied = await appliedSet();

  if (command === "status") {
    let pending = 0, changed = 0;
    for (const f of files) {
      const row = applied.get(f);
      const sum = sha(readFileSync(join(MIG_DIR, f), "utf8"));
      if (!row) { console.log(`  PENDING   ${f}`); pending++; continue; }
      // A file edited after being applied is worth knowing about: the database
      // no longer matches what is in the repository.
      const drift = row.checksum && row.checksum !== sum;
      if (drift) changed++;
      console.log(`  applied   ${f}${row.backfilled ? "  (backfilled)" : ""}${drift ? "  ⚠ FILE CHANGED SINCE APPLY" : ""}`);
    }
    console.log(`\n${files.length} migrations, ${pending} pending${changed ? `, ${changed} edited after apply` : ""}`);
    process.exit(pending ? 1 : 0);
  }

  if (command === "accept") {
    const target = process.argv[3];
    if (!target) { console.error("accept needs a filename"); process.exit(1); }
    if (!files.includes(target)) { console.error(`no such migration: ${target}`); process.exit(1); }
    const row = applied.get(target);
    if (!row) { console.error(`${target} has not been applied, so there is nothing to accept`); process.exit(1); }
    const sum = sha(readFileSync(join(MIG_DIR, target), "utf8"));
    if (row.checksum === sum) { console.log(`${target} already matches; nothing to do`); process.exit(0); }
    const reason = process.argv.slice(4).join(" ") || "edited after apply; accepted as schema-equivalent";
    await client.query(
      `UPDATE schema_migrations
         SET checksum = $2,
             notes = COALESCE(notes || ' | ', '') || $3
       WHERE filename = $1`,
      [target, sum, `accepted ${new Date().toISOString().slice(0, 10)} by ${who}: ${reason}`]
    );
    console.log(`accepted ${target}\n  reason: ${reason}`);
    process.exit(0);
  }

  if (command === "backfill") {
    // Everything up to and including this prefix is marked applied. Without it
    // a backfill would also mark genuinely pending migrations as done, which is
    // the one way this tool could cause real damage.
    const throughIdx = process.argv.indexOf("--through");
    const through = throughIdx > -1 ? process.argv[throughIdx + 1] : null;
    if (through && !files.some((f) => f.startsWith(through))) {
      console.error(`--through ${through}: no migration starts with that. Nothing done.`);
      process.exit(1);
    }
    let n = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      if (through && f.localeCompare(through) > 0 && !f.startsWith(through)) continue;
      await client.query(
        `INSERT INTO schema_migrations (filename, applied_by, backfilled, checksum, notes)
         VALUES ($1,$2,true,$3,'Backfilled: applied by hand before tracking existed')
         ON CONFLICT (filename) DO NOTHING`,
        [f, who, sha(readFileSync(join(MIG_DIR, f), "utf8"))]
      );
      n++;
    }
    console.log(`backfilled ${n} migration${n === 1 ? "" : "s"} as applied (nothing was executed)${through ? `, stopping at ${through}` : ""}`);
    process.exit(0);
  }

  if (command === "up") {
    const pending = files.filter((f) => !applied.has(f));
    if (!pending.length) { console.log("nothing pending"); process.exit(0); }
    console.log(`${pending.length} pending:\n` + pending.map((f) => `  ${f}`).join("\n") + "\n");
    if (dryRun) { console.log("--dry-run: nothing applied"); process.exit(0); }

    for (const f of pending) {
      const sql = readFileSync(join(MIG_DIR, f), "utf8");
      try {
        // Each migration is its own transaction: one failure does not leave the
        // schema half-changed, and the ones before it stay applied.
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename, applied_by, backfilled, checksum)
           VALUES ($1,$2,false,$3)`,
          [f, who, sha(sql)]
        );
        await client.query("COMMIT");
        console.log(`  OK   ${f}`);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`  FAIL ${f}: ${e.message}`);
        console.error("\nStopped. Earlier migrations stay applied; fix this file and run again.");
        process.exit(1);
      }
    }
    console.log("\nall pending migrations applied");
    process.exit(0);
  }

  console.error(`unknown command: ${command}\nuse: status | up | up --dry-run | backfill | accept <file>`);
  process.exit(1);
} finally {
  await client.end();
}
