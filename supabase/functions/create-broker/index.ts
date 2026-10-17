/**
 * ASTRION CRM Corretores | Cadastro manual de corretores
 * Acessível apenas para usuário admin ativo, com JWT verificado.
 * A senha provisória é definida pela administração, transmitida apenas ao Supabase Auth.
 * Nunca registrar senhas em logs, GitHub, banco de dados auxiliar ou e-mail.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const SITE = Deno.env.get('CRM_SITE_URL') || 'https://astrion360.github.io/CRM_CORRETORES/';
const SITE_ORIGIN = new URL(SITE).origin;
const URL = Deno.env.get('SUPABASE_URL') || '';
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SERVICE_KEY = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function respond(body: Record<string,unknown>, status=200) {
 return new Response(JSON.stringify(body), {
   status,
   headers: {
     'Content-Type':'application/json',
     'Cache-Control':'no-store',
     'Access-Control-Allow-Origin':SITE_ORIGIN,
     'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Vary':'Origin',
   }
 });
}
Deno.serve(async (req: Request) => {
 if(req.headers.get('origin')!==SITE_ORIGIN) return respond({error:'Origem não permitida'},403);
 if(req.method==='OPTIONS') return respond({ok:true});
 if(req.method!=='POST') return respond({error:'Método inválido'},405);
 if(!URL||!SERVICE_KEY) return respond({error:'Configuração de autenticação indisponível'},503);
 try{
   const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\\s+/i,'');
   if(!bearer) return respond({error:'Autenticação necessária'},401);
   const admin=createClient(URL,SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
   const {data:authData,error:authError}=await admin.auth.getUser(bearer);
   if(authError||!authData.user) return respond({error:'Sessão inválida'},401);
   const {data:profile,error:profileError}=await admin.from('profiles')
     .select('role,active,password_change_required').eq('id',authData.user.id).single();
   if(profileError||!profile||profile.role!=='admin'||!profile.active||profile.password_change_required)
     return respond({error:'Acesso exclusivo da administração'},403);

   const payload=await req.json();
   const email=String(payload.email||'').trim().toLowerCase();
   const fullName=String(payload.full_name||'').trim();
   const company=String(payload.company||'').trim();
   const phone=String(payload.phone||'').trim();
   const temporaryPassword=String(payload.temporary_password||'');
   if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>250||
     fullName.length<2||fullName.length>140||company.length>140||phone.length>30||
     temporaryPassword.length<12||temporaryPassword.length>128)
     return respond({error:'Preencha nome e e-mail válidos; revise os demais campos.'},400);

   const {data:newUser,error:createError}=await admin.auth.admin.createUser({
     email,
     password:temporaryPassword,
     email_confirm:true,
     user_metadata:{full_name:fullName},
   });
   if(createError||!newUser?.user?.id)
     return respond({error:createError?.message||'Não foi possível criar a conta'},422);

   const {data:newProfile,error:updateError}=await admin.from('profiles')
     .update({full_name:fullName,company,phone,active:true,password_change_required:true})
     .eq('id',newUser.user.id).eq('role','broker')
     .select('id,email,role,active,password_change_required')
     .single();

   if(updateError||!newProfile?.active||!newProfile.password_change_required) {
     // Fail-closed: a conta permanece sem acesso se o perfil não for ativado.
     await admin.from('profiles').update({active:false,password_change_required:true})
       .eq('id',newUser.user.id);
     return respond({error:'Conta criada no Auth, mas perfil não ativado. Acione a administração.',user_id:newUser.user.id},500);
   }
   return respond({
     ok:true,user_id:newUser.user.id,email:newProfile.email,
     must_change_password:true
   },201);
 }catch(_e){
   return respond({error:'Não foi possível concluir o cadastro'},500);
 }
});