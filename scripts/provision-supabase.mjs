#!/usr/bin/env node
/**
 * Provisions the Supabase backend from scratch using the Management API.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/provision-supabase.mjs
 *
 * Creates the project if it does not exist, waits for it to come up, applies
 * supabase/migrations/*.sql, then writes .env.local with the public keys.
 * Safe to re-run: an existing project is reused and the migration is skipped if the
 * schema is already present.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const API = "https://api.supabase.com";
const PROJECT_NAME = "surplus-to-shelter";
const REGION = "ap-south-1"; // Mumbai — the demo network and the judges are in India.
const ROOT = path.resolve(import.meta.dirname, "..");

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  console.error("Create one at https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

async function api(method, route, body) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${route} → ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveOrganizationId(projects) {
  const organizations = await api("GET", "/v1/organizations");
  if (organizations.length) return organizations[0].id;

  // Tokens scoped without organization read access return an empty list even when an
  // organization exists, so fall back to the one that owns an existing project.
  const owner = projects.find((p) => p.organization_id)?.organization_id;
  if (owner) return owner;

  throw new Error(
    "No organization available. Create one at https://supabase.com/dashboard/new first.",
  );
}

async function findOrCreateProject() {
  const projects = await api("GET", "/v1/projects");

  // Prefer a project this script created. Adopting an unrelated project is opt-in, because
  // applying the schema into someone else's database is not a decision to make silently.
  const existing = projects.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    console.log(`Reusing existing project "${existing.name}" (${existing.id}, ${existing.region})`);
    return { ref: existing.id, dbPass: null };
  }

  const org = { id: await resolveOrganizationId(projects) };

  const dbPass = `${randomBytes(18).toString("base64url")}Aa1!`;
  console.log(`Creating project "${PROJECT_NAME}" in ${REGION}…`);
  const created = await api("POST", "/v1/projects", {
    name: PROJECT_NAME,
    organization_id: org.id,
    region: REGION,
    db_pass: dbPass,
  });

  return { ref: created.id, dbPass };
}

async function waitForProject(ref) {
  process.stdout.write("Waiting for the database to come up");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const project = await api("GET", `/v1/projects/${ref}`);
    if (project.status === "ACTIVE_HEALTHY") {
      process.stdout.write(" ready\n");
      return;
    }
    process.stdout.write(".");
    await sleep(5000);
  }
  throw new Error("Project did not become healthy within 5 minutes.");
}

async function runQuery(ref, query) {
  return api("POST", `/v1/projects/${ref}/database/query`, { query });
}

async function countAllRows(ref) {
  // Exact counts across every public table. pg_stat_user_tables is only an estimate, and
  // "is it safe to drop this?" is not a question to answer with an estimate.
  const result = await runQuery(
    ref,
    `select coalesce(sum(cnt), 0)::bigint as total from (
       select (xpath(
         '/row/c/text()',
         query_to_xml(format('select count(*) as c from %I.%I', schemaname, tablename), false, true, '')
       ))[1]::text::bigint as cnt
       from pg_tables where schemaname = 'public'
     ) counts;`,
  );
  return Number(result?.[0]?.total ?? 0);
}

async function resetPublicSchema(ref) {
  const rows = await countAllRows(ref);
  if (rows > 0 && !process.env.SUPABASE_FORCE_RESET) {
    throw new Error(
      `Refusing to reset: the public schema holds ${rows} row(s). ` +
        "Set SUPABASE_FORCE_RESET=1 only if you are certain the data is disposable.",
    );
  }

  console.log(`Resetting the public schema (${rows} rows found, nothing to lose)…`);
  await runQuery(
    ref,
    `drop schema public cascade;
     create schema public;
     grant usage on schema public to postgres, anon, authenticated, service_role;
     grant all on schema public to postgres, service_role;
     alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;`,
  );
}

async function schemaAlreadyApplied(ref) {
  const result = await runQuery(
    ref,
    "select to_regclass('public.donations') is not null as present;",
  );
  return Array.isArray(result) && result[0]?.present === true;
}

async function applyMigrations(ref) {
  if (await schemaAlreadyApplied(ref)) {
    console.log("Schema already applied, skipping migrations.");
    return;
  }

  const dir = path.join(ROOT, "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    console.log(`Applying ${file}…`);
    await runQuery(ref, sql);
  }
  console.log("Schema applied.");
}

async function fetchAnonKey(ref) {
  // Newer projects expose publishable/secret keys; older ones expose the legacy anon key.
  for (const route of [`/v1/projects/${ref}/api-keys?reveal=true`, `/v1/projects/${ref}/api-keys`]) {
    try {
      const keys = await api("GET", route);
      const anon =
        keys.find((k) => k.name === "anon") ??
        keys.find((k) => k.type === "publishable") ??
        keys.find((k) => k.name?.includes("publishable"));
      const value = anon?.api_key ?? anon?.apiKey ?? anon?.key;
      if (typeof value === "string" && value.length > 0) return value;
    } catch {
      /* try the next shape */
    }
  }
  throw new Error("Could not read the anon key. Copy it from Settings → API Keys.");
}

async function writeEnvLocal(url, anonKey, dbPass) {
  const lines = [
    "# Generated by scripts/provision-supabase.mjs — do not commit.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
  ];
  if (dbPass) lines.push(`# Database password (keep safe): ${dbPass}`);
  await writeFile(path.join(ROOT, ".env.local"), `${lines.join("\n")}\n`, "utf8");
  console.log("Wrote .env.local");
}

const { ref, dbPass } = process.env.SUPABASE_PROJECT_REF
  ? { ref: process.env.SUPABASE_PROJECT_REF, dbPass: null }
  : await findOrCreateProject();
await waitForProject(ref);
if (process.env.SUPABASE_RESET) await resetPublicSchema(ref);
await applyMigrations(ref);
const anonKey = await fetchAnonKey(ref);
const url = `https://${ref}.supabase.co`;
await writeEnvLocal(url, anonKey, dbPass);

console.log("\nDone.");
console.log(`  Project ref : ${ref}`);
console.log(`  URL         : ${url}`);
console.log("\nNext: npm run dev — the header badge should read \"Live\".");
