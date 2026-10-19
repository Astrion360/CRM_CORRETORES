# ÓRBITA by Astrion | Plataforma de relacionamento, oportunidades e cotações

**Endereço oficial:** https://corretores.astrion360.com.br/

**Marca:** ÓRBITA by Astrion · **Assinatura:** Conexões em movimento.

**Nota técnica:** Os identificadores do repositório, banco e integrações permanecem inalterados para preservar os acessos e as automações.

## Jornada comercial v3

1. O corretor cadastra o cliente com base legal apropriada e uma solicitação com dados do bem, crédito, prazo, parcela, tipo de cliente, plano preferido, fonte do lance, garantias e documentação.
2. A administração revisa os dados em **Solicitações de cotação**, emite **Ficha para Âncora → Imprimir / Salvar em PDF** e registra protocolo/status no menu **Envios à Âncora**. O envio continua manual, por canal escolhido pela assessoria.
3. A Âncora devolve condições específicas. A Astrion cadastra uma ou mais **Condições** por solicitação: grupo, plano, prazo, crédito, parcela inicial e pós-contemplação, taxas, fundo, seguro, correção, referência, validade e ressalvas.
4. A administração publica apenas as condições aprovadas. O corretor vê as opções publicadas e pode emitir uma **Devolutiva em PDF** com identidade Astrion.
5. Histórico, notas internas, permissões RLS e estados de negociação continuam preservados.

**Catálogo de referência:** menu **Catálogo / Grupos**, organizado em 6 segmentos e 11 grupos de referência. Dados derivados de **Treinamento atualizado.pptm**, slides 2–21, com limites e regras historicamente informados no treinamento. Os parâmetros **não são cotação, homologação nem garantia de disponibilidade ou contemplação**; devem ser revisados com a administradora por grupo/data. O administrador pode editar as regras, revisar valores e cadastrar grupos.

**Impressão:** a tela de documentos usa formato A4 e botão *Imprimir / Salvar em PDF* do navegador. Não existe envio automático ao parceiro. As fichas para cotação são internas da Astrion; as devolutivas do corretor trazem somente condições já publicadas.

**Segurança e dados:** sem alteração das identidades existentes; corretores continuam isolados por carteira; a tabela interna de encaminhamentos é acessível somente ao administrador; cotações em rascunho não são visíveis ao corretor. A primeira troca obrigatória de senha permanece aplicada. Não inclua CPF, documentos, dados de saúde ou renda detalhada em campos de observações.

**Pendências de produção:** validar o primeiro fluxo completo em navegadores autenticados com contas reais; homologar regras/grupos com a Âncora; revisar privacidade/retenção, configurar SMTP transacional e proteção contra senhas vazadas no Supabase.

---

# ASTRION | Portal de Solicitações de Consórcios — v2

**Status atual do ambiente:** consulte [IMPLANTACAO.md](IMPLANTACAO.md) antes de executar etapas de instalação. O projeto Supabase exclusivo e a publicação no GitHub Pages já foram realizados.


Sistema web em HTML, CSS e JavaScript, para relacionamento **entre a assessoria Astrion e seus corretores**. Uma solicitação é a demanda do cliente que será analisada pela assessoria; **não é uma proposta oficial emitida por uma administradora**. Não há cadastros de regras, cotas, taxas ou formulários particulares de administradoras.

## Jornada operacional

1. **Corretor** cadastra seu cliente, seleciona o tipo de bem, descreve o bem de referência, seu preço e crédito esperado, informa prazo, parcela desejada, urgência, intenção de lance, valor/percentual e observações.
2. **Corretor** salva rascunho ou envia à Astrion. Após envio, não pode adulterar a solicitação; alterações passam pelo atendimento da assessoria. Pode responder por mensagens e pedir ajustes.
3. **Astrion** recebe o pedido, classifica a etapa e pesquisa condições entre parceiros. Registra consultas internas sem expô-las a corretores.
4. **Astrion** cria uma ou mais **condições de cotação** comparáveis (crédito, prazo, parcela estimada, taxa, fundo, seguro, orientações de lance, ressalvas e validade). Pode salvar internamente ou publicar.
5. **Corretor** acessa apenas as condições publicadas de suas solicitações, negocia com o cliente e solicita esclarecimentos. A administração atualiza os status até contratação/encerramento.

Status: `rascunho → enviada → triagem → em_cotacao → pendencia/cotada → em_negociacao → contratada/encerrada`. O fluxo admite retornos entre estados pela administração.

### O que não deve ser confundido

- **Valor do bem** ≠ **crédito solicitado** ≠ **crédito efetivamente ofertado**. São campos separados.
- **Taxa de administração** informada na devolutiva é percentual total da opção; **parcela estimada** não deve ser calculada ingenuamente só a partir do crédito e prazo.
- **Lance pretendido** não implica contemplação e lance embutido depende da modalidade efetivamente oferecida.
- Condições divulgadas são **indicativas**, sujeitas a validade, disponibilidade, reajustes, análise e documentação contratual da administradora.
- O nome do parceiro é um campo livre de registro de pesquisa/devolutiva, **não um cadastro ou parametrização de administradoras**.

## Matriz de permissões

| Operação | Corretor | Astrion/Admin |
|---|---|---|
| Ver clientes e pedidos | Somente sua carteira | Todas as carteiras |
| Cadastrar cliente | Em sua carteira | Por corretor |
| Criar/editar solicitação | Só rascunhos próprios | Todas |
| Enviar pedido para cotação | Só sua solicitação | Pode coordenar todas |
| Alterar situação após o envio | Não | Sim |
| Consultar pesquisa interna entre parceiros | Nunca | Sim |
| Registrar pesquisa com parceiros | Nunca | Sim |
| Ver devolutivas | Publicadas em suas solicitações | Publicadas e rascunhos de todas |
| Publicar ou editar devolutivas | Nunca | Pode criar/publicar; após publicar, imutável |
| Mensagens | Nas próprias solicitações | Em todas, incluindo notas internas |
| Gestão de corretores/categorias/exportações | Não | Sim |

**As autorizações são implementadas no PostgreSQL (RLS, permissões por coluna, chaves estrangeiras e triggers)**, não em filtros HTML.

## Estrutura

```text
index.html, styles.css, app.js       # Portal web
config.js, config.example.js         # URL do projeto e chave publicável (nunca secreta)
assets/favicon.svg
supabase/schema.sql                  # Banco v2 para PROJETO NOVO
supabase/functions/invite-broker/index.ts
supabase/security_audit.sql
tests/seguranca.md
README.md, SECURITY.md
```

## Instalação

### 1. Separe o projeto Supabase

Crie **um projeto novo**, exclusivo para este portal, para não colocar em risco o Supabase usado pelo pipeline B2B da Astrion. Execute `supabase/schema.sql` no SQL Editor **uma vez**. Este é o esquema inicial v2, **não é uma migração para aplicar sobre a v1**.

Tabelas: `profiles`, `products` (somente categorias genéricas), `clients`, `opportunities`, `opportunity_events`, `partner_checks` (internas) e `quote_options` (devolutivas). RLS está habilitado em todas.

### 2. Regra oficial de contas: criação manual

**Somente a administração cadastra usuários.** Corretores **não** criam as próprias contas. Não usamos links de convite ou mensagens automáticas de ativação.

No novo projeto Supabase, abra **Authentication → Users → Add user → Create new user** (não `Send invite`). Defina o e-mail e uma **senha provisória forte**, com confirmação manual de e-mail no ato de criação. Não compartilhe a senha por e-mail aberto, repositório ou planilha.

Na ÓRBITA → **Corretores → Cadastrar corretor**, há instruções para esse cadastro. Após criar a conta no Supabase, clique em **Atualizar**, escolha **Gerenciar** para completar nome, empresa e telefone e marque **Ativo**. A conta aparece automaticamente na tabela `profiles` pelo trigger de criação do Auth, inicialmente suspensa.

O corretor recebe as credenciais por canal privado e acessa a ÓRBITA. **O primeiro acesso exige a substituição da senha provisória**, com mínimo de 12 caracteres e confirmação. Até que o Auth registre a atualização de senha, as políticas RLS impedem o acesso aos clientes, oportunidades, categorias e dados internos; somente o próprio perfil fica visível.

Após o primeiro acesso, o usuário também pode selecionar **Alterar minha senha** no menu lateral. A nova senha passa pelo Supabase Auth; por segurança, o portal encerra a sessão globalmente e solicita novo login.

A coluna `public.profiles.password_change_required` (default `true`) é limpa automaticamente por trigger protegido quando o Supabase Auth registra alteração de `encrypted_password`. O papel `authenticated` não tem permissão de alterar diretamente o marcador. Contas pré-existentes receberam `false` na implantação de 16/10/2026. A RLS verifica `active AND NOT password_change_required` para as ações de negócio.

É necessário **desabilitar o cadastro público (Allow new users to sign up)** nas configurações do Supabase Auth. Essa configuração depende do painel Auth e ainda requer verificação pelo proprietário do projeto. Embora a RLS mantenha contas não autorizadas sem acesso, isso não equivale a desabilitar inscrições no serviço de autenticação.

### 3. Convites desativados

A função legada `invite-broker` retorna **HTTP 410 (Gone)** e permanece apenas como rota desativada. O fluxo de registro por convite foi removido da interface. **Não existe Edge Function de provisionamento de usuários operante**: a criação é realizada manualmente no painel Supabase Auth.

Para o acesso por senha, não é necessário SMTP no momento do cadastro manual. A recuperação de senha por e-mail permanece no frontend e exige SMTP transacional configurado e URLs de redirecionamento corretas.

### 4. Conecte o frontend

Em `config.js`, adicione apenas a URL e a chave **publicável** do novo projeto:

```js
window.ASTRION_CRM_CONFIG = {
  SUPABASE_URL: 'https://ID_DO_NOVO_PROJETO.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...'
};
```

Não publique `sb_secret`, `service_role`, senhas, tokens pessoais, `DATABASE_URL` ou credenciais SMTP. Configure Authentication → URL Configuration para o domínio definitivo e URLs de retorno confiáveis.

### 5. Publique

Envie os arquivos da pasta para um repositório GitHub (preferencialmente privado). Em Cloudflare Pages, conecte o GitHub, projeto **sem build**, saída `.` (raiz). Configure o subdomínio em Custom Domains e verifique HTTPS. Cloudflare hospeda **apenas o frontend estático**; Auth, dados e funções ficam no Supabase.

Se preferir teste local de interface: `python -m http.server 8000` na raiz. Login local exige URL autorizada no Auth. Os e-mails de recuperação dependem de SMTP transacional e URLs permitidas no Supabase Auth.

### 6. Homologação obrigatória

Execute `supabase/security_audit.sql` e `tests/seguranca.md`. Crie **dois corretores de teste**, enviei solicitações diferentes e tente acessar uma solicitação, pesquisa, cliente e cotação do outro corretor **diretamente pela API**, incluindo INSERT e UPDATE maliciosos. Simule suspensão de corretor, publicação de devolutiva, notas internas, fluxo de rascunho e links de recuperação.

## Restrições e próximos passos

- **Em 16/10/2026:** Supabase exclusivo ativo; RLS e fluxo de troca obrigatória de senha implantados; contas cadastradas manualmente em Auth; função de convites desativada. Pendente: configuração Auth (cadastro público, URLs e SMTP para recuperação), homologação end-to-end com usuário real e domínio próprio.
- Atualmente não há anexo/upload de documentos, integração direta com parceiros, notificações transacionais automáticas, aceite digital formal, envio automatizado de contratos ou comissionamento.
- Atualização de tela por recarga e polling a cada 60 segundos. Limite atual: até 10 mil registros por tabela no cliente e 150 eventos por solicitação. Para volumes grandes, implementar paginação e agregação SQL seguras.
- A trilha de eventos é imutável pela API da aplicação, mas não é um log antifraude de nível pericial. Para auditoria ampliada, incluir trilha de alteração dos campos antes/depois, retenção e alertas de acesso.
- LGPD: cadastrar somente dados essenciais com base legal documentada, definir prazo de retenção, transparência ao titular, contrato com prestadores e canal para solicitações de dados. Não coletar CPF, contracheque, dados financeiros detalhados ou documentos neste MVP.

Documentação base: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase Auth functions](https://supabase.com/docs/guides/functions/auth), [Cloudflare Pages](https://developers.cloudflare.com/pages/).
