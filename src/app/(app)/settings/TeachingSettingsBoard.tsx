"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Download } from "lucide-react";
import { toast } from "sonner";
import { teachingSettingsSchema, type TeachingSettingsInput } from "@/lib/validators/settings";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type TeachingSettings = TeachingSettingsInput & {
  institutionDefaults: TeachingSettingsInput;
  usingOwnValues: boolean;
};

/**
 * A lecturer's own marking bar. The administrator sets up the institution; the
 * person teaching the module decides what counts as enough attendance on it and
 * what counts as a pass.
 */
export function TeachingSettingsBoard() {
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState<TeachingSettings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teaching-settings"],
    queryFn: () => api.get<TeachingSettings>("/api/settings/teaching"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeachingSettingsInput>({ resolver: zodResolver(teachingSettingsSchema) });

  if (data && data !== synced) {
    setSynced(data);
    reset({
      attendanceThreshold: data.attendanceThreshold,
      assessmentPassMark: data.assessmentPassMark,
    });
  }

  const mutation = useMutation({
    mutationFn: (values: TeachingSettingsInput) =>
      api.patch<TeachingSettings>("/api/settings/teaching", values),
    onSuccess: () => {
      toast.success("Your marking settings were saved");
      queryClient.invalidateQueries({ queryKey: ["teaching-settings"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save settings");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The marks and attendance your own students are measured against.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Marking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <LoadingSpinner />
          ) : (
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="attendanceThreshold">Minimum Attendance Threshold (%)</Label>
                  <Input
                    id="attendanceThreshold"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    error={errors.attendanceThreshold?.message}
                    {...register("attendanceThreshold", { valueAsNumber: true })}
                  />
                  <FieldError message={errors.attendanceThreshold?.message} />
                  <p className="mt-1 text-xs text-slate-400">
                    Your attendance reports flag students below this as &quot;LOW&quot;. Institution default:{" "}
                    {data.institutionDefaults.attendanceThreshold}%.
                  </p>
                </div>
                <div>
                  <Label htmlFor="assessmentPassMark">Assessment Pass Mark (%)</Label>
                  <Input
                    id="assessmentPassMark"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    error={errors.assessmentPassMark?.message}
                    {...register("assessmentPassMark", { valueAsNumber: true })}
                  />
                  <FieldError message={errors.assessmentPassMark?.message} />
                  <p className="mt-1 text-xs text-slate-400">
                    Students at or above this are marked PASS, below it REDO. Institution default:{" "}
                    {data.institutionDefaults.assessmentPassMark}%.
                  </p>
                </div>
              </div>

              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {data.usingOwnValues
                  ? "These are your own figures. They apply to every report and student record you generate."
                  : "You are currently using the institution defaults. Saving here sets your own figures."}
              </p>

              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting || mutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Getting Started Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A printable guide covering login and every feature of the system, from the dashboard to
            generating reports.
          </p>
          <a href="/api/getting-started-guide" target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="h-4 w-4" /> Download Getting Started Guide
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
