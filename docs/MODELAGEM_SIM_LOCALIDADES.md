# Modelagem SIM: ocorr?ncia e resid?ncia

A dimens?o f?sica ? ?nica: `dim_municipio`, com c?digo IBGE de sete d?gitos, nome, UF, regi?o e geometria. A fato SIM mant?m simultaneamente `cod_mun_ocorrencia_ibge` e `cod_mun_residencia_ibge` (mais os c?digos brutos/6 d?gitos). S?o duas chaves estrangeiras para a mesma dimens?o, em pap?is diferentes (`municipio_ocorrencia` e `municipio_residencia`).

N?o ? recomend?vel criar duas dimens?es f?sicas nem uma coluna ?nica `cod_mun_ibge` sem papel. Isso confundiria o denominador e permitiria somar a mesma morte duas vezes. Para desempenho, marts separados por papel s?o aceit?veis quando gerados da mesma Silver, como neste contrato.

Interpreta??o dos indicadores:

- resid?ncia: ?bitos de residentes / popula??o residente;
- ocorr?ncia: ?bitos que ocorreram na ?rea / popula??o da ?rea, descrito como taxa de ocorr?ncia, sem cham?-la automaticamente de mortalidade da popula??o residente;
- frota: usar o mesmo papel geogr?fico do numerador e o m?s/ano de refer?ncia documentado.

A API deve exigir `dimensao=ocorrencia|residencia` (ou `localidade`) e devolver a origem da chave e do denominador.
