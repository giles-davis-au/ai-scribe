import multer from 'multer';
import path from 'path';
import { ValidationError } from '../../shared/errors';

const ALLOWED_EXTENSIONS = new Set(['.m4a', '.mp3', '.wav', '.webm', '.mp4', '.ogg', '.aac']);

function isAudioFile(mimetype: string, originalname: string): boolean {
  if (mimetype.startsWith('audio/')) return true;
  const ext = path.extname(originalname).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export const uploadAudioMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB
  fileFilter: (_req, file, cb) => {
    if (isAudioFile(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file: ${file.originalname} (${file.mimetype}). Accepted formats: m4a, mp3, wav, webm, mp4, ogg, aac.`));
    }
  },
}).single('audio');
