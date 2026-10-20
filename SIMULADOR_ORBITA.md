# Órbita Simula — manual técnico e operacional (V1)

## Escopo

O Órbita Simula é um módulo autenticado do CRM de corretores. Reaproveita os produtos `public.products` e o catálogo `catalog_segments`/`catalog_groups`. Os **valores comerciais não vêm do catálogo antigo** porque nele não havia taxas de administração e fundo de reserva em colunas confiáveis.

A tabela `public.simulator_plans` armazena condições registradas pela Astrion para um produto e, opcionalmente, um grupo. O corretor só enxerga planos com `active = true` e `approved_for_use = true`. A administração pode cadastrar, editar e desativar planos. A interface não oferece exclusão permanente.

## Como configurar as taxas (administração)

1. Acesse **Planos de simulação**, no menu lateral.
2. Escolha o produto existente e, quando aplicável, o grupo cadastrado.
3. Informe nome do plano, prazo, taxa total de administração, fundo de reserva total, outros encargos totais, seguro mensal fixo e reajuste anual hipotético.
4. Informe **origem e data** das condições, por exemplo, tabela comercial aprovada.
5. Marque **Plano ativo** e **Condições verificadas e liberadas** apenas após validação comercial.
6. Clique em **Salvar parâmetros**. Planos não publicados continuam restritos à administração.

**Importante:** nenhuma taxa foi pré-preenchida automaticamente com estimativas. Até o cadastro e liberação pela Astrion, a tela do corretor informa que não há plano homologado para simular.

## Como utilizar (corretor)

1. Abra **Órbita Simula**, no menu lateral.
2. Selecione o produto e o plano aprovado. Opcionalmente, selecione uma solicitação existente; o crédito e o bem serão aproveitados da solicitação.
3. Informe o valor do crédito. O sistema verifica os limites de referência cadastrados e carrega as taxas do plano sem edição manual.
4. Confira a parcela-base e o somatório do consórcio.
5. Para comparar com financiamento, informe taxa efetiva anual, entrada, prazo, sistema Price ou SAC e eventuais custos/seguros. **Não há juros de financiamento padrão**.
6. Clique em **Gerar relatório em PDF** e, na nova janela, em **Imprimir / Salvar como PDF**.

Dentro dos detalhes de uma solicitação, o botão **Simular crédito** abre o módulo preenchido com o produto e os valores da oportunidade.

## Metodologia e ressalvas

**Consórcio (aproximação linear):**
- Parcela base = `Crédito × (1 + [Taxa Adm Total + Fundo Total + Outros Total] / 100) / Prazo`.
- Seguro mensal fixo é adicionado em cada mês.
- Reajuste anual hipotético incide no valor da parcela-base a cada 12 meses; não representa necessariamente a correção real do crédito nem do fundo.
- Somatório = soma dos pagamentos de cada mês até o prazo, conforme essas hipóteses.
- Não modela parcelas reduzidas, antecipação, contemplação, lance embutido, regras específicas de grupo ou retorno de fundo.

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
