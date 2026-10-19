const E=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BR=v=>v==null||v===''?'A confirmar':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v));
const DATE=v=>v?new Date(v).toLocaleDateString('pt-BR'):'—';
const cell=(k,v)=>'<div class="item"><span>'+E(k)+'</span><strong>'+E(v||'—')+'</strong></div>';
const group=(title,items)=>'<section><h2>'+E(title)+'</h2><div class="grid">'+items.join('')+'</div></section>';
const note=v=>'<p class="note">'+E(v||'Não informado')+'</p>';
const meta=(o,c,b,p)=>group('Identificação',[cell('Cliente',c?.full_name),cell('Contato do cliente',c?.phone),cell('E-mail do cliente',c?.email),cell('Corretor',b?.full_name||b?.email),cell('Contato do corretor',b?.phone),cell('Empresa',b?.company),cell('Produto / segmento',p?.name),cell('Tipo de cliente',o.customer_type)]);
function request(o,c,b,p,catalog,dispatch){
 const r=(catalog||[]).find(x=>x.product_category===p?.category);
 return meta(o,c,b,p)+group('Crédito e perfil',[cell('Tipo de bem',o.asset_type),cell('Bem de referência',o.reference_asset),cell('Finalidade',o.purpose),cell('Valor do bem',BR(o.asset_value)),cell('Crédito solicitado',BR(o.credit_amount)),cell('Prazo desejado',o.desired_term_months?o.desired_term_months+' meses':'A avaliar'),cell('Parcela máxima',BR(o.max_installment)),cell('Plano preferido',o.plan_preference),cell('Perfil de contemplação',o.contemplation_profile),cell('Urgência',o.urgency),cell('Flexibilidade de crédito',o.credit_flexibility)])+
 group('Estratégia de lance e pré-análise',[cell('Deseja ofertar lance?',o.bid_intention),cell('Recurso de lance',o.bid_resource||o.bid_type),cell('Valor disponível',BR(o.bid_amount)),cell('Percentual',o.bid_percentage==null?'A definir':o.bid_percentage+'%'),cell('Bem para troca de chave',o.trade_in_available?'Sim':'Não informado'),cell('Comprovação de renda',o.income_proof_status),cell('Fiador',o.guarantor_available),cell('Garantia',o.collateral_available),cell('Documentação',o.documentation_status)])+
 '<section><h2>Observações e ressalvas</h2>'+note([o.notes,o.special_conditions].filter(Boolean).join('\n\n'))+'</section>'+
 (dispatch?group('Controle de envio ao parceiro',[cell('Parceiro',dispatch.partner_name),cell('Status',dispatch.request_status),cell('Referência',dispatch.protocol),cell('Enviado em',DATE(dispatch.sent_at))]):'')+
 '<section><h2>Informações solicitadas à Âncora</h2><p>Solicitamos grupo, plano, crédito disponível, prazo, parcelas inicial e após contemplação, taxa de administração total, fundo, seguro, modalidades de lance, índice de correção, documentação, restrições e validade. Quando possível, apresentar duas ou três alternativas.</p><div class="blank"></div></section>'+
 '<aside class="warn"><b>Parâmetros comerciais de referência:</b> '+E(r?('Crédito '+BR(r.credit_min)+' a '+BR(r.credit_max)+'; prazo máximo '+(r.max_term_months||'a validar')+' meses. '):'')+'Parâmetros não homologados pela Âncora para esta solicitação. Confirmar condições antes da oferta.</aside>';
}
function returnQuotes(o,c,b,p,quotes){
 const records=(quotes||[]).filter(q=>q.published);
 const comparison=records.length>1
 ?'<section><h2>Comparativo das alternativas</h2><table class="comparison"><thead><tr><th>Alternativa</th><th>Grupo / Plano</th><th>Crédito</th><th>Prazo</th><th>Parcela</th></tr></thead><tbody>'+records.map(q=>'<tr><td>'+E(q.label)+'</td><td>'+E([q.group_code,q.plan_name].filter(Boolean).join(' / ')||'A confirmar')+'</td><td>'+BR(q.credit_amount)+'</td><td>'+E(q.term_months)+' meses</td><td>'+BR(q.installment_amount)+'</td></tr>').join('')+'</tbody></table></section>'
 :'';
 return meta(o,c,b,p)+group('Solicitação original',[cell('Bem',o.reference_asset),cell('Crédito pretendido',BR(o.credit_amount)),cell('Lance disponível',BR(o.bid_amount))])+
 comparison+'<h2>Alternativas autorizadas</h2>'+ (records.map((q,i)=>'<article class="offer"><h3>Alternativa '+(i+1)+' · '+E(q.label)+'</h3>'+
 group('Condições informadas',[cell('Parceiro',q.partner_name),cell('Grupo',q.group_code),cell('Plano',q.plan_name),cell('Crédito',BR(q.credit_amount)),cell('Prazo',q.term_months+' meses'),cell('Parcela informada',BR(q.installment_amount)),cell('Após contemplação',BR(q.installment_after_contemplation)),cell('Taxa adm. total',q.admin_fee_percentage==null?'A confirmar':q.admin_fee_percentage+'%'),cell('Fundo de reserva',q.reserve_fund_percentage==null?'A confirmar':q.reserve_fund_percentage+'%'),cell('Seguro mensal',BR(q.insurance_amount)),cell('Índice',q.adjustment_index),cell('Validade',DATE(q.valid_until))])+
 (q.bid_guidance?'<h4>Lance</h4>'+note(q.bid_guidance):'')+(q.conditions||q.sales_plan_notes?'<h4>Ressalvas</h4>'+note([q.conditions,q.sales_plan_notes].filter(Boolean).join('\n\n')):'')+'</article>').join('')||note('Não há devolutivas publicadas.'))+
 '<aside class="warn">Valores indicativos sujeitos à confirmação da administradora e condições contratuais. Não há garantia de contemplação ou crédito aprovado.</aside>';
}
const style=[
'@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11px/1.5 Arial,sans-serif;background:#edf2f8;color:#203650;margin:0}',
'.paper{width:min(210mm,100%);min-height:297mm;padding:17mm;background:white;margin:12px auto;box-shadow:0 15px 50px #143d651a}',
'header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #12417c;padding-bottom:15px}.logo{max-height:44px;max-width:155px}',
'.brand{font:bold 19px Arial;color:#133b75;letter-spacing:3px}.right{text-align:right;font-size:12px;color:#164678}.right small{display:block;font-size:10px;color:#70839c}',
'h1{font-size:21px;color:#113765;margin:24px 0 4px}h2{color:#174d8c;font-size:11px;letter-spacing:.07em;border-bottom:1px solid #d8e3ef;padding:7px 0;margin:19px 0 8px;text-transform:uppercase}h3{color:#143e77}',
'.subtitle{color:#697e97}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.item{padding:7px 0;display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e8edf4;break-inside:avoid}',
'.item span{color:#697c92}.item strong{max-width:66%;text-align:right;overflow-wrap:anywhere}.note{padding:11px;background:#f5f8fc;border-left:3px solid #2966aa;white-space:pre-line;overflow-wrap:anywhere}',
'.warn{padding:12px;background:#fff8ec;border-left:3px solid #ad8031;margin:19px 0;font-size:10px}.blank{height:66px;border:1px dashed #b0c3d9;margin:9px 0}',
'table.comparison{width:100%;border-collapse:collapse;table-layout:fixed}table.comparison th,table.comparison td{border-bottom:1px solid #e1e9f1;padding:7px 5px;text-align:left;font-size:10px;overflow-wrap:anywhere}table.comparison th{background:#f0f5fb;color:#244a7e}',
'.offer{border:1px solid #d9e4f0;padding:12px;margin:14px 0;border-radius:9px;break-inside:avoid}.toolbar{padding:12px;text-align:center;display:flex;justify-content:center;gap:10px;background:#E6EEF7}.toolbar button{padding:11px 20px;color:white;background:#18528e;border:0;border-radius:8px;cursor:pointer}.toolbar .back{padding:11px 20px;border-radius:8px;background:#fff;border:1px solid #BBCDE2;color:#184376;font-weight:bold;text-decoration:none}',
'.foot{margin-top:25px;border-top:1px solid #d8e2f0;padding-top:12px;color:#788ca1;font-size:10px}',
'@media print{body{background:white}.toolbar{display:none}.paper{width:auto;min-height:unset;margin:0;padding:0;box-shadow:none}.offer{break-inside:avoid}}',
'@media(max-width:650px){.paper{padding:18px;margin:0}.grid{grid-template-columns:1fr}}'
].join('');
export function openDocument(kind,o,c,b,p,catalog,quotes=[],dispatch=null){
 const popup=window.open('','_blank');
 if(!popup)throw Error('Permita janelas pop-up para imprimir ou salvar em PDF.');
 const requestKind=kind==='request';
 const title=requestKind?'Ficha de solicitação para cotação':'Devolutiva de cotação';
 const internal=E((o.id||'').slice(0,8).toUpperCase());
 const main=requestKind?request(o,c,b,p,catalog,dispatch):returnQuotes(o,c,b,p,quotes);
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+E(title)+' | Órbita by Astrion</title><style>'+style+'</style></head><body><div class="toolbar"><a class="back" href="https://corretores.astrion360.com.br/">← Página inicial</a><button onclick="window.print()">Imprimir / Salvar em PDF</button></div><div class="paper"><header><div><img class="logo" src="https://wellingtonmendesmendes.github.io/astrion-brand/assets/images/logo-astrion.png" alt="Astrion" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><span class="brand" style="display:none">ASTRION</span></div><div class="right">ÓRBITA · BY ASTRION<small>Protocolo '+internal+' · '+new Date().toLocaleString('pt-BR')+'</small></div></header><h1>'+E(title)+'</h1><p class="subtitle">'+(requestKind?'Encaminhamento interno à Âncora':'Condições publicadas ao corretor')+'</p>'+main+'<div class="foot">ASTRION ASSESSORIA · ÓRBITA by Astrion · Documento de uso restrito</div></div></body></html>';
 popup.document.open();popup.document.write(html);popup.document.close();popup.focus();
}