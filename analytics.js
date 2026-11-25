import {ranking,validScore} from './core.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function analytics(league,teams,scores){
 const approved=teams.filter(t=>t.status==='approved').map(({id,name,status})=>({id,name,status}));
 const ids=new Set(approved.map(t=>t.id));const selected=scores.filter(s=>ids.has(s.teamId)&&s.round>=league.start_round&&s.round<=league.end_round);
 const rounds=Array.from({length:league.end_round-league.start_round+1},(_,i)=>{const round=i+league.start_round;const rank=ranking(approved,selected,round,round).filter(t=>t.played);return {round,played:rank.length,leader:rank[0]?{id:rank[0].id,name:rank[0].name,points:rank[0].total}:null,average:rank.length?Math.round(rank.reduce((a,t)=>a+t.total,0)/rank.length):null};});
 const histories=ranking(approved,selected,league.start_round,league.end_round).map(t=>({id:t.id,name:t.name,total:t.total,played:t.played,best:t.best,average:t.played?Math.round(t.total/t.played):null,history:rounds.map(r=>({round:r.round,points:selected.find(s=>s.teamId===t.id&&s.round===r.round)?.points??null}))}));
 return {rounds,teams:histories,source:'manual',live:false};
}
export function simulate(league,teams,scores,input){
 const {teamId,round,points}=input||{};
 const approved=teams.filter(t=>t.status==='approved').map(({id,name,status})=>({id,name,status}));
 if(!Number.isSafeInteger(teamId)||!approved.some(t=>t.id===teamId))fail('Time não aprovado nesta liga.',404);
 if(!validScore(round,points)||round<league.start_round||round>league.end_round)fail('Rodada ou pontuação inválida.');
 const before=ranking(approved,scores,league.start_round,league.end_round);
 const after=ranking(approved,[...scores.filter(s=>s.teamId!==teamId||s.round!==round),{teamId,round,points:Math.round(points*100)}],league.start_round,league.end_round);
 return {mode:'simulation',saved:false,previous:before.find(t=>t.id===teamId),projected:after.find(t=>t.id===teamId),rank:after};
}
