// Pontuações informadas pelo organizador. Não são resultados oficiais da fonte externa.
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function scoreBatchInput(input){
 const round=input?.round,raw=input?.rows;
 if(!Number.isInteger(round)||round<1||round>38||typeof raw!=='string'||raw.length>3000)fail(400,'Informe uma rodada válida e a lista de pontos.');
 const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!lines.length||lines.length>20)fail(400,'Envie de 1 a 20 linhas por lote.');
 const seen=new Set(),rows=[];
 for(let i=0;i<lines.length;i++){
  const fields=lines[i].split(';').map(s=>s.trim()),[externalId,rawPoints]=fields;
  if(fields.length!==2||!/^[1-9]\d{0,19}$/.test(externalId)||!/^-?\d{1,4}(?:[.,]\d{1,2})?$/.test(rawPoints))fail(400,'Linha '+(i+1)+': use ID; pontos (ex.: 123456;95,41).');
  const points=Math.round(Number(rawPoints.replace(',','.'))*100);
  if(!Number.isSafeInteger(points)||points< -100000||points>100000||seen.has(externalId))fail(400,'Linha '+(i+1)+': pontuação inválida ou ID repetido.');
  seen.add(externalId);rows.push({externalId,points});
 }
 return {round,rows};
}
export function scoreBatchStatements(db,{round,rows},time){
 const ids=rows.map(r=>r.externalId),slots=ids.map(()=>'?').join(','),cases=rows.map(()=> 'WHEN ? THEN ?').join(' '),pairs=rows.flatMap(r=>[r.externalId,r.points]);
 const expression='CASE m.external_id '+cases+' END';
 const guard="m.status='approved' AND m.external_id IN ("+slots+") AND (SELECT COUNT(*) FROM beta_members WHERE status='approved' AND external_id IN ("+slots+"))=?";
 // Both statements use the same all-or-nothing guard inside one D1 transaction.
 const insert=db.prepare('INSERT INTO beta_scores(member_id,round,points) SELECT m.id,?,'+expression+' FROM beta_members m WHERE '+guard+' ON CONFLICT(member_id,round) DO UPDATE SET points=excluded.points').bind(round,...pairs,...ids,...ids,ids.length);
 const audit=db.prepare("INSERT INTO beta_audit(member_id,action,detail,created_at) SELECT m.id,'score',json_object('round',?,'points',"+expression+"),? FROM beta_members m WHERE "+guard).bind(round,...pairs,time,...ids,...ids,ids.length);
 return [insert,audit];
}
