// `npm run db:init`
import { DATABASE_URL } from '../src/config.js';
import { ensureDatabase, applySchema } from '../src/dbSetup.js';

const created = await ensureDatabase(DATABASE_URL);
if (created) console.log('Created database.');
await applySchema(DATABASE_URL);
console.log('Schema is up to date.');
