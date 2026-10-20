/* ÓRBITA | Regras referenciais extraídas de "Treinamento atualizado(1).pptm" (25 slides).
   A lista de grupos e modalidades NÃO confirma disponibilidade atual de grupo nem a
   concessão de cotas. Em caso de dúvida, bloquear condições especiais. */
export const TRAINING_VERSION='Treinamento atualizado · slides 3, 5, 7–8, 11–19, 21 e 24';
export const KEY_AUTO_GROUPS=Object.freeze(['462','463','527','529','535','540','541','575','617','619']);
export const KEY_HEAVY_GROUPS=Object.freeze(['1004','1005']);
export const GROUPS_IN_TRAINING=Object.freeze({
 'Imóveis':['5001','700','704','705','706','707','708'],
 'Automóveis':['462','463','527','529','535','540','541','575','578','617','619','720'],
 'Motos':['462','463','527','529','535','540','541','575','617','619'],
 'Pesados':['1004','1005','1008']
});
const knownPlans=Object.freeze({
 '578':['normal','half','seventy'],'720':['normal','half','seventy'],
 '700':['normal'],'5001':['normal'],
 '704':['normal','half','seventy'],'705':['normal','half','seventy'],
 '706':['normal','half','seventy'],'707':['normal','half','seventy'],
 '708':['normal','half','seventy'],
 '1004':['normal'],'1005':['normal'],'1008':['normal']
});
export function groupOptions(category,catalogGroups=[]){
 const seen=new Set(),arr=[];
 for(const g of catalogGroups||[]){
   const code=String(g.code||'');
   if(code&&!seen.has(code)){seen.add(code);arr.push({code,confirmed:!!g.confirmed_by_partner,source:'Catálogo do Órbita'});}
 }
 for(const code of GROUPS_IN_TRAINING[category]||[]){
   if(!seen.has(code)){seen.add(code);arr.push({code,confirmed:false,source:'Somente no treinamento'});}
 }
 return arr.sort((a,b)=>Number(a.code)-Number(b.code));
}
export function groupPlanPolicy(groupCode,mode){
 const known=knownPlans[String(groupCode||'')];
 if(!mode||mode==='normal')return {allowed:true,verified:!!known,reason:''};
 if(!known)return {allowed:true,verified:false,reason:'Modalidade genérica do treinamento; sem validação para este grupo.'};
 if(known.includes(mode))return {allowed:true,verified:false,reason:'Modalidade citada no treinamento, sujeita à confirmação do grupo.'};
 return {allowed:false,verified:false,reason:'O treinamento não associa essa modalidade de parcela ao grupo selecionado.'};
}
export function biddingPolicy(category,groupCode,mode,paidOnTimeMonths=0){
 const group=String(groupCode||''),heavy=category==='Pesados',imovel=category==='Imóveis';
 const auto=category==='Automóveis'||category==='Motos';
 const onTime=Number(paidOnTimeMonths)||0;
 const none={allowed:true,embeddedAllowed:false,fixedPercent:null,reason:''};
 if(!mode||mode==='none')return none;
 if(!['livre','limitado','fixo30','fixo25','fixo50','fidelidade25','quitacao'].includes(mode))
  return {...none,allowed:false,reason:'Modalidade de lance desconhecida.'};
 const result={allowed:true,embeddedAllowed:false,fixedPercent:null,reason:'',maxPercent:100};
 if(mode==='limitado'){result.maxPercent=60;result.reason='Lance limitado a 60% do crédito; critérios de desempate por pedra-chave.';}
 if(mode==='fixo30'){result.fixedPercent=30;if(heavy){result.allowed=false;result.reason='Grupos pesados utilizam lance fixo de 25% no treinamento.';}}
 if(mode==='fixo25'){result.fixedPercent=25;if(!heavy){result.allowed=false;result.reason='Lance fixo 25% referenciado apenas para pesados.';}}
 if(mode==='fixo50'){
   result.fixedPercent=50;
   if(!(auto&&['578','720'].includes(group))){result.allowed=false;result.reason='Lance fixo 50% exclusivo para grupos 578/720 e vendas estruturadas/investidores.';}
   else result.reason='Somente vendas estruturadas ou cotas de investidores; elegibilidade deve ser confirmada.';
 }
 if(mode==='fidelidade25'){
   result.fixedPercent=25;
   if(onTime<6){result.allowed=false;result.reason='Fidelidade exige ao menos 6 parcelas pagas em dia.';}
   if(group==='708'&&![6,12,18,24].some(k=>onTime>=k))
    {result.allowed=false;result.reason='Grupo 708 prevê fidelidade a partir de 6 parcelas pagas em dia.';}
 }
 if(group==='708'){
   // Slide 18: lance livre não permite embutido; lance fixo 30 permite.
   if(mode==='fixo30')result.embeddedAllowed=true;
   if(mode==='quitacao')result.reason='Quitação tem prioridade na modalidade de lance livre do grupo 708.';
 }else if(group==='1008'){result.embeddedAllowed=false;result.reason='Grupo 1008: treinamento exclui lance embutido.';}
 else if(mode==='livre'){
   if(group&&(imovel||auto||heavy))result.embeddedAllowed=true;
   if(!group)result.reason='Selecione grupo para verificar possibilidade de lance embutido.';
 }
 if(mode==='quitacao'&&(!group||group==='708'))result.reason='Quitação depende do saldo devedor e da ordem de assembleia.';
 if(!group&&mode!=='none'&&!result.reason)result.reason='Grupo não informado. Modalidade deve ser validada antes da oferta.';
 return result;
}
export function calculateBidScenario(args={}){
 const credit=Number(args.credit),category=String(args.category||''),group=String(args.groupCode||'');
 const mode=String(args.mode||'none'),pct=Number(args.bidPercent??0);
 const embedPct=Number(args.embeddedPercent??0),fgts=Number(args.fgtsAmount??0);
 const key=Number(args.keyAppraisedValue??0);
 const paid=Number(args.paidOnTimeMonths??0),planMode=String(args.planMode||'normal');
 const application=String(args.application||'inverse');
 const errors=[],warnings=[];
 if(!Number.isFinite(credit)||credit<=0||credit>1e10)errors.push('Crédito inválido.');
 for(const [name,value] of [['Percentual de lance',pct],['Percentual embutido',embedPct],['FGTS',fgts],['Valor do bem para troca de chaves',key]]){
   if(!Number.isFinite(value)||value<0)errors.push(name+' não pode ser negativo.');
 }
 if(!['inverse','next3','dilute'].includes(application))errors.push('Forma de abatimento do lance inválida.');
 const groupKnown=!!group;
 const policy=biddingPolicy(category,group,mode,paid);
 if(!policy.allowed)errors.push(policy.reason);
 const planSeventy=planMode==='seventy';
 const planEmbedded=planSeventy?credit*.30:0;
 const effectiveEmbedded=planSeventy?planEmbedded:credit*embedPct/100;
 const total=credit*pct/100;
 if(mode==='none'&&(pct||embedPct||fgts||key))errors.push('Selecione uma modalidade de lance antes de informar os valores.');
 if(mode!=='none'&&(!Number.isFinite(pct)||pct<=0||pct>100))errors.push('Informe percentual de lance maior que 0 e até 100%.');
 if(policy.fixedPercent!=null&&Math.abs(pct-policy.fixedPercent)>.0001)errors.push('Esta modalidade exige lance fixo de '+policy.fixedPercent+'%.');
 if(policy.maxPercent!=null&&pct>policy.maxPercent+1e-8)errors.push('A modalidade permite percentual máximo de '+policy.maxPercent+'%.');
 if(embedPct>30+1e-8)errors.push('O lance embutido indicado no treinamento tem máximo referencial de 30% do crédito.');
 if(planSeventy&&embedPct>0)errors.push('Plano 70% já considera 30% embutido: não some outro lance embutido.');
 if(planSeventy&&mode!=='none'&&pct<30)errors.push('Plano 70% exige oferta de lance de ao menos 30% para cobrir a parcela embutida do cenário.');
 if(!planSeventy&&embedPct>0&&!policy.embeddedAllowed)errors.push('Lance embutido não autorizado nesta modalidade/grupo pelo treinamento.');
 if(planSeventy&&mode!=='none'&&!policy.embeddedAllowed)errors.push('A modalidade/grupo selecionada não permite lance embutido para o plano 70%.');
 if(fgts>0&&category!=='Imóveis')errors.push('FGTS para lance foi citado apenas no segmento Imóveis.');
 if(fgts>0)warnings.push('Uso de FGTS depende de enquadramento legal, regras do grupo e documentação.');
 const auto=(category==='Automóveis'||category==='Motos');
 const heavy=category==='Pesados';
 const keyEligible=(auto&&KEY_AUTO_GROUPS.includes(group))||(heavy&&KEY_HEAVY_GROUPS.includes(group));
 let keyLimit=0;
 if(key>0){
   if(!keyEligible)errors.push('Troca de chaves indisponível para este grupo/segmento no treinamento.');
   if(heavy&&mode!=='livre')errors.push('Pesados: troca de chaves apenas após contemplação por lance livre.');
   if(embedPct>0||planSeventy)errors.push('Troca de chaves não pode ser combinada com lance embutido.');
   if(mode==='none')errors.push('Troca de chaves exige oferta de lance.');
   keyLimit=auto?total*.5:credit*.5;
   if(key>keyLimit+1e-7)errors.push(auto?'Auto/moto: até 50% do lance pode ser coberto por troca de chaves.':'Pesados: troca de chaves limitada a 50% do crédito.');
   warnings.push('Troca de chaves: documento em nome do cotista em até 24h da assembleia, avaliação pela tabela aplicável e eventual diferença em até 48 horas úteis. O bem apresentado reduz o crédito líquido destinado à compra.');
 }
 if(mode==='none'&&planSeventy)warnings.push('O plano 70% prevê 30% de crédito reservado ao lance, mas a oferta efetiva exige seleção da modalidade.');
 if(group&&!policy.embeddedAllowed&&embedPct===0&&!key)warnings.push('Modalidades de lance e regras devem ser confirmadas com a administradora.');
 if(!group&&mode!=='none')warnings.push('Grupo não selecionado: condições especiais não são consideradas elegíveis.');
 const cash=Math.max(0,total-effectiveEmbedded-fgts-key);
 if(mode!=='none'&&total+1e-7<effectiveEmbedded+fgts+key)errors.push('Recursos ofertados superam o valor total do lance.');
 const netCredit=credit-effectiveEmbedded-key;
 if(netCredit<0)errors.push('O lance embutido e a troca de chaves ultrapassam o crédito.');
 return {
   errors,warnings,policy,eligible:errors.length===0,groupKnown,
   bidAmount:mode==='none'?0:total,embeddedAmount:effectiveEmbedded,
   ownResourcesAmount:mode==='none'?0:cash,fgtsAmount:fgts,keyAmount:key,
   keyLimit,keyEligible,credit,netCredit,group,mode,planSeventy,
   application,applicationLabel:({inverse:'Ordem inversa (últimas parcelas)',next3:'Três próximas parcelas',dilute:'Diluição do lance'})[application],
   upfrontReductionNet:effectiveEmbedded+key,paidOnTimeMonths:paid
 };
}
export function supplementaryConditions(category){
 const common=['Lance deve ser ofertado até as 18h do dia de sorteio, conforme material de treinamento.','Prazo orientativo para pagamento: dois dias úteis após contemplação por lance.','Abatimento de lance por ordem inversa, próximas três parcelas ou diluição depende de regras do grupo.'];
 if(category==='Imóveis')return [...common,'FGTS poderá compor oferta de lance se atender requisitos legais e operacionais.','Junção de cotas contempladas é citada; reforma estrutural possui desembolso por cronograma da obra.','Correção anual do grupo: INCC conforme treinamento; índice e periodicidade precisam de validação.'];
 if(category==='Pesados')return [...common,'Máquinas/equipamentos requerem chassi ou número de série; troca de chaves só nos grupos 1004/1005 após lance livre.','Correção referencial: IGP-M ou fabricante, dependendo do bem e do grupo.'];
 if(category==='Automóveis'||category==='Motos')return [...common,'Troca de chaves somente nos grupos citados, com documento do bem em nome do cotista até 24h.','No treinamento, créditos livres corrigidos pelo IGP-M ou tabela do fabricante conforme bem.','Para usados, conferir limites de idade; a junção de cotas pode exigir contemplação de todas.'];
 if(category==='Outros')return [...common,'Outros bens: material indica ausência de correção do crédito; validar regra do grupo.','Acima de R$ 30 mil, o treinamento exige bem em garantia; verificar fiador e análise.'];
 if(category==='Serviços')return [...common,'Serviços: comprovação de renda de 4x a parcela e fiador/garantia conforme treinamento.','Crédito corrigido por IGP-M conforme treinamento; limite de prazo anterior de 36 meses precisa ser conferido.'];
 return common;
}
