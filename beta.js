import {authorizeAdmin} from './d1.js';
import {validScore} from './core.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const now=()=>Math.floor(Date.now()/1000);
const cookie=(value,maxAge)=>'__Host-arena_beta='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;
const sessionToken=req=>req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-arena_beta='))?.slice('__Host-arena_beta='.length);
export async function betaReady(env){if(!env.DB||env.BETA_ENABLED!=='true')return false;const row=await env.DB.prepare("SELECT value FROM arena_meta WHERE key='beta'").first();return row?.value==='1';}
async function member(db,req){
 const key=sessionToken(req);if(!validToken(key))fail(401,'Entre com sua chave de acesso.');
 const row=await db.prepare('SELECT m.id,m.team_name,m.external_id,m.status FROM beta_sessions s JOIN beta_members m ON m.id=s.member_id WHERE s.hash=? AND s.expires_at>?').bind(await hash(key),now()).first();
 if(!row)fail(401,'Sessão inválida ou expirada.');return row;
}
async function login(db,id,accessHash){const key=token(),time=now(),ttl=7*86400;const [,saved]=await db.batch([db.prepare('DELETE FROM beta_sessions WHERE expires_at<=?').bind(time),db.prepare('INSERT INTO beta_sessions SELECT ?,id,? FROM beta_members WHERE id=? AND access_hash=?').bind(await hash(key),time+ttl,id,accessHash)]);if(saved.meta.changes!==1)fail(401,'Chave inválida.');return cookie(key,ttl);}
function cleanName(s){if(typeof s!=='string')return '';return s.trim().replace(/\s+/g,' ');}
export async function betaRoute(req,env,path,readInput,json){
 const reply=(data,status=200,session=null)=>{const r=json(data,status);if(session)r.headers.set('Set-Cookie',session);return r;};
 if(path==='/api/beta/status'&&req.method==='GET')return reply({enabled:await betaReady(env),payments:false});
 if(!await betaReady(env))return reply({error:'Beta fechada ainda não habilitada.'},403);
 const db=env.DB,method=req.method;
 if(method==='POST'&&(req.headers.get('Origin')!==new URL(req.url).origin||req.headers.get('Sec-Fetch-Site')==='cross-site'))fail(403,'Origem inválida');
 if(path.startsWith('/api/beta/admin/')){
  await authorizeAdmin(req,env.ADMIN_API_TOKEN);
  if(path==='/api/beta/admin/invites'&&method==='POST'){const key=token(),time=now();await db.prepare('INSERT INTO beta_invites VALUES (?,?,?)').bind(await hash(key),time,time+7*86400).run();return reply({invite:key,expiresAt:time+7*86400},201);}
  if(path==='/api/beta/admin/revoke-invite'&&method==='POST'){
   const d=await readInput(req);if(!validToken(d.invite))fail(400,'Convite inválido.');
   const result=await db.prepare("UPDATE beta_invites SET expires_at=0 WHERE hash=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM beta_members WHERE invite_hash=beta_invites.hash)").bind(await hash(d.invite),now()).run();
   if(result.meta.changes!==1)fail(409,'Convite inexistente, expirado ou utilizado.');return reply({ok:true});
  }
  if(path==='/api/beta/admin/recover'&&method==='POST'){
   const d=await readInput(req);if(!validToken(d.id)||d.verified!==true)fail(400,'Confirme a identidade do participante fora do sistema.');
   const access=token(),time=now();const [changed]=await db.batch([db.prepare("UPDATE beta_members SET access_hash=? WHERE id=?").bind(await hash(access),d.id),db.prepare("DELETE FROM beta_sessions WHERE member_id=?").bind(d.id),db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT id,'recover','Chave substituída',? FROM beta_members WHERE id=?").bind(time,d.id)]);
   if(changed.meta.changes!==1)fail(404,'Participante não encontrado.');return reply({accessKey:access});
  }
  if(path==='/api/beta/admin/members'&&method==='GET'){const rows=await db.prepare('SELECT id,team_name,external_id,status,created_at FROM beta_members ORDER BY created_at,id LIMIT 100').all();return reply({members:rows.results});}
  if(path==='/api/beta/admin/decision'&&method==='POST'){
   const d=await readInput(req);if(!validToken(d.id)||!['approved','rejected'].includes(d.status))fail(400,'Decisão inválida');
   const [changed]=await db.batch([db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT id,'decision',?,? FROM beta_members WHERE id=? AND status<>?").bind(d.status,now(),d.id,d.status),db.prepare("UPDATE beta_members SET status=? WHERE id=? AND status<>?").bind(d.status,d.id,d.status)]).then(r=>[r[1]]);
   if(changed.meta.changes!==1)fail(409,'Inscrição não encontrada ou já está neste estado');return reply({ok:true});
  }
  if(path==='/api/beta/admin/score'&&method==='POST'){
   const d=await readInput(req);if(!validToken(d.id)||!validScore(d.round,d.points))fail(400,'Pontuação inválida');const points=Math.round(d.points*100);
   const [result]=await db.batch([db.prepare("INSERT INTO beta_scores(member_id,round,points) SELECT id,?,? FROM beta_members WHERE id=? AND status='approved' ON CONFLICT(member_id,round) DO UPDATE SET points=excluded.points").bind(d.round,points,d.id),db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT id,'score',?,? FROM beta_members WHERE id=? AND status='approved'").bind(JSON.stringify({round:d.round,points}),now(),d.id)]);
   if(result.meta.changes!==1)fail(404,'Participante aprovado não encontrado');return reply({ok:true});
  }
  return reply({error:'Recurso não encontrado'},404);
 }
 if(path==='/api/beta/register'&&method==='POST'){
  const d=await readInput(req),name=cleanName(d.teamName),external=typeof d.externalId==='string'?d.externalId.trim():'';
  if(!validToken(d.invite)||name.length<2||name.length>80||/[\x00-\x1f\x7f]/.test(name)||!/^([1-9]\d{0,19})$/.test(external)||d.consent!==true)fail(400,'Confira convite, nome, ID do time e aceite.');
  const id=token(),access=token(),time=now(),invite=await hash(d.invite);
  const result=await db.prepare("INSERT OR IGNORE INTO beta_members(id,invite_hash,access_hash,team_name,external_id,created_at) SELECT ?,hash,?,?,?,? FROM beta_invites WHERE hash=? AND expires_at>?").bind(id,await hash(access),name,external,time,invite,time).run();
  if(result.meta.changes!==1)fail(409,'Convite inválido, utilizado ou time já inscrito.');
  // Return access key independently of session creation, so no account is stranded on session failure.
  return reply({accessKey:access,status:'pending',message:'Guarde a chave. Entre com ela para acompanhar a aprovação.'},201);
 }
 if(path==='/api/beta/login'&&method==='POST'){
  const d=await readInput(req);if(!validToken(d.accessKey))fail(401,'Chave inválida.');
  const accessHash=await hash(d.accessKey),row=await db.prepare('SELECT id FROM beta_members WHERE access_hash=?').bind(accessHash).first();if(!row)fail(401,'Chave inválida.');
  return reply({ok:true},200,await login(db,row.id,accessHash));
 }
 if(path==='/api/beta/logout'&&method==='POST'){const key=sessionToken(req);if(validToken(key))await db.prepare('DELETE FROM beta_sessions WHERE hash=?').bind(await hash(key)).run();return reply({ok:true},200,cookie('',0));}
 if(path==='/api/beta/delete'&&method==='POST'){
  const d=await readInput(req);if(d.confirmation!=='EXCLUIR'||!validToken(d.accessKey))fail(400,'Confirme a exclusão com sua chave de acesso.');
  const m=await member(db,req),proof=await hash(d.accessKey),record=await db.prepare('SELECT id FROM beta_members WHERE id=? AND access_hash=?').bind(m.id,proof).first();if(!record)fail(401,'Chave inválida.');
  const condition='EXISTS(SELECT 1 FROM beta_members WHERE id=? AND access_hash=?)',id=m.id;
  const result=await db.batch([
   db.prepare('UPDATE beta_invites SET expires_at=0 WHERE hash=(SELECT invite_hash FROM beta_members WHERE id=? AND access_hash=?)').bind(id,proof),
   ...['beta_sessions','beta_scores','beta_audit'].map(table=>db.prepare('DELETE FROM '+table+' WHERE member_id=? AND '+condition).bind(id,id,proof)),
   db.prepare('DELETE FROM beta_members WHERE id=? AND access_hash=?').bind(id,proof)
  ]);
  if(result.at(-1).meta.changes!==1)fail(409,'A chave mudou. Entre novamente.');return reply({ok:true},200,cookie('',0));
 }
 if(path==='/api/beta/me'&&method==='GET'){return reply({member:await member(db,req)});}
 if(path==='/api/beta/ranking'&&method==='GET'){
  const m=await member(db,req);if(m.status!=='approved')fail(403,'Aguarde a aprovação do administrador.');
  const round=Number(new URL(req.url).searchParams.get('round')||38);if(!Number.isInteger(round)||round<1||round>38)fail(400,'Rodada inválida');
  const rows=await db.prepare("SELECT m.team_name AS name,COUNT(s.round) AS played,COALESCE(SUM(s.points),0) AS total,MAX(CASE WHEN s.round=? THEN s.points END) AS roundPoints FROM beta_members m LEFT JOIN beta_scores s ON s.member_id=m.id AND s.round<=? WHERE m.status='approved' GROUP BY m.id,m.team_name ORDER BY CASE WHEN COUNT(s.round)>0 THEN 0 ELSE 1 END,total DESC,m.team_name,m.id").bind(round,round).all();
  return reply({round,source:'manual',ranking:rows.results.map((r,i)=>({...r,position:r.played?i+1:null})),payments:false});
 }
 return reply({error:'Recurso não encontrado'},404);
}
