-- Evita integer out of range (int64 Parquet vs INTEGER 32 bits no Postgres).
-- O Postgres não permite ALTER em colunas referenciadas por views: removemos
-- as views compatíveis, alteramos as tabelas e voltamos a criá-las (como no 001).

DROP VIEW IF EXISTS v_obitos;
DROP VIEW IF EXISTS v_obitos_ocorrencia;
DROP VIEW IF EXISTS v_obitos_residencia;
DROP VIEW IF EXISTS v_custos;
DROP VIEW IF EXISTS v_ibge_municipios;
DROP VIEW IF EXISTS v_ibge_populacao;

ALTER TABLE gold_obitos_ocorrencia
    ALTER COLUMN ano TYPE BIGINT USING ano::bigint,
    ALTER COLUMN mes TYPE BIGINT USING mes::bigint,
    ALTER COLUMN populacao_estimada TYPE BIGINT USING populacao_estimada::bigint;

ALTER TABLE gold_obitos_residencia
    ALTER COLUMN ano TYPE BIGINT USING ano::bigint,
    ALTER COLUMN mes TYPE BIGINT USING mes::bigint,
    ALTER COLUMN populacao_estimada TYPE BIGINT USING populacao_estimada::bigint;

ALTER TABLE gold_custos
    ALTER COLUMN ano TYPE BIGINT USING ano::bigint,
    ALTER COLUMN mes TYPE BIGINT USING mes::bigint;

ALTER TABLE dim_ibge_populacao
    ALTER COLUMN ano TYPE BIGINT USING ano::bigint,
    ALTER COLUMN populacao TYPE BIGINT USING populacao::bigint;

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
