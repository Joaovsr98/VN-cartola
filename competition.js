import {ranking,bracket} from './core.js';
const brief=t=>t?{id:t.id,name:t.name}:null;
export function competition(league,teams,scores){
 const approved=teams.filter(t=>t.status==='approved'),ids=new Set(approved.map(t=>t.id));
 const records=scores.filter(s=>ids.has(s.teamId)&&s.round>=league.start_round&&s.round<=league.end_round);
 const keys=new Set(records.map(s=>s.teamId+':'+s.round));
 const closed=round=>approved.length>0&&approved.every(t=>keys.has(t.id+':'+round));
 const rounds=Array.from({length:league.end_round-league.start_round+1},(_,i)=>league.start_round+i);
 const complete=rounds.every(closed),completedRounds=rounds.filter(closed).length;
 const ranked=ranking(approved,records,league.start_round,league.end_round).filter(t=>t.played>0);
 const qualification=rounds.filter(r=>r<league.knockout_start).every(closed);
 const knockout=qualification?bracket(approved,records,{qualStart:league.start_round,qualEnd:league.knockout_start-1,start:league.knockout_start,size:league.knockout_size}):null;
 const final=knockout?.stages.at(-1)?.matches[0];
 const knockoutComplete=Boolean(qualification&&knockout?.champion&&knockout.stages.every(s=>s.matches.every(m=>m.winner))&&(league.knockout_size<4||knockout.third?.winner));
 const best=[...records].sort((a,b)=>b.points-a.points||a.round-b.round||a.teamId-b.teamId)[0];
 const mito=best?{...brief(approved.find(t=>t.id===best.teamId)),round:best.round,points:best.points}:null;
 const podium=ranked.slice(0,3).map(t=>({...brief(t),position:t.position,points:t.total}));
 const awards=[
 {key:'league',label:'Campeonato',status:complete?'finished':'ongoing',provisional:!complete,positions:podium},
 {key:'knockout',label:'Mata-mata',status:knockoutComplete?'finished':qualification?'ongoing':'waiting',provisional:!knockoutComplete,positions:knockoutComplete?[{...brief(knockout.champion),position:1},{...brief(final.loser),position:2},...(knockout.third?.winner?[{...brief(knockout.third.winner),position:3}]:[])]:[]},
 {key:'mito',label:'Mito do turno',status:complete?'finished':'ongoing',provisional:!complete,positions:mito?[{...mito,position:1}]:[]}
 ];
 return {season:league.season,completedRounds,totalRounds:rounds.length,complete,awards,history:complete?[{season:league.season,league:league.name,champion:brief(ranked[0]),simulated:true}]:[],rules:{start:league.start_round,end:league.end_round,knockoutStart:league.knockout_start,knockoutSize:league.knockout_size},simulated:true,payments:false};
}
