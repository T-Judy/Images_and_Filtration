import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(SERVER_DIR, '.env'), quiet: true });
export const PORT = Number(process.env.PORT) || 3001;
export const IS_TEST = process.env.NODE_ENV === 'test';

// DB  ----------------------------------------------------------------
function withTestSuffix(url) {
  const u = new URL(url);
  u.pathname += '_test';
  return u.toString();
}

function resolveDatabaseUrl() {
  const main = process.env.DATABASE_URL;
  if (IS_TEST) {
    const testUrl = process.env.TEST_DATABASE_URL || (main && withTestSuffix(main));
    if (!testUrl) throw new Error('Set DATABASE_URL (or TEST_DATABASE_URL) in server/.env');
    const dbName = decodeURIComponent(new URL(testUrl).pathname.slice(1));
    if (!dbName.endsWith('_test')) {
      throw new Error(`Refusing to run tests against "${dbName}": test database names must end in "_test".`);
    }
    return testUrl;
  }
  if (!main) throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and edit it.');
  return main;
}

export const DATABASE_URL = resolveDatabaseUrl();

// Media ----------------------------------------------------------------
export const MEDIA_URL = '/media/';
export const MEDIA_ROOT = path.resolve(
  process.env.MEDIA_ROOT ||
    (IS_TEST ? path.join(os.tmpdir(), 'status-effects-test-media') : path.join(SERVER_DIR, 'media')),
);
export const ICON_DIR = 'status_icons'; // sub-folder under MEDIA_ROOT (upload_to="status_icons/...")

// Upload filesize cap; Def = 5MB, overide in .env
export const MAX_UPLOAD_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

// If the React app is built have express serve that too
export const CLIENT_DIST = path.resolve(SERVER_DIR, '..', 'client', 'dist');
