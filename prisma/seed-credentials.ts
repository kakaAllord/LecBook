import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Seeds the three account tiers the app is built around: one super admin (the
 * developer/operator), one institution admin, and one lecturer.
 */
export async function seedCredentials(prisma: PrismaClient) {
  const superAdmin = await upsertUser(prisma, {
    email: process.env.SEED_SUPERADMIN_EMAIL || "dev@example.com",
    password: process.env.SEED_SUPERADMIN_PASSWORD || "REDACTED_SEED_PASSWORD",
    name: process.env.SEED_SUPERADMIN_NAME || "Wickleaf (Dev)",
    role: "SUPER_ADMIN",
  });

  const admin = await upsertUser(prisma, {
    email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD || "REDACTED_SEED_PASSWORD",
    name: process.env.SEED_ADMIN_NAME || "College Administrator",
    role: "ADMIN",
    createdById: superAdmin.id,
  });

  const lecturer = await upsertUser(prisma, {
    email: process.env.SEED_LECTURER_EMAIL || "lecturer@example.com",
    password: process.env.SEED_LECTURER_PASSWORD || "REDACTED_SEED_PASSWORD",
    name: process.env.SEED_LECTURER_NAME || "Wickleaf",
    role: "LECTURER",
    createdById: admin.id,
  });

  console.log(`Super admin ready: ${superAdmin.email}`);
  console.log(`Admin ready:       ${admin.email}`);
  console.log(`Lecturer ready:    ${lecturer.email}`);

  return { superAdmin, admin, lecturer };
}

async function upsertUser(
  prisma: PrismaClient,
  opts: {
    email: string;
    password: string;
    name: string;
    role: "SUPER_ADMIN" | "ADMIN" | "LECTURER";
    createdById?: string;
  }
) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {
      password: passwordHash,
      name: opts.name,
      role: opts.role,
      status: "ACTIVE",
      ...(opts.createdById ? { createdById: opts.createdById } : {}),
    },
    create: {
      name: opts.name,
      email: opts.email,
      password: passwordHash,
      role: opts.role,
      status: "ACTIVE",
      createdById: opts.createdById,
    },
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCredentials(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
