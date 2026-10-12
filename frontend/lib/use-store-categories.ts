"use client";

import { useEffect, useState } from "react";
import { backendRequest } from "@/lib/backend-api";
import type { StoreCategory } from "@/lib/catalog-api";

// Une seule requête par chargement de page, partagée entre l'en-tête, le menu mobile et le pied de page.
let cache: StoreCategory[] | null = null;
let pending: Promise<StoreCategory[]> | null = null;

function loadCategories() {
  pending ??= backendRequest<{ items: StoreCategory[] }>("/categories")
    .then((result) => (cache = result.items))
    .catch(() => (cache = []))
    .finally(() => { pending = null; });
  return pending;
}

/** Catégories de la boutique : menus et pieds de page suivent ce que l'admin ajoute ou retire. */
export function useStoreCategories() {
  const [categories, setCategories] = useState<StoreCategory[]>(cache ?? []);
  useEffect(() => {
    let active = true;
    void loadCategories().then((items) => { if (active) setCategories(items); });
    return () => { active = false; };
  }, []);
  return categories;
}
