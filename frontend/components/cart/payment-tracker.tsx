"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { backendRequest } from "@/lib/backend-api";
import { formatPrice, type Locale } from "@/lib/catalog";

type Labels = Record<string, string>;

export type PaymentStatus = {
  orderId: string;
  reference: string;
  status: string;
  paymentMethod: "MOBILE_MONEY" | "CARD" | "CASH_ON_DELIVERY";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  totalFcfa: number;
  chargedAmountFcfa: number;
};

export type PaymentSession = { ussdCode?: string | null; operator?: string | null; redirectUrl?: string | null; error?: string | null };

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Suivi du paiement CamPay d'une commande : interroge le backend tant que le
 * paiement en ligne est en attente, gère le retour de la page carte CamPay
 * (?reference=...) et permet de relancer un paiement échoué.
 */
export function PaymentTracker({ orderId, locale, labels, session, returnReference }: { orderId: string; locale: Locale; labels: Labels; session?: PaymentSession; returnReference?: string | null }) {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [current, setCurrent] = useState<PaymentSession | undefined>(session);
  const [error, setError] = useState(session?.error ?? "");
  const [phone, setPhone] = useState("");
  const [retrying, setRetrying] = useState(false);
  const startedAt = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setStatus(await backendRequest<PaymentStatus>(`/payments/${orderId}/status`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : labels.trackMissing);
    }
  }, [orderId, labels.trackMissing]);

  useEffect(() => {
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => {
      if (!returnReference) return void refresh();
      // Retour de la page carte CamPay : la référence est re-vérifiée côté serveur.
      backendRequest<PaymentStatus>(`/payments/${orderId}/confirm`, { method: "POST", body: JSON.stringify({ reference: returnReference }) }).then(setStatus).catch(() => refresh());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [orderId, returnReference, refresh]);

  const online = status && status.paymentMethod !== "CASH_ON_DELIVERY";
  const pending = online && status.paymentStatus === "PENDING";

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) return window.clearInterval(timer);
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pending, refresh]);

  const retry = async (paymentMethod?: "MOBILE_MONEY" | "CARD") => {
    setRetrying(true);
    setError("");
    try {
      const result = await backendRequest<PaymentStatus & { payment: PaymentSession }>(`/payments/${orderId}/retry`, {
        method: "POST",
        body: JSON.stringify({ ...(phone.trim() ? { phone: phone.trim() } : {}), ...(paymentMethod ? { paymentMethod } : {}) }),
      });
      if (result.payment.redirectUrl) {
        window.location.assign(result.payment.redirectUrl);
        return;
      }
      setCurrent(result.payment);
      setStatus(result);
      startedAt.current = Date.now();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : labels.paymentFailedText);
    } finally {
      setRetrying(false);
    }
  };

  if (!status) return <div className="payment-tracker"><p>{error || labels.checking}</p></div>;

  const capped = online && status.chargedAmountFcfa < status.totalFcfa;

  return (
    <div className={`payment-tracker payment-${status.paymentStatus.toLowerCase()}`} aria-live="polite">
      {status.paymentMethod === "CASH_ON_DELIVERY" ? (
        <p>{labels.codConfirmedText}</p>
      ) : status.paymentStatus === "PAID" ? (
        <><strong><Check aria-hidden="true" /> {labels.paymentPaid}</strong><p>{labels.paymentPaidText}</p></>
      ) : status.paymentStatus === "FAILED" || (status.paymentMethod === "CARD" && current?.error) ? (
        <>
          <strong><X aria-hidden="true" /> {labels.paymentFailed}</strong>
          <p>{labels.paymentFailedText}</p>
          {status.paymentMethod === "MOBILE_MONEY" && <input className="payment-tracker-phone" value={phone} placeholder={labels.mobileNumber} onChange={(event) => setPhone(event.target.value)} />}
          <button className="checkout-primary" disabled={retrying} onClick={() => retry()}>{labels.retryPayment}</button>
        </>
      ) : (
        <>
          <strong><Clock aria-hidden="true" /> {labels.paymentPending}</strong>
          {status.paymentMethod === "MOBILE_MONEY" ? (
            <>
              <p>{labels.paymentPendingText}</p>
              {current?.ussdCode && <p>{labels.ussdHint} <b>{current.ussdCode}</b>{current.operator ? ` (${current.operator})` : ""}</p>}
            </>
          ) : (
            current?.redirectUrl && <a className="checkout-primary" href={current.redirectUrl}>{labels.payByCard}</a>
          )}
          {current?.error && <button className="checkout-secondary" disabled={retrying} onClick={() => retry()}>{labels.retryPayment}</button>}
        </>
      )}
      {capped && <small className="payment-tracker-note">{labels.demoNote} {formatPrice(status.chargedAmountFcfa, locale)} ({labels.amountCharged}).</small>}
      {error && <p className="checkout-field-error">{error}</p>}
    </div>
  );
}
