import { randomUUID } from 'node:crypto';
import { get, all, run } from '../../db/client.js';
import { notFound } from '../../middleware/errorHandler.js';

export async function listPages() {
  return all(`SELECT * FROM ContentPage ORDER BY slug`);
}

export async function getPageBySlug(slug) {
  const page = await get(`SELECT * FROM ContentPage WHERE slug = ?`, [slug]);
  if (!page) throw notFound('Page introuvable.');
  return page;
}

/**
 * Crée la page si elle n'existe pas encore, sinon la met à jour — un seul
 * point d'entrée pour l'écran admin "Contenu & traductions".
 */
export async function upsertPage(slug, { titleFr, titleEn, bodyFr, bodyEn }) {
  const existing = await get(`SELECT id FROM ContentPage WHERE slug = ?`, [slug]);
  if (existing) {
    await run(
      `UPDATE ContentPage SET titleFr=?, titleEn=?, bodyFr=?, bodyEn=?, updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug = ?`,
      [titleFr, titleEn ?? null, bodyFr, bodyEn ?? null, slug]
    );
  } else {
    await run(
      `INSERT INTO ContentPage (id, slug, titleFr, titleEn, bodyFr, bodyEn) VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), slug, titleFr, titleEn ?? null, bodyFr, bodyEn ?? null]
    );
  }
  return getPageBySlug(slug);
}