import {ranking,bracket} from './core.js';
import {analytics,simulate} from './analytics.js';
import {richRanking,lineup,demoTotal,compareTeams,recordedLineup} from './demo-ranking.js';
import {competition} from './competition.js';
import {checkDb,readLeagues,readLeague,authorizeAdmin,writeScore} from './d1.js';
import {betaRoute} from './beta.js';
const VERSION='0.7.2';
const pilot={id:1,name:'Pernas de Pau • Liga piloto',season:2027,start_round:20,end_round:38,knockout_start:30,knockout_size:16};
const allTeams=['Atlético Aurora','Furacão FC','Vila United','Estrela FC','Real Zona Sul','Tricolor 27','Bola na Rede','Canarinho FC','Arena City','Alvorada','União FC','Guerreiros','Império FC','Fênix','Nova Geração','Raça FC'].map((name,i)=>({id:i+1,name,status:'approved'}));
const allScores=allTeams.flatMap(({id})=>Array.from({length:13},(_,j)=>{const round=20+j,i=id-1;return {teamId:id,round,points:demoTotal(id,round)};}));
const catalog=[{...pilot,description:'Segundo turno e mata-mata',visibility:'demo',teamCount:16},{...pilot,id:11,name:'Copa Arena',description:'Copa demonstrativa de oito times',knockout_size:8,teamCount:8,visibility:'demo'},{...pilot,id:12,name:'Liga dos Amigos',description:'Campeonato demonstrativo de oito times',knockout_size:8,teamCount:8,visibility:'demo'}];
const fixtures=[
 {home:'Aurora',away:'Vila',round:33,valid:true},{home:'Estrela',away:'União',round:33,valid:false},{home:'Fênix',away:'Alvorada',round:33,valid:true},
 {home:'Vila',away:'Estrela',round:34,valid:true},{home:'União',away:'Aurora',round:34,valid:true},
 {home:'Aurora',away:'Estrela',round:32,valid:true,homeGoals:2,awayGoals:1},{home:'Vila',away:'União',round:32,valid:true,homeGoals:0,awayGoals:0}
];
const headers={'X-VN-Arena-Version':VERSION,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
const json=(data,status=200)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store'}});
async function handle(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(!p.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido'},405);
  const r=await env.ASSETS.fetch(req),h=new Headers(r.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  if(req.method==='GET'&&h.get('Content-Type')?.includes('text/html')){
   const html=(await r.text()).replace(/<button data-tab="(?:join|admin)">[^<]*<\/button>/g,'').replace('AMBIENTE DE TESTE · Dados fictícios · Sem pagamentos','PRÉVIA CLOUDFLARE · Dados fictícios · Cadastro e administração desativados');h.delete('Content-Length');h.delete('ETag');h.set('Cache-Control','no-store');return new Response(html,{status:r.status,headers:h});
  }
  return new Response(r.body,{status:r.status,headers:h});
 }
 if(p.startsWith('/api/beta/'))return betaRoute(req,env,p,readInput,json);
 if(env.DB)await checkDb(env.DB);
 if(req.method==='GET'&&p==='/api/health')return json({ok:true,version:VERSION,mode:'demo',storage:env.DB?'d1':'none',payments:false});
 const raw=url.searchParams.get('league')??'1',id=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id)||id<1)return json({error:'Liga não encontrada'},404);
 if(req.method==='GET'&&p==='/api/leagues'){const list=env.DB?await readLeagues(env.DB):catalog;if(!list.some(l=>l.id===id))return json({error:'Liga não encontrada'},404);return json({leagues:list});}
 if(req.method==='POST'&&p==='/api/admin/score'){
  if(!env.DB)return json({error:'Recurso desativado na prévia Cloudflare'},403);
  await authorizeAdmin(req,env.ADMIN_API_TOKEN);
  return json(await writeScore(env.DB,id,await readInput(req)));
 }
 const sample=catalog.find(l=>String(l.id)===raw);
 if(!env.DB&&!sample)return json({error:'Liga não encontrada'},404);
 const sampleTeams=sample?.id===11?allTeams.slice(0,8):sample?.id===12?allTeams.slice(8):allTeams;
 const ids=new Set(sampleTeams.map(t=>t.id));
 const {league,teams,scores}=env.DB?await readLeague(env.DB,id):{league:sample,teams:sampleTeams,scores:allScores.filter(s=>ids.has(s.teamId))};
 if(req.method==='GET'&&p==='/api/analytics')return json(analytics(league,teams,scores));
 if(req.method==='GET'&&p==='/api/opponents'){
  const id=Number(url.searchParams.get('id')),round=Number(url.searchParams.get('round')||32);
  if(!Number.isInteger(round)||round<league.start_round||round>league.end_round||!Number.isSafeInteger(id)||id<1)return json({error:'Consulta inválida'},400);
  const selected=teams.find(t=>t.id===id);if(!selected)return json({error:'Time não encontrado nesta liga'},404);
  const byTeam=new Map(scores.filter(s=>s.round===round).map(s=>[s.teamId,s]));
  const left=recordedLineup(selected,round,byTeam.get(id));
  const opponents=left?teams.filter(t=>t.id!==id).map(t=>{
   const right=recordedLineup(t,round,byTeam.get(t.id)),c=compareTeams(left,right);
   if(!c)return {id:t.id,name:t.name,points:null,commonCount:null,difference:null};
   return {id:t.id,name:t.name,points:c.rightPoints,commonCount:c.commonCount,difference:c.difference};
  }).sort((a,b)=>(b.commonCount??-1)-(a.commonCount??-1)||(b.points??-Infinity)-(a.points??-Infinity)||a.id-b.id):[];
  return json({round,team:{id:selected.id,name:selected.name,points:left?.points??null},available:!!left,opponents,source:'demo'});
 }
 if(req.method==='GET'&&p==='/api/compare'){
  const a=Number(url.searchParams.get('a')),b=Number(url.searchParams.get('b')),round=Number(url.searchParams.get('round')||32);
  if(!Number.isInteger(round)||round<20||round>38||a===b)return json({error:'Comparação inválida'},400);
  const left=teams.find(t=>t.id===a),right=teams.find(t=>t.id===b);if(!left||!right)return json({error:'Time não encontrado nesta liga'},404);
  const profile=t=>recordedLineup(t,round,scores.find(s=>s.teamId===t.id&&s.round===round));
  return json({round,left:{id:left.id,name:left.name},right:{id:right.id,name:right.name},comparison:compareTeams(profile(left),profile(right)),source:'demo'});
 }
 if(req.method==='GET'&&p==='/api/team'){
  const id=Number(url.searchParams.get('id')),round=Number(url.searchParams.get('round')||32);
  if(!Number.isInteger(round)||round<20||round>38)return json({error:'Rodada inválida'},400);
  const team=teams.find(t=>t.id===id);if(!team)return json({error:'Time não encontrado'},404);
  const record=scores.find(s=>s.teamId===id&&s.round===round);
  return json({team:{id:team.id,name:team.name},round,points:record?.points??null,lineup:recordedLineup(team,round,record),source:'demo'});
 }
 if(req.method==='GET'&&p==='/api/overview'){
  const round=Number(url.searchParams.get('round')||32);if(!Number.isInteger(round)||round<1||round>38)return json({error:'Rodada inválida'},400);
  const richRank=richRanking(teams,scores,league,round),podium=richRank.filter(t=>t.played>0).slice(0,3).map(({id,name,crest,position,total})=>({id,name,crest,position,total}));
  const rank=ranking(teams,scores,20,38),best=rank.filter(t=>t.best!==null).sort((a,b)=>b.best-a.best||a.id-b.id)[0]||null;
  return json({league,source:{mode:'demo',live:false,label:env.DB?'Dados fictícios persistidos':'Dados fictícios'},rank,richRank,podium,competition:competition(league,teams,scores),round,latestDemoRound:32,fixtures,roundRank:ranking(teams,scores,round,round).filter(t=>t.played),best,bracket:bracket(teams,scores,{qualStart:league.start_round,qualEnd:league.knockout_start-1,start:league.knockout_start,size:league.knockout_size}),approved:teams.length});
 }
 if(req.method==='POST'&&p==='/api/simulate'){
  if(req.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origem inválida'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON'},415);
  const reader=req.body?.getReader();let size=0,chunks=[];if(!reader)return json({error:'JSON inválido'},400);
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'Corpo muito grande'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}const input=JSON.parse(new TextDecoder().decode(bytes));return json(simulate(league,teams,scores,input));}catch(e){return json({error:e.status?e.message:'JSON inválido'},e.status||400);}
 }
 return json({error:'Recurso desativado na prévia Cloudflare'},403);
}
async function readInput(req){
 const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
 if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'Origem inválida');
 if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON');
 const reader=req.body?.getReader();if(!reader)fail(400,'JSON inválido');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();fail(413,'Corpo muito grande');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'JSON inválido');}
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'JSON inválido');return data;
}
export default {async fetch(req,env){try{return await handle(req,env);}catch(e){return json({error:e.status?e.message:'Serviço de dados temporariamente indisponível'},e.status||503);}}};
