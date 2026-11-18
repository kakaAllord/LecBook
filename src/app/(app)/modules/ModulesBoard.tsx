"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Module, Paginated } from "@/types";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { LEVELS, levelLabel } from "@/lib/levels";
import { ModuleFormDialog } from "./ModuleFormDialog";

export function ModulesBoard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [deleting, setDeleting] = useState<Module | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["modules", search, kind, level, page],
    queryFn: () =>
      api.get<Paginated<Module>>(
        `/api/modules?search=${encodeURIComponent(search)}&kind=${kind}&level=${level}&page=${page}&pageSize=10`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/modules/${id}`),
    onSuccess: () => {
      toast.success("Module deleted");
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to delete module");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Modules</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Each course has one core module, named after it and taught from Level I to Level III. Related
            modules belong to a level and are taught to every course at it.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New Related Module
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, code or course..."
          className="sm:max-w-sm"
        />
        <Select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[180px]"
          aria-label="Kind of module"
        >
          <option value="">Core and related</option>
          <option value="CORE">Core only</option>
          <option value="RELATED">Related only</option>
        </Select>
        <Select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[160px]"
          aria-label="Level"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {levelLabel(l)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No modules found"
          description="Core modules appear as courses are added. Add a related module for a level here."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Related Module
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Kind</TH>
                <TH>Level</TH>
                <TH>Taught to</TH>
                <TH>Code</TH>
                <TH>Lecturers</TH>
                <TH>Assessments</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((module_) => (
                <TR key={module_.id}>
                  <TD className="font-medium text-slate-900 dark:text-slate-100">{module_.name}</TD>
                  <TD>
                    <Badge color={module_.kind === "CORE" ? "indigo" : "sky"}>
                      {module_.kind === "CORE" ? "Core" : "Related"}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap">{module_.kind === "CORE" ? "Level I – III" : levelLabel(module_.level ?? 1)}</TD>
                  <TD>{module_.kind === "CORE" ? module_.course?.name : "Every course"}</TD>
                  <TD>{module_.code || "-"}</TD>
                  <TD>{module_._count?.assignments ? "Assigned" : <span className="text-amber-600">None yet</span>}</TD>
                  <TD>{module_._count?.assessments ?? 0}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(module_);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {/* A core module goes only with its course. */}
                      {module_.kind === "RELATED" && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(module_)}>
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

      <ModuleFormDialog open={formOpen} onClose={() => setFormOpen(false)} module={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete module?"
        description={`This will permanently delete "${deleting?.name}". Modules with attendance or assessments recorded against them cannot be deleted.`}
      />
    </div>
  );
}
