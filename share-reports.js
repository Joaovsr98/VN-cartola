const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const name=v=>String(v).replace(/[\x00-\x1f\x7f*_~\x60]/g,' ').replace(/\s+/g,' ').trim();
const pts=v=>v==null?'Aguardando':(v/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' pts';
const sign='\n\nVN Arena | Pernas de Pau';
export function reportInput(q){
 const start=Number(q.get('start')),round=Number(q.get('round')),end=start+17;
 if(!Number.isInteger(start)||start<1||end>38||!Number.isInteger(round)||round<start||round>end)fail(400,'Informe o início do turno e uma rodada dentro das 18 rodadas.');
 const a=q.get('a')||'',b=q.get('b')||'',leg=q.get('leg')||'ida';
 if((a||b)&&(!/^[1-9]\d{0,19}$/.test(a)||!/^[1-9]\d{0,19}$/.test(b)||a===b||!['ida','volta'].includes(leg)))fail(400,'Informe dois IDs diferentes e ida ou volta.');
 return {start,end,round,a,b,leg};
}
export async function shareReports(db,q){
 const {start,end,round,a,b,leg}=reportInput(q);
 const [best,rs,ts,coverage]=await db.batch([
 db.prepare("SELECT m.team_name AS name,s.round,s.points FROM beta_scores s JOIN beta_members m ON m.id=s.member_id WHERE m.status='approved' AND s.round BETWEEN ? AND ? AND s.points=(SELECT MAX(x.points) FROM beta_scores x JOIN beta_members y ON y.id=x.member_id WHERE y.status='approved' AND x.round BETWEEN ? AND ?) ORDER BY s.round,m.team_name,m.id").bind(start,round,start,round),
 db.prepare("SELECT m.team_name AS name,s.points FROM beta_scores s JOIN beta_members m ON m.id=s.member_id WHERE m.status='approved' AND s.round=? ORDER BY s.points DESC,m.team_name,m.id").bind(round),
 db.prepare("SELECT m.team_name AS name,COUNT(s.round) AS played,COALESCE(SUM(s.points),0) AS total FROM beta_members m LEFT JOIN beta_scores s ON s.member_id=m.id AND s.round BETWEEN ? AND ? WHERE m.status='approved' GROUP BY m.id,m.team_name ORDER BY CASE WHEN COUNT(s.round)>0 THEN 0 ELSE 1 END,total DESC,m.team_name,m.id").bind(start,round),
 db.prepare("SELECT COUNT(*) AS scored FROM beta_scores s JOIN beta_members m ON m.id=s.member_id WHERE m.status='approved' AND s.round=?").bind(round)
 ]);
 const teams=ts.results,complete=teams.length>0&&round===end&&teams.every(t=>t.played===18),covered=coverage.results[0].scored,rows=rs.results;
 const window='Rodadas '+start+' a '+end+' · apuração até '+round;
 const mito='👑 *MITO DO TURNO*\n'+window+'\n'+(complete?'Apuração completa':'Provisório')+'\n\n'+(best.results.length?best.results.map(t=>'🏆 '+name(t.name)+' — '+pts(t.points)+' (rodada '+t.round+')').join('\n'):'Nenhuma pontuação registrada.')+sign;
 let pos=0,prev=null;const medal=['🥇','🥈','🥉'];
 const podium=rows.map((r,i)=>{if(i===0||r.points!==prev)pos=i+1;prev=r.points;return {...r,pos};}).filter(r=>r.pos<=3);
 const better='⭐ *MELHOR DA RODADA*\n📅 Rodada '+round+'\n'+covered+'/'+teams.length+' times com pontos registrados'+(covered===teams.length&&covered>0?'':' · parcial')+'\n\n'+(podium.length?podium.map(t=>medal[t.pos-1]+' '+name(t.name)+' — '+pts(t.points)).join('\n'):'Nenhuma pontuação registrada.')+sign;
 const scored=teams.filter(t=>t.played>0),cut=scored.slice(0,32),tie=cut.length===32&&scored.length>32&&cut[31].total===scored[32].total;
 const final=complete&&!tie;
 const top='🏆 *TOP 32 — ELIMINATÓRIAS*\n'+window+'\n'+(final?'Classificação do turno apurada':'Classificação provisória')+'\n\n'+(cut.length?cut.map((t,i)=>(i+1)+'º '+name(t.name)+' — '+pts(t.total)).join('\n'):'Nenhum time com pontuação.')+'\n\n'+(tie?'Empate no corte do 32º lugar: aguardar critério de desempate.':final?'Até 32 times classificados.':'A classificação ainda não é definitiva.')+sign;
 let duel='⚔️ *DUELOS — PONTOS CORRIDOS*\n📅 Rodada '+round+'\n🔄 '+(leg==='ida'?'Ida':'Volta')+'\n\nInforme os dois IDs públicos para gerar o confronto.'+sign;
 if(a&&b){
 const r=await db.prepare("SELECT m.external_id,m.team_name AS name,s.points FROM beta_members m LEFT JOIN beta_scores s ON s.member_id=m.id AND s.round=? WHERE m.status='approved' AND m.external_id IN (?,?)").bind(round,a,b).all();
 const x=r.results.find(t=>t.external_id===a),y=r.results.find(t=>t.external_id===b);if(!x||!y)fail(404,'Os dois times precisam estar aprovados.');
 const result=x.points==null||y.points==null?'Aguardando pontuação dos dois times.':x.points===y.points?'🤝 Empate.':'🏆 Vencedor: '+name(x.points>y.points?x.name:y.name);
 duel='⚔️ *DUELOS — PONTOS CORRIDOS*\n📅 Rodada '+round+'\n🔄 '+(leg==='ida'?'Ida':'Volta')+'\n\n'+name(x.name)+' ('+pts(x.points)+') × ('+pts(y.points)+') '+name(y.name)+'\n\n'+result+'\nConfronto informado pelo organizador; pontuação de liga ainda não definida.'+sign;
 }
 return {start,end,round,complete,cutoffTie:tie,messages:{mito,better,top,duel}};
}
