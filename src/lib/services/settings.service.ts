import { prisma } from "@/lib/prisma";
import type { SettingsInput } from "@/lib/validators/settings";

export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;
  return prisma.settings.create({ data: {} });
}

export async function updateSettings(data: SettingsInput) {
  const existing = await prisma.settings.findFirst();
  if (existing) {
    return prisma.settings.update({ where: { id: existing.id }, data });
  }
  return prisma.settings.create({ data });
}
