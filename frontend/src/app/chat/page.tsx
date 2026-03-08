"use client";

import { useCallback, useRef, useState } from "react";
import { Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ToolCall {
  name: string;
  args: Record<string, string | number | undefined>;
  result: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
}

const MCP_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_obitos",
      description: "Consulta obitos (mortes) por acidentes de transito no SUS.",
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do municipio" },
          ano: { type: "number", description: "Ano de referencia" },
          tipo_veiculo: { type: "string", description: "Tipo de veiculo" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_custos",
      description: "Consulta custos ambulatoriais (SIA) de acidentes de transito no SUS.",
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do municipio" },
          ano: { type: "number", description: "Ano de referencia" },
          tipo_veiculo: { type: "string", description: "Tipo de veiculo" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_taxa_mortalidade",
      description: "Calcula a taxa de mortalidade por 100 mil habitantes.",
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do municipio" },
          ano: { type: "number", description: "Ano de referencia" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_serie_temporal",
      description: "Retorna serie temporal mensal de obitos ou custos.",
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do municipio (obrigatorio)" },
          metrica: { type: "string", description: "obitos ou custos" },
        },
        required: ["municipio"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_municipios",
      description: "Lista todos os municipios disponiveis na base de dados.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "Assistente de dados de acidentes de trânsito no SUS. Conecte o Ollama para IA generativa com MCP tools, ou consulte os dados diretamente.",
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
        setMessages((p) => [...p, { role: "system", content: `Ollama conectado! Modelos: ${models.join(", ") || "nenhum"}.` }]);
      }
    } catch {
      setOllamaConnected(false);
      setMessages((p) => [...p, { role: "system", content: `Não foi possível conectar ao Ollama em ${ollamaUrl}.` }]);
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

  const sendToOllama = async (userMsg: string): Promise<{ content: string; toolCalls: ToolCall[] }> => {
    const systemPrompt = `Voce e um assistente de dados sobre acidentes de transito no SUS (Brasil).
Voce tem acesso a tools que consultam dados reais de mortalidade (SIM) e custos ambulatoriais (SIA).
SEMPRE use as tools disponiveis para buscar dados antes de responder. NAO invente numeros.
Responda em portugues, seja preciso.`;

    const ollamaMessages: Array<{ role: string; content: string; tool_calls?: unknown[] }> = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMsg },
    ];

    const r = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaModel, messages: ollamaMessages, tools: MCP_TOOLS, stream: false }),
    });
    if (!r.ok) throw new Error(`Ollama error: ${r.status}`);
    const data = await r.json();
    const msg = data.message;
    const executedTools: ToolCall[] = [];

    if (msg?.tool_calls?.length) {
      ollamaMessages.push(msg);
      for (const tc of msg.tool_calls) {
        const fnName = tc.function?.name;
        const fnArgs = tc.function?.arguments || {};
        try {
          const mcpResult = await queryMcpTool(fnName, fnArgs);
          executedTools.push({ name: fnName, args: fnArgs, result: typeof mcpResult.result === "string" ? mcpResult.result : JSON.stringify(mcpResult.result) });
          ollamaMessages.push({ role: "tool", content: JSON.stringify(mcpResult) });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "erro";
          executedTools.push({ name: fnName, args: fnArgs, result: `Erro: ${errMsg}` });
          ollamaMessages.push({ role: "tool", content: JSON.stringify({ tool: fnName, error: errMsg }) });
        }
      }
      const r2 = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ollamaModel, messages: ollamaMessages, stream: false }),
      });
      if (!r2.ok) throw new Error(`Ollama error: ${r2.status}`);
      const data2 = await r2.json();
      return { content: data2.message?.content || "Sem resposta.", toolCalls: executedTools };
    }

    return { content: msg?.content || "Sem resposta.", toolCalls: [] };
  };

  const handleDirectQuery = async (userMsg: string): Promise<string> => {
    const lower = userMsg.toLowerCase();
    if (lower.includes("taxa") || lower.includes("mortalidade") || lower.includes("100 mil")) {
      const r = await fetch(`${API_URL}/api/indicadores/ranking?ano=2023&metrica=taxa_obitos_100mil`);
      const data = await r.json();
      let result = "Ranking Taxa de Mortalidade por 100mil hab (2023):\n\n";
      for (const item of data.ranking) result += `${item.municipio} (${item.uf}): ${item.taxa_obitos_100mil}/100mil hab\n`;
      return result + "\nFonte: DATASUS SIM + IBGE Tabela 6579";
    } else if (lower.includes("custo") || lower.includes("gasto")) {
      const r = await fetch(`${API_URL}/api/indicadores/ranking?ano=2023&metrica=custo_per_capita`);
      const data = await r.json();
      let result = "Ranking Custo per Capita (2023):\n\n";
      for (const item of data.ranking) result += `${item.municipio} (${item.uf}): R$ ${item.custo_per_capita.toFixed(2)}/hab\n`;
      return result + "\nFonte: DATASUS SIA (PA_VALAPR)";
    } else {
      const r = await fetch(`${API_URL}/api/dashboard/summary`);
      const data = await r.json();
      return `Resumo (2019-2023):\n\nÓbitos: ${data.total_obitos.toLocaleString("pt-BR")}\nCusto SUS: R$ ${data.total_custos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\nAtendimentos: ${data.total_atendimentos.toLocaleString("pt-BR")}\nMunicípios: ${data.municipios}\n\nDigite "taxa", "custo" ou "municípios" para consultas específicas.`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: userMsg }]);
    setLoading(true);
    scrollToBottom();

    try {
      if (ollamaConnected) {
        const { content, toolCalls } = await sendToOllama(userMsg);
        setMessages((p) => [...p, { role: "assistant", content, toolCalls }]);
      } else {
        const response = await handleDirectQuery(userMsg);
        setMessages((p) => [...p, { role: "assistant", content: response }]);
      }
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: `Erro: ${e instanceof Error ? e.message : "erro"}` }]);
    }

    setLoading(false);
    scrollToBottom();
  };

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col">
      {/* Config */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ollamaConnected ? "var(--success)" : "var(--fg-muted)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--fg-secondary)" }}>Ollama</span>
        </div>
        <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="URL Ollama"
          className="h-7 w-48 rounded px-2 text-xs" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--fg)" }} />
        <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="Modelo"
          className="h-7 w-32 rounded px-2 text-xs" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--fg)" }} />
        <button onClick={checkOllama} className="h-7 rounded px-3 text-xs font-medium"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>
          Conectar
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === "user"
                    ? { backgroundColor: "var(--primary)", color: "var(--primary-fg)" }
                    : m.role === "system"
                      ? { backgroundColor: "var(--bg-muted)", color: "var(--fg-muted)", border: "1px solid var(--border)", fontSize: "12px", fontStyle: "italic" }
                      : { backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }
                }>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-1 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                      Ferramentas consultadas
                    </p>
                    {m.toolCalls.map((tc, j) => (
                      <details key={j} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: "var(--bg-muted)", color: "var(--fg-secondary)" }}>
                        <summary className="cursor-pointer font-mono" style={{ color: "var(--primary)" }}>
                          {tc.name}({Object.entries(tc.args).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(", ")})
                        </summary>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px]" style={{ color: "var(--fg-muted)" }}>
                          {tc.result}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "var(--fg-muted)", animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "var(--fg-muted)", animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "var(--fg-muted)", animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="mx-auto flex max-w-2xl gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Pergunte sobre acidentes de trânsito no SUS..."
            className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-muted)", color: "var(--fg)" }} />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px]" style={{ color: "var(--fg-muted)" }}>
          {ollamaConnected ? `Usando ${ollamaModel} via Ollama — com MCP tools` : "Modo consulta direta (sem LLM). Conecte o Ollama para respostas com IA."}
        </p>
      </div>
    </div>
  );
}
