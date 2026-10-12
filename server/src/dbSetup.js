import fs from 'node:fs/promises';
import pg from 'pg';

const SCHEMA_URL = new URL('../db/schema.sql', import.meta.url);

const quoteIdent = (s) => `"${s.replaceAll('"', '""')}"`;

// Create the database named in `url` if it doesn't exist yet. Returns true if it was created
export async function ensureDatabase(url) {
  const dbName = decodeURIComponent(new URL(url).pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount) return false;
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    return true;
  } catch (err) {
    // Not fatal: if the DB really is missing, applySchema() will fail with a clear message
    console.warn(`Could not auto-create database "${dbName}" (${err.message}). Create it manually if needed: createdb ${dbName}`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

// Apply schema
export async function applySchema(url) {
  const sql = await fs.readFile(SCHEMA_URL, 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
