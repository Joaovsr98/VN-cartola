import {ranking} from './core.js';
const captainNames=['Caio Luz','Davi Prado','Ravi Monte','Breno Vale','Iuri Lago','Nilo Reis','Theo Costa','Luan Serra'];
const names=['João Luz','Caio Prado','Ravi Monte','Breno Vale','Iuri Lago','Nilo Reis','Theo Costa','Luan Serra','Rafael Sol','Davi Rio','Hugo Campos','Enzo Mar','Leo Dias','Noah Lima','Otávio Melo','Vicente Pires'];
const positions=['GOL','LAT','ZAG','ZAG','LAT','MEI','MEI','MEI','ATA','ATA','ATA','GOL','ZAG','MEI','ATA','LAT'];
const clubs=['Aurora','Vila','Estrela','União','Fênix'];
export function lineup(team,round,points){
 if(points==null)return null;
 const captainIndex=8+((team.id+round)%3);
 const weights=Array.from({length:11},(_,i)=>2+((team.id*7+round*3+i*11)%9));
 const totalWeight=weights.reduce((a,b)=>a+b,0);
 let allocated=0;
 const players=names.map((_,i)=>{
  const starter=i<11;
  const value=starter?(i===10?points-allocated:Math.trunc(points*weights[i]/totalWeight)):null;
  if(starter)allocated+=value;
  return {name:i===captainIndex?captainNames[(team.id+round)%captainNames.length]:names[(i+team.id)%names.length],position:positions[i],club:clubs[(team.id+i)%clubs.length],captain:i===captainIndex,starter,points:value};
 });
 const formation=[['ATA'],['MEI'],['LAT','ZAG'],['GOL']].map((positions,i)=>({label:['Ataque','Meio-campo','Defesa','Goleiro'][i],players:players.filter(p=>p.starter&&positions.includes(p.position))}));
 return {teamId:team.id,round,points,players,formation,formationLabel:'4-3-3',simulated:true};
}
export function richRanking(teams,scores,league,round){
 const end=Math.min(round,league.end_round);
 const current=ranking(teams,scores,league.start_round,end);
 const previous=ranking(teams,scores,league.start_round,end-1);
 const previousPositions=new Map(previous.filter(t=>t.played>0).map(t=>[t.id,t.position]));
 const byRound=new Map(scores.filter(s=>s.round===round).map(s=>[s.teamId,s.points]));
 const leader=current[0]?.total??0;
 return current.map(t=>{
  const roundPoints=byRound.get(t.id)??null, prior=previousPositions.get(t.id);
  const profile=lineup(t,round,roundPoints);
  return {...t,manager:'Cartoleiro '+String(t.id).padStart(2,'0'),crest:t.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(),roundPoints,movement:roundPoints===null||prior===undefined?null:prior-t.position,patrimony:roundPoints===null?null:11000+((t.id*947+round*137)%7900),valuation:roundPoints===null?null:((t.id*73+round*41)%1101)-550,leaderGap:leader-t.total,captain:profile?.players.find(p=>p.captain)?.name??null};
 });
}
