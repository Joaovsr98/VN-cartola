import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import worker from '../worker.js';import {demoTotal} from '../demo-ranking.js';
function setup(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../migrations/0001_homologacao.sql',import.meta.url),'utf8'));
 const bind=(sql,args=[])=>({bind:(...p)=>bind(sql,p),first:async()=>db.prepare(sql).get(...args),all:async()=>({results:db.prepare(sql).all(...args)}),run:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),sql,args});
 const env={DB:{prepare:sql=>bind(sql),batch:async stmts=>{db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(/^SELECT/i.test(s.sql)?await s.all():s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},ADMIN_API_TOKEN:'test-only-long-token-12345678901234567890'};
 const call=(p,o={})=>worker.fetch(new Request('https://arena.test'+p,o),env);const post=(d,token=env.ADMIN_API_TOKEN)=>({method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(d)});return {db,env,call,post};
}
test('D1: seed matches current simulated scores in all leagues',async t=>{const {db,call}=setup(t);const records=db.prepare('SELECT * FROM scores').all();assert.equal(records.length,416);for(const r of records)assert.equal(r.points,demoTotal(r.team_id,r.round));assert.equal((await(await call('/api/health')).json()).storage,'d1');for(const id of [1,11,12]){const d=await(await call('/api/overview?league='+id+'&round=32')).json();assert.equal(d.approved,id===1?16:8);assert.ok(d.richRank.every(t=>t.captain));}});
test('D1: writes require auth, respect league, record audit and do not fabricate lineup',async t=>{const {db,call,post,env}=setup(t);const input={teamId:1,round:32,points:98.5};assert.equal((await call('/api/admin/score?league=11',post(input,''))).status,401);assert.equal((await call('/api/admin/score?league=11',post(input,'wrong'))).status,401);assert.equal((await call('/api/admin/score?league=12',post(input))).status,404);assert.equal((await call('/api/admin/score?league=11',post(input))).status,200);const d=await(await call('/api/team?league=11&id=1&round=32')).json();assert.equal(d.points,9850);assert.equal(d.lineup,null);const other=await(await call('/api/team?league=1&id=1&round=32')).json();assert.ok(other.lineup);const rank=await(await call('/api/overview?league=11&round=32')).json();assert.equal(rank.richRank.find(t=>t.id===1).captain,null);assert.equal(db.prepare('SELECT count(*) n FROM audit').get().n,1);delete env.ADMIN_API_TOKEN;assert.equal((await call('/api/admin/score',post(input))).status,503);});
test('D1: schema errors fail closed and signup remains blocked',async t=>{const {db,call,post}=setup(t);assert.equal((await call('/api/account/register',post({}))).status,403);db.exec("DELETE FROM arena_meta");assert.equal((await call('/api/health')).status,503);assert.equal((await call('/api/overview')).status,503);});

test('closed beta: invite, access key, pending, approval, score and logout',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 assert.equal((await(await call('/api/beta/status')).json()).enabled,false);
 assert.equal((await call('/api/beta/admin/invites',post({},admin))).status,403);
 env.BETA_ENABLED='true';
 assert.equal((await call('/api/beta/admin/invites',post({}))).status,401);
 const invite=(await(await call('/api/beta/admin/invites',post({},admin))).json()).invite;
 const data={invite,teamName:'Time beta',externalId:'12345',consent:true};
 assert.equal((await call('/api/beta/register',post({...data,consent:false}))).status,400);
 const registered=await call('/api/beta/register',post(data));assert.equal(registered.status,201);const {accessKey}=await registered.json();assert.equal(accessKey.length,64);
 assert.equal((await call('/api/beta/register',post(data))).status,409);
 const login=await call('/api/beta/login',post({accessKey}));assert.equal(login.status,200);const header=login.headers.get('Set-Cookie');assert.match(header,/HttpOnly; SameSite=Strict/);const session={Cookie:header.split(';')[0]};
 assert.equal((await(await call('/api/beta/me',{headers:session})).json()).member.status,'pending');
 assert.equal((await call('/api/beta/ranking',{headers:session})).status,403);
 const {members}=await(await call('/api/beta/admin/members',{headers:admin})).json();assert.equal(members.length,1);assert.equal(members[0].access_hash,undefined);
 const id=members[0].id;assert.equal((await call('/api/beta/admin/score',post({id,round:32,points:90},admin))).status,404);
 assert.equal((await call('/api/beta/admin/decision',post({id,status:'approved'},admin))).status,200);
 assert.equal((await call('/api/beta/admin/score',post({id,round:32,points:90},admin))).status,200);
 const rank=await(await call('/api/beta/ranking?round=32',{headers:session})).json();assert.equal(rank.ranking[0].total,9000);assert.equal(rank.ranking[0].external_id,undefined);
 assert.equal((await(await call('/api/overview')).json()).approved,16);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM beta_audit').get().n,2);
 assert.equal((await call('/api/beta/logout',post({},session))).status,200);assert.equal((await call('/api/beta/me',{headers:session})).status,401);
});
test('closed beta: blocks cross-origin requests and expired invitations',async t=>{const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';const headers={'Content-Type':'application/json',Origin:'https://arena.test',Authorization:'Bearer '+env.ADMIN_API_TOKEN};const invite=(await(await call('/api/beta/admin/invites',{method:'POST',headers,body:'{}'})).json()).invite;const body=JSON.stringify({invite,teamName:'Time beta',externalId:'12345',consent:true});assert.equal((await call('/api/beta/register',{method:'POST',headers:{...headers,Origin:'https://other.test'},body})).status,403);db.exec('UPDATE beta_invites SET expires_at=0');assert.equal((await call('/api/beta/register',{method:'POST',headers,body})).status,409);});

test('beta: revogação, recuperação e exclusão sem reutilização do convite',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN},invite=async()=> (await(await call('/api/beta/admin/invites',post({},admin))).json()).invite;
 const revoked=await invite();assert.equal((await call('/api/beta/admin/revoke-invite',post({invite:revoked},admin))).status,200);
 const data={invite:revoked,teamName:'Time beta',externalId:'12345',consent:true};assert.equal((await call('/api/beta/register',post(data))).status,409);
 data.invite=await invite();const {accessKey}=await(await call('/api/beta/register',post(data))).json();const old=await call('/api/beta/login',post({accessKey}));const oldSession={Cookie:old.headers.get('Set-Cookie').split(';')[0]};
 const id=db.prepare('SELECT id FROM beta_members').get().id;
 assert.equal((await call('/api/beta/admin/recover',post({id,verified:false},admin))).status,400);
 const {accessKey:newKey}=await(await call('/api/beta/admin/recover',post({id,verified:true},admin))).json();assert.notEqual(newKey,accessKey);
 assert.equal((await call('/api/beta/me',{headers:oldSession})).status,401);assert.equal((await call('/api/beta/login',post({accessKey}))).status,401);
 const login=await call('/api/beta/login',post({accessKey:newKey}));const session={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
 assert.equal((await call('/api/beta/admin/decision',post({id,status:'approved'},admin))).status,200);
 assert.equal((await call('/api/beta/admin/decision',post({id,status:'rejected'},admin))).status,200);
 assert.equal((await call('/api/beta/ranking',{headers:session})).status,403);
 assert.equal((await call('/api/beta/admin/decision',post({id,status:'approved'},admin))).status,200);
 assert.equal((await call('/api/beta/admin/score',post({id,round:32,points:90},admin))).status,200);
 assert.equal((await call('/api/beta/delete',post({confirmation:'EXCLUIR',accessKey},session))).status,401);
 assert.equal((await call('/api/beta/delete',post({confirmation:'EXCLUIR',accessKey:newKey},session))).status,200);
 for(const table of ['beta_members','beta_scores','beta_sessions','beta_audit'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.equal((await call('/api/beta/register',post(data))).status,409);
});

test('beta remains closed without an administrative secret even when enabled',async t=>{const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';delete env.ADMIN_API_TOKEN;assert.equal((await(await call('/api/beta/status')).json()).enabled,false);assert.equal((await call('/api/beta/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test'},body:'{}'})).status,403);});

test('beta: convite de grupo reutilizável, sem vencimento, com exclusão isolada e revogação',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 const made=await call('/api/beta/admin/invites',post({mode:'group'},admin));assert.equal(made.status,201);const group=await made.json();assert.equal(group.expiresAt,null);assert.equal(group.mode,'group');
 const register=externalId=>call('/api/beta/register',post({invite:group.invite,teamName:'Time '+externalId,externalId,consent:true}));
 const first=await register('101');assert.equal(first.status,201);const {accessKey}=await first.json();
 assert.equal((await register('102')).status,201);assert.equal((await register('101')).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM beta_members').get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM beta_members WHERE status='pending'").get().n,2);
 const login=await call('/api/beta/login',post({accessKey}));const session={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
 assert.equal((await call('/api/beta/delete',post({confirmation:'EXCLUIR',accessKey},session))).status,200);
 assert.equal((await register('103')).status,201);
 assert.equal((await call('/api/beta/admin/revoke-invite',post({invite:group.invite},admin))).status,200);
 assert.equal((await register('104')).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM beta_members').get().n,2);
});

test('beta: admin session persists, expires, revokes on logout and secret rotation',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 assert.equal((await call('/api/beta/admin/login',post({}))).status,401);
 const login=async()=>{const r=await call('/api/beta/admin/login',post({},{Authorization:'Bearer '+env.ADMIN_API_TOKEN}));assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/__Host-arena_admin=.*HttpOnly; SameSite=Strict; Max-Age=28800/);return {Cookie:r.headers.get('Set-Cookie').split(';')[0]};};
 const session=await login();assert.equal((await call('/api/beta/admin/members',{headers:session})).status,200);
 const group=await(await call('/api/beta/admin/invites',post({mode:'group'},session))).json();assert.ok(group.invite);
 const reg=await(await call('/api/beta/register',post({invite:group.invite,teamName:'Time confirmação',externalId:'101',consent:true}))).json();assert.equal(reg.teamName,'Time confirmação');assert.equal(reg.status,'pending');assert.match(reg.message,/Inscrição recebida/);
 assert.equal((await call('/api/beta/admin/logout',post({},session))).status,200);assert.equal((await call('/api/beta/admin/members',{headers:session})).status,401);
 const expired=await login();db.exec("UPDATE arena_meta SET value='0' WHERE key LIKE 'beta-admin-session:%'");assert.equal((await call('/api/beta/admin/members',{headers:expired})).status,401);
 const rotated=await login();env.ADMIN_API_TOKEN+='rotated';assert.equal((await call('/api/beta/admin/members',{headers:rotated})).status,401);
});

test('beta: cadastro manual ilimitado por lotes, paginação e acesso posterior',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 const create=(teams,authorized=true,headers=admin)=>call('/api/beta/admin/manual',post({teams,authorized},headers));
 assert.equal((await create([{externalId:'101'}],true,{})).status,401);
 assert.equal((await create([{externalId:'101'}],false)).status,400);
 assert.equal((await create([{externalId:'101'},{externalId:'bad'}])).status,400);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM beta_members').get().n,0);
 const first=await create([{externalId:'101',teamName:'Meu time'},{externalId:'102'}]);assert.equal(first.status,201);assert.deepEqual((await first.json()).teams.map(x=>x.status),['created','created']);
 assert.equal(db.prepare("SELECT team_name FROM beta_members WHERE external_id='102'").get().team_name,'Time 102');
 assert.equal((await(await create([{externalId:'101'}])).json()).teams[0].status,'duplicate');
 for(let i=0;i<11;i++)assert.equal((await create(Array.from({length:10},(_,j)=>({externalId:String(1000+i*10+j)})))).status,201);
 const a=await(await call('/api/beta/admin/members',{headers:admin})).json(),b=await(await call('/api/beta/admin/members?offset=50',{headers:admin})).json(),c=await(await call('/api/beta/admin/members?offset=100',{headers:admin})).json();
 assert.equal(a.total,112);assert.equal(a.pending,0);assert.equal(a.members.length,50);assert.equal(b.members.length,50);assert.equal(c.members.length,12);assert.equal(c.nextOffset,null);assert.equal(new Set([...a.members,...b.members,...c.members].map(x=>x.id)).size,112);
 const id=db.prepare("SELECT id FROM beta_members WHERE external_id='101'").get().id;
 assert.equal((await call('/api/beta/admin/rename',post({id,teamName:'Nome revisado'},admin))).status,200);
 const {accessKey}=await(await call('/api/beta/admin/recover',post({id,verified:true},admin))).json();
 const login=await call('/api/beta/login',post({accessKey}));assert.equal(login.status,200);const session={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
 const me=await(await call('/api/beta/me',{headers:session})).json();assert.equal(me.member.team_name,'Nome revisado');assert.equal(me.member.status,'approved');
 assert.equal((await call('/api/beta/ranking',{headers:session})).status,200);
});

test('beta: nome sem ID recebe confirmação, requer vínculo antes de aprovação e impede ID duplicado',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 const {invite}=await(await call('/api/beta/admin/invites',post({mode:'group'},admin))).json();
 const data={invite,teamName:'Time sem ID',externalId:'',consent:true};
 const invalid=await call('/api/beta/register',post({...data,externalId:'abc'}));assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/apenas números/);
 const response=await call('/api/beta/register',post(data));assert.equal(response.status,201);const result=await response.json();assert.equal(result.needsId,true);assert.equal(result.teamName,data.teamName);
 const id=db.prepare('SELECT id FROM beta_members').get().id;
 const decision=()=>call('/api/beta/admin/decision',post({id,status:'approved'},admin));
 assert.equal((await decision()).status,409);
 assert.equal((await call('/api/beta/register',post({...data,teamName:'Outro time',externalId:'123'}))).status,201);
 const link=externalId=>call('/api/beta/admin/link-id',post({id,externalId},admin));
 assert.equal((await link('123')).status,409);assert.equal((await link('456')).status,200);assert.equal((await decision()).status,200);
 assert.equal(db.prepare('SELECT external_id FROM beta_members WHERE id=?').get(id).external_id,'456');
});

test('beta: busca, filtros, correção de ID sem pontos e proteção dos registros',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 const {invite}=await(await call('/api/beta/admin/invites',post({mode:'group'},admin))).json();
 const reg=async(teamName,externalId)=>await(await call('/api/beta/register',post({invite,teamName,externalId,consent:true}))).json();
 const first=await reg('Aurora FC','80');await reg('Outro time','81');await reg('Sem ID','');
 const id=db.prepare("SELECT id FROM beta_members WHERE external_id='80'").get().id;
 const list=async q=>(await(await call('/api/beta/admin/members?'+q,{headers:admin})).json());
 assert.equal((await list('q=aurora')).filtered,1);assert.equal((await list('status=unlinked')).filtered,1);assert.equal((await list('status=pending')).total,3);
 assert.equal((await call('/api/beta/admin/decision',post({id,status:'approved'},admin))).status,200);
 assert.equal((await list('status=approved')).approved,1);assert.equal((await list('status=pending')).filtered,2);
 const edit=(externalId,verified=true)=>call('/api/beta/admin/edit-id',post({id,externalId,verified},admin));
 assert.equal((await edit('81')).status,409);assert.equal((await edit('90',false)).status,400);assert.equal((await edit('90')).status,200);
 assert.equal((await call('/api/beta/admin/score',post({id,round:36,points:95.41},admin))).status,200);
 assert.equal((await edit('91')).status,409);
 const login=await call('/api/beta/login',post({accessKey:first.accessKey}));const session={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
 const ranking=await(await call('/api/beta/ranking?round=36',{headers:session})).json();
 assert.equal(ranking.summary.participants,1);assert.equal(ranking.summary.leader,'Aurora FC');assert.equal(ranking.ranking[0].total,9541);
});

test('beta: última rodada com pontos e destaque somente do próprio time',async t=>{
 const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';
 const post=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json',Origin:'https://arena.test',...extra},body:JSON.stringify(data)});
 const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};
 const {invite}=await(await call('/api/beta/admin/invites',post({mode:'group'},admin))).json();
 const reg=async(externalId)=>await(await call('/api/beta/register',post({invite,teamName:'Time '+externalId,externalId,consent:true}))).json();
 const a=await reg('91');await reg('92');
 for(const row of db.prepare('SELECT id,external_id FROM beta_members').all()){
  assert.equal((await call('/api/beta/admin/decision',post({id:row.id,status:'approved'},admin))).status,200);
  assert.equal((await call('/api/beta/admin/score',post({id:row.id,round:36,points:row.external_id==='91'?95.41:80},admin))).status,200);
 }
 const login=await call('/api/beta/login',post({accessKey:a.accessKey})),session={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
 const d=await(await call('/api/beta/ranking?round=latest',{headers:session})).json();
 assert.equal(d.round,36);assert.equal(d.ranking.filter(x=>x.mine).length,1);assert.equal(d.ranking[0].mine,true);assert.equal(d.ranking[0].name,'Time 91');assert.ok(d.ranking.every(x=>!('memberId' in x)));
});

test('beta: consulta externa exige administrador e ativação explícita',async t=>{const {db,env,call}=setup(t);db.exec(readFileSync(new URL('../migrations/0002_beta.sql',import.meta.url),'utf8'));env.BETA_ENABLED='true';const admin={Authorization:'Bearer '+env.ADMIN_API_TOKEN};assert.equal((await call('/api/beta/admin/cartola/status')).status,401);assert.equal((await(await call('/api/beta/admin/cartola/status',{headers:admin})).json()).enabled,false);const r=await call('/api/beta/admin/cartola/preview',{method:'POST',headers:{...admin,Origin:'https://arena.test','Content-Type':'application/json'},body:JSON.stringify({id:'a'.repeat(64),round:36})});assert.equal(r.status,403);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM beta_scores').get().n,0);});
