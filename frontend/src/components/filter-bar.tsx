"use client";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: {
    key: string;
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }[];
}

export function FilterBar({ filters }: FilterBarProps) {
  return (
    <div className="flex gap-4 mb-6">
      {filters.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-on-surface-variant">
            {f.label}
          </label>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="bg-surface-variant text-on-surface px-3 py-2 text-sm border-b-2 border-outline focus:border-primary outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="">All</option>
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
