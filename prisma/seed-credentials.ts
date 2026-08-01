import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export async function seedCredentials(prisma: PrismaClient) {
  const email = process.env.SEED_LECTURER_EMAIL || "lecturer@example.com";
  const password = process.env.SEED_LECTURER_PASSWORD || "REDACTED_SEED_PASSWORD";
  const name = process.env.SEED_LECTURER_NAME || "Wickleaf";

  const passwordHash = await bcrypt.hash(password, 10);
  const lecturer = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, name },
    create: { name, email, password: passwordHash },
  });
  console.log(`Lecturer user ready: ${lecturer.email}`);
  return lecturer;
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
