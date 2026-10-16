-- ASTRION | Portal de solicitações de consórcios — schema inicial v2
-- APENAS projeto Supabase NOVO. Script de instalação única, não é migração v1 → v2.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, full_name text NOT NULL DEFAULT '',
 company text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 role text NOT NULL DEFAULT 'broker' CHECK (role IN ('admin','broker')),
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_role_active_idx ON public.profiles(role, active);

CREATE FUNCTION private.is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND active)
$$;
CREATE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND active AND role='admin')
$$;
REVOKE ALL ON FUNCTION private.is_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active(), private.is_admin() TO authenticated;

-- Cadastro público, mesmo que habilitado indevidamente, nunca dá acesso sem aprovação.
CREATE FUNCTION private.on_user_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.profiles(id,email,full_name,active)
 VALUES (NEW.id,coalesce(NEW.email,''),left(coalesce(NEW.raw_user_meta_data->>'full_name',''),140),false)
 ON CONFLICT (id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_new_user AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.on_user_created();

-- Apenas categorias genéricas. Nenhum cadastro/parâmetro individual por administradora.
CREATE TABLE public.products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE,
 category text NOT NULL CHECK(category IN ('Imóveis','Automóveis','Motos','Pesados','Serviços','Outros')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 full_name text NOT NULL CHECK(length(trim(full_name)) BETWEEN 2 AND 160),
 phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '', state text NOT NULL DEFAULT '',
 privacy_basis text NOT NULL CHECK(privacy_basis IN ('consentimento','procedimentos_preliminares','legitimo_interesse')),
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id)
);
CREATE INDEX clients_owner_idx ON public.clients(owner_id,created_at DESC);

CREATE TABLE public.opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 client_id uuid NOT NULL, product_id uuid NOT NULL REFERENCES public.products(id),
 stage text NOT NULL DEFAULT 'rascunho' CHECK(stage IN
 ('rascunho','enviada','triagem','em_cotacao','pendencia','cotada','em_negociacao','contratada','encerrada')),
 purpose text NOT NULL DEFAULT '', -- Uso pessoal, investimento, troca etc.
 reference_asset text NOT NULL DEFAULT '', -- Bem de referência declarado pelo corretor
 asset_condition text NOT NULL DEFAULT 'nao_informado' CHECK(asset_condition IN ('novo','usado','nao_informado','nao_aplicavel')),
 asset_value numeric(16,2) CHECK(asset_value IS NULL OR (asset_value>0 AND asset_value<10000000000)),
 credit_amount numeric(16,2) CHECK(credit_amount IS NULL OR (credit_amount>0 AND credit_amount<10000000000)),
 desired_term_months integer CHECK(desired_term_months IS NULL OR desired_term_months BETWEEN 1 AND 360),
 max_installment numeric(16,2) CHECK(max_installment IS NULL OR max_installment>0),
 bid_intention text NOT NULL DEFAULT 'indefinido' CHECK(bid_intention IN ('sim','nao','avaliando','indefinido')),
 bid_type text NOT NULL DEFAULT 'indefinido' CHECK(bid_type IN ('recursos_proprios','embutido','combinado','indefinido')),
 bid_amount numeric(16,2) CHECK(bid_amount IS NULL OR bid_amount>=0),
 bid_percentage numeric(5,2) CHECK(bid_percentage IS NULL OR bid_percentage BETWEEN 0 AND 100),
 urgency text NOT NULL DEFAULT 'a_definir' CHECK(urgency IN ('imediata','ate_3_meses','ate_6_meses','mais_6_meses','a_definir')),
 needs_quick_contemplation boolean NOT NULL DEFAULT false,
 accepts_standard_quota boolean NOT NULL DEFAULT true,
 source text NOT NULL DEFAULT 'Indicação',
 next_action_at date,
 notes text NOT NULL DEFAULT '',
 submitted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id),
 CONSTRAINT opp_client_same_owner FOREIGN KEY (client_id,owner_id)
    REFERENCES public.clients(id,owner_id),
 CONSTRAINT completed_intake CHECK (
  stage='rascunho' OR (length(trim(reference_asset))>=2 AND asset_value>0 AND credit_amount>0
   AND bid_intention<>'indefinido' AND urgency<>'a_definir')
 )
);
CREATE INDEX opp_owner_stage_idx ON public.opportunities(owner_id,stage,created_at DESC);
CREATE INDEX opp_client_idx ON public.opportunities(client_id);

CREATE TABLE public.opportunity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 opportunity_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 event_type text NOT NULL DEFAULT 'nota' CHECK(event_type IN ('nota','devolutiva','status','criacao','solicitacao_ajuste')),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 4000),
 is_internal boolean NOT NULL DEFAULT false CHECK(NOT (event_type IN ('devolutiva','solicitacao_ajuste') AND is_internal)),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT event_opp_same_owner FOREIGN KEY(opportunity_id,owner_id)
 REFERENCES public.opportunities(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX events_opp_date_idx ON public.opportunity_events(opportunity_id,created_at DESC);

-- Uma devolutiva contém uma ou mais opções padronizadas, comparáveis entre parceiros.
-- Não são dados de cadastro de administradora; cada opção é a condição pesquisada naquele atendimento.
CREATE TABLE public.quote_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 opportunity_id uuid NOT NULL, owner_id uuid NOT NULL REFERENCES public.profiles(id),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 label text NOT NULL CHECK(length(trim(label)) BETWEEN 2 AND 100),
 partner_name text NOT NULL DEFAULT '', -- campo livre, sem tabela/regras por administradora
 credit_amount numeric(16,2) NOT NULL CHECK(credit_amount>0),
 term_months integer NOT NULL CHECK(term_months BETWEEN 1 AND 360),
 installment_amount numeric(16,2) NOT NULL CHECK(installment_amount>0),
 admin_fee_percentage numeric(6,3) CHECK(admin_fee_percentage IS NULL OR admin_fee_percentage BETWEEN 0 AND 100),
 reserve_fund_percentage numeric(6,3) CHECK(reserve_fund_percentage IS NULL OR reserve_fund_percentage BETWEEN 0 AND 100),
 insurance_amount numeric(16,2) CHECK(insurance_amount IS NULL OR insurance_amount>=0),
 bid_guidance text NOT NULL DEFAULT '',
 conditions text NOT NULL DEFAULT '',
 valid_until date, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 CONSTRAINT quote_opp_same_owner FOREIGN KEY(opportunity_id,owner_id)
 REFERENCES public.opportunities(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX quote_opp_idx ON public.quote_options(opportunity_id,created_at DESC);

-- Pesquisa interna entre parceiros (somente a Astrion). Sem parâmetros por administradora.
CREATE TABLE public.partner_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 opportunity_id uuid NOT NULL, owner_id uuid NOT NULL REFERENCES public.profiles(id),
 recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 partner_name text NOT NULL CHECK(length(trim(partner_name)) BETWEEN 2 AND 160),
 result_status text NOT NULL DEFAULT 'consultado' CHECK(result_status IN ('consultado','recebido','descartado','selecionado')),
 credit_amount numeric(16,2) CHECK(credit_amount IS NULL OR credit_amount>0),
 term_months integer CHECK(term_months IS NULL OR term_months BETWEEN 1 AND 360),
 installment_amount numeric(16,2) CHECK(installment_amount IS NULL OR installment_amount>0),
 research_notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT check_opp_same_owner FOREIGN KEY(opportunity_id,owner_id)
 REFERENCES public.opportunities(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX checks_opp_idx ON public.partner_checks(opportunity_id,created_at DESC);


CREATE FUNCTION private.touch_updated() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at=now();RETURN NEW;END $$;
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION private.touch_updated();
CREATE TRIGGER opp_touch BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION private.touch_updated();

-- Corretor só pode alterar oportunidade enquanto for rascunho; após envio não altera preço/lance/cliente.
CREATE FUNCTION private.validate_opportunity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT private.is_admin() THEN
   IF TG_OP='INSERT' AND NEW.stage NOT IN ('rascunho','enviada') THEN
     RAISE EXCEPTION 'Etapa reservada à Astrion';
   END IF;
   IF TG_OP='UPDATE' AND (OLD.stage<>'rascunho' OR NEW.stage NOT IN ('rascunho','enviada')) THEN
     RAISE EXCEPTION 'Solicitação enviada: alterações devem ser solicitadas à Astrion';
   END IF;
 END IF;
 IF NEW.stage='cotada' AND NEW.stage IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.stage ELSE 'rascunho' END)
    AND NOT EXISTS (SELECT 1 FROM public.quote_options q WHERE q.opportunity_id=NEW.id AND q.published) THEN
    RAISE EXCEPTION 'Uma devolutiva publicada é necessária antes de marcar como cotada';
 END IF;
 IF NEW.stage <> 'rascunho' AND NEW.submitted_at IS NULL THEN NEW.submitted_at=now();END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER opp_validate BEFORE INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION private.validate_opportunity();

CREATE FUNCTION private.log_stage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   INSERT INTO public.opportunity_events(opportunity_id,owner_id,actor_id,event_type,message)
   VALUES(NEW.id,NEW.owner_id,NEW.created_by,'criacao',CASE WHEN NEW.stage='rascunho' THEN 'Rascunho criado' ELSE 'Solicitação enviada à Astrion' END);
 ELSIF NEW.stage IS DISTINCT FROM OLD.stage THEN
   INSERT INTO public.opportunity_events(opportunity_id,owner_id,actor_id,event_type,message)
   VALUES(NEW.id,NEW.owner_id,(SELECT auth.uid()),'status', 'Etapa: '||OLD.stage||' → '||NEW.stage);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER opp_log AFTER INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION private.log_stage();

-- Depois da publicação, a devolutiva é imutável. Nova condição = nova opção publicada.
CREATE FUNCTION private.validate_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.published THEN RAISE EXCEPTION 'Devolutiva publicada é imutável';END IF;
 IF NEW.published AND NEW.published_at IS NULL THEN NEW.published_at=now();END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER quote_validate BEFORE INSERT OR UPDATE ON public.quote_options FOR EACH ROW EXECUTE FUNCTION private.validate_quote();
CREATE FUNCTION private.publish_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.published AND (TG_OP='INSERT' OR NOT OLD.published) THEN
   INSERT INTO public.opportunity_events(opportunity_id,owner_id,actor_id,event_type,message)
   VALUES(NEW.opportunity_id,NEW.owner_id,NEW.created_by,'devolutiva','Condição disponibilizada: '||NEW.label);
   UPDATE public.opportunities SET stage='cotada'
   WHERE id=NEW.opportunity_id AND stage NOT IN ('cotada','em_negociacao','contratada','encerrada');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER quote_published AFTER INSERT OR UPDATE OF published ON public.quote_options FOR EACH ROW EXECUTE FUNCTION private.publish_quote();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id=(SELECT auth.uid()) OR (SELECT private.is_admin()));
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY product_select ON public.products FOR SELECT TO authenticated USING ((SELECT private.is_active()));
CREATE POLICY product_insert ON public.products FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY product_update ON public.products FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid())));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (
 created_by=(SELECT auth.uid()) AND ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid())))
 AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.active AND p.role='broker'));
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()))) WITH CHECK ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid())));
CREATE POLICY opp_select ON public.opportunities FOR SELECT TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid())));
CREATE POLICY opp_insert ON public.opportunities FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()))));
CREATE POLICY opp_update ON public.opportunities FOR UPDATE TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()))) WITH CHECK ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid())));
CREATE POLICY events_select ON public.opportunity_events FOR SELECT TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()) AND NOT is_internal));
CREATE POLICY events_insert ON public.opportunity_events FOR INSERT TO authenticated WITH CHECK (actor_id=(SELECT auth.uid()) AND ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()))) AND ((SELECT private.is_admin()) OR (event_type IN ('nota','solicitacao_ajuste') AND NOT is_internal)));
CREATE POLICY checks_select ON public.partner_checks FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY checks_insert ON public.partner_checks FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()) AND recorded_by=(SELECT auth.uid()));
CREATE POLICY checks_update ON public.partner_checks FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY quote_select ON public.quote_options FOR SELECT TO authenticated USING ((SELECT private.is_admin()) OR ((SELECT private.is_active()) AND owner_id=(SELECT auth.uid()) AND published));
CREATE POLICY quote_insert ON public.quote_options FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()) AND created_by=(SELECT auth.uid()));
CREATE POLICY quote_update ON public.quote_options FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));

REVOKE ALL ON public.profiles, public.products, public.clients, public.opportunities, public.opportunity_events, public.quote_options, public.partner_checks FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.products, public.clients, public.opportunities, public.opportunity_events, public.quote_options, public.partner_checks TO authenticated;
GRANT UPDATE(full_name,company,phone,active) ON public.profiles TO authenticated;
GRANT INSERT(name,category,active), UPDATE(name,category,active) ON public.products TO authenticated;
GRANT INSERT(owner_id,created_by,full_name,phone,email,city,state,privacy_basis,notes), UPDATE(full_name,phone,email,city,state,privacy_basis,notes) ON public.clients TO authenticated;
GRANT INSERT(owner_id,created_by,client_id,product_id,stage,purpose,reference_asset,asset_condition,asset_value,credit_amount,desired_term_months,max_installment,bid_intention,bid_type,bid_amount,bid_percentage,urgency,needs_quick_contemplation,accepts_standard_quota,source,next_action_at,notes),
 UPDATE(product_id,stage,purpose,reference_asset,asset_condition,asset_value,credit_amount,desired_term_months,max_installment,bid_intention,bid_type,bid_amount,bid_percentage,urgency,needs_quick_contemplation,accepts_standard_quota,source,next_action_at,notes) ON public.opportunities TO authenticated;
GRANT INSERT(opportunity_id,owner_id,actor_id,event_type,message,is_internal) ON public.opportunity_events TO authenticated;
-- As tabelas possuem colunas distintas: conceder permissões separadamente.
GRANT INSERT(opportunity_id,owner_id,created_by,label,partner_name,credit_amount,term_months,installment_amount,admin_fee_percentage,reserve_fund_percentage,insurance_amount,bid_guidance,conditions,valid_until,published),
 UPDATE(label,partner_name,credit_amount,term_months,installment_amount,admin_fee_percentage,reserve_fund_percentage,insurance_amount,bid_guidance,conditions,valid_until,published)
 ON public.quote_options TO authenticated;
GRANT INSERT(opportunity_id,owner_id,recorded_by,partner_name,result_status,credit_amount,term_months,installment_amount,research_notes),
 UPDATE(partner_name,result_status,credit_amount,term_months,installment_amount,research_notes)
 ON public.partner_checks TO authenticated;

-- Funções trigger privilegiadas não devem ser diretamente executáveis pelos papéis do site.
REVOKE ALL ON FUNCTION private.on_user_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.touch_updated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.log_stage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_quote() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.publish_quote() FROM PUBLIC, anon, authenticated;

INSERT INTO public.products(name,category) VALUES
 ('Imóveis','Imóveis'),('Automóveis','Automóveis'),('Motos','Motos'),('Veículos pesados','Pesados'),('Serviços','Serviços'),('Outros bens','Outros');
COMMIT;

-- Primeiro admin, SOMENTE após criação de usuário em Authentication (substituir e-mail):
-- UPDATE public.profiles SET role='admin',active=true WHERE email='SEU-EMAIL@DOMINIO.COM';
-- SELECT id,email,role,active FROM public.profiles;
