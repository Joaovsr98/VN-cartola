// Experimental read-only adapter. Enable only with explicit authorization from the data provider.
// No login, user cookies or writes to the external service. Scheduled reads require explicit authorization.
const fail=(status,message,code,upstreamStatus)=>{throw Object.assign(Error(message),{status,code,upstreamStatus});};
const upstreamFetch=(url,options)=>globalThis.fetch(url,options);
const ID=/^[1-9]\d{0,15}$/;
export const cartolaEnabled=env=>env.CARTOLA_READ_AUTHORIZED==='true';
async function getJson(path,fetcher=upstreamFetch){
 const url='https://api.cartola.globo.com'+path;
 let response;
 try{response=await fetcher(url,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});}catch(e){const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';fail(502,timeout?'Tempo limite da consulta externa.':'Falha de conexão com a fonte externa (ou redirecionamento recusado).',timeout?'timeout':'network-or-redirect');}
 if(response.status===404)fail(404,'Time ou rodada não encontrados na fonte externa.','http',404);
 if([401,403,429].includes(response.status))fail(503,'A fonte não autorizou ou limitou a consulta.','access-limited',response.status);
 if(!response.ok)fail(502,'Resposta HTTP externa sem sucesso.','http',response.status);
 if(!response.headers.get('Content-Type')?.toLowerCase().includes('application/json'))fail(502,'A fonte não retornou JSON.','content-type',response.status);
 const reader=response.body?.getReader();if(!reader)fail(502,'Resposta externa vazia.','empty-body');
 const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();fail(502,'Resposta externa excede o limite.','body-limit');}chunks.push(value);}}catch(e){if(e.status)throw e;fail(502,'Falha na leitura da resposta externa.','body-read');}
 let data;try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}data=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'JSON externo inválido.','invalid-json');}
 return data;
}
function safeId(v){const id=String(v??'');return ID.test(id)&&Number.isSafeInteger(Number(id))?id:null;}
function safeName(v){return typeof v==='string'&&v.trim().length>=2&&v.trim().length<=80&&!/[\x00-\x1f\x7f]/.test(v)?v.trim():null;}
function requireRound(round){if(!Number.isInteger(round)||round<1||round>38)fail(400,'Rodada inválida.');}
function requireId(id){if(typeof id!=='string'||safeId(id)!==id)fail(400,'ID do time inválido.');}
export async function readCartolaSearch(query,fetcher=upstreamFetch){
 if(typeof query!=='string'||query.trim().length<2||query.trim().length>60||/[\x00-\x1f\x7f]/.test(query))fail(400,'Informe de 2 a 60 caracteres do nome do time.');
 const data=await getJson('/times?q='+encodeURIComponent(query.trim()),fetcher);
 if(!Array.isArray(data))fail(502,'Formato de busca não reconhecido.');
 const seen=new Set(),teams=[];
 for(const t of data){const externalId=safeId(t?.time_id),teamName=safeName(t?.nome);if(!externalId||!teamName||seen.has(externalId))continue;seen.add(externalId);teams.push({externalId,teamName});if(teams.length===20)break;}
 return {teams,source:'external-preview'};
}
export async function readCartolaMarket(fetcher=upstreamFetch){
 const d=await getJson('/mercado/status',fetcher),round=d?.rodada_atual,status=d?.status_mercado;
 if(!Number.isInteger(round)||round<1||round>38||!Number.isInteger(status))fail(502,'Status de mercado não reconhecido.','invalid-market');
 const season=Number.isInteger(d.temporada)?d.temporada:null;
 return {round,status,season,gameOver:d.game_over===true,source:'external-preview',verifiedSeason:season!==null};
}
export async function readCartolaTeam({externalId,round},fetcher=upstreamFetch){
 requireId(externalId);requireRound(round);
 const data=await getJson('/time/id/'+externalId+'/'+round,fetcher);
 const team=data?.time,name=safeName(team?.nome),reportedRound=data?.rodada_atual??data?.rodada;
 if(safeId(team?.time_id)!==externalId||!name||reportedRound!==round)fail(502,'Não foi possível confirmar o time e a rodada da resposta externa.');
 const points=data?.pontos;if(typeof points!=='number'||!Number.isFinite(points)||points< -1000||points>1000)fail(502,'Pontuação não disponível ou inválida.');
 const season=Number.isInteger(data.temporada)?data.temporada:null;
 return {externalId,teamName:name,round,points:Math.round(points*100)/100,season,source:'external-preview',verifiedSeason:season!==null};
}
export async function readCartolaLineup({externalId,round},fetcher=upstreamFetch){
 requireId(externalId);requireRound(round);
 const d=await getJson('/time/id/'+externalId,fetcher),name=safeName(d?.time?.nome),reportedRound=d?.rodada_atual??d?.rodada;
 if(safeId(d?.time?.time_id)!==externalId||!name||reportedRound!==round||!Array.isArray(d?.atletas)||d.atletas.length!==12)fail(502,'Escalação completa e rodada não confirmadas.');
 const starters=d.atletas.map(a=>({id:safeId(a?.atleta_id),position:a?.posicao_id,name:safeName(a?.apelido??a?.nome)})),captainId=safeId(d.capitao_id);
 if(starters.some(a=>!a.id||!a.name||!Number.isInteger(a.position)||a.position<1||a.position>6)||new Set(starters.map(a=>a.id)).size!==12||starters.filter(a=>a.position===6).length!==1||!starters.some(a=>a.id===captainId&&a.position!==6))fail(502,'Atletas ou capitão da escalação não confirmados.');
 return {externalId,teamName:name,round,starters,captainId,source:'external-preview',verifiedSeason:false};
}
export async function readCartolaAthletes(round,fetcher=upstreamFetch){
 requireRound(round);const d=await getJson('/atletas/pontuados',fetcher);
 // Do not infer the season or round from an endpoint with ambiguous metadata.
 if((d?.rodada_atual??d?.rodada)!==round||!d.atletas||typeof d.atletas!=='object'||Array.isArray(d.atletas))fail(502,'Rodada das parciais não confirmada.');
 const points=Object.create(null);
 for(const [id,a] of Object.entries(d.atletas)){if(safeId(id)!==id)continue;const p=a?.pontuacao;if(typeof p==='number'&&Number.isFinite(p)&&Math.abs(p)<=1000)points[id]=Math.round(p*100);}
 return {round,points};
}
export function estimatePartial(lineup,athletes){
 if(lineup.round!==athletes.round)fail(400,'Rodadas divergentes.');
 let sum=0,known=0;const players=lineup.starters.map(a=>{const p=athletes.points[a.id];const available=Number.isSafeInteger(p);if(available){sum+=a.id===lineup.captainId?Math.round(p*1.5):p;known++;}
 return {...a,points:available?p/100:null,captain:a.id===lineup.captainId};});
 return {externalId:lineup.externalId,teamName:lineup.teamName,round:lineup.round,players,known,total:players.length,estimate:known?sum/100:null,source:'external-estimate',verifiedSeason:false,includesReserveRules:false};
}
