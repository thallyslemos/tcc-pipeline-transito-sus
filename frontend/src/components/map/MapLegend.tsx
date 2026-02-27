"use client";

interface Props {
  metrica: string;
}

const STEPS = [
  { color: "#86efac", label: "Baixo" },
  { color: "#facc15", label: "" },
  { color: "#f97316", label: "Medio" },
  { color: "#dc2626", label: "" },
  { color: "#991b1b", label: "Alto" },
];

export default function MapLegend({ metrica }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-medium text-slate-600">
        {metrica === "custos" ? "Custos" : "Obitos"}:
      </span>
      <div className="flex items-center gap-0.5">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-6 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label && <span className="mt-0.5 text-[9px] text-slate-400">{s.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
