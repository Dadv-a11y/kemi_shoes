import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../config/logger.js';

const MAX_SIDE = 1600;
const QUALITY = 82;

// sharp est une dépendance native : optionnelle, pour ne jamais empêcher le démarrage
// de l'API sur un hébergement où elle ne s'installe pas (les images restent alors telles quelles).
let sharpPromise;
function loadSharp() {
  sharpPromise ??= import('sharp').then((m) => m.default).catch((error) => {
    logger.warn({ err: error.message }, 'sharp_unavailable_images_not_converted');
    return null;
  });
  return sharpPromise;
}

/**
 * Convertit une image (jpg/png/webp) en WebP redimensionné (1600 px max, EXIF appliqué puis
 * retiré). Renvoie le nom du fichier final ; l'original est supprimé. En cas d'échec ou si
 * sharp est absent, le fichier d'origine est conservé.
 */
export async function convertToWebp(filePath) {
  const sharp = await loadSharp();
  if (!sharp) return path.basename(filePath);
  const target = filePath.replace(/\.[^.]+$/, '') + '.webp';
  const temp = `${target}.tmp`;
  try {
    await sharp(filePath).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY }).toFile(temp);
    await fs.rename(temp, target);
    if (target !== filePath) await fs.unlink(filePath);
    return path.basename(target);
  } catch (error) {
    await fs.unlink(temp).catch(() => {});
    logger.warn({ err: error.message, file: path.basename(filePath) }, 'image_conversion_failed');
    return path.basename(filePath);
  }
}
