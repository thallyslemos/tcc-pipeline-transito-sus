-- Marts SIM-only (contrato de evidencia v1) para serving PostgreSQL.
-- Artefatos: sim_v1_obitos_municipio_mes_{ocorrencia,residencia}_v2.parquet

CREATE TABLE IF NOT EXISTS gold_sim_obitos_ocorrencia (
    tipo_local TEXT NOT NULL,
    cod_mun_ibge TEXT,
    cod_mun_ibge_6 TEXT,
    municipio TEXT,
    uf TEXT,
    geografia_status TEXT,
    competencia DATE NOT NULL,
    ano BIGINT NOT NULL,
    mes BIGINT NOT NULL,
    tipo_veiculo TEXT,
    faixa_etaria TEXT,
    sexo BIGINT,
    sexo_desc TEXT,
    total_obitos BIGINT NOT NULL,
    registros_unicos BIGINT,
    populacao_estimada BIGINT,
    populacao_status TEXT,
    taxa_obitos_100mil DOUBLE PRECISION,
    frota_total BIGINT,
    frota_status TEXT,
    taxa_obitos_10mil_veiculos DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS gold_sim_obitos_residencia (
    tipo_local TEXT NOT NULL,
    cod_mun_ibge TEXT,
    cod_mun_ibge_6 TEXT,
    municipio TEXT,
    uf TEXT,
    geografia_status TEXT,
    competencia DATE NOT NULL,
    ano BIGINT NOT NULL,
    mes BIGINT NOT NULL,
    tipo_veiculo TEXT,
    faixa_etaria TEXT,
    sexo BIGINT,
    sexo_desc TEXT,
    total_obitos BIGINT NOT NULL,
    registros_unicos BIGINT,
    populacao_estimada BIGINT,
    populacao_status TEXT,
    taxa_obitos_100mil DOUBLE PRECISION,
    frota_total BIGINT,
    frota_status TEXT,
    taxa_obitos_10mil_veiculos DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_gold_sim_ocor_ano_uf_mun
    ON gold_sim_obitos_ocorrencia (ano, uf, cod_mun_ibge_6);
CREATE INDEX IF NOT EXISTS idx_gold_sim_ocor_geo
    ON gold_sim_obitos_ocorrencia (geografia_status);
CREATE INDEX IF NOT EXISTS idx_gold_sim_ocor_competencia
    ON gold_sim_obitos_ocorrencia (competencia);

CREATE INDEX IF NOT EXISTS idx_gold_sim_res_ano_uf_mun
    ON gold_sim_obitos_residencia (ano, uf, cod_mun_ibge_6);
CREATE INDEX IF NOT EXISTS idx_gold_sim_res_geo
    ON gold_sim_obitos_residencia (geografia_status);
CREATE INDEX IF NOT EXISTS idx_gold_sim_res_competencia
    ON gold_sim_obitos_residencia (competencia);

CREATE OR REPLACE VIEW v_sim_obitos_ocorrencia AS
    SELECT * FROM gold_sim_obitos_ocorrencia;

CREATE OR REPLACE VIEW v_sim_obitos_residencia AS
    SELECT * FROM gold_sim_obitos_residencia;
