"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { ACADEMIC_CALENDAR, FINAL_LEVEL, LEVELS, levelLabel } from "@/lib/levels";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SearchInput } from "@/components/ui/SearchInput";

type Candidate = {
  id: string;
  registrationNumber: string;
  fullName: string;
  course: string;
  verdict: "PASSED" | "FAILED" | "NO_MARKS";
  modules: { label: string; average: number; passMark: number; passed: boolean; graded: number; total: number }[];
};

const VERDICT = {
  PASSED: { label: "Passed", color: "emerald" },
  FAILED: { label: "Not passed", color: "rose" },
  NO_MARKS: { label: "No marks", color: "slate" },
} as const;

/**
 * The yearly step up. The administrator picks a level, sees everyone active on
 * it with whether they passed, and confirms who moves on. Students who passed
 * are ticked already; anyone can be ticked or unticked before confirming.
 */
export function PromotionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(1);
  // null until the administrator changes a tick: until then the ticked set is
  // "everyone who passed", worked out from whatever list is loaded.
  const [override, setOverride] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["promotion", level],
    queryFn: () => api.get<{ level: number; students: Candidate[] }>(`/api/students/promotion?level=${level}`),
    enabled: open,
  });

  const passedIds = (data?.students ?? []).filter((s) => s.verdict === "PASSED").map((s) => s.id);
  const chosen = override ?? passedIds;
  const setChosen = (update: (prev: string[]) => string[]) => setOverride(update(chosen));

  const target = level >= FINAL_LEVEL ? "Completed" : levelLabel(level + 1);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ promoted: number; skipped: number; to: string }>("/api/students/promotion", {
        fromLevel: level,
        studentIds: chosen,
      }),
    onSuccess: (result) => {
      toast.success(`${result.promoted} student${result.promoted === 1 ? "" : "s"} moved to ${result.to}`);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["promotion"] });
      setOverride(null);
      onClose();
    },
    onError: (error) => toast.error(error instanceof ApiClientError ? error.message : "Something went wrong"),
  });

  const students = (data?.students ?? []).filter((s) =>
    `${s.fullName} ${s.registrationNumber} ${s.course}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const counts = {
    PASSED: data?.students.filter((s) => s.verdict === "PASSED").length ?? 0,
    FAILED: data?.students.filter((s) => s.verdict === "FAILED").length ?? 0,
    NO_MARKS: data?.students.filter((s) => s.verdict === "NO_MARKS").length ?? 0,
  };

  return (
    <Dialog open={open} onClose={onClose} title="Promote students" size="xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <Label htmlFor="promote-level">Promote from</Label>
            <Select
              id="promote-level"
              value={level}
              onChange={(e) => {
                setLevel(Number(e.target.value));
                setOverride(null);
              }}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {levelLabel(l)} → {l >= FINAL_LEVEL ? "Completed" : levelLabel(l + 1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="font-medium text-slate-700 dark:text-slate-200">Academic year</p>
            {ACADEMIC_CALENDAR.map((row) => (
              <p key={row.levels}>
                {row.levels}: {row.runs}, {row.semesters} semesters.
              </p>
            ))}
            <p className="mt-1">
              &ldquo;Passed&rdquo; means every module they were marked in at this level reached its lecturer&apos;s pass
              mark.
            </p>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : !data || data.students.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No active students at {levelLabel(level)}.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge color="emerald">{counts.PASSED} passed</Badge>
                <Badge color="rose">{counts.FAILED} not passed</Badge>
                <Badge color="slate">{counts.NO_MARKS} with no marks</Badge>
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Find a student..." className="sm:w-64" />
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Tick every student shown"
                        checked={students.length > 0 && students.every((s) => chosen.includes(s.id))}
                        onChange={(e) => {
                          const ids = students.map((s) => s.id);
                          setChosen((prev) =>
                            e.target.checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((s) => (
                    <Fragment key={s.id}>
                      <tr className="align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Promote ${s.fullName}`}
                            checked={chosen.includes(s.id)}
                            onChange={(e) =>
                              setChosen((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{s.fullName}</p>
                          <p className="text-xs text-slate-400">{s.registrationNumber}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.course}</td>
                        <td className="px-3 py-2">
                          <Badge color={VERDICT[s.verdict].color}>{VERDICT[s.verdict].label}</Badge>
                          {s.modules.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                              className="ml-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              {expanded === s.id ? "Hide modules" : `${s.modules.length} module${s.modules.length === 1 ? "" : "s"}`}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === s.id && (
                        <tr>
                          <td />
                          <td colSpan={3} className="px-3 pb-3">
                            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {s.modules.map((m) => (
                                <li key={m.label}>
                                  {m.label}:{" "}
                                  {m.graded > 0 ? (
                                    <span className={m.passed ? "text-emerald-600" : "text-rose-600"}>
                                      {m.average}% (pass mark {m.passMark}%)
                                    </span>
                                  ) : (
                                    "nothing marked"
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {chosen.length} ticked → {target}. Unticked students stay at {levelLabel(level)}.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={mutation.isPending} disabled={chosen.length === 0} onClick={() => mutation.mutate()}>
              Promote {chosen.length} to {target}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
