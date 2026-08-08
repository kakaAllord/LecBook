"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft, Pencil, Wrench, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { AttendanceHistoryEntry, Module } from "@/types";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FixSessionDialog, type SessionRef } from "./FixSessionDialog";

export default function AttendanceHistoryPage() {
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fixing, setFixing] = useState<SessionRef | null>(null);
  const [deleting, setDeleting] = useState<SessionRef | null>(null);

  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
  });

  const selectedModule = modules?.find((m) => m.id === moduleId);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["attendance-history", moduleId, courseId, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ moduleId });
      if (courseId) params.set("courseIds", courseId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api.get<AttendanceHistoryEntry[]>(`/api/attendance/history?${params.toString()}`);
    },
    enabled: Boolean(moduleId),
  });

  const scopedCourseIds = courseId ? [courseId] : selectedModule?.courses.map((c) => c.id) ?? [];

  const editHref = (date: string) => {
    const params = new URLSearchParams({ moduleId, date: dayjs(date).format("YYYY-MM-DD") });
    params.set("courseIds", scopedCourseIds.join(","));
    return `/attendance?${params.toString()}`;
  };

  const sessionRef = (entry: AttendanceHistoryEntry): SessionRef => ({
    moduleId,
    moduleName: selectedModule?.name ?? "this module",
    date: entry.date,
    courseIds: scopedCourseIds,
    total: entry.total,
  });

  const deleteMutation = useMutation({
    mutationFn: (target: SessionRef) =>
      api.delete<{ deleted: number }>("/api/attendance/session", {
        moduleId: target.moduleId,
        date: target.date,
        courseIds: target.courseIds,
      }),
    onSuccess: ({ deleted }) => {
      toast.success(`Deleted ${deleted} attendance record${deleted === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not delete this session");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/attendance" className="mb-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Attendance
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Review past sessions, correct individual marks, or fix a whole session saved against the
          wrong module, date or courses.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Label htmlFor="module">Module</Label>
          <Select
            id="module"
            value={moduleId}
            onChange={(e) => {
              setModuleId(e.target.value);
              setCourseId("");
            }}
          >
            <option value="">Select a module...</option>
            {modules?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-56">
          <Label htmlFor="course">Course</Label>
          <Select id="course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!moduleId}>
            <option value="">All courses</option>
            {selectedModule?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-44">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="sm:w-44">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!moduleId ? (
        <EmptyState title="Select a module" description="Choose a module above to view its attendance history." />
      ) : isLoading || isFetching ? (
        <LoadingSpinner />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No attendance recorded" description="No attendance has been recorded for this range yet." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Present</TH>
              <TH>Absent</TH>
              <TH>Total</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((entry) => (
              <TR key={entry.date}>
                <TD className="font-medium text-slate-900 dark:text-slate-100">
                  {dayjs(entry.date).format("DD MMM YYYY")}
                </TD>
                <TD>{entry.present}</TD>
                <TD>{entry.absent}</TD>
                <TD>{entry.total}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Link href={editHref(entry.date)}>
                      <Button variant="ghost" size="sm" title="Change who was present or absent">
                        <Pencil className="h-4 w-4" /> Marks
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Wrong module, date or courses"
                      onClick={() => setFixing(sessionRef(entry))}
                    >
                      <Wrench className="h-4 w-4 text-amber-500" /> Fix
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete this whole session"
                      onClick={() => setDeleting(sessionRef(entry))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <FixSessionDialog
        open={Boolean(fixing)}
        onClose={() => setFixing(null)}
        session={fixing}
        modules={modules ?? []}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        loading={deleteMutation.isPending}
        title="Delete this session?"
        description={`This permanently removes all ${deleting?.total ?? 0} attendance records saved for ${deleting?.moduleName} on ${deleting ? dayjs(deleting.date).format("DD MMM YYYY") : ""}.`}
      />
    </div>
  );
}
