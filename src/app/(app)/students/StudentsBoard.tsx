"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users, FileDown, GraduationCap, Layers } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course, Paginated, Student } from "@/types";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, studentStatusColor } from "@/components/ui/Badge";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentExportDialog } from "./StudentExportDialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { LEVELS, levelLabel } from "@/lib/levels";
import { PromotionDialog } from "./PromotionDialog";
import { SetLevelDialog } from "./SetLevelDialog";

export function StudentsBoard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [settingLevel, setSettingLevel] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [exporting, setExporting] = useState<Student | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, courseId, level, status, page],
    queryFn: () =>
      api.get<Paginated<Student>>(
        `/api/students?search=${encodeURIComponent(search)}&courseId=${courseId}&level=${level}&status=${status}&page=${page}&pageSize=10`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/students/${id}`),
    onSuccess: () => {
      toast.success("Student deleted");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to delete student");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {canManage
              ? "Register and manage student records. Students move up a level when you promote those who passed."
              : "Students on the courses and levels you teach."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPromoting(true)}>
              <GraduationCap className="h-4 w-4" /> Promote students
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Register Student
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, reg. no, or phone..."
          className="sm:max-w-xs"
        />
        <SearchableSelect
          value={courseId}
          onChange={(value) => {
            setCourseId(value);
            setPage(1);
          }}
          className="w-full sm:max-w-xs"
          emptyOption="All courses"
          options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[150px]"
          aria-label="Level"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {levelLabel(l)}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[160px]"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="COMPLETED">Completed</option>
        </Select>
      </div>

      {canManage && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <span className="font-medium text-indigo-900 dark:text-indigo-100">
            {selected.length} student{selected.length === 1 ? "" : "s"} selected
          </span>
          <Button size="sm" onClick={() => setSettingLevel(true)}>
            <Layers className="h-4 w-4" /> Set level
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description={
            canManage
              ? "Register a student to get started."
              : "No students have been registered in your courses yet."
          }
          action={
            canManage ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Register Student
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                {canManage && (
                  <TH className="w-8">
                    <input
                      type="checkbox"
                      aria-label="Select every student on this page"
                      checked={data.items.every((s) => selected.includes(s.id))}
                      onChange={(e) => {
                        const ids = data.items.map((s) => s.id);
                        setSelected((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, ...ids]))
                            : prev.filter((id) => !ids.includes(id))
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </TH>
                )}
                <TH>Reg. No</TH>
                <TH>Full Name</TH>
                <TH>Gender</TH>
                <TH>Phone</TH>
                <TH>Course</TH>
                <TH>Level</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((student) => (
                <TR key={student.id}>
                  {canManage && (
                    <TD>
                      <input
                        type="checkbox"
                        aria-label={`Select ${student.fullName}`}
                        checked={selected.includes(student.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id)
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </TD>
                  )}
                  <TD className="font-medium text-slate-900 dark:text-slate-100">{student.registrationNumber}</TD>
                  <TD>{student.fullName}</TD>
                  <TD>{student.gender}</TD>
                  <TD>{student.phone || "-"}</TD>
                  <TD>{student.course?.name ?? "-"}</TD>
                  <TD>{levelLabel(student.level)}</TD>
                  <TD>
                    <Badge color={studentStatusColor(student.status)}>{student.status}</Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Export this student's records"
                        onClick={() => setExporting(student)}
                      >
                        <FileDown className="h-4 w-4 text-indigo-500" />
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit"
                            onClick={() => {
                              setEditing(student);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            onClick={() => setDeleting(student)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
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

      <StudentFormDialog open={formOpen} onClose={() => setFormOpen(false)} student={editing} defaultCourseId={courseId || undefined} />

      {canManage && (
        <>
          <SetLevelDialog
            open={settingLevel}
            onClose={() => setSettingLevel(false)}
            studentIds={selected}
            onDone={() => setSelected([])}
          />
          <PromotionDialog open={promoting} onClose={() => setPromoting(false)} />
        </>
      )}

      <StudentExportDialog
        open={Boolean(exporting)}
        onClose={() => setExporting(null)}
        student={exporting}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete student?"
        description={`This will permanently delete "${deleting?.fullName}" and their attendance and marks history.`}
      />
    </div>
  );
}
