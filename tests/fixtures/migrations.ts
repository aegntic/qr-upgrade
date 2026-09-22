import {readFileSync} from 'node:fs';
import type {DatabaseSync} from 'node:sqlite';
export function migrate(sqlite:DatabaseSync){
 for(const name of ['0001_art_jobs','0002_accounts','0003_links','0004_content','0005_billing','0006_account_security','0007_account_lifecycle'])sqlite.exec(readFileSync(new URL(`../../workers/qr-service/migrations/${name}.sql`,import.meta.url),'utf8'));
}
