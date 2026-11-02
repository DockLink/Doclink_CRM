import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env") });

const directUrl = process.env.DIRECT_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!directUrl || !supabaseUrl || !serviceKey) {
  throw new Error("DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required");
}

const sqlPath = path.resolve(__dirname, "..", "supabase", "auth-roles.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);

const check = await client.query(`
  select u.id as crm_id, u.email, u.role, u.is_active, a.id as auth_id,
         a.raw_app_meta_data->>'role' as app_role
  from public.users u
  full outer join auth.users a on lower(a.email) = lower(u.email)
  where lower(coalesce(u.email, a.email)) = lower('superadmin@doclink.com')
`);
console.log("superadmin row:", check.rows);

const grants = await client.query(`
  select grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'users' and grantee = 'authenticated'
`);
console.log("authenticated grants:", grants.rows);

const policies = await client.query(`
  select policyname, roles, cmd, qual
  from pg_policies
  where schemaname = 'public' and tablename = 'users'
`);
console.log("policies:", policies.rows);

await client.end();

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;

const user = data.users.find((u) => u.email?.toLowerCase() === "superadmin@doclink.com");
if (!user) {
  console.log("No auth superadmin found yet — run: yarn tsx prisma/seed.ts");
} else {
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role: "superadmin" },
    email_confirm: true,
  });
  if (updErr) throw updErr;
  console.log("Synced auth app_metadata.role for", user.email, user.id);
}
