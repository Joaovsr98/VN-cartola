import {ranking,bracket} from './core.js';
import {analytics,simulate} from './analytics.js';
import {richRanking,lineup,demoTotal,compareTeams} from './demo-ranking.js';
import {competition} from './competition.js';
const VERSION='0.6.8';
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
export default {async fetch(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(!p.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido'},405);
  const r=await env.ASSETS.fetch(req),h=new Headers(r.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  if(req.method==='GET'&&h.get('Content-Type')?.includes('text/html')){
   const html=(await r.text()).replace(/<button data-tab="(?:join|admin)">[^<]*<\/button>/g,'').replace('AMBIENTE DE TESTE · Dados fictícios · Sem pagamentos','PRÉVIA CLOUDFLARE · Dados fictícios · Cadastro e administração desativados');h.delete('Content-Length');h.delete('ETag');h.set('Cache-Control','no-store');return new Response(html,{status:r.status,headers:h});
  }
  return new Response(r.body,{status:r.status,headers:h});
 }
 if(req.method==='GET'&&p==='/api/health')return json({ok:true,version:VERSION,mode:'demo',storage:'none',payments:false});
 const raw=url.searchParams.get('league')??'1';
 const league=catalog.find(l=>String(l.id)===raw);
 if(!league)return json({error:'Liga não encontrada'},404);
 const teams=league.id===11?allTeams.slice(0,8):league.id===12?allTeams.slice(8):allTeams;
 const ids=new Set(teams.map(t=>t.id));
 const scores=allScores.filter(s=>ids.has(s.teamId));
 if(req.method==='GET'&&p==='/api/leagues')return json({leagues:catalog});
 if(req.method==='GET'&&p==='/api/analytics')return json(analytics(league,teams,scores));
 if(req.method==='GET'&&p==='/api/compare'){
  const a=Number(url.searchParams.get('a')),b=Number(url.searchParams.get('b')),round=Number(url.searchParams.get('round')||32);
  if(!Number.isInteger(round)||round<20||round>38||a===b)return json({error:'Comparação inválida'},400);
  const left=teams.find(t=>t.id===a),right=teams.find(t=>t.id===b);if(!left||!right)return json({error:'Time não encontrado nesta liga'},404);
  const profile=t=>lineup(t,round,scores.find(s=>s.teamId===t.id&&s.round===round)?.points??null);
  return json({round,left:{id:left.id,name:left.name},right:{id:right.id,name:right.name},comparison:compareTeams(profile(left),profile(right)),source:'demo'});
 }
 if(req.method==='GET'&&p==='/api/team'){
  const id=Number(url.searchParams.get('id')),round=Number(url.searchParams.get('round')||32);
  if(!Number.isInteger(round)||round<20||round>38)return json({error:'Rodada inválida'},400);
  const team=teams.find(t=>t.id===id);if(!team)return json({error:'Time não encontrado'},404);
  const points=scores.find(s=>s.teamId===id&&s.round===round)?.points??null;
  return json({team:{id:team.id,name:team.name},round,lineup:lineup(team,round,points),source:'demo'});
 }
 if(req.method==='GET'&&p==='/api/overview'){
  const round=Number(url.searchParams.get('round')||32);if(!Number.isInteger(round)||round<1||round>38)return json({error:'Rodada inválida'},400);
  const richRank=richRanking(teams,scores,league,round),podium=richRank.filter(t=>t.played>0).slice(0,3).map(({id,name,crest,position,total})=>({id,name,crest,position,total}));
  const rank=ranking(teams,scores,20,38),best=rank.filter(t=>t.best!==null).sort((a,b)=>b.best-a.best||a.id-b.id)[0]||null;
  return json({league,source:{mode:'demo',live:false,label:'Dados fictícios'},rank,richRank,podium,competition:competition(league,teams,scores),round,latestDemoRound:32,fixtures,roundRank:ranking(teams,scores,round,round).filter(t=>t.played),best,bracket:bracket(teams,scores,{qualStart:league.start_round,qualEnd:league.knockout_start-1,start:league.knockout_start,size:league.knockout_size}),approved:teams.length});
 }
 if(req.method==='POST'&&p==='/api/simulate'){
  if(req.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origem inválida'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON'},415);
  const reader=req.body?.getReader();let size=0,chunks=[];if(!reader)return json({error:'JSON inválido'},400);
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'Corpo muito grande'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}const input=JSON.parse(new TextDecoder().decode(bytes));return json(simulate(league,teams,scores,input));}catch(e){return json({error:e.status?e.message:'JSON inválido'},e.status||400);}
 }
 return json({error:'Recurso desativado na prévia Cloudflare'},403);
}};
