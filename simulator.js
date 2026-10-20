/* ÓRBITA SIMULA — calculation rules and authenticated UI. No assumed commercial rates. */
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const pct = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(v)||0) + '%';
const nval = v => v === '' || v == null ? NaN : Number(v);
const fmt = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString('pt-BR') : '—';
const option = (v,l,selected) => `<option value="${h(v)}" ${String(v)===String(selected)?'selected':''}>${h(l)}</option>`;
function productSegment(ctx,productId) {
 const product=ctx.products.find(p=>p.id===productId);
 return ctx.segments.find(s=>s.product_category===product?.category);
}
function availablePlans(ctx,productId) {
 return ctx.plans.filter(p=>p.product_id===productId&&p.active&&p.approved_for_use);
}
function planGroup(ctx,plan) {return ctx.groups.find(g=>g.code===plan?.group_code);}
function productTitle(ctx,id) {return ctx.products.find(p=>p.id===id)?.name||'Produto';}
function groupList(ctx,productId) {
 const seg=productSegment(ctx,productId);
 return ctx.groups.filter(g=>g.segment_code===seg?.code);
}
function validNumber(x,min,max) {return Number.isFinite(x)&&x>=min&&x<=max;}

export function calculateConsortium(plan,credit) {
 const c=Number(credit),n=Number(plan?.term_months);
 const fee=Number(plan?.admin_fee_pct),reserve=Number(plan?.reserve_fund_pct);
 const other=Number(plan?.other_total_pct),insurance=Number(plan?.insurance_monthly_amount);
 const annual=Number(plan?.annual_adjustment_pct);
 if(!validNumber(c,1,1e10)||!Number.isInteger(n)||!validNumber(n,1,360)||
    !validNumber(fee,0,100)||!validNumber(reserve,0,100)||!validNumber(other,0,100)||
    !validNumber(insurance,0,1e6)||!validNumber(annual,0,50)) throw Error('Premissas do consórcio inválidas.');
 const base=c*(1+(fee+reserve+other)/100)/n;
 let total=0, last=0;
 for(let month=1;month<=n;month++){
   last=base*Math.pow(1+annual/100,Math.floor((month-1)/12))+insurance;
   total+=last;
 }
 const first=base+insurance;
 return {first,last,total,term:n,charges:c*(fee+reserve+other)/100,
   base,insurance,annual,nominalNoAdjustment:(base+insurance)*n};
}
export function calculateFinancing({assetValue,downPayment,annualRate,months,system,monthlyCosts=0,upfrontCosts=0}) {
 const asset=Number(assetValue),down=Number(downPayment),annual=Number(annualRate),n=Number(months);
 const monthlyOther=Number(monthlyCosts),upfront=Number(upfrontCosts);
 if(!validNumber(asset,1,1e10)||!validNumber(down,0,asset)||!validNumber(annual,0,100)||
    !Number.isInteger(n)||!validNumber(n,1,360)||!['PRICE','SAC'].includes(system)||
    !validNumber(monthlyOther,0,1e6)||!validNumber(upfront,0,1e9)) throw Error('Premissas do financiamento inválidas.');
 const principal=asset-down,rate=Math.pow(1+annual/100,1/12)-1;
 let first=0,last=0,interest=0;
 if(system==='PRICE'){
   const pmt=rate===0?principal/n:principal*rate/(1-Math.pow(1+rate,-n));
   first=pmt+monthlyOther;last=first;interest=pmt*n-principal;
 }else{
   const amort=principal/n;
   first=amort+principal*rate+monthlyOther;
   last=amort+amort*rate+monthlyOther;
   interest=rate*principal*(n+1)/2;
 }
 return {first,last,interest,principal,term:n,rate,system,
   total:down+principal+interest+monthlyOther*n+upfront,
   down,upfront,monthlyOther};
}
function label(text,id,input,help='') {
 return `<label class="sim-control"><span>${h(text)}</span>${input}${help?'<small>'+h(help)+'</small>':''}</label>`;
}
function numberField(text,id,attrs='',help='') {
 return label(text,id,`<input type="number" id="${h(id)}" step="0.01" min="0" ${attrs}>`,help);
}
function outputCards(items) {
 return `<div class="sim-kpi-grid">${items.map(x=>`<div class="sim-kpi"><span>${h(x[0])}</span><strong>${h(x[1])}</strong><small>${h(x[2]||'')}</small></div>`).join('')}</div>`;
}
const note='Simulação matemática, não cotação, proposta, oferta ou garantia. Os prazos de contemplação não são previsíveis. Reajustes, seguros e condições podem variar conforme regulamento do grupo. O financiamento oferece acesso imediato ao bem conforme aprovação; o consórcio depende de contemplação.';
function reportPopup(ctx,view) {
 const popup=window.open('','_blank');
 if(!popup){ctx.toast('Permita janelas pop-up para imprimir ou salvar em PDF.',true);return;}
 const f=view.f,c=view.c,plan=view.plan,finance=view.finance,asset=view.asset;
 const cells=(rows)=>rows.map(r=>`<tr><th>${h(r[0])}</th><td>${h(r[1])}</td></tr>`).join('');
 const cs=cells([['Produto',productTitle(ctx,plan.product_id)],['Plano',plan.name],['Grupo',plan.group_code||'Não vinculado'],['Crédito',money(view.credit)],['Prazo',plan.term_months+' meses'],['Taxa de administração total',pct(plan.admin_fee_pct)],['Fundo de reserva total',pct(plan.reserve_fund_pct)],['Outros encargos totais',pct(plan.other_total_pct)],['Seguro mensal informado',money(plan.insurance_monthly_amount)],['Hipótese de reajuste anual',pct(plan.annual_adjustment_pct)],['Primeira parcela-base',money(c.first)],['Última parcela estimada',money(c.last)],['Soma dos pagamentos simulados',money(c.total)],['Origem dos parâmetros',plan.source_label||'Não informada']]);
 const fs=finance?`<h2>Financiamento · ${h(f.system)}</h2><table>${cells([['Valor do bem',money(asset)],['Entrada',money(f.downPayment)],['Prazo',f.months+' meses'],['Juros efetivos anuais informados',pct(f.annualRate)],['Parcela inicial',money(finance.first)],['Parcela final',money(finance.last)],['Juros totais',money(finance.interest)],['Custos adicionais',money(Number(f.monthlyCosts)*f.months+Number(f.upfrontCosts))],['Desembolso total com entrada',money(finance.total)]])}</table>`:'<p>Comparativo de financiamento não preenchido.</p>';
 popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Órbita Simula · Relatório</title><style>
 @page{size:A4;margin:17mm}body{font:13px/1.55 Arial,sans-serif;color:#17314d;margin:0}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #194f91;padding-bottom:18px}header img{width:185px}h1{font-size:24px;margin:28px 0 5px}h2{font-size:15px;color:#164a82;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border-bottom:1px solid #e1e8f1;text-align:left;padding:7px 5px;vertical-align:top}th{width:54%;color:#58708a;font-weight:600}.notice{margin-top:22px;border-left:3px solid #bf943d;padding:12px;background:#fff7e9;font-size:11px}.subtitle{color:#67809c}.toolbar{margin:20px 0}.toolbar button{padding:12px 18px;border:0;background:#164c88;color:white;border-radius:7px}@media print{.toolbar{display:none}}</style></head>
 <body><div class="toolbar"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div><header><img src="https://corretores.astrion360.com.br/assets/orbita-wordmark-navy.svg" alt="Órbita by Astrion"><small>SIMULAÇÃO REFERENCIAL<br>${h(new Date().toLocaleString('pt-BR'))}</small></header>
 <h1>Comparativo de aquisição</h1><p class="subtitle">Órbita Simula · Documento informativo elaborado a partir de premissas declaradas.</p>
 <h2>Consórcio</h2><table>${cs}</table>${fs}
 <div class="notice"><strong>Limitações:</strong> ${h(note)} Não se trata de CET, de projeção atuarial da cota ou de previsão de contemplação. Os totais refletem as hipóteses usadas, sem equivalência de disponibilidade imediata do crédito.</div>
 </body></html>`);
 popup.document.close();popup.focus();
}
export function renderSimulator(root,ctx) {
 const products=ctx.products.filter(p=>p.active);
 if(!products.length){root.innerHTML='<section class="sim-card">Nenhum produto ativo está cadastrado.</section>';return;}
 let productId=ctx.prefill?.product_id&&products.some(p=>p.id===ctx.prefill.product_id)?ctx.prefill.product_id:products[0].id;
 const opts=`<option value="">Selecione uma solicitação, se desejar</option>${ctx.opps.map(o=>option(o.id,(ctx.clients.find(c=>c.id===o.client_id)?.full_name||'Cliente')+' · '+productTitle(ctx,o.product_id),ctx.prefill?.id)).join('')}`;
 root.innerHTML=`
 <div class="sim-page-head"><div><span class="eyebrow">ÓRBITA · INTELIGÊNCIA COMERCIAL</span><h1>Simulador de consórcios</h1><p>Escolha um produto cadastrado e utilize as condições liberadas pela Astrion. Compare cenários de aquisição.</p></div>${ctx.isAdmin?'<a href="#" class="btn btn-outline" id="sim-config-link">Gerenciar planos →</a>':''}</div>
 <div class="sim-stage-grid"><section class="sim-card sim-main">
  <div class="sim-section-head"><span class="sim-step">01</span><div><h2>Produto e crédito</h2><p>As taxas serão importadas do plano cadastrado, sem digitação manual.</p></div></div>
  <div class="sim-grid">
   ${label('Solicitação existente (opcional)','sim-opportunity',`<select id="sim-opportunity">${opts}</select>`)}
   ${label('Produto cadastrado','sim-product',`<select id="sim-product">${products.map(p=>option(p.id,p.name,productId)).join('')}</select>`)}
   ${label('Plano configurado','sim-plan','<select id="sim-plan"></select>')}
   ${numberField('Valor do crédito desejado (R$)','sim-credit','placeholder="Ex.: 200000" required','Não é o preço de compra do bem, necessariamente.')}
  </div>
  <div class="sim-configuration" id="sim-configuration"></div>
  <div class="sim-section-head sim-second"><span class="sim-step">02</span><div><h2>Comparação com financiamento</h2><p>Informe as condições efetivas ou uma hipótese expressamente identificada.</p></div></div>
  <div class="sim-grid">
   ${numberField('Valor de aquisição do bem (R$)','sim-asset','placeholder="Pode ser igual ao crédito"','Se não preenchido, utiliza o crédito para o comparativo.')}
   ${numberField('Entrada no financiamento (R$)','sim-down','value="0"')}
   ${numberField('Juros efetivos anuais (%)','sim-interest','placeholder="Informe a taxa; sem taxa, não há cálculo"','A taxa não é importada de nenhum banco.')}
   ${numberField('Prazo do financiamento (meses)','sim-fin-term','step="1" min="1" max="360"')}
   ${label('Sistema de amortização','sim-system','<select id="sim-system"><option value="PRICE">Tabela Price</option><option value="SAC">Sistema SAC</option></select>')}
   ${numberField('Seguro e outros custos mensais (R$)','sim-fin-extra','value="0"')}
   ${numberField('Custos iniciais adicionais (R$)','sim-fin-upfront','value="0"')}
  </div>
 </section><aside class="sim-card sim-side">
  <div class="sim-side-title"><span class="eyebrow">RESULTADOS</span><h2>Visão comparativa</h2></div>
  <div id="sim-results" aria-live="polite"><div class="sim-empty">Escolha um plano liberado e informe o crédito para visualizar os cálculos.</div></div>
  <div class="sim-disclaimer">${h(note)}</div>
  <button class="btn btn-primary sim-print" id="sim-print" type="button" disabled>Gerar relatório em PDF</button>
 </aside></div>`;
 const el=id=>root.querySelector('#'+id);
 const product=el('sim-product'),planSel=el('sim-plan'),credit=el('sim-credit'),opps=el('sim-opportunity');
 let report=null;let activePlan=null;
 function syncPlan(){
   const list=availablePlans(ctx,product.value);
   const previous=planSel.value;
   planSel.innerHTML=list.length?list.map(p=>option(p.id,p.name+(p.group_code?' · Grupo '+p.group_code:''),previous)).join(''):'<option value="">Nenhum plano ativo aprovado</option>';
   activePlan=list.find(p=>p.id===planSel.value)||list[0]||null;
   if(activePlan){planSel.value=activePlan.id;if(!el('sim-fin-term').value)el('sim-fin-term').value=activePlan.term_months;}
   update();
 }
 function update(){
  const p=ctx.plans.find(x=>x.id===planSel.value&&x.product_id===product.value&&x.active&&x.approved_for_use)||null;
  activePlan=p;report=null;el('sim-print').disabled=true;
  const seg=productSegment(ctx,product.value),group=planGroup(ctx,p);
  el('sim-configuration').innerHTML=p?
    `<div class="sim-imported"><div class="sim-imported-head"><strong>Parâmetros do plano</strong><span class="sim-verified">${h(p.source_label)}</span></div>
      <div class="sim-facts">
       <span>Prazo <b>${fmt(p.term_months)} meses</b></span><span>Taxa adm. total <b>${pct(p.admin_fee_pct)}</b></span><span>Fundo de reserva <b>${pct(p.reserve_fund_pct)}</b></span>
       <span>Outros encargos totais <b>${pct(p.other_total_pct)}</b></span><span>Seguro mensal informado <b>${money(p.insurance_monthly_amount)}</b></span><span>Hipótese de reajuste anual <b>${pct(p.annual_adjustment_pct)}</b></span>
      </div><small>O cálculo usa rateio linear do crédito e das taxas totais no prazo. Não reproduz parcelas reduzidas ou regras específicas de contemplação.</small></div>`
    :'<div class="sim-alert">Este produto ainda não tem um plano liberado com taxas cadastradas pela Astrion. Solicite a configuração para simular.</div>';
  const c=nval(credit.value);
  if(!p){el('sim-results').innerHTML='<div class="sim-empty">Aguardando cadastro e aprovação do plano comercial.</div>';return;}
  if(!validNumber(c,1,1e10)){el('sim-results').innerHTML='<div class="sim-empty">Informe o valor do crédito para calcular.</div>';return;}
  const bounds=group&&group.credit_min!=null&&group.credit_max!=null?group:seg;
  if(bounds&&(bounds.credit_min!=null&&c<Number(bounds.credit_min)||bounds.credit_max!=null&&c>Number(bounds.credit_max))){
    el('sim-results').innerHTML=`<div class="sim-alert">Crédito fora da faixa de referência disponível: ${money(bounds.credit_min||0)} a ${money(bounds.credit_max||0)}. Ajuste o valor ou escolha outra opção.</div>`;
    return;
  }
  if(seg?.max_term_months&&p.term_months>Number(seg.max_term_months)){
    el('sim-results').innerHTML='<div class="sim-alert">O prazo do plano supera o limite de referência do produto. Peça à Astrion para revisar o cadastro.</div>';return;
  }
  let calc;
  try{calc=calculateConsortium(p,c);}catch(e){el('sim-results').innerHTML=`<div class="sim-alert">${h(e.message)}</div>`;return;}
  const asset=nval(el('sim-asset').value)||c;
  const annualRaw=el('sim-interest').value;
  const finInputs={assetValue:asset,downPayment:nval(el('sim-down').value),annualRate:nval(annualRaw),months:nval(el('sim-fin-term').value),system:el('sim-system').value,monthlyCosts:nval(el('sim-fin-extra').value),upfrontCosts:nval(el('sim-fin-upfront').value)};
  let fin=null,finError='';
  if(annualRaw!==''){try{fin=calculateFinancing(finInputs);}catch(e){finError=e.message;}}
  const cards=outputCards([['Parcela inicial do consórcio',money(calc.first),'Parcela-base de referência'],['Desembolso acumulado consórcio',money(calc.total),'Inclui reajuste anual hipotético'],['Última parcela projetada',money(calc.last),'Seguro fixo na hipótese']]);
  let comp='';
  if(fin){
   const max=Math.max(calc.total,fin.total,1),a=(calc.total/max*100).toFixed(1),b=(fin.total/max*100).toFixed(1);
   comp=`<div class="sim-comparison"><h3>Financiamento · ${h(fin.system)}</h3>
      ${outputCards([['Parcela inicial',money(fin.first),'Inclui custos mensais informados'],['Parcela final',money(fin.last),'SAC tende a reduzir'],['Desembolso total',money(fin.total),'Inclui entrada e custos informados']])}
      <div class="sim-bars"><div><span>Consórcio</span><i><b style="width:${a}%"></b></i><strong>${money(calc.total)}</strong></div><div><span>Financiamento</span><i><b class="finance" style="width:${b}%"></b></i><strong>${money(fin.total)}</strong></div></div>
      <small>Os valores não representam alternativas economicamente equivalentes: entrada, disponibilidade imediata do bem, custos e tempo até a contemplação são diferentes. Sem estimativa de CET.</small></div>`;
  }else comp=`<div class="sim-hint">${h(finError||'Informe uma taxa anual de financiamento para habilitar o comparativo Price/SAC.')}</div>`;
  el('sim-results').innerHTML=cards+comp;
  report={c:calc,f:finInputs,plan:p,finance:fin,asset,credit:c};
  el('sim-print').disabled=false;
 }
 product.addEventListener('change',()=>{el('sim-fin-term').value='';syncPlan();});
 planSel.addEventListener('change',()=>{const p=ctx.plans.find(x=>x.id===planSel.value);if(p)el('sim-fin-term').value=p.term_months;update();});
 opps.addEventListener('change',()=>{
   const o=ctx.opps.find(x=>x.id===opps.value);
   if(o){if(products.some(p=>p.id===o.product_id))product.value=o.product_id;credit.value=o.credit_amount||'';el('sim-asset').value=o.asset_value||'';el('sim-down').value='0';el('sim-fin-term').value='';syncPlan();}
 });
 root.addEventListener('input',e=>{if(e.target.matches('#sim-credit,#sim-asset,#sim-down,#sim-interest,#sim-fin-term,#sim-fin-extra,#sim-fin-upfront'))update();});
 root.addEventListener('change',e=>{if(e.target.matches('#sim-system'))update();});
 el('sim-print').addEventListener('click',()=>{if(report)reportPopup(ctx,report);});
 const admin=el('sim-config-link');if(admin)admin.addEventListener('click',e=>{e.preventDefault();ctx.navigate('simulator-admin');});
 if(ctx.prefill){opps.value=ctx.prefill.id;credit.value=ctx.prefill.credit_amount||'';el('sim-asset').value=ctx.prefill.asset_value||'';}
 syncPlan();
}
export function renderSimulatorAdmin(root,ctx){
 if(!ctx.isAdmin){root.innerHTML='<p>Sem permissão.</p>';return;}
 const products=ctx.products.filter(p=>p.active),plans=ctx.plans;
 root.innerHTML=`<div class="sim-page-head"><div><span class="eyebrow">ADMINISTRAÇÃO · ÓRBITA SIMULA</span><h1>Parâmetros comerciais</h1><p>Somente planos aprovados e ativos ficam disponíveis para simulações dos corretores.</p></div><button class="btn btn-outline" id="sim-back">← Voltar ao simulador</button></div>
 <div class="sim-admin-grid"><section class="sim-card"><h2>Plano de simulação</h2><p class="sim-help">Cadastre as condições específicas do produto. Não utilize taxas estimadas como se fossem oficiais.</p>
 <form id="sim-admin-form" class="sim-grid" autocomplete="off">
 ${label('Editar plano existente','adm-id',`<select id="adm-id"><option value="">+ Cadastrar novo plano</option>${plans.map(p=>option(p.id,productTitle(ctx,p.product_id)+' · '+p.name,'')).join('')}</select>`)}
 ${label('Produto','adm-product',`<select id="adm-product" required>${products.map(p=>option(p.id,p.name,'')).join('')}</select>`)}
 ${label('Grupo (opcional)','adm-group','<select id="adm-group"></select>')}
 ${label('Nome do plano','adm-name','<input id="adm-name" maxlength="120" minlength="3" required placeholder="Ex.: Plano normal · 100 meses">')}
 ${numberField('Prazo em meses','adm-term','step="1" min="1" max="360" required')}
 ${numberField('Taxa de administração total (%)','adm-fee','required step="0.0001" min="0" max="100"')}
 ${numberField('Fundo de reserva total (%)','adm-reserve','required value="0" step="0.0001"')}
 ${numberField('Outros encargos totais (%)','adm-other','required value="0" step="0.0001"')}
 ${numberField('Seguro mensal fixo (R$)','adm-insurance','required value="0"')}
 ${numberField('Reajuste anual hipotético (%)','adm-adjustment','required value="0" step="0.0001" max="50"','Não é índice contratual automático; informe apenas se houver premissa validada.')}
 ${label('Origem e data da condição','adm-source','<input id="adm-source" maxlength="500" placeholder="Ex.: Tabela aprovada · 20/10/2026">','Obrigatório para liberar aos corretores.')}
 <div class="sim-approval"><label><input type="checkbox" id="adm-active"> Plano ativo</label><label><input type="checkbox" id="adm-approved"> Condições verificadas e liberadas pela Astrion</label></div>
 <div class="sim-form-actions"><button class="btn btn-primary" type="submit">Salvar parâmetros</button><button class="btn btn-outline" type="button" id="adm-new">Limpar formulário</button></div>
 </form></section>
 <section class="sim-card sim-admin-list"><h2>Planos cadastrados</h2><p class="sim-help">Clique em um plano para editar. Todos os planos ficam restritos à administração enquanto não forem liberados.</p>
 ${plans.length?plans.map(p=>`<button class="sim-plan-row" data-edit-plan="${h(p.id)}" type="button"><strong>${h(productTitle(ctx,p.product_id))} · ${h(p.name)}</strong><small>${fmt(p.term_months)} meses · TA ${pct(p.admin_fee_pct)} · FR ${pct(p.reserve_fund_pct)}</small><em class="${p.active&&p.approved_for_use?'ready':'draft'}">${p.active&&p.approved_for_use?'Disponível':'Não publicado'}</em></button>`).join(''):'<div class="sim-empty">Nenhum plano cadastrado. Inclua as condições aprovadas dos produtos.</div>'}
 </section></div>`;
 const e=id=>root.querySelector('#'+id), form=e('sim-admin-form');
 function groups(current){const p=e('adm-product').value; e('adm-group').innerHTML=option('','Sem grupo específico',current)+groupList(ctx,p).map(g=>option(g.code,'Grupo '+g.code,current)).join('');}
 function reset(){form.reset();e('adm-id').value='';e('adm-product').value=products[0]?.id||'';for(const id of ['adm-reserve','adm-other','adm-insurance','adm-adjustment'])e(id).value=0;groups('');}
 function edit(id){
  const p=plans.find(x=>x.id===id);if(!p)return;
  e('adm-id').value=p.id;e('adm-product').value=p.product_id;groups(p.group_code||'');
  for(const [key,v] of [['name',p.name],['term',p.term_months],['fee',p.admin_fee_pct],['reserve',p.reserve_fund_pct],['other',p.other_total_pct],['insurance',p.insurance_monthly_amount],['adjustment',p.annual_adjustment_pct],['source',p.source_label]])e('adm-'+key).value=v??'';
  e('adm-active').checked=!!p.active;e('adm-approved').checked=!!p.approved_for_use;
  form.scrollIntoView({behavior:'smooth',block:'start'});
 }
 e('sim-back').addEventListener('click',()=>ctx.navigate('simulator'));
 e('adm-new').addEventListener('click',reset);
 e('adm-product').addEventListener('change',()=>groups(''));
 e('adm-id').addEventListener('change',()=>e('adm-id').value?edit(e('adm-id').value):reset());
 root.querySelectorAll('[data-edit-plan]').forEach(btn=>btn.addEventListener('click',()=>edit(btn.dataset.editPlan)));
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const id=e('adm-id').value;
  const productId=e('adm-product').value;
  const data={product_id:productId,group_code:e('adm-group').value||null,name:e('adm-name').value.trim(),
    term_months:Number(e('adm-term').value),admin_fee_pct:nval(e('adm-fee').value),
    reserve_fund_pct:nval(e('adm-reserve').value),other_total_pct:nval(e('adm-other').value),
    insurance_monthly_amount:nval(e('adm-insurance').value),annual_adjustment_pct:nval(e('adm-adjustment').value),
    source_label:e('adm-source').value.trim(),active:e('adm-active').checked,approved_for_use:e('adm-approved').checked,
    updated_at:new Date().toISOString()};
  const seg=productSegment(ctx,productId);
  if(!data.name||data.name.length<3||!Number.isInteger(data.term_months)||!validNumber(data.term_months,1,360)
   ||!validNumber(data.admin_fee_pct,0,100)||!validNumber(data.reserve_fund_pct,0,100)
   ||!validNumber(data.other_total_pct,0,100)||!validNumber(data.insurance_monthly_amount,0,1e6)
   ||!validNumber(data.annual_adjustment_pct,0,50)){
    ctx.toast('Revise os campos e limites dos parâmetros comerciais.',true);return;
  }
  if(seg?.max_term_months&&data.term_months>Number(seg.max_term_months)){ctx.toast('Prazo acima do limite de referência deste produto.',true);return;}
  if(data.group_code&&!groupList(ctx,productId).some(g=>g.code===data.group_code)){ctx.toast('O grupo selecionado não pertence ao produto.',true);return;}
  if(data.approved_for_use&&data.source_label.length<3){ctx.toast('Informe a fonte dos valores antes de aprovar.',true);return;}
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   const q=id?ctx.sb.from('simulator_plans').update(data).eq('id',id):ctx.sb.from('simulator_plans').insert(data);
   const {error}=await q;if(error)throw error;
   ctx.toast('Parâmetros de simulação salvos.');
   await ctx.reload();
  }catch(err){ctx.toast(err.message||'Não foi possível salvar o plano.',true);}
  finally{btn.disabled=false;}
 });
 reset();
}
