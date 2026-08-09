"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { acceptInviteSchema, type AcceptInviteInput } from "@/lib/validators/user";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type InviteDetails = {
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "LECTURER";
  title: string | null;
  phone: string | null;
  staffId: string | null;
  modules: { id: string; name: string; code: string | null }[];
  expiresAt: string;
};

/**
 * The last step of onboarding, and the only one the invited person does: choose
 * a password. Everything else about the account was entered by the administrator
 * who created it, and is shown here to be checked rather than re-typed.
 */
export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.get<InviteDetails>(`/api/invite/${token}`),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteInput>({ resolver: zodResolver(acceptInviteSchema) });

  const mutation = useMutation({
    mutationFn: (values: AcceptInviteInput) => api.post(`/api/invite/${token}`, values),
    onSuccess: () => {
      toast.success("Your account is ready. Sign in to get started.");
      router.push("/login");
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Could not complete setup");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof ApiClientError ? error.message : "This invite link is not valid.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Invite link unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Ask your administrator to send you a new link.
          </p>
        </div>
      </div>
    );
  }

  const details: [string, string][] = [
    ["Name", `${data.title ? `${data.title} ` : ""}${data.name}`],
    ["Email", data.email],
    ["Phone", data.phone || "—"],
    ["Staff ID", data.staffId || "—"],
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="LecBook" className="h-12 w-12" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Welcome to LecBook
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your {data.role === "ADMIN" ? "administrator" : "lecturer"} account is ready. Choose a
            password and it is yours.
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your account</p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[90px_1fr]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-400">{label}</dt>
                <dd className="truncate font-medium text-slate-900 dark:text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>

          {data.modules.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <BookOpen className="h-3.5 w-3.5" /> Modules assigned to you
              </p>
              <ul className="space-y-1">
                {data.modules.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {m.name}
                    {m.code ? ` (${m.code})` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                Their students are already registered — you&apos;ll see them as soon as you sign in.
              </p>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Anything wrong here? Ask your administrator to correct it — they own these details.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={mutation.isPending}>
            Set my password and activate
          </Button>
        </form>
      </div>
    </div>
  );
}
