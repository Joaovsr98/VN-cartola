// Experimental read-only adapter. Enable only with explicit authorization from the data provider.
// No login, user cookies, automatic polling, or writes to the external service.
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const ID=/^[1-9]\d{0,15}$/;
export const cartolaEnabled=env=>env.CARTOLA_READ_AUTHORIZED==='true';
export async function readCartolaTeam({externalId,round},fetcher=fetch){
 if(typeof externalId!=='string'||!ID.test(externalId)||!Number.isSafeInteger(Number(externalId)))fail(400,'ID do time inválido.');
 if(!Number.isInteger(round)||round<1||round>38)fail(400,'Rodada inválida.');
 const url='https://api.cartola.globo.com/time/id/'+externalId+'/'+round;
 let response;
 try{response=await fetcher(url,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});}catch{fail(502,'Fonte externa indisponível. Use a pontuação manual.');}
 if(response.status===404)fail(404,'Time ou rodada não encontrados na fonte externa.');
 if([401,403,429].includes(response.status))fail(503,'A fonte não autorizou ou limitou a consulta. Não tente contornar o bloqueio.');
 if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))fail(502,'Resposta externa não reconhecida.');
 const reader=response.body?.getReader();if(!reader)fail(502,'Resposta externa vazia.');
 const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();fail(502,'Resposta externa excede o limite.');}chunks.push(value);}}catch(e){if(e.status)throw e;fail(502,'Falha na leitura da resposta externa.');}
 let data;try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}data=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'JSON externo inválido.');}
 const team=data?.time,name=typeof team?.nome==='string'?team.nome.trim():'',reportedRound=data?.rodada_atual??data?.rodada;
 if(String(team?.time_id)!==externalId||name.length<2||name.length>80||/[\x00-\x1f\x7f]/.test(name)||reportedRound!==round)fail(502,'Não foi possível confirmar o time e a rodada da resposta externa.');
 const points=data?.pontos;if(typeof points!=='number'||!Number.isFinite(points)||points< -1000||points>1000)fail(502,'Pontuação não disponível ou inválida.');
 return {externalId,teamName:name,round,points:Math.round(points*100)/100,source:'external-preview',verifiedSeason:false};
}
