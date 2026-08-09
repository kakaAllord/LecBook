import { InputHTMLAttributes, WheelEvent, forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, onWheel, ...props }, ref) => {
    /**
     * A focused `type="number"` field treats the mouse wheel as its spinner, so
     * scrolling down a long marks sheet after typing silently steps the value —
     * 40 becomes 39.5. Blurring on wheel hands the scroll back to the page and
     * leaves the number the person typed exactly as they typed it.
     */
    function handleWheel(event: WheelEvent<HTMLInputElement>) {
      onWheel?.(event);
      if (props.type === "number") event.currentTarget.blur();
    }

    return (
      <input
        ref={ref}
        onWheel={handleWheel}
        className={cn(
          "block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500",
          "bg-white dark:bg-slate-900 dark:text-slate-100",
          error ? "border-red-400 focus:ring-red-400" : "border-slate-300 dark:border-slate-700",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {children}
    </label>
  );
}
