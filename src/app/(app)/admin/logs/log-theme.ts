import type { UserRole } from "@/types";

/**
 * The palette that gives the log its at-a-glance structure. Colours are grouped
 * by consequence, not by feature: destructive actions are red, security events
 * are magenta/amber, and routine record-keeping is cool-toned — so a super admin
 * scanning a long feed spots the things that matter without reading every line.
 */
export type LogTone = {
  /** Tailwind text colour for the action tag. */
  tag: string;
  /** Short uppercase label rendered in the tag column. */
  label: string;
};

const FAMILY_TONES: Record<string, { tag: string }> = {
  auth: { tag: "text-cyan-400" },
  user: { tag: "text-fuchsia-400" },
  student: { tag: "text-emerald-400" },
  course: { tag: "text-sky-400" },
  module: { tag: "text-blue-400" },
  attendance: { tag: "text-lime-400" },
  assessment: { tag: "text-violet-400" },
  report: { tag: "text-teal-400" },
  settings: { tag: "text-orange-400" },
};

const VERB_OVERRIDES: Record<string, string> = {
  delete: "text-red-400",
  deactivate: "text-amber-400",
  login_failed: "text-red-400",
  impersonate_start: "text-amber-300",
  impersonate_end: "text-amber-300",
};

export function toneForAction(action: string): LogTone {
  const [family, verb = ""] = action.split(".");
  const base = FAMILY_TONES[family]?.tag ?? "text-slate-400";
  return {
    tag: VERB_OVERRIDES[verb] ?? base,
    label: action.toUpperCase().replace(".", " · "),
  };
}

/** Destructive and security-relevant lines get a left rail so they stand out. */
export function railForAction(action: string): string {
  const verb = action.split(".")[1] ?? "";
  if (verb === "delete" || verb === "login_failed") return "border-l-2 border-red-500/70";
  if (verb.startsWith("impersonate") || verb === "deactivate") return "border-l-2 border-amber-500/70";
  if (verb === "create" || verb === "login") return "border-l-2 border-emerald-500/40";
  return "border-l-2 border-transparent";
}

export const ROLE_TONES: Record<UserRole, string> = {
  SUPER_ADMIN: "text-fuchsia-300",
  ADMIN: "text-sky-300",
  LECTURER: "text-emerald-300",
};

export const ROLE_SHORT: Record<UserRole, string> = {
  SUPER_ADMIN: "root",
  ADMIN: "admin",
  LECTURER: "lect",
};
