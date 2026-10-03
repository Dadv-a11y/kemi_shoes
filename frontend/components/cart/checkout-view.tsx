"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCart, saveCart, type CartItem } from "@/lib/cart";
import { formatPrice, type Locale } from "@/lib/catalog";
import { backendRequest } from "@/lib/backend-api";
import { PaymentTracker, type PaymentSession } from "@/components/cart/payment-tracker";

type Labels = Record<string, string>;
type PaymentMethod = "mm" | "card" | "cod";
type PaymentErrors = Partial<Record<"mobileNumber", string>>;
type DeliveryDetails = { fullName: string; phone: string; email: string; country: string; city: string; neighborhood: string; address: string };
type DeliveryErrors = Partial<Record<keyof DeliveryDetails, string>>;
type DeliveryZone = { id: string; country: string; regionOrCity: string | null; feeFcfa: number; etaMinHours: number; etaMaxHours: number; codAvailable: boolean; paymentMethods: string[]; active: boolean };

function PaymentOption({ selected, onSelect, title, note, children }: { selected: boolean; onSelect: () => void; title: string; note?: string; children?: React.ReactNode }) {
  return <button type="button" className={`checkout-payment-option ${selected ? "selected" : ""}`} onClick={onSelect}><span className="checkout-payment-head"><span className="checkout-radio" />{title}</span>{note && <span className="checkout-payment-note">{note}</span>}{selected && children && <span className="checkout-payment-fields" onClick={(event) => event.stopPropagation()}>{children}</span>}</button>;
}

function CheckoutField({ id, label, value, placeholder, error, onChange }: { id: string; label: string; value: string; placeholder: string; error?: string; onChange: (value: string) => void }) {
  return <div className="checkout-field"><label htmlFor={id}>{label}</label><input id={id} value={value} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />{error && <span id={`${id}-error`} className="checkout-field-error">{error}</span>}</div>;
}

function SummaryBlock({ title, edit, onEdit, children }: { title: string; edit?: string; onEdit?: () => void; children: React.ReactNode }) {
  return <div className="checkout-summary-block"><div><span>{title}</span>{edit && onEdit && <button onClick={onEdit}>{edit}</button>}</div><p>{children}</p></div>;
}

function OrderSummary({ locale, labels, items, subtotal, shipping, total, hidden }: { locale: Locale; labels: Labels; items: CartItem[]; subtotal: number; shipping: number; total: number; hidden: boolean }) {
  if (hidden) return null;
  return <aside className="checkout-order-summary"><h2>{labels.yourOrder}</h2>{items.map((item) => <div className="checkout-summary-item" key={item.id}><Image src={item.image} alt={item.name} width={44} height={44} /><div><strong>{item.name}</strong><span>{labels.size} {item.size} · {item.color}</span></div><b>{formatPrice(item.price * item.quantity, locale)}</b></div>)}<div className="checkout-total-lines"><div><span>{labels.subtotal}</span><span>{formatPrice(subtotal, locale)}</span></div><div><span>{labels.shipping}</span><span>{formatPrice(shipping, locale)}</span></div><div><strong>{labels.total}</strong><strong>{formatPrice(total, locale)}</strong></div></div></aside>;
}


export function CheckoutView({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [step, setStep] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>("mm");
  const [accepted, setAccepted] = useState(false);
  const [items] = useState<CartItem[]>(() => getCart());
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({ fullName: "", phone: "", email: "", country: "Cameroun", city: "", neighborhood: "", address: "" });
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [mobileNumber, setMobileNumber] = useState("");
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [placedOrder, setPlacedOrder] = useState<{ id: string; reference: string; payment?: PaymentSession } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  useEffect(() => { backendRequest<DeliveryZone[]>("/delivery-zones?activeOnly=true").then((result) => { setZones(result); setZoneId(result[0]?.id ?? ""); }).catch(() => setZones([])); }, []);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const shipping = selectedZone?.feeFcfa ?? 0;
  const total = subtotal + shipping;
  const paymentLabel = payment === "mm" ? labels.mobileMoney : payment === "card" ? labels.card : labels.cod;
  const goTo = (nextStep: number) => setStep(Math.min(4, Math.max(1, nextStep)));
  const updateDelivery = (field: keyof DeliveryDetails, value: string) => {
    setDeliveryDetails((current) => ({ ...current, [field]: value }));
    setDeliveryErrors((current) => {
      const remaining = { ...current };
      delete remaining[field];
      return remaining;
    });
  };
  const validateDelivery = () => {
    const required: Array<keyof DeliveryDetails> = ["fullName", "phone", "city", "neighborhood", "address"];
    const errors = required.reduce<DeliveryErrors>((result, field) => {
      if (!deliveryDetails[field].trim()) result[field] = labels.required;
      return result;
    }, {});
    if (deliveryDetails.email && !/^\S+@\S+\.\S+$/.test(deliveryDetails.email)) errors.email = labels.invalidEmail;
    setDeliveryErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const validatePayment = () => {
    const errors: PaymentErrors = {};
    if (payment === "mm" && !mobileNumber.trim()) errors.mobileNumber = labels.required;
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const submitOrder = async () => {
    if (!accepted || !zoneId || submitting) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await backendRequest<{ order: { id: string; reference: string }; payment: PaymentSession }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.id.split(":")[0], quantity: item.quantity, size: item.size, color: item.color, customMaterial: item.material })),
          deliveryZoneId: zoneId,
          address: { country: deliveryDetails.country, city: deliveryDetails.city, district: deliveryDetails.neighborhood, street: deliveryDetails.address },
          guest: { name: deliveryDetails.fullName, phone: deliveryDetails.phone, email: deliveryDetails.email || undefined },
          paymentMethod: payment === "mm" ? "MOBILE_MONEY" : payment === "card" ? "CARD" : "CASH_ON_DELIVERY",
          ...(payment === "mm" ? { paymentPhone: mobileNumber } : {}),
        }),
      });
      saveCart([]);
      // Carte : paiement sur la page hébergée CamPay, retour sur /commande/suivi.
      if (result.payment.redirectUrl) {
        window.location.assign(result.payment.redirectUrl);
        return;
      }
      setPlacedOrder({ id: result.order.id, reference: result.order.reference, payment: result.payment });
      goTo(4);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Impossible de créer la commande."); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="checkout-page">
      <div className="checkout-stepper-wrap">
        <div className="checkout-stepper" aria-label="Progression de la commande">
          {[1, 2, 3].map((number, index) => <div className="checkout-step-group" key={number}><span className={`checkout-step-dot ${step === number ? "active" : ""} ${step > number ? "done" : ""}`}>{step > number ? <Check aria-hidden="true" /> : number}</span>{index < 2 && <span className={`checkout-step-line ${step > number ? "done" : ""}`} />}</div>)}
        </div>
        <div className="checkout-step-labels"><span>{labels.delivery}</span><span>{labels.payment}</span><span>{labels.confirmation}</span></div>
      </div>

      <div className="checkout-body"><div className="checkout-grid"><div className="checkout-main">
        {step === 1 && <section className="checkout-step-content"><div className="checkout-guest">{labels.guest}<Link href={`/${locale}/compte/connexion`}>{labels.login}</Link></div><h1>{labels.delivery}</h1><CheckoutField id="fullName" label={labels.fullName} value={deliveryDetails.fullName} placeholder={labels.fullNamePlaceholder} error={deliveryErrors.fullName} onChange={(value) => updateDelivery("fullName", value)} /><div className="checkout-field-row"><CheckoutField id="phone" label={labels.phone} value={deliveryDetails.phone} placeholder={labels.phonePlaceholder} error={deliveryErrors.phone} onChange={(value) => updateDelivery("phone", value)} /><CheckoutField id="email" label={labels.email} value={deliveryDetails.email} placeholder={labels.emailPlaceholder} error={deliveryErrors.email} onChange={(value) => updateDelivery("email", value)} /></div><div className="checkout-field"><label htmlFor="country">{labels.country}</label><select id="country" value={deliveryDetails.country} onChange={(event) => updateDelivery("country", event.target.value)}><option>Cameroun</option><option>Côte d&apos;Ivoire</option><option>France</option><option>Autre</option></select></div><div className="checkout-field-row"><CheckoutField id="city" label={labels.city} value={deliveryDetails.city} placeholder={labels.cityPlaceholder} error={deliveryErrors.city} onChange={(value) => updateDelivery("city", value)} /><CheckoutField id="neighborhood" label={labels.neighborhood} value={deliveryDetails.neighborhood} placeholder={labels.neighborhoodPlaceholder} error={deliveryErrors.neighborhood} onChange={(value) => updateDelivery("neighborhood", value)} /></div><CheckoutField id="address" label={labels.address} value={deliveryDetails.address} placeholder={labels.addressPlaceholder} error={deliveryErrors.address} onChange={(value) => updateDelivery("address", value)} /><div className="checkout-field"><label htmlFor="delivery-zone">Zone de livraison</label><select id="delivery-zone" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.regionOrCity || zone.country} - {formatPrice(zone.feeFcfa, locale)}</option>)}</select></div><div className="checkout-delivery-card"><strong>🚚 {labels.estimated}</strong><span>{zones.find((zone) => zone.id === zoneId) ? `${zones.find((zone) => zone.id === zoneId)?.etaMinHours}–${zones.find((zone) => zone.id === zoneId)?.etaMaxHours}h` : labels.estimatedDetail}</span></div><button className="checkout-primary" onClick={() => validateDelivery() && goTo(2)} disabled={!zones.length}>{labels.continuePayment}</button></section>}

        {step === 2 && <section className="checkout-step-content"><h1>{labels.payment}</h1><PaymentOption selected={payment === "mm"} onSelect={() => { setPayment("mm"); setPaymentErrors({}); }} title={labels.mobileMoney} note={labels.mobileMoneyNote}><CheckoutField id="mobileNumber" label={labels.mobileNumber} value={mobileNumber} placeholder={labels.phonePlaceholder} error={paymentErrors.mobileNumber} onChange={(value) => { setMobileNumber(value); setPaymentErrors((current) => { const remaining = { ...current }; delete remaining.mobileNumber; return remaining; }); }} /></PaymentOption><PaymentOption selected={payment === "card"} onSelect={() => { setPayment("card"); setPaymentErrors({}); }} title={labels.card} note={labels.cardRedirectNote} /><PaymentOption selected={payment === "cod"} onSelect={() => { setPayment("cod"); setPaymentErrors({}); }} title={labels.cod} note={labels.codNote} /><button className="checkout-primary checkout-button-spaced" onClick={() => validatePayment() && goTo(3)}>{labels.continueSummary}</button><button className="checkout-link-button" onClick={() => goTo(1)}>← {labels.editDelivery}</button></section>}

        {step === 3 && <section className="checkout-step-content"><h1>{labels.summary}</h1><SummaryBlock title={labels.deliveryAddress} onEdit={() => goTo(1)} edit={labels.edit}>{deliveryDetails.fullName} — {deliveryDetails.neighborhood}, {deliveryDetails.city}, {deliveryDetails.country}</SummaryBlock><SummaryBlock title={labels.paymentMethod} onEdit={() => goTo(2)} edit={labels.edit}>{paymentLabel}</SummaryBlock><SummaryBlock title={`${labels.items} (${items.reduce((sum, item) => sum + item.quantity, 0)})`}>{items.length ? items.map((item) => `${item.name} × ${item.quantity}`).join(", ") : "-"}</SummaryBlock><label className="checkout-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{labels.accept}</label>{submitError && <p className="checkout-field-error">{submitError}</p>}<button className="checkout-primary" disabled={!accepted || submitting} onClick={submitOrder}>{labels.confirm}</button></section>}

        {step === 4 && <section className="checkout-confirmation"><div className="checkout-confirm-icon"><Check aria-hidden="true" /></div><h1>{labels.thanks}</h1><p>{labels.confirmationSent}</p><strong>{labels.order} {placedOrder?.reference}</strong>{placedOrder && <PaymentTracker orderId={placedOrder.id} locale={locale} labels={labels} session={placedOrder.payment} />}<div className="checkout-confirm-summary"><div><span>{labels.estimated}</span><span>{selectedZone ? `${selectedZone.etaMinHours}–${selectedZone.etaMaxHours}h` : "24–48h"}</span></div><div><span>{labels.paymentMethod}</span><span>{paymentLabel}</span></div><div><strong>{labels.paidTotal}</strong><strong>{formatPrice(total, locale)}</strong></div></div><Link className="checkout-secondary" href={`/${locale}/commande/suivi?order=${placedOrder?.id ?? ""}`}>💬 {labels.follow}</Link><div className="checkout-account-prompt"><strong>{labels.createAccount}</strong><p>{labels.createAccountText}</p><Link className="checkout-primary" href={`/${locale}/compte/connexion`}>{labels.create}</Link></div><Link className="checkout-link-button" href={`/${locale}/boutique`}>{labels.continueShopping}</Link></section>}
      </div><OrderSummary locale={locale} labels={labels} items={items} subtotal={subtotal} shipping={shipping} total={total} hidden={step === 4} /></div></div>
    </main>
  );
}

