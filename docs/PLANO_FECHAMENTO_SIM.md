# Plano de fechamento da ferramenta SIM

1. **Funda??o de dados (conclu?da nesta branch):** Bronze can?nico nacional, Silver v2 raw-preserving, QA, dois marts role-playing e dicion?rios IBGE/SENATRAN.
2. **Serving SIM-only:** substituir views Gold legadas por contratos versionados, retirar SIA das respostas e expor status de denominadores; manter c?digos de ocorr?ncia/resid?ncia expl?citos.
3. **Cat?logo e consulta:** API de metadados com fonte, atualiza??o, cobertura, gr?o, hash e qualidade; p?gina de dados com busca/pagina??o somente sobre marts agregados e dimens?es p?blicas.
4. **Interface:** dashboard, mapa, munic?pio e ranking sem cart?es/rotas SIA; filtros `dimensao`, ano/per?odo e indicador; mapa baseado em GeoJSON.
5. **Exporta??o:** CSV/JSON e pacote de relat?rio com filtros, query, fonte, snapshot, hash, denominador e timestamp.
6. **EDA reprodut?vel:** totais nacionais/UF, Bahia versus Brasil, tend?ncias municipais, taxas somente em anos com popula??o/frota, concentra??o e padr?es espaciais; separar explora??o de infer?ncia causal.
7. **Qualidade e release:** testes de contrato, API, Playwright nas p?ginas existentes, acessibilidade, desempenho e checklist de promo??o sem sobrescrita.

SIA permanece documentado como interesse futuro, n?o como funcionalidade de compara??o com ONSV nem como indicador ativo.
