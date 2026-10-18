# Implantação do CRM Corretores — 16/10/2026

## Concluído
- Organização: Astrion360's Org.
- Supabase novo e separado: `Astrion CRM Corretores` (ref: `ruibwnajvardznucetcg`), região `sa-east-1`.
- Migration instalada `astrion_crm_initial_secure_schema_v2`.
- Sete tabelas públicas: `profiles`, `products`, `clients`, `opportunities`, `opportunity_events`, `quote_options`, `partner_checks`; RLS habilitada em todas; 6 categorias genéricas.
- Segurança do Supabase: análise automática inicial sem avisos; teste com perfil não aprovado retorna zero produtos/perfis/registros internos.
- Edge Function legada `invite-broker` desativada (resposta HTTP 410). Novos corretores são cadastrados manualmente no painel Authentication → Users.
- GitHub Pages: https://astrion360.github.io/CRM_CORRETORES/ abre a tela de login (e-mail/senha) após atualização de `config.js` com URL e chave **publicável**.
- Correção de permissões do SQL `GRANT` publicada na branch `main`.

## Homologação técnica de segurança em 16/10/2026

Foram realizados testes transacionais no banco `ruibwnajvardznucetcg` usando identidades temporárias de **dois corretores e um administrador**; os dados foram revertidos com `ROLLBACK` ao final.

- Corretor 1: 1 cliente próprio visível, 0 clientes de outro corretor, 0 oportunidades de outro corretor.
- Corretor 1: 1 devolutiva publicada visível, 0 devolutivas não publicadas e 0 pesquisas internas.
- Corretor 2: 1 cliente próprio visível, 0 oportunidades do corretor 1, 0 devolutivas alheias e 0 pesquisas internas.
- Administrador simulado: 2 clientes e 1 pesquisa interna visíveis.
- Tentativa de atualizar cliente de outra carteira: 0 registros alterados.
- Tentativas simuladas de elevar função para administrador, inserir cliente em carteira alheia, registrar pesquisa interna, forjar evento de status e publicar cotação: todas negadas com SQLSTATE `42501`.
- Security Advisor: aviso `auth_leaked_password_protection` (proteção contra senhas vazadas desabilitada); habilitar pelo painel de autenticação antes de liberar corretores externos.

**Limitação:** esses testes verificam as regras do PostgreSQL com papéis/JWT simulados, mas **não** comprovam login real, entrega de convites, SMTP, integridade de JWT na API ou comportamento real entre navegadores. Testes end-to-end com contas de corretores continuam obrigatórios.

## Política de usuários — atualizada em 16/10/2026

**Padrão adotado:** cadastro manual no Supabase Authentication → Users → Add user → Create new user, senha provisória informada pela Astrion e troca obrigatória no primeiro login. Usuário não cria a própria conta.

- Banco: `password_change_required BOOLEAN NOT NULL DEFAULT TRUE` em `public.profiles`; políticas de leitura/escrita exigem `active` e senha inicial já substituída. O próprio perfil continua disponível para guiar a troca.
- Trigger protegido `private.mark_initial_password_changed`: limpa pendência quando o Auth registra mudança da senha; conta criada manualmente começa suspensa e é ativada pelo gestor no CRM.
- Interface: botão **Cadastrar corretor** informa o procedimento; a situação **Troca de senha pendente** aparece nos cadastros; primeiro login exige nova senha e confirmação (mínimo 12 caracteres).
- Convites: `invite-broker` **desativada**, versão 2, responde `410`. Nenhum endpoint alternativo de criação foi implantado.
- Testes SQL com `ROLLBACK`: perfil novo, mesmo marcado ativo para fins de teste, vê **0 produtos** antes da troca; após limpeza privilegiada da pendência, vê **6**; usuário comum não consegue alterar a pendência diretamente. Teste ponta a ponta da troca pelo Auth ainda pendente.
- **Atualizado em 18/10/2026:** `Allow new users to sign up` desabilitado; login por e-mail e senha preservado. `Site URL` alterada de `http://localhost:3000` para `https://astrion360.github.io/CRM_CORRETORES/` e o mesmo endereço adicionado aos Redirect URLs. Configurações salvas e confirmadas pela interface.
- **Ainda pendente:** SMTP transacional para recuperação de senha; proteção contra senhas vazadas e MFA administrativo; testes reais com os dois primeiros corretores.

## Pendências antes de uso de dados reais

1. **Administrador inicial:** já criado e confirmado no Supabase Auth, com papel `admin` e perfil ativo. A página temporária de ativação foi excluída do GitHub.
2. Authentication → URL Configuration: **concluído** para o endereço GitHub Pages em 18/10/2026. Reavaliar quando configurar Cloudflare.
3. Authentication: **autoinscrição desabilitada** e URLs corrigidas. Ainda é necessário configurar SMTP para recuperação, proteção de senhas vazadas e MFA administrativo. Convites foram substituídos pelo cadastro manual.
4. Testar na prática contas de **dois corretores diferentes**, inclusive tentativas de ler ou modificar IDs da carteira alheia diretamente pela API, consultas privadas da assessoria e cotação publicada/não publicada.
5. Homologar cadastro manual pelo Supabase Auth, ativação via CRM, troca obrigatória da senha no primeiro login, status comercial, clientes, propostas e notas; revisar LGPD e retenção.
6. Conectar domínio Cloudflare quando estiver disponível e atualizar `CRM_SITE_URL`, CORS e redirect URLs do Auth para o novo domínio.

## Observações de segurança
- O cadastro inicial de administrador foi confirmado. Para novos corretores, o cadastro manual usa `Auto confirm user` e senha provisória; a pessoa deve obrigatoriamente trocar a senha antes de acessar dados de negócios.
- Perfis de corretores criados manualmente pelo Auth começam inativos no CRM, mesmo com e-mail autoconfirmado, até ativação expressa pela administração.

- **Nunca publicar** service role, chaves secretas, senhas, conexões de banco ou segredos SMTP no frontend ou no repositório.
- Login visível não significa autenticação/admin operacional até criar conta e completar homologação.
- O projeto Supabase anterior da Astrion **não foi alterado**.
