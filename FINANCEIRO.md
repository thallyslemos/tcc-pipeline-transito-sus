# Metodologia de Calculos Financeiros

Documentacao tecnica dos calculos financeiros utilizados no pipeline.
**Leia com atencao antes de citar valores em apresentacoes ou publicacoes.**

## 1. Fonte dos Dados Financeiros

### SIA/PA - Sistema de Informacoes Ambulatoriais / Producao Ambulatorial

Os dados financeiros vem do **SIA/PA do DATASUS**, que registra todos os
procedimentos ambulatoriais realizados no ambito do SUS.

- **Sistema**: SIA - Sistema de Informacoes Ambulatoriais
- **Subsistema**: PA - Producao Ambulatorial
- **Orgao**: Ministerio da Saude / DATASUS
- **Periodicidade**: Mensal (competencia AAMM)
- **Abrangencia**: Todos os estabelecimentos SUS do Brasil

### Campos Financeiros Utilizados

| Campo DATASUS | Campo Silver | Significado | Unidade |
|---------------|-------------|-------------|---------|
| `PA_VALAPR` | `valor_aprovado` | Valor aprovado para pagamento | R$ (Reais) |
| `PA_QTDAPR` | `qtd_aprovada` | Quantidade de procedimentos aprovados | Unidade |
| `PA_PROC_ID` | (nao usado) | Codigo do procedimento na tabela SIGTAP | Codigo |

### Significado Detalhado de PA_VALAPR

O campo `PA_VALAPR` (Valor Aprovado) representa:

> O valor financeiro total aprovado pelo gestor (municipal, estadual ou federal)
> para pagamento ao estabelecimento de saude pelo procedimento ambulatorial
> realizado. Este valor e calculado pelo sistema com base na Tabela de
> Procedimentos do SUS (SIGTAP) e JA REPRESENTA O TOTAL DO REGISTRO.

**ATENCAO**: O valor aprovado (`PA_VALAPR`) **NAO deve ser multiplicado**
pela quantidade aprovada (`PA_QTDAPR`). O campo ja contem o valor total.
A quantidade e informativa para contagem de procedimentos.

## 2. Calculos Realizados

### 2.1 Custo Total por Municipio/Mes

```
custo_total = SUM(PA_VALAPR)
```

- **O que e**: Soma simples de todos os valores aprovados para procedimentos
  ambulatoriais relacionados a acidentes de transito (CID V01-V89) em um
  municipio, num determinado mes.
- **Filtro aplicado**: Apenas registros com `PA_CIDPRI` entre V01 e V89
  (Capitulo XX da CID-10 - Acidentes de Transporte Terrestre).
- **NAO inclui**: Internacoes hospitalares (que estao no SIH, nao no SIA).

### 2.2 Custo per Capita

```
custo_per_capita = custo_total / populacao_estimada_ibge
```

- **Numerador**: `SUM(PA_VALAPR)` filtrado por CID V01-V89
- **Denominador**: Populacao estimada do IBGE (Tabela 6579 SIDRA)
- **Referencia populacao**: 1o de julho do ano (metodologia IBGE)
- **Unidade**: R$ por habitante

### 2.3 Taxa de Mortalidade por 100 mil Habitantes

```
taxa = (total_obitos / populacao_estimada_ibge) * 100.000
```

- **Numerador**: Contagem de obitos com causa basica V01-V89 (SIM)
- **Denominador**: Populacao estimada do IBGE (Tabela 6579)
- **Constante**: 100.000 (padrao OMS/DATASUS)
- **Referencia**: DATASUS Ficha de Qualificacao C.12
- **URL**: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm

## 3. Limitacoes Conhecidas

### 3.1 Subnotificacao

Os dados do SIA registram apenas procedimentos **realizados e aprovados** no SUS.
Nao capturam:
- Atendimentos na rede privada / convenios
- Procedimentos glosados (rejeitados pelo gestor)
- Atendimentos informais ou nao registrados

### 3.2 Valores Defasados

Os valores da tabela SIGTAP podem estar defasados em relacao aos custos reais,
pois a tabela nao e atualizada com frequencia. O custo real de um procedimento
pode ser significativamente superior ao valor aprovado pelo SUS.

### 3.3 Escopo Ambulatorial

O SIA cobre apenas **producao ambulatorial**. Para internacoes hospitalares
(cirurgias, UTI, internacoes prolongadas), seria necessario cruzar com o
**SIH** (Sistema de Informacoes Hospitalares), que nao esta incluido neste MVP.

### 3.4 CID como Proxy

O filtro por CID V01-V89 captura a **causa basica** informada. Pode haver:
- Subcodificacao (acidente registrado com CID generico)
- Erros de preenchimento na Declaracao de Obito
- Procedimentos ambulatoriais cujo CID primario nao e o de transito

## 4. O que os Numeros NAO Representam

- **NAO sao o custo total** de acidentes de transito para o SUS
  (faltam internacoes, reabilitacao, previdencia)
- **NAO sao o custo para a sociedade** (faltam custos indiretos,
  perda de produtividade, danos materiais)
- **Sao o custo ambulatorial aprovado** para procedimentos
  classificados com CID de acidente de transito terrestre

## 5. Referencias

1. BRASIL. Ministerio da Saude. DATASUS. **Informe Tecnico: Sistema de
   Informacoes Ambulatoriais do SUS (SIA/SUS) - Layout do Arquivo de
   Producao Ambulatorial**. Brasilia: Ministerio da Saude, 2019.

2. BRASIL. Ministerio da Saude. **SIGTAP - Sistema de Gerenciamento da
   Tabela de Procedimentos, Medicamentos e OPM do SUS**.
   Disponivel em: http://sigtap.datasus.gov.br

3. BRASIL. Ministerio da Saude. DATASUS. **Ficha de Qualificacao C.12 -
   Taxa de Mortalidade por Causas Externas**.
   Disponivel em: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm

4. IBGE. **Estimativas da Populacao Residente - Tabela 6579**.
   Disponivel em: https://sidra.ibge.gov.br/tabela/6579

5. RIPSA. **Indicadores e Dados Basicos para a Saude no Brasil (IDB)**.
   Rede Interagencial de Informacoes para a Saude.
   Disponivel em: http://tabnet.datasus.gov.br/cgi/idb2012/matriz.htm
