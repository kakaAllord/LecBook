"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Plus, Pencil, Trash2, GraduationCap, Link2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { ManagedUser, Paginated } from "@/types";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { LecturerFormDialog } from "./LecturerFormDialog";
import { InviteLinkDialog } from "@/components/invite/InviteLinkDialog";

function statusColor(status: string) {
  return status === "ACTIVE" ? "emerald" : status === "PENDING" ? "amber" : "rose";
}

/**
 * The administrator's staff page: add a lecturer, decide which modules they
 * teach, hand them the invite link, and switch access on or off.
 */
export function LecturersBoard() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; url: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "10", role: "LECTURER" });
      if (search) params.set("search", search);
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
    mutationFn: (lecturer: ManagedUser) =>
      api
        .post<{ inviteUrl: string }>(`/api/admin/users/${lecturer.id}/invite`)
        .then((result) => ({ lecturer, inviteUrl: result.inviteUrl })),
    onSuccess: ({ lecturer, inviteUrl }) => {
      setInvite({ name: lecturer.name, email: lecturer.email, url: inviteUrl });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not create an invite link"
      );
    },
  });

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Lecturers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The lecturers you have added and the modules each of them teaches.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add lecturer
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
          icon={GraduationCap}
          title="No lecturers yet"
          description="Add a lecturer, tick the modules they teach, and send them the invite link."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add lecturer
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Modules</TH>
                <TH>Last active</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((lecturer) => (
                <TR key={lecturer.id}>
                  <TD className="font-medium text-slate-900 dark:text-slate-100">
                    <div>
                      {lecturer.title ? `${lecturer.title} ` : ""}
                      {lecturer.name}
                    </div>
                    <div className="text-xs font-normal text-slate-400">{lecturer.email}</div>
                  </TD>
                  <TD>
                    {lecturer.modules.length > 0 ? (
                      <span className="text-xs">
                        {lecturer.modules.map((m) => m.name).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-500">None assigned</span>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-500">
                    {lecturer.lastLoginAt
                      ? dayjs(lecturer.lastLoginAt).format("DD MMM YYYY, HH:mm")
                      : "Never"}
                  </TD>
                  <TD>
                    <Badge color={statusColor(lecturer.status)}>
                      {lecturer.status === "PENDING" ? "AWAITING SETUP" : lecturer.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {lecturer.status !== "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Generate a new invite link"
                          loading={
                            inviteMutation.isPending && inviteMutation.variables?.id === lecturer.id
                          }
                          onClick={() => inviteMutation.mutate(lecturer)}
                        >
                          <Link2 className="h-4 w-4 text-sky-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title={lecturer.status === "INACTIVE" ? "Activate" : "Deactivate"}
                        onClick={() =>
                          statusMutation.mutate({
                            id: lecturer.id,
                            active: lecturer.status === "INACTIVE",
                          })
                        }
                      >
                        {lecturer.status === "INACTIVE" ? (
                          <Power className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-amber-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit details and modules"
                        onClick={() => {
                          setEditing(lecturer);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete"
                        onClick={() => setDeleting(lecturer)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
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

      <LecturerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        lecturer={editing}
        onInviteCreated={(lecturer, inviteUrl) =>
          setInvite({ name: lecturer.name, email: lecturer.email, url: inviteUrl })
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
