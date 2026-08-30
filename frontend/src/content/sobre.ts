/**
 * Conteúdo editorial da rota /sobre — texto do autor, não gerado pelo motor de leitura.
 */

export const cabecalho = {
  kicker: "Sobre o projeto",
  titulo: "Mortalidade por acidentes de transporte no SUS",
  lede:
    "Trabalho de conclusão de curso (IFBA, 2026) que organiza microdados nacionais do SIM (CID-10 V01–V89), calcula indicadores por município e expõe recortes reprodutíveis via URL. O foco é evidência descritiva — numerador, denominador e limites explícitos —, não painel genérico.",
  notaEditorial:
    "Esta é a única página com texto fixo do autor. Nas demais telas, as frases são geradas pelo motor de leitura a partir do recorte selecionado.",
};

export const projeto = {
  titulo: "O que o sistema faz",
  paragrafos: [
    "Pipeline Medallion (Bronze → Silver → Gold) sobre DuckDB e Parquet; API FastAPI e interface Next.js para explorar óbitos por ocorrência ou residência, mapas, séries temporais e fluxos residência↔ocorrência quando a Silver contratual está disponível.",
    "Durante o desenvolvimento, experimentei diferentes modelos e combinações de ferramentas de IA (assistentes de código, revisão e documentação) como apoio à implementação e aos testes — sempre com validação manual, testes automatizados e reconciliação dos dados.",
  ],
};

export const diagrama = {
  titulo: "Fluxo de dados",
  introducao:
    "Três fontes públicas entram no pipeline Medallion (Bronze → Silver → Gold); a API e a interface expõem agregados com recorte na URL. O catálogo versionado registra proveniência e cobertura.",
};

export const indicadoresFallback = {
  linhasSilver: 20_410_620,
  datasets: 10,
  periodo: "2010–2024",
  recorteCid: "V01–V89",
  validacaoOnsv: "99,958%",
};

export const autor = {
  nome: "Thallys Viana Lemos",
  formacao: "Bacharelado em Sistemas de Informação · IFBA — Campus Vitória da Conquista · 2026",
  links: {
    linkedin: "https://www.linkedin.com/in/thallys-lemos",
    github: "https://github.com/thallyslemos/tcc-pipeline-transito-sus",
  },
  iniciais: "TL",
};

export const creditos = {
  referenciaAbnt:
    "LEMOS, Thallys Viana. Mortalidade por acidentes de transporte terrestre na Bahia: análise espaço-temporal de quinze anos de microdados do SIM/DATASUS com pipeline reprodutível de dados abertos. Trabalho de Conclusão de Curso — Bacharelado em Sistemas de Informação, Instituto Federal da Bahia, Campus Vitória da Conquista, 2026. Orientador: Prof. Andrique Figueiredo Amorim.",
  notaCitacao:
    "Ao citar uma figura, use o link do recorte que a produziu, não a captura de tela.",
  fontes:
    "Dados públicos: Ministério da Saúde (SIM/DATASUS), IBGE e SENATRAN quando aplicável. O sistema expõe agregados municipais, sem redistribuir microdado identificado.",
};
