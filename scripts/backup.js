import {DatabaseSync,backup} from 'node:sqlite';
import {openSync,closeSync,unlinkSync,chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export async function backupDatabase(source,destination){
 const db=new DatabaseSync(source,{readOnly:true});let owned=false;
 try{closeSync(openSync(destination,'wx',0o600));owned=true;await backup(db,destination);chmodSync(destination,0o600);const check=new DatabaseSync(destination,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||check.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup inconsistente');}finally{check.close();}}
 catch(e){if(owned)unlinkSync(destination);throw e;}finally{db.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [source,destination,confirm]=process.argv.slice(2);if(!source||!destination||confirm!=='--confirm-sensitive')throw Error('Uso: node scripts/backup.js origem.sqlite destino.sqlite --confirm-sensitive');await backupDatabase(source,destination);console.log('Backup privado validado. Não publique.');}
