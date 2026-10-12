import fs from 'node:fs/promises';
import { PORT, MEDIA_ROOT } from './config.js';
import { pool } from './db.js';
import { createApp } from './app.js';

await fs.mkdir(MEDIA_ROOT, { recursive: true });

const server = createApp().listen(PORT, () => {
  console.log(`Status Effects API listening on http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
