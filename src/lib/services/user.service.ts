import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { paginatedResult } from "@/lib/pagination";
import type { Session } from "@/lib/auth";
import type { CreateUserInput, UpdateUserInput, AcceptInviteInput } from "@/lib/validators/user";

const INVITE_TTL_DAYS = 14;

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  title: true,
  staffId: true,
  createdById: true,
  lastLoginAt: true,
  loginCount: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  modules: { select: { id: true, name: true, code: true, courses: { select: { id: true, name: true } } } },
  _count: { select: { createdUsers: true, sessions: true } },
} satisfies Prisma.UserSelect;

/**
 * Which accounts a session is allowed to manage.
 *
 * A super admin manages everyone. An admin manages only the accounts they
 * created themselves — this is what keeps one admin's lecturers invisible to
 * another admin while the super admin still sees the whole tree.
 */
function manageableWhere(session: Session): Prisma.UserWhereInput {
  if (session.role === "SUPER_ADMIN") {
    return { id: { not: session.sub } };
  }
  return { createdById: session.sub, role: "LECTURER" };
}

export async function listUsers(
  session: Session,
  opts: { search: string; role?: string; status?: string; createdById?: string; page: number; pageSize: number }
) {
  const { search, role, status, createdById, page, pageSize } = opts;

  const where: Prisma.UserWhereInput = {
    AND: [
      manageableWhere(session),
      ...(role ? [{ role: role as UserRole }] : []),
      ...(status ? [{ status: status as "ACTIVE" | "INACTIVE" | "PENDING" }] : []),
      ...(createdById ? [{ createdById }] : []),
      ...(search
        ? [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { staffId: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: userSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function getManageableUser(session: Session, id: string) {
  const user = await prisma.user.findFirst({
    where: { AND: [{ id }, manageableWhere(session)] },
    select: userSelect,
  });
  if (!user) throw new ApiError("User not found", 404);
  return user;
}

/** Super admins may inspect any account, including ones they cannot edit. */
export async function getViewableUser(session: Session, id: string) {
  if (session.role === "SUPER_ADMIN") {
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new ApiError("User not found", 404);
    return user;
  }
  return getManageableUser(session, id);
}

function assertCanAssignRole(session: Session, role: UserRole) {
  if (role === "SUPER_ADMIN") {
    throw new ApiError("Super admin accounts cannot be created from the app", 403);
  }
  if (role === "ADMIN" && session.role !== "SUPER_ADMIN") {
    throw new ApiError("Only the super admin can create admin accounts", 403);
  }
}

function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

/**
 * Creates an account in PENDING state plus an invite token. The person is never
 * given a password by whoever adds them — they set their own when they open the
 * invite link, which also lets them fill in the details only they know.
 */
export async function createUser(session: Session, data: CreateUserInput) {
  assertCanAssignRole(session, data.role);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ApiError("An account with this email already exists", 409);
  }

  const moduleIds = data.moduleIds ?? [];

  if (moduleIds.length > 0) {
    const count = await prisma.module.count({ where: { id: { in: moduleIds } } });
    if (count !== moduleIds.length) throw new ApiError("One or more modules do not exist", 422);
  }

  const token = generateInviteToken();

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      status: "PENDING",
      title: data.title || null,
      phone: data.phone || null,
      staffId: data.staffId || null,
      createdById: session.sub,
      modules: { connect: moduleIds.map((id) => ({ id })) },
      invites: {
        create: {
          token,
          createdById: session.sub,
          expiresAt: dayjs().add(INVITE_TTL_DAYS, "day").toDate(),
        },
      },
    },
    select: userSelect,
  });

  return { user, token };
}

export async function updateUser(session: Session, id: string, data: UpdateUserInput) {
  const target = await getManageableUser(session, id);
  if (data.role) assertCanAssignRole(session, data.role);

  if (data.email && data.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError("An account with this email already exists", 409);
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.title !== undefined ? { title: data.title || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.staffId !== undefined ? { staffId: data.staffId || null } : {}),
      ...(data.moduleIds ? { modules: { set: data.moduleIds.map((mid) => ({ id: mid })) } } : {}),
    },
    select: userSelect,
  });
}

export async function setUserStatus(session: Session, id: string, active: boolean) {
  await getManageableUser(session, id);
  const user = await prisma.user.update({
    where: { id },
    data: { status: active ? "ACTIVE" : "INACTIVE" },
    select: userSelect,
  });
  // Deactivating cuts off existing sessions too, not just future sign-ins.
  if (!active) {
    await prisma.userSession.deleteMany({ where: { userId: id } });
  }
  return user;
}

export async function deleteUser(session: Session, id: string) {
  await getManageableUser(session, id);
  await prisma.user.delete({ where: { id } });
}

/** Issues a fresh invite link, invalidating any earlier unused one. */
export async function regenerateInvite(session: Session, id: string) {
  const user = await getManageableUser(session, id);
  if (user.status === "ACTIVE") {
    throw new ApiError("This account is already active and does not need an invite", 422);
  }

  const token = generateInviteToken();
  await prisma.$transaction([
    prisma.invite.updateMany({
      where: { userId: id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.invite.create({
      data: {
        token,
        userId: id,
        createdById: session.sub,
        expiresAt: dayjs().add(INVITE_TTL_DAYS, "day").toDate(),
      },
    }),
  ]);

  return { user, token };
}

export async function revokeInvites(session: Session, id: string) {
  await getManageableUser(session, id);
  await prisma.invite.updateMany({
    where: { userId: id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          title: true,
          phone: true,
          staffId: true,
          status: true,
          modules: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!invite) throw new ApiError("This invite link is not valid", 404);
  if (invite.revokedAt) throw new ApiError("This invite link has been revoked", 410);
  if (invite.acceptedAt) throw new ApiError("This invite link has already been used", 410);
  if (invite.expiresAt < new Date()) {
    throw new ApiError("This invite link has expired. Ask your admin to send a new one.", 410);
  }

  return invite;
}

export async function acceptInvite(token: string, data: AcceptInviteInput) {
  const invite = await getInviteByToken(token);
  const passwordHash = await bcrypt.hash(data.password, 10);

  const [, user] = await prisma.$transaction([
    prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    prisma.user.update({
      where: { id: invite.userId },
      data: {
        name: data.name,
        title: data.title || null,
        phone: data.phone || null,
        staffId: data.staffId || null,
        password: passwordHash,
        status: "ACTIVE",
      },
      select: userSelect,
    }),
  ]);

  return user;
}

export async function changeOwnPassword(session: Session, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.password) throw new ApiError("Account not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new ApiError("Your current password is incorrect", 400);

  await prisma.user.update({
    where: { id: session.sub },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });
}

/** Everyone a super admin can drop into, grouped by the admin who added them. */
export async function listAllUsersForSuperAdmin() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: userSelect,
  });
}
