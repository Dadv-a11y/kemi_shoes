import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { badRequest } from '../../middleware/errorHandler.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Nom de fichier généré côté serveur — jamais le nom original du client
  // (protection contre la traversée de chemin et l'écrasement de fichiers, OWASP
  // "Unrestricted File Upload").
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] ?? '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    return cb(badRequest('Format d’image non autorisé (jpeg, png ou webp uniquement).'));
  }
  cb(null, true);
}

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 Mo max — évite le déni de service par upload massif
}).single('image');

export { UPLOAD_DIR };