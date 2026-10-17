/**
 * Legado desativado em favor do cadastro manual realizado pela administração.
 * Não usar convite por e-mail. Ver política em README.md.
 */
Deno.serve(() => new Response(
  JSON.stringify({error:'Convites por e-mail desativados. A criação de usuários é manual.'}),
  {status:410,headers:{'content-type':'application/json','cache-control':'no-store'}}
));
