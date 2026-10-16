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

### 2. Configure o acesso

Em Supabase Authentication, desabilite inscrições públicas, configure SMTP transacional, política de senhas e URLs permitidas. Crie seu usuário **manualmente** em Authentication → Users. O trigger cria os perfis **inativos por padrão**, inclusive o primeiro administrador. Após a criação, execute no SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin', active = true
WHERE email = 'SEU_EMAIL@ASTRION360.COM.BR';
SELECT id,email,role,active FROM public.profiles;
```

Confira manualmente que apenas seu usuário tem `role='admin'`. Recomenda-se ativar MFA do administrador e configurar política de sessão compatível com o risco.

### 3. Convites aos corretores

Implante `supabase/functions/invite-broker/index.ts` como Edge Function com nome `invite-broker`. Habilite verificação JWT no gateway. Defina variável de ambiente privada:

`CRM_SITE_URL=https://corretores.astrion360.com.br`

A função verifica a sessão e o papel admin no banco, convida pelo Auth e **ativa explicitamente** o perfil broker recém-criado. Usa `SUPABASE_SECRET_KEYS` (ou `SUPABASE_SERVICE_ROLE_KEY` legado) no **ambiente da função**, jamais no cliente. Configure e teste o template e entrega do convite/recuperação por e-mail.

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

Se preferir teste local de interface: `python -m http.server 8000` na raiz. Login local exige URL autorizada no Auth. Convites via Edge Function exigem correspondência exata com `CRM_SITE_URL`.

### 6. Homologação obrigatória

Execute `supabase/security_audit.sql` e `tests/seguranca.md`. Crie **dois corretores de teste**, enviei solicitações diferentes e tente acessar uma solicitação, pesquisa, cliente e cotação do outro corretor **diretamente pela API**, incluindo INSERT e UPDATE maliciosos. Simule suspensão de corretor, publicação de devolutiva, notas internas, fluxo de rascunho e links de recuperação.

## Restrições e próximos passos

- **Implantação parcial concluída em 16/10/2026:** projeto dedicado `ruibwnajvardznucetcg` criado na região de São Paulo; banco com RLS instalado; Edge Function `invite-broker` ativa; `config.js` conectado e login publicado no GitHub Pages. **Pendentes para uso real:** primeiro usuário administrador via Supabase Auth, URL Configuration/SMTP e testes end-to-end com dois corretores. A ativação do painel de usuários não acontece só por publicar o frontend.
- Atualmente não há anexo/upload de documentos, integração direta com parceiros, notificações transacionais automáticas, aceite digital formal, envio automatizado de contratos ou comissionamento.
- Atualização de tela por recarga e polling a cada 60 segundos. Limite atual: até 10 mil registros por tabela no cliente e 150 eventos por solicitação. Para volumes grandes, implementar paginação e agregação SQL seguras.
- A trilha de eventos é imutável pela API da aplicação, mas não é um log antifraude de nível pericial. Para auditoria ampliada, incluir trilha de alteração dos campos antes/depois, retenção e alertas de acesso.
- LGPD: cadastrar somente dados essenciais com base legal documentada, definir prazo de retenção, transparência ao titular, contrato com prestadores e canal para solicitações de dados. Não coletar CPF, contracheque, dados financeiros detalhados ou documentos neste MVP.

Documentação base: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase Auth functions](https://supabase.com/docs/guides/functions/auth), [Cloudflare Pages](https://developers.cloudflare.com/pages/).
