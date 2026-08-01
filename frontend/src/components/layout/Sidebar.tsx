"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Map,
  Sparkles,
  MessageCircle,
  Database,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const NAV = [
  { href: "/dashboard", label: "Painel Geral", icon: BarChart3 },
  { href: "/municipio", label: "Municípios", icon: Building2 },
  { href: "/ranking", label: "Ranking", icon: BarChart3 },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/previsao", label: "Tendencias", icon: Sparkles },
  { href: "/chat", label: "Exploracao", icon: MessageCircle },
  { href: "/dados", label: "Dados e metadados", icon: Database },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const path = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: "var(--bg-overlay)" }}
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "var(--bg-card)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div
          className="flex h-16 items-center gap-2.5 px-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>
            SUS
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              Trânsito no SUS
            </p>
            <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
              Pipeline Analítico
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  backgroundColor: active ? "var(--primary-soft)" : "transparent",
                  color: active ? "var(--primary)" : "var(--fg-secondary)",
                }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle + footer */}
        <div className="px-3 pb-2">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
            style={{ color: "var(--fg-secondary)" }}
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
            ) : (
              <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            )}
            {theme === "dark" ? "Tema Claro" : "Tema Escuro"}
          </button>
        </div>
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>
            TCC — Sistemas de Informação
          </p>
          <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>
            IFBA — DATASUS (SIM)
          </p>
        </div>
      </aside>
    </>
  );
}
