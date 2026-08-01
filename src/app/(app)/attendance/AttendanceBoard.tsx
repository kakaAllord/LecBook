"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { History, Save, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { AttendanceForDate, AttendanceStatus, Course } from "@/types";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { AttendanceStatusToggle } from "@/components/attendance/AttendanceStatusPicker";

type DraftRecord = { status: AttendanceStatus; remarks: string };

export function AttendanceBoard() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [courseId, setCourseId] = useState(searchParams.get("courseId") ?? "");
  const [date, setDate] = useState(searchParams.get("date") ?? dayjs().format("YYYY-MM-DD"));
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({});
  const [syncedData, setSyncedData] = useState<AttendanceForDate | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["attendance", courseId, date],
    queryFn: () => api.get<AttendanceForDate>(`/api/attendance?courseId=${courseId}&date=${date}`),
    enabled: Boolean(courseId && date),
  });

  if (data && data !== syncedData) {
    setSyncedData(data);
    const next: Record<string, DraftRecord> = {};
    for (const entry of data.students) {
      next[entry.student.id] = {
        status: entry.attendance?.status ?? "PRESENT",
        remarks: entry.attendance?.remarks ?? "",
      };
    }
    setDrafts(next);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post("/api/attendance", {
        courseId,
        date,
        records: Object.entries(drafts).map(([studentId, d]) => ({
          studentId,
          status: d.status,
          remarks: d.remarks,
        })),
      }),
    onSuccess: () => {
      toast.success("Attendance saved");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save attendance");
    },
  });

  const summary = useMemo(() => {
    const values = Object.values(drafts);
    return {
      present: values.filter((v) => v.status === "PRESENT").length,
      absent: values.filter((v) => v.status === "ABSENT").length,
    };
  }, [drafts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Choose a course and date to mark attendance.</p>
        </div>
        <Link href="/attendance/history">
          <Button variant="outline">
            <History className="h-4 w-4" /> View History
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-72">
          <Label htmlFor="course">Course</Label>
          <Select id="course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course...</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level} · {c.semester}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-48">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={dayjs().format("YYYY-MM-DD")} />
        </div>
      </div>

      {!courseId ? (
        <EmptyState icon={ClipboardCheck} title="Select a course" description="Choose a course above to load its students." />
      ) : isLoading || isFetching ? (
        <LoadingSpinner />
      ) : !data || data.students.length === 0 ? (
        <EmptyState title="No active students" description="This course has no active students to mark attendance for." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Present: {summary.present}
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              Absent: {summary.absent}
            </span>
          </div>

          {/* Mobile: stacked cards, one per student */}
          <div className="space-y-3 md:hidden">
            {data.students.map(({ student }) => {
              const draft = drafts[student.id] ?? { status: "PRESENT" as AttendanceStatus, remarks: "" };
              return (
                <div
                  key={student.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{student.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{student.registrationNumber}</p>
                    </div>
                    <AttendanceStatusToggle
                      value={draft.status}
                      onChange={(status) =>
                        setDrafts((prev) => ({ ...prev, [student.id]: { ...draft, status } }))
                      }
                    />
                  </div>
                  <Input
                    value={draft.remarks}
                    placeholder="Remarks (optional)"
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [student.id]: { ...draft, remarks: e.target.value } }))
                    }
                    className="mt-3"
                  />
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Reg. No</TH>
                  <TH>Name</TH>
                  <TH>Status</TH>
                  <TH>Remarks</TH>
                </TR>
              </THead>
              <TBody>
                {data.students.map(({ student }) => {
                  const draft = drafts[student.id] ?? { status: "PRESENT" as AttendanceStatus, remarks: "" };
                  return (
                    <TR key={student.id}>
                      <TD className="font-medium text-slate-900 dark:text-slate-100">{student.registrationNumber}</TD>
                      <TD>{student.fullName}</TD>
                      <TD>
                        <AttendanceStatusToggle
                          value={draft.status}
                          onChange={(status) =>
                            setDrafts((prev) => ({ ...prev, [student.id]: { ...draft, status } }))
                          }
                        />
                      </TD>
                      <TD>
                        <Input
                          value={draft.remarks}
                          placeholder="Optional"
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [student.id]: { ...draft, remarks: e.target.value } }))
                          }
                          className="min-w-[160px]"
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>

          <div className="flex justify-center sm:justify-end">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} className="w-full sm:w-auto">
              <Save className="h-4 w-4" /> Save Attendance
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
