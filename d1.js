import {validScore} from './core.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function checkDb(db){const r=await db.prepare("SELECT value FROM arena_meta WHERE key='schema'").first();if(r?.value!=='arena-demo-v2')fail(503,'Banco de homologação incompatível');}
export async function readLeagues(db){return (await db.prepare("SELECT l.*, 'demo' AS visibility,(SELECT count(*) FROM teams t WHERE t.league_id=l.id AND t.status='approved') AS teamCount FROM leagues l ORDER BY l.id").all()).results;}
export async function readLeague(db,id){
 const [l,t,s]=await db.batch([
  db.prepare("SELECT l.*, 'demo' AS visibility,(SELECT count(*) FROM teams t WHERE t.league_id=l.id AND t.status='approved') AS teamCount FROM leagues l WHERE id=?").bind(id),
  db.prepare("SELECT id,name,status FROM teams WHERE league_id=? AND status='approved' ORDER BY id").bind(id),
  db.prepare("SELECT s.team_id AS teamId,s.round,s.points,s.demo_fixture AS demoFixture FROM scores s JOIN teams t ON t.id=s.team_id AND t.league_id=s.league_id WHERE s.league_id=? AND t.status='approved'").bind(id)
 ]);
 if(!l.results[0])fail(404,'Liga não encontrada');return {league:l.results[0],teams:t.results,scores:s.results};
}
export async function authorizeAdmin(request,secret){
 if(typeof secret!=='string'||secret.length<32||secret.length>256)fail(503,'Administração não configurada');
 const supplied=request.headers.get('Authorization')||'';
 if(!supplied.startsWith('Bearer ')||supplied.length>263)fail(401,'Acesso administrativo necessário');
 const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([hash(supplied.slice(7)),hash(secret)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff!==0)fail(401,'Acesso administrativo necessário');
}
export async function writeScore(db,id,input){
 const {teamId,round,points}=input||{};if(!Number.isSafeInteger(teamId)||teamId<1||!validScore(round,points))fail(400,'Pontuação inválida');
 const value=Math.round(points*100),predicate="t.league_id=? AND t.id=? AND t.status='approved' AND ? BETWEEN l.start_round AND l.end_round";
 const [updated]=await db.batch([
  db.prepare("INSERT INTO scores(league_id,team_id,round,points,demo_fixture) SELECT t.league_id,t.id,?,?,0 FROM teams t JOIN leagues l ON l.id=t.league_id WHERE "+predicate+" ON CONFLICT(league_id,team_id,round) DO UPDATE SET points=excluded.points,demo_fixture=0").bind(round,value,id,teamId,round),
  db.prepare("INSERT INTO audit(league_id,team_id,round,points) SELECT t.league_id,t.id,?,? FROM teams t JOIN leagues l ON l.id=t.league_id WHERE "+predicate).bind(round,value,id,teamId,round)
 ]);
 if(updated.meta.changes!==1)fail(404,'Time aprovado ou rodada não encontrado nesta liga');return {ok:true,stored:true};
}
