"use client";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, children, className = "" }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-xl p-4 ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
