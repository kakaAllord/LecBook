import dayjs from "dayjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";

export async function listAuditLogs(opts: {
  search: string;
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const { search, userId, action, entity, from, to, page, pageSize } = opts;

  const where: Prisma.AuditLogWhereInput = {
    AND: [
      ...(userId ? [{ userId }] : []),
      // Matching a prefix lets the filter select whole families, e.g. "attendance".
      ...(action ? [{ action: { startsWith: action } }] : []),
      ...(entity ? [{ entity }] : []),
      ...(from || to
        ? [
            {
              createdAt: {
                ...(from ? { gte: dayjs(from).startOf("day").toDate() } : {}),
                ...(to ? { lte: dayjs(to).endOf("day").toDate() } : {}),
              },
            },
          ]
        : []),
      ...(search
        ? [
            {
              OR: [
                { summary: { contains: search, mode: "insensitive" as const } },
                { actorName: { contains: search, mode: "insensitive" as const } },
                { actorEmail: { contains: search, mode: "insensitive" as const } },
                { action: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

/** Distinct actors and actions, so the log filters offer only what actually exists. */
export async function getAuditFilterOptions() {
  const [actors, actions] = await Promise.all([
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return {
    actors,
    // "attendance.save" and "attendance.move" collapse to the "attendance" family.
    families: Array.from(new Set(actions.map((a) => a.action.split(".")[0]))).sort(),
    actions: actions.map((a) => a.action),
  };
}
