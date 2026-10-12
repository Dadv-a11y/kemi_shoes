import { backendRequest } from "@/lib/backend-api";
import { formatPrice, isCustomMaterial, type Locale } from "@/lib/catalog";

export type WhatsappLine = { productId: string; slug: string; name: string; size: string; color: string; material?: string; quantity: number; price: number };

const DEFAULT_NUMBER = "237678666069";

/** Texte du message : un bloc par produit (options, prix, lien vers sa fiche), puis le total. */
export function buildWhatsappMessage(lines: WhatsappLine[], locale: Locale, origin: string, reference?: string) {
  const fr = locale === "fr";
  const intro = fr
    ? `Bonjour KEMI SHOES, je souhaite commander${reference ? ` (réf. ${reference})` : ""} :`
    : `Hello KEMI SHOES, I would like to order${reference ? ` (ref. ${reference})` : ""}:`;
  const blocks = lines.map((line, index) => [
    `${index + 1}. ${line.name} × ${line.quantity}`,
    `   ${[`${fr ? "Taille" : "Size"} ${line.size}`, line.color, line.material && isCustomMaterial(line.material) ? line.material : "", formatPrice(line.price * line.quantity, locale)].filter(Boolean).join(" · ")}`,
    `   ${origin}/${locale}/produits/${line.slug}`,
  ].join("\n"));
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return [intro, "", ...blocks.flatMap((block) => [block, ""]), `${fr ? "Total" : "Total"} : ${formatPrice(total, locale)}`].join("\n");
}

/**
 * Commande par WhatsApp : enregistre la commande côté boutique (suivi et confirmation de livraison par l'équipe),
 * puis ouvre la conversation avec le message prêt à envoyer. Si l'enregistrement échoue, le message part quand même.
 * L'onglet est ouvert tout de suite pour ne pas être bloqué comme fenêtre surgissante.
 */
export async function orderOnWhatsapp(lines: WhatsappLine[], locale: Locale) {
  const tab = window.open("", "_blank");
  let reference: string | undefined;
  let number = DEFAULT_NUMBER;
  try {
    const settings = await backendRequest<{ whatsapp?: string }>("/settings");
    const digits = (settings.whatsapp ?? "").replace(/\D/g, "");
    if (digits) number = digits;
  } catch { /* numéro par défaut */ }
  try {
    const order = await backendRequest<{ reference: string }>("/orders/whatsapp", {
      method: "POST",
      body: JSON.stringify({ items: lines.map((line) => ({ productId: line.productId, size: line.size, quantity: line.quantity, ...(line.color ? { color: line.color } : {}), ...(line.material && isCustomMaterial(line.material) ? { customMaterial: line.material } : {}) })) }),
    });
    reference = order.reference;
  } catch { /* le message part sans référence */ }
  const url = `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsappMessage(lines, locale, window.location.origin, reference))}`;
  if (tab) tab.location.href = url;
  else window.location.assign(url);
}
