"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { ordenarOpcoesFilter, type FilterOption } from "@/lib/url/recorte";

interface Props {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  onSearch?: (term: string) => Promise<FilterOption[]>;
}

export default function FilterCombobox({
  id,
  label,
  value,
  options,
  placeholder = "Todos",
  onChange,
  onSearch,
}: Props) {
  const sorted = ordenarOpcoesFilter(options);
  const selected = sorted.find((o) => o.value === value);
  const [search, setSearch] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<FilterOption[]>(sorted);
  const [searching, setSearching] = useState(false);
  const [destacado, setDestacado] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearch(selected?.label ?? "");
  }, [selected?.label]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtrarLocal = useCallback(
    (term: string) => {
      const t = term.trim().toLowerCase();
      if (!t) {
        setResults(sorted);
        return;
      }
      setResults(sorted.filter((o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t)));
    },
    [sorted]
  );

  const doSearch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!onSearch) {
        filtrarLocal(term);
        return;
      }
      if (term.length < 1) {
        setResults(sorted);
        return;
      }
      setSearching(true);
      debounceRef.current = setTimeout(() => {
        onSearch(term)
          .then((remote) => setResults(ordenarOpcoesFilter(remote)))
          .catch(() => filtrarLocal(term))
          .finally(() => setSearching(false));
      }, 250);
    },
    [filtrarLocal, onSearch, sorted]
  );

  const selecionar = (opt: FilterOption | null) => {
    if (!opt || opt.value === "") {
      onChange("");
      setSearch("");
    } else {
      onChange(opt.value);
      setSearch(opt.label);
    }
    setOpen(false);
    setDestacado(-1);
  };

  return (
    <div ref={ref} className="relative flex min-w-[140px] flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={search}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg px-2.5 pr-8 text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            ["--tw-ring-color" as string]: "var(--brand)",
          }}
          onFocus={() => {
            setOpen(true);
            doSearch(search);
          }}
          onChange={(e) => {
            const term = e.target.value;
            setSearch(term);
            setOpen(true);
            setDestacado(-1);
            if (!term) {
              selecionar(null);
              return;
            }
            doSearch(term);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (results.length) setDestacado((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (results.length) setDestacado((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (destacado >= 0 && destacado < results.length) selecionar(results[destacado]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4" style={{ color: "var(--ink-2)" }} />
      </div>
      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg py-1 shadow-lg"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <li
            role="option"
            className="cursor-pointer px-3 py-2 text-sm"
            style={{ color: "var(--ink-2)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              selecionar(null);
            }}
          >
            {placeholder}
          </li>
          {searching && results.length === 0 && (
            <li className="px-3 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
              Buscando...
            </li>
          )}
          {results.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              role="option"
              aria-selected={i === destacado}
              className="cursor-pointer px-3 py-2 text-sm transition-colors"
              style={{
                color: "var(--ink)",
                backgroundColor: i === destacado ? "var(--brand-soft)" : "transparent",
              }}
              onMouseEnter={() => setDestacado(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                selecionar(opt);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
