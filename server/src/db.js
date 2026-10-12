import pg from 'pg';
import { DATABASE_URL } from './config.js';

export const pool = new pg.Pool({ connectionString: DATABASE_URL });
export const query = (text, params) => pool.query(text, params);

// Run fn(client) inside BEGIN/COMMIT so we can rollback if it explodes
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
