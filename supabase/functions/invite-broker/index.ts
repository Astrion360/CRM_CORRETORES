/**
 * Edge Function: invite-broker
 * Implantar com verificação JWT habilitada. SERVICE_ROLE_KEY NUNCA vai para o site/GitHub.
 * Variáveis: SUPABASE_URL, SUPABASE_SECRET_KEYS (padrão atual; JSON) ou SUPABASE_SERVICE_ROLE_KEY (legado)
 * e CRM_SITE_URL (customizada, ex.: https://corretores.astrion360.com.br).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const SITE = Deno.env.get('CRM_SITE_URL') || '';
const SITE_ORIGIN = SITE ? new URL(SITE).origin : '';
const URL = Deno.env.get('SUPABASE_URL') || '';
const serviceKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SERVICE_KEY = serviceKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function respond(data: Record<string, unknown>, status = 200, origin = SITE_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
    },
  });
}
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  if (!SITE_ORIGIN || origin !== SITE_ORIGIN) return respond({ error: 'Origem não permitida' }, 403);
  if (req.method === 'OPTIONS') return respond({ ok: true }, 200);
  if (req.method !== 'POST') return respond({ error: 'Método inválido' }, 405);
  if (!URL || !SERVICE_KEY) return respond({ error: 'Configuração indisponível' }, 500);
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return respond({ error: 'Autenticação necessária' }, 401);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return respond({ error: 'Sessão inválida' }, 401);
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('role,active').eq('id', authData.user.id).single();
    if (profileError || !profile || profile.role !== 'admin' || !profile.active)
      return respond({ error: 'Operação restrita à administração' }, 403);
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const company = String(body.company || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250 || full_name.length < 2 || full_name.length > 140 || company.length > 140)
      return respond({ error: 'Nome ou e-mail inválido' }, 400);
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: SITE.replace(/\/$/, '') + '/', data: { full_name },
    });
    if (error) return respond({ error: error.message }, 400);
    // O convite cria um perfil INATIVO. A função autorizada aprova e ativa o corretor.
    if (data.user?.id) {
      const { error: updateError } = await admin.from('profiles')
        .update({ company, full_name, active: true }).eq('id', data.user.id).eq('role', 'broker');
      if (updateError) return respond({ error: 'Convite criado, mas a empresa não pôde ser registrada' }, 500);
    }
    return respond({ ok: true, user_id: data.user?.id });
  } catch (_error) { return respond({ error: 'Falha ao processar o convite' }, 500); }
});
