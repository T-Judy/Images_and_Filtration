import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_ROOT, MEDIA_URL, ICON_DIR } from './config.js';

/**
 * Save an uploaded icon under MEDIA_ROOT/status_icons/<random>.<ext>.
 * Leaving client filenames is a significant risk, so we must rename them.
 * Returns the path relative to MEDIA_ROOT, which is what gets stored in the database.
 */
export async function saveIcon({ originalname, buffer }) {
  const ext = path.extname(originalname).toLowerCase();
  const relPath = `${ICON_DIR}/${randomUUID().replaceAll('-', '')}${ext}`;
  const absPath = path.join(MEDIA_ROOT, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer, { flag: 'wx' });
  return relPath;
}


//Delete a stored icon. Best-effort: a missing file is fine.
export async function deleteIcon(relPath) {
  if (!relPath) return;
  const absPath = path.resolve(MEDIA_ROOT, relPath);
  if (!absPath.startsWith(MEDIA_ROOT + path.sep)) return; // never delete outside the media folder!!!
  await fs.rm(absPath, { force: true });
}

//"status_icons/abc.png" -> "/media/status_icons/abc.png"
export const mediaUrl = (relPath) => `${MEDIA_URL}${relPath}`;
