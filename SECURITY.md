# Astrion — controles de segurança v2

## Premissas

Frontend público estático com URL e chave **publicável** apenas. Autenticação e autorização estão no Supabase (Auth + PostgreSQL RLS). O portal não aceita autoinscrição. Novos perfis são criados **inativos** e somente a função administrativa de convite os ativa. O primeiro administrador é ativado por SQL de bootstrap supervisionado. Perfil de acesso não depende de `user_metadata` nem de botão/rota de frontend.

### Barreiras

1. RLS habilitada em **todas as sete tabelas** públicas: `profiles`, `products`, `clients`, `opportunities`, `opportunity_events`, `partner_checks` e `quote_options`.
2. `owner_id` compõe as FKs cliente-oportunidade, oportunidade-evento, oportunidade-pesquisa e oportunidade-cotação: não é permitido cruzar propriedade entre corretores.
3. Autorização das views internas derivada de `private.is_admin()`; nenhuma cotação interna/pesquisa de parceiro é visível a brokers.
4. Publicação de condições apenas admin. Após publicar, a condição não pode ser editada por APIs do portal; nova condição deve gerar novo registro.
5. Corretor pode editar somente **rascunho próprio** e enviar; mudanças após envio precisam passar pela administração.
6. `opportunity_events` sem permissão UPDATE/DELETE pelo cliente. Corretor só registra nota visível ou solicitação de ajuste própria; admin controla devolutivas e notas internas.
7. Permissões SQL por **coluna** impedem mudanças de `owner_id`, `created_by`, `role`, `published_at` e demais campos de autorização, mesmo com JSON manipulado.
8. Edge Function de convite valida JWT, consulta `role` e `active` no banco, confere origem configurada e usa chave secreta **somente no servidor**. CORS não substitui a checagem de JWT/role.
9. Suspensão de usuário bloqueia imediatamente novas leituras/escritas via RLS; dados já baixados permanecem fora do controle do servidor.
10. Para dados pessoais, implemente backups, rotação de credenciais, MFA, retenção, treinamento de corretores, registro de incidentes e verificação de versões/dependências antes de produção.

## Não implementado nesta entrega

Teste real em dois usuários no novo projeto Supabase, pen-test, monitoramento central de acessos, resposta a incidente, logs imutáveis externos, upload privado, auditoria campo-a-campo, revogação imediata de JWTs já emitidos, notificações e política operacional formal de retenção LGPD. Esses itens demandam homologação antes do uso produtivo.

**Nunca:** coloque chave `sb_secret`, `service_role`, token pessoal, segredo SMTP ou conexão Postgres nos arquivos do GitHub Pages/Cloudflare Pages.
