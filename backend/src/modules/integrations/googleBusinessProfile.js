import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getAuthedFetcher, googleIntegrationsEnabled } from './googleAuth.js';

const BUSINESS_PROFILE_SCOPE = 'https://www.googleapis.com/auth/business.manage';
const BUSINESS_INFO_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

/**
 * Traduit les paramètres boutique (module Settings) vers le format attendu par
 * la Business Information API (Google Business Profile) pour la fiche
 * établissement pk11, Douala. Pure fonction, testable sans réseau.
 */
export function mapSettingsToBusinessProfile(settings) {
  return {
    title: settings.storeName,
    phoneNumbers: settings.phone ? { primaryPhone: settings.phone } : undefined,
    storefrontAddress: settings.address
      ? {
          addressLines: [settings.address.street ?? settings.address],
          locality: settings.address.city ?? 'Douala',
          regionCode: 'CM',
        }
      : undefined,
    websiteUri: settings.websiteUrl ?? env.STORE_BASE_URL,
  };
}

/**
 * Crée un client Business Profile. `fetcher` injectable pour les tests.
 */
export function createBusinessProfileClient({
  fetcher,
  accountId = env.GOOGLE_BUSINESS_ACCOUNT_ID,
  locationId = env.GOOGLE_BUSINESS_LOCATION_ID,
} = {}) {
  return {
    async syncLocation(settings) {
      if (!accountId || !locationId) {
        logger.warn('GOOGLE_BUSINESS_ACCOUNT_ID/LOCATION_ID non configurés — synchronisation Business Profile ignorée.');
        return { skipped: true };
      }
      const httpFetch = fetcher ?? (await getAuthedFetcher(BUSINESS_PROFILE_SCOPE));
      if (!httpFetch) return { skipped: true };

      const body = mapSettingsToBusinessProfile(settings);
      const updateMask = Object.keys(body).filter((k) => body[k] !== undefined).join(',');

      const res = await httpFetch(
        `${BUSINESS_INFO_API_BASE}/${locationId}?updateMask=${encodeURIComponent(updateMask)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        logger.error({ status: res.status, body: errBody }, 'business_profile_sync_failed');
        return { skipped: false, ok: false, status: res.status };
      }
      return { skipped: false, ok: true };
    },
  };
}

export const businessProfileClient = createBusinessProfileClient();
export const businessProfileIntegrationEnabled = googleIntegrationsEnabled;