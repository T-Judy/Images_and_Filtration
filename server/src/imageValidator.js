// Verifies that the extension, the declared Content-Type, and the file's real content all agree on an allowed image type.
// In otherwords is that .jpg really a .jpg?
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

// extension -> the one MIME type it must have
const EXTENSION_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_TO_MIME);
export const ALLOWED_MIME_TYPES = [...new Set(Object.values(EXTENSION_TO_MIME))];

/**
 * @param {{originalname: string, mimetype: string, buffer: Buffer}} file  a multer memory-storage file
 * @returns {Promise<string[]>} error messages; empty array means the file is valid
 */
export async function validateImageFile({ originalname, mimetype, buffer }) {
  // Does it claim to be valid?
  const ext = path.extname(originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return [`Unsupported extension: ${ext}. Use .jpg or .png`];
  }

  // Claims to be valid so lets see if the browser thinks it sent the right thing
  const declared = String(mimetype ?? '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(declared)) {
    return [`Unsupported content type: ${declared || 'none'}. Use image/jpeg or image/png`];
  }

  // Alright, lets read the first bytes (magic numbers)
  const detected = (await fileTypeFromBuffer(buffer.subarray(0, 4100)))?.mime;
  if (!ALLOWED_MIME_TYPES.includes(detected)) {
    return [`File content is not a valid image (got ${detected ?? 'unknown'})`];
  }

  // Now, do we all agree its the same file type? 
  // Yes this is needed as the previous statements could think its a .jpg and a .png at the same time
  if (detected !== EXTENSION_TO_MIME[ext]) {
    return [`File extension ${ext} does not match its content (${detected})`];
  }
  if (detected !== declared) {
    return [`Declared content type ${declared} does not match the file's content (${detected})`];
  }

  // Alright sharp can open that now
  try {
    await sharp(buffer).metadata();
  } catch {
    return ['Upload a valid image. The file you uploaded was either not an image or a corrupted image.'];
  }

  return [];
}
