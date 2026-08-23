"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { getCart, type CartItem } from "@/lib/cart";
import { formatPrice, type Locale } from "@/lib/catalog";

type Labels = Record<string, string>;
type PaymentMethod = "mm" | "card" | "cod";
type DeliveryDetails = { fullName: string; phone: string; email: string; country: string; city: string; neighborhood: string; address: string };
type DeliveryErrors = Partial<Record<keyof DeliveryDetails, string>>;

export function CheckoutView({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [step, setStep] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>("mm");
  const [accepted, setAccepted] = useState(false);
  const [items] = useState<CartItem[]>(() => getCart());
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({ fullName: "", phone: "", email: "", country: "Cameroun", city: "", neighborhood: "", address: "" });
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [mobileNumber, setMobileNumber] = useState("");
  const [cardDetails, setCardDetails] = useState({ number: "", expiration: "", cvc: "" });
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const shipping = items.length ? 1500 : 0;
  const total = subtotal + shipping;
  const paymentLabel = payment === "mm" ? labels.mobileMoney : payment === "card" ? labels.card : labels.cod;
  const goTo = (nextStep: number) => setStep(Math.min(4, Math.max(1, nextStep)));
  const updateDelivery = (field: keyof DeliveryDetails, value: string) => {
    setDeliveryDetails((current) => ({ ...current, [field]: value }));
    setDeliveryErrors((current) => ({ ...current, [field]: undefined }));
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
    const errors: Record<string, string> = {};
    if (payment === "mm" && !mobileNumber.trim()) errors.mobileNumber = labels.required;
    if (payment === "card") {
      if (!cardDetails.number.trim()) errors.cardNumber = labels.required;
      if (!cardDetails.expiration.trim()) errors.expiration = labels.required;
      if (!cardDetails.cvc.trim()) errors.cvc = labels.required;
    }
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const updateCard = (field: keyof typeof cardDetails, value: string) => setCardDetails((current) => ({ ...current, [field]: value }));

  return (
    <main className="checkout-page">
      <div className="checkout-stepper-wrap">
        <div className="checkout-stepper" aria-label="Progression de la commande">
          {[1, 2, 3].map((number, index) => <div className="checkout-step-group" key={number}><span className={`checkout-step-dot ${step === number ? "active" : ""} ${step > number ? "done" : ""}`}>{step > number ? <Check aria-hidden="true" /> : number}</span>{index < 2 && <span className={`checkout-step-line ${step > number ? "done" : ""}`} />}</div>)}
        </div>
        <div className="checkout-step-labels"><span>{labels.delivery}</span><span>{labels.payment}</span><span>{labels.confirmation}</span></div>
      </div>

      <div className="checkout-body"><div className="checkout-grid"><div className="checkout-main">
        {step === 1 && <section className="checkout-step-content"><div className="checkout-guest">{labels.guest}<Link href={`/${locale}/compte/connexion`}>{labels.login}</Link></div><h1>{labels.delivery}</h1><CheckoutField id="fullName" label={labels.fullName} value={deliveryDetails.fullName} placeholder={labels.fullNamePlaceholder} error={deliveryErrors.fullName} onChange={(value) => updateDelivery("fullName", value)} /><div className="checkout-field-row"><CheckoutField id="phone" label={labels.phone} value={deliveryDetails.phone} placeholder={labels.phonePlaceholder} error={deliveryErrors.phone} onChange={(value) => updateDelivery("phone", value)} /><CheckoutField id="email" label={labels.email} value={deliveryDetails.email} placeholder={labels.emailPlaceholder} error={deliveryErrors.email} onChange={(value) => updateDelivery("email", value)} /></div><div className="checkout-field"><label htmlFor="country">{labels.country}</label><select id="country" value={deliveryDetails.country} onChange={(event) => updateDelivery("country", event.target.value)}><option>Cameroun</option><option>Côte d&apos;Ivoire</option><option>France</option><option>Autre</option></select></div><div className="checkout-field-row"><CheckoutField id="city" label={labels.city} value={deliveryDetails.city} placeholder={labels.cityPlaceholder} error={deliveryErrors.city} onChange={(value) => updateDelivery("city", value)} /><CheckoutField id="neighborhood" label={labels.neighborhood} value={deliveryDetails.neighborhood} placeholder={labels.neighborhoodPlaceholder} error={deliveryErrors.neighborhood} onChange={(value) => updateDelivery("neighborhood", value)} /></div><CheckoutField id="address" label={labels.address} value={deliveryDetails.address} placeholder={labels.addressPlaceholder} error={deliveryErrors.address} onChange={(value) => updateDelivery("address", value)} /><div className="checkout-delivery-card"><strong>🚚 {labels.estimated}</strong><span>{labels.estimatedDetail}</span></div><button className="checkout-primary" onClick={() => validateDelivery() && goTo(2)}>{labels.continuePayment}</button></section>}

        {step === 2 && <section className="checkout-step-content"><h1>{labels.payment}</h1><PaymentOption selected={payment === "mm"} onSelect={() => { setPayment("mm"); setPaymentErrors({}); }} title={labels.mobileMoney} note={labels.mobileMoneyNote}><CheckoutField id="mobileNumber" label={labels.mobileNumber} value={mobileNumber} placeholder={labels.phonePlaceholder} error={paymentErrors.mobileNumber} onChange={(value) => { setMobileNumber(value); setPaymentErrors((current) => ({ ...current, mobileNumber: undefined })); }} /></PaymentOption><PaymentOption selected={payment === "card"} onSelect={() => { setPayment("card"); setPaymentErrors({}); }} title={labels.card}><CheckoutField id="cardNumber" label={labels.cardNumber} value={cardDetails.number} placeholder="0000 0000 0000 0000" error={paymentErrors.cardNumber} onChange={(value) => { updateCard("number", value); setPaymentErrors((current) => ({ ...current, cardNumber: undefined })); }} /><div className="checkout-field-row"><CheckoutField id="expiration" label={labels.expiration} value={cardDetails.expiration} placeholder="MM/AA" error={paymentErrors.expiration} onChange={(value) => { updateCard("expiration", value); setPaymentErrors((current) => ({ ...current, expiration: undefined })); }} /><CheckoutField id="cvc" label={labels.cvc} value={cardDetails.cvc} placeholder="123" error={paymentErrors.cvc} onChange={(value) => { updateCard("cvc", value); setPaymentErrors((current) => ({ ...current, cvc: undefined })); }} /></div></PaymentOption><PaymentOption selected={payment === "cod"} onSelect={() => { setPayment("cod"); setPaymentErrors({}); }} title={labels.cod} note={labels.codNote} /><button className="checkout-primary checkout-button-spaced" onClick={() => validatePayment() && goTo(3)}>{labels.continueSummary}</button><button className="checkout-link-button" onClick={() => goTo(1)}>← {labels.editDelivery}</button></section>}

        {step === 3 && <section className="checkout-step-content"><h1>{labels.summary}</h1><SummaryBlock title={labels.deliveryAddress} onEdit={() => goTo(1)} edit={labels.edit}>{deliveryDetails.fullName} — {deliveryDetails.neighborhood}, {deliveryDetails.city}, {deliveryDetails.country}</SummaryBlock><SummaryBlock title={labels.paymentMethod} onEdit={() => goTo(2)} edit={labels.edit}>{paymentLabel}</SummaryBlock><SummaryBlock title={`${labels.items} (${items.reduce((sum, item) => sum + item.quantity, 0)})`}>{items.length ? items.map((item) => `${item.name} × ${item.quantity}`).join(", ") : "-"}</SummaryBlock><label className="checkout-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{labels.accept}</label><button className="checkout-primary" disabled={!accepted} onClick={() => goTo(4)}>{labels.confirm}</button></section>}

        {step === 4 && <section className="checkout-confirmation"><div className="checkout-confirm-icon"><Check aria-hidden="true" /></div><h1>{labels.thanks}</h1><p>{labels.confirmationSent}</p><strong>{labels.order} #KS-10234</strong><div className="checkout-confirm-summary"><div><span>{labels.estimated}</span><span>24–48h</span></div><div><span>{labels.paymentMethod}</span><span>{paymentLabel}</span></div><div><strong>{labels.paidTotal}</strong><strong>{formatPrice(total, locale)}</strong></div></div><button className="checkout-secondary">💬 {labels.follow}</button><div className="checkout-account-prompt"><strong>{labels.createAccount}</strong><p>{labels.createAccountText}</p><button className="checkout-primary">{labels.create}</button></div><Link className="checkout-link-button" href={`/${locale}/boutique`}>{labels.continueShopping}</Link></section>}
      </div><OrderSummary locale={locale} labels={labels} items={items} subtotal={subtotal} shipping={shipping} total={total} hidden={step === 4} /></div></div>
    </main>
  );
}

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
