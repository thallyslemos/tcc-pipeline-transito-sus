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
  GitBranch,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * design/DESIGN_SYSTEM.md §10 — so renomeia e reagrupa rotulos; NENHUM href
 * muda (evita quebrar links e capturas ja inseridas no artigo do TCC).
 * Rotulos sem correspondencia explicita no documento (Municipios, Mapa,
 * Dados e metadados) ficam como ja estavam, no grupo mais proximo do
 * exemplo do §10.
 */
const NAV_GRUPOS = [
  {
    grupo: "Panorama",
    itens: [
      { href: "/dashboard", label: "Visão geral", icon: BarChart3 },
      { href: "/temporal", label: "Séries no tempo", icon: CalendarClock },
      { href: "/previsao", label: "Tendências", icon: Sparkles },
    ],
  },
  {
    grupo: "Território",
    itens: [
      { href: "/municipio", label: "Municípios", icon: Building2 },
      { href: "/ranking", label: "Ranking municipal", icon: BarChart3 },
      { href: "/mapa", label: "Mapa", icon: Map },
      { href: "/fluxos", label: "Fluxos entre municípios", icon: GitBranch },
    ],
  },
  {
    grupo: "Método",
    itens: [
      { href: "/preliminares", label: "Qualidade e preliminares", icon: AlertTriangle },
      { href: "/dados", label: "Dados e metadados", icon: Database },
      { href: "/chat", label: "Exploração em linguagem natural", icon: MessageCircle },
    ],
  },
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
        <nav className="flex-1 space-y-4 px-3 py-4">
          {NAV_GRUPOS.map(({ grupo, itens }) => (
            <div key={grupo} className="space-y-1">
              <p
                className="num px-3 text-[10px] font-semibold uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
              >
                {grupo}
              </p>
              {itens.map(({ href, label, icon: Icon }) => {
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
            </div>
          ))}
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
          {/* design/DESIGN_SYSTEM.md §10 — proveniencia global fixa do
              rodape. "extração" e "sha" ficam de fora: nenhum dos dois esta
              disponivel em runtime hoje (pendencia de dado, nao de UI —
              documentado no plano de implementacao desta fase). */}
          <p className="num mt-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
            CID-10 V01–V89 · SIM/DATASUS · IBGE 6579 · SENATRAN dez.
          </p>
        </div>
      </aside>
    </>
  );
}
