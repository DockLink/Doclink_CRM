import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../generated/prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "..", ".env") });

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL is required. Add it to your environment or .env before running the seed script.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required before running the seed script.",
  );
}
const resolvedSupabaseUrl = supabaseUrl;
const resolvedSupabaseServiceRoleKey = supabaseServiceRoleKey;

const adapter = new PrismaPg({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("SUPERADMIN_PASSWORD (at least 8 characters) is required before running the seed script.");
  }
  const supabaseAdmin = createClient(resolvedSupabaseUrl, resolvedSupabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = "superadmin@doclink.com";

  const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authUsersError) throw authUsersError;

  let authUser = authUsers.users.find((candidate: { email?: string | null }) => candidate.email?.toLowerCase() === email);
  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "superadmin" },
    });
    if (error || !data.user) throw error ?? new Error("Unable to create Supabase superadmin");
    authUser = data.user;
  } else {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(authUser.app_metadata ?? {}), role: "superadmin" },
    });
    if (error) throw error;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Super Admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "superadmin",
      isActive: true,
    },
    create: {
      id: authUser.id,
      name: "Super Admin",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "superadmin",
      isActive: true,
    },
  });

  console.log(`Superadmin created: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());