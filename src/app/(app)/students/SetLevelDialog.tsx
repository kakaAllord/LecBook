"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { LEVELS, levelLabel } from "@/lib/levels";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

/**
 * Puts the ticked students at one level. Promotion is the everyday way levels
 * change; this is for correcting them — after a student is registered at the
 * wrong level, or when the system is first set up with students already part
 * way through.
 */
export function SetLevelDialog({
  open,
  onClose,
  studentIds,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  studentIds: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(1);

  const mutation = useMutation({
    mutationFn: () => api.patch<{ updated: number }>("/api/students/levels", { studentIds, level }),
    onSuccess: ({ updated }) => {
      toast.success(`${updated} student${updated === 1 ? "" : "s"} set to ${levelLabel(level)}`);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onDone();
      onClose();
    },
    onError: (error) => toast.error(error instanceof ApiClientError ? error.message : "Something went wrong"),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Set level" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Put the {studentIds.length} selected student{studentIds.length === 1 ? "" : "s"} at:
        </p>
        <div>
          <Label htmlFor="bulk-level">Level</Label>
          <Select id="bulk-level" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-slate-400">
          Use this to correct levels. To move students up after a year, use &ldquo;Promote students&rdquo;, which
          checks who passed.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Set level
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
