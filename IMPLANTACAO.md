# Implantação do CRM Corretores — 16/10/2026

## Concluído
- Organização: Astrion360's Org.
- Supabase novo e separado: `Astrion CRM Corretores` (ref: `ruibwnajvardznucetcg`), região `sa-east-1`.
- Migration instalada `astrion_crm_initial_secure_schema_v2`.
- Sete tabelas públicas: `profiles`, `products`, `clients`, `opportunities`, `opportunity_events`, `quote_options`, `partner_checks`; RLS habilitada em todas; 6 categorias genéricas.
- Segurança do Supabase: análise automática inicial sem avisos; teste com perfil não aprovado retorna zero produtos/perfis/registros internos.
- Edge Function `invite-broker` implantada e ativa, `verify_jwt=true`. Valida o usuário e seu papel de administrador em tempo de execução.
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

## Pendências antes de uso de dados reais

1. **Finalizar o primeiro administrador:** usuário `wellington@astrion360.com.br` criado no Supabase Auth e marcado como `role='admin', active=false`. Aguardando confirmação do e-mail pelo próprio titular. Migration `activate_initial_admin_only_after_email_verification` libera `active=true` automaticamente apenas para o ID do primeiro usuário quando o Auth confirmar o e-mail. A página temporária `ativar.html` já foi excluída do GitHub (commit `0ae000b`).
2. Authentication → URL Configuration: configurar **Site URL** e redirect permitido `https://astrion360.github.io/CRM_CORRETORES/`. Reavaliar quando configurar Cloudflare.
3. Authentication: desabilitar self-signup público; definir SMTP transacional e testar convites/recuperação de senha; habilitar MFA do administrador.
4. Testar na prática contas de **dois corretores diferentes**, inclusive tentativas de ler ou modificar IDs da carteira alheia diretamente pela API, consultas privadas da assessoria e cotação publicada/não publicada.
5. Homologar o convite via `invite-broker`, status comercial, cadastro de clientes, propostas e notas; revisar LGPD e retenção.
6. Conectar domínio Cloudflare quando estiver disponível e atualizar `CRM_SITE_URL`, CORS e redirect URLs do Auth para o novo domínio.

## Observações de segurança
- O log do Supabase registrou `mail.send` para confirmação de cadastro, mas isso não prova entrega na caixa de entrada. A confirmação da titularidade precisa ser concluída pelo destinatário.
- A ativação automática não substitui os testes de login e de e-mail; o campo `active` permanece falso até `email_confirmed_at` ser registrado pelo Auth.

- **Nunca publicar** service role, chaves secretas, senhas, conexões de banco ou segredos SMTP no frontend ou no repositório.
- Login visível não significa autenticação/admin operacional até criar conta e completar homologação.
- O projeto Supabase anterior da Astrion **não foi alterado**.
