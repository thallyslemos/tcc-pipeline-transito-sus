-- Extensão exploratória do TCC II: Bahia, fluxos e associação com frota.
--
-- Este protocolo é somente leitura. O executor cria a relação temporária
-- ``sim_analitico`` com o filtro científico definido no contrato SIM v1 e
-- substitui {{DATA_ROOT}} e {{POPULATION_PATH}} antes da execução.
-- A frota é denominador complementar; nenhuma associação abaixo é causal.

-- query: uf_arquivo_vs_papeis_geograficos
SELECT
    coalesce(uf_arquivo, '<nulo>') AS uf_arquivo,
    count(*) AS obitos_att,
    count(*) FILTER (WHERE uf_ocorrencia IS NOT NULL) AS com_uf_ocorrencia,
    count(*) FILTER (WHERE uf_residencia IS NOT NULL) AS com_uf_residencia,
    count(*) FILTER (WHERE uf_arquivo_diverge_ocorrencia) AS diverge_ocorrencia,
    count(*) FILTER (WHERE uf_arquivo_diverge_residencia) AS diverge_residencia,
    count(*) FILTER (WHERE uf_ocorrencia = 'BA') AS ocorridos_ba,
    count(*) FILTER (WHERE uf_residencia = 'BA') AS residentes_ba
FROM sim_analitico
GROUP BY uf_arquivo
ORDER BY obitos_att DESC;

-- query: bahia_fluxos_anuais_v2
SELECT
    ano_obito AS ano,
    count(*) FILTER (WHERE uf_ocorrencia = 'BA') AS ocorrencia_ba,
    count(*) FILTER (WHERE uf_residencia = 'BA') AS residencia_ba,
    count(*) FILTER (
        WHERE uf_ocorrencia = 'BA' AND uf_residencia = 'BA'
    ) AS ocorrencia_ba_residencia_ba,
    count(*) FILTER (
        WHERE uf_ocorrencia = 'BA' AND uf_residencia IS NOT NULL
          AND uf_residencia <> 'BA'
    ) AS ocorrencia_ba_residencia_outra_uf,
    count(*) FILTER (
        WHERE uf_residencia = 'BA' AND uf_ocorrencia IS NOT NULL
          AND uf_ocorrencia <> 'BA'
    ) AS residencia_ba_ocorrencia_outra_uf
FROM sim_analitico
GROUP BY ano_obito
ORDER BY ano;

-- query: bahia_fluxos_municipais_v2
WITH municipios AS (
    SELECT cod_mun_ibge, nome AS municipio
    FROM read_parquet('{{DATA_ROOT}}/ibge_municipios.parquet')
    WHERE uf = 'BA'
), ocorrencia AS (
    SELECT
        cod_mun_ocorrencia_ibge AS cod_mun_ibge,
        count(*) AS obitos_ocorrencia,
        count(*) FILTER (
            WHERE cod_mun_residencia_ibge = cod_mun_ocorrencia_ibge
        ) AS residentes_do_proprio_municipio,
        count(*) FILTER (
            WHERE uf_residencia = 'BA'
              AND cod_mun_residencia_ibge <> cod_mun_ocorrencia_ibge
        ) AS residentes_de_outro_municipio_ba,
        count(*) FILTER (WHERE uf_residencia IS NOT NULL AND uf_residencia <> 'BA')
            AS residentes_de_outra_uf,
        count(*) FILTER (
            WHERE geografia_status_residencia <> 'encontrado'
               OR uf_residencia IS NULL
        ) AS residencia_indisponivel
    FROM sim_analitico
    WHERE uf_ocorrencia = 'BA'
      AND geografia_status_ocorrencia = 'encontrado'
    GROUP BY cod_mun_ocorrencia_ibge
), residencia AS (
    SELECT
        cod_mun_residencia_ibge AS cod_mun_ibge,
        count(*) AS obitos_residencia,
        count(*) FILTER (
            WHERE cod_mun_ocorrencia_ibge = cod_mun_residencia_ibge
        ) AS ocorridos_no_proprio_municipio,
        count(*) FILTER (
            WHERE uf_ocorrencia = 'BA'
              AND cod_mun_ocorrencia_ibge <> cod_mun_residencia_ibge
        ) AS ocorridos_em_outro_municipio_ba,
        count(*) FILTER (WHERE uf_ocorrencia IS NOT NULL AND uf_ocorrencia <> 'BA')
            AS ocorridos_em_outra_uf,
        count(*) FILTER (
            WHERE geografia_status_ocorrencia <> 'encontrado'
               OR uf_ocorrencia IS NULL
        ) AS ocorrencia_indisponivel
    FROM sim_analitico
    WHERE uf_residencia = 'BA'
      AND geografia_status_residencia = 'encontrado'
    GROUP BY cod_mun_residencia_ibge
)
SELECT
    m.cod_mun_ibge,
    m.municipio,
    coalesce(o.obitos_ocorrencia, 0) AS obitos_ocorrencia,
    coalesce(r.obitos_residencia, 0) AS obitos_residencia,
    coalesce(o.obitos_ocorrencia, 0) - coalesce(r.obitos_residencia, 0)
        AS saldo_ocorrencia_menos_residencia,
    coalesce(o.residentes_de_outro_municipio_ba, 0)
      + coalesce(o.residentes_de_outra_uf, 0) AS entradas_externas,
    coalesce(r.ocorridos_em_outro_municipio_ba, 0)
      + coalesce(r.ocorridos_em_outra_uf, 0) AS saidas_externas,
    CASE WHEN o.obitos_ocorrencia > 0 THEN
        100.0 * (o.residentes_de_outro_municipio_ba + o.residentes_de_outra_uf)
          / o.obitos_ocorrencia
    END AS percentual_entrada_externa,
    CASE WHEN r.obitos_residencia > 0 THEN
        100.0 * (r.ocorridos_em_outro_municipio_ba + r.ocorridos_em_outra_uf)
          / r.obitos_residencia
    END AS percentual_saida_externa,
    coalesce(o.residencia_indisponivel, 0) AS residencia_indisponivel,
    coalesce(r.ocorrencia_indisponivel, 0) AS ocorrencia_indisponivel
FROM municipios m
LEFT JOIN ocorrencia o USING (cod_mun_ibge)
LEFT JOIN residencia r USING (cod_mun_ibge)
ORDER BY entradas_externas DESC, obitos_ocorrencia DESC;

-- query: bahia_municipios_centralidade_v2
WITH fluxo AS (
    SELECT * FROM resultado_bahia_fluxos_municipais_v2
)
SELECT
    *,
    CASE WHEN obitos_ocorrencia >= 30 THEN percentual_entrada_externa END
        AS percentual_entrada_externa_filtrado,
    CASE WHEN obitos_residencia >= 30 THEN percentual_saida_externa END
        AS percentual_saida_externa_filtrado,
    CASE WHEN obitos_ocorrencia >= 30 AND obitos_residencia >= 30
        THEN saldo_ocorrencia_menos_residencia END AS saldo_estavel
FROM fluxo
WHERE obitos_ocorrencia >= 30 OR obitos_residencia >= 30
ORDER BY saldo_estavel DESC NULLS LAST;

-- query: bahia_frota_mortalidade_anual_v2
WITH sim AS (
    SELECT
        ano_obito AS ano,
        count(*) FILTER (WHERE uf_residencia = 'BA') AS obitos_residencia,
        count(*) FILTER (
            WHERE uf_residencia = 'BA' AND tipo_veiculo = 'Motociclista'
        ) AS obitos_motociclista_residencia,
        count(*) FILTER (WHERE uf_ocorrencia = 'BA') AS obitos_ocorrencia,
        count(*) FILTER (
            WHERE uf_ocorrencia = 'BA' AND tipo_veiculo = 'Motociclista'
        ) AS obitos_motociclista_ocorrencia
    FROM sim_analitico
    GROUP BY ano_obito
), frota AS (
    SELECT
        ano,
        count(DISTINCT cod_mun_ibge) AS municipios_com_frota,
        sum(frota_total) AS frota_total,
        sum(frota_duas_rodas_motorizadas) AS frota_duas_rodas
    FROM read_parquet('{{DATA_ROOT}}/gold/frota_municipio_ano.parquet')
    WHERE uf = 'BA'
    GROUP BY ano
), pop AS (
    SELECT ano, sum(populacao) AS populacao
    FROM read_parquet('{{POPULATION_PATH}}')
    WHERE starts_with(cod_mun_ibge, '29')
    GROUP BY ano
)
SELECT
    s.ano,
    s.obitos_residencia,
    s.obitos_motociclista_residencia,
    s.obitos_ocorrencia,
    s.obitos_motociclista_ocorrencia,
    f.municipios_com_frota,
    f.frota_total,
    f.frota_duas_rodas,
    p.populacao,
    100000.0 * s.obitos_residencia / NULLIF(p.populacao, 0)
        AS taxa_residencia_100mil,
    10000.0 * s.obitos_motociclista_residencia
        / NULLIF(f.frota_duas_rodas, 0) AS taxa_motociclista_10mil_duas_rodas,
    10000.0 * s.obitos_residencia / NULLIF(f.frota_total, 0)
        AS taxa_total_10mil_frota,
    10000.0 * s.obitos_motociclista_ocorrencia
        / NULLIF(f.frota_duas_rodas, 0) AS taxa_motociclista_ocorrencia_10mil_duas_rodas
FROM sim s
LEFT JOIN frota f USING (ano)
LEFT JOIN pop p USING (ano)
ORDER BY s.ano;

-- query: bahia_frota_municipal_painel_v2
WITH municipios AS (
    SELECT cod_mun_ibge, nome AS municipio
    FROM read_parquet('{{DATA_ROOT}}/ibge_municipios.parquet')
    WHERE uf = 'BA'
), anos AS (
    SELECT unnest(range(2010, 2025)) AS ano
), mortes AS (
    SELECT
        ano_obito AS ano,
        cod_mun_residencia_ibge AS cod_mun_ibge,
        count(*) AS obitos,
        count(*) FILTER (WHERE tipo_veiculo = 'Motociclista') AS obitos_motociclista
    FROM sim_analitico
    WHERE uf_residencia = 'BA'
      AND geografia_status_residencia = 'encontrado'
    GROUP BY ano_obito, cod_mun_residencia_ibge
), frota AS (
    SELECT ano, cod_mun_ibge, frota_total, frota_duas_rodas_motorizadas
    FROM read_parquet('{{DATA_ROOT}}/gold/frota_municipio_ano.parquet')
    WHERE uf = 'BA'
)
SELECT
    a.ano,
    m.cod_mun_ibge,
    m.municipio,
    coalesce(d.obitos, 0) AS obitos,
    coalesce(d.obitos_motociclista, 0) AS obitos_motociclista,
    f.frota_total,
    f.frota_duas_rodas_motorizadas AS frota_duas_rodas,
    CASE WHEN f.frota_total > 0 THEN
        10000.0 * coalesce(d.obitos, 0) / f.frota_total
    END AS taxa_obitos_10mil_frota,
    CASE WHEN f.frota_duas_rodas_motorizadas > 0 THEN
        10000.0 * coalesce(d.obitos_motociclista, 0)
          / f.frota_duas_rodas_motorizadas
    END AS taxa_motociclista_10mil_duas_rodas
FROM municipios m
CROSS JOIN anos a
LEFT JOIN mortes d USING (ano, cod_mun_ibge)
LEFT JOIN frota f USING (ano, cod_mun_ibge)
ORDER BY a.ano, m.cod_mun_ibge;

-- query: bahia_frota_correlacoes_v2
WITH painel AS (
    SELECT * FROM resultado_bahia_frota_municipal_painel_v2
), diferencas AS (
    SELECT
        *,
        ano - lag(ano) OVER (PARTITION BY cod_mun_ibge ORDER BY ano) AS intervalo,
        obitos_motociclista - lag(obitos_motociclista)
            OVER (PARTITION BY cod_mun_ibge ORDER BY ano) AS delta_mortes_moto,
        frota_duas_rodas - lag(frota_duas_rodas)
            OVER (PARTITION BY cod_mun_ibge ORDER BY ano) AS delta_frota_duas_rodas
    FROM painel
)
SELECT
    'nivel_municipio_ano' AS serie,
    count(*) FILTER (WHERE frota_duas_rodas IS NOT NULL) AS observacoes,
    corr(obitos_motociclista::DOUBLE, frota_duas_rodas::DOUBLE)
        AS correlacao_mortes_frota,
    NULL AS correlacao_diferencas
FROM painel
WHERE frota_duas_rodas IS NOT NULL
UNION ALL
SELECT
    'primeiras_diferencas_consecutivas',
    count(*) FILTER (WHERE intervalo = 1),
    NULL,
    corr(delta_mortes_moto::DOUBLE, delta_frota_duas_rodas::DOUBLE)
        FILTER (WHERE intervalo = 1)
FROM diferencas;

-- query: bahia_anomalias_anuais_v2
WITH municipios AS (
    SELECT cod_mun_ibge, nome AS municipio
    FROM read_parquet('{{DATA_ROOT}}/ibge_municipios.parquet')
    WHERE uf = 'BA'
), anos AS (
    SELECT unnest(range(2010, 2025)) AS ano
), mortes AS (
    SELECT
        ano_obito AS ano,
        cod_mun_ocorrencia_ibge AS cod_mun_ibge,
        count(*) AS obitos
    FROM sim_analitico
    WHERE uf_ocorrencia = 'BA'
      AND geografia_status_ocorrencia = 'encontrado'
    GROUP BY ano_obito, cod_mun_ocorrencia_ibge
), painel AS (
    SELECT
        a.ano,
        m.cod_mun_ibge,
        m.municipio,
        coalesce(d.obitos, 0) AS obitos,
        p.populacao
    FROM municipios m
    CROSS JOIN anos a
    LEFT JOIN mortes d USING (ano, cod_mun_ibge)
    LEFT JOIN read_parquet('{{POPULATION_PATH}}') p USING (ano, cod_mun_ibge)
), estatisticas AS (
    SELECT
        *,
        avg(obitos) OVER (PARTITION BY cod_mun_ibge) AS media_serie,
        stddev_samp(obitos) OVER (PARTITION BY cod_mun_ibge) AS desvio_serie,
        lag(obitos) OVER (PARTITION BY cod_mun_ibge ORDER BY ano) AS obitos_ano_anterior,
        lag(ano) OVER (PARTITION BY cod_mun_ibge ORDER BY ano) AS ano_anterior
    FROM painel
)
SELECT
    ano,
    cod_mun_ibge,
    municipio,
    obitos,
    populacao,
    100000.0 * obitos / NULLIF(populacao, 0) AS taxa_100mil,
    media_serie,
    desvio_serie,
    (obitos - media_serie) / NULLIF(desvio_serie, 0) AS z_serie,
    obitos - obitos_ano_anterior AS variacao_absoluta,
    100.0 * (obitos - obitos_ano_anterior)
        / NULLIF(obitos_ano_anterior, 0) AS variacao_percentual
FROM estatisticas
WHERE ano_anterior = ano - 1
  AND obitos >= 10
  AND (obitos - media_serie) / NULLIF(desvio_serie, 0) >= 2
ORDER BY z_serie DESC NULLS LAST, obitos DESC;

-- query: series_barreiras_gaviao_v2
WITH municipios AS (
    SELECT cod_mun_ibge, nome AS municipio
    FROM read_parquet('{{DATA_ROOT}}/ibge_municipios.parquet')
    WHERE cod_mun_ibge IN ('2903201', '2911253')
), anos AS (
    SELECT unnest(range(2010, 2025)) AS ano
), ocorrencia AS (
    SELECT ano_obito AS ano, cod_mun_ocorrencia_ibge AS cod_mun_ibge,
           count(*) AS obitos_ocorrencia
    FROM sim_analitico
    WHERE cod_mun_ocorrencia_ibge IN ('2903201', '2911253')
    GROUP BY ano_obito, cod_mun_ocorrencia_ibge
), residencia AS (
    SELECT ano_obito AS ano, cod_mun_residencia_ibge AS cod_mun_ibge,
           count(*) AS obitos_residencia
    FROM sim_analitico
    WHERE cod_mun_residencia_ibge IN ('2903201', '2911253')
    GROUP BY ano_obito, cod_mun_residencia_ibge
)
SELECT
    m.cod_mun_ibge,
    m.municipio,
    a.ano,
    coalesce(o.obitos_ocorrencia, 0) AS obitos_ocorrencia,
    coalesce(r.obitos_residencia, 0) AS obitos_residencia
FROM municipios m
CROSS JOIN anos a
LEFT JOIN ocorrencia o USING (cod_mun_ibge, ano)
LEFT JOIN residencia r USING (cod_mun_ibge, ano)
ORDER BY m.cod_mun_ibge, a.ano;

-- query: senatran_cobertura_bahia_v2
SELECT
    ano,
    count(*) AS linhas_municipio,
    count(DISTINCT cod_mun_ibge) AS municipios,
    sum(frota_total) AS frota_total,
    sum(frota_duas_rodas_motorizadas) AS frota_duas_rodas,
    count(*) FILTER (WHERE frota_total IS NULL) AS frota_total_nula,
    count(*) FILTER (WHERE frota_duas_rodas_motorizadas IS NULL)
        AS frota_duas_rodas_nula,
    count(DISTINCT source_sha256) AS fontes
FROM read_parquet('{{DATA_ROOT}}/gold/frota_municipio_ano.parquet')
WHERE uf = 'BA'
GROUP BY ano
ORDER BY ano;
