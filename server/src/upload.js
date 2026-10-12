// multipart/form-data parsing. Replaces request.FILES.
// This holds files in memory (RAM) before allowing them to be written to disk!
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from './config.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

// parse the `icon` file + text fields
export function uploadIcon(req, res, next) {
  upload.single('icon')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`
          : `Invalid upload: ${err.message}`;
      return res.status(400).json({ errors: { icon: [message] } });
    }
    next(err);
  });
}
