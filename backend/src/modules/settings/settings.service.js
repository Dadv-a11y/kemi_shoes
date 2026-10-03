import { all, run } from '../../db/client.js';

// Seules ces clés sont exposées / modifiables : la table Setting peut contenir
// d'autres réglages internes qui ne doivent jamais sortir publiquement.
export const PUBLIC_SETTING_KEYS = ['storeName', 'phone', 'whatsapp', 'email', 'address', 'instagram', 'facebook'];

const DEFAULTS = {
  storeName: 'KEMI SHOES',
  phone: '+237 678 66 60 69',
  whatsapp: '+237678666069',
  email: '',
  address: 'pk11, Douala, Cameroun',
  instagram: '',
  facebook: '',
};

export async function getPublicSettings() {
  const rows = await all(`SELECT key, value FROM Setting WHERE key IN (${PUBLIC_SETTING_KEYS.map(() => '?').join(',')})`, PUBLIC_SETTING_KEYS);
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

export async function updateSettings(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!PUBLIC_SETTING_KEYS.includes(key) || value === undefined) continue;
    await run(
      `INSERT INTO Setting (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      [key, String(value)]
    );
  }
  return getPublicSettings();
}
