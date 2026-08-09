"use client";

import { useState } from "react";
import { Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/**
 * Shown once an account is created. The link is the entire onboarding handoff —
 * the admin copies it and sends it to the lecturer however they normally
 * communicate, and the lecturer does the rest.
 */
export function InviteLinkDialog({
  open,
  onClose,
  name,
  email,
  inviteUrl,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually");
    }
  }

  const mailto = `mailto:${email}?subject=${encodeURIComponent(
    "Your LecBook account"
  )}&body=${encodeURIComponent(
    `Hi ${name},\n\nAn account has been created for you on LecBook.\n\nOpen this link to set your password and finish setting up:\n${inviteUrl}\n\nThe link expires in 14 days.\n`
  )}`;

  return (
    <Dialog open={open} onClose={onClose} title="Send this invite link" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{name}</strong> ({email}) has been added. Send them this one-time link so they can set
          their password and start using the system. It expires in 14 days.
        </p>

        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700 dark:text-slate-300">
            {inviteUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          Anyone holding this link can activate the account, so share it directly with them.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <a href={mailto}>
            <Button type="button" variant="outline">
              <Mail className="h-4 w-4" /> Open in email
            </Button>
          </a>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
