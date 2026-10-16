# Matriz de homologação obrigatória — v2

Crie corretor **A** e corretor **B**, mais administrador. Execute testes pelo navegador e diretamente pela API REST com o JWT de cada usuário. Não considerar aprovado sem comprovação dos casos abaixo.

- [ ] A vê somente seus clientes e solicitações; B vê somente os seus.
- [ ] A não consegue `GET` cliente, solicitação, evento nem devolutiva de B por ID conhecido.
- [ ] A não consegue `INSERT` oportunidade apontando para o cliente de B, mesmo forjando `owner_id`.
- [ ] A não consegue `UPDATE` o `owner_id` ou `created_by` de seus próprios registros.
- [ ] A não consegue `UPDATE` o `role` e `active` do seu profile (nem promover admin).
- [ ] A só cria e edita oportunidade em rascunho e envia para cotação.
- [ ] Depois de enviada, A não consegue mudar crédito, lance, categoria ou status usando requisição forjada.
- [ ] Enviar uma solicitação incompleta deve falhar; salvar rascunho parcial deve funcionar.
- [ ] A não consegue alterar etapa para `cotada`, `contratada` ou outra etapa administrativa.
- [ ] A não consegue consultar, alterar ou cadastrar `partner_checks`; admin consegue.
- [ ] A não consegue ler `quote_options` não publicadas, mesmo conhecendo UUID.
- [ ] A não consegue inserir, publicar, editar ou apagar `quote_options`.
- [ ] Admin consegue cadastrar pesquisa interna e registrar várias opções de cotação comparáveis.
- [ ] Admin consegue salvar uma cotação como rascunho sem exibí-la ao corretor.
- [ ] Admin publica opção; A consegue lê-la e status passa a `cotada` com evento de histórico.
- [ ] Depois de publicada, nem o admin consegue modificar seus valores via cliente; somente criar nova opção.
- [ ] Mensagens internas admin não aparecem na timeline do corretor.
- [ ] Corretor não consegue criar eventos internos/devolutivas oficiais nem editar ou apagar histórico.
- [ ] Atualizar status pelo admin deixa evento; corretor consegue acompanhar.
- [ ] Um usuário novo fora do convite recebe profile `active=false` e nenhuma leitura/escrita.
- [ ] Convite do admin ativa novo usuário como broker; broker não convida terceiros.
- [ ] Ao suspender corretor, novas requisições não obtêm dados mesmo com sessão ainda válida.
- [ ] Senha esquecida/primeiro acesso funciona no domínio final; links não levam a localhost.
- [ ] Testar XSS com nome, observação e mensagens contendo HTML; devem ser renderizados como texto.
- [ ] Exportação CSV só admin; valores iniciados por `= + - @` não executam fórmula em planilha.
- [ ] Backups/restauração, entrega do SMTP, SSL, CSP e logs revisados antes de produção.
