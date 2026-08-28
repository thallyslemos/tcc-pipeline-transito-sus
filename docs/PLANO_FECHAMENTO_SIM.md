# Plano de fechamento da versao SIM

1. **Fundacao de dados:** Bronze canonico nacional, Silver v2 com preservacao do bruto, QA, dois marts role-playing e dicionarios IBGE/SENATRAN.
2. **Serving SIM-only:** contratos versionados, sem SIA nas respostas ativas, com status de denominadores e chaves explicitas de ocorrencia/residencia.
3. **Catalogo e consulta:** API de metadados com fonte, atualizacao, cobertura, grao, hash e qualidade; pagina de dados com busca e paginacao.
4. **Interface:** dashboard, mapa, municipio, ranking, tendencias, chat guiado e consulta de dados sem cartoes ou rotas SIA. O mapa usa prioritariamente o GeoJSON IBGE.
5. **Exportacao:** CSV/JSON e pacote de relatorio com filtros, consulta, fonte, snapshot, hash, denominador e timestamp.
6. **EDA reprodutivel:** totais nacionais/UF, Bahia versus Brasil, tendencias municipais, taxas somente quando o denominador exato existir, concentracao e padroes espaciais.
7. **Qualidade e release:** testes de contrato, API, Playwright nas paginas existentes, acessibilidade, desempenho e checklist de promocao sem sobrescrita.

SIA permanece documentado como interesse futuro, nao como funcionalidade de comparacao com ONSV nem como indicador ativo.
