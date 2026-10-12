"use client";

import { useEffect, useRef, useState } from "react";
import { backendRequest } from "@/lib/backend-api";
import { Button } from "@/components/ui/button";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  useToastManager,
} from "@/components/ui/toast";

export type WhatsappOrder = { uuid: string; reference: string; client: string; createdAt: string; products: string };

/** Délai après lequel une commande WhatsApp non clôturée déclenche la question « livrée ? ». */
export const CONFIRMATION_DELAY_MS = 24 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_KEY = "kemi-delivery-snooze";

const deliveryToasts = createToastManager();

type ToastData = { order: WhatsappOrder };

function readSnoozes(): Record<string, number> {
  try { return JSON.parse(window.localStorage.getItem(SNOOZE_KEY) ?? "{}") as Record<string, number>; } catch { return {}; }
}

function writeSnooze(uuid: string) {
  try { window.localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...readSnoozes(), [uuid]: Date.now() + SNOOZE_MS })); } catch { /* repoussé pour cette session seulement */ }
}

/** Liste des toasts : composants shadcn tels quels (aucun style modifié), plusieurs actions dans le corps du message. */
function DeliveryToastList({ onClosed }: { onClosed: (uuid: string, status: "DELIVERED" | "CANCELLED") => void }) {
  const manager = useToastManager<ToastData>();
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (toastId: string, order: WhatsappOrder, status: "DELIVERED" | "CANCELLED") => {
    setBusy(order.uuid);
    try {
      if (status === "DELIVERED") await backendRequest(`/orders/${order.uuid}/confirm-delivery`, { method: "POST", body: JSON.stringify({}) });
      else await backendRequest(`/orders/${order.uuid}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED", note: "Commande WhatsApp non aboutie" }) });
      resolved.current.add(order.uuid);
      manager.close(toastId);
      onClosed(order.uuid, status);
    } catch (error) {
      deliveryToasts.add({ type: "error", title: "Action impossible", description: error instanceof Error ? error.message : "Réessayez dans un instant.", timeout: 6000 });
    } finally {
      setBusy(null);
    }
  };

  return manager.toasts.map((toast) => (
    <Toast key={toast.id} toast={toast}>
      <ToastContent>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
          {toast.data?.order && (
            <div className="mt-2 flex flex-wrap gap-2">
              <ToastAction render={<Button size="sm" />} disabled={busy === toast.data.order.uuid} onClick={() => void resolve(toast.id, toast.data!.order, "DELIVERED")}>Oui, livrée</ToastAction>
              <ToastAction disabled={busy === toast.data.order.uuid} onClick={() => manager.close(toast.id)}>Pas encore</ToastAction>
              <ToastAction render={<Button variant="destructive" size="sm" />} disabled={busy === toast.data.order.uuid} onClick={() => void resolve(toast.id, toast.data!.order, "CANCELLED")}>Annulée</ToastAction>
            </div>
          )}
        </div>
        <ToastClose />
      </ToastContent>
    </Toast>
  ));
}

// Commandes dont la question a été traitée (livrée/annulée) : pas de report de 24 h à leur fermeture.
const resolved: { current: Set<string> } = { current: new Set() };

/**
 * Toasts de l'administration (composant toast de shadcn/ui) : pour chaque commande passée via WhatsApp restée
 * ouverte plus de 24 h, demande à l'équipe de confirmer que les produits ont bien été livrés. Fermer le toast
 * (croix ou « Pas encore ») repousse la question de 24 h.
 */
export function DeliveryConfirmationToasts({ orders, onClosed }: { orders: WhatsappOrder[]; onClosed: (uuid: string, status: "DELIVERED" | "CANCELLED") => void }) {
  const [now, setNow] = useState(() => Date.now());
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 10 * 60 * 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const snoozes = readSnoozes();
    for (const order of orders) {
      const due = now - Date.parse(order.createdAt) >= CONFIRMATION_DELAY_MS && (snoozes[order.uuid] ?? 0) < now;
      if (!due || shown.current.has(order.uuid)) continue;
      shown.current.add(order.uuid);
      deliveryToasts.add<ToastData>({
        id: order.uuid,
        type: "info",
        priority: "high",
        timeout: 0,
        title: `Commande WhatsApp ${order.reference} : livrée ?`,
        description: `${order.client} · ${order.products}. Les produits ont-ils bien été livrés ?`,
        data: { order },
        onClose: () => { if (!resolved.current.has(order.uuid)) writeSnooze(order.uuid); shown.current.delete(order.uuid); },
      });
    }
  }, [orders, now]);

  return (
    <ToastProvider toastManager={deliveryToasts} timeout={0}>
      <ToastPortal>
        <ToastViewport>
          <DeliveryToastList onClosed={onClosed} />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}
