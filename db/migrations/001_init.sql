-- Schema canónico alinhado aos Parquets Gold e IBGE (camada de serviço).
-- Views espelham os nomes usados pelo backend (v_obitos, v_custos, ...).

CREATE TABLE IF NOT EXISTS gold_obitos_ocorrencia (
    cod_mun_ibge TEXT NOT NULL,
    municipio TEXT,
    uf TEXT NOT NULL,
    competencia DATE NOT NULL,
    ano BIGINT NOT NULL,
    mes BIGINT NOT NULL,
    total_obitos BIGINT NOT NULL,
    tipo_veiculo TEXT,
    faixa_etaria TEXT,
    sexo TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    populacao_estimada BIGINT
);

CREATE TABLE IF NOT EXISTS gold_obitos_residencia (
    cod_mun_ibge TEXT NOT NULL,
    municipio TEXT,
    uf TEXT NOT NULL,
    competencia DATE NOT NULL,
    ano BIGINT NOT NULL,
    mes BIGINT NOT NULL,
    total_obitos BIGINT NOT NULL,
    tipo_veiculo TEXT,
    faixa_etaria TEXT,
    sexo TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    populacao_estimada BIGINT
);

CREATE TABLE IF NOT EXISTS gold_custos (
    cod_mun_ibge TEXT NOT NULL,
    municipio TEXT,
    uf TEXT NOT NULL,
    competencia DATE NOT NULL,
    ano BIGINT NOT NULL,
    mes BIGINT NOT NULL,
    custo_total DOUBLE PRECISION,
    total_procedimentos BIGINT,
    total_atendimentos BIGINT,
    tipo_veiculo TEXT,
    faixa_etaria TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS dim_ibge_municipio (
    cod_mun_ibge TEXT NOT NULL PRIMARY KEY,
    nome TEXT,
    uf TEXT,
    regiao TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS dim_ibge_populacao (
    cod_mun_ibge TEXT NOT NULL,
    ano BIGINT NOT NULL,
    populacao BIGINT NOT NULL,
    PRIMARY KEY (cod_mun_ibge, ano)
);

CREATE INDEX IF NOT EXISTS idx_gold_obitos_ocor_ano_uf_mun
    ON gold_obitos_ocorrencia (ano, uf, cod_mun_ibge);
CREATE INDEX IF NOT EXISTS idx_gold_obitos_ocor_competencia
    ON gold_obitos_ocorrencia (competencia);

CREATE INDEX IF NOT EXISTS idx_gold_obitos_res_ano_uf_mun
    ON gold_obitos_residencia (ano, uf, cod_mun_ibge);
CREATE INDEX IF NOT EXISTS idx_gold_obitos_res_competencia
    ON gold_obitos_residencia (competencia);

CREATE INDEX IF NOT EXISTS idx_gold_custos_ano_uf_mun
    ON gold_custos (ano, uf, cod_mun_ibge);
CREATE INDEX IF NOT EXISTS idx_gold_custos_competencia
    ON gold_custos (competencia);

CREATE INDEX IF NOT EXISTS idx_dim_ibge_pop_ano_mun
    ON dim_ibge_populacao (ano, cod_mun_ibge);

CREATE OR REPLACE VIEW v_obitos_ocorrencia AS
    SELECT * FROM gold_obitos_ocorrencia;

CREATE OR REPLACE VIEW v_obitos_residencia AS
    SELECT * FROM gold_obitos_residencia;

CREATE OR REPLACE VIEW v_obitos AS
    SELECT * FROM v_obitos_ocorrencia;

CREATE OR REPLACE VIEW v_custos AS
    SELECT * FROM gold_custos;

CREATE OR REPLACE VIEW v_ibge_municipios AS
    SELECT
        cod_mun_ibge,
        nome,
        uf,
        regiao,
        lat,
        lon
    FROM dim_ibge_municipio;

CREATE OR REPLACE VIEW v_ibge_populacao AS
    SELECT cod_mun_ibge, ano, populacao FROM dim_ibge_populacao;
