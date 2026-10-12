/** « Couple / enfant » → « couple-enfant » (minuscules, sans accents, tirets). */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
