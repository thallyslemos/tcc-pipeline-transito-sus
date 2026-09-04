"use client";

import { X } from "lucide-react";

import FilterCombobox from "@/components/filters/FilterCombobox";
import type { FilterOption } from "@/lib/url/recorte";

export type { FilterOption };

interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
  variant?: "select" | "combobox";
  onSearch?: (term: string) => Promise<FilterOption[]>;
}

interface Props<T extends string> {
  filters: FilterDef[];
  values: Partial<Record<T, string>>;
  onChange: (key: T, value: string) => void;
  onReset?: () => void;
}

export default function FilterBar<T extends string>({
  filters,
  values,
  onChange,
  onReset,
}: Props<T>) {
  const hasActive = Object.values(values).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((f) =>
        f.variant === "combobox" ? (
          <FilterCombobox
            key={f.key}
            id={`filter-${f.key}`}
            label={f.label}
            value={String(values[f.key as T] ?? "")}
            options={f.options}
            placeholder={f.placeholder || "Todos"}
            onChange={(v) => onChange(f.key as T, v)}
            onSearch={f.onSearch}
          />
        ) : (
          <div key={f.key} className="flex flex-col gap-1">
            <label
              htmlFor={`filter-${f.key}`}
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--ink-2)" }}
            >
              {f.label}
            </label>
            <select
              id={`filter-${f.key}`}
              value={String(values[f.key as T] ?? "")}
              onChange={(e) => onChange(f.key as T, e.target.value)}
              className="h-9 min-w-[140px] rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                "--tw-ring-color": "var(--brand)",
              } as React.CSSProperties}
            >
              <option value="">{f.placeholder || "Todos"}</option>
              {f.options.map((o, i) => (
                <option key={`${f.key}-${o.value}-${i}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )
      )}
      {hasActive && onReset && (
        <button
          onClick={onReset}
          className="mt-5 flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
          }}
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      )}
    </div>
  );
}
