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


/* Fonte das referências: SGS/BCB, ago/2026, para Imóveis e Veículos;
   medianas das instituições em set/2026 (creditoscopio/BCB) para demais categorias.
   Taxas-base comparativas, NÃO taxas garantidas nem CET. */
export const FINANCING_BENCHMARKS = Object.freeze({
  'Imóveis': {monthly:1.12,label:'BCB SGS 25497 · financiamento imobiliário PF · ago/2026',url:'https://dadosabertos.bcb.gov.br/dataset/25497-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-direcionados---pessoas-fisic'},
  'Automóveis': {monthly:1.97,label:'BCB SGS 25471 · aquisição de veículos PF · ago/2026',url:'https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a'},
  'Motos': {monthly:1.97,label:'Proxy: aquisição de veículos PF · BCB SGS 25471 · ago/2026',url:'https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a'},
  'Pesados': {monthly:1.97,label:'Proxy PF: aquisição de veículos · não reflete necessariamente financiamento PJ/pesados · ago/2026',url:'https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a'},
  'Outros': {monthly:2.94,label:'Mediana das instituições · outros bens PF · 1ª semana set/2026',url:'https://creditoscopio.com.br/atualizacoes/2026-09/'},
  'Serviços': {monthly:5.90,label:'Proxy: crédito pessoal sem consignado PF · 1ª semana set/2026 (não é financiamento específico de serviços)',url:'https://creditoscopio.com.br/atualizacoes/2026-09/'}
});
export function benchmarkForProduct(product){
 return FINANCING_BENCHMARKS[product?.category] || null;
}
/* Parcela reduzida: metade da parte de amortização + taxas, com seguro integral.
   Parcela adiada acumulada sem juros e rateada, após mês hipotético de contemplação.
   É uma hipótese financeira; modalidades comerciais podem ter regra distinta. */
/* Regime de parcelas conforme treinamento, slide 19:
   normal: 100% fundo comum + 100% taxas;
   50%: 50% fundo comum + 100% taxas (até mês de contemplação HIPOTÉTICO);
   70%: 70% fundo comum + 100% taxas (modelo indicativo com 30% LE).
   O seguro não é reduzido pela modalidade de parcela. */
export function calculateConsortium(plan,credit,options={}) {
 const c=Number(credit),n=Number(plan?.term_months);
 const fee=Number(plan?.admin_fee_pct),reserve=Number(plan?.reserve_fund_pct);
 const other=Number(plan?.other_total_pct),fixedInsurance=Number(plan?.insurance_monthly_amount);
 const prestamistaRate=Number(plan?.prestamista_rate_monthly??0);
 const annual=Number(plan?.annual_adjustment_pct);
 const mode=String(options?.paymentMode||(options?.reduced50===true?'half':'normal'));
 const reduced=mode==='half',plan70=mode==='seventy';
 const month=reduced?Number(options?.contemplationMonth):null;
 const insuranceBase=options?.insuranceBase==='credit_plus_fees'?'credit_plus_fees':'credit';
 const taxesTotal=c*(fee+reserve+other)/100;
 const insuredCapital=insuranceBase==='credit_plus_fees'?c+taxesTotal:c;
 const prestamistaMonthlyAmount=insuredCapital*prestamistaRate;
 const insurance=prestamistaMonthlyAmount+fixedInsurance;
 if(!Number.isFinite(c)||c<=0||c>1e10||!Number.isInteger(n)||n<1||n>360||
   ![fee,reserve,other].every(x=>validNumber(x,0,100))||
   !validNumber(fixedInsurance,0,1e6)||!validNumber(prestamistaRate,0,0.05)||
   !validNumber(annual,0,50)||!['normal','half','seventy'].includes(mode)||
   (reduced&&(!Number.isInteger(month)||month<1||month>=n)))
     throw Error('Premissas do consórcio inválidas.');
 const principal=c/n,fees=taxesTotal/n,base=principal+fees;
 const factor=m=>Math.pow(1+annual/100,Math.floor((m-1)/12));
 let deferred=0;
 if(reduced)for(let m=1;m<=month;m++)deferred+=principal*factor(m)*.5;
 const distributed=reduced?deferred/(n-month):0;
 let total=0,first=0,last=0,after=null,normalTotal=0;
 for(let m=1;m<=n;m++){
   const f=factor(m),full=base*f+insurance;
   normalTotal+=full;
   const installment=plan70?(principal*.7+fees)*f+insurance
     :reduced?(m<=month?(principal*.5+fees)*f+insurance:full+distributed)
     :full;
   if(m===1)first=installment;
   if(reduced&&m===month+1)after=installment;
   last=installment;total+=installment;
 }
 return {
   first,last,total,term:n,charges:taxesTotal,
   base,principalComponent:principal,feesComponent:fees,insurance,
   insuranceBase,insuredCapital,
   prestamistaRateMonthly:prestamistaRate,prestamistaMonthlyAmount,fixedInsurance,
   annual,normalTotal,mode,plan70,reduced50:reduced,contemplationMonth:month,
   postContemplationFirst:after,deferredAmount:deferred,normalFirst:base+insurance,
   grossCredit:c,plan70EmbeddedAmount:plan70?c*.3:0,
   plan70NetCredit:plan70?c*.7:c,
   nominalNoAdjustment:(base+insurance)*n
 };
}
export function calculateFinancing({assetValue,downPayment=0,annualRate,monthlyRate,months,system,monthlyCosts=0,upfrontCosts=0}) {
 const asset=Number(assetValue),down=Number(downPayment),n=Number(months);
 const monthlyOther=Number(monthlyCosts),upfront=Number(upfrontCosts);
 const useMonthly=monthlyRate!=null;
 const annual=annualRate==null?null:Number(annualRate);
 const mon=useMonthly?Number(monthlyRate):null;
 if(!validNumber(asset,1,1e10)||!validNumber(down,0,asset)||
    (useMonthly?!validNumber(mon,0,100):!validNumber(annual,0,100))||
    !Number.isInteger(n)||!validNumber(n,1,360)||!['PRICE','SAC'].includes(system)||
    !validNumber(monthlyOther,0,1e6)||!validNumber(upfront,0,1e9))
      throw Error('Premissas do financiamento inválidas.');
 const principal=asset-down;
 const rate=useMonthly?mon/100:Math.pow(1+annual/100,1/12)-1;
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
   down,upfront,monthlyOther,monthlyRate:rate*100};
}
function label(text,id,input,help='') {
 return `<label class="sim-control"><span>${h(text)}</span>${input}${help?'<small>'+h(help)+'</small>':''}</label>`;
}
function numberField(text,id,attrs='',help='') {
 const step=/\bstep\s*=/.test(attrs)?'':'step="0.01"';
 const min=/\bmin\s*=/.test(attrs)?'':'min="0"';
 return label(text,id,`<input type="number" id="${h(id)}" ${step} ${min} ${attrs}>`,help);
}
function outputCards(items) {
 return `<div class="sim-kpi-grid">${items.map(x=>`<div class="sim-kpi"><span>${h(x[0])}</span><strong>${h(x[1])}</strong><small>${h(x[2]||'')}</small></div>`).join('')}</div>`;
}
const note='Simulação referencial, não cotação ou oferta. O prestamista foi estimado sobre o crédito integral solicitado, a cada mês, sem redução por amortização; o contrato pode adotar outra base. Uma hipótese de 0% de reajuste não significa ausência de correção contratual. Contemplação não tem data garantida e financiamento depende de aprovação.';

function reportPopup(ctx,view){
 const popup=window.open('','_blank');
 if(!popup){ctx.toast('Permita pop-ups para imprimir ou salvar em PDF.',true);return;}
 const f=view.f,c=view.c,p=view.plan,fin=view.finance;
 const rows=(items)=>items.map(([name,value])=>`<tr><th>${h(name)}</th><td>${h(value)}</td></tr>`).join('');
 const consRows=[
  ['Produto',productTitle(ctx,p.product_id)],['Plano',p.name],
  ['Grupo',p.group_code||'Referência por produto, sem grupo específico'],
  ['Crédito simulado',money(view.credit)],['Prazo',p.term_months+' meses'],
  ['Taxa administração total · cenário',pct(p.admin_fee_pct)],
  ['Fundo de reserva total · cenário',pct(p.reserve_fund_pct)],
  ['Outros encargos totais',pct(p.other_total_pct)],
  ['Prestamista mensal sobre crédito',money(c.prestamistaMonthlyAmount)],
  ['Taxa mensal prestamista',pct(Number(p.prestamista_rate_monthly||0)*100)],
  ['Seguro mensal adicional',money(c.fixedInsurance)],
  ['Reajuste anual hipotético',pct(p.annual_adjustment_pct)],
  ['Modalidade de parcela',c.reduced50?'Reduzida 50% · hipotética':'Integral'],
  ...(c.reduced50?[
    ['Mês hipotético da contemplação',String(c.contemplationMonth)],
    ['Parcela inicial reduzida',money(c.first)],
    ['Parcela após mês hipotético',money(c.postContemplationFirst)],
    ['Valor diferido redistribuído',money(c.deferredAmount)]
   ]:[['Primeira parcela integral',money(c.first)],['Última parcela estimada',money(c.last)]]),
  ['Total de pagamentos estimados',money(c.total)],
  ['Fonte do plano',p.source_label||'Não informada']
 ];
 const financRows=fin?[
  ['Crédito financiado (igual ao consórcio)',money(view.credit)],
  ['Entrada','R$ 0,00 · hipótese de comparação'],
  ['Prazo (igual ao consórcio)',String(f.months)+' meses'],
  ['Taxa mensal usada',pct(f.monthlyRate)],
  ['Referência de mercado',view.source||'Taxa definida pelo usuário'],
  ['Sistema de amortização',fin.system],
  ['Primeira parcela',money(fin.first)],
  ['Última parcela',money(fin.last)],
  ['Juros totais estimados',money(fin.interest)],
  ['Somatório das parcelas',money(fin.total)],
  ['Custos bancários adicionais','Não incluídos: IOF, seguros, tarifas, CET e indexadores']
 ]:null;
 const finHtml=financRows?`<h2>Financiamento · ${h(fin.system)}</h2><table>${rows(financRows)}</table>`:
   '<h2>Financiamento</h2><p>Não calculado. A taxa mensal não foi informada ou é inválida.</p>';
 const noteText=c.reduced50
   ?'A parcela de 50% recai sobre a parte principal e encargos proporcionais, não sobre o seguro. O valor postergado foi rateado após um mês de contemplação meramente hipotético, sem juros sobre a postergação. Não representa regra contratual garantida.'
   :'Cálculo linear referencial do crédito e taxas totais, com seguro integral e reajuste hipotético quando cadastrado.';
 popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Órbita Simula | Relatório</title><style>
 @page{size:A4;margin:15mm}
 body{font:12px/1.52 Arial,sans-serif;color:#17314d;margin:0}
 header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #164c88;padding:0 0 15px;gap:10px}
 header img{width:170px;max-width:45%}
 header small{text-align:right;color:#627d9b;font-size:10px}
 h1{font-size:23px;color:#0b3057;margin:24px 0 0}
 h2{font-size:15px;color:#164a82;margin:20px 0 9px;break-after:avoid}
 p{margin:8px 0}
 table{border-collapse:collapse;width:100%;font-size:10px;break-inside:avoid}
 th,td{border-bottom:1px solid #e1e8f1;text-align:left;padding:6px 5px;vertical-align:top}
 th{width:51%;color:#58708a;font-weight:600}
 .notice{margin-top:18px;border-left:3px solid #bf943d;padding:12px;background:#fff7e9;font-size:10px;break-inside:avoid}
 .subtitle{color:#657e99}.toolbar{margin:20px 0}
 .toolbar button{padding:12px 18px;border:0;background:#164c88;color:white;border-radius:7px;cursor:pointer}
 @media print{.toolbar{display:none}}
 </style></head><body>
 <div class="toolbar"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>
 <header><img src="https://corretores.astrion360.com.br/assets/orbita-wordmark-navy.svg" alt="Órbita by Astrion">
 <small>SIMULAÇÃO COMERCIAL REFERENCIAL<br>${h(new Date().toLocaleString('pt-BR'))}</small></header>
 <h1>Comparativo de aquisição</h1>
 <p class="subtitle">Mesmo valor de crédito e prazo nas duas modalidades. Parâmetros editados são válidos apenas para esta simulação.</p>
 <h2>Consórcio</h2><table>${rows(consRows)}</table>
 <p>${h(noteText)}</p>
 ${finHtml}
 <div class="notice"><strong>Limitações importantes.</strong> ${h(note)}
 A simulação de financiamento usa 100% do valor do crédito, sem entrada; não incorpora IOF, seguros obrigatórios, tributos, tarifas, CET ou TR/IPCA. A taxa de referência é uma hipótese comparativa de mercado, não proposta contratual. O valor total não mede o custo econômico da espera pela contemplação.</div>
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
  <div class="sim-section-head"><span class="sim-step">01</span><div><h2>Produto e crédito</h2><p>Use os parâmetros cadastrados ou ajuste TA e FR para estudar um cenário, sem alterar o plano oficial.</p></div></div>
  <div class="sim-grid">
   ${label('Solicitação existente (opcional)','sim-opportunity',`<select id="sim-opportunity">${opts}</select>`)}
   ${label('Produto cadastrado','sim-product',`<select id="sim-product">${products.map(p=>option(p.id,p.name,productId)).join('')}</select>`)}
   ${label('Plano configurado','sim-plan','<select id="sim-plan"></select>')}
   ${numberField('Valor do crédito desejado (R$)','sim-credit','placeholder="Ex.: 200000" required','Não é o preço de compra do bem, necessariamente.')}
  </div>

  <div class="sim-pricing-block">
    <div class="sim-pricing-head"><strong>Condições da simulação</strong><span>Somente este cálculo · não altera o cadastro</span></div>
    <div class="sim-grid">
      ${numberField('Taxa de administração total (%)','sim-admin-fee','step="0.01" max="100"','Editável apenas para esta simulação.')}
      ${numberField('Fundo de reserva total (%)','sim-reserve-fee','step="0.01" max="100"','Editável apenas para esta simulação.')}
      ${label('Modalidade de parcela','sim-payment-mode','<select id="sim-payment-mode"><option value="normal">Parcela integral</option><option value="half">Parcela reduzida 50%</option></select>')}
      ${numberField('Mês hipotético da contemplação','sim-contemplation','step="1" min="1"','Apenas hipótese para redistribuir o saldo; não prevê contemplação.')}
    </div>
    <div id="sim-reduced-info" class="sim-reduced-info">O seguro prestamista continua integral. A metade adiada será redistribuída após o mês hipotético de contemplação, sem previsão de contemplação real.</div>
  </div>

  <div class="sim-configuration" id="sim-configuration"></div>
  <div class="sim-section-head sim-second"><span class="sim-step">02</span><div><h2>Comparação com financiamento</h2><p>Mesmo crédito e prazo do consórcio. Apenas a taxa de juros muda, com opção Price ou SAC.</p></div></div>

  <div class="sim-linked" id="sim-finance-linked" aria-live="polite">O crédito e o prazo serão os mesmos do plano de consórcio selecionado.</div>
  <div class="sim-grid">
    ${numberField('Taxa de juros de referência do financiamento (% a.m.)','sim-interest','step="0.01" min="0" max="100"','Taxa pré-preenchida com referência de mercado; pode ser ajustada.')}
    ${label('Sistema de amortização','sim-system','<select id="sim-system"><option value="PRICE">Tabela Price</option><option value="SAC">Sistema SAC</option></select>')}
  </div>
  <div class="sim-rate-source" id="sim-rate-source">As taxas são referências de mercado, não propostas vinculantes. Sem entrada, IOF, seguro bancário ou CET.</div>
 </section><aside class="sim-card sim-side">
  <div class="sim-side-title"><span class="eyebrow">RESULTADOS</span><h2>Visão comparativa</h2></div>
  <div id="sim-results" aria-live="polite"><div class="sim-empty">Escolha um plano liberado e informe o crédito para visualizar os cálculos.</div></div>
  <div class="sim-disclaimer">${h(note)}</div>
  <button class="btn btn-primary sim-print" id="sim-print" type="button" disabled>Gerar relatório em PDF</button>
 </aside></div>`;

 const el=id=>root.querySelector('#'+id);
 const product=el('sim-product'),planSel=el('sim-plan'),credit=el('sim-credit'),opps=el('sim-opportunity');
 let report=null,activePlan=null,autoCredit=null;
 const activeProduct=()=>ctx.products.find(p=>p.id===product.value);
 function syncRate(){
   const b=benchmarkForProduct(activeProduct());
   const rate=el('sim-interest');
   rate.value=b?String(b.monthly):'';
   const label=el('sim-rate-source');
   label.innerHTML=b
    ?`Taxa inicial ${pct(b.monthly)} a.m. · ${h(b.label)}. <a href="${h(b.url)}" target="_blank" rel="noopener noreferrer">Consultar fonte</a>. Editável; não é CET nem oferta bancária. Simulação com 100% do crédito financiado, sem entrada, IOF ou seguros.`
    :'Nenhuma referência de juros definida para este produto. Informe uma taxa mensal para calcular. Sem entrada, IOF, seguros ou CET.';
 }
 function syncPricing(p){
   el('sim-admin-fee').value=p?.admin_fee_pct??'';
   el('sim-reserve-fee').value=p?.reserve_fund_pct??'';
   el('sim-payment-mode').value='normal';
   el('sim-contemplation').max=p?String(Math.max(1,p.term_months-1)):'360';
   el('sim-contemplation').value=p?String(Math.max(1,Math.floor(p.term_months/2))):'';
   el('sim-contemplation').disabled=true;
   el('sim-reduced-info').classList.add('hidden');
 }
 function syncPlan(){
   const list=availablePlans(ctx,product.value);
   const previous=planSel.value;
   planSel.innerHTML=list.length
      ?list.map(p=>option(p.id,p.name+(p.group_code?' · Grupo '+p.group_code:''),previous)).join('')
      :'<option value="">Nenhum plano ativo aprovado</option>';
   activePlan=list.find(p=>p.id===planSel.value)||list[0]||null;
   if(activePlan){
     planSel.value=activePlan.id;
     if(!opps.value&&(!credit.value||Number(credit.value)===autoCredit)&&activePlan.reference_credit_amount!=null){
       credit.value=String(Number(activePlan.reference_credit_amount));
       autoCredit=Number(activePlan.reference_credit_amount);
     }
   }
   syncPricing(activePlan);syncRate();update();
 }
 function update(){
   const p=ctx.plans.find(x=>x.id===planSel.value&&x.product_id===product.value&&x.active&&x.approved_for_use)||null;
   activePlan=p;report=null;el('sim-print').disabled=true;
   const reduced=el('sim-payment-mode').value==='half';
   el('sim-reduced-info').classList.toggle('hidden',!reduced);
   el('sim-contemplation').disabled=!reduced;
   const seg=productSegment(ctx,product.value),group=planGroup(ctx,p);
   el('sim-configuration').innerHTML=p
     ?`<div class="sim-imported"><div class="sim-imported-head"><strong>Condições do produto cadastrado</strong><span class="sim-verified">${h(p.source_label)}</span></div>
       <div class="sim-facts">
        <span>Prazo <b>${fmt(p.term_months)} meses</b></span><span>TA do cadastro <b>${pct(p.admin_fee_pct)}</b></span><span>FR do cadastro <b>${pct(p.reserve_fund_pct)}</b></span>
        <span>Outros encargos totais <b>${pct(p.other_total_pct)}</b></span><span>Prestamista ao mês <b>${pct(Number(p.prestamista_rate_monthly||0)*100)}</b></span><span>Seguro adicional <b>${money(p.insurance_monthly_amount)}</b></span>
        <span>Crédito de referência <b>${p.reference_credit_amount==null?'A definir':money(p.reference_credit_amount)}</b></span><span>Reajuste anual hipotético <b>${pct(p.annual_adjustment_pct)}</b></span>
       </div><small>TA e FR digitados acima prevalecem neste cálculo, sem alterar as condições cadastradas. Prestamista calculado sobre o crédito integral; regras e reajustes contratuais dependem de confirmação.</small></div>`
     :'<div class="sim-alert">Este produto não tem plano de referência liberado para simulação.</div>';
   const c=nval(credit.value);
   el('sim-finance-linked').textContent=p&&validNumber(c,1,1e10)
    ?'Crédito financiado: '+money(c)+' · Prazo: '+p.term_months+' meses · Entrada: R$ 0,00'
    :'O financiamento utilizará o mesmo valor de crédito e prazo do consórcio.';
   if(!p){el('sim-results').innerHTML='<div class="sim-empty">Aguardando plano comercial.</div>';return;}
   if(!validNumber(c,1,1e10)){el('sim-results').innerHTML='<div class="sim-empty">Informe o valor do crédito.</div>';return;}
   const bounds=group&&group.credit_min!=null&&group.credit_max!=null?group:seg;
   if(bounds&&((bounds.credit_min!=null&&c<Number(bounds.credit_min))||(bounds.credit_max!=null&&c>Number(bounds.credit_max)))){
     el('sim-results').innerHTML=`<div class="sim-alert">Crédito fora da faixa de referência: ${money(bounds.credit_min||0)} a ${money(bounds.credit_max||0)}. Ajuste o valor ou escolha outra opção.</div>`;return;
   }
   const fee=nval(el('sim-admin-fee').value),reserve=nval(el('sim-reserve-fee').value);
   if(!validNumber(fee,0,100)||!validNumber(reserve,0,100)){
     el('sim-results').innerHTML='<div class="sim-alert">Informe TA e fundo de reserva entre 0% e 100% para calcular.</div>';return;
   }
   const effective={...p,admin_fee_pct:fee,reserve_fund_pct:reserve};
   const month=nval(el('sim-contemplation').value);
   const legacyTermNotice=seg?.max_term_months&&p.term_months>Number(seg.max_term_months)
     ?`<div class="sim-alert" style="margin-bottom:12px">Prazo do plano (${fmt(p.term_months)} meses) excede a referência antiga do catálogo (${fmt(seg.max_term_months)}). Confirme a condição antes de ofertar.</div>`:'';
   let calc;
   try{calc=calculateConsortium(effective,c,{reduced50:reduced,contemplationMonth:month});}
   catch(e){el('sim-results').innerHTML=`<div class="sim-alert">${h(reduced?'Informe um mês hipotético entre 1 e '+(p.term_months-1)+'.':e.message)}</div>`;return;}
   const rawRate=el('sim-interest').value;
   const finInputs={assetValue:c,downPayment:0,monthlyRate:nval(rawRate),months:p.term_months,system:el('sim-system').value,monthlyCosts:0,upfrontCosts:0};
   let fin=null,finError='';
   if(rawRate!==''){try{fin=calculateFinancing(finInputs);}catch(e){finError=e.message;}}
   const cards=legacyTermNotice+outputCards([
     [reduced?'Parcela inicial reduzida':'Parcela inicial do consórcio',money(calc.first),
       (reduced?'50% da parcela-base + seguro integral':'Parcela-base + seguro integral')],
     [reduced?'Parcela após contemplação hipotética':'Última parcela do consórcio',
       money(reduced?calc.postContemplationFirst:calc.last),
       reduced?'Desde o mês '+(month+1)+' · saldo redistribuído':'Projeção sem contemplação assumida'],
     ['Total projetado do consórcio',money(calc.total),
       'TA '+pct(fee)+' · FR '+pct(reserve)+' · prestamista '+money(calc.prestamistaMonthlyAmount)+'/mês']
   ]);
   const deferredNote=reduced
     ?`<div class="sim-reduced-summary"><strong>50% até o mês ${fmt(month)} (hipótese)</strong><p>Valor adiado redistribuído: <b>${money(calc.deferredAmount)}</b>. O seguro não é reduzido. Sob essas hipóteses, o total desembolsado permanece ${money(calc.normalTotal)}, apenas distribuído de forma diferente. A contemplação e a regra comercial não são garantidas.</p></div>`:'';
   let comp='';
   if(fin){
     const max=Math.max(calc.total,fin.total,1),a=(calc.total/max*100).toFixed(1),b=(fin.total/max*100).toFixed(1);
     comp=`<div class="sim-comparison"><h3>Financiamento · ${h(fin.system)} · ${pct(fin.monthlyRate)} a.m.</h3>
       ${outputCards([['Parcela inicial',money(fin.first),'Mesmo crédito e prazo do consórcio'],['Parcela final',money(fin.last),fin.system==='SAC'?'SAC: amortização constante':'Price: parcela financeira uniforme'],['Desembolso total',money(fin.total),'Sem entrada, seguro, IOF ou CET']])}
       <div class="sim-bars"><div><span>Consórcio</span><i><b style="width:${a}%"></b></i><strong>${money(calc.total)}</strong></div><div><span>Financiamento</span><i><b class="finance" style="width:${b}%"></b></i><strong>${money(fin.total)}</strong></div></div>
       <small>Não equivale ao CET. Financiamento pressupõe concessão de crédito imediato após aprovação; no consórcio é preciso aguardar contemplação. Os totais não incorporam todos os custos contratuais, tributos e indexadores.</small></div>`;
   }else comp=`<div class="sim-hint">${h(finError||'Informe juros mensais para a comparação com financiamento.')}</div>`;
   el('sim-results').innerHTML=cards+deferredNote+comp;
   report={c:calc,f:finInputs,plan:effective,finance:fin,asset:c,credit:c,source:benchmarkForProduct(activeProduct())?.label||'Taxa informada pelo corretor'};
   el('sim-print').disabled=false;
 }
 product.addEventListener('change',()=>syncPlan());
 planSel.addEventListener('change',()=>{
   const p=ctx.plans.find(x=>x.id===planSel.value);
   if(p&&!opps.value&&(!credit.value||Number(credit.value)===autoCredit)&&p.reference_credit_amount!=null){
     credit.value=String(Number(p.reference_credit_amount));autoCredit=Number(p.reference_credit_amount);
   }
   syncPricing(p);syncRate();update();
 });
 opps.addEventListener('change',()=>{
   const o=ctx.opps.find(x=>x.id===opps.value);
   if(o){
     if(products.some(p=>p.id===o.product_id))product.value=o.product_id;
     credit.value=o.credit_amount||'';autoCredit=null;syncPlan();
   }else{credit.value='';autoCredit=null;syncPlan();}
 });
 root.addEventListener('input',e=>{
  if(e.target.matches('#sim-credit,#sim-admin-fee,#sim-reserve-fee,#sim-contemplation,#sim-interest'))update();
 });
 root.addEventListener('change',e=>{
  if(e.target.matches('#sim-payment-mode,#sim-system'))update();
 });
 el('sim-print').addEventListener('click',()=>{if(report)reportPopup(ctx,report);});
 const admin=el('sim-config-link');
 if(admin)admin.addEventListener('click',e=>{e.preventDefault();ctx.navigate('simulator-admin');});
 if(ctx.prefill){opps.value=ctx.prefill.id;credit.value=ctx.prefill.credit_amount||'';autoCredit=null;}
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
 ${numberField('Crédito de referência (R$)','adm-reference','step="0.01" min="1"','Sugestão de valor inicial; não representa mínimo ou máximo.')}
 ${numberField('Prazo em meses','adm-term','step="1" min="1" max="360" required')}
 ${numberField('Taxa de administração total (%)','adm-fee','required step="0.0001" min="0" max="100"')}
 ${numberField('Fundo de reserva total (%)','adm-reserve','required value="0" step="0.0001"')}
 ${numberField('Outros encargos totais (%)','adm-other','required value="0" step="0.0001"')}
 ${numberField('Taxa prestamista a.m. (fração)','adm-prestamista','required value="0" step="0.00001" min="0" max="0.05"','Ex.: 0.0003 corresponde a 0,03% ao mês sobre o crédito.')}
 ${numberField('Seguro mensal fixo adicional (R$)','adm-insurance','required value="0"','Preencha apenas se houver encargo fixo além do prestamista.')}
 ${numberField('Reajuste anual hipotético (%)','adm-adjustment','required value="0" step="0.0001" max="50"','Não é índice contratual automático; informe apenas se houver premissa validada.')}
 ${label('Origem e data da condição','adm-source','<input id="adm-source" maxlength="500" placeholder="Ex.: Tabela aprovada · 20/10/2026">','Obrigatório para liberar aos corretores.')}
 <div class="sim-approval"><label><input type="checkbox" id="adm-active"> Plano ativo</label><label><input type="checkbox" id="adm-approved"> Condições verificadas e liberadas pela Astrion</label></div>
 <div class="sim-form-actions"><button class="btn btn-primary" type="submit">Salvar parâmetros</button><button class="btn btn-outline" type="button" id="adm-new">Limpar formulário</button></div>
 </form></section>
 <section class="sim-card sim-admin-list"><h2>Planos cadastrados</h2><p class="sim-help">Clique em um plano para editar. Todos os planos ficam restritos à administração enquanto não forem liberados.</p>
 ${plans.length?plans.map(p=>`<button class="sim-plan-row" data-edit-plan="${h(p.id)}" type="button"><strong>${h(productTitle(ctx,p.product_id))} · ${h(p.name)}</strong><small>${fmt(p.term_months)} meses · TA ${pct(p.admin_fee_pct)} · FR ${pct(p.reserve_fund_pct)} · Prestamista ${pct(Number(p.prestamista_rate_monthly||0)*100)} a.m.</small><em class="${p.active&&p.approved_for_use?'ready':'draft'}">${p.active&&p.approved_for_use?'Disponível':'Não publicado'}</em></button>`).join(''):'<div class="sim-empty">Nenhum plano cadastrado. Inclua as condições aprovadas dos produtos.</div>'}
 </section></div>`;
 const e=id=>root.querySelector('#'+id), form=e('sim-admin-form');
 function groups(current){const p=e('adm-product').value; e('adm-group').innerHTML=option('','Sem grupo específico',current)+groupList(ctx,p).map(g=>option(g.code,'Grupo '+g.code,current)).join('');}
 function reset(){form.reset();e('adm-id').value='';e('adm-product').value=products[0]?.id||'';for(const id of ['adm-reserve','adm-other','adm-insurance','adm-prestamista','adm-adjustment'])e(id).value=0;groups('');}
 function edit(id){
  const p=plans.find(x=>x.id===id);if(!p)return;
  e('adm-id').value=p.id;e('adm-product').value=p.product_id;groups(p.group_code||'');
  for(const [key,v] of [['name',p.name],['reference',p.reference_credit_amount],['term',p.term_months],['fee',p.admin_fee_pct],['reserve',p.reserve_fund_pct],['other',p.other_total_pct],['prestamista',p.prestamista_rate_monthly],['insurance',p.insurance_monthly_amount],['adjustment',p.annual_adjustment_pct],['source',p.source_label]])e('adm-'+key).value=v??'';
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
    reference_credit_amount:e('adm-reference').value===''?null:nval(e('adm-reference').value),
    term_months:Number(e('adm-term').value),admin_fee_pct:nval(e('adm-fee').value),
    reserve_fund_pct:nval(e('adm-reserve').value),other_total_pct:nval(e('adm-other').value),
    insurance_monthly_amount:nval(e('adm-insurance').value),prestamista_rate_monthly:nval(e('adm-prestamista').value),
    annual_adjustment_pct:nval(e('adm-adjustment').value),
    source_label:e('adm-source').value.trim(),active:e('adm-active').checked,approved_for_use:e('adm-approved').checked,
    updated_at:new Date().toISOString()};
  const seg=productSegment(ctx,productId);
  if(!data.name||data.name.length<3||!Number.isInteger(data.term_months)||!validNumber(data.term_months,1,360)
   ||!validNumber(data.admin_fee_pct,0,100)||!validNumber(data.reserve_fund_pct,0,100)
   ||!validNumber(data.other_total_pct,0,100)||!validNumber(data.insurance_monthly_amount,0,1e6)
   ||!validNumber(data.prestamista_rate_monthly,0,0.05)
   ||(data.reference_credit_amount!=null&&!validNumber(data.reference_credit_amount,1,1e10))
   ||!validNumber(data.annual_adjustment_pct,0,50)){
    ctx.toast('Revise os campos e limites dos parâmetros comerciais.',true);return;
  }
  // Os prazos legados do catálogo são informativos; não bloquear plano referencial aprovado apenas por discrepância histórica.
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
