import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acidentes de Transito no SUS",
  description: "Painel SIM-only para mortalidade por acidentes de transporte terrestre no SUS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
