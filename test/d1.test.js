import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
const token='test-only-high-entropy-token-not-for-production-123456';
function setup(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec('PRAGMA foreign_keys=ON;');db.exec(readFileSync(new URL('../migrations/0001_demo.sql',import.meta.url),'utf8'));
 const bind=(sql,args=[])=>({bind:(...params)=>bind(sql,params),all:async()=>({results:db.prepare(sql).all(...args)}),run:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),sql,args});
 const env={DB:{prepare:sql=>bind(sql),batch:async stmts=>{db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(/^SELECT/i.test(s.sql)?await s.all():s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},ADMIN_API_TOKEN:token};
 const call=(path,options={})=>worker.fetch(new Request('https://arena.test'+path,options),env);
 const post=(data,auth=token)=>({method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(data)});
 return {db,env,call,post};
}
test('D1 adapter reads seeded leagues and scores',async t=>{const {call}=setup(t);const h=await (await call('/api/health')).json();assert.equal(h.storage,'d1');const d=await (await call('/api/overview?round=32')).json();assert.equal(d.approved,16);assert.equal(d.roundRank.length,16);assert.equal((await call('/api/overview?league=2')).status,404);});
test('D1 admin score persists and writes audit, with auth and scope',async t=>{const {db,env,call,post}=setup(t);const input={teamId:1,round:33,points:98.5};assert.equal((await call('/api/admin/score',post(input,''))).status,401);assert.equal((await call('/api/admin/score',post(input,'wrong'))).status,401);assert.equal((await call('/api/admin/score',post({...input,round:19}))).status,404);assert.equal((await call('/api/admin/score',post({...input,teamId:99}))).status,404);assert.equal((await call('/api/admin/score',post(input))).status,200);const r=await (await call('/api/overview?round=33')).json();assert.equal(r.roundRank[0].total,9850);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit').get().n,1);delete env.ADMIN_API_TOKEN;assert.equal((await call('/api/admin/score',post(input))).status,503);});
test('D1 failure is not silently replaced by demo; public signup blocked',async t=>{const {env,call,post}=setup(t);assert.equal((await call('/api/account/register',post({}))).status,403);env.DB={prepare(){throw Error('offline')}};assert.equal((await call('/api/health')).status,503);assert.equal((await call('/api/overview')).status,503);});
