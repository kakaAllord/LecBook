import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";
import type { InstitutionSettingsInput, TeachingSettingsInput } from "@/lib/validators/settings";

/** The single institution row, created on first read. */
export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;
  return prisma.settings.create({ data: {} });
}

export async function updateSettings(data: InstitutionSettingsInput) {
  const existing = await prisma.settings.findFirst();
  if (existing) {
    return prisma.settings.update({ where: { id: existing.id }, data });
  }
  return prisma.settings.create({ data });
}

/**
 * The institution settings as they apply to one account: a lecturer who has set
 * their own attendance bar or pass mark is measured against theirs, everyone
 * else against the institution default. Reports and student records are
 * generated through this so the numbers on the page match the settings screen
 * of whoever asked for them.
 */
export async function getSettingsFor(session: Session) {
  const settings = await getSettings();
  if (session.role !== "LECTURER") return settings;

  const lecturer = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { attendanceThreshold: true, assessmentPassMark: true },
  });

  return {
    ...settings,
    attendanceThreshold: lecturer?.attendanceThreshold ?? settings.attendanceThreshold,
    assessmentPassMark: lecturer?.assessmentPassMark ?? settings.assessmentPassMark,
  };
}

/** A lecturer's own thresholds, plus the institution defaults they fall back to. */
export async function getTeachingSettings(session: Session) {
  const [settings, lecturer] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { attendanceThreshold: true, assessmentPassMark: true },
    }),
  ]);

  return {
    attendanceThreshold: lecturer?.attendanceThreshold ?? settings.attendanceThreshold,
    assessmentPassMark: lecturer?.assessmentPassMark ?? settings.assessmentPassMark,
    institutionDefaults: {
      attendanceThreshold: settings.attendanceThreshold,
      assessmentPassMark: settings.assessmentPassMark,
    },
    usingOwnValues: lecturer?.attendanceThreshold !== null || lecturer?.assessmentPassMark !== null,
  };
}

export async function updateTeachingSettings(userId: string, data: TeachingSettingsInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      attendanceThreshold: data.attendanceThreshold,
      assessmentPassMark: data.assessmentPassMark,
    },
    select: { attendanceThreshold: true, assessmentPassMark: true },
  });
}
