export function ranking(teams, scores, start=20, end=38) {
 return teams.filter(t=>t.status==='approved').map(t=>{const rounds=scores.filter(s=>s.teamId===t.id&&s.round>=start&&s.round<=end);return {...t,total:rounds.reduce((a,s)=>a+s.points,0),played:rounds.length,best:rounds.length?Math.max(...rounds.map(s=>s.points)):null};}).sort((a,b)=>b.total-a.total||(b.best??-Infinity)-(a.best??-Infinity)||a.id-b.id).map((t,i)=>({...t,position:i+1}));
}
export function bracket(teams,scores,{qualStart=20,qualEnd=29,start=30,size=16}={}) {
 const seeded=ranking(teams,scores,qualStart,qualEnd).filter(t=>t.played>0).slice(0,size);
 if(seeded.length<size)return {ready:false,qualified:seeded.length,required:size,stages:[]};
 const seeds=seeded.map(t=>({...t,seed:t.position}));
 const pts=(t,r)=>scores.find(s=>s.teamId===t.id&&s.round===r)?.points;
 let stages=[], contenders=seeds, third=null;
 for(let level=0;contenders.length>1;level++){
  const round=start+level, matches=[];
  for(let i=0;i<contenders.length/2;i++){
   const a=contenders[i], b=contenders[contenders.length-1-i];
   const pa=a?pts(a,round):undefined,pb=b?pts(b,round):undefined;
   const winner=pa===undefined||pb===undefined?null:pa>pb?a:pb>pa?b:a.seed<b.seed?a:b;
   matches.push({a,b,pa:pa??null,pb:pb??null,winner,loser:winner?(winner.id===a.id?b:a):null});
  }
  if(contenders.length===4) third=matches.map(m=>m.loser);
  stages.push({round,matches});contenders=matches.map(m=>m.winner);
 }
 if(third?.every(Boolean)){const [a,b]=third,r=stages.at(-1).round,pa=pts(a,r),pb=pts(b,r);const winner=pa===undefined||pb===undefined?null:pa>pb?a:pb>pa?b:a.seed<b.seed?a:b;return {ready:true,stages,champion:contenders[0],third:{a,b,pa:pa??null,pb:pb??null,winner}};}
 return {ready:true,stages,champion:contenders[0],third:null};
}
export function validScore(round,points){return Number.isInteger(round)&&round>=1&&round<=38&&Number.isFinite(points)&&Math.abs(points)<=1000&&Math.abs(points*100-Math.round(points*100))<1e-7;}
