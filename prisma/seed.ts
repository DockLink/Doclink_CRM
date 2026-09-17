import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const password = process.env.SUPERADMIN_PASSWORD ?? "Admin@12345";

  const user = await prisma.user.upsert({
    where: { email: "superadmin@doclink.com" },
    update: {
      name: "Super Admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "superadmin",
      isActive: true,
    },
    create: {
      name: "Super Admin",
      email: "superadmin@doclink.com",
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