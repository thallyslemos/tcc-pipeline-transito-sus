"use client";

import { useState } from "react";
import { fetchSimSummary } from "@/lib/api";

export default function ChatPage() {
  const [dimensao, setDimensao] = useState<"ocorrencia" | "residencia">("ocorrencia");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Consulte o resumo do SIM ou escreva uma pergunta para registrar o proximo estudo exploratorio.");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    try {
      const summary = await fetchSimSummary({ dimensao });
      setAnswer(`SIM (${dimensao}) no periodo ${summary.periodo}: ${summary.total_obitos.toLocaleString("pt-BR")} Obitos em ${summary.municipios.toLocaleString("pt-BR")} municipios. Pergunta registrada: ${question || "resumo geral"}.`);
    } catch {
      setAnswer("Nao foi possivel consultar o snapshot SIM ativo.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="mx-auto max-w-3xl space-y-5"><div><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Exploracao SIM</h1><p className="text-xs" style={{ color: "var(--fg-muted)" }}>Consultas guiadas pelos contratos de mortalidade, sem dados financeiros.</p></div><div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}><div className="flex flex-wrap gap-2"><select aria-label="Dimensao" value={dimensao} onChange={(event) => setDimensao(event.target.value as "ocorrencia" | "residencia")} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}><option value="ocorrencia">Ocorrencia</option><option value="residencia">Residencia</option></select><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex.: como a Bahia se comporta em 2010-2024" className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg)", color: "var(--fg)", border: "1px solid var(--border)" }} /><button type="button" onClick={ask} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>{loading ? "Consultando..." : "Consultar"}</button></div><p className="mt-4 text-sm" style={{ color: "var(--fg-secondary)" }}>{answer}</p></div></div>;
}
