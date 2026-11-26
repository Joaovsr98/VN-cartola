import {ranking} from './core.js';
import {ATHLETES} from './public/market.js';
const slots={GOL:1,LAT:2,ZAG:2,MEI:3,ATA:3};
const positions=Object.keys(slots);
function roster(id,round){
 const starters=[],reserves=[];
 for(const [k,position] of positions.entries()){
  const pool=ATHLETES.filter(p=>p.position===position),offset=(id*(k+1)+Math.floor(id/8)*(k+3)+round)%pool.length;
  const ordered=Array.from({length:pool.length},(_,i)=>pool[(i+offset)%pool.length]);
  starters.push(...ordered.slice(0,slots[position]));reserves.push(ordered[slots[position]]);
 }
 const coach=ATHLETES.filter(p=>p.position==='TEC')[(id+round)%8];
 return {starters,reserves,coach};
}
function base(p,round){return 150+((p.id*137+round*173+p.id*round*11)%1050);}
function build(team,round){
 const {starters,reserves,coach}=roster(team.id,round),captain=starters.filter(p=>p.position==='ATA')[(team.id+round)%3].id;
 const players=[...starters,...reserves].map((p,i)=>{const starter=i<11,c=p.id===captain&&starter,basePoints=starter?base(p,round):null,bonus=c?Math.round(basePoints/2):0;return {...p,starter,captain:c,basePoints,bonus,points:starter?basePoints+bonus:null,valuation:starter?((p.id*71+round*19)%301)-150:null};});
 const remaining=320+(team.id*11%400),teamCost=starters.reduce((s,p)=>s+p.price,0)+coach.price;
 const formation=[['ATA'],['MEI'],['LAT','ZAG'],['GOL']].map((positions,i)=>({label:['Ataque','Meio-campo','Defesa','Goleiro'][i],players:players.filter(p=>p.starter&&positions.includes(p.position))}));
 const points=players.filter(p=>p.starter).reduce((s,p)=>s+p.points,0),withoutCaptain=players.filter(p=>p.starter).reduce((s,p)=>s+p.basePoints,0);
 return {teamId:team.id,round,points,withoutCaptain,players,formation,formationLabel:'4-3-3',coach:{...coach,points:null},budget:{patrimony:teamCost+remaining,teamCost,remaining},simulated:true};
}
export const demoTotal=(id,round)=>build({id},round).points;
export const demoPatrimony=(id,round)=>build({id},round).budget.patrimony;
export function lineup(team,round,points){if(points==null)return null;const result=build(team,round);if(result.points!==points)throw Error('Pontuação demonstrativa inconsistente');return result;}
export function compareTeams(left,right){
 if(!left||!right)return null;
 const a=left.players.filter(p=>p.starter),b=right.players.filter(p=>p.starter),shared=a.filter(p=>b.some(q=>q.id===p.id)).map(p=>p.id);
 const groups=positions.map(position=>{const l=a.filter(p=>p.position===position),r=b.filter(p=>p.position===position),common=l.filter(p=>shared.includes(p.id)),rows=common.map(p=>({left:p,right:r.find(q=>q.id===p.id),common:true}));const la=l.filter(p=>!shared.includes(p.id)),rb=r.filter(p=>!shared.includes(p.id));for(let i=0;i<Math.max(la.length,rb.length);i++)rows.push({left:la[i]??null,right:rb[i]??null,common:false});return {position,rows,leftPoints:l.reduce((s,p)=>s+p.points,0),rightPoints:r.reduce((s,p)=>s+p.points,0)};});
 return {leftPoints:left.points,rightPoints:right.points,difference:left.points-right.points,commonCount:shared.length,commonIds:shared,groups,simulated:true};
}
export function recordedLineup(team,round,record){if(!record||record.demoFixture===0)return null;return lineup(team,round,record.points);}
export function richRanking(teams,scores,league,round){
 const end=Math.min(round,league.end_round);
 const current=ranking(teams,scores,league.start_round,end);
 const previous=ranking(teams,scores,league.start_round,end-1);
 const previousPositions=new Map(previous.filter(t=>t.played>0).map(t=>[t.id,t.position]));
 const byRound=new Map(scores.filter(s=>s.round===round).map(s=>[s.teamId,s]));
 const leader=current[0]?.total??0;
 return current.map(t=>{
  const record=byRound.get(t.id),roundPoints=record?.points??null, prior=previousPositions.get(t.id);
  const profile=recordedLineup(t,round,record);
  return {...t,manager:'Cartoleiro '+String(t.id).padStart(2,'0'),crest:t.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(),roundPoints,movement:roundPoints===null||prior===undefined?null:prior-t.position,patrimony:profile?.budget.patrimony??null,valuation:!profile?null:((t.id*73+round*41)%1101)-550,leaderGap:leader-t.total,captain:profile?.players.find(p=>p.captain)?.name??null};
 });
}
