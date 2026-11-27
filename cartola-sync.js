import {cartolaEnabled,readCartolaMarket,readCartolaTeam,readCartolaLineup,readCartolaAthletes,estimatePartial} from './cartola-provider.js';
const clock=()=>Math.floor(Date.now()/1000),season=2026,limit=8;
const livePrefix='beta-live:',stateKey='beta-sync-state',leaseKey='beta-sync-lease';
const meta=async(db,key)=>(await db.prepare('SELECT value FROM arena_meta WHERE key=?').bind(key).first())?.value;
const put=(db,key,value)=>db.prepare('INSERT INTO arena_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,String(value));
function decode(value){try{return JSON.parse(value);}catch{return null;}}
export const syncEnabled=env=>cartolaEnabled(env)&&env.CARTOLA_AUTOSYNC_ENABLED==='true';
const knownCodes=new Set(['timeout','network-or-redirect','redirect-refused','http','access-limited','content-type','empty-body','body-limit','body-read','invalid-json','invalid-market']);
function recordFailure(state,e,stage,time){state.issue={stage,code:knownCodes.has(e?.code)?e.code:'unconfirmed-response',httpStatus:Number.isInteger(e?.upstreamStatus)?e.upstreamStatus:null};if(e?.status===503||stage==='market'||stage==='athletes')state.retryAfter=time+900;}
const defaultSource={market:readCartolaMarket,team:readCartolaTeam,lineup:readCartolaLineup,athletes:readCartolaAthletes};
export async function syncStatus(env){
 const saved=env.DB?decode(await meta(env.DB,stateKey)):null;
 return {enabled:syncEnabled(env),season,last:saved??null};
}
// One bounded run per minute; fail closed on invalid season, access errors or unknown market state.
export async function syncRound(env,source=defaultSource,time=clock()){
 if(!syncEnabled(env)||!env.DB||env.BETA_ENABLED!=='true')return {state:'disabled'};
 const db=env.DB;
 if(await meta(db,'beta')!=='1')return {state:'disabled'};
 const previous=decode(await meta(db,stateKey));if(previous?.retryAfter>time)return {state:'backoff',retryAfter:previous.retryAfter};
 const lock=await db.prepare("INSERT INTO arena_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(arena_meta.value AS INTEGER)<=?").bind(leaseKey,String(time+55),time).run();
 if(lock.meta.changes!==1)return {state:'busy'};
 let state={state:'waiting',at:time,season,round:null,mode:null,updated:0,failed:0},stage='market';
 try{
  const market=await source.market();state.round=market.round;
  if(market.season!==season){state.state='season-unverified';return state;}
  const live=market.status===2&&!market.gameOver;
  const settled=market.gameOver?38:market.status===1?market.round-1:null;
  if(!live&&(!settled||settled<1)){state.state='waiting-market';return state;}
  const round=live?market.round:settled;state.round=round;state.mode=live?'partial':'final';
  if(!Number.isInteger(round)||round<1||round>38){state.state='invalid-round';return state;}
  const prev=decode(await meta(db,stateKey)),cursor=live&&prev?.round===round&&prev?.mode==='partial'?prev.cursor||'':'';
  const select=live?
   db.prepare("SELECT id,external_id FROM beta_members WHERE status='approved' AND external_id NOT LIKE 'pending:%' AND id>? ORDER BY id LIMIT ?").bind(cursor,limit):
   db.prepare("SELECT m.id,m.external_id FROM beta_members m WHERE m.status='approved' AND m.external_id NOT LIKE 'pending:%' AND NOT EXISTS(SELECT 1 FROM beta_scores s WHERE s.member_id=m.id AND s.round=?) ORDER BY m.id LIMIT ?").bind(round,limit);
  let members=(await select.all()).results;
  if(live&&!members.length&&cursor)members=(await db.prepare("SELECT id,external_id FROM beta_members WHERE status='approved' AND external_id NOT LIKE 'pending:%' ORDER BY id LIMIT ?").bind(limit).all()).results;
  if(!members.length){state.state='up-to-date';return state;}
  stage='athletes';const athletes=live?await source.athletes(round):null;stage='team';
  for(const m of members){
   try{
    if(live){
     const lineup=await source.lineup({externalId:m.external_id,round}),d=estimatePartial(lineup,athletes);
     if(d.externalId!==m.external_id||d.round!==round)throw Error('Resposta divergente.');
     // No invented zero. A partial never reaches beta_scores or the WhatsApp awards.
     const snapshot={season,round,externalId:m.external_id,estimate:d.estimate,known:d.known,total:d.total,at:time};
     await db.prepare("INSERT INTO arena_meta(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM beta_members WHERE id=? AND external_id=? AND status='approved') ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(livePrefix+m.id,JSON.stringify(snapshot),m.id,m.external_id).run();
    }else{
     const d=await source.team({externalId:m.external_id,round});
     // The historical endpoint can omit season. Use explicit market context only for the
     // just-settled round, with 12 matching athlete round IDs, and reject explicit mismatches.
     const contextual=d.season===null&&d.roundEvidence===true&&market.season===season&&
      (market.gameOver?round===38:market.status===1&&round===market.round-1);
     if((d.season!==season&&!contextual)||d.round!==round||d.externalId!==m.external_id||typeof d.points!=='number'||!Number.isFinite(d.points)||Math.abs(d.points)>1000)throw Error('Pontuação ou temporada não confirmada.');
     const seasonEvidence=contextual?'current-market-context':'explicit-team-season';
     const points=Math.round(d.points*100),condition="m.id=? AND m.external_id=? AND m.status='approved' AND NOT EXISTS(SELECT 1 FROM beta_scores s WHERE s.member_id=m.id AND s.round=?)";
     const [_,written]=await db.batch([
      db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT m.id,'score',?,? FROM beta_members m WHERE "+condition).bind(JSON.stringify({round,points,source:'cartola',season,seasonEvidence}),time,m.id,m.external_id,round),
      db.prepare("INSERT INTO beta_scores(member_id,round,points) SELECT m.id,?,? FROM beta_members m WHERE "+condition).bind(round,points,m.id,m.external_id,round)
     ]);if(written.meta.changes!==1)continue;
    }
    state.updated++;
   }catch(e){state.failed++;recordFailure(state,e,'team',time);if(e.status===503){state.state='source-limited';break;}}
   finally{if(live)state.cursor=m.id;}
  }
  if(state.state!=='source-limited')state.state=state.failed?'incomplete':'updated';
  return state;
 }catch(e){recordFailure(state,e,stage,time);state.state=e.status===503?'source-limited':'source-unavailable';return state;}
 finally{await put(db,stateKey,JSON.stringify(state)).run();}
}
export async function liveRanking(env,memberId,time=clock()){
 const status=await syncStatus(env);
 if(!status.enabled)return {enabled:false,state:'disabled',rows:[]};
 const last=status.last;
 if(!last||last.mode!=='partial'||last.season!==season||time-last.at>180)return {enabled:true,state:last?.state??'waiting',round:last?.round??null,rows:[],updatedAt:last?.at??null};
 const result=await env.DB.prepare("SELECT m.id,m.team_name,m.external_id,a.value FROM beta_members m LEFT JOIN arena_meta a ON a.key='beta-live:'||m.id WHERE m.status='approved' ORDER BY m.team_name,m.id").all();
 const rows=result.results.map(m=>{const d=decode(m.value),fresh=d?.season===season&&d.round===last.round&&d.externalId===m.external_id&&time-d.at<=360;return {name:m.team_name,mine:m.id===memberId,estimate:fresh?d.estimate:null,known:fresh?d.known:null,total:fresh?d.total:null,at:fresh?d.at:null};});
 rows.sort((a,b)=>a.estimate===null?(b.estimate===null?0:1):b.estimate===null?-1:b.estimate-a.estimate);
 return {enabled:true,state:last.state,season,round:last.round,updatedAt:last.at,rows,provisional:true};
}
