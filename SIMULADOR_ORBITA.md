# Órbita Simula — manual técnico e operacional (V1)

## Escopo

O Órbita Simula é um módulo autenticado do CRM de corretores. Reaproveita os produtos `public.products` e o catálogo `catalog_segments`/`catalog_groups`. Os **valores comerciais não vêm do catálogo antigo** porque nele não havia taxas de administração e fundo de reserva em colunas confiáveis.

A tabela `public.simulator_plans` armazena condições registradas pela Astrion para um produto e, opcionalmente, um grupo. O corretor só enxerga planos com `active = true` e `approved_for_use = true`. A administração pode cadastrar, editar e desativar planos. A interface não oferece exclusão permanente.

## Premissas de referência cadastradas (20/10/2026)

Os seis planos abaixo foram inseridos e ativados para **simulação referencial** pela direção da Astrion. Eles NÃO constituem proposta nem tabela homologada pela administradora.

| Produto | Crédito de referência | Prazo (meses) | TA total | FR total | Taxa prestamista mensal (fração) |
|---|---:|---:|---:|---:|---:|
| Imóveis | R$ 222.300 | 216 | 21,52% | 2,00% | 0,0003 |
| Automóveis | R$ 71.200 | 89 | 18,31% | 2,00% | 0,0007 |
| Pesados | R$ 247.700 | 104 | 13,70% | 2,00% | 0,00025 |
| Serviços | R$ 15.600 | 39 | 24,56% | 5,00% | 0,0007 |
| Motos | R$ 19.300 | 65 | 20,05% | 2,00% | 0,00025 |
| Outros | R$ 8.000 | 58 | 21,94% | 2,00% | 0,0007 |

**Prestamista no modelo atual:** o valor mensal estimado é o crédito escolhido multiplicado pela taxa em fração decimal. Exemplo: R$ 222.300 × 0,0003 = R$ 66,69/mês (0,03% a.m.). A base de cálculo é uma hipótese de simulação, não necessariamente o capital segurado real: não foi confirmado se o seguro incide sobre crédito original, saldo devedor ou outra base. O valor mensal é mantido constante no modelo, sem modelagem de amortização do seguro.

**Reajustes:** o parâmetro de reajuste anual foi mantido em 0% por ausência de informação. Isso NÃO significa que o consórcio tenha parcelas sem correção contratual.

**Prazo de Serviços e Pesados:** os prazos informados (39 e 104 meses) excedem limites legados no catálogo (36 e 100 meses). O Órbita permite o cálculo de referência e exibe aviso para confirmação pela Astrion. Os limites antigos do catálogo não foram alterados silenciosamente.

**Crédito de referência:** aparece como valor inicial ao selecionar o plano, pode ser alterado pelo corretor e não equivale a mínimo/máximo homologado de uma cota.

## Como configurar as taxas (administração)

1. Acesse **Planos de simulação**, no menu lateral.
2. Escolha o produto existente e, quando aplicável, o grupo cadastrado.
3. Informe nome do plano, crédito de referência, prazo, taxa total de administração, fundo de reserva total, taxa prestamista mensal em fração decimal, encargos extras, seguro mensal adicional (se aplicável) e reajuste anual hipotético.
4. Informe **origem e data** das condições, por exemplo, tabela comercial aprovada.
5. Marque **Plano ativo** e **Condições verificadas e liberadas** apenas após validação comercial.
6. Clique em **Salvar parâmetros**. Planos não publicados continuam restritos à administração.

**Importante:** os seis planos referenciais acima já estão cadastrados e ativos para estudo. Eles não devem ser tratados como tabelas homologadas ou condições definitivas da administradora.

## Como utilizar (corretor)

1. Abra **Órbita Simula**, no menu lateral.
2. Selecione o produto e o plano aprovado. Opcionalmente, selecione uma solicitação existente; o crédito e o bem serão aproveitados da solicitação.
3. O valor de referência aparece automaticamente e pode ser alterado. O sistema verifica faixas cadastrais e carrega TA, FR e prestamista sem edição direta pelo corretor.
4. Confira a parcela-base e o somatório do consórcio.
5. Para comparar com financiamento, informe taxa efetiva anual, entrada, prazo, sistema Price ou SAC e eventuais custos/seguros. **Não há juros de financiamento padrão**.
6. Clique em **Gerar relatório em PDF** e, na nova janela, em **Imprimir / Salvar como PDF**.

Dentro dos detalhes de uma solicitação, o botão **Simular crédito** abre o módulo preenchido com o produto e os valores da oportunidade.

## Metodologia e ressalvas

**Consórcio (aproximação linear):**
- Parcela base = `Crédito × (1 + [Taxa Adm Total + Fundo Total + Outros Total] / 100) / Prazo`.
- Prestamista mensal é estimado como crédito escolhido × taxa mensal fracionária. Um seguro mensal fixo adicional só é somado quando expressamente configurado.
- Reajuste anual hipotético incide no valor da parcela-base a cada 12 meses; não representa necessariamente a correção real do crédito nem do fundo.
- Somatório = soma dos pagamentos de cada mês até o prazo, conforme essas hipóteses.
- Não modela parcelas reduzidas, antecipação, contemplação, lance embutido, prestamista sobre saldo devedor, regras específicas de grupo ou retorno do fundo.

**Financiamento:**
- Saldo financiado = valor do bem – entrada.
- Taxa mensal efetiva = `(1 + taxa anual efetiva)^(1/12) – 1`.
- Price usa parcela financeira uniforme; SAC usa amortização constante.
- Custos mensais e iniciais são incluídos apenas se informados.
- **Não equivale ao CET** nem garante aprovação ou taxa bancária.

**Comparação:** os totais não são equivalentes em acesso ao bem, liquidez inicial, reajuste, prazo de contemplação ou estrutura de custos. O consórcio não tem garantia de contemplação. Todos os resultados são simulados, não propostas oficiais.

## Segurança, testes e publicação

- RLS da tabela `simulator_plans` exige perfil ativo; somente administradores criam/alteram planos.
- O cliente autenticado já usa Supabase Auth existente; nenhum segredo foi adicionado ao frontend.
- `tests/simulator.mjs` testa as fórmulas Price/SAC e o somatório do consórcio.
- `tests/simulator-dom.mjs` executa teste de interação e navegação com DOM sintético.
- Workflow: `.github/workflows/simulator-tests.yml`.
- O login, as solicitações existentes, o histórico e o banco do pipeline B2B não foram modificados.
