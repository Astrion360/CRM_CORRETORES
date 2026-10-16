-- Execute em seu projeto de homologação após criar o esquema v2.
-- 1) TODAS as tabelas públicas do portal devem ter RLS true:
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
  AND tablename IN ('profiles','products','clients','opportunities','opportunity_events','quote_options','partner_checks')
 ORDER BY tablename;

-- 2) Políticas reais instaladas:
SELECT tablename,policyname,cmd,roles,qual,with_check
 FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('profiles','products','clients','opportunities','opportunity_events','quote_options','partner_checks')
 ORDER BY tablename,cmd,policyname;

-- 3) Só uma conta deve ter role=admin (a do titular do projeto):
SELECT email,role,active FROM public.profiles WHERE role='admin';

-- 4) Usuários cadastrados mas não autorizados devem permanecer inactive.
SELECT role,active,count(*) FROM public.profiles GROUP BY role,active ORDER BY role,active;
