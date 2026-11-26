// All values in cents of fictional cartoletas, never real money.
export const BUDGET=14575;
export const FORMATIONS=Object.freeze({'4-3-3':{GOL:1,LAT:2,ZAG:2,MEI:3,ATA:3,TEC:1},'4-4-2':{GOL:1,LAT:2,ZAG:2,MEI:4,ATA:2,TEC:1},'3-5-2':{GOL:1,LAT:0,ZAG:3,MEI:5,ATA:2,TEC:1},'3-4-3':{GOL:1,LAT:0,ZAG:3,MEI:4,ATA:3,TEC:1}});
const clubs=['Aurora','Vila','Estrela','União','Fênix'];
const first=['Caio','Ravi','Breno','Davi','Theo','Nilo','Iuri','Luan'];
const last=['Luz','Vale','Serra','Prado','Monte','Costa','Lago','Reis'];
export const ATHLETES=Object.freeze(Object.keys(FORMATIONS['4-3-3']).flatMap((position,k)=>Array.from({length:8},(_,i)=>Object.freeze({id:k*8+i+1,name:first[(i+k)%8]+' '+last[(i+2*k)%8],position,club:clubs[(i+k)%5],price:500+((i*173+k*197)%1050)}))));
export function emptyDraft(formation='4-3-3'){if(!Object.hasOwn(FORMATIONS,formation))throw Error('Formação inválida.');return {formation,ids:[],captain:null};}
export function inspectDraft(draft){
 if(!draft||!Object.hasOwn(FORMATIONS,draft.formation)||!Array.isArray(draft.ids)||new Set(draft.ids).size!==draft.ids.length)throw Error('Escalação inválida.');
 const slots=FORMATIONS[draft.formation],counts=Object.fromEntries(Object.keys(slots).map(k=>[k,0]));
 const players=draft.ids.map(id=>{const p=ATHLETES.find(a=>a.id===id);if(!p)throw Error('Atleta não encontrado.');counts[p.position]++;if(counts[p.position]>slots[p.position])throw Error('Posição preenchida nesta formação.');return p;});
 const cost=players.reduce((s,p)=>s+p.price,0);if(cost>BUDGET)throw Error('Saldo insuficiente.');
 if(draft.captain!==null&&!players.some(p=>p.id===draft.captain&&p.position!=='TEC'))throw Error('Capitão inválido.');
 return {players,counts,slots,cost,remaining:BUDGET-cost,complete:Object.keys(slots).every(k=>counts[k]===slots[k])&&draft.captain!==null};
}
export function toggleAthlete(draft,id){inspectDraft(draft);const removing=draft.ids.includes(id);const next={...draft,ids:removing?draft.ids.filter(x=>x!==id):[...draft.ids,id],captain:removing&&draft.captain===id?null:draft.captain};inspectDraft(next);return next;}
export function chooseCaptain(draft,id){const next={...draft,captain:id};inspectDraft(next);return next;}
export function changeFormation(draft,formation){inspectDraft(draft);const next=emptyDraft(formation);for(const id of draft.ids){const p=ATHLETES.find(a=>a.id===id);if(next.ids.filter(x=>ATHLETES.find(a=>a.id===x).position===p.position).length<FORMATIONS[formation][p.position])next.ids.push(id);}next.captain=next.ids.includes(draft.captain)?draft.captain:null;inspectDraft(next);return next;}
export function autoFill(draft){inspectDraft(draft);let next=emptyDraft(draft.formation);for(const [position,count] of Object.entries(FORMATIONS[next.formation])){const sorted=ATHLETES.filter(a=>a.position===position).sort((a,b)=>a.price-b.price||a.id-b.id);for(const a of sorted.slice(0,count))next=toggleAthlete(next,a.id);}return chooseCaptain(next,next.ids.find(id=>ATHLETES.find(a=>a.id===id).position==='ATA'));}
