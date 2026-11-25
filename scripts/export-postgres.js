import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const tables={leagues:['id','name','season','start_round','end_round','knockout_start','knockout_size'],accounts:['id','username','salt','hash','created_at'],teams:['id','league_id','name','manager','external_id','status','created_at'],memberships:['account_id','league_id','team_id'],scores:['league_id','team_id','round','points'],audit:['id','league_id','action','detail','created_at']};
const quote=v=>{if(v===null)return 'NULL';if(typeof v==='number'&&Number.isSafeInteger(v))return String(v);if(typeof v!=='string'||v.includes('\0'))throw Error('Valor não exportável');return "'"+v.replaceAll("'","''")+"'";};
export function exportPostgres(db){
 const sql=['BEGIN;','SET LOCAL standard_conforming_strings = on;',"SET LOCAL TIME ZONE 'UTC';",'LOCK TABLE '+Object.keys(tables).map(t=>'public.'+t).join(', ')+' IN ACCESS EXCLUSIVE MODE;'];
 sql.push("DO $guard$ BEGIN IF "+Object.keys(tables).map(t=>`EXISTS (SELECT 1 FROM public.${t})`).join(' OR ')+" THEN RAISE EXCEPTION 'Banco de destino deve estar vazio'; END IF; END $guard$;");
 db.exec('BEGIN');try{for(const [table,columns] of Object.entries(tables)){const rows=db.prepare(`SELECT ${columns.join(',')} FROM ${table}`).all();for(const r of rows)sql.push(`INSERT INTO public.${table} (${columns.join(',')}) VALUES (${columns.map(c=>quote(r[c])).join(',')});`);if(columns[0]==='id')sql.push(`SELECT setval(pg_get_serial_sequence('public.${table}','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM public.${table};`);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 return sql.concat('COMMIT;','').join('\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [source,destination,confirm]=process.argv.slice(2);
 if(!source||!destination||confirm!=='--confirm-sensitive')throw Error('Uso: node scripts/export-postgres.js origem.sqlite destino.sql --confirm-sensitive (contém hashes e dados privados)');
 const db=new DatabaseSync(source,{readOnly:true});try{writeFileSync(destination,exportPostgres(db),{mode:0o600,flag:'wx'});}finally{db.close();}
 console.log('Exportação privada gerada. Não envie ao GitHub.');
}
