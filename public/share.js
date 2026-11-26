const number=v=>v==null?'':(v/100).toFixed(2).replace('.',',');
const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function rankingCsv(league,round,list){const fields=['Liga','Rodada','Posição','Time','Cartoleiro','Pontos rodada','Pontos acumulados'];return '\uFEFF'+[fields.map(safe).join(';'),...list.map(t=>[league,round,t.position,t.name,t.manager,number(t.roundPoints),number(t.total)].map(safe).join(';'))].join('\r\n');}
export function rankingText(league,round,list){return ['VN Arena — '+league,'Rodada '+round+' · dados demonstrativos',...list.map(t=>t.position+'º '+t.name+' — '+number(t.total)+' pts acumulados')].join('\n');}
