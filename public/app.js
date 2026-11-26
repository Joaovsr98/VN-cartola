import {rankingCsv,rankingText} from './share.js?v=0.6.7';
const $=s=>document.querySelector(s),el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};let csrf='';const leagueId=new URL(location.href).searchParams.get('league')||'1';const fmt=n=>n===null||n===undefined?'—':(n/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});const err=e=>$('#error').textContent=e.message;async function api(path,body){const r=await fetch('/api/'+path+(path.includes('?')?'&':'?')+'league='+encodeURIComponent(leagueId),body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});if(!r.headers.get('Content-Type')?.toLowerCase().includes('application/json'))throw Error('A API não respondeu corretamente. Verifique se o Worker está atualizado.');let data;try{data=await r.json();}catch{throw Error('Não foi possível interpretar a resposta da API. Tente novamente.');}if(!r.ok)throw Error(data.error||'Falha ao consultar o servidor.');return data;}function rows(id,list){const node=$(id);node.replaceChildren();if(!list.length)node.append(el('p','Nenhuma pontuação registrada.'));for(const t of list){const row=el('div',undefined,'rankrow'),name=el('div',t.name);if(t.manager)name.append(el('small',t.manager));row.append(el('b',String(t.position).padStart(2,'0')),name,el('b',fmt(t.total),'num'));node.append(row);}}function matches(b){
 const node=$('#matches');node.replaceChildren();
 if(!b.ready){node.append(el('p',b.qualified+' de '+b.required+' classificados.'));return;}
 const scroller=el('div',undefined,'bracket-scroll');scroller.tabIndex=0;scroller.setAttribute('aria-label','Fases do mata-mata; deslize horizontalmente');
 for(const stage of b.stages){
  const col=el('section',undefined,'bracket-stage');
  const names={16:'16 avos',8:'Oitavas',4:'Quartas',2:'Semifinal',1:'Final'};
  col.append(el('h3',names[stage.matches.length]||'Eliminatória'),el('small','Rodada '+stage.round));
  for(const m of stage.matches){
   const card=el('div',undefined,'bracket-card');
   for(const [team,points] of [[m.a,m.pa],[m.b,m.pb]]){
    const won=Boolean(team&&m.winner&&team.id===m.winner.id);
    const line=el('div',undefined,'bracket-team'+(won?' bracket-winner':''));
    line.append(el('span',(won?'✓ ':'')+(team?.name||'A definir')),el('b',fmt(points)));card.append(line);
   }
   card.append(el('small',m.winner?'Classificado':'Aguardando resultado','bracket-status'));col.append(card);
  }scroller.append(col);
 }
 node.append(el('p','Deslize para acompanhar todas as fases.','bracket-hint'),scroller);
 if(b.champion){const result=el('div',undefined,'champion-card');result.append(el('small','CAMPEÃO DO MATA-MATA'),el('strong',b.champion.name));node.append(result);}
 if(b.third)node.append(el('p','Disputa de 3º: '+b.third.a.name+' × '+b.third.b.name+' — '+(b.third.winner?.name||'A definir')));
}
async function refresh(){const d=await api('overview?round='+$('#roundSelect').value);$('#leagueName').textContent=d.league.name;$('#leagueRules').textContent='Rodadas '+d.league.start_round+' a '+d.league.end_round+' · Pontos acumulados';$('#bracketRules').textContent=d.league.knockout_size+' classificados até a rodada '+(d.league.knockout_start-1)+'. Disputa a partir da '+d.league.knockout_start+'ª.';$('#count').textContent=d.approved;$('#leader').textContent=d.rank[0]?.name||'—';$('#best').textContent=fmt(d.best?.best);renderRanking(d);renderPodium(d);renderHome(d);renderCompetition(d);renderFavorites();rows('#roundRank',d.roundRank);matches(d.bracket);}async function admin(){const d=await api('admin');csrf=d.csrf;$('#loginForm').hidden=true;$('#adminContent').hidden=false;const list=$('#teamList'),select=$('#scoreForm select');list.replaceChildren();select.replaceChildren();for(const t of d.teams){const row=el('div',undefined,'team');row.append(el('span',`#${t.id} · ${t.name} · ${{pending:'Pendente',approved:'Aprovado',rejected:'Recusado'}[t.status]}`));for(const [status,label] of [['approved','Aprovar'],['rejected','Recusar'],['pending','Pendente']]){if(t.status===status)continue;const b=el('button',label);b.onclick=()=>api('admin/status',{teamId:t.id,status}).then(()=>Promise.all([admin(),refresh()])).catch(err);row.append(b);}list.append(row);if(t.status==='approved'){const o=el('option',t.name);o.value=t.id;select.append(o);}}$('#logs').replaceChildren(...d.logs.map(l=>el('p',`${l.created_at} · ${l.action}: ${l.detail}`)));}for(let i=1;i<=38;i++){const o=el('option',i);o.value=i;$('#roundSelect').append(o);}$('#roundSelect').value=32;$('#roundSelect').onchange=()=>refresh().catch(err);document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===b.dataset.tab));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==b.dataset.tab);$('#error').textContent='';if(b.dataset.tab==='admin')admin().catch(()=>{$('#adminContent').hidden=true;$('#loginForm').hidden=false;});if(b.dataset.tab==='join')account();if(b.dataset.tab==='analytics')loadAnalytics().catch(err);});$('#joinForm').onsubmit=async e=>{e.preventDefault();try{await api('join',Object.fromEntries(new FormData(e.target)));$('#joinResult').textContent='Inscrição registrada. Aguarde aprovação.';e.target.reset();await account();}catch(e){err(e);}};$('#loginForm').onsubmit=async e=>{e.preventDefault();try{const d=await api('login',Object.fromEntries(new FormData(e.target)));csrf=d.csrf;e.target.reset();await admin();}catch(e){err(e);}};$('#scoreForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await api('admin/score',{teamId:+d.teamId,round:+d.round,points:+d.points});await Promise.all([refresh(),admin()]);$('#error').textContent='Pontuação salva.';}catch(e){err(e);}};$('#logout').onclick=()=>api('admin/logout',{}).then(()=>{csrf='';$('#adminContent').hidden=true;$('#loginForm').hidden=false;}).catch(err);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
async function account(){try{const d=await api('account/me');csrf=d.csrf;$('#accountGuest').hidden=true;$('#accountMember').hidden=false;$('#joinForm').hidden=!!d.membership;$('#membership').textContent=d.membership?`${d.membership.name} · ${{pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Recusado'}[d.membership.status]}`:'Conta criada. Solicite sua inscrição.';}catch(e){$('#accountGuest').hidden=false;$('#accountMember').hidden=true;}}
$('#accountForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{const d=await api('account/'+(e.submitter?.value==='register'?'register':'login'),data);csrf=d.csrf;e.target.reset();await account();}catch(e){err(e);}};$('#accountLogout').onclick=async()=>{try{await api('account/logout',{});csrf='';await account();}catch(e){err(e);}};

async function loadLeagues(){const d=await api('leagues');leagueCatalog=d.leagues;renderLeagueCards();const select=$('#leagueSelect');select.replaceChildren();for(const l of d.leagues){const o=el('option',l.name+' · '+l.season);o.value=l.id;select.append(o);}select.value=leagueId;select.onchange=()=>{location.href='/?league='+encodeURIComponent(select.value);};}
$('#leagueForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));for(const k of ['season','start_round','end_round','knockout_start','knockout_size'])data[k]=Number(data[k]);try{const d=await api('admin/leagues',data);location.href='/?league='+d.leagueId;}catch(e){err(e);}};// League catalog loads after UI initialization.

let validatedImport=null;
const importForm=$('#importForm'),applyImport=$('#applyImport');
importForm.rows.oninput=()=>{validatedImport=null;applyImport.disabled=true;$('#importResult').textContent='';};
importForm.onsubmit=async e=>{e.preventDefault();try{const raw=importForm.rows.value.trim();const rows=raw.split(/\r?\n/).filter(l=>l.trim()).map(l=>{const parts=l.split(';').map(s=>s.trim());if(parts.length!==3||!parts.every(Boolean))throw Error('Use ID;rodada;pontos em cada linha.');return {teamId:Number(parts[0]),round:Number(parts[1]),points:Number(parts[2].replace(',','.'))};});const apply=e.submitter?.value==='apply';if(apply&&validatedImport!==raw)throw Error('Valide o lote novamente.');const d=await api('admin/import',{rows,apply});const result=$('#importResult');result.replaceChildren(el('p',`${d.total} linhas · ${d.changed} alterações · ${d.unchanged} sem alteração${apply?' · Aplicado':' · Prévia'}`));for(const r of d.rows.filter(r=>r.points!==r.previous))result.append(el('div',`#${r.teamId} · R${r.round}: ${fmt(r.previous)} → ${fmt(r.points)}`));validatedImport=apply?null:raw;applyImport.disabled=apply;if(apply)await Promise.all([refresh(),admin()]);}catch(e){validatedImport=null;applyImport.disabled=true;err(e);}};

let stats=null;
function showHistory(){const t=stats?.teams.find(t=>t.id===Number($('#historyTeam').value));$('#historySummary').textContent=t?'Total: '+fmt(t.total)+' · Média: '+fmt(t.average)+' · Melhor: '+fmt(t.best):'Nenhum time aprovado.';$('#historyRows').replaceChildren(...(t?.history||[]).map(r=>{const row=el('div',undefined,'historyrow');row.append(el('span','Rodada '+r.round),el('strong',fmt(r.points)));return row;}));$('#simulationResult').textContent='';$('#simulationForm').hidden=!t;}
async function loadAnalytics(){stats=await api('analytics');const select=$('#historyTeam'),previous=select.value;select.replaceChildren(...stats.teams.map(t=>{const o=el('option',t.name);o.value=t.id;return o;}));if(stats.teams.some(t=>String(t.id)===previous))select.value=previous;select.onchange=showHistory;showHistory();}
$('#simulationForm').onsubmit=async e=>{e.preventDefault();try{const data=new FormData(e.target);const d=await api('simulate',{teamId:Number($('#historyTeam').value),round:Number(data.get('round')),points:Number(data.get('points'))});$('#simulationResult').textContent=d.previous.position+'º → '+d.projected.position+'º | '+fmt(d.projected.total)+' pontos projetados. Simulação não salva.';}catch(e){err(e);}};

let richData=null,detailRequest=0;
const rankSearch=$('#rankSearch'),rankSort=$('#rankSort'),rankRound=$('#rankRound'),teamDialog=$('#teamDialog');
function movement(v){return v==null?'—':v===0?'=':v>0?'+'+v:String(v);}
function signed(v){return v==null?'—':(v>0?'+':'')+fmt(v);}
function renderRanking(d){richData=d.richRank??null;$('#rankTools').hidden=!richData;$('#rankColumns').hidden=!richData;
 if(!richData){rows('#rank',d.rank);return;}
 rankRound.replaceChildren();for(let r=d.league.start_round;r<=d.league.end_round;r++){const o=el('option','Rodada '+r);o.value=r;rankRound.append(o);}rankRound.value=String(d.round);drawRich();}
function drawRich(){
 if(!richData)return;
 const query=rankSearch.value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const normalize=v=>v.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 let list=[...richData];if(rankSort.value==='round')list.sort((a,b)=>(b.roundPoints??-Infinity)-(a.roundPoints??-Infinity)||a.position-b.position);
 list=list.filter(t=>normalize(t.name+' '+t.manager).includes(query));const root=$('#rank');root.replaceChildren();
 for(const t of list){
  const row=el('button',undefined,'richrow');row.type='button';row.setAttribute('aria-label','Ver escalação de '+t.name);
  const pos=el('div',undefined,'rankpos'),mv=el('small',movement(t.movement),t.movement>0?'gain':t.movement<0?'loss':'');pos.append(el('b',t.position+'º'),mv);
  const crest=el('span',t.crest,'crest crest-'+((t.id-1)%4));crest.setAttribute('aria-hidden','true');
  const info=el('div',undefined,'rankname');info.append(el('strong',t.name),el('small',t.manager),el('small',t.captain?'C · '+t.captain:'Capitão —'));
  const partial=el('div',undefined,'ranknums');partial.append(el('b',fmt(t.roundPoints)),el('small',t.patrimony==null?'C$ —':'C$ '+fmt(t.patrimony)),el('small',signed(t.valuation),t.valuation>0?'gain':t.valuation<0?'loss':''));
  const total=el('div',undefined,'ranknums ranktotal');total.append(el('strong',fmt(t.total)),el('small',t.leaderGap===0?'Líder / empate':'−'+fmt(t.leaderGap)));
  row.append(pos,crest,info,partial,total);row.onclick=()=>openTeam(t);root.append(row);
 }if(!list.length)root.append(el('p','Nenhum participante encontrado.'));
}
let detailTeam=null,detailRound=32,detailMode='field',compareRequest=0,detailLineup=null,opponentsRequest=0,opponentsCache=null;
function detailView(mode){detailMode=mode;$('#pitchSection').hidden=mode!=='field'||!detailLineup;$('#teamPlayers').hidden=mode!=='list'||!detailLineup;$('#comparePanel').hidden=mode!=='compare';for(const [id,key] of [['#showField','field'],['#showList','list'],['#showCompare','compare']]){$(id).classList.toggle('active',mode===key);$(id).setAttribute('aria-pressed',String(mode===key));}if(mode==='compare')loadComparison();}
function openTeam(t){detailTeam=t;detailRound=Number(rankRound.value)||32;detailMode='field';return loadTeam();}
async function loadTeam(){
 const t=detailTeam;if(!t)return;const request=++detailRequest;++compareRequest;++opponentsRequest;opponentsCache=null;$('#loadOpponents').disabled=false;detailLineup=null;activeFavoriteTeam=t.id;updateFavoriteButtons();$('#teamTitle').textContent=t.name;$('#detailRound').textContent='Rodada '+detailRound;$('#detailPrev').disabled=detailRound<=20;$('#detailNext').disabled=detailRound>=38;$('#teamSubtitle').textContent='Carregando escalação demonstrativa…';
 for(const id of ['#teamPlayers','#pitch','#detailMetrics','#compareResult','#opponentsResult'])$(id).replaceChildren();
 for(const id of ['#pitchSection','#teamBudget','#coachInfo','#detailMetrics','#detailView','#comparePanel','#teamPlayers'])$(id).hidden=true;
 if(!teamDialog.open)teamDialog.showModal();
 try{const d=await api('team?id='+t.id+'&round='+detailRound);if(request!==detailRequest||!teamDialog.open)return;
 $('#teamSubtitle').textContent='Rodada '+d.round+' · Dados fictícios'+(d.lineup?' · '+fmt(d.lineup.points)+' pontos':' · Sem pontuação registrada');
 if(!d.lineup)return;detailLineup=d.lineup;$('#detailView').hidden=false;renderPitch(d.lineup);renderBudget(d.lineup);
 const metrics=$('#detailMetrics');metrics.hidden=false;for(const [label,value] of [['Titulares com pontos',d.lineup.players.filter(p=>p.starter&&p.points!=null).length+'/11'],['Com capitão',fmt(d.lineup.points)],['Sem bônus de capitão',fmt(d.lineup.withoutCaptain)]]){const box=el('div');box.append(el('small',label),el('strong',value));metrics.append(box);}
 for(const starter of [true,false]){$('#teamPlayers').append(el('h3',starter?'Titulares':'Reservas'));for(const p of d.lineup.players.filter(p=>p.starter===starter)){const row=el('div',undefined,'playerrow'),name=el('div',p.name+(p.captain?' · C':''));name.append(el('small',p.position+' · '+p.club+(p.price==null?'':' · C$ '+fmt(p.price))));const points=el('div',undefined,'ranknums');points.append(el('strong',fmt(p.points)),el('small',p.valuation==null?'—':signed(p.valuation),p.valuation>0?'gain':p.valuation<0?'loss':''));row.append(name,points);$('#teamPlayers').append(row);}}
 const select=$('#compareTeam'),previous=select.value;select.replaceChildren();for(const other of (richData||[]).filter(x=>x.id!==t.id)){const o=el('option',other.name);o.value=other.id;select.append(o);}if([...select.options].some(o=>o.value===previous))select.value=previous;$('#showCompare').disabled=!select.options.length;detailView(detailMode);
 }catch(e){if(request===detailRequest)$('#teamSubtitle').textContent=e.message;}
}
async function loadComparison(){
 const target=Number($('#compareTeam').value);if(!target||!detailTeam||!detailLineup)return;const req=++compareRequest,root=$('#compareResult');root.textContent='Comparando…';
 try{const d=await api('compare?a='+detailTeam.id+'&b='+target+'&round='+detailRound);if(req!==compareRequest||!teamDialog.open||detailMode!=='compare')return;root.replaceChildren();const c=d.comparison;if(!c){root.append(el('p','Sem resultados para comparar.'));return;}
 const score=el('div',undefined,'compare-score');for(const [name,points] of [[d.left.name,c.leftPoints],[d.right.name,c.rightPoints]]){const cell=el('div');cell.append(el('small',name),el('strong',fmt(points)));score.append(cell);}root.append(score,el('p',c.commonCount+' titulares em comum · Diferença: '+fmt(Math.abs(c.difference))+' pts'),el('small','Dados fictícios · destaque verde: mesmo atleta. C indica capitão.'));
 for(const group of c.groups){root.append(el('h3',group.position));for(const item of group.rows){const row=el('div',undefined,'compare-row'+(item.common?' common-player':''));for(const p of [item.left,item.right]){const cell=el('div',undefined,'compare-cell');cell.append(el('strong',p?p.name+(p.captain?' · C':''):'—'),el('b',fmt(p?.points)),el('small',p?p.club+' · '+signed(p.valuation):''));row.append(cell);}root.append(row);}}
 }catch(e){if(req===compareRequest)root.textContent=e.message;}
}
async function loadOpponents(){
 const root=$('#opponentsResult');if(!detailTeam||!detailLineup)return;
 const req=++opponentsRequest,button=$('#loadOpponents');button.disabled=true;root.textContent='Consultando adversários…';
 try{
  const d=opponentsCache||await api('opponents?id='+detailTeam.id+'&round='+detailRound);
  if(req!==opponentsRequest||!teamDialog.open)return;opponentsCache=d;root.replaceChildren();
  if(!d.available||!d.opponents.length){root.append(el('p','Nenhum adversário com resultados disponíveis.'));return;}
  for(const t of d.opponents){const row=el('button',undefined,'opponent-row');row.type='button';const info=el('div',undefined,'opponent-info');info.append(el('strong',t.name),el('small',t.points==null?'Sem resultado':fmt(t.points)+' pts · diferença '+signed(t.difference)+' pts'));const common=el('strong',t.commonCount==null?'—':t.commonCount+'/11','opponent-count');row.append(info,common);row.disabled=t.commonCount==null;row.onclick=()=>{$('#compareTeam').value=String(t.id);loadComparison();$('#compareResult').scrollIntoView({block:'nearest'});};root.append(row);}
 }catch(e){if(req===opponentsRequest)root.textContent=e.message;}finally{if(req===opponentsRequest)button.disabled=false;}
}
$('#loadOpponents').onclick=loadOpponents;
$('#showField').onclick=()=>detailView('field');$('#showList').onclick=()=>detailView('list');$('#showCompare').onclick=()=>detailView('compare');$('#compareTeam').onchange=loadComparison;
$('#detailPrev').onclick=()=>{detailRound=Math.max(20,detailRound-1);loadTeam();};$('#detailNext').onclick=()=>{detailRound=Math.min(38,detailRound+1);loadTeam();};
rankSearch.oninput=drawRich;rankSort.onchange=drawRich;rankRound.onchange=()=>{$('#roundSelect').value=rankRound.value;refresh().catch(err);};
$('#closeTeam').onclick=()=>teamDialog.close();teamDialog.addEventListener('close',()=>{detailRequest++;compareRequest++;opponentsRequest++;});
function renderPodium(d){
 const section=$('#podiumSection'),root=$('#podium'),list=d.podium||[];root.replaceChildren();section.hidden=!list.length;
 if(!list.length)return;
 $('#podiumRound').textContent='Até a rodada '+d.round+' · parcial';
 for(const pos of [2,1,3]){
  const t=list.find(x=>x.position===pos);if(!t)continue;
  const button=el('button',undefined,'podium-card podium-'+pos);button.type='button';button.setAttribute('aria-label','Ver escalação de '+t.name+', '+pos+'º colocado');
  const crest=el('span',t.crest,'crest crest-'+((t.id-1)%4));crest.setAttribute('aria-hidden','true');
  button.append(el('small',pos+'º LUGAR'),crest,el('strong',t.name),el('b',fmt(t.total)),el('small','pontos'));button.onclick=()=>openTeam(t);root.append(button);
 }
}
function renderPitch(lineup){
 const root=$('#pitch');root.replaceChildren();$('#pitchSection').hidden=!Array.isArray(lineup.formation);
 if(!lineup.formation)return;
 $('#formationLabel').textContent=lineup.formationLabel||'';
 for(const group of lineup.formation){
  const row=el('div',undefined,'pitch-line');row.setAttribute('aria-label',group.label);
  for(const p of group.players){
   const player=el('div',undefined,'pitch-player'),shirt=el('span',p.captain?'C':p.position,'pitch-shirt club-shirt-'+(['Aurora','Vila','Estrela','União','Fênix'].indexOf(p.club)+5)%5+(p.captain?' captain-shirt':''));
   player.append(shirt,el('strong',p.name),el('b',fmt(p.points)));row.append(player);
  }
  root.append(row);
 }
}

let dashboard=null;
function renderGames(root,fixtures){
 root.replaceChildren();if(!fixtures?.length){root.append(el('p','Sem jogos registrados nesta rodada demonstrativa.'));return;}
 for(const f of fixtures){const card=el('article',undefined,'fixture');card.append(el('small','RODADA '+f.round+' · SIMULAÇÃO'));const row=el('div',undefined,'fixture-teams');
 for(const [name,side] of [[f.home,'home'],[f.away,'away']]){const club=el('div',undefined,'fixture-club'),crest=el('span',name.slice(0,3).toUpperCase(),'crest crest-'+(side==='home'?0:1));club.append(crest,el('strong',name));if(side==='home')row.append(club,el('b',Number.isInteger(f.homeGoals)&&Number.isInteger(f.awayGoals)?f.homeGoals+' × '+f.awayGoals:'– × –'));else row.append(club);}
 card.append(row,el('small',f.valid?'Válido na simulação':'Não válido na simulação',f.valid?'gain':'fixture-invalid'),el('small',' · Sem data oficial'));root.append(card);}
}
function renderHome(d){
 dashboard=d;document.querySelectorAll('.local-only').forEach(b=>b.hidden=d.source?.mode!=='manual'||(b.dataset.go&&!document.querySelector('nav button[data-tab="'+b.dataset.go+'"]')));$('#homeRound').textContent=d.latestDemoRound?'Rodada '+d.latestDemoRound+' · demonstração':'Temporada '+d.league.season;
 const box=$('#homeSummary');box.replaceChildren();
 for(const [label,value] of [['Times aprovados',String(d.approved)],['Líder',d.richRank?.[0]?.name||d.rank[0]?.name||'—'],['Maior pontuação',fmt(d.best?.best)]]){const item=el('div');item.append(el('small',label),el('strong',value));box.append(item);}
 renderGames($('#homeGames'),d.fixtures?.filter(f=>f.round===33).slice(0,2));renderGameRound();$('#shareRank').disabled=!d.richRank?.length;$('#exportRank').disabled=!d.richRank?.length;
 const select=$('#myTeamSelect'),previous=select.value;select.replaceChildren();for(const t of d.richRank||[]){const o=el('option',t.name);o.value=t.id;select.append(o);}if([...select.options].some(o=>o.value===previous))select.value=previous;renderMyTeam();
}
function renderMyTeam(){const t=dashboard?.richRank?.find(t=>t.id===Number($('#myTeamSelect').value)),root=$('#myTeamSummary');root.replaceChildren();$('#openMyTeam').disabled=!t;updateFavoriteButtons();if(!t){root.append(el('p','Escalações demonstrativas disponíveis na prévia Cloudflare.'));return;}const card=el('div',undefined,'home-summary');for(const [label,value] of [['Cartoleiro',t.manager],['Total',fmt(t.total)],['Patrimônio',t.patrimony==null?'—':'C$ '+fmt(t.patrimony)]]){const item=el('div');item.append(el('small',label),el('strong',value));card.append(item);}root.append(card);}
$('#myTeamSelect').onchange=renderMyTeam;
$('#openMyTeam').onclick=()=>{const t=dashboard?.richRank?.find(t=>t.id===Number($('#myTeamSelect').value));if(t)openTeam(t);};
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{document.querySelector('nav button[data-tab="'+b.dataset.go+'"]')?.click();});
function renderBudget(lineup){const root=$('#teamBudget'),coach=$('#coachInfo');root.replaceChildren();coach.replaceChildren();root.hidden=!lineup.budget;coach.hidden=!lineup.coach;if(lineup.budget){for(const [label,value] of [['Patrimônio',lineup.budget.patrimony],['Seu time',lineup.budget.teamCost],['Restante',lineup.budget.remaining]]){const item=el('div');item.append(el('small',label),el('strong','C$ '+fmt(value)));root.append(item);}}if(lineup.coach){coach.append(el('small','TÉCNICO · PREÇO ILUSTRATIVO'),el('strong',lineup.coach.name+' · '+lineup.coach.club),el('span','C$ '+fmt(lineup.coach.price)));}}

let activeFavoriteTeam=null;
const favoriteKey='vn-arena-favorites:'+leagueId;
let favorites=new Set();
try{const raw=JSON.parse(localStorage.getItem(favoriteKey));if(Array.isArray(raw))favorites=new Set(raw.filter(v=>Number.isSafeInteger(v)&&v>0).slice(0,100));}catch{}
function toggleFavorite(id){if(!dashboard?.richRank?.some(t=>t.id===id))return;if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{localStorage.setItem(favoriteKey,JSON.stringify([...favorites]));}catch{ $('#error').textContent='Favorito mantido apenas nesta sessão.';}updateFavoriteButtons();renderFavorites();}
function updateFavoriteButtons(){const my=Number($('#myTeamSelect').value),valid=id=>dashboard?.richRank?.some(t=>t.id===id);const a=$('#favoriteMyTeam'),b=$('#favoriteDialog');a.disabled=!valid(my);a.textContent=favorites.has(my)?'★ Favorito':'☆ Favoritar';a.setAttribute('aria-pressed',String(favorites.has(my)));b.hidden=!valid(activeFavoriteTeam);b.textContent=favorites.has(activeFavoriteTeam)?'★ Remover favorito':'☆ Favoritar time';b.setAttribute('aria-pressed',String(favorites.has(activeFavoriteTeam)));}
$('#favoriteMyTeam').onclick=()=>toggleFavorite(Number($('#myTeamSelect').value));
$('#favoriteDialog').onclick=()=>toggleFavorite(activeFavoriteTeam);
function renderFavorites(){const root=$('#favoriteList');root.replaceChildren();const list=(dashboard?.richRank||[]).filter(t=>favorites.has(t.id));if(!list.length){root.append(el('p','Nenhum favorito nesta liga. Abra um time no ranking para acompanhar.'));return;}for(const t of list){const item=el('div',undefined,'favorite-row'),crest=el('span',t.crest,'crest crest-'+((t.id-1)%4)),info=el('div',undefined,'favorite-info');info.append(el('strong',t.name),el('small',t.position+'º · '+fmt(t.total)+' pts'));const open=el('button','Ver time'),remove=el('button','Remover');open.onclick=()=>openTeam(t);remove.onclick=()=>toggleFavorite(t.id);item.append(crest,info,open,remove);root.append(item);}}
function renderCompetition(d){
 const c=d.competition,progress=$('#competitionProgress'),awards=$('#awards'),rules=$('#competitionRules'),history=$('#championHistory');for(const root of [progress,awards,rules,history])root.replaceChildren();
 if(!c){progress.append(el('p','Central demonstrativa disponível na prévia Cloudflare.'));return;}
 const meter=el('progress');meter.max=c.totalRounds;meter.value=c.completedRounds;meter.setAttribute('aria-label','Rodadas com resultados completos');progress.append(el('strong',c.completedRounds+' de '+c.totalRounds+' rodadas com resultados completos'),meter,el('small','Resultados da base fictícia; não representam fechamento oficial.'));
 for(const award of c.awards){const item=el('article',undefined,'award-card');item.append(el('h4',award.label),el('small',award.status==='finished'?'Resultado da simulação':award.status==='waiting'?'Aguardando classificação':'Em andamento · provisório'));for(const t of award.positions){const line=el('div',undefined,'award-position');line.append(el('span',t.position+'º · '+t.name),el('b',t.points==null?'':fmt(t.points)+' pts'+(t.round?' · R'+t.round:'')));item.append(line);}if(!award.positions.length)item.append(el('p','Resultado ainda não definido.'));awards.append(item);}
 const rulesList=['Temporada '+c.season+' · Rodadas '+c.rules.start+' a '+c.rules.end,'Campeonato: maior soma de pontos; desempate pela melhor rodada e depois ID do time.','Mata-mata: '+c.rules.knockoutSize+' classificados, início na rodada '+c.rules.knockoutStart+'. Empates favorecem a melhor posição de classificação.','Mito: maior pontuação em uma rodada; empate pela rodada mais antiga e depois ID.','Regulamento provisório da demonstração. Não há cobrança ou prêmios financeiros.'];for(const rule of rulesList)rules.append(el('p',rule));
 if(!c.history.length)history.append(el('p','Nenhuma temporada encerrada nesta demonstração.'));else for(const entry of c.history){history.append(el('p',entry.season+' · '+entry.league+' · '+(entry.champion?.name||'Sem campeão')+' · simulação'));}
}

let leagueCatalog=[],gameRound=33;
function renderLeagueCards(){const root=$('#leagueCards'),q=$('#leagueSearch').value.trim().toLocaleLowerCase('pt-BR');root.replaceChildren();for(const l of leagueCatalog.filter(l=>l.name.toLocaleLowerCase('pt-BR').includes(q))){const card=el('button',undefined,'league-card');card.type='button';const crest=el('span',l.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(),'crest crest-'+(l.id%4)),info=el('div',undefined,'league-card-info');info.append(el('strong',l.name),el('small',l.description||'Temporada '+l.season),el('small','Rodadas '+l.start_round+'–'+l.end_round));card.append(crest,info,el('span',String(l.teamCount??'')+(l.teamCount!=null?' times':'')),el('span','›'));card.onclick=()=>{location.href='/?league='+encodeURIComponent(l.id)+'#ranking';};root.append(card);}if(!root.children.length)root.append(el('p','Nenhuma liga encontrada.'));}
$('#leagueSearch').oninput=renderLeagueCards;
function renderGameRound(){$('#gameRound').textContent='Rodada '+gameRound;$('#gamePrev').disabled=gameRound<=1;$('#gameNext').disabled=gameRound>=38;renderGames($('#gameList'),dashboard?.fixtures?.filter(f=>f.round===gameRound));}
$('#gamePrev').onclick=()=>{gameRound=Math.max(1,gameRound-1);renderGameRound();};$('#gameNext').onclick=()=>{gameRound=Math.min(38,gameRound+1);renderGameRound();};
$('#reloadRank').onclick=async()=>{try{await refresh();$('#shareStatus').textContent='Classificação atualizada.';}catch(e){err(e);}};
$('#shareRank').onclick=async()=>{if(!dashboard?.richRank)return;const text=rankingText(dashboard.league.name,dashboard.round,dashboard.richRank),fallback=$('#shareFallback');try{if(navigator.share)await navigator.share({title:'VN Arena',text});else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw Error('Compartilhamento indisponível');$('#shareStatus').textContent='Classificação preparada para compartilhar.';}catch(e){if(e.name==='AbortError')return;fallback.hidden=false;fallback.value=text;fallback.focus();fallback.select();$('#shareStatus').textContent='Copie o texto selecionado para compartilhar.';}};
$('#exportRank').onclick=()=>{if(!dashboard?.richRank)return;const data=rankingCsv(dashboard.league.name,dashboard.round,dashboard.richRank),url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const link=el('a');link.href=url;link.download='vn-arena-liga-'+dashboard.league.id+'-rodada-'+dashboard.round+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(location.hash==='#ranking')document.querySelector('nav button[data-tab="ranking"]')?.click();
loadLeagues().catch(err);
refresh().catch(err);
