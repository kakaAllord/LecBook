import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Seeds the three account tiers the app is built around: one super admin (the
 * developer/operator), one institution admin, and one lecturer.
 */
export async function seedCredentials(prisma: PrismaClient) {
  const generated: string[] = [];

  /**
   * Passwords come from the environment and are never hardcoded here — this file
   * is committed, and a password in git is a password that has leaked. When one
   * is missing a random password is generated and printed once, so a fresh clone
   * still seeds successfully without inheriting someone else's known password.
   */
  function password(envVar: string, label: string) {
    const value = process.env[envVar];
    if (value) return value;
    const random = randomBytes(9).toString("base64url");
    generated.push(`  ${label.padEnd(12)} ${random}   (set ${envVar} to choose your own)`);
    return random;
  }

  const superAdmin = await upsertUser(prisma, {
    email: process.env.SEED_SUPERADMIN_EMAIL || "dev@example.com",
    password: password("SEED_SUPERADMIN_PASSWORD", "super admin"),
    name: process.env.SEED_SUPERADMIN_NAME || "Super Admin",
    role: "SUPER_ADMIN",
  });

  const admin = await upsertUser(prisma, {
    email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
    password: password("SEED_ADMIN_PASSWORD", "admin"),
    name: process.env.SEED_ADMIN_NAME || "College Administrator",
    role: "ADMIN",
    createdById: superAdmin.id,
  });

  const lecturer = await upsertUser(prisma, {
    email: process.env.SEED_LECTURER_EMAIL || "lecturer@example.com",
    password: password("SEED_LECTURER_PASSWORD", "lecturer"),
    name: process.env.SEED_LECTURER_NAME || "Lecturer",
    role: "LECTURER",
    createdById: admin.id,
  });

  console.log(`Super admin ready: ${superAdmin.email}`);
  console.log(`Admin ready:       ${admin.email}`);
  console.log(`Lecturer ready:    ${lecturer.email}`);

  if (generated.length > 0) {
    console.log("\nGenerated passwords (shown once — copy them now):");
    for (const line of generated) console.log(line);
    console.log("");
  }

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
