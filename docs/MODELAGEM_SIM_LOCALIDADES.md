# Modelagem SIM: ocorrencia e residencia

A dimensao fisica e unica: `dim_municipio`, com codigo IBGE de sete digitos, nome, UF, regiao e geometria. A fato SIM mantem simultaneamente `cod_mun_ocorrencia_ibge` e `cod_mun_residencia_ibge`, alem dos codigos brutos e de seis digitos. Sao duas chaves estrangeiras para a mesma dimensao, em papeis diferentes (`municipio_ocorrencia` e `municipio_residencia`).

Nao e recomendavel criar duas dimensoes fisicas nem uma coluna unica `cod_mun_ibge` sem papel. Isso confundiria o denominador e poderia contar a mesma morte duas vezes. Para desempenho, marts separados por papel sao aceitaveis quando gerados da mesma Silver, como neste contrato.

Interpretacao dos indicadores:

- residencia: obitos de residentes / populacao residente;
- ocorrencia: obitos que ocorreram na area / populacao da area, descrito como taxa de ocorrencia, sem chama-la automaticamente de mortalidade da populacao residente;
- frota: usar o mesmo papel geografico do numerador e o mes/ano de referencia documentado.

A ausencia de municipio valido nao elimina o numerador da auditoria, mas impede a linha de entrar em mapas e taxas municipais.
