"use client";

import { useCallback, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: { name: string; result: string }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "Assistente de dados de acidentes de transito no SUS. " +
        "Conecte o Ollama para usar IA generativa, ou consulte os dados diretamente abaixo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:3b");
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const checkOllama = useCallback(async () => {
    try {
      const r = await fetch(`${ollamaUrl}/api/tags`);
      if (r.ok) {
        setOllamaConnected(true);
        const data = await r.json();
        const models = data.models?.map((m: { name: string }) => m.name) || [];
        setMessages((p) => [
          ...p,
          { role: "system", content: `Ollama conectado! Modelos disponiveis: ${models.join(", ") || "nenhum"}. Configure o modelo acima.` },
        ]);
      }
    } catch {
      setOllamaConnected(false);
      setMessages((p) => [
        ...p,
        { role: "system", content: `Nao foi possivel conectar ao Ollama em ${ollamaUrl}. Verifique se esta rodando (ollama serve).` },
      ]);
    }
    scrollToBottom();
  }, [ollamaUrl]);

  const queryMcpTool = async (toolName: string, args: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const r = await fetch(`${API_URL}/api/mcp/${toolName}?${params}`);
    return r.json();
  };

  const sendToOllama = async (userMsg: string) => {
    const systemPrompt = `Voce e um assistente de dados sobre acidentes de transito no SUS (Brasil).
Voce tem acesso a dados de mortalidade (SIM) e custos ambulatoriais (SIA) de 2019-2023.
Municipios disponiveis: Sao Paulo, Salvador, Belo Horizonte, Guarulhos, Campinas, Uberlandia, Feira de Santana, Contagem, Vitoria da Conquista.

IMPORTANTE sobre dados financeiros:
- Os custos sao AMBULATORIAIS (SIA/PA), NAO incluem internacoes hospitalares (SIH).
- PA_VALAPR e o valor aprovado pelo SUS para pagamento, baseado na tabela SIGTAP.
- A taxa de mortalidade usa a formula: (obitos / populacao IBGE) * 100.000

Responda em portugues, seja preciso com numeros, cite as fontes quando possivel.`;

    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMsg },
    ];

    const r = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!r.ok) throw new Error(`Ollama error: ${r.status}`);
    const data = await r.json();
    return data.message?.content || "Sem resposta do modelo.";
  };

  const handleDirectQuery = async (userMsg: string) => {
    const lower = userMsg.toLowerCase();
    let result = "";

    if (lower.includes("taxa") || lower.includes("mortalidade") || lower.includes("100 mil") || lower.includes("100mil")) {
      const r = await fetch(`${API_URL}/api/indicadores/ranking?ano=2023&metrica=taxa_obitos_100mil`);
      const data = await r.json();
      result = "Ranking Taxa de Mortalidade por 100mil hab (2023):\n\n";
      for (const item of data.ranking) {
        result += `${item.municipio} (${item.uf}): ${item.taxa_obitos_100mil}/100mil hab (${item.obitos} obitos, pop ${item.populacao.toLocaleString("pt-BR")})\n`;
      }
      result += "\nFonte: DATASUS SIM + IBGE Tabela 6579. Formula: (obitos/pop)*100.000";
    } else if (lower.includes("custo") || lower.includes("gasto") || lower.includes("financeiro")) {
      const r = await fetch(`${API_URL}/api/indicadores/ranking?ano=2023&metrica=custo_per_capita`);
      const data = await r.json();
      result = "Ranking Custo per Capita - Ambulatorial SUS (2023):\n\n";
      for (const item of data.ranking) {
        result += `${item.municipio} (${item.uf}): R$ ${item.custo_per_capita.toFixed(2)}/hab (total R$ ${item.custo_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})\n`;
      }
      result += "\nFonte: DATASUS SIA (PA_VALAPR). Custo ambulatorial aprovado, NAO inclui internacoes.";
    } else if (lower.includes("municipio") || lower.includes("cidade") || lower.includes("lista")) {
      const r = await fetch(`${API_URL}/api/dashboard/municipios`);
      const data = await r.json();
      result = "Municipios disponiveis:\n\n";
      for (const m of data.municipios) {
        result += `${m.municipio} (${m.uf}) - ${m.obitos} obitos\n`;
      }
    } else {
      const r = await fetch(`${API_URL}/api/dashboard/summary`);
      const data = await r.json();
      result = `Resumo geral (2019-2023):\n\n`;
      result += `Total de obitos: ${data.total_obitos.toLocaleString("pt-BR")}\n`;
      result += `Custo ambulatorial SUS: R$ ${data.total_custos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      result += `Atendimentos: ${data.total_atendimentos.toLocaleString("pt-BR")}\n`;
      result += `Municipios: ${data.municipios}\n`;
      result += `\nDigite "taxa", "custo" ou "municipios" para consultas especificas.`;
    }

    return result;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: userMsg }]);
    setLoading(true);
    scrollToBottom();

    try {
      let response: string;
      if (ollamaConnected) {
        response = await sendToOllama(userMsg);
      } else {
        response = await handleDirectQuery(userMsg);
      }
      setMessages((p) => [...p, { role: "assistant", content: response }]);
    } catch (e) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: `Erro: ${e instanceof Error ? e.message : "erro desconhecido"}` },
      ]);
    }

    setLoading(false);
    scrollToBottom();
  };

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col">
      {/* Config bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${ollamaConnected ? "bg-green-500" : "bg-slate-300"}`} />
          <span className="text-xs font-medium text-slate-600">Ollama</span>
        </div>
        <input
          value={ollamaUrl}
          onChange={(e) => setOllamaUrl(e.target.value)}
          placeholder="URL Ollama"
          className="h-7 w-48 rounded border border-slate-200 px-2 text-xs"
        />
        <input
          value={ollamaModel}
          onChange={(e) => setOllamaModel(e.target.value)}
          placeholder="Modelo"
          className="h-7 w-32 rounded border border-slate-200 px-2 text-xs"
        />
        <button
          onClick={checkOllama}
          className="h-7 rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
        >
          Conectar
        </button>
        {!ollamaConnected && (
          <span className="text-[10px] text-slate-400">
            Sem Ollama? O chat usa consultas diretas na API.
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : m.role === "system"
                      ? "border border-slate-200 bg-slate-50 text-slate-500 text-xs italic"
                      : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Pergunte sobre acidentes de transito no SUS..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          {ollamaConnected
            ? `Usando ${ollamaModel} via Ollama`
            : "Modo consulta direta (sem LLM). Conecte o Ollama para respostas em linguagem natural."}
        </p>
      </div>
    </div>
  );
}
