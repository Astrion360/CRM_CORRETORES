import { openDocument } from './documents.js';
const cfg = window.ASTRION_CRM_CONFIG || {};
const validConfig = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.SUPABASE_URL || '') &&
  !!cfg.SUPABASE_PUBLISHABLE_KEY && !/SUBSTITUA|SEU-PROJETO/.test(cfg.SUPABASE_PUBLISHABLE_KEY);
let sb = null;
if (validConfig) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
  sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');
const stages = { rascunho:'Rascunho', enviada:'Enviada à Astrion', triagem:'Triagem', em_cotacao:'Pesquisa de condições', pendencia:'Dados complementares', cotada:'Devolutiva disponível', em_negociacao:'Em negociação', contratada:'Contratada', encerrada:'Encerrada' };
const dealStageOrder = Object.keys(stages);
const commercialStages = ['rascunho','enviada'];
const state = { user:null, profile:null, profiles:[],products:[],catalogSegments:[],catalogGroups:[],dispatches:[],quoteCache:{},clients:[],opps:[],page:'dashboard',
  filterBroker:'all',filterProduct:'all',filterStage:'all',search:'',loading:false,detail:null,authMode:'login',interval:null };
const H = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRL = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0);
const N = v => new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const date = v => v ? new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const dateTime = v => v ? new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—';
const initials = text => (text||'A').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const isAdmin = () => state.profile?.role === 'admin';
const myName = () => state.profile?.full_name || state.profile?.email || 'Usuário';
const brokerName = id => state.profiles.find(p=>p.id===id)?.full_name || 'Corretor';
const actorName = id => state.profiles.find(p=>p.id===id)?.full_name || 'Equipe';
const productName = id => state.products.find(p=>p.id===id)?.name || 'Produto indisponível';
const clientName = id => state.clients.find(c=>c.id===id)?.full_name || 'Cliente indisponível';
const safe = err => err?.message || 'Ocorreu uma falha. Tente novamente.';
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function toast(message,err=false){ toastRoot.innerHTML=`<div class="toast ${err?'error':''}">${H(message)}</div>`; window.clearTimeout(toast._timer); toast._timer=setTimeout(()=>toastRoot.innerHTML='',4700); }
function opt(value,label,selected){return `<option value="${H(value)}" ${String(value)===String(selected)?'selected':''}>${H(label)}</option>`;}
function statusBadge(stage){return `<span class="badge-status stage-${H(stage)}">${H(stages[stage]||stage)}</span>`;}
function empty(message='Nenhum registro encontrado.'){return `<div class="empty"><div class="empty-symbol">◇</div><strong>${H(message)}</strong><div class="muted">Ajuste os filtros ou adicione um novo registro.</div></div>`;}
function selectBrokers(current='all',withAll=true){return (withAll?opt('all','Todos os corretores',current):'') + state.profiles.filter(p=>p.role==='broker'&&(p.active||p.id===current)).map(p=>opt(p.id,p.full_name||p.email,current)).join('');}
function activeProducts(current){return state.products.filter(p=>p.active||p.id===current).map(p=>opt(p.id,p.name,current)).join('');}
function field(name,label,value='',attrs=''){return `<div class="form-group"><label for="${H(name)}">${H(label)}</label><input class="field" name="${H(name)}" id="${H(name)}" value="${H(value)}" ${attrs}></div>`;}
function formSelect(name,label,options,attrs=''){return `<div class="form-group"><label for="${H(name)}">${H(label)}</label><select class="field" name="${H(name)}" id="${H(name)}" ${attrs}>${options}</select></div>`;}
function formArea(name,label,value=''){return `<div class="form-group full"><label for="${H(name)}">${H(label)}</label><textarea class="field" name="${H(name)}" id="${H(name)}" maxlength="1500">${H(value)}</textarea></div>`;}
function setModal(title,body,footer='',wide=false){modalRoot.innerHTML=`<div class="modal-overlay" data-backdrop="1"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${H(title)}"><div class="modal-head"><h2>${H(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fechar">×</button></div>${body}<div class="modal-footer">${footer||'<button type="button" class="btn btn-outline" data-action="close-modal">Fechar</button>'}</div></div></div>`;}
function closeModal(){modalRoot.innerHTML='';state.detail=null;}
function returnHome(){closeModal();state.page='dashboard';state.search='';renderShell();window.scrollTo({top:0,behavior:'smooth'});}
window.addEventListener('message',e=>{if(e.origin===window.location.origin&&e.data?.type==='astrion:return-home'&&state.user)returnHome();});
function renderConfig(){app.innerHTML=`<div class="login-wrap"><section class="login-left"><div class="brand login-logo"><img src="./assets/orbita-wordmark-navy.svg" class="orbita-wordmark-login" alt="ÓRBITA by Astrion"></div><div class="login-inner"><span class="eyebrow">Configuração inicial</span><h1>Conectar ao Supabase</h1><p>Interface preparada. Para autenticar usuários e carregar dados reais, preencha o arquivo <strong>config.js</strong> com a URL do projeto e a chave publicável.</p><div class="notice">Não adicione a chave secreta ou service_role neste arquivo. Consulte o README para configurar o projeto e os usuários.</div></div><small class="login-foot">ÓRBITA · Ambiente não conectado</small></section><aside class="login-right"><div class="hero-panel"><div class="eyebrow">ÓRBITA · BY ASTRION</div><h2>Conexões em movimento.</h2><p>Corretores, clientes e oportunidades conectados em uma só plataforma.</p>${loginMock()}</div></aside></div>`;}
function loginMock(){
 return `<div class="dream-hero" aria-label="Ilustração de imóvel e veículo, representando conquistas planejadas">
 <div class="dream-hero-image" role="img" aria-label="Casa moderna e veículo à luz do entardecer"></div>
 <div class="dream-hero-bottom"><div class="dream-symbol"><span>⌂</span><span>◇</span><span>✧</span></div><div><strong>Grandes conquistas começam com escolhas bem acompanhadas.</strong><small>Imóveis · Veículos · Serviços · Outros bens</small></div></div>
 </div><div class="dream-steps" aria-label="Etapas do atendimento"><span><b>01</b> Solicitação</span><i></i><span><b>02</b> Análise</span><i></i><span><b>03</b> Cotação</span><i></i><span><b>04</b> Devolutiva</span></div>`;
}

function loginIcon(name){
 const shapes={
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 eye:'<path d="M2 12s3.7-6.5 10-6.5S22 12 22 12s-3.7 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2.2 2.2L16 9.5"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 house:'<path d="m3 10 9-8 9 8v11h-7v-7H10v7H3Z"/>',
 car:'<path d="M5 17H3v-6l3-6h12l3 6v6h-2"/><path d="M5 17h14M3 11h18M7 17v3M17 17v3"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>',
 gear:'<path d="M12 3.1 14 2l1.1 2.5 2.4.8 2.5-1 1.8 3.2-2 1.7.2 2.7 2.2 1.5-1.8 3.2-2.6-.8-2.2 1.4L14 22h-4l-.8-2.8-2.3-1.3-2.7.8-1.8-3.2 2.2-1.7v-2.7L2.3 9.5 4.1 6.3l2.6.8L9 5.6 10 3Z"/><circle cx="12" cy="12" r="3"/>',
 plane:'<path d="M22 2 9.7 14.3 4 12l-2 2 6.9 3.1L12 24l2-2-2.3-5.7L24 4l-2-2Z"/><path d="m11 6 4.6 4.6"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 6 6"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
 };
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||''}</svg>`;
}
function renderAuth(){if(!validConfig){renderConfig();return;}
 const mode=state.authMode;
 const isLogin=mode==='login';
 const isFirst=mode==='firstpass';
 const isRecovery=mode==='recovery';
 const newPassword=mode==='newpass'||isFirst;
 const title=isLogin?'Bem-vindo à<br><span class="brand-blue">ÓRBITA</span>':isFirst?'Troca obrigatória<br><span class="brand-blue">de senha</span>':isRecovery?'Recuperar<br><span class="brand-blue">acesso</span>':'Definir<br><span class="brand-blue">nova senha</span>';
 const helper=isLogin?'Sua plataforma de relacionamento, oportunidades e cotações, com o apoio da Astrion em cada etapa.':isFirst?'Substitua sua senha provisória para liberar o acesso à sua carteira.':isRecovery?'Informe seu e-mail para receber o link de recuperação de acesso.':'Defina sua nova senha para continuar usando a ÓRBITA.';
 const fieldEmail=!(newPassword)?`<div class="login-field-group"><label for="email">E-mail</label><div class="login-field-wrap">${loginIcon('mail')}<input class="field" id="email" type="email" autocomplete="email" placeholder="Seu e-mail corporativo" required></div></div>`:'';
 const fieldPassword=!isRecovery?`<div class="login-field-group"><label for="password">${newPassword?'Nova senha':'Senha'}</label><div class="login-field-wrap">${loginIcon('lock')}<input class="field" id="password" type="password" autocomplete="${newPassword?'new-password':'current-password'}" ${newPassword?'minlength="12"':''} placeholder="${newPassword?'Mínimo de 12 caracteres':'Sua senha'}" required><button type="button" class="password-toggle" data-action="toggle-login-password" aria-label="Mostrar senha" aria-pressed="false" title="Mostrar ou ocultar senha">${loginIcon('eye')}</button></div></div>`:'';
 const fieldConfirm=isFirst?`<div class="login-field-group"><label for="password_confirm">Confirmar nova senha</label><div class="login-field-wrap">${loginIcon('lock')}<input class="field" id="password_confirm" type="password" autocomplete="new-password" minlength="12" placeholder="Repita sua nova senha" required></div></div>`:'';
 const buttonText=isLogin?'Entrar no sistema':isRecovery?'Enviar link de recuperação':isFirst?'Alterar senha e continuar':'Salvar nova senha';
 const textActions=isLogin?'<button class="link-button" data-action="forgot" type="button">Esqueci minha senha</button>':isRecovery?'<button class="link-button" data-action="back-login" type="button">Voltar ao login</button>':isFirst?'<button class="link-button" data-action="logout" type="button">Sair da conta</button>':'';
 const assurance=`<div class="login-assurance" aria-label="Segurança do portal">
   <div class="assurance-item">${loginIcon('shield')}<span>Acesso<br>seguro</span></div>
   <div class="assurance-item">${loginIcon('users')}<span>Uso exclusivo<br>para corretores</span></div>
   <div class="assurance-item">${loginIcon('lock')}<span>Dados protegidos<br>e confidenciais</span></div>
 </div>`;
 const category=(symbol,name,desc)=>`<div class="reference-card" tabindex="0">${loginIcon(symbol)}<strong>${name}</strong><small>${desc}</small></div>`;
 const step=(symbol,label,desc)=>`<div class="reference-step">${loginIcon(symbol)}<strong>${label}</strong><small>${desc}</small></div>`;
 app.innerHTML=`<div class="login-wrap astrion-reference-login">
  <section class="login-left">
   <div class="reference-brand orbita-login-brand"><img class="orbita-wordmark" src="./assets/orbita-wordmark-navy.svg" alt="ÓRBITA by Astrion" width="812" height="200"></div>
   <div class="login-inner">
    <span class="eyebrow">PORTAL RESTRITO · ACESSO SEGURO</span>
    <h1>${title}</h1>
    <p>${helper}</p>
    <form class="login-form" id="auth-form" data-form="${mode}">${fieldEmail}${fieldPassword}${fieldConfirm}<button class="btn btn-primary" type="submit">${buttonText} &nbsp;→</button></form>
    <div class="auth-link">${textActions}</div>
    ${assurance}
   </div>
   <small class="login-foot">© ${new Date().getFullYear()} Astrion Assessoria. Todos os direitos reservados.<br>Uso interno e parceiros autorizados.</small>
  </section>
  <aside class="login-right" aria-label="Consórcios, planejamento e realizações">
   <div class="reference-scenery"><img class="reference-scenery-image orbita-universe-image" src="./assets/orbita-art-emblematica-v6.svg" alt="" aria-hidden="true" width="1200" height="940" loading="eager" decoding="async"></div>
   <div class="reference-hero-top">
    <div class="eyebrow">CORRETORES · CLIENTES · OPORTUNIDADES</div>
    <h2>Conexões<br><span class="title-gradient">em movimento.</span></h2>
    <p>Uma órbita comercial para transformar planos em conquistas. Organização, inteligência e acompanhamento com a Astrion.</p>
    <div class="reference-accent"></div>
   </div>
   <div class="reference-cards" aria-label="Modalidades de consórcio">
    ${category('house','Imóveis','Casas, apartamentos, terrenos e muito mais.')}
    ${category('car','Veículos','Carros, motos, pesados e máquinas.')}
    ${category('gear','Outros Bens','Equipamentos, eletrônicos e soluções.')}
    ${category('plane','Serviços','Viagens, educação, procedimentos e mais.')}
   </div>
   <div class="reference-bottom" aria-label="Etapas da solicitação">
    ${step('file','Solicitação','Você registra a oportunidade')}
    ${step('search','Análise','Nossa equipe avalia o cenário')}
    ${step('file','Cotação','Solicitamos à administradora')}
    ${step('check','Devolutiva','Você recebe as opções organizadas')}
    <div class="reference-signature">Relacionamentos<br>que giram<br>resultados.</div>
   </div>
  </aside>
 </div>`;
}
function sidebar(){const menus=[['dashboard','▦','Visão geral'],['clients','♙','Clientes'],['opportunities','◈','Solicitações'],...(isAdmin()?[['brokers','◉','Corretores'],['catalog','▤','Catálogo / Grupos'],['dispatches','▣','Envios à Âncora'],['products','◈','Categorias']]:[])];
  return `<aside class="sidebar" id="sidebar"><div class="sidebar-brand orbita-sidebar-brand"><img src="./assets/orbita-wordmark-light.svg" class="orbita-sidebar-wordmark" alt="ÓRBITA by Astrion" width="812" height="200"><span class="orbita-sidebar-caption">Conexões em movimento.</span></div><span class="side-section">GESTÃO COMERCIAL</span><nav aria-label="Navegação principal">${menus.map(([key,ic,label])=>`<button class="nav-item ${state.page===key?'active':''}" data-nav="${key}"><span class="nav-icon">${ic}</span>${label}</button>`).join('')}</nav><div class="side-foot"><div class="side-user"><span class="avatar">${H(initials(myName()))}</span><div><strong>${H(myName())}</strong><small>${isAdmin()?'Administrador':'Corretor autorizado'}</small></div></div><button class="signout" data-action="change-password">Alterar minha senha</button><button class="signout" data-action="logout">Sair da conta ↗</button></div></aside>`;}
function renderShell(){const pageTitles={dashboard:'Visão geral',clients:'Carteira de clientes',opportunities:'Solicitações de cotação',brokers:'Rede de corretores',catalog:'Produtos / Regras',dispatches:'Envios à Âncora',products:'Categorias de bens'};
  app.innerHTML=`<div class="layout">${sidebar()}<main class="main"><div class="topbar"><div class="topbar-left"><button class="btn btn-ghost mobile-menu" data-action="menu">☰</button><div><span class="eyebrow">ÓRBITA / ASTRION</span><div class="topbar-title">${H(pageTitles[state.page]||'ÓRBITA')}</div></div></div><div class="topbar-actions"><span class="last-sync">Acesso restrito · Supabase</span><button class="home-shortcut" data-action="go-home">⌂ &nbsp; Início</button><button class="btn btn-outline btn-sm" data-action="refresh">↻ &nbsp;Atualizar</button></div></div><div class="content" id="page-root"></div></main></div>`;
  renderPage();
}
function visibleOpps(){return state.opps.filter(o=>(state.filterBroker==='all'||o.owner_id===state.filterBroker)&&(state.filterProduct==='all'||o.product_id===state.filterProduct)&&(state.filterStage==='all'||o.stage===state.filterStage));}
function matches(q,text){return !q||String(text||'').toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR'));}
function pageHead(title,desc,buttons=''){return `<div class="page-head"><div><h1>${H(title)}</h1><p>${H(desc)}</p></div><div class="page-actions">${buttons}</div></div>`;}
function filters(mode){return `<form class="filterbar" id="filter-form" data-form="filters"><input class="field search" name="search" placeholder="Buscar nome, cliente ou produto..." value="${H(state.search)}" aria-label="Buscar">${isAdmin()?`<select class="filter-control" name="broker" aria-label="Filtrar corretor">${selectBrokers(state.filterBroker)}</select>`:''}<select class="filter-control" name="product" aria-label="Filtrar produto">${opt('all','Todos os produtos',state.filterProduct)}${state.products.map(p=>opt(p.id,p.name,state.filterProduct)).join('')}</select>${mode==='opportunities'?`<select class="filter-control" name="stage" aria-label="Filtrar etapa">${opt('all','Todas as etapas',state.filterStage)}${dealStageOrder.map(k=>opt(k,stages[k],state.filterStage)).join('')}</select>`:''}<button class="btn btn-outline" type="submit">Aplicar filtros</button>${state.search||state.filterBroker!=='all'||state.filterProduct!=='all'||state.filterStage!=='all'?'<button type="button" class="btn btn-ghost" data-action="clear-filters">Limpar</button>':''}</form>`;}
function statistic(label,value,sub){return `<div class="stat-card"><div class="stat-label">${H(label)}</div><div class="stat-number">${H(value)}</div><div class="stat-foot">${H(sub)}</div></div>`;}
function renderDashboard(){const oo=visibleOpps();const owners=new Set(oo.map(o=>o.owner_id));const clientIds=new Set(oo.map(o=>o.client_id));
  const cc=state.clients.filter(c=>state.filterBroker==='all'||c.owner_id===state.filterBroker);
  const filteredClients=state.filterProduct==='all'?cc:cc.filter(c=>clientIds.has(c.id));
  const credit=oo.reduce((a,o)=>a+Number(o.credit_amount),0);
  const completed=oo.filter(o=>o.stage==='contratada').length;
  const recent=[...oo].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,5);
  const stageTotals=dealStageOrder.map(k=>({key:k,count:oo.filter(o=>o.stage===k).length}));
  const products=state.products.map(p=>({name:p.name,count:oo.filter(o=>o.product_id===p.id).length})).sort((a,b)=>b.count-a.count).slice(0,6);
  const brokerList=state.profiles.filter(p=>p.role==='broker').map(p=>({p,deals:oo.filter(o=>o.owner_id===p.id)})).sort((a,b)=>b.deals.length-a.deals.length);
  document.querySelector('#page-root').innerHTML=`${pageHead(isAdmin()?'Painel de solicitações':'Minhas solicitações',isAdmin()?'Indicadores consolidados com filtros por corretor, produto e evolução de propostas.':'Envie pedidos de cotação, consulte as condições encontradas e acompanhe cada atendimento.','<button class="btn btn-outline" data-action="new-client">+ Cliente</button><button class="btn btn-primary" data-action="new-opp">+ Solicitação</button>')}${filters('dashboard')}<div class="stat-grid">${statistic('Clientes na carteira',N(filteredClients.length),'Cadastros com base legal registrada')}${statistic('Solicitações',N(oo.length),'Pedidos de condições em todas as etapas')}${statistic('Crédito solicitado',BRL(credit),'Crédito solicitado (não é receita)')}${statistic('Contratações',N(completed),'Convertidas em contratos')}</div><div class="two-cols"><section class="panel"><div class="panel-head"><div><h3 class="panel-title">Fila de atendimento</h3><div class="panel-sub">Distribuição por etapa da jornada comercial</div></div><span class="count-pill">${N(oo.length)} pedidos</span></div>${stageTotals.map(x=>`<div class="segment"><div class="segment-line"><strong>${H(stages[x.key])}</strong><span>${N(x.count)} · ${oo.length?Math.round(x.count/oo.length*100):0}%</span></div><div class="bar-track"><div class="bar-fill ${['cotada','contratada'].includes(x.key)?'green':''}" style="width:${oo.length?x.count/oo.length*100:0}%"></div></div></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><h3 class="panel-title">Por categoria</h3><div class="panel-sub">Tipos de bens solicitados</div></div></div>${products.length?products.map(p=>`<div class="segment"><div class="segment-line"><strong>${H(p.name)}</strong><span>${N(p.count)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${oo.length?p.count/oo.length*100:0}%"></div></div></div>`).join(''):empty('Sem solicitações nesta categoria')}<div class="divider"></div><div class="panel-label">Pendências do funil</div><div class="summary-line"><span>Pesquisando condições</span><strong>${N(oo.filter(o=>o.stage==='em_cotacao').length)}</strong></div><div class="summary-line"><span>Dados complementares</span><strong>${N(oo.filter(o=>o.stage==='pendencia').length)}</strong></div><div class="summary-line"><span>Ações vencidas</span><strong>${N(oo.filter(o=>o.next_action_at&&o.next_action_at<today()&&!['contratada','encerrada'].includes(o.stage)).length)}</strong></div></section></div>${isAdmin()?`<section class="panel section-short"><div class="panel-head"><div><h3 class="panel-title">Desempenho por corretor</h3><div class="panel-sub">Carteira, propostas e crédito potencial por responsável</div></div><button class="btn btn-outline btn-sm" data-action="export">↓ Exportar CSV</button></div><div class="table-scroll"><table><thead><tr><th>Corretor</th><th>Oportunidades</th><th>Crédito potencial</th><th>Em pesquisa</th><th>Contratadas</th><th>Situação</th></tr></thead><tbody>${brokerList.map(({p,deals})=>`<tr><td><span class="cell-title">${H(p.full_name)}</span><div class="cell-sub">${H(p.company)}</div></td><td>${N(deals.length)}</td><td>${BRL(deals.reduce((a,o)=>a+Number(o.credit_amount),0))}</td><td>${N(deals.filter(o=>['enviada','triagem','em_cotacao','pendencia'].includes(o.stage)).length)}</td><td>${N(deals.filter(o=>o.stage==='contratada').length)}</td><td><span class="status-dot ${p.active?'':'off'}"></span>${!p.active?'Suspenso':p.password_change_required?'Troca de senha pendente':'Ativo'}</td></tr>`).join('')||'<tr><td colspan="6">Sem corretores cadastrados</td></tr>'}</tbody></table></div></section>`:''}<section class="panel section-short"><div class="panel-head"><div><h3 class="panel-title">Solicitações recentes</h3><div class="panel-sub">Últimos registros da carteira</div></div><button class="btn btn-outline btn-sm" data-nav="opportunities">Ver todas →</button></div>${recent.length?`<div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Produto</th>${isAdmin()?'<th>Corretor</th>':''}<th>Crédito</th><th>Etapa</th><th>Cadastro</th></tr></thead><tbody>${recent.map(o=>`<tr><td><button class="link-button" data-action="detail" data-id="${H(o.id)}">${H(clientName(o.client_id))}</button></td><td>${H(productName(o.product_id))}</td>${isAdmin()?`<td>${H(brokerName(o.owner_id))}</td>`:''}<td>${BRL(o.credit_amount)}</td><td>${statusBadge(o.stage)}</td><td>${date(o.created_at)}</td></tr>`).join('')}</tbody></table></div>`:empty('Cadastre sua primeira solicitação')}</section><div class="footer-note">ASTRION · Indicadores operacionais • Crédito potencial não representa receita ou vendas efetivadas.</div>`;
}
function renderClients(){const ids=new Set(visibleOpps().map(o=>o.client_id)); const cs=state.clients.filter(c=>(state.filterBroker==='all'||c.owner_id===state.filterBroker)&&(state.filterProduct==='all'||ids.has(c.id))&&(matches(state.search,c.full_name)||matches(state.search,c.email)||matches(state.search,c.phone))).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  document.querySelector('#page-root').innerHTML=pageHead('Clientes',`${N(cs.length)} clientes encontrados na carteira.`, '<button class="btn btn-primary" data-action="new-client">+ Cadastrar cliente</button>')+filters('clients')+`<section class="table-card">${cs.length?`<div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Telefone / e-mail</th><th>Localização</th>${isAdmin()?'<th>Corretor</th>':''}<th>Oportunidades</th><th>Cadastro</th><th></th></tr></thead><tbody>${cs.map(c=>`<tr><td><span class="cell-title">${H(c.full_name)}</span></td><td>${H(c.phone||'—')}<div class="cell-sub">${H(c.email)}</div></td><td>${H([c.city,c.state].filter(Boolean).join(' / ')||'—')}</td>${isAdmin()?`<td>${H(brokerName(c.owner_id))}</td>`:''}<td><span class="count-pill">${N(state.opps.filter(o=>o.client_id===c.id).length)}</span></td><td>${date(c.created_at)}</td><td><button class="btn btn-outline btn-sm" data-action="edit-client" data-id="${H(c.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum cliente encontrado')}</section>`;
}
function renderOpportunities(){const oo=visibleOpps().filter(o=>matches(state.search,clientName(o.client_id))||matches(state.search,productName(o.product_id))||matches(state.search,brokerName(o.owner_id))||matches(state.search,o.reference_asset)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 document.querySelector('#page-root').innerHTML=pageHead('Solicitações de cotação',`${N(oo.length)} solicitações na seleção. A Astrion pesquisa as condições dos parceiros e publica a devolutiva na ÓRBITA.`, '<button class="btn btn-primary" data-action="new-opp">+ Nova solicitação</button>')+filters('opportunities')+`<section class="table-card">${oo.length?`<div class="table-scroll"><table><thead><tr><th>Cliente / referência</th><th>Tipo de bem</th>${isAdmin()?'<th>Corretor</th>':''}<th>Crédito</th><th>Lance</th><th>Situação</th><th></th></tr></thead><tbody>${oo.map(o=>`<tr><td><button class="link-button cell-title" data-action="detail" data-id="${H(o.id)}">${H(clientName(o.client_id))}</button><div class="cell-sub">${H(o.reference_asset||'Bem ainda não informado')} · ${date(o.created_at)}</div></td><td>${H(productName(o.product_id))}</td>${isAdmin()?`<td>${H(brokerName(o.owner_id))}</td>`:''}<td><strong>${o.credit_amount?BRL(o.credit_amount):'—'}</strong></td><td>${H(({sim:'Pretende ofertar',nao:'Sem lance',avaliando:'Avaliando',indefinido:'Não informado'})[o.bid_intention]||'—')}</td><td>${statusBadge(o.stage)}</td><td><button class="btn btn-outline btn-sm" data-action="detail" data-id="${H(o.id)}">Consultar →</button>${isAdmin()?`<button class="btn btn-ghost btn-sm" data-action="print-request" data-id="${H(o.id)}">Imprimir</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty('Nenhuma solicitação encontrada')}</section>`;
}
function renderBrokers(){const pp=state.profiles.filter(p=>p.role==='broker').sort((a,b)=>a.full_name.localeCompare(b.full_name));document.querySelector('#page-root').innerHTML=pageHead('Corretores','Controle de acesso, vinculação de carteiras e produtividade.', '<button class="btn btn-primary" data-action="add-broker">+ Cadastrar corretor</button>')+`<div class="notice">Somente a Astrion cadastra usuários, com senha provisória. No primeiro acesso, a troca da senha é obrigatória antes da visualização de clientes ou solicitações.</div><section class="table-card">${pp.length?`<div class="table-scroll"><table><thead><tr><th>Corretor</th><th>E-mail</th><th>Empresa</th><th>Clientes</th><th>Oportunidades</th><th>Situação</th><th></th></tr></thead><tbody>${pp.map(p=>`<tr><td><strong class="cell-title">${H(p.full_name||'Sem nome')}</strong></td><td>${H(p.email)}</td><td>${H(p.company||'—')}</td><td>${N(state.clients.filter(c=>c.owner_id===p.id).length)}</td><td>${N(state.opps.filter(o=>o.owner_id===p.id).length)}</td><td><span class="status-dot ${p.active?'':'off'}"></span>${!p.active?'Suspenso':p.password_change_required?'Troca de senha pendente':'Ativo'}</td><td><button class="btn btn-outline btn-sm" data-action="edit-broker" data-id="${H(p.id)}">Gerenciar</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum corretor cadastrado')}</section>`;}
function renderProducts(){const pp=[...state.products].sort((a,b)=>a.category.localeCompare(b.category));document.querySelector('#page-root').innerHTML=pageHead('Categorias de bens','Os corretores informam sua necessidade sem selecionar administradoras ou produtos comerciais específicos.', '<button class="btn btn-primary" data-action="new-product">+ Categoria</button>')+`<section class="table-card">${pp.length?`<div class="table-scroll"><table><thead><tr><th>Categoria</th><th>Tipo</th><th>Solicitações</th><th>Situação</th><th></th></tr></thead><tbody>${pp.map(p=>`<tr><td class="cell-title">${H(p.name)}</td><td>${H(p.category)}</td><td>${N(state.opps.filter(o=>o.product_id===p.id).length)}</td><td><span class="status-dot ${p.active?'':'off'}"></span>${p.active?'Ativo':'Inativo'}</td><td><button class="btn btn-outline btn-sm" data-action="edit-product" data-id="${H(p.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhuma categoria cadastrada')}</section>`;}
function renderPage(){if(!document.querySelector('#page-root'))return;switch(state.page){case'dashboard':renderDashboard();break;case'clients':renderClients();break;case'opportunities':renderOpportunities();break;case'brokers':renderBrokers();break;case'products':renderProducts();break;case'catalog':renderCatalog();break;case'dispatches':renderDispatches();break;}}
async function fetchAll(table, order='created_at'){let rows=[];for(let i=0;i<20;i++){const {data,error}=await sb.from(table).select('*').order(order,{ascending:false}).range(i*500,i*500+499);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<500)break;}return rows;}
async function loadData(quiet=false){if(!state.user||state.loading)return;state.loading=true;
try{
 const {data:profile,error:profileError}=await sb.from('profiles').select('*').eq('id',state.user.id).single();
 if(profileError||!profile)throw new Error('Perfil não localizado. Verifique o cadastro no Supabase.');
 state.profile=profile;state.profiles=[profile];state.products=[];state.clients=[];state.opps=[];
 if(!profile.active){
   await sb.auth.signOut({scope:'global'});state.user=null;state.profile=null;state.authMode='login';
   renderAuth();toast('Acesso suspenso pela administração.',true);return;
 }
 if(profile.password_change_required){state.authMode='firstpass';renderAuth();return;}
 const [profiles,products,clients,opps,segments,groups,dispatches]=await Promise.all([
   fetchAll('profiles'),fetchAll('products'),fetchAll('clients'),fetchAll('opportunities'),
   fetchAll('catalog_segments','updated_at'),fetchAll('catalog_groups','updated_at'),
   isAdmin()?fetchAll('partner_dispatches'):Promise.resolve([])
 ]);
 state.profiles=profiles;state.products=products;state.clients=clients;state.opps=opps;
 state.catalogSegments=segments;state.catalogGroups=groups;state.dispatches=dispatches;
 state.profile=profiles.find(p=>p.id===state.user.id)||profile;
 state.authMode='login';renderShell();if(!quiet)toast('Dados atualizados.');
}catch(e){
 toast(safe(e),true);
 if(!state.profile){app.innerHTML=`<div class="empty"><h2>Não foi possível carregar seu perfil.</h2><p>${H(safe(e))}</p><button class="btn btn-outline" data-action="logout">Sair</button></div>`;}
}finally{state.loading=false;}}
async function enter(){if(!sb)return;const {data:{user},error}=await sb.auth.getUser();if(error||!user){state.user=null;state.profile=null;renderAuth();return;}state.user=user;await loadData(true);if(!state.interval)state.interval=window.setInterval(()=>{if(state.user&&!document.hidden&&!modalRoot.children.length)loadData(true);},60000);}

function extraRequestFields(o){
 const defaultCategory=state.products.find(p=>p.id===o?.product_id)?.category||state.products.find(p=>p.active)?.category;
 const segment=state.catalogSegments.find(x=>x.product_category===defaultCategory);
 const categories=[...new Set(segment?.asset_types||[])].sort();
 const options=categories.map(x=>`<option value="${H(x)}"></option>`).join('');
 const yes=(name,title,val)=>formSelect(name,title,[['nao_informado','Não informado'],['sim','Sim'],['nao','Não'],['avaliando','A avaliar']].map(x=>opt(x[0],x[1],val)).join(''));
 return `<div class="form-section"><div class="section-caption">05 · Produto e enquadramento</div><div class="form-grid">
 ${formSelect('customer_type','Perfil do cliente',opt('nao_informado','A definir',o?.customer_type)+opt('pf','Pessoa física',o?.customer_type)+opt('pj','Pessoa jurídica',o?.customer_type))}
 ${field('asset_type','Tipo específico de bem',o?.asset_type||'','list="asset-types-list" maxlength="130" placeholder="Ex.: Apartamento, Caminhão, Reforma"')}
 <datalist id="asset-types-list">${options}</datalist>
 ${formSelect('plan_preference','Plano de interesse',opt('avaliar','Avaliar todas as opções',o?.plan_preference)+opt('normal','Normal',o?.plan_preference)+opt('plano_50','Plano 50%',o?.plan_preference)+opt('plano_70','Plano 70%',o?.plan_preference)+opt('meia_parcela','Meia parcela (quando disponível)',o?.plan_preference))}
 ${formSelect('credit_flexibility','Aceita outros valores de crédito?',opt('avaliar','A avaliar',o?.credit_flexibility)+opt('sim','Sim',o?.credit_flexibility)+opt('nao','Não',o?.credit_flexibility))}
 ${formSelect('contemplation_profile','Objetivo principal',opt('equilibrio','Equilíbrio entre lance e parcela',o?.contemplation_profile)+opt('menor_parcela','Menor parcela possível',o?.contemplation_profile)+opt('antecipar','Buscar antecipação (sem garantia)',o?.contemplation_profile))}
 ${formSelect('bid_resource','Fonte pretendida para lance',opt('a_definir','A definir',o?.bid_resource)+opt('recursos_proprios','Recursos próprios',o?.bid_resource)+opt('embutido','Embutido, se permitido',o?.bid_resource)+opt('fgts','FGTS, quando elegível',o?.bid_resource)+opt('troca_de_chave','Troca de chave, quando elegível',o?.bid_resource)+opt('combinado','Combinado, quando permitido',o?.bid_resource))}
 <div class="form-group"><label>Há bem disponível para troca de chave?</label><label class="checkbox-line"><input type="checkbox" name="trade_in_available" ${o?.trade_in_available?'checked':''}> Possui veículo/bem em seu nome (elegibilidade será avaliada)</label></div>
 </div><p class="help full" id="catalog-hint">${segment?'Parâmetro comercial: '+BRL(segment.credit_min)+' a '+BRL(segment.credit_max)+' · até '+segment.max_term_months+' meses. Confirmar com Âncora.':'Escolha uma categoria para consultar os parâmetros de referência.'}</p></div>
 <div class="form-section"><div class="section-caption">06 · Pré-análise e documentação</div><div class="form-grid">
 ${formSelect('income_proof_status','Comprovação de renda',opt('nao_informado','Não informado',o?.income_proof_status)+opt('disponivel','Disponível',o?.income_proof_status)+opt('pendente','Pendente',o?.income_proof_status)+opt('nao_possui','Não possui',o?.income_proof_status))}
 ${yes('guarantor_available','Fiador disponível?',o?.guarantor_available)}
 ${yes('collateral_available','Garantia disponível?',o?.collateral_available)}
 ${formSelect('documentation_status','Situação da documentação',opt('a_verificar','A verificar',o?.documentation_status)+opt('pendente','Pendente',o?.documentation_status)+opt('parcial','Parcial',o?.documentation_status)+opt('completa','Completa',o?.documentation_status))}
 ${formArea('special_conditions','Pontos de atenção / exigências específicas',o?.special_conditions||'')}
 </div><p class="help">Os parâmetros de referência não substituem avaliação formal de crédito, elegibilidade, regras de grupos nem condições atualizadas da Âncora. Evite enviar CPF, dados bancários, comprovantes de renda ou dados de saúde nas observações.</p></div>`;
}
function extraQuoteFields(){
 const codes=state.catalogGroups.map(g=>`<option value="${H(g.code)}"></option>`).join('');
 return `${field('group_code','Grupo ofertado','','list="catalog-groups" maxlength="30"')}<datalist id="catalog-groups">${codes}</datalist>
 ${formSelect('plan_name','Plano efetivamente cotado',opt('','Não confirmado')+opt('Normal','Normal')+opt('Plano 50%','Plano 50%')+opt('Plano 70%','Plano 70%')+opt('Meia parcela','Meia parcela')+opt('Outro','Outro'))}
 ${field('partner_reference','Protocolo da Âncora / referência','','maxlength="90"')}
 ${field('partner_return_date','Data de resposta','','type="date"')}
 ${field('adjustment_index','Índice de correção confirmado','','maxlength="100" placeholder="Ex.: INCC / IGP-M / fabricante"')}
 ${field('installment_after_contemplation','Parcela após contemplação (R$)','','type="number" min="0" step="0.01"')}
 ${formArea('sales_plan_notes','Plano, adesão, ressalvas e critérios do parceiro','')}`;
}
function renderCatalog(){
 const root=document.querySelector('#page-root');if(!root)return;
 const admin=isAdmin();
 const cards=state.catalogSegments.map(s=>{
  const groups=state.catalogGroups.filter(g=>g.segment_code===s.code);
  const range=[s.credit_min!=null?BRL(s.credit_min):'A confirmar',s.credit_max!=null?BRL(s.credit_max):'A confirmar'].join(' — ');
  return `<article class="catalog-card">
    <div class="catalog-kicker">INFORMAÇÕES COMERCIAIS · SUJEITAS A CONFIRMAÇÃO</div>
    <div class="catalog-head"><h3>${H(s.name)}</h3>${admin?`<button class="btn btn-outline btn-sm" data-action="edit-catalog" data-id="${H(s.code)}">Editar regras</button>`:''}</div>
    <div class="catalog-stats"><span><b>Crédito</b>${H(range)}</span><span><b>Prazo máximo</b>${s.max_term_months?H(s.max_term_months)+' meses':'Validar'}</span><span><b>Renda</b>${s.income_multiple?H(s.income_multiple)+'× parcela':'A validar'}</span></div>
    <p class="help"><strong>Bens e finalidades:</strong> ${(s.asset_types||[]).map(H).join(' · ')}</p>
    <p><strong>Correção:</strong> ${H(s.adjustment_index||'A confirmar')}</p>
    <p class="help"><strong>Exigências:</strong> ${H(s.documentation_notes||'A confirmar')}</p>
    <p class="help"><strong>Regras / atenção:</strong> ${H(s.policy_notes||'A confirmar')}</p>
    <div class="catalog-tags">${groups.map(g=>`<button class="catalog-tag" data-action="edit-group" data-id="${H(g.code)}">Grupo ${H(g.code)} · ${g.credit_min!=null?BRL(g.credit_min):'Faixa pendente'}${g.credit_max!=null?' – '+BRL(g.credit_max):''}</button>`).join('')||'<span class="muted">Sem grupos de referência cadastrados</span>'}</div>
    ${admin?`<button class="btn btn-outline btn-sm" data-action="add-group" data-id="${H(s.code)}">+ Grupo neste segmento</button>`:''}<p class="help">${s.confirmed_by_partner?'Regras revisadas pela assessoria com o parceiro':'Condições referenciais; confirmar regras e disponibilidade por grupo com a administradora.'}</p>
  </article>`;
 }).join('');
 root.innerHTML=pageHead('Catálogo de produtos e grupos','Consulte os segmentos e grupos, limites comerciais, prazos e regras de contemplação.')+
 '<div class="notice">Os valores apresentados são referenciais e exigem confirmação. Somente a cotação formal devolvida pelo parceiro define plano, grupo, taxas e prazos aplicáveis à solicitação.</div>'+
 '<div class="catalog-grid">'+cards+'</div>';
}
function renderDispatches(){
 if(!isAdmin())return;
 const rows=state.dispatches.map(d=>{
   const o=state.opps.find(x=>x.id===d.opportunity_id);
   return `<tr><td><strong>${H(o?clientName(o.client_id):'Solicitação não localizada')}</strong><div class="cell-sub">${H(o?.reference_asset||'')}</div></td><td>${H(d.partner_name)}</td><td>${H(d.request_status)}</td><td>${H(d.protocol||'—')}</td><td>${dateTime(d.sent_at||d.created_at)}</td><td><button class="btn btn-outline btn-sm" data-action="print-request" data-id="${H(d.opportunity_id)}">Imprimir ficha</button><button class="btn btn-outline btn-sm" data-action="dispatch" data-id="${H(d.opportunity_id)}">Atualizar</button></td></tr>`;
 }).join('');
 document.querySelector('#page-root').innerHTML=pageHead('Encaminhamentos à Âncora','Controle interno das solicitações enviadas para cotação.')+
 `<section class="table-card"><div class="table-scroll"><table><thead><tr><th>Solicitação</th><th>Parceiro</th><th>Estado</th><th>Protocolo</th><th>Último registro</th><th>Ações</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Ainda não há encaminhamentos. Abra uma solicitação e clique em Encaminhar à Âncora.</td></tr>'}</tbody></table></div></section>`;
}

function modalGroup(id,segmentCode){
 if(!isAdmin())return;
 const g=id?state.catalogGroups.find(x=>x.code===id):null;
 const parent=segmentCode||g?.segment_code;if(!parent)return;
 const body=`<form id="record-form" data-form="catalog-group" data-id="${H(id||'')}"><input type="hidden" name="segment_code" value="${H(parent)}"><div class="modal-content"><div class="notice">Condições referenciais até validação comercial com a administradora. Mantenha os limites e a disponibilidade atualizados.</div>
 <div class="form-grid">${field('code','Número do grupo *',g?.code||'','required maxlength="35" '+(g?'readonly':'') )}
 ${field('credit_min','Crédito mínimo (R$)',g?.credit_min??'','type="number" min="0" step="0.01"')}
 ${field('credit_max','Crédito máximo (R$)',g?.credit_max??'','type="number" min="0" step="0.01"')}
 ${field('plans','Planos aplicáveis (separar por vírgula)',(g?.plans||[]).join(', '),'maxlength="400"')}
 ${formArea('notes','Observações e regras específicas',g?.notes||'')}
 <div class="form-group full"><label class="checkbox-line"><input type="checkbox" name="confirmed_by_partner" ${g?.confirmed_by_partner?'checked':''}> Condições deste grupo confirmadas pela assessoria com a Âncora</label></div>
 </div></div></form>`;
 setModal(g?'Atualizar grupo '+g.code:'Novo grupo · '+parent,body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="record-form">Salvar grupo</button>',true);
}

function modalCatalog(id){
 const s=state.catalogSegments.find(x=>x.code===id);if(!s||!isAdmin())return;
 const body=`<form id="record-form" data-form="catalog" data-id="${H(id)}"><div class="modal-content">
 <div class="notice">Edite somente referências verificadas. Alterar regras do catálogo não gera cotações nem altera propostas já publicadas.</div>
 <div class="form-grid">${field('credit_min','Crédito mínimo (R$)',s.credit_min??'','type="number" min="0" step="0.01"')}
 ${field('credit_max','Crédito máximo (R$)',s.credit_max??'','type="number" min="0" step="0.01"')}
 ${field('max_term_months','Prazo máximo (meses)',s.max_term_months??'','type="number" min="1" max="400"')}
 ${field('adjustment_index','Índice de correção',s.adjustment_index||'','maxlength="100"')}
 ${formArea('documentation_notes','Documentação / exigências',s.documentation_notes||'')}
 ${formArea('policy_notes','Regras / exceções / ressalvas',s.policy_notes||'')}
 <div class="form-group full"><label class="checkbox-line"><input type="checkbox" name="confirmed_by_partner" ${s.confirmed_by_partner?'checked':''}> Regras verificadas com o parceiro pela Astrion</label></div></div></div></form>`;
 setModal('Atualizar regras · '+s.name,body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="record-form">Salvar regras</button>',true);
}
function modalDispatch(id){
 const o=state.opps.find(x=>x.id===id);if(!o||!isAdmin())return;
 const prev=state.dispatches.find(x=>x.opportunity_id===id);
 const body=`<form id="record-form" data-form="dispatch" data-id="${H(id)}"><div class="modal-content">
 <div class="notice">Controle interno Astrion. A ficha para a Âncora é gerada pelo botão Imprimir solicitação. O envio externo ainda é manual, sem integração automática com a administradora.</div>
 <div class="form-grid">
 ${field('partner_name','Parceiro para cotação',prev?.partner_name||'Âncora','required maxlength="160"')}
 ${formSelect('request_status','Situação', ['preparada','enviada','aguardando','retornada','pendencia','cancelada'].map(k=>opt(k,({preparada:'Ficha preparada',enviada:'Enviada ao parceiro',aguardando:'Aguardando retorno',retornada:'Cotação recebida',pendencia:'Pendência',cancelada:'Cancelada'})[k],prev?.request_status)).join(''))}
 ${field('protocol','Protocolo / referência externa',prev?.protocol||'','maxlength="100"')}
 ${formArea('internal_notes','Observações internas',prev?.internal_notes||'')}
 </div></div></form>`;
 setModal('Controle de envio · '+clientName(o.client_id),body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="record-form">Registrar andamento</button>',true);
}
function printOpportunity(id,kind){
 const o=state.opps.find(x=>x.id===id);if(!o)return toast('Solicitação não encontrada.',true);
 if(kind==='request'&&!isAdmin())return toast('A impressão para parceiros é exclusiva da administração.',true);
 const c=state.clients.find(x=>x.id===o.client_id),b=state.profiles.find(x=>x.id===o.owner_id),p=state.products.find(x=>x.id===o.product_id);
 const d=state.dispatches.find(x=>x.opportunity_id===id);
 try{openDocument(kind,o,c,b,p,state.catalogSegments,state.quoteCache[id]||[],isAdmin()?d:null)}catch(e){toast(safe(e),true)}
}

function modalClient(id){const c=id?state.clients.find(x=>x.id===id):null;const owner=c?.owner_id||(isAdmin()?state.profiles.find(p=>p.role==='broker'&&p.active)?.id:state.user.id);
  if(!owner){toast('Cadastre e ative um corretor antes de cadastrar clientes.',true);return;}
  const basis=['procedimentos_preliminares','consentimento','legitimo_interesse'];const basisLabels={procedimentos_preliminares:'Procedimentos preliminares solicitados',consentimento:'Consentimento',legitimo_interesse:'Legítimo interesse (validado)'};
  const body=`<form id="record-form" data-form="client" data-id="${H(id||'')}"><div class="modal-content"><div class="form-grid">${isAdmin()?c?`<div class="form-group full"><label>Responsável pela carteira</label><div class="subtle">${H(brokerName(owner))} · vínculo não pode ser alterado nesta versão</div></div>`:formSelect('owner_id','Corretor responsável *',selectBrokers(owner,false)):''}${field('full_name','Nome completo *',c?.full_name||'','required minlength="2" maxlength="160"')}${field('phone','Telefone / WhatsApp',c?.phone||'','type="tel" maxlength="30"')}${field('email','E-mail',c?.email||'','type="email" maxlength="250"')}${field('city','Cidade',c?.city||'','maxlength="90"')}${field('state','UF',c?.state||'','maxlength="2"')}${formSelect('privacy_basis','Base legal de tratamento de dados *',opt('','Selecione a base legal',c?.privacy_basis||'')+basis.map(k=>opt(k,basisLabels[k],c?.privacy_basis)).join(''),'required')}${formArea('notes','Observações comerciais',c?.notes||'')}</div><p class="help">Registre apenas os dados necessários ao atendimento. Não inclua documentos, renda, dados de saúde ou dados bancários neste campo.</p></div></form>`;
  setModal(c?'Editar cliente':'Novo cliente',body,`<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button class="btn btn-primary" form="record-form" type="submit">${c?'Salvar alterações':'Cadastrar cliente'}</button>`);
}
function modalOpportunity(id){const o=id?state.opps.find(x=>x.id===id):null;
 if(o&&!isAdmin()&&o.stage!=='rascunho'){showDetail(id);return;}
 const owner=o?.owner_id||(isAdmin()?state.profiles.find(p=>p.role==='broker'&&p.active)?.id:state.user.id);
 if(!owner){toast('Cadastre e ative um corretor antes de iniciar a operação.',true);return;}
 const matchingClients=state.clients.filter(c=>c.owner_id===owner);
 if(!matchingClients.length&&!o){toast('Cadastre um cliente para esse corretor antes de criar uma solicitação.',true);return;}
 const owners=isAdmin()&&!o?formSelect('owner_id','Corretor responsável *',selectBrokers(owner,false)):`<div class="form-group"><label>Responsável</label><div class="subtle">${H(brokerName(owner))}</div></div>`;
 const clientInput=o?`<div class="form-group"><label>Cliente</label><div class="subtle">${H(clientName(o.client_id))}</div></div>`:formSelect('client_id','Cliente *',matchingClients.map(c=>opt(c.id,c.full_name)).join(''));
 const flags=[['needs_quick_contemplation','Prioridade para contemplação antecipada'],['accepts_standard_quota','Aceita receber condições de cota não contemplada']];
 const yn=(x)=>([{value:'sim',label:'Sim'}, {value:'nao',label:'Não'}, {value:'avaliando',label:'Ainda avaliando'}, {value:'indefinido',label:'Não informado'}].map(a=>opt(a.value,a.label,x)).join(''));
 const body=`<form id="record-form" data-form="opportunity" data-id="${H(id||'')}"><div class="modal-content">
 <div class="form-section"><div class="section-caption">01 · Cliente e objetivo</div><div class="form-grid">${owners}${clientInput}${formSelect('product_id','Tipo de bem / categoria *',activeProducts(o?.product_id),'required')}${field('purpose','Objetivo da aquisição',o?.purpose||'','placeholder="Ex.: compra, troca, investimento" maxlength="160"')}${field('reference_asset','Bem de referência *',o?.reference_asset||'','placeholder="Ex.: apartamento de 2 quartos em Osasco" maxlength="220"')}${formSelect('asset_condition','Condição do bem',opt('nao_informado','Não informado',o?.asset_condition||'nao_informado')+opt('novo','Novo',o?.asset_condition)+opt('usado','Usado',o?.asset_condition)+opt('nao_aplicavel','Não se aplica',o?.asset_condition))}${field('asset_value','Valor estimado do bem (R$) *',o?.asset_value??'','type="number" min="1" step="0.01"')}${field('credit_amount','Crédito pretendido (R$) *',o?.credit_amount??'','type="number" min="1" step="0.01"')}</div></div>
 <div class="form-section"><div class="section-caption">02 · Capacidade e prazo desejados</div><div class="form-grid">${field('desired_term_months','Prazo de preferência (meses)',o?.desired_term_months??'','type="number" min="1" max="360" placeholder="Ex.: 120"')}${field('max_installment','Parcela mensal desejada até (R$)',o?.max_installment??'','type="number" min="1" step="0.01"')}${formSelect('urgency','Quando pretende adquirir o bem? *',opt('a_definir','A definir',o?.urgency)+opt('imediata','Imediatamente',o?.urgency)+opt('ate_3_meses','Em até 3 meses',o?.urgency)+opt('ate_6_meses','Em até 6 meses',o?.urgency)+opt('mais_6_meses','Após 6 meses',o?.urgency))}<div class="form-group"><label>Prioridades do cliente</label><label class="checkbox-line"><input type="checkbox" name="needs_quick_contemplation" ${o?.needs_quick_contemplation?'checked':''}> Busca contemplação antecipada (sem garantia)</label><label class="checkbox-line"><input type="checkbox" name="accepts_standard_quota" ${o?.accepts_standard_quota!==false?'checked':''}> Aceita avaliar cota não contemplada</label></div></div></div>
 <div class="form-section"><div class="section-caption">03 · Estratégia de lance</div><div class="form-grid">${formSelect('bid_intention','Pretende ofertar lance? *',yn(o?.bid_intention||'indefinido'))}${formSelect('bid_type','Forma de lance preferida',opt('indefinido','A definir',o?.bid_type)+opt('recursos_proprios','Recursos próprios',o?.bid_type)+opt('embutido','Lance embutido (se disponível)',o?.bid_type)+opt('combinado','Combinação (se disponível)',o?.bid_type))}${field('bid_amount','Recursos disponíveis para lance (R$)',o?.bid_amount??'','type="number" min="0" step="0.01"')}${field('bid_percentage','Percentual de lance pretendido (%)',o?.bid_percentage??'','type="number" min="0" max="100" step="0.01"')}</div></div>
 <div class="form-section"><div class="section-caption">04 · Informações comerciais</div><div class="form-grid">${field('source','Origem do cliente',o?.source||'Indicação','maxlength="90"')}${field('next_action_at','Data de acompanhamento',o?.next_action_at||'','type="date"')}${formArea('notes','Outras orientações para pesquisa da Astrion',o?.notes||'')}</div></div>
 ${extraRequestFields(o)}<p class="help">* Campos necessários para enviar a solicitação. É possível salvar um rascunho incompleto. Não insira CPF, renda detalhada, dados bancários ou documentos nas observações.</p></div></form>`;
 const editableDraft=!o||o.stage==='rascunho';
 const foot=`<button type="button" class="btn btn-outline" data-action="close-modal">Cancelar</button>${editableDraft?`<button class="btn btn-outline" data-intent="draft" form="record-form" formnovalidate type="submit">Salvar rascunho</button><button class="btn btn-primary" data-intent="send" form="record-form" type="submit">Enviar à Astrion →</button>`:`<button class="btn btn-primary" data-intent="save" form="record-form" type="submit">Salvar alterações</button>`}`;
 setModal(o?'Dados da solicitação':'Nova solicitação para cotação',body,foot,true);
}
function modalBroker(id){if(id){const p=state.profiles.find(x=>x.id===id);if(!p)return;const body=`<form id="record-form" data-form="broker" data-id="${H(id)}"><div class="modal-content"><div class="form-grid">${field('full_name','Nome completo',p.full_name,'required maxlength="140"')}${field('phone','Telefone',p.phone||'','maxlength="30"')}${field('company','Empresa / corretora',p.company||'','maxlength="140"')}<div class="form-group"><label>E-mail de acesso</label><div class="subtle">${H(p.email)}</div></div>${formSelect('active','Permissão de acesso',opt('true','Ativo',String(p.active))+opt('false','Suspenso',String(p.active)))}</div><p class="help">Suspender o perfil bloqueia novas consultas por RLS. Contas recém-criadas exigem troca da senha provisória antes de acessar dados.</p></div></form>`;setModal('Gerenciar corretor',body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button type="submit" form="record-form" class="btn btn-primary">Salvar corretor</button>');return;}
  const body=`<div class="modal-content"><div class="notice"><strong>Cadastro feito pela administração, sem convite ou autoinscrição.</strong> Cadastre o usuário no Supabase Auth com senha provisória, depois ative seu perfil na ÓRBITA.</div>
  <p class="help">1. Abra <a href="https://supabase.com/dashboard/project/ruibwnajvardznucetcg/auth/users" target="_blank" rel="noopener noreferrer">Supabase → Authentication → Users</a>.<br>
  2. Clique em <strong>Add user → Create new user</strong> (não “Send invite”). Informe o e-mail e uma senha provisória forte e confirme o e-mail.<br>
  3. Volte à ÓRBITA, feche esta janela e clique em <strong>Atualizar</strong>.<br>
  4. Abra <strong>Gerenciar</strong> no novo corretor, informe os dados e marque <strong>Ativo</strong>.<br>
  5. Entregue as credenciais por canal privado. A troca de senha será obrigatória no primeiro login.</p>
  <p class="help">Não envie a senha por chat público nem registre em observações, arquivos ou GitHub.</p></div>`;
  setModal('Cadastrar corretor manualmente',body,'<button class="btn btn-primary" type="button" data-action="close-modal">Entendi</button>');
}
function modalChangePassword(){const body=`<form id="record-form" data-form="password"><div class="modal-content"><p class="help">Você poderá trocar sua senha a qualquer momento após o primeiro acesso. Mínimo de 12 caracteres.</p><div class="form-grid">${field('password','Nova senha *','','type="password" minlength="12" autocomplete="new-password" required')}${field('confirm_password','Confirmar senha *','','type="password" minlength="12" autocomplete="new-password" required')}</div></div></form>`;setModal('Alterar minha senha',body,'<button type="button" class="btn btn-outline" data-action="close-modal">Cancelar</button><button type="submit" form="record-form" class="btn btn-primary">Alterar senha</button>');}
function modalProduct(id){const p=id?state.products.find(x=>x.id===id):null;const cats=['Imóveis','Automóveis','Motos','Pesados','Serviços','Outros'];const body=`<form id="record-form" data-form="product" data-id="${H(id||'')}"><div class="modal-content"><div class="notice">As categorias são genéricas. Não há cadastro de taxas, regras ou produtos individuais por administradora.</div><div class="form-grid">${field('name','Nome da categoria *',p?.name||'','required maxlength="140"')}${formSelect('category','Tipo de bem',cats.map(x=>opt(x,x,p?.category||cats[0])).join(''))}${formSelect('active','Disponibilidade',opt('true','Ativa',String(p?.active??true))+opt('false','Inativa',String(p?.active??true)))}</div></div></form>`;setModal(p?'Editar categoria':'Nova categoria',body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button type="submit" form="record-form" class="btn btn-primary">Salvar categoria</button>');}
async function showDetail(id){const o=state.opps.find(x=>x.id===id);if(!o){toast('Solicitação não encontrada.',true);return;}state.detail=id;
 setModal('Solicitação · '+clientName(o.client_id),'<div class="modal-content"><p class="muted">Carregando histórico e condições...</p></div>','',true);
 const [eventsResult,quotesResult,researchResult]=await Promise.all([sb.from('opportunity_events').select('*').eq('opportunity_id',id).order('created_at',{ascending:false}).limit(150),sb.from('quote_options').select('*').eq('opportunity_id',id).order('created_at',{ascending:false}).limit(40),isAdmin()?sb.from('partner_checks').select('*').eq('opportunity_id',id).order('created_at',{ascending:false}).limit(80):Promise.resolve({data:[],error:null})]);
 if(eventsResult.error||quotesResult.error||researchResult.error){toast(safe(eventsResult.error||quotesResult.error||researchResult.error),true);return;}if(state.detail!==id)return;
 const person=state.clients.find(c=>c.id===o.client_id);
 const events=eventsResult.data||[],quotes=quotesResult.data||[],research=researchResult.data||[];
 const summary=(label,val)=>`<div class="summary-line"><span>${H(label)}</span><strong>${H(val??'—')}</strong></div>`;
 const timeline=events.map(e=>`<div class="event"><span class="event-mark ${e.event_type==='devolutiva'?'teal':e.is_internal?'amber':''}"></span><div class="event-body"><div class="event-title">${e.event_type==='devolutiva'?'<strong>Devolutiva · </strong>':e.event_type==='solicitacao_ajuste'?'<strong>Ajuste solicitado · </strong>':e.is_internal?'<strong>Interno · </strong>':''}${H(e.message)}</div><div class="event-meta">${dateTime(e.created_at)} · ${H(actorName(e.actor_id))}</div></div></div>`).join('');
 state.quoteCache[id]=quotes;
 const quoteCards=quotes.map(q=>`<article class="offer-card"><div class="offer-head"><strong>${H(q.label)}${q.group_code?' · Grupo '+H(q.group_code):''}${q.plan_name?' · '+H(q.plan_name):''}</strong><span class="count-pill">${q.published?'Enviada ao corretor':'Rascunho interno'}</span></div>${q.partner_name?`<p class="muted">Parceiro: ${H(q.partner_name)}${q.partner_reference?' · Ref. '+H(q.partner_reference):''}</p>`:''}<div class="offer-grid"><div><small>Crédito</small><strong>${BRL(q.credit_amount)}</strong></div><div><small>Prazo</small><strong>${N(q.term_months)} meses</strong></div><div><small>Parcela estimada</small><strong>${BRL(q.installment_amount)}</strong></div><div><small>Taxa adm. total</small><strong>${q.admin_fee_percentage==null?'A confirmar':N(q.admin_fee_percentage)+'%'}</strong></div><div><small>Fundo de reserva</small><strong>${q.reserve_fund_percentage==null?'A confirmar':N(q.reserve_fund_percentage)+'%'}</strong></div><div><small>Seguro mensal</small><strong>${q.insurance_amount==null?'A confirmar':BRL(q.insurance_amount)}</strong></div></div>${q.bid_guidance?`<p class="offer-note"><strong>Condições de lance:</strong> ${H(q.bid_guidance)}</p>`:''}${q.conditions?`<p class="offer-note"><strong>Observações:</strong> ${H(q.conditions)}</p>`:''}<div class="offer-foot">Validade: ${date(q.valid_until)} · ${dateTime(q.published_at||q.created_at)}</div>${isAdmin()&&!q.published?`<button class="btn btn-primary btn-sm" data-action="publish-quote" data-id="${H(q.id)}" data-opp="${H(o.id)}">Publicar esta condição</button>`:''}</article>`).join('');
 const researchCards=isAdmin()?`<div class="detail-card" style="margin-top:14px"><div class="panel-head"><h4>Pesquisa interna com parceiros</h4><span class="count-pill">${N(research.length)} consultas</span></div><p class="help">Registros exclusivos da assessoria. Não são exibidos aos corretores.</p>${research.map(r=>`<div class="event"><span class="event-mark amber"></span><div class="event-body"><strong>${H(r.partner_name)}</strong> · ${H(({consultado:'Consultado',recebido:'Condições recebidas',descartado:'Descartado',selecionado:'Selecionado'})[r.result_status])}<div class="event-meta">${dateTime(r.created_at)} · ${r.installment_amount?BRL(r.installment_amount)+' / '+N(r.term_months)+' meses':'Sem valores'} · ${r.credit_amount?BRL(r.credit_amount):''}</div><p class="help">${H(r.research_notes)}</p></div></div>`).join('')||'<p class="muted">Nenhuma pesquisa registrada.</p>'}<button class="btn btn-outline btn-sm" data-action="new-research" data-id="${H(id)}">+ Registrar consulta</button></div>`:'';
 const bid=({sim:'Sim',nao:'Não',avaliando:'Ainda avaliando',indefinido:'A definir'})[o.bid_intention]||'—';
 const statusManagement=isAdmin()?`<div class="divider"></div><form data-form="stage" data-id="${H(id)}"><div class="form-group"><label>Atualizar situação do atendimento</label>${formSelect('stage','Etapa',dealStageOrder.filter(st=>st!=='cotada'||quotes.some(q=>q.published)).map(st=>opt(st,stages[st],o.stage)).join(''))}</div><div class="form-group"><label>Mensagem de acompanhamento (opcional)</label><textarea class="field" name="message" maxlength="1500" placeholder="Ex.: Necessário confirmar o valor disponível para lance..."></textarea></div><button class="btn btn-outline btn-sm" type="submit">Atualizar situação</button></form>`:'';
 const body=`<div class="modal-content"><div class="detail-layout"><section><div class="detail-card"><h4>Solicitação do corretor</h4>${summary('Cliente',person?.full_name)}${summary('WhatsApp',person?.phone)}${summary('Corretor',brokerName(o.owner_id))}${summary('Categoria',productName(o.product_id))}${summary('Tipo de cliente',o.customer_type||'A definir')}${summary('Tipo específico de bem',o.asset_type||'A definir')}${summary('Plano desejado',o.plan_preference||'A avaliar')}${summary('Perfil contemplação',o.contemplation_profile||'Equilibrado')}${summary('Fonte do lance',o.bid_resource||'A definir')}${summary('Documentação',o.documentation_status||'A verificar')}${summary('Bem de referência',o.reference_asset||'A definir')}${summary('Finalidade',o.purpose||'—')}${summary('Valor do bem',o.asset_value?BRL(o.asset_value):'—')}${summary('Crédito desejado',o.credit_amount?BRL(o.credit_amount):'—')}${summary('Parcela máxima',o.max_installment?BRL(o.max_installment):'Não informada')}${summary('Prazo desejado',o.desired_term_months?N(o.desired_term_months)+' meses':'Não informado')}${summary('Pretende dar lance',bid)}${summary('Tipo de lance',({recursos_proprios:'Recursos próprios',embutido:'Embutido',combinado:'Combinado',indefinido:'A definir'})[o.bid_type])}${summary('Valor para lance',o.bid_amount!=null?BRL(o.bid_amount):'Não informado')}${summary('Percentual de lance',o.bid_percentage!=null?N(o.bid_percentage)+'%':'Não informado')}${summary('Urgência',({imediata:'Imediata',ate_3_meses:'Até 3 meses',ate_6_meses:'Até 6 meses',mais_6_meses:'Após 6 meses',a_definir:'A definir'})[o.urgency])}${summary('Busca contemplação antecipada',o.needs_quick_contemplation?'Sim':'Não')}${summary('Aceita cota não contemplada',o.accepts_standard_quota?'Sim':'Não')}${summary('Situação',stages[o.stage])}<p class="help">${H(o.notes||'Sem orientações adicionais.')}</p>${isAdmin()||o.stage==='rascunho'?`<button class="btn btn-outline btn-sm" data-action="edit-opp" data-id="${H(o.id)}">Editar solicitação</button>`:''}${!isAdmin()&&o.stage==='rascunho'?`<button class="btn btn-primary btn-sm" data-action="send-opp" data-id="${H(o.id)}">Enviar à Astrion →</button>`:''}${statusManagement}</div>${researchCards}</section><section><div class="detail-card"><div class="panel-head"><div><h4>Devolutiva da assessoria</h4><p class="muted">Condições padronizadas pesquisadas pela Astrion</p></div></div>${quoteCards||'<div class="subtle">Ainda não há condições publicadas. Acompanhe a situação e as mensagens abaixo.</div>'}${isAdmin()?`<button class="btn btn-primary btn-sm" data-action="new-quote" data-id="${H(o.id)}">+ Registrar condição pesquisada</button>`:''}<p class="help">Simulações indicativas, sujeitas às regras, disponibilidade e validação do parceiro. Contemplação não é garantida.</p></div><div class="detail-card" style="margin-top:14px"><h4>Mensagens e histórico</h4><div class="timeline">${timeline||empty('Nenhum registro')}</div><div class="divider"></div><form data-form="event" data-id="${H(id)}"><div class="form-group"><label>Nova mensagem</label><textarea class="field" name="message" minlength="1" maxlength="4000" placeholder="Descreva uma dúvida, retorno, pendência ou avanço do atendimento..." required></textarea></div>${isAdmin()?`<div class="form-group"><label>Visibilidade</label><select class="field" name="event_type">${opt('nota','Mensagem ao corretor')}${opt('devolutiva','Devolutiva textual')}${opt('interno','Anotação interna (não visível)')}</select></div>`:`<div class="form-group"><label>Tipo de mensagem</label><select class="field" name="event_type">${opt('nota','Mensagem / dúvida')}${opt('solicitacao_ajuste','Solicitar ajuste de condições')}</select></div>`}<button type="submit" class="btn btn-primary btn-sm">Enviar mensagem</button></form></div></section></div></div>`;
 setModal('Solicitação · '+clientName(o.client_id),body,`<button class="btn btn-outline" data-action="go-home">← Página inicial</button><button class="btn btn-outline" data-action="close-modal">Fechar</button>${isAdmin()?`<button class="btn btn-outline" data-action="dispatch" data-id="${H(id)}">Encaminhamento Âncora</button><button class="btn btn-outline" data-action="print-request" data-id="${H(id)}">Ficha para Âncora</button>`:'<span class="muted">Somente o corretor responsável pode visualizar</span>'}<button class="btn btn-primary" data-action="print-return" data-id="${H(id)}">PDF devolutiva</button>`,true);
}

function modalResearch(id){const o=state.opps.find(x=>x.id===id);if(!isAdmin()||!o)return;state.detail=id;
 const body=`<form id="research-form" data-form="research" data-id="${H(id)}"><div class="modal-content"><div class="notice">Registro interno da pesquisa. Nunca aparece para o corretor.</div><div class="form-grid">${field('partner_name','Parceiro consultado *','','required maxlength="160"')}${formSelect('result_status','Resultado',opt('consultado','Aguardando retorno')+opt('recebido','Recebido')+opt('descartado','Descartado')+opt('selecionado','Selecionado'))}${field('credit_amount','Crédito ofertado (R$)','','type="number" min="1" step="0.01"')}${field('term_months','Prazo ofertado (meses)','','type="number" min="1" max="360"')}${field('installment_amount','Parcela informada (R$)','','type="number" min="1" step="0.01"')}${formArea('research_notes','Anotações da consulta','')}</div></div></form>`;
 setModal('Registrar consulta a parceiro',body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button class="btn btn-primary" form="research-form" type="submit">Salvar pesquisa interna</button>',true);
}
function modalQuote(id){const o=state.opps.find(x=>x.id===id);if(!isAdmin()||!o)return;state.detail=id;
 const body=`<form data-form="quote" data-id="${H(id)}"><div class="modal-content"><div class="notice">Preencha a condição efetivamente pesquisada. Não há tabela de parâmetros por administradora. É possível deixar a resposta como rascunho interno e publicá-la depois.</div><div class="form-grid">${field('label','Identificação da alternativa *','Opção recomendada','required maxlength="100"')}${field('partner_name','Parceiro consultado (opcional)','','maxlength="160"')}${field('credit_amount','Crédito oferecido (R$) *',o.credit_amount||'','type="number" min="1" step="0.01" required')}${field('term_months','Prazo (meses) *',o.desired_term_months||'','type="number" min="1" max="360" required')}${field('installment_amount','Parcela estimada (R$) *','','type="number" min="0.01" step="0.01" required')}${field('admin_fee_percentage','Taxa de administração total (%)','','type="number" min="0" max="100" step="0.001"')}${field('reserve_fund_percentage','Fundo de reserva (%)','','type="number" min="0" max="100" step="0.001"')}${field('insurance_amount','Seguro estimado / mês (R$)','','type="number" min="0" step="0.01"')}${field('valid_until','Condição válida até','','type="date"')}${formArea('bid_guidance','Orientação sobre lance (sem garantia de contemplação)','')}${formArea('conditions','Condições, ressalvas e próximos passos','')}${extraQuoteFields()}</div><p class="help">A parcela deve refletir o escopo informado pelo parceiro. Explicite seguros, reajustes, eventual cobrança inicial e outras ressalvas na descrição.</p></div></form>`;
 setModal('Nova condição para '+clientName(o.client_id),body,'<button class="btn btn-outline" data-action="close-modal">Cancelar</button><button type="submit" form="quote-form" data-intent="draft" class="btn btn-outline">Salvar internamente</button><button type="submit" form="quote-form" data-intent="publish" class="btn btn-primary">Publicar ao corretor →</button>',true);
 // HTML form id is set here so both footer buttons can submit without nesting.
 const quoteForm=modalRoot.querySelector('form[data-form="quote"]');if(quoteForm)quoteForm.id='quote-form';
}
function formObject(form){return Object.fromEntries(new FormData(form).entries());}
function valOrNull(x){return x||null;}
async function submitRecord(form){const kind=form.dataset.form, id=form.dataset.id;const raw=formObject(form);const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;try{
  if(kind==='password'){
    if((raw.password||'').length<12)throw Error('Use pelo menos 12 caracteres na nova senha.');
    if(raw.password!==raw.confirm_password)throw Error('As senhas não coincidem.');
    const {error}=await sb.auth.updateUser({password:raw.password});if(error)throw error;
    closeModal();
    await sb.auth.signOut({scope:'global'});
    state.user=null;state.profile=null;state.profiles=[];state.products=[];state.clients=[];state.opps=[];
    if(state.interval){clearInterval(state.interval);state.interval=null;}
    state.authMode='login';renderAuth();toast('Senha atualizada. Entre novamente.');return;
  }else if(kind==='client'){
    const data={full_name:raw.full_name?.trim(),phone:raw.phone?.trim()||'',email:raw.email?.trim()||'',city:raw.city?.trim()||'',state:raw.state?.trim().toUpperCase()||'',privacy_basis:raw.privacy_basis,notes:raw.notes||''};
    if(!id){data.owner_id=isAdmin()?raw.owner_id:state.user.id;data.created_by=state.user.id;}
    const q=id?sb.from('clients').update(data).eq('id',id):sb.from('clients').insert(data);
    const {error}=await q;if(error)throw error;
  }else if(kind==='opportunity'){
    const intent=form.dataset.intent||'draft';
    const stage=isAdmin()?(id?(state.opps.find(x=>x.id===id)?.stage||'rascunho'):(intent==='send'?'enviada':'rascunho')):(intent==='send'?'enviada':'rascunho');
    if(stage!=='rascunho'&&(!raw.reference_asset?.trim()||Number(raw.asset_value)<=0||Number(raw.credit_amount)<=0||raw.bid_intention==='indefinido'||raw.urgency==='a_definir'))
      throw Error('Para enviar, informe bem de referência, valor do bem, crédito pretendido, intenção de lance e urgência.');
    const num=x=>x===''||x==null?null:Number(x);
    const data={product_id:raw.product_id,purpose:raw.purpose||'',reference_asset:raw.reference_asset?.trim()||'',asset_condition:raw.asset_condition,
      asset_value:num(raw.asset_value),credit_amount:num(raw.credit_amount),desired_term_months:num(raw.desired_term_months),max_installment:num(raw.max_installment),
      bid_intention:raw.bid_intention,bid_type:raw.bid_type,bid_amount:num(raw.bid_amount),bid_percentage:num(raw.bid_percentage),urgency:raw.urgency,
      needs_quick_contemplation:raw.needs_quick_contemplation==='on',accepts_standard_quota:raw.accepts_standard_quota==='on',source:raw.source||'Indicação',
      next_action_at:valOrNull(raw.next_action_at),notes:raw.notes||''};
    Object.assign(data,{
      customer_type:raw.customer_type||'nao_informado',asset_type:(raw.asset_type||'').trim(),
      plan_preference:raw.plan_preference||'avaliar',credit_flexibility:raw.credit_flexibility||'avaliar',
      contemplation_profile:raw.contemplation_profile||'equilibrio',bid_resource:raw.bid_resource||'a_definir',
      trade_in_available:raw.trade_in_available==='on',income_proof_status:raw.income_proof_status||'nao_informado',
      guarantor_available:raw.guarantor_available||'nao_informado',collateral_available:raw.collateral_available||'nao_informado',
      documentation_status:raw.documentation_status||'a_verificar',special_conditions:(raw.special_conditions||'').trim()
    });
    if(!id)data.stage=stage;else if(!isAdmin())data.stage=stage;
    if(!id){data.owner_id=isAdmin()?raw.owner_id:state.user.id;data.created_by=state.user.id;data.client_id=raw.client_id;}
    const {error}=await (id?sb.from('opportunities').update(data).eq('id',id):sb.from('opportunities').insert(data));if(error)throw error;
  }else if(kind==='catalog'&&isAdmin()){
    const min=raw.credit_min===''?null:Number(raw.credit_min),max=raw.credit_max===''?null:Number(raw.credit_max),term=raw.max_term_months===''?null:Number(raw.max_term_months);
    if(min!=null&&max!=null&&min>max)throw Error('Crédito mínimo não pode superar o máximo.');
    const {error}=await sb.from('catalog_segments').update({
      credit_min:min,credit_max:max,max_term_months:term,policy_notes:raw.policy_notes||'',
      documentation_notes:raw.documentation_notes||'',adjustment_index:raw.adjustment_index||'',
      confirmed_by_partner:raw.confirmed_by_partner==='on',updated_at:new Date().toISOString()
    }).eq('code',id);
    if(error)throw error;
  }else if(kind==='catalog-group'&&isAdmin()){
    const min=raw.credit_min===''?null:Number(raw.credit_min),max=raw.credit_max===''?null:Number(raw.credit_max);
    if(min!=null&&max!=null&&min>max)throw Error('Crédito mínimo não pode superar o máximo.');
    const payload={credit_min:min,credit_max:max,plans:(raw.plans||'').split(',').map(x=>x.trim()).filter(Boolean),
      notes:raw.notes||'',confirmed_by_partner:raw.confirmed_by_partner==='on',updated_at:new Date().toISOString()};
    if(!id){payload.code=(raw.code||'').trim();payload.segment_code=raw.segment_code;payload.source_slides='Cadastro interno Astrion';}
    const {error}=await (id?sb.from('catalog_groups').update(payload).eq('code',id):sb.from('catalog_groups').insert(payload));
    if(error)throw error;
  }else if(kind==='dispatch'&&isAdmin()){
    const o=state.opps.find(x=>x.id===id);if(!o)throw Error('Solicitação não localizada');
    const prev=state.dispatches.find(x=>x.opportunity_id===id);
    const data={partner_name:raw.partner_name?.trim()||'Âncora',request_status:raw.request_status||'preparada',
      protocol:raw.protocol?.trim()||'',internal_notes:raw.internal_notes||'',updated_at:new Date().toISOString()};
    if(['enviada','aguardando'].includes(data.request_status)&&!prev?.sent_at)data.sent_at=new Date().toISOString();
    if(data.request_status==='retornada'&&!prev?.received_at)data.received_at=new Date().toISOString();
    if(!prev){data.opportunity_id=id;data.created_by=state.user.id;}
    const {error}=await (prev?sb.from('partner_dispatches').update(data).eq('id',prev.id):sb.from('partner_dispatches').insert(data));
    if(error)throw error;
  }else if(kind==='product'&&isAdmin()){
    const data={name:raw.name?.trim(),category:raw.category,active:raw.active==='true'};
    const {error}=await (id?sb.from('products').update(data).eq('id',id):sb.from('products').insert(data));if(error)throw error;
  }else if(kind==='research'&&isAdmin()){
    const o=state.opps.find(x=>x.id===id);if(!o)throw Error('Solicitação indisponível');
    const num=x=>x===''||x==null?null:Number(x);
    const data={opportunity_id:id,owner_id:o.owner_id,recorded_by:state.user.id,partner_name:raw.partner_name?.trim(),result_status:raw.result_status,credit_amount:num(raw.credit_amount),term_months:num(raw.term_months),installment_amount:num(raw.installment_amount),research_notes:raw.research_notes||''};
    const {error}=await sb.from('partner_checks').insert(data);if(error)throw error;
    closeModal();await showDetail(id);toast('Pesquisa interna registrada.');return;
  }else if(kind==='quote'&&isAdmin()){
    const o=state.opps.find(x=>x.id===id);if(!o)throw Error('Solicitação indisponível');
    const num=x=>x===''||x==null?null:Number(x);
    const data={opportunity_id:o.id,owner_id:o.owner_id,created_by:state.user.id,label:raw.label?.trim(),partner_name:raw.partner_name?.trim()||'',
      credit_amount:num(raw.credit_amount),term_months:num(raw.term_months),installment_amount:num(raw.installment_amount),
      admin_fee_percentage:num(raw.admin_fee_percentage),reserve_fund_percentage:num(raw.reserve_fund_percentage),insurance_amount:num(raw.insurance_amount),
      bid_guidance:raw.bid_guidance||'',conditions:raw.conditions||'',valid_until:valOrNull(raw.valid_until),published:form.dataset.intent==='publish',plan_name:raw.plan_name||'',group_code:(raw.group_code||'').trim(),adjustment_index:raw.adjustment_index||'',partner_reference:raw.partner_reference||'',partner_return_date:valOrNull(raw.partner_return_date),installment_after_contemplation:num(raw.installment_after_contemplation),sales_plan_notes:raw.sales_plan_notes||''};
    const {error}=await sb.from('quote_options').insert(data);if(error)throw error;
    closeModal();await loadData(true);await showDetail(o.id);toast(data.published?'Condição publicada para o corretor.':'Condição salva como rascunho interno.');return;
  }else if(kind==='stage'&&isAdmin()){
    const o=state.opps.find(x=>x.id===id);if(!o)throw Error('Solicitação indisponível');
    if(o.stage!==raw.stage){const {error}=await sb.from('opportunities').update({stage:raw.stage}).eq('id',id);if(error)throw error;}
    if(raw.message?.trim()) {const {error}=await sb.from('opportunity_events').insert({opportunity_id:id,owner_id:o.owner_id,actor_id:state.user.id,event_type:'nota',message:raw.message.trim(),is_internal:false});if(error)throw error;}
    await loadData(true);await showDetail(id);toast('Atendimento atualizado.');return;
  }else if(kind==='broker'&&isAdmin()){
    const data={full_name:raw.full_name?.trim(),phone:raw.phone||'',company:raw.company||'',active:raw.active==='true'};
    const {error}=await sb.from('profiles').update(data).eq('id',id);if(error)throw error;
  }else if(kind==='event'){
    const o=state.opps.find(x=>x.id===id);if(!o)throw Error('Oportunidade indisponível');
    const {error}=await sb.from('opportunity_events').insert({opportunity_id:id,owner_id:o.owner_id,actor_id:state.user.id,
      event_type:raw.event_type==='interno'?'nota':raw.event_type,message:raw.message?.trim(),is_internal:isAdmin()&&raw.event_type==='interno'});
    if(error)throw error;toast('Interação registrada.');await showDetail(id);return;
  }else throw Error('Ação não autorizada.');
  closeModal();toast('Registro salvo.');await loadData(true);
}catch(e){toast(safe(e),true);}finally{if(submit)submit.disabled=false;}}
async function submitAuth(mode,form){const email=form.querySelector('#email')?.value.trim()||'';const password=form.querySelector('#password')?.value||'';const btn=form.querySelector('button[type="submit"]');if(btn)btn.disabled=true;try{
  if(mode==='login'){const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;await enter();}
  else if(mode==='recovery'){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});if(error)throw error;toast('Se o e-mail estiver cadastrado, receberá instruções de recuperação.');state.authMode='login';renderAuth();}
  else if(mode==='firstpass'){
   const confirm=form.querySelector('#password_confirm')?.value||'';
   if(password.length<12)throw Error('A nova senha precisa ter pelo menos 12 caracteres.');
   if(password!==confirm)throw Error('As senhas não coincidem.');
   const {error}=await sb.auth.updateUser({password});if(error)throw error;
   const {data:updated,error:checkError}=await sb.from('profiles').select('password_change_required').eq('id',state.user.id).single();
   if(checkError||!updated||updated.password_change_required)throw Error('Senha atualizada, mas a liberação ainda não foi confirmada. Atualize a página e tente novamente.');
   state.authMode='login';await loadData(true);toast('Senha substituída. Acesso liberado.');
  }
  else if(mode==='newpass'){const {error}=await sb.auth.updateUser({password});if(error)throw error;history.replaceState({},'',window.location.pathname);state.authMode='login';await enter();toast('Senha atualizada.');}
}catch(e){toast(safe(e),true);}finally{if(btn)btn.disabled=false;}}
function exportCSV(){const oo=visibleOpps();const csvSafe=x=>{let t=String(x??'');if(/^[\s]*[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};const records=[['Cliente','Corretor','Categoria','Bem referência','Valor bem','Crédito solicitado','Intenção lance','Valor lance','Parcela desejada','Urgência','Status','Cadastro'],...oo.map(o=>[clientName(o.client_id),brokerName(o.owner_id),productName(o.product_id),o.reference_asset,o.asset_value,o.credit_amount,o.bid_intention,o.bid_amount,o.max_installment,o.urgency,stages[o.stage],date(o.created_at)])];const data='\ufeff'+records.map(r=>r.map(csvSafe).join(';')).join('\r\n');const blob=new Blob([data],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='astrion_solicitacoes_cotacao.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function action(a,id){switch(a){case'toggle-login-password':{const el=document.querySelector('#password');const trigger=document.querySelector('.password-toggle');if(el){el.type=el.type==='password'?'text':'password';if(trigger){trigger.setAttribute('aria-pressed',String(el.type==='text'));trigger.setAttribute('aria-label',el.type==='text'?'Ocultar senha':'Mostrar senha');}}break;}case'menu':document.querySelector('#sidebar')?.classList.toggle('open');break;case'change-password':if(state.user&&state.profile&&!state.profile.password_change_required)modalChangePassword();break;case'logout':await sb?.auth.signOut({ scope: 'global' });state.user=null;state.profile=null;state.profiles=[];state.clients=[];state.opps=[];if(state.interval){clearInterval(state.interval);state.interval=null;}renderAuth();break;case'refresh':await loadData();break;case'new-client':modalClient();break;case'edit-client':modalClient(id);break;case'new-opp':modalOpportunity();break;case'edit-opp':closeModal();modalOpportunity(id);break;case'detail':await showDetail(id);break;case'new-quote':if(isAdmin())modalQuote(id);break;case'new-research':if(isAdmin())modalResearch(id);break;case'publish-quote':if(isAdmin()){const o=state.opps.find(x=>x.id===document.querySelector(`[data-action="publish-quote"][data-id="${id}"]`)?.dataset.opp);if(!o){toast('Solicitação indisponível',true);break;}const {error}=await sb.from('quote_options').update({published:true}).eq('id',id);if(error)toast(safe(error),true);else{await loadData(true);await showDetail(o.id);toast('Condição disponibilizada ao corretor.');}}break;case'send-opp':{const o=state.opps.find(x=>x.id===id);if(o&&!isAdmin()){if(!o.reference_asset||!(o.asset_value>0)||!(o.credit_amount>0)||o.bid_intention==='indefinido'||o.urgency==='a_definir'){modalOpportunity(id);toast('Complete os campos obrigatórios para enviar.',true);break;}const {error}=await sb.from('opportunities').update({stage:'enviada'}).eq('id',id);if(error)toast(safe(error),true);else{await loadData(true);await showDetail(id);toast('Solicitação enviada à Astrion.');}}}break;case'add-broker':if(isAdmin())modalBroker();break;case'edit-broker':if(isAdmin())modalBroker(id);break;case'print-request':if(isAdmin())printOpportunity(id,'request');break;
case'print-return':printOpportunity(id,'return');break;
case'dispatch':if(isAdmin())modalDispatch(id);break;
case'edit-catalog':if(isAdmin())modalCatalog(id);break;
case'edit-group':if(isAdmin())modalGroup(id);break;
case'add-group':if(isAdmin())modalGroup(null,id);break;
case'new-product':if(isAdmin())modalProduct();break;case'edit-product':if(isAdmin())modalProduct(id);break;case'close-modal':closeModal();break;case'go-home':returnHome();break;case'forgot':state.authMode='recovery';renderAuth();break;case'back-login':state.authMode='login';renderAuth();break;case'export':if(isAdmin())exportCSV();break;case'clear-filters':state.filterBroker='all';state.filterProduct='all';state.filterStage='all';state.search='';renderPage();break;}}
document.addEventListener('click',e=>{if(e.target?.dataset?.backdrop==='1'){closeModal();return;}const b=e.target.closest('[data-action],[data-nav]');if(!b)return;e.preventDefault();if(b.dataset.nav){state.page=b.dataset.nav;state.search='';renderShell();window.scrollTo(0,0);}else action(b.dataset.action,b.dataset.id);});
document.addEventListener('submit',async e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();const kind=form.dataset.form;form.dataset.intent=e.submitter?.dataset?.intent||'draft';if(['login','recovery','newpass','firstpass'].includes(kind)){await submitAuth(kind,form);return;}if(kind==='filters'){const x=formObject(form);state.search=(x.search||'').trim();state.filterBroker=x.broker||'all';state.filterProduct=x.product||'all';state.filterStage=x.stage||'all';renderPage();return;}await submitRecord(form);});
document.addEventListener('change',e=>{
 if(e.target?.name==='product_id'&&e.target.closest('form[data-form="opportunity"]')){
   const selected=state.products.find(p=>p.id===e.target.value);
   const segment=state.catalogSegments.find(x=>x.product_category===selected?.category);
   const list=document.querySelector('#asset-types-list');
   if(list)list.innerHTML=(segment?.asset_types||[]).map(t=>'<option value="'+H(t)+'"></option>').join('');
   const hint=document.querySelector('#catalog-hint');
   if(hint)hint.textContent=segment
     ?'Parâmetro comercial: '+BRL(segment.credit_min)+' a '+BRL(segment.credit_max)+' · até '+segment.max_term_months+' meses. Exigências e planos sujeitos à validação pela Âncora.'
     :'Nenhum parâmetro cadastrado para esta categoria.';
 }
 if(e.target?.name==='owner_id'&&e.target.closest('form[data-form="opportunity"]')){const select=document.querySelector('#client_id');if(select){select.innerHTML=state.clients.filter(c=>c.owner_id===e.target.value).map(c=>opt(c.id,c.full_name)).join('');}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
async function init(){if(!validConfig){renderConfig();return;}state.authMode=/(?:[&#?])type=recovery(?:&|$)/.test(location.href)?'newpass':'login';const {data:{session}}=await sb.auth.getSession();if(session&&state.authMode!=='newpass')await enter();else renderAuth();sb.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){state.authMode='newpass';renderAuth();}else if(event==='SIGNED_OUT'){state.user=null;state.profile=null;renderAuth();}else if(event==='SIGNED_IN'&&session&&!state.user&&state.authMode!=='newpass'){setTimeout(()=>enter(),0);}});}
init().catch(e=>{toast(safe(e),true);renderAuth();});
