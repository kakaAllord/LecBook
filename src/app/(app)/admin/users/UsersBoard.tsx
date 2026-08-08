"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Plus,
  Pencil,
  Trash2,
  UserCog,
  Link2,
  ExternalLink,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { ManagedUser, Paginated, UserRole } from "@/types";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { UserFormDialog } from "./UserFormDialog";
import { InviteLinkDialog } from "./InviteLinkDialog";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  LECTURER: "Lecturer",
};

function roleColor(role: UserRole) {
  return role === "SUPER_ADMIN" ? "indigo" : role === "ADMIN" ? "sky" : "slate";
}

function statusColor(status: string) {
  return status === "ACTIVE" ? "emerald" : status === "PENDING" ? "amber" : "rose";
}

export function UsersBoard({ viewerRole, viewerId }: { viewerRole: UserRole; viewerId: string }) {
  const queryClient = useQueryClient();
  const isSuperAdmin = viewerRole === "SUPER_ADMIN";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; url: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, role, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      return api.get<Paginated<ManagedUser>>(`/api/admin/users?${params.toString()}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/admin/users/${id}/status`, { active }),
    onSuccess: (_result, variables) => {
      toast.success(variables.active ? "Account activated" : "Account deactivated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not change status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not delete account");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (user: ManagedUser) =>
      api
        .post<{ inviteUrl: string }>(`/api/admin/users/${user.id}/invite`)
        .then((result) => ({ user, inviteUrl: result.inviteUrl })),
    onSuccess: ({ user, inviteUrl }) => {
      setInvite({ name: user.name, email: user.email, url: inviteUrl });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not create an invite link");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">People</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? "Every administrator and the lecturers they have added."
              : "The lecturers you have added and the courses assigned to them."}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add person
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, email or staff ID..."
          className="sm:max-w-xs"
        />
        {isSuperAdmin && (
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="sm:max-w-[180px]"
          >
            <option value="">All roles</option>
            <option value="ADMIN">Administrators</option>
            <option value="LECTURER">Lecturers</option>
          </Select>
        )}
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[180px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Awaiting setup</option>
          <option value="INACTIVE">Deactivated</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Nobody here yet"
          description="Add a lecturer, assign their courses, and send them the invite link."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add person
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Courses</TH>
                {isSuperAdmin && <TH>Added by</TH>}
                <TH>Last active</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((user) => (
                <TR key={user.id}>
                  <TD className="font-medium text-slate-900 dark:text-slate-100">
                    <div>
                      {user.title ? `${user.title} ` : ""}
                      {user.name}
                    </div>
                    <div className="text-xs font-normal text-slate-400">{user.email}</div>
                  </TD>
                  <TD>
                    <Badge color={roleColor(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                  </TD>
                  <TD>
                    {user.role === "LECTURER" ? (
                      user.courses.length > 0 ? (
                        <span className="text-xs">{user.courses.map((c) => c.name).join(", ")}</span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-500">None assigned</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">
                        {user._count.createdUsers} account{user._count.createdUsers === 1 ? "" : "s"} added
                      </span>
                    )}
                  </TD>
                  {isSuperAdmin && (
                    <TD className="text-xs text-slate-500">{user.createdBy?.name ?? "—"}</TD>
                  )}
                  <TD className="text-xs text-slate-500">
                    {user.lastLoginAt ? dayjs(user.lastLoginAt).format("DD MMM YYYY, HH:mm") : "Never"}
                  </TD>
                  <TD>
                    <Badge color={statusColor(user.status)}>
                      {user.status === "PENDING" ? "AWAITING SETUP" : user.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {isSuperAdmin && user.status === "ACTIVE" && (
                        <a
                          href={`/api/admin/impersonate/${user.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${user.name}'s dashboard in a new tab`}
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 text-indigo-500" />
                          </Button>
                        </a>
                      )}
                      {user.status !== "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Generate a new invite link"
                          loading={inviteMutation.isPending && inviteMutation.variables?.id === user.id}
                          onClick={() => inviteMutation.mutate(user)}
                        >
                          <Link2 className="h-4 w-4 text-sky-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title={user.status === "INACTIVE" ? "Activate" : "Deactivate"}
                        onClick={() =>
                          statusMutation.mutate({ id: user.id, active: user.status === "INACTIVE" })
                        }
                      >
                        {user.status === "INACTIVE" ? (
                          <Power className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-amber-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit"
                        onClick={() => {
                          setEditing(user);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.id !== viewerId && (
                        <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeleting(user)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <UserFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        viewerRole={viewerRole}
        onInviteCreated={(user, inviteUrl) =>
          setInvite({ name: user.name, email: user.email, url: inviteUrl })
        }
      />

      <InviteLinkDialog
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        name={invite?.name ?? ""}
        email={invite?.email ?? ""}
        inviteUrl={invite?.url ?? ""}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete this account?"
        description={`This permanently removes the account for "${deleting?.name}". Deactivate them instead if you want to keep their history and revoke access.`}
      />
    </div>
  );
}
