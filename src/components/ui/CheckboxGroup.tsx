import { cn } from "@/lib/utils";

export function CheckboxGroup({
  options,
  value,
  onChange,
  className,
  allowSelectAll = true,
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  allowSelectAll?: boolean;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const allSelected = options.length > 0 && value.length === options.length;

  return (
    <div className={cn("rounded-md border border-slate-300 dark:border-slate-700", className)}>
      {options.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-400">No options available</p>
      ) : (
        <div className="max-h-48 space-y-0.5 overflow-y-auto p-2">
          {allowSelectAll && (
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange(allSelected ? [] : options.map((o) => o.id))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Select all
            </label>
          )}
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
