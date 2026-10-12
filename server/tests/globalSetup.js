// Runs once before the suite to create test DB 
export default async function setup() {
  process.env.NODE_ENV = 'test';
  const { DATABASE_URL } = await import('../src/config.js'); // throws if the DB name doesn't end in _test
  const { ensureDatabase, applySchema } = await import('../src/dbSetup.js');
  await ensureDatabase(DATABASE_URL);
  await applySchema(DATABASE_URL);
}
