"use client";

import { useEffect, useState } from "react";
import { Check, MessageCircle, X } from "lucide-react";
import { backendRequest } from "@/lib/backend-api";

export type WhatsappOrder = { uuid: string; reference: string; client: string; createdAt: string; products: string };

/** Délai après lequel une commande WhatsApp non clôturée déclenche la question « livrée ? ». */
export const CONFIRMATION_DELAY_MS = 24 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_KEY = "kemi-delivery-snooze";
const MAX_VISIBLE = 3;

function readSnoozes(): Record<string, number> {
  try { return JSON.parse(window.localStorage.getItem(SNOOZE_KEY) ?? "{}") as Record<string, number>; } catch { return {}; }
}

/**
 * Toasts de l'administration : pour chaque commande passée via WhatsApp restée ouverte plus de 24 h, demande
 * à l'équipe de confirmer que les produits ont bien été livrés (ou d'annuler, ou de repousser la question).
 */
export function DeliveryConfirmationToasts({ orders, onClosed }: { orders: WhatsappOrder[]; onClosed: (uuid: string, status: "DELIVERED" | "CANCELLED") => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSnoozes(readSnoozes()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 10 * 60 * 1000);
    return () => { window.clearTimeout(timer); window.clearInterval(tick); };
  }, []);

  const due = orders.filter((order) => now - Date.parse(order.createdAt) >= CONFIRMATION_DELAY_MS && (snoozes[order.uuid] ?? 0) < now);
  if (due.length === 0) return null;

  const snooze = (uuid: string) => {
    const next = { ...snoozes, [uuid]: now + SNOOZE_MS };
    setSnoozes(next);
    try { window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(next)); } catch { /* repoussé pour cette session seulement */ }
  };

  const close = async (order: WhatsappOrder, status: "DELIVERED" | "CANCELLED") => {
    setBusy(order.uuid);
    setError("");
    try {
      if (status === "DELIVERED") await backendRequest(`/orders/${order.uuid}/confirm-delivery`, { method: "POST", body: JSON.stringify({}) });
      else await backendRequest(`/orders/${order.uuid}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED", note: "Commande WhatsApp non aboutie" }) });
      onClosed(order.uuid, status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3 max-lg:bottom-20" role="region" aria-label="Commandes WhatsApp à confirmer">
      {due.slice(0, MAX_VISIBLE).map((order) => (
        <div key={order.uuid} className="rounded-[10px] border border-[#E4DDD5] border-l-4 border-l-[#1f7a4d] bg-white p-4 shadow-[0_12px_32px_rgba(20,18,15,.2)]" role="alert">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#1f7a4d]"><MessageCircle className="size-4" aria-hidden="true" /> Commande WhatsApp · {order.reference}</div>
            <button type="button" aria-label="Me le rappeler demain" onClick={() => snooze(order.uuid)} className="text-[#8a8378] hover:text-[#14120F]"><X className="size-4" aria-hidden="true" /></button>
          </div>
          <p className="mt-2 text-[13px] font-semibold">Les produits ont-ils bien été livrés ?</p>
          <p className="mt-1 text-[12px] leading-snug text-[#8a8378]">{order.client} · {order.products}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy === order.uuid} onClick={() => void close(order, "DELIVERED")} className="flex items-center gap-1.5 rounded-[6px] bg-[#1f7a4d] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"><Check className="size-3.5" aria-hidden="true" /> Oui, livrée</button>
            <button type="button" disabled={busy === order.uuid} onClick={() => snooze(order.uuid)} className="rounded-[6px] border border-[#E4DDD5] px-3 py-2 text-[12px] font-semibold disabled:opacity-50">Pas encore</button>
            <button type="button" disabled={busy === order.uuid} onClick={() => void close(order, "CANCELLED")} className="rounded-[6px] border border-[#E4DDD5] px-3 py-2 text-[12px] font-semibold text-[#a13b2f] disabled:opacity-50">Annulée</button>
          </div>
        </div>
      ))}
      {due.length > MAX_VISIBLE && <p className="rounded-[8px] bg-[#14120F] px-3 py-2 text-center text-[11.5px] font-semibold text-white">+ {due.length - MAX_VISIBLE} autre(s) commande(s) WhatsApp à confirmer</p>}
      {error && <p className="rounded-[8px] bg-[#fbeee9] px-3 py-2 text-[12px] text-[#a13b2f]" role="status">{error}</p>}
    </div>
  );
}
