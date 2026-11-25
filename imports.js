import {validScore} from './core.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Validate the entire batch before changing anything. A preview never writes.
export function importScores(store,leagueId,input){
 const league=store.league(leagueId), rows=input?.rows, apply=input?.apply;
 if(!league)fail(404,'Liga não encontrada');
 if(typeof apply!=='boolean'||!Array.isArray(rows)||rows.length<1||rows.length>200)fail(400,'Informe de 1 a 200 linhas e a operação desejada.');
 const approved=new Set(store.teams(leagueId).filter(t=>t.status==='approved').map(t=>t.id));
 const seen=new Set(), existing=new Map(store.scores(leagueId).map(s=>[`${s.teamId}:${s.round}`,s.points]));
 const normalized=rows.map((row,i)=>{
  const {teamId,round,points}=row||{}; const key=`${teamId}:${round}`;
  if(!Number.isSafeInteger(teamId)||!approved.has(teamId))fail(400,`Linha ${i+1}: time não aprovado nesta liga.`);
  if(!validScore(round,points)||round<league.start_round||round>league.end_round)fail(400,`Linha ${i+1}: rodada ou pontos inválidos para a liga.`);
  if(seen.has(key))fail(400,`Linha ${i+1}: time/rodada duplicado no lote.`);seen.add(key);
  const cents=Math.round(points*100);return {teamId,round,points:cents,previous:existing.get(key)??null};
 });
 const changes=normalized.filter(r=>r.points!==r.previous);
 if(apply&&changes.length){store.db.exec('BEGIN IMMEDIATE');try{for(const r of changes){store.put(leagueId,r.teamId,r.round,r.points);store.audit(leagueId,'importação',`Time #${r.teamId}, rodada ${r.round}: ${r.previous??'novo'} -> ${r.points} centésimos`);}store.db.exec('COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}}
 return {mode:apply?'applied':'preview',total:normalized.length,changed:changes.length,unchanged:normalized.length-changes.length,rows:normalized};
}
