"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Module } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";

export type SessionRef = {
  moduleId: string;
  moduleName: string;
  date: string;
  courseIds: string[];
  total: number;
};

/**
 * Repairs an already-saved session. Marking one student wrong is fixed by
 * reopening the day, but a session filed against the wrong module, the wrong
 * date, or with a course that wasn't actually there needs the whole set of
 * records rekeyed — which is what this does.
 */
export function FixSessionDialog({
  open,
  onClose,
  session,
  modules,
}: {
  open: boolean;
  onClose: () => void;
  session: SessionRef | null;
  modules: Module[];
}) {
  const queryClient = useQueryClient();
  const [targetModuleId, setTargetModuleId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetCourseIds, setTargetCourseIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && session) {
      setTargetModuleId(session.moduleId);
      setTargetDate(dayjs(session.date).format("YYYY-MM-DD"));
      setTargetCourseIds(session.courseIds);
    }
  }, [open, session]);

  const targetModule = modules.find((m) => m.id === targetModuleId);

  // Switching module invalidates any course selection from the previous one.
  function handleModuleChange(id: string) {
    setTargetModuleId(id);
    const next = modules.find((m) => m.id === id);
    setTargetCourseIds(next ? next.courses.map((c) => c.id) : []);
  }

  const moveMutation = useMutation({
    mutationFn: () =>
      api.patch<{ moved: number; removed: number }>("/api/attendance/session", {
        moduleId: session!.moduleId,
        date: session!.date,
        courseIds: session!.courseIds,
        targetModuleId,
        targetDate,
        targetCourseIds,
      }),
    onSuccess: ({ moved, removed }) => {
      toast.success(
        `Moved ${moved} record${moved === 1 ? "" : "s"}${removed > 0 ? `, removed ${removed}` : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not move this session");
    },
  });

  if (!session) return null;

  const unchanged =
    targetModuleId === session.moduleId &&
    targetDate === dayjs(session.date).format("YYYY-MM-DD") &&
    targetCourseIds.length === session.courseIds.length &&
    targetCourseIds.every((id) => session.courseIds.includes(id));

  const droppingCourses = session.courseIds.filter((id) => !targetCourseIds.includes(id)).length;

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Fix this attendance session">
      <div className="space-y-4">
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p className="text-slate-500 dark:text-slate-400">Currently saved as</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {session.moduleName} · {dayjs(session.date).format("DD MMM YYYY")} · {session.total} records
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fix-module">Module it should be under</Label>
            <Select
              id="fix-module"
              value={targetModuleId}
              onChange={(e) => handleModuleChange(e.target.value)}
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.code ? ` (${m.code})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fix-date">Date it should be on</Label>
            <Input
              id="fix-date"
              type="date"
              value={targetDate}
              max={dayjs().format("YYYY-MM-DD")}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="fix-courses">Courses that actually attended</Label>
          <CheckboxGroup
            options={(targetModule?.courses ?? []).map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            value={targetCourseIds}
            onChange={setTargetCourseIds}
          />
          <p className="mt-1 text-xs text-slate-400">
            Unticking a course deletes that course&apos;s records for this session.
          </p>
        </div>

        {droppingCourses > 0 && (
          <div className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {droppingCourses} course{droppingCourses === 1 ? "'s" : "s'"} attendance records for this
              session will be deleted.
            </span>
          </div>
        )}

        <p className="text-xs text-slate-400">
          If a record already exists on the destination module and date for the same student, it is
          replaced by the one being moved.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={unchanged || targetCourseIds.length === 0}
            loading={moveMutation.isPending}
            onClick={() => moveMutation.mutate()}
          >
            Apply correction
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
