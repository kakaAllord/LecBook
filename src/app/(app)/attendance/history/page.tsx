"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AttendanceHistoryEntry, Course } from "@/types";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AttendanceHistoryPage() {
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["attendance-history", courseId, from, to],
    queryFn: () =>
      api.get<AttendanceHistoryEntry[]>(
        `/api/attendance/history?courseId=${courseId}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`
      ),
    enabled: Boolean(courseId),
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/attendance" className="mb-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Attendance
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Review and edit past attendance records.</p>
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
        <div className="sm:w-44">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="sm:w-44">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!courseId ? (
        <EmptyState title="Select a course" description="Choose a course above to view its attendance history." />
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
                  <div className="flex justify-end">
                    <Link href={`/attendance?courseId=${courseId}&date=${dayjs(entry.date).format("YYYY-MM-DD")}`}>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
