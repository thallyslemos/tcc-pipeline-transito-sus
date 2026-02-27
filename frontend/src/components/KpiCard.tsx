"use client";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "red" | "amber" | "emerald";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const iconBg = {
  blue: "bg-blue-100",
  red: "bg-red-100",
  amber: "bg-amber-100",
  emerald: "bg-emerald-100",
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-shadow hover:shadow-md ${colorMap[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs opacity-60">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
