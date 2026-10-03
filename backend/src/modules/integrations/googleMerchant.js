import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getAuthedFetcher, googleIntegrationsEnabled } from './googleAuth.js';

const CONTENT_API_SCOPE = 'https://www.googleapis.com/auth/content';
const CONTENT_API_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';

/**
 * Traduit un produit KEMI SHOES (+ ses images/couleurs/tailles) vers le format
 * attendu par la Content API for Shopping (Google Merchant Center) — pure
 * fonction, sans I/O, donc testable sans réseau.
 *
 * Simplification assumée : une "offer" par produit, avec tailles/couleurs
 * listées en attributs plutôt qu'en variantes distinctes (itemGroupId).
 * Un vrai catalogue à variantes multiples (une offre Merchant par taille)
 * serait l'évolution naturelle si le volume le justifie.
 */
export function mapProductToMerchantOffer(product, { images = [], colors = [], sizes = [] } = {}) {
  const mainImage = images.find((i) => i.isMain) ?? images[0];
  const availableSizes = sizes.filter((s) => s.available).map((s) => s.size);

  const availability =
    product.status === 'active' && availableSizes.length > 0
      ? 'in stock'
      : product.status === 'out_of_stock' || availableSizes.length === 0
        ? 'out of stock'
        : 'preorder';

  return {
    offerId: product.id,
    title: product.nameFr,
    description: product.descriptionFr,
    link: `${env.STORE_BASE_URL}/produits/${product.slugFr}`,
    imageLink: mainImage?.url,
    additionalImageLinks: images.filter((i) => i !== mainImage).map((i) => i.url),
    contentLanguage: 'fr',
    targetCountry: 'CM',
    channel: 'online',
    availability,
    price: { value: String(product.price), currency: 'XAF' },
    condition: 'new',
    brand: 'KEMI SHOES',
    productTypes: [product.category],
    color: colors.map((c) => c.name).join(', ') || undefined,
    sizes: availableSizes.length ? availableSizes : undefined,
    customLabel0: product.colorCustomizable || product.materialCustomizable ? 'personnalisable' : undefined,
  };
}

/**
 * Crée un client Merchant Center. `fetcher` est injectable pour les tests
 * (mock) ; en usage réel, on passe par l'auth Google (compte de service).
 */
export function createMerchantClient({ fetcher, merchantId = env.GOOGLE_MERCHANT_ID } = {}) {
  return {
    async syncProduct(product, relations) {
      if (!merchantId) {
        logger.warn('GOOGLE_MERCHANT_ID non configuré — synchronisation Merchant Center ignorée.');
        return { skipped: true };
      }
      const httpFetch = fetcher ?? (await getAuthedFetcher(CONTENT_API_SCOPE));
      if (!httpFetch) return { skipped: true };

      const offer = mapProductToMerchantOffer(product, relations);
      const res = await httpFetch(`${CONTENT_API_BASE}/${merchantId}/products`, {
        method: 'POST', // "insert" = upsert côté Content API (même offerId => mise à jour)
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offer),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error({ status: res.status, body }, 'merchant_sync_failed');
        return { skipped: false, ok: false, status: res.status };
      }
      return { skipped: false, ok: true };
    },

    async deleteProduct(productId) {
      if (!merchantId) return { skipped: true };
      const httpFetch = fetcher ?? (await getAuthedFetcher(CONTENT_API_SCOPE));
      if (!httpFetch) return { skipped: true };

      const res = await httpFetch(
        `${CONTENT_API_BASE}/${merchantId}/products/online:fr:CM:${productId}`,
        { method: 'DELETE' }
      );
      return { skipped: false, ok: res.ok || res.status === 404 };
    },
  };
}

export const merchantClient = createMerchantClient();
export const merchantIntegrationEnabled = googleIntegrationsEnabled;