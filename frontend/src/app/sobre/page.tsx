import type { Metadata } from "next";
import SobreContent from "./SobreContent";

// Server Component so pra declarar o titulo da aba — o resto da tela e
// client (fetch de indicadores ao vivo), ver SobreContent.tsx.
export const metadata: Metadata = {
  title: "Sobre o projeto · Trânsito no SUS",
};

export default function SobrePage() {
  return <SobreContent />;
}
