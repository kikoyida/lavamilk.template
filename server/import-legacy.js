// Import previous public reports into an archive, never as verified GitHub identities.
import { readFile } from 'node:fs/promises';
import { createApplication } from './community/index.js';
const app=await createApplication({databaseUrl:process.env.DATABASE_URL,origin:process.env.PUBLIC_ORIGIN});
try { const reports=JSON.parse(await readFile(process.argv[2],'utf8'));await app.importLegacy(reports);console.log(`Archived ${reports.length} legacy reports`); }
finally { await app.close(); }
