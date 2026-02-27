const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchDashboardSummary(ano?: number) {
  const params = ano ? `?ano=${ano}` : "";
  const res = await fetch(`${API_URL}/api/dashboard/summary${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchAnosDisponiveis() {
  const res = await fetch(`${API_URL}/api/dashboard/anos`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchMunicipioDetalhe(codMun: string) {
  const res = await fetch(`${API_URL}/api/dashboard/municipio/${codMun}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
