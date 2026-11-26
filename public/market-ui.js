import {BUDGET,ATHLETES,emptyDraft,inspectDraft,toggleAthlete,chooseCaptain,changeFormation,autoFill} from './market.js?v=0.6.5';
const $=s=>document.querySelector(s), el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
const cash=v=>'C$ '+(v/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
let draft=emptyDraft();const key='vn-arena-market-v1';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&inspectDraft(saved).complete)draft=saved;}catch{}
const status=$('#marketStatus');
function update(fn,message){try{draft=fn();status.textContent=message||'';render();}catch(e){status.textContent=e.message;}}
function shirt(p){const x=el('span',p.position,'pitch-shirt club-shirt-'+(p.id%5));x.setAttribute('aria-hidden','true');return x;}
function render(){const info=inspectDraft(draft);$('#marketFormation').value=draft.formation;
 const budget=$('#marketBudget');budget.replaceChildren();for(const [label,value] of [['Patrimônio',BUDGET],['Escalado',info.cost],['Saldo',info.remaining]]){const item=el('div');item.append(el('small',label),el('strong',cash(value)));budget.append(item);}
 const pitch=$('#marketPitch');pitch.replaceChildren();for(const group of [['ATA'],['MEI'],['LAT','ZAG'],['GOL']]){const line=el('div',undefined,'pitch-line');for(const position of group){const selected=info.players.filter(p=>p.position===position);for(let i=0;i<info.slots[position];i++){const p=selected[i],tile=el('div',undefined,'pitch-player');if(p){tile.append(shirt(p),el('strong',p.name+(draft.captain===p.id?' · C':'')),el('b',cash(p.price)));}else{tile.append(el('span','+','pitch-shirt vacant-shirt'),el('strong',position));}line.append(tile);}}pitch.append(line);}
 const selected=$('#marketSelected');selected.replaceChildren(el('h3',info.players.length+'/12 selecionados · '+(draft.captain?'Capitão definido':'Escolha o capitão')));
 for(const p of info.players){const row=el('div',undefined,'market-player'),label=el('div',undefined,'market-player-name');label.append(el('strong',p.name),el('small',p.position+' · '+p.club+' · '+cash(p.price)));row.append(label);if(p.position!=='TEC'){const c=el('button',draft.captain===p.id?'Capitão':'Definir C');c.type='button';c.classList.toggle('active',draft.captain===p.id);c.onclick=()=>update(()=>chooseCaptain(draft,p.id));row.append(c);}const remove=el('button','Remover');remove.type='button';remove.onclick=()=>update(()=>toggleAthlete(draft,p.id));row.append(remove);selected.append(row);}
 $('#marketSave').disabled=!info.complete;
 const filter=$('#marketPosition').value,q=$('#marketSearch').value.trim().toLocaleLowerCase('pt-BR'),list=$('#marketList');list.replaceChildren();for(const p of ATHLETES.filter(p=>(!filter||p.position===filter)&&(p.name+' '+p.club).toLocaleLowerCase('pt-BR').includes(q))){const row=el('div',undefined,'market-player'),label=el('div',undefined,'market-player-name');label.append(el('strong',p.name),el('small',p.position+' · '+p.club+' · '+cash(p.price)));const chosen=draft.ids.includes(p.id),b=el('button',chosen?'Remover':'Escalar');b.type='button';b.disabled=!chosen&&(info.counts[p.position]>=info.slots[p.position]||p.price>info.remaining);b.onclick=()=>update(()=>toggleAthlete(draft,p.id));row.append(shirt(p),label,b);list.append(row);}if(!list.children.length)list.append(el('p','Nenhum atleta encontrado.'));
}
$('#marketFormation').onchange=e=>{update(()=>changeFormation(draft,e.target.value),'Formação alterada; vagas incompatíveis foram liberadas.');};
$('#marketPosition').onchange=render;$('#marketSearch').oninput=render;
$('#marketAuto').onclick=()=>update(()=>autoFill(draft),'Escalação automática de demonstração.');
$('#marketClear').onclick=()=>update(()=>emptyDraft(draft.formation),'Escalação limpa.');
$('#marketSave').onclick=()=>{try{if(!inspectDraft(draft).complete)throw Error('Complete o time e escolha o capitão.');localStorage.setItem(key,JSON.stringify(draft));status.textContent='Simulação salva somente neste aparelho.';}catch(e){status.textContent=e.message||'Não foi possível salvar neste aparelho.';}};
render();
