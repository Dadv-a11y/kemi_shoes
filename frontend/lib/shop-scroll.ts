const FLAG = "kemi-scroll-results";

/** À appeler avant un changement d'onglet ou de filtre : la page suivante défilera jusqu'aux produits. */
export function markShopScroll() {
  try { window.sessionStorage.setItem(FLAG, "1"); } catch { /* stockage indisponible : pas de défilement automatique */ }
}

/** Vrai (une seule fois) si la navigation courante vient d'un onglet ou d'un filtre de la boutique. */
export function consumeShopScroll() {
  try {
    const marked = window.sessionStorage.getItem(FLAG) === "1";
    window.sessionStorage.removeItem(FLAG);
    return marked;
  } catch { return false; }
}
