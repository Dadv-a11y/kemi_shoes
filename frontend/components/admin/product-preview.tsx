"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { CatalogApiProduct } from "@/lib/catalog-api";

type Mode = "card" | "pdp";
type Device = "mobile" | "desktop";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;
const FRAME_HEIGHT = 680;

/**
 * Aperçu du produit en cours d'édition : une vraie page de la boutique (/apercu-produit) dans une iframe,
 * alimentée par postMessage. Carte catalogue et fiche produit sont donc rendues par les composants du
 * site public, en largeur mobile ou ordinateur.
 */
export function ProductPreview({ product, locale = "fr" }: { product: CatalogApiProduct; locale?: "fr" | "en" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("card");
  const [device, setDevice] = useState<Device>("mobile");
  const [holderWidth, setHolderWidth] = useState(360);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === "kemi-product-preview-ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setHolderWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Le contenu est renvoyé à chaque modification (légèrement différé pour la saisie au clavier).
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => frame.current?.contentWindow?.postMessage({ type: "kemi-product-preview", mode, product }, window.location.origin), 120);
    return () => window.clearTimeout(timer);
  }, [ready, mode, product]);

  const width = device === "mobile" ? MOBILE_WIDTH : DESKTOP_WIDTH;
  const scale = Math.min(1, holderWidth / width);
  const button = (active: boolean) => `rounded-[6px] border px-[12px] py-[7px] text-[11.5px] font-semibold ${active ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("card")} className={button(mode === "card")}>Carte catalogue</button>
          <button type="button" onClick={() => setMode("pdp")} className={button(mode === "pdp")}>Fiche produit</button>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Largeur mobile" onClick={() => setDevice("mobile")} className={button(device === "mobile")}><Smartphone className="size-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Largeur ordinateur" onClick={() => setDevice("desktop")} className={button(device === "desktop")}><Monitor className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mb-3 text-[10.5px] italic text-[#8a8378]">Rendu réel de la boutique : ce que verra le client.</div>
      <div ref={holder} className="overflow-hidden rounded-[8px] border border-[#E4DDD5] bg-[#FCF7F8]" style={{ height: FRAME_HEIGHT * scale }}>
        <iframe
          ref={frame}
          title="Aperçu de la boutique"
          src={`/${locale}/apercu-produit`}
          style={{ width, height: FRAME_HEIGHT, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", marginLeft: device === "mobile" ? Math.max(0, (holderWidth - width * scale) / 2) : 0 }}
        />
      </div>
    </div>
  );
}
