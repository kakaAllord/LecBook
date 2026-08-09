"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { UserCog, ExternalLink, Power, PowerOff, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/Badge";
import { InviteLinkDialog } from "@/components/invite/InviteLinkDialog";
import { AdminFormDialog } from "./AdminFormDialog";

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

/**
 * Every account in the system, and exactly two things to do with one: open it
 * and see what its owner sees, or switch it off. Records are authored inside
 * the account that owns them — this page observes and gates.
 */
export function UsersBoard() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every administrator and lecturer on the system. Open an account to see exactly what they
            see, or switch their access on and off.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add administrator
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
          description="Add an administrator to get an institution started — the lecturers they add appear here too."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add administrator
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
                <TH>Scope</TH>
                <TH>Added by</TH>
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
                      user.modules.length > 0 ? (
                        <span className="text-xs">{user.modules.map((m) => m.name).join(", ")}</span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-500">
                          No modules assigned
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">
                        {user._count.createdUsers} account{user._count.createdUsers === 1 ? "" : "s"} added
                      </span>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-500">{user.createdBy?.name ?? "—"}</TD>
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
                      {user.status === "ACTIVE" && (
                        <a
                          href={`/api/admin/impersonate/${user.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open the dashboard of ${user.name} in a new tab`}
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 text-violet-500" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title={user.status === "INACTIVE" ? "Activate account" : "Deactivate account"}
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
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <AdminFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onInviteCreated={(admin, inviteUrl) =>
          setInvite({ name: admin.name, email: admin.email, url: inviteUrl })
        }
      />

      <InviteLinkDialog
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        name={invite?.name ?? ""}
        email={invite?.email ?? ""}
        inviteUrl={invite?.url ?? ""}
      />
    </div>
  );
}
