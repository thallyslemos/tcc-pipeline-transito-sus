"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Files, ShieldCheck } from "lucide-react";

type AnnualAudit = {
  ano: number;
  ocorrencia_brasil_deduplicada: number;
  ocorrencia_brasil_com_copias: number;
  excesso_por_copias: number;
  ocorrencia_ba_deduplicada: number;
  residencia_ba_deduplicada: number;
  onsv_publicado: number | null;
  status_reconciliacao?: string;
};

type AnchorAudit = {
  ano: number;
  onsv_publicado: number;
  local_deduplicado: number;
  diferenca: number;
  status: string;
};

type Methodology = {
  id: string;
  label: string;
  geography: string;
  time_field: string;
  cid_rule: string;
  sex_rule: string;
  age_rule: string;
  acquisition: string;
  source: Record<string, string>;
};

type AuditData = {
  source: {
    files_observed: number;
    files_canonical: number;
    duplicate_files_removed: number;
    relative_root: string;
  };
  anchors: AnchorAudit[];
  annual: AnnualAudit[];
  methodologies: Methodology[];
  interpretation: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function numberPtBr(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("pt-BR");
}

function statusLabel(status: string | undefined) {
  return status === "reproduzido_localmente" ? "Reproduzido" : "Verificar";
}

export default function AuditoriaPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/dashboard/auditoria/onsv-2024`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json() as Promise<AuditData>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar a reconciliação local.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const latest = useMemo(
    () => data?.annual.find((row) => row.ano === 2024),
    [data],
  );

  if (error) {
    return (
      <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", color: "var(--fg)" }}>
        <h1 className="text-lg font-bold">Auditoria de totais</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>{error}</p>
      </section>
    );
  }

  if (!data || !latest) {
    return (
      <div className="flex h-96 items-center justify-center" data-testid="audit-loading">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Carregando reconciliação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="audit-page">
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Auditoria de totais e metodologias</h1>
        </div>
        <p className="mt-1 max-w-4xl text-sm" style={{ color: "var(--fg-muted)" }}>
          A publicação do ONSV usa ocorrência no Brasil. A pergunta principal do TCC usa residência na Bahia.
          Os universos aparecem separados para que totais diferentes não sejam comparados como se fossem a mesma medida.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="ONSV publicado — 2024" value={latest.onsv_publicado} testId="onsv-anchor-2024" tone="primary" />
        <MetricCard label="Reprodução local deduplicada" value={latest.ocorrencia_brasil_deduplicada} testId="local-deduplicated-2024" tone="success" />
        <MetricCard label="Com cópias redundantes" value={latest.ocorrencia_brasil_com_copias} testId="legacy-2024" tone="warning" />
        <MetricCard label="Cópias removidas" value={data.source.duplicate_files_removed} testId="duplicate-files" tone="neutral" />
      </div>

      <section className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="mb-3 flex items-center gap-2">
          <Files className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--fg)" }}>Reconciliação anual</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs" data-testid="annual-audit-table">
            <thead style={{ color: "var(--fg-muted)" }}>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-2 py-2">Ano</th>
                <th className="px-2 py-2">ONSV / Brasil</th>
                <th className="px-2 py-2">Local deduplicado</th>
                <th className="px-2 py-2">Com cópias</th>
                <th className="px-2 py-2">Ocorrência BA</th>
                <th className="px-2 py-2">Residência BA</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody style={{ color: "var(--fg-secondary)" }}>
              {data.annual.map((row) => (
                <tr key={row.ano} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-2 font-medium">{row.ano}</td>
                  <td className="px-2 py-2">{numberPtBr(row.onsv_publicado)}</td>
                  <td className="px-2 py-2 font-semibold" data-testid={row.ano === 2024 ? "local-deduplicated-2024-row" : undefined}>{numberPtBr(row.ocorrencia_brasil_deduplicada)}</td>
                  <td className="px-2 py-2">{numberPtBr(row.ocorrencia_brasil_com_copias)} <span style={{ color: "var(--fg-muted)" }}> (+{numberPtBr(row.excesso_por_copias)})</span></td>
                  <td className="px-2 py-2">{numberPtBr(row.ocorrencia_ba_deduplicada)}</td>
                  <td className="px-2 py-2">{numberPtBr(row.residencia_ba_deduplicada)}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1" style={{ color: row.status_reconciliacao === "reproduzido_localmente" ? "var(--success)" : "var(--warning)" }}>
                      {row.status_reconciliacao === "reproduzido_localmente" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {statusLabel(row.status_reconciliacao)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.methodologies.map((method) => (
          <article key={method.id} className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold" style={{ color: "var(--fg)" }}>{method.label}</h2>
              {method.source.publication_url && (
                <a href={method.source.publication_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte da publicação">
                  <ExternalLink className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </a>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <AuditField label="Geografia" value={method.geography} />
              <AuditField label="Tempo" value={method.time_field} />
              <AuditField label="CID-10" value={method.cid_rule} />
              <AuditField label="Sexo" value={method.sex_rule} />
              <AuditField label="Idade" value={method.age_rule} />
              <AuditField label="Aquisição" value={method.acquisition} />
            </dl>
          </article>
        ))}
      </section>

      <section className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <h2 className="font-semibold" style={{ color: "var(--fg)" }}>Como interpretar</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs" style={{ color: "var(--fg-secondary)" }}>
          {data.interpretation.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-4 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          Bronze observado: {numberPtBr(data.source.files_observed)} arquivos · canônico: {numberPtBr(data.source.files_canonical)} · fonte local: {data.source.relative_root}
        </p>
      </section>
    </div>
  );
}

function MetricCard({ label, value, testId, tone }: { label: string; value: number | null; testId: string; tone: "primary" | "success" | "warning" | "neutral" }) {
  const colors = { primary: "var(--primary)", success: "var(--success)", warning: "var(--warning)", neutral: "var(--fg-secondary)" };
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="mt-2 text-2xl font-bold" data-testid={testId} style={{ color: colors[tone] }}>{numberPtBr(value)}</p>
    </div>
  );
}

function AuditField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold" style={{ color: "var(--fg-muted)" }}>{label}</dt>
      <dd className="mt-0.5" style={{ color: "var(--fg-secondary)" }}>{value}</dd>
    </div>
  );
}
