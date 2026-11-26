import {authorizeAdmin} from './d1.js';
import {validScore} from './core.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const now=()=>Math.floor(Date.now()/1000);
// Reserved sentinel identifies reusable group invitations without a schema migration.
const GROUP_EXPIRY=253402300799;
const cookie=(value,maxAge)=>'__Host-arena_beta='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;
const sessionToken=req=>req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-arena_beta='))?.slice('__Host-arena_beta='.length);
const ADMIN_TTL=8*3600;
const ADMIN_PREFIX='beta-admin-session:';
const adminCookie=(value,age)=>'__Host-arena_admin='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
const adminSession=req=>req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-arena_admin='))?.slice('__Host-arena_admin='.length);
// Keyed digest binds sessions to the current administrative secret, so rotation invalidates them.
async function adminSessionKey(key,secret){return ADMIN_PREFIX+await hash(secret+':'+key);}
async function requireAdmin(req,env){
 if(req.headers.has('Authorization'))return authorizeAdmin(req,env.ADMIN_API_TOKEN);
 const key=adminSession(req);if(!validToken(key))fail(401,'Entre na administração.');
 const row=await env.DB.prepare('SELECT value FROM arena_meta WHERE key=?').bind(await adminSessionKey(key,env.ADMIN_API_TOKEN)).first();
 if(!row||Number(row.value)<=now())fail(401,'Sessão administrativa expirada. Entre novamente.');
}
export async function betaReady(env){if(!env.DB||env.BETA_ENABLED!=='true'||typeof env.ADMIN_API_TOKEN!=='string'||env.ADMIN_API_TOKEN.length<32||env.ADMIN_API_TOKEN.length>256)return false;const row=await env.DB.prepare("SELECT value FROM arena_meta WHERE key='beta'").first();return row?.value==='1';}
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
  if(path==='/api/beta/admin/login'&&method==='POST'){
   await authorizeAdmin(req,env.ADMIN_API_TOKEN);
   const key=token(),expires=now()+ADMIN_TTL;
   await db.batch([
    db.prepare("DELETE FROM arena_meta WHERE key LIKE 'beta-admin-session:%' AND CAST(value AS INTEGER)<=?").bind(now()),
    db.prepare('INSERT INTO arena_meta(key,value) VALUES (?,?)').bind(await adminSessionKey(key,env.ADMIN_API_TOKEN),String(expires))
   ]);
   return reply({ok:true,expiresAt:expires},200,adminCookie(key,ADMIN_TTL));
  }
  if(path==='/api/beta/admin/logout'&&method==='POST'){
   const key=adminSession(req);
   if(validToken(key))await db.prepare('DELETE FROM arena_meta WHERE key=?').bind(await adminSessionKey(key,env.ADMIN_API_TOKEN)).run();
   return reply({ok:true},200,adminCookie('',0));
  }
  await requireAdmin(req,env);
  if(path==='/api/beta/admin/invites'&&method==='POST'){
   const d=await readInput(req);if(d.mode!==undefined&&!['group','individual'].includes(d.mode))fail(400,'Tipo de convite inválido.');
   const group=d.mode==='group',key=token(),time=now(),expiry=group?GROUP_EXPIRY:time+7*86400;
   await db.prepare('INSERT INTO beta_invites VALUES (?,?,?)').bind(await hash(key),time,expiry).run();
   return reply({invite:key,mode:group?'group':'individual',expiresAt:group?null:expiry},201);
  }
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
  if(path==='/api/beta/admin/members'&&method==='GET'){
   const q=new URL(req.url).searchParams,offset=Number(q.get('offset')??0);
   if(!Number.isSafeInteger(offset)||offset<0)fail(400,'Página inválida.');
   const [rows,counts]=await db.batch([db.prepare('SELECT id,team_name,external_id,status,created_at FROM beta_members ORDER BY created_at,id LIMIT 50 OFFSET ?').bind(offset),db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending FROM beta_members")]);
   const {total,pending}=counts.results[0];
   return reply({members:rows.results,total,pending,offset,nextOffset:offset+rows.results.length<total?offset+rows.results.length:null});
  }
  if(path==='/api/beta/admin/manual'&&method==='POST'){
   const d=await readInput(req);
   if(d.authorized!==true||!Array.isArray(d.teams)||d.teams.length<1||d.teams.length>10)fail(400,'Confirme a autorização e envie de 1 a 10 times por lote.');
   const seen=new Set(),items=[];
   for(const item of d.teams){
    const external=typeof item?.externalId==='string'?item.externalId.trim():'',name=cleanName(item?.teamName)||'Time '+external;
    if(!/^[1-9]\d{0,19}$/.test(external)||name.length<2||name.length>80||/[\x00-\x1f\x7f]/.test(name)||seen.has(external))fail(400,'ID ou nome inválido, ou ID repetido no lote.');
    seen.add(external);items.push({external,name,id:token(),child:await hash(token()),accessHash:await hash(token())});
   }
   const time=now(),stmts=[];
   for(const x of items){
    stmts.push(
     db.prepare("INSERT INTO beta_invites(hash,created_at,expires_at) SELECT ?,?,0 WHERE NOT EXISTS(SELECT 1 FROM beta_members WHERE external_id=?)").bind(x.child,time,x.external),
     db.prepare("INSERT OR IGNORE INTO beta_members(id,invite_hash,access_hash,team_name,external_id,status,created_at) SELECT ?,hash,?,?,?,'approved',? FROM beta_invites WHERE hash=?").bind(x.id,x.accessHash,x.name,x.external,time,x.child),
     db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT id,'manual','Cadastro administrativo autorizado',? FROM beta_members WHERE id=?").bind(time,x.id),
     db.prepare("DELETE FROM beta_invites WHERE hash=? AND NOT EXISTS(SELECT 1 FROM beta_members WHERE invite_hash=?)").bind(x.child,x.child)
    );
   }
   const results=await db.batch(stmts);
   return reply({teams:items.map((x,i)=>({externalId:x.external,teamName:x.name,status:results[i*4+1].meta.changes===1?'created':'duplicate'}))},201);
  }
  if(path==='/api/beta/admin/rename'&&method==='POST'){
   const d=await readInput(req),name=cleanName(d.teamName);
   if(!validToken(d.id)||name.length<2||name.length>80||/[\x00-\x1f\x7f]/.test(name))fail(400,'Nome inválido.');
   const [changed]=await db.batch([db.prepare('UPDATE beta_members SET team_name=? WHERE id=?').bind(name,d.id),db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT id,'rename','Nome atualizado',? FROM beta_members WHERE id=?").bind(now(),d.id)]);
   if(changed.meta.changes!==1)fail(404,'Time não encontrado.');return reply({ok:true,teamName:name});
  }
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
  const accessHash=await hash(access);
  const invitation=await db.prepare('SELECT expires_at FROM beta_invites WHERE hash=? AND expires_at>?').bind(invite,time).first();
  if(!invitation)fail(409,'Convite inválido, expirado ou revogado.');
  let result;
  if(invitation.expires_at===GROUP_EXPIRY){
   // Each registration receives its own unusable child invite. Existing unique FK and
   // account deletion stay intact; revoking/deleting one account never disables the group.
   const child=await hash(token());
   const results=await db.batch([
    db.prepare("INSERT INTO beta_invites(hash,created_at,expires_at) SELECT ?,?,0 FROM beta_invites WHERE hash=? AND expires_at=? AND NOT EXISTS(SELECT 1 FROM beta_members WHERE external_id=?)").bind(child,time,invite,GROUP_EXPIRY,external),
    db.prepare("INSERT OR IGNORE INTO beta_members(id,invite_hash,access_hash,team_name,external_id,created_at) SELECT ?,hash,?,?,?,? FROM beta_invites WHERE hash=? AND expires_at=0").bind(id,accessHash,name,external,time,child),
    db.prepare("DELETE FROM beta_invites WHERE hash=? AND NOT EXISTS(SELECT 1 FROM beta_members WHERE invite_hash=?)").bind(child,child)
   ]);result=results[1];
  }else{
   result=await db.prepare("INSERT OR IGNORE INTO beta_members(id,invite_hash,access_hash,team_name,external_id,created_at) SELECT ?,hash,?,?,?,? FROM beta_invites WHERE hash=? AND expires_at>? AND expires_at<>?").bind(id,accessHash,name,external,time,invite,time,GROUP_EXPIRY).run();
  }
  if(result.meta.changes!==1)fail(409,'Convite inválido, utilizado, revogado ou time já inscrito.');
  // Return access key independently of session creation, so no account is stranded on session failure.
  return reply({accessKey:access,status:'pending',teamName:name,message:'Inscrição recebida! Aguarde a aprovação do administrador. Guarde sua chave de acesso.'},201);
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
