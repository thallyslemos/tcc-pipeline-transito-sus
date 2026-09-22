"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-[var(--surface)] focus:text-[var(--brand)] font-medium rounded-br-lg border-[var(--border)] border-b border-r"
      >
        Pular para o conteúdo principal
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <header
          className="sticky top-0 z-20 flex h-14 items-center gap-3 px-4 backdrop-blur-md"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 80%, transparent)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--sunken)] lg:hidden"
            style={{ color: "var(--ink-2)" }}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Acidentes de Transito no SUS
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
