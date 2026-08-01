"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Download, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { settingsSchema, type SettingsInput } from "@/lib/validators/settings";
import { api, ApiClientError } from "@/lib/api-client";
import type { Settings } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const MAX_LOGO_DIMENSION = 240;
const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [syncedSettings, setSyncedSettings] = useState<Settings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/api/settings"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });

  if (data && data !== syncedSettings) {
    setSyncedSettings(data);
    reset({ institutionName: data.institutionName });
    setLogo(data.institutionLogo);
  }

  const mutation = useMutation({
    mutationFn: (values: SettingsInput) => api.patch<Settings>("/api/settings", values),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save settings");
    },
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      toast.error("Logo image must be under 5MB");
      return;
    }

    setLogoProcessing(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setLogo(dataUrl);
    } catch {
      toast.error("Could not process that image");
    } finally {
      setLogoProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          System-wide configuration used across the app and generated reports.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-indigo-600" /> General
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <form
              onSubmit={handleSubmit((values) => mutation.mutate({ ...values, institutionLogo: logo }))}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="institutionName">Institution Name</Label>
                <Input
                  id="institutionName"
                  placeholder="Your Institution Name"
                  error={errors.institutionName?.message}
                  {...register("institutionName")}
                />
                <FieldError message={errors.institutionName?.message} />
                <p className="mt-1 text-xs text-slate-400">
                  Shown in the sidebar and printed at the top of every generated PDF report.
                </p>
              </div>

              <div>
                <Label htmlFor="institutionLogo">Institution Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="Institution logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      id="institutionLogo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={logoProcessing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" /> {logo ? "Replace" : "Upload"}
                    </Button>
                    {logo && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
                <FieldError message={errors.institutionLogo?.message} />
                <p className="mt-1 text-xs text-slate-400">
                  Shown in the sidebar and printed at the top of every generated PDF report.
                </p>
              </div>

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
            A printable guide covering login and every feature of the system, from the dashboard to generating
            reports.
          </p>
          <a href="/getting-started-guide.pdf" target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="h-4 w-4" /> Download Getting Started Guide
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
