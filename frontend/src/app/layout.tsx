import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";

// Design system v2.1 (design/DESIGN_SYSTEM.md §2): duas familias, IBM Plex
// Sans (texto) e IBM Plex Mono (todo numero, tabular). display:"swap" evita
// bloquear a primeira renderizacao.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Acidentes de Transito no SUS",
  description: "Painel SIM-only para mortalidade por acidentes de transporte terrestre no SUS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
