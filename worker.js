import {ranking,bracket} from './core.js';
import {analytics,simulate} from './analytics.js';
const VERSION='0.6.1';
const league={id:1,name:'Pernas de Pau • Liga piloto',season:2027,start_round:20,end_round:38,knockout_start:30,knockout_size:16};
const teams=['Atlético Aurora','Furacão FC','Vila United','Estrela FC','Real Zona Sul','Tricolor 27','Bola na Rede','Canarinho FC','Arena City','Alvorada','União FC','Guerreiros','Império FC','Fênix','Nova Geração','Raça FC'].map((name,i)=>({id:i+1,name,status:'approved'}));
const scores=teams.flatMap(({id})=>Array.from({length:13},(_,j)=>{const round=20+j,i=id-1;return {teamId:id,round,points:4200+((i*1379+round*719+i*round*53)%6900)};}));
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
 if(url.searchParams.get('league')!==null&&url.searchParams.get('league')!=='1')return json({error:'Liga não encontrada'},404);
 if(req.method==='GET'&&p==='/api/leagues')return json({leagues:[league]});
 if(req.method==='GET'&&p==='/api/analytics')return json(analytics(league,teams,scores));
 if(req.method==='GET'&&p==='/api/overview'){
  const round=Number(url.searchParams.get('round')||32);if(!Number.isInteger(round)||round<1||round>38)return json({error:'Rodada inválida'},400);
  const rank=ranking(teams,scores,20,38),best=rank.filter(t=>t.best!==null).sort((a,b)=>b.best-a.best||a.id-b.id)[0]||null;
  return json({league,source:{mode:'demo',live:false,label:'Dados fictícios'},rank,roundRank:ranking(teams,scores,round,round).filter(t=>t.played),best,bracket:bracket(teams,scores),approved:teams.length});
 }
 if(req.method==='POST'&&p==='/api/simulate'){
  if(req.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origem inválida'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON'},415);
  const reader=req.body?.getReader();let size=0,chunks=[];if(!reader)return json({error:'JSON inválido'},400);
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'Corpo muito grande'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}const input=JSON.parse(new TextDecoder().decode(bytes));return json(simulate(league,teams,scores,input));}catch(e){return json({error:e.status?e.message:'JSON inválido'},e.status||400);}
 }
 return json({error:'Recurso desativado na prévia Cloudflare'},403);
}};
