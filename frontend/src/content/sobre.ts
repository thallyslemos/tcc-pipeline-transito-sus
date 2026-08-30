/**
 * docs/design-system/sobre/ESPEC_PAGINA_SOBRE.md — conteúdo da rota /sobre,
 * a única tela do sistema com texto EDITORIAL (escrito pelo autor, não
 * gerado pelo motor de leitura). Texto copiado literalmente do mockup
 * (docs/design-system/sobre/sobre-mockup.html), não reescrito.
 *
 * CAMPOS PENDENTES — o usuário ainda precisa preencher (tudo abaixo com
 * valor `undefined`/comentado). Enquanto vazios, os elementos correspondentes
 * somem da tela (nada de placeholder visível em produção — ver AUTOR.links,
 * AUTOR.cargoAtual, TIMELINE[].periodo, AUTOR.residencia.nomePrograma,
 * AUTOR.sasiSignificado, AUTOR.foto, CREDITOS.licenca):
 *
 *   1. URLs — LinkedIn e GitHub (obrigatório localizar); Lattes (opcional).
 *   2. Períodos (mês/ano início-fim) das 3 etapas: Tivic P&D, Tivic gerência
 *      de produtos, residência no CEPEDI.
 *   3. Cargo atual — confirmar ou corrigir "Analista de Desenvolvimento de
 *      Sistemas Pleno" (fonte não confirmada).
 *   4. Nome do programa de residência do CEPEDI e o ano.
 *   5. SASI — o que a sigla significa e uma linha sobre o que a aplicação faz.
 *   6. Foto — retrato quadrado, mínimo 400×400. Sem foto, cai pras iniciais.
 *   7. Licença do código e das figuras (sugestão do autor da espec: MIT no
 *      código, CC BY 4.0 nas figuras).
 */

export const cabecalho = {
  kicker: "Sobre o projeto",
  titulo: "Um trabalho na interseção de duas trajetórias",
  lede: "Este sistema nasceu do encontro entre duas coisas que eu já fazia separadamente: construir software e pipelines de dados para trânsito e cidades inteligentes, e arquitetar aplicações de análise de dados de saúde pública. A mortalidade viária registrada no SUS é, literalmente, o ponto onde esses dois assuntos se encontram.",
  notaEditorial:
    "Esta é a única página do sistema com texto editorial: aqui quem escreve é o autor, e não o motor de leitura. Todas as demais telas exibem apenas frases geradas a partir do recorte, sempre identificando a regra que as produziu.",
};

export interface OrigemCartao {
  rotulo: string;
  corVar: "--flow-origin" | "--risk-5";
  titulo: string;
  texto: string;
  oQueAportou: string;
}

export const origens: OrigemCartao[] = [
  {
    rotulo: "Origem 01 · o domínio",
    corVar: "--flow-origin",
    titulo: "Tivic — do P&D à gerência de produtos",
    texto:
      "Comecei no setor de pesquisa e desenvolvimento e cheguei à gerência de um time de produtos, construindo aplicações web e pipelines de dados no contexto de cidades inteligentes e trânsito.",
    oQueAportou:
      "familiaridade com o dado de trânsito e com o que ele esconde; a prática de construir pipeline que aguenta dado público real; e a passagem de quem executa para quem decide o que vale construir.",
  },
  {
    rotulo: "Origem 02 · o método",
    corVar: "--flow-origin",
    titulo: "CEPEDI — residência e a arquitetura do SASI",
    texto:
      "Na residência tecnológica, arquitetei a aplicação SASI e conduzi o direcionamento técnico do time em um projeto de análise de dados de saúde pública.",
    oQueAportou:
      "a arquitetura em camadas que este sistema usa; o vocabulário dos sistemas de informação em saúde do SUS; e a experiência de orientar tecnicamente outras pessoas, que é o que transforma decisão em padrão.",
  },
  {
    rotulo: "Origem 03 · a inquietação",
    corVar: "--risk-5",
    titulo: "Usar o que sei, onde eu vivo",
    texto:
      "A Bahia tem o dado público e não tem a análise. Os microdados do SIM estão disponíveis há anos, e o que existe sobre eles são painéis anuais e estaduais — que não respondem onde, quando e com quem.",
    oQueAportou:
      "a decisão de não fazer mais um dashboard. Construir um instrumento que admite o que não sabe, mostra o denominador e devolve um recorte citável.",
  },
];

export interface MarcoTrajetoria {
  kicker: string;
  /** mes/ano inicio-fim — CAMPO PENDENTE, ver comentario no topo do arquivo. */
  periodo?: string;
  titulo: string;
  texto: string;
  atual?: boolean;
}

export const trajetoria: MarcoTrajetoria[] = [
  {
    kicker: "TIVIC · P&D",
    periodo: undefined,
    titulo: "Pesquisa e desenvolvimento",
    texto: "Software web e primeiros pipelines de dados aplicados a mobilidade urbana.",
  },
  {
    kicker: "TIVIC · PRODUTOS",
    periodo: undefined,
    titulo: "Gerência de time de produtos",
    texto: "Da entrega técnica à decisão de produto, no contexto de cidades inteligentes e trânsito.",
  },
  {
    kicker: "CEPEDI · RESIDÊNCIA",
    periodo: undefined,
    titulo: "Arquitetura do SASI",
    texto: "Definição da arquitetura e direcionamento técnico do time em análise de dados de saúde pública.",
  },
  {
    kicker: "IFBA · TCC II · 2026",
    titulo: "Este sistema",
    texto: "Bacharelado em Sistemas de Informação, IFBA Vitória da Conquista. Onde as duas trajetórias convergem.",
    atual: true,
  },
];

export const diagrama = {
  introducao:
    "Visão abstrata: três fontes públicas entram, passam por quatro camadas de tratamento e saem como recorte citável. O catálogo versionado acompanha cada etapa — é ele que torna o resultado reproduzível.",
};

/**
 * Fallback fixo: a pagina nunca pode quebrar numa demonstracao. Os 3
 * primeiros indicadores tem contrapartida ao vivo em /api/sim/metadata e
 * /api/sim/summary (ver app/sobre/page.tsx); recorte e validacao sao fixos
 * (a validacao e resultado de um estudo de reconciliacao, nao de uma API).
 */
export const indicadoresFallback = {
  linhasSilver: 20_410_620,
  datasets: 10,
  periodo: "2010–2024",
  recorteCid: "V01–V89",
  validacaoOnsv: "99,958%",
};

export interface FormacaoItem {
  titulo: string;
  texto: string;
}

export const autor = {
  nome: "Thallys Viana Lemos",
  /** CAMPO PENDENTE — confirmar ou corrigir. */
  cargoAtual: undefined as string | undefined,
  resumo:
    "Desenvolvedor e arquiteto de aplicações de dados. Trabalha com software web e pipelines analíticos em contextos de cidades inteligentes, trânsito e saúde pública, transitando entre a decisão técnica e a condução de time.",
  /** CAMPOS PENDENTES — URLs. Cada um some da tela se undefined. */
  links: {
    linkedin: undefined as string | undefined,
    github: undefined as string | undefined,
    lattes: undefined as string | undefined,
  },
  /** CAMPO PENDENTE — retrato quadrado ≥400x400 (data URI ou caminho em /public). Sem foto, cai pras iniciais. */
  foto: undefined as string | undefined,
  iniciais: "TL",
  formacao: [
    { titulo: "Bacharelado em Sistemas de Informação", texto: "IFBA — Campus Vitória da Conquista · conclusão em 2026" },
  ] satisfies FormacaoItem[],
  residencia: {
    /** CAMPO PENDENTE — nome do programa (residência em TIC? em software?) e o ano. */
    nomePrograma: undefined as string | undefined,
    titulo: "Residência tecnológica",
    texto: "CEPEDI · arquitetura da aplicação SASI e direcionamento técnico de equipe",
  },
  /** CAMPO PENDENTE — o que a sigla SASI significa + uma linha sobre a aplicação. */
  sasiSignificado: undefined as string | undefined,
  convergencia: {
    rotulo: "Onde as duas trajetórias se encontram",
    paragrafo1:
      "Um trabalho sobre mortalidade no trânsito registrada no sistema de saúde não é uma escolha aleatória de tema. É o único assunto em que os dois lados da minha experiência profissional respondem à mesma pergunta.",
    paragrafo2:
      "O lado de trânsito trouxe o domínio e a suspeita de que o dado agregado esconde o fenômeno. O lado de saúde pública trouxe a arquitetura, o vocabulário do SUS e o rigor de proveniência. O resultado é um sistema que nenhuma das duas experiências, isolada, teria produzido.",
  },
};

export interface CompetenciaBloco {
  titulo: string;
  texto: string;
  tags: string[];
}

export const competencias: CompetenciaBloco[] = [
  {
    titulo: "Engenharia de dados",
    texto:
      "Ingestão de dado público bruto, arquitetura em camadas, formatos colunares, testes de reconciliação e controle de qualidade por registro.",
    tags: ["ETL", "arquitetura medalhão", "Parquet", "DuckDB", "proveniência"],
  },
  {
    titulo: "Desenvolvimento web",
    texto:
      "Aplicação analítica de página única, API de consulta com recorte parametrizado e estado de filtro refletido na URL.",
    tags: ["Next.js", "TypeScript", "FastAPI", "design system"],
  },
  {
    titulo: "Arquitetura de software",
    texto:
      "Modelagem das dimensões de ocorrência e residência, contratos entre camadas e separação entre cor de dado e cor de interface.",
    tags: ["modelagem", "contratos", "versionamento"],
  },
  {
    titulo: "Análise e estatística",
    texto:
      "Regressão log-linear para variação percentual anual, testes de aderência, análise de sazonalidade e tratamento do problema de área pequena.",
    tags: ["APC", "qui-quadrado", "séries temporais", "epidemiologia descritiva"],
  },
  {
    titulo: "Produto e liderança técnica",
    texto:
      "Definição de escopo, priorização do que entrega leitura em vez de acabamento, e condução técnica de equipe na residência.",
    tags: ["priorização", "direcionamento técnico", "mentoria"],
  },
  {
    titulo: "Domínio",
    texto:
      "Segurança viária, sistemas de informação em saúde do SUS e mobilidade urbana — o repertório que permite saber qual número é suspeito.",
    tags: ["segurança viária", "SIM / DATASUS", "cidades inteligentes"],
  },
];

export const creditos = {
  referenciaAbnt:
    "LEMOS, Thallys Viana. Mortalidade por acidentes de transporte terrestre na Bahia: análise espaço-temporal de quinze anos de microdados do SIM/DATASUS com pipeline reprodutível de dados abertos. Trabalho de Conclusão de Curso — Bacharelado em Sistemas de Informação, Instituto Federal da Bahia, Campus Vitória da Conquista, 2026. Orientador: Prof. Andrique Figueiredo Amorim.",
  notaCitacao:
    "Ao citar uma figura, use o link do recorte que a produziu, não a captura de tela. Toda tela do sistema oferece esse link.",
  fontesTexto1:
    "Os dados são públicos e permanecem de seus produtores: Ministério da Saúde (SIM/DATASUS), IBGE e SENATRAN/RENAVAM. O sistema não redistribui microdado identificado — apenas agregados municipais.",
  fontesTexto2: "A validação externa usa o pacote roadtrafficdeaths, do Observatório Nacional de Segurança Viária.",
  /** CAMPO PENDENTE — licença do código e das figuras. */
  licenca: undefined as string | undefined,
};
