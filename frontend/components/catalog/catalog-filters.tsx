"use client";

import { useEffect, useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

const colors = [
  { label: "Noir", value: "#14120F" },
  { label: "Cognac", value: "#92502f" },
  { label: "Terracotta", value: "#D2531E" },
  { label: "Naturel", value: "#eee5d5" },
];

const sizes = ["38", "39", "40", "41", "42", "43"];

export function CatalogFilters({ labels }: { labels: { trigger: string; title: string; sort: string; newest: string; priceAsc: string; priceDesc: string; popular: string; gender: string; men: string; women: string; child: string; size: string; color: string; price: string; reset: string; results: string; activeFilter: string } }) {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState("priceAsc");
  const [gender, setGender] = useState<string[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [price, setPrice] = useState<number[]>([6000, 12000]);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.01 }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const activeFilters = [
    ...gender.map((value) => ({ label: value, clear: () => setGender(gender.filter((item) => item !== value)) })),
    ...(size ? [{ label: size, clear: () => setSize(null) }] : []),
    ...(color ? [{ label: color, clear: () => setColor(null) }] : []),
  ];

  function reset() {
    setSort("priceAsc");
    setGender([]);
    setSize(null);
    setColor(null);
    setPrice([6000, 12000]);
  }

  function toggleGender(value: string) {
    setGender(gender.includes(value) ? gender.filter((item) => item !== value) : [...gender, value]);
  }

  return (
    <>
      <div className="catalog-filter-desktop">
        <Button variant="outline" size="lg" onClick={() => setOpen(true)}><SlidersHorizontal data-icon="inline-start" />{labels.trigger}{activeFilters.length > 0 && <Badge variant="default">{activeFilters.length}</Badge>}</Button>
      </div>
      <div className="catalog-active-filters" aria-label={labels.activeFilter}>
        {activeFilters.map((filter) => <Button key={filter.label} variant="outline" size="sm" onClick={filter.clear}>{filter.label}<X data-icon="inline-end" /></Button>)}
      </div>
      <div className={`catalog-filter-mobile${footerVisible ? " catalog-filter-mobile-hidden" : ""}`}><div className="mobile-active-filters">{activeFilters.map((filter) => <Badge key={filter.label} variant="outline">{filter.label}<button type="button" onClick={filter.clear} aria-label={`${labels.activeFilter}: ${filter.label}`}><X aria-hidden="true" /></button></Badge>)}</div><Button variant="outline" size="lg" onClick={() => setOpen(true)}><SlidersHorizontal data-icon="inline-start" />{labels.trigger}{activeFilters.length > 0 && <Badge variant="default">{activeFilters.length}</Badge>}</Button></div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="catalog-filter-sheet">
          <SheetHeader><SheetTitle>{labels.title}</SheetTitle></SheetHeader>
          <div className="filter-sheet-body">
            <fieldset className="filter-group"><legend>{labels.sort}</legend><RadioGroup value={sort} onValueChange={(value) => setSort(value)}>{[["newest", labels.newest], ["priceAsc", labels.priceAsc], ["priceDesc", labels.priceDesc], ["popular", labels.popular]].map(([value, label]) => <label className="filter-radio" key={value}><RadioGroupItem value={value} /><span>{label}</span></label>)}</RadioGroup></fieldset>
            <fieldset className="filter-group"><legend>{labels.gender}</legend>{[["Homme", labels.men], ["Femme", labels.women], ["Enfant", labels.child]].map(([value, label]) => <label className="filter-check" key={value}><Checkbox checked={gender.includes(value)} onCheckedChange={() => toggleGender(value)} /><span>{label}</span></label>)}</fieldset>
            <fieldset className="filter-group"><legend>{labels.size}</legend><div className="filter-size-grid">{sizes.map((value) => <Button key={value} type="button" variant={size === value ? "default" : "outline"} size="sm" onClick={() => setSize(size === value ? null : value)}>{value}</Button>)}</div></fieldset>
            <fieldset className="filter-group"><legend>{labels.color}</legend><div className="filter-color-grid">{colors.map((item) => <Button key={item.label} type="button" variant="outline" size="icon-lg" className={color === item.label ? "filter-color-selected" : ""} onClick={() => setColor(color === item.label ? null : item.label)} aria-label={item.label}><span style={{ backgroundColor: item.value }} />{color === item.label && <Check aria-hidden="true" />}</Button>)}</div></fieldset>
            <fieldset className="filter-group"><legend>{labels.price}</legend><Slider value={price} min={6000} max={12000} step={500} onValueChange={(value) => setPrice(Array.isArray(value) ? value : [value])} /><div className="filter-price-values"><span>{price[0].toLocaleString("fr-CM")} F</span><span>{price[1].toLocaleString("fr-CM")} F</span></div></fieldset>
          </div>
          <SheetFooter><Button variant="link" onClick={reset}>{labels.reset}</Button><Button onClick={() => setOpen(false)}>{labels.results}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
