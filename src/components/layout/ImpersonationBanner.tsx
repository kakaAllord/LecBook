"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/**
 * Always-visible reminder that the current view belongs to someone else. The
 * view-as session is cookie-based, so it also applies to any other tab — this
 * banner is what makes that obvious and reversible from anywhere.
 */
export function ImpersonationBanner({
  targetId,
  targetName,
  targetRole,
  actorName,
}: {
  targetId: string;
  targetName: string;
  targetRole: string;
  actorName: string;
}) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    try {
      await api.delete(`/api/admin/impersonate/${targetId}`);
      toast.success("Back to your own account");
      router.push("/admin/users");
      router.refresh();
    } catch {
      toast.error("Could not exit view-as mode");
      setExiting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          <strong>{actorName}</strong> — you are viewing LecBook as{" "}
          <strong>{targetName}</strong> ({targetRole.replace("_", " ").toLowerCase()}). This view is
          read-only.
        </span>
      </div>
      <button
        onClick={exit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-3 py-1 font-medium transition-colors hover:bg-amber-950/20 disabled:opacity-60"
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? "Exiting..." : "Exit view-as"}
      </button>
    </div>
  );
}
