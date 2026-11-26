import {ranking,bracket} from './core.js';
import {analytics,simulate} from './analytics.js';
import {readLeagues,readLeague,authorizeAdmin,writeScore} from './d1.js';
const VERSION='0.7.0';
const demoLeague={id:1,name:'Pernas de Pau • Liga piloto',season:2027,start_round:20,end_round:38,knockout_start:30,knockout_size:16};
const demoTeams=['Atlético Aurora','Furacão FC','Vila United','Estrela FC','Real Zona Sul','Tricolor 27','Bola na Rede','Canarinho FC','Arena City','Alvorada','União FC','Guerreiros','Império FC','Fênix','Nova Geração','Raça FC'].map((name,i)=>({id:i+1,name,status:'approved'}));
const demoScores=demoTeams.flatMap(({id})=>Array.from({length:13},(_,j)=>{const round=20+j,i=id-1;return {teamId:id,round,points:4200+((i*1379+round*719+i*round*53)%6900)};}));
const headers={'X-VN-Arena-Version':VERSION,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
const json=(data,status=200)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store'}});
async function handle(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(!p.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido'},405);
  const r=await env.ASSETS.fetch(req),h=new Headers(r.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  if(req.method==='GET'&&h.get('Content-Type')?.includes('text/html')){
   const html=(await r.text()).replace(/<button data-tab="(?:join|admin)">[^<]*<\/button>/g,'').replace('AMBIENTE DE TESTE · Dados fictícios · Sem pagamentos',env.DB?'PRÉVIA CLOUDFLARE · Banco D1 · Somente dados fictícios':'PRÉVIA CLOUDFLARE · Dados fictícios · Cadastro e administração desativados');h.delete('Content-Length');h.delete('ETag');h.set('Cache-Control','no-store');return new Response(html,{status:r.status,headers:h});
  }
  return new Response(r.body,{status:r.status,headers:h});
 }
 if(req.method==='GET'&&p==='/api/health'){
  if(env.DB)await readLeagues(env.DB);
  return json({ok:true,version:VERSION,mode:'demo',storage:env.DB?'d1':'none',payments:false});
 }
 if(req.method==='GET'&&p==='/api/leagues')return json({leagues:env.DB?await readLeagues(env.DB):[demoLeague]});
 const raw=url.searchParams.get('league')??'1',id=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id)||id<1)return json({error:'Liga não encontrada'},404);
 if(!env.DB&&id!==1)return json({error:'Liga não encontrada'},404);
 if(req.method==='POST'&&p==='/api/admin/score'){
  if(!env.DB)return json({error:'Banco D1 não conectado'},503);
  await authorizeAdmin(req,env.ADMIN_API_TOKEN);
  return json(await writeScore(env.DB,id,await readJson(req)));
 }
 if(!['/api/analytics','/api/overview','/api/simulate'].includes(p))return json({error:'Recurso desativado na prévia Cloudflare'},403);
 const {league,teams,scores}=env.DB?await readLeague(env.DB,id):{league:demoLeague,teams:demoTeams,scores:demoScores};
 if(req.method==='GET'&&p==='/api/analytics')return json(analytics(league,teams,scores));
 if(req.method==='GET'&&p==='/api/overview'){
  const round=Number(url.searchParams.get('round')||league.end_round);if(!Number.isInteger(round)||round<1||round>38)return json({error:'Rodada inválida'},400);
  const rank=ranking(teams,scores,league.start_round,league.end_round),best=rank.filter(t=>t.best!==null).sort((a,b)=>b.best-a.best||a.id-b.id)[0]||null;
  return json({league,source:{mode:'demo',live:false,label:env.DB?'Dados fictícios persistidos':'Dados fictícios'},rank,roundRank:ranking(teams,scores,round,round).filter(t=>t.played),best,bracket:bracket(teams,scores,{qualStart:league.start_round,qualEnd:league.knockout_start-1,start:league.knockout_start,size:league.knockout_size}),approved:teams.length});
 }
 if(req.method==='POST'&&p==='/api/simulate')return json(simulate(league,teams,scores,await readJson(req)));
 return json({error:'Recurso desativado na prévia Cloudflare'},403);
}
async function readJson(req){
 const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
 if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'Origem inválida');
 if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON');
 const reader=req.body?.getReader();let size=0,chunks=[];if(!reader)fail(400,'JSON inválido');
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();fail(413,'Corpo muito grande');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{const input=JSON.parse(new TextDecoder().decode(bytes));if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'JSON inválido');return input;}catch{fail(400,'JSON inválido');}
}
export default {async fetch(req,env){try{return await handle(req,env);}catch(e){return json({error:e.status?e.message:'Serviço de dados temporariamente indisponível'},e.status||503);}}};
