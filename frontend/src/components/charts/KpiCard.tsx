"use client";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "red" | "amber" | "emerald";
}

const styles = {
  blue: { card: "border-blue-100 bg-blue-50/60", text: "text-blue-700", icon: "bg-blue-100 text-blue-600" },
  red: { card: "border-red-100 bg-red-50/60", text: "text-red-700", icon: "bg-red-100 text-red-600" },
  amber: { card: "border-amber-100 bg-amber-50/60", text: "text-amber-700", icon: "bg-amber-100 text-amber-600" },
  emerald: { card: "border-emerald-100 bg-emerald-50/60", text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
};

export default function KpiCard({ title, value, subtitle, icon, color }: Props) {
  const s = styles[color];
  return (
    <div className={`rounded-xl border p-4 ${s.card}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium ${s.text} opacity-80`}>{title}</p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${s.text}`}>{value}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2 ${s.icon}`}>{icon}</div>
      </div>
    </div>
  );
}
