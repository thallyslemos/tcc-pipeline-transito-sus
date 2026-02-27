import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acidentes de Trânsito no SUS — Dashboard",
  description:
    "Painel analítico de impacto econômico e macrotendências de acidentes de trânsito no Sistema Único de Saúde",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
