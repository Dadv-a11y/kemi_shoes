"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Review = { id: number; rating: number; date: string; text: string; author: string };

const reviews: Review[] = [
  { id: 1, rating: 5, date: "2026-05-18", text: "Cuir superbe, confort au top, livraison rapide sur Douala.", author: "Cliente vérifiée" },
  { id: 2, rating: 5, date: "2026-04-02", text: "Exactement comme sur la photo, et le service après-vente répond vite.", author: "Client vérifié" },
  { id: 3, rating: 4, date: "2026-02-14", text: "J'ai demandé une personnalisation en marron, le délai annoncé a été respecté.", author: "Client vérifié" },
  { id: 4, rating: 5, date: "2025-12-09", text: "Une très belle paire, solide et agréable à porter tous les jours.", author: "Cliente vérifiée" },
  { id: 5, rating: 3, date: "2025-10-27", text: "Belle finition. La taille demandait un petit temps d'adaptation.", author: "Cliente vérifiée" },
];

function Stars({ rating }: { rating: number }) {
  return <span className="review-stars" aria-label={`${rating} sur 5 étoiles`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} fill={index < rating ? "currentColor" : "none"} aria-hidden="true" />)}</span>;
}

function ReviewContent({ labels }: { labels: ReviewLabels }) {
  const [ratings, setRatings] = useState<number[]>([]);
  const [sort, setSort] = useState<"recent" | "oldest">("recent");
  const filteredReviews = useMemo(() => reviews.filter((review) => ratings.length === 0 || ratings.includes(review.rating)).sort((a, b) => sort === "recent" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)), [ratings, sort]);

  function toggleRating(rating: number) {
    setRatings((current) => current.includes(rating) ? current.filter((value) => value !== rating) : [...current, rating]);
  }

  return <div className="reviews-drawer-layout"><aside className="reviews-filters"><div className="reviews-filter-heading"><Filter aria-hidden="true" />{labels.filters}</div><div className="review-filter-group"><span>{labels.rating}</span>{[5, 4, 3, 2, 1].map((rating) => <label key={rating}><Checkbox checked={ratings.includes(rating)} onCheckedChange={() => toggleRating(rating)} /><Stars rating={rating} /><small>{reviews.filter((review) => review.rating === rating).length}</small></label>)}</div><div className="review-filter-group"><span>{labels.date}</span><RadioGroup value={sort} onValueChange={(value) => setSort(value as "recent" | "oldest")}><label><RadioGroupItem value="recent" />{labels.recent}</label><label><RadioGroupItem value="oldest" />{labels.oldest}</label></RadioGroup></div>{ratings.length > 0 && <Button variant="link" onClick={() => setRatings([])}>{labels.clear}<X data-icon="inline-end" /></Button>}</aside><div className="reviews-list">{filteredReviews.length === 0 ? <p className="reviews-empty">{labels.empty}</p> : filteredReviews.map((review) => <article className="full-review" key={review.id}><div className="full-review-top"><Stars rating={review.rating} /><time dateTime={review.date}><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat("fr-CM", { day: "numeric", month: "short", year: "numeric" }).format(new Date(review.date))}</time></div><p>« {review.text} »</p><strong>{review.author}</strong></article>)}</div></div>;
}

type ReviewLabels = { open: string; title: string; summary: string; rating: string; date: string; recent: string; oldest: string; filters: string; clear: string; empty: string; close: string };

export function ProductReviews({ labels }: { labels: ReviewLabels }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return <section className="product-reviews section"><div className="review-summary-header"><div><span className="eyebrow">{labels.summary}</span><div className="review-score-line"><strong>4.8</strong><Stars rating={5} /><small>32 avis vérifiés</small></div></div><Button variant="outline" onClick={() => setOpen(true)}>{labels.open}</Button></div><div className="review-preview-grid">{reviews.slice(0, 3).map((review) => <article className="review-preview-card" key={review.id}><Stars rating={review.rating} /><p>« {review.text} »</p><strong>{review.author}</strong></article>)}</div><Sheet open={open && !isMobile} onOpenChange={setOpen}><SheetContent side="right" className="reviews-sheet"><SheetHeader><SheetTitle>{labels.title}</SheetTitle></SheetHeader><ReviewContent labels={labels} /><SheetFooter><Button onClick={() => setOpen(false)}>{labels.close}</Button></SheetFooter></SheetContent></Sheet><Drawer open={open && isMobile} onOpenChange={setOpen}><DrawerContent className="reviews-drawer"><DrawerHeader><DrawerTitle>{labels.title}</DrawerTitle></DrawerHeader><ReviewContent labels={labels} /><DrawerFooter><Button onClick={() => setOpen(false)}>{labels.close}</Button></DrawerFooter></DrawerContent></Drawer></section>;
}
