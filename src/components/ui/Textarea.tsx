import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500",
          "bg-white dark:bg-slate-900 dark:text-slate-100",
          error ? "border-red-400 focus:ring-red-400" : "border-slate-300 dark:border-slate-700",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
