# Especificação funcional — Astrion | Portal Corretor → Assessoria

**Produto:** portal multicarteira de originação e atendimento de solicitações de cotação de consórcios.

**Não é:** sistema de administração de grupos/cotas, emissão contratual, portal direto ao cliente final nem comparador automaticamente conectado às administradoras.

## 1. Cadastro de corretor

Responsável comercial, nome, e-mail de login, empresa/corretora, telefone, situação ativo/suspenso. Acesso provisionado por convite administrativo. Cada cliente e cada solicitação pertence exatamente a um corretor; a atribuição não pode ser modificada por edição simples.

## 2. Cadastro do cliente

Nome, WhatsApp, e-mail, cidade, estado, base legal LGPD e observações comerciais breves. Evitar dados de saúde, contracheque, dados bancários, CPF e documentos sem necessidade e controles específicos.

## 3. Formulário de solicitação (corretor)

| Grupo | Campo | Natureza |
|---|---|---|
| Identificação | Cliente, corretor, categoria (imóvel, auto, moto, pesado, serviço, outro) | Obrigatórios |
| Finalidade | Compra, troca, investimento etc., campo livre | Opcional |
| Bem | Referência/descrição, condição novo/usado/não se aplica | Referência obrigatória ao enviar |
| Valores | Valor estimado do bem, crédito solicitado | Obrigatórios ao enviar; não necessariamente iguais |
| Capacidade | Prazo desejado, teto de parcela mensal | Opcionais |
| Necessidade | Urgência, preferência por contemplação antecipada, aceitação de cota padrão | Urgência obrigatória ao enviar |
| Lance | Intenção: sim/não/avaliando; tipo: próprios/embutido/combinado/indefinido; orçamento em R$ e percentual | Intenção obrigatória ao enviar; demais opcionais |
| Gestão | Origem, próxima data de acompanhamento, observações para assessoria | Opcionais |

Salvar rascunho não exige preenchimento final. **Enviar à assessoria exige os campos obrigatórios** e bloqueia a edição direta pelo corretor. Solicitações de alteração entram por mensagens e ficam registradas com autor e data.

## 4. Atendimento pela Astrion

Fila central com filtros por corretor, categoria e status. Gestão de triagem, pedidos de esclarecimento, registro de pesquisas internas e publicação de devolutivas. As mensagens podem ser externas (visíveis ao corretor) ou internas (privativas da assessoria). O sistema não integra nem aplica regras particulares de administradoras.

### Registro de pesquisa interna

Nome livre do parceiro consultado, situação da consulta, crédito, prazo, parcela e notas. Esses dados servem à comparação privada da assessoria; **nenhum corretor tem permissão de leitura, criação ou alteração dessa tabela**.

### Devolutiva publicada

Cada oportunidade pode ter várias alternativas de cotação. Cada alternativa contém identificação, parceiro (campo opcional), crédito, prazo, parcela estimada, taxa administrativa total, fundo de reserva, seguro, observações de lance, condições e validade. Dados incompletos devem aparecer como **a confirmar**, não como zero.

O sistema diferencia rascunhos internos das condições publicadas. A publicação gera histórico e atualiza a solicitação para `cotada`; cada opção publicada torna-se imutável. Uma revisão deve ser um novo registro, preservando as condições anteriores.

**Aviso:** cotação é indicativa até validação junto ao parceiro. Não há garantia de contemplação, nem automatização de aprovação/contratação.

## 5. Painel executivo (apenas administração)

Total de corretores ativos e suspensos, clientes, pedidos, distribuição por status, valor total de crédito solicitado, segmentação por categorias e corretor, prazo médio da fila (evolução futura), quantidade de devolutivas enviadas (evolução futura), taxa de pedidos contratados e produtividade.

A versão atual entrega filtros, indicadores de carteira e crédito, funil, propostas em pesquisa e exportação CSV; SLA e tempos médios ficam na trilha de melhorias.

## 6. Segurança, privacidade e compliance

- A autorização é feita no Postgres com RLS. O frontend nunca autoriza acesso por si só.
- Só usuário administrador ativo consulta todas as carteiras.
- Corretores consultam suas linhas e devolutivas **publicadas**; não têm acesso a pesquisas internas.
- Acesso de usuários novos permanece suspenso por padrão.
- Usar medidas de privacidade desde o desenho, backup, registro de consentimento/base legal, termos de uso e ciclo de retenção.
- Anexos, assinatura eletrônica, contratos, integrações, notificações automáticas e indicadores históricos avançados **não fazem parte deste MVP**.

## 7. Próximas fases recomendadas

**Fase 2:** notificações (e-mail/WhatsApp com opt-in), lembretes, SLAs, visualização de múltiplas opções em tabela e escolha formal pelo corretor.

**Fase 3:** documentos em storage privado com antivírus, trilha de auditoria campo-a-campo, duplicidade de clientes entre corretores sem expor dados, política de retenção, aceite e transferência controlada de carteira.

**Fase 4:** integrações com parceiros (quando houver API/convênio), regras de importação e reconciliação com contratação, comissões por corretor e dashboards financeiros/safras.
