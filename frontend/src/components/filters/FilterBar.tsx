"use client";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
}

interface Props {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
}

export default function FilterBar({ filters, values, onChange, onReset }: Props) {
  const hasActive = Object.values(values).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label
            htmlFor={`filter-${f.key}`}
            className="text-[11px] font-medium uppercase tracking-wider text-slate-400"
          >
            {f.label}
          </label>
          <select
            id={`filter-${f.key}`}
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">{f.placeholder || "Todos"}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {hasActive && onReset && (
        <button
          onClick={onReset}
          className="mt-5 flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs text-slate-500 hover:bg-slate-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Limpar
        </button>
      )}
    </div>
  );
}
