"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import type { CatalogFacets } from "@/lib/catalog-api";

type Labels = { trigger: string; title: string; sort: string; newest: string; priceAsc: string; priceDesc: string; popular: string; size: string; color: string; price: string; reset: string; results: string; activeFilter: string };
export type ShopFilters = { sort: "popular" | "newest" | "priceAsc" | "priceDesc"; size?: string; color?: string; minPrice?: number; maxPrice?: number };

const DEFAULT_SORT = "popular";

/** Paramètres d'URL de la boutique (lus côté serveur par les pages /boutique). */
export function filtersToSearch(filters: ShopFilters) {
  const params = new URLSearchParams();
  if (filters.sort !== DEFAULT_SORT) params.set("tri", filters.sort);
  if (filters.size) params.set("taille", filters.size);
  if (filters.color) params.set("couleur", filters.color);
  if (filters.minPrice !== undefined) params.set("prix_min", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("prix_max", String(filters.maxPrice));
  return params;
}

const formatPrice = (value: number) => `${value.toLocaleString("fr-CM")} F`;

/**
 * Filtres de la boutique, pilotés par l'URL : chaque choix recharge la page serveur, qui interroge
 * l'API (tri, taille, couleur, prix). Les valeurs proposées viennent de l'API (facettes), pas d'une liste figée.
 */
export function CatalogFilters({ labels, facets, basePath, current }: { labels: Labels; facets: CatalogFacets; basePath: string; current: ShopFilters }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const rangeMin = facets.minPrice ?? 0;
  const rangeMax = facets.maxPrice ?? 0;
  const hasRange = rangeMax > rangeMin;
  const [draft, setDraft] = useState<ShopFilters>(current);
  const [price, setPrice] = useState<number[]>([current.minPrice ?? rangeMin, current.maxPrice ?? rangeMax]);

  // Le brouillon repart de l'URL à chaque ouverture (retour arrière, lien partagé…).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { setDraft(current); setPrice([current.minPrice ?? rangeMin, current.maxPrice ?? rangeMax]); }, 0);
    return () => window.clearTimeout(timer);
  }, [open, current, rangeMin, rangeMax]);

  useEffect(() => {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const go = (filters: ShopFilters) => {
    const search = filtersToSearch(filters).toString();
    router.push(`${basePath}${search ? `?${search}` : ""}#shop-results`, { scroll: false });
  };

  const apply = () => {
    const full = price[0] <= rangeMin && price[1] >= rangeMax;
    go({ ...draft, minPrice: !hasRange || full ? undefined : price[0], maxPrice: !hasRange || full ? undefined : price[1] });
    setOpen(false);
  };

  const sortLabels: Record<ShopFilters["sort"], string> = { popular: labels.popular, newest: labels.newest, priceAsc: labels.priceAsc, priceDesc: labels.priceDesc };
  const activeFilters = [
    ...(current.sort !== DEFAULT_SORT ? [{ key: "sort", label: sortLabels[current.sort], clear: () => go({ ...current, sort: DEFAULT_SORT }) }] : []),
    ...(current.size ? [{ key: "size", label: `${labels.size} ${current.size}`, clear: () => go({ ...current, size: undefined }) }] : []),
    ...(current.color ? [{ key: "color", label: current.color, clear: () => go({ ...current, color: undefined }) }] : []),
    ...(current.minPrice !== undefined || current.maxPrice !== undefined ? [{ key: "price", label: `${formatPrice(current.minPrice ?? rangeMin)} – ${formatPrice(current.maxPrice ?? rangeMax)}`, clear: () => go({ ...current, minPrice: undefined, maxPrice: undefined }) }] : []),
  ];
  const trigger = <><SlidersHorizontal data-icon="inline-start" />{labels.trigger}{activeFilters.length > 0 && <Badge variant="default">{activeFilters.length}</Badge>}</>;

  return (
    <>
      <div className="catalog-filter-desktop"><Button variant="outline" size="lg" onClick={() => setOpen(true)}>{trigger}</Button></div>
      <div className="catalog-active-filters" aria-label={labels.activeFilter}>
        {activeFilters.map((filter) => <Button key={filter.key} variant="outline" size="sm" onClick={filter.clear}>{filter.label}<X data-icon="inline-end" /></Button>)}
      </div>
      <div className={`catalog-filter-mobile${footerVisible ? " catalog-filter-mobile-hidden" : ""}`}>
        <div className="mobile-active-filters">{activeFilters.map((filter) => <Badge key={filter.key} variant="outline">{filter.label}<button type="button" onClick={filter.clear} aria-label={`${labels.activeFilter}: ${filter.label}`}><X aria-hidden="true" /></button></Badge>)}</div>
        <Button variant="outline" size="lg" onClick={() => setOpen(true)}>{trigger}</Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="catalog-filter-sheet">
          <SheetHeader><SheetTitle>{labels.title}</SheetTitle></SheetHeader>
          <div className="filter-sheet-body">
            <fieldset className="filter-group"><legend>{labels.sort}</legend><RadioGroup value={draft.sort} onValueChange={(value) => setDraft({ ...draft, sort: value as ShopFilters["sort"] })}>{(Object.keys(sortLabels) as ShopFilters["sort"][]).map((value) => <label className="filter-radio" key={value}><RadioGroupItem value={value} /><span>{sortLabels[value]}</span></label>)}</RadioGroup></fieldset>
            {facets.sizes.length > 0 && <fieldset className="filter-group"><legend>{labels.size}</legend><div className="filter-size-grid">{facets.sizes.map((value) => <Button key={value} type="button" variant={draft.size === value ? "default" : "outline"} size="sm" onClick={() => setDraft({ ...draft, size: draft.size === value ? undefined : value })}>{value}</Button>)}</div></fieldset>}
            {facets.colors.length > 0 && <fieldset className="filter-group"><legend>{labels.color}</legend><div className="filter-color-grid">{facets.colors.map((item) => <Button key={item.name} type="button" variant="outline" size="icon-lg" className={draft.color?.toLowerCase() === item.name.toLowerCase() ? "filter-color-selected" : ""} onClick={() => setDraft({ ...draft, color: draft.color?.toLowerCase() === item.name.toLowerCase() ? undefined : item.name })} aria-label={item.name} title={item.name}><span style={{ backgroundColor: item.hex }} />{draft.color?.toLowerCase() === item.name.toLowerCase() && <Check aria-hidden="true" />}</Button>)}</div></fieldset>}
            {hasRange && <fieldset className="filter-group"><legend>{labels.price}</legend><Slider value={price} min={rangeMin} max={rangeMax} step={500} onValueChange={(value) => setPrice(Array.isArray(value) ? value : [value])} /><div className="filter-price-values"><span>{formatPrice(price[0])}</span><span>{formatPrice(price[1])}</span></div></fieldset>}
          </div>
          <SheetFooter><Button variant="link" onClick={() => { setOpen(false); go({ sort: DEFAULT_SORT }); }}>{labels.reset}</Button><Button onClick={apply}>{labels.results}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
