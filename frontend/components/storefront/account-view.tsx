"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleUserRound, Copy, ExternalLink, MapPin, Pencil, Share2, Truck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backendRequest, clearSession, hasSession, resolveMediaUrl, signOut as revokeSession } from "@/lib/backend-api";
import { formatPrice, type Locale } from "@/lib/catalog";

type Labels = Record<string, string>;
type Filter = "all" | "inProgress" | "delivered" | "cancelled";

type User = { id: string; name: string | null; email: string | null; phone: string | null; role?: string; provider: "PASSWORD" | "PHONE_OTP" | "GOOGLE" | "FACEBOOK" };
type OrderItem = { id: string; productNameFr: string; quantity: number; size: string; unitPriceFcfa: number; imageUrl?: string | null; slugFr?: string | null; slugEn?: string | null };

/** Photo d'un article commandé (repli : aplat de couleur), lien vers sa fiche produit. */
function OrderThumb({ item, locale, size = "md", extra = 0 }: { item: OrderItem; locale: Locale; size?: "md" | "sm"; extra?: number }) {
  const slug = locale === "en" ? item.slugEn : item.slugFr;
  const content = <>{item.imageUrl ? <Image src={resolveMediaUrl(item.imageUrl)} alt={item.productNameFr} fill sizes={size === "sm" ? "64px" : "112px"} /> : <span className="order-thumb-fallback" aria-hidden="true">{item.productNameFr.slice(0, 1)}</span>}{extra > 0 && <span className="order-thumb-more">+{extra}</span>}</>;
  const className = `order-thumb order-thumb-${size}`;
  return slug ? <Link href={`/${locale}/produits/${slug}`} className={className} aria-label={item.productNameFr}>{content}</Link> : <div className={className}>{content}</div>;
}
type Order = {
  id: string; reference: string; status: string; paymentMethod: string; paymentStatus: string; createdAt: string;
  subtotalFcfa: number; deliveryFeeFcfa: number; totalFcfa: number; deliveryZoneId: string;
  addressCity: string; addressDistrict: string | null; addressStreet: string; addressCountry: string;
  items: OrderItem[];
};
type DeliveryZone = { id: string; etaMinHours: number; etaMaxHours: number; regionOrCity: string | null; country: string };
type Address = { id: string; label: string | null; fullName: string; phone: string; country: string; city: string; district: string | null; street: string; isDefault: boolean | number };
type AddressForm = Omit<Address, "id" | "isDefault">;

const STEPS = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];
const PAYMENT_LABELS: Record<string, string> = { MOBILE_MONEY: "Mobile Money", CARD: "Carte bancaire", CASH_ON_DELIVERY: "Paiement à la livraison" };

function orderFilter(status: string): Exclude<Filter, "all"> {
  if (status === "DELIVERED") return "delivered";
  if (status === "CANCELLED") return "cancelled";
  return "inProgress";
}

export function AccountView({ labels, locale = "fr" }: { labels: Labels; locale?: Locale }) {
  const router = useRouter();
  const [section, setSection] = useState("orders");
  const [filter, setFilter] = useState<Filter>("all");
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sharing, setSharing] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!hasSession()) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    try {
      const [me, myOrders, myAddresses] = await Promise.all([
        backendRequest<{ user: User }>("/auth/me"),
        backendRequest<{ items: Order[] }>("/orders/me?pageSize=50"),
        backendRequest<Address[]>("/addresses"),
      ]);
      setUser(me.user);
      setOrders(myOrders.items);
      setAddresses(myAddresses);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Différé : la session vit dans localStorage, lu uniquement côté navigateur.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Révoque la session côté serveur (ou toutes celles du compte) avant de quitter l'espace.
  const signOut = async (everywhere = false) => { await revokeSession(everywhere); router.push(`/${locale}/compte/connexion`); };
  const deleteAccount = async () => {
    if (!window.confirm(labels.deleteConfirm)) return;
    try {
      await backendRequest<void>("/auth/me", { method: "DELETE" });
      clearSession();
      router.push(`/${locale}`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : ""); }
  };

  if (loading) return <main className="account-page"><div className="account-shell"><p>{labels.loading}</p></div></main>;
  if (!authenticated || !user) return <main className="account-page"><div className="account-shell"><div className="account-empty"><CircleUserRound aria-hidden="true" /><p>{labels.loginRequired}</p><Button onClick={() => router.push(`/${locale}/compte/connexion`)}>{labels.loginCta}</Button></div></div></main>;

  const filteredOrders = filter === "all" ? orders : orders.filter((order) => orderFilter(order.status) === filter);
  const firstName = user.name?.split(" ")[0];

  const initials = (user.name ?? user.email ?? "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const counts = { all: orders.length, inProgress: orders.filter((order) => orderFilter(order.status) === "inProgress").length, delivered: orders.filter((order) => orderFilter(order.status) === "delivered").length };

  return <main className="account-page"><div className="account-shell"><header className="account-hero"><div className="account-identity"><div className="account-avatar" aria-hidden="true">{initials}</div><div><span className="eyebrow">KEMI SHOES / {labels.title}</span><h1>{firstName ? `${labels.hello} ${firstName}.` : `${labels.hello}.`}</h1><p className="account-contact">{[user.email, user.phone].filter(Boolean).join(" · ")}</p>{/* Accès rapide de l'équipe : back-office ou supervision selon le rôle. */}{user.role === "DEV" ? <Link className="text-link dark-link" href={`/${locale}/supervision`}>Supervision →</Link> : user.role === "ADMIN" || user.role === "PRODUCT_MANAGER" ? <Link className="text-link dark-link" href={`/${locale}/admin`}>Back-office →</Link> : null}</div></div>
    <div className="account-stats"><div><strong>{counts.all}</strong><span>{labels.orders}</span></div><div><strong>{counts.inProgress}</strong><span>{labels.inProgress}</span></div><div><strong>{counts.delivered}</strong><span>{labels.delivered}</span></div></div></header>
    {error && <p className="auth-error">{error}</p>}
    <Tabs value={section} onValueChange={setSection} className="account-tabs"><TabsList variant="line" className="account-tabs-list"><TabsTrigger value="orders">{labels.orders}</TabsTrigger><TabsTrigger value="information">{labels.information}</TabsTrigger></TabsList>
      <TabsContent value="orders" className="account-content"><div className="account-section-heading"><h2>{labels.orders}</h2><span className="account-count">{filteredOrders.length} {labels.order}</span></div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="order-filters"><TabsList variant="line"><TabsTrigger value="all">{labels.all}</TabsTrigger><TabsTrigger value="inProgress">{labels.inProgress}</TabsTrigger><TabsTrigger value="delivered">{labels.delivered}</TabsTrigger><TabsTrigger value="cancelled">{labels.cancelled}</TabsTrigger></TabsList></Tabs>
        <div className="orders-grid">{filteredOrders.map((order) => <OrderCard key={order.id} order={order} locale={locale} labels={labels} onDetails={() => setSelectedOrder(order)} onShare={() => setSharing(order)} />)}{!filteredOrders.length && <div className="account-empty"><Truck aria-hidden="true" /><p>{labels.emptyOrders}</p></div>}</div>
        {selectedOrder && <OrderDetail orderId={selectedOrder.id} locale={locale} labels={labels} onClose={() => setSelectedOrder(null)} />}
        {sharing && <SharePanel order={sharing} locale={locale} labels={labels} onClose={() => setSharing(null)} />}
      </TabsContent>
      <TabsContent value="information" className="account-content"><InformationPanel user={user} addresses={addresses} labels={labels} onUserChange={setUser} onAddressesChange={setAddresses} onSignOut={() => void signOut()} onSignOutAll={() => void signOut(true)} onDelete={deleteAccount} /></TabsContent>
    </Tabs></div></main>;
}

function OrderCard({ order, locale, labels, onDetails, onShare }: { order: Order; locale: Locale; labels: Labels; onDetails: () => void; onShare: () => void }) {
  const kind = orderFilter(order.status);
  const [first, ...others] = order.items;
  const shown = order.items.slice(0, 2);
  const hidden = order.items.length - shown.length;
  return <Card className="order-card"><div className="order-card-body">{first && <OrderThumb item={first} locale={locale} extra={others.length} />}<div className="order-card-info"><div className="order-card-top"><div><strong className="order-ref">{order.reference}</strong><span>{new Date(order.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div><Badge className={`status-badge status-${kind}`}>{labels[kind]}</Badge></div>
    <ul className="order-lines">{shown.map((item) => <li key={item.id}><span className="order-line-name">{item.productNameFr}</span><em>× {item.quantity} · {item.size}</em></li>)}{hidden > 0 && <li className="order-line-more">+{hidden} {labels.items?.toLowerCase()}</li>}</ul></div></div>
    <div className="order-card-bottom"><strong>{formatPrice(order.totalFcfa, locale)}</strong><div className="order-card-actions">{kind === "delivered" && <Button variant="outline" size="sm" className="share-order" onClick={onShare}><Share2 data-icon="inline-start" />{labels.reorder}</Button>}<Button variant="ghost" size="sm" onClick={onDetails}>{labels.viewDetails}<ChevronRight data-icon="inline-end" /></Button></div></div></Card>;
}

function OrderDetail({ orderId, locale, labels, onClose }: { orderId: string; locale: Locale; labels: Labels; onClose: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [zone, setZone] = useState<DeliveryZone | null>(null);
  useEffect(() => {
    backendRequest<Order>(`/orders/${orderId}`).then((result) => {
      setOrder(result);
      return backendRequest<DeliveryZone>(`/delivery-zones/${result.deliveryZoneId}`).then(setZone);
    }).catch(() => undefined);
  }, [orderId]);

  const steps = [labels.confirmed, labels.prepared, labels.shipped, labels.deliveredStep];
  const reached = order ? STEPS.indexOf(order.status) + 1 : 0;
  const paymentLabel = order ? (order.paymentStatus === "PAID" ? labels.paid : order.paymentStatus === "FAILED" ? labels.failed : labels.unpaid) : "";

  return <div className="account-overlay"><Card className="order-detail"><CardHeader><div><span className="section-kicker">{labels.order}</span><CardTitle>{order?.reference ?? "…"}</CardTitle></div><Button variant="ghost" size="icon" aria-label={labels.close} onClick={onClose}><X /></Button></CardHeader>
    {order ? <CardContent><div className="tracking-title"><Truck aria-hidden="true" /><span>{labels.tracking}</span></div><div className="timeline">{steps.map((step, index) => <div className={`timeline-step ${index < reached ? "is-done" : ""}`} key={step}><span className="timeline-dot">{index < reached ? <Check /> : index + 1}</span><span>{step}</span></div>)}</div>
      {zone && order.status !== "DELIVERED" && order.status !== "CANCELLED" && <p className="eta-note">{zone.etaMinHours}–{zone.etaMaxHours}h · {zone.regionOrCity || zone.country}</p>}
      <ul className="detail-products">{order.items.map((item) => <li key={item.id}><OrderThumb item={item} locale={locale} size="sm" /><div><strong>{item.productNameFr}</strong><span>× {item.quantity} · {item.size}</span></div><b>{formatPrice(item.unitPriceFcfa * item.quantity, locale)}</b></li>)}</ul>
      <div className="detail-list"><div><span>{labels.address}</span><strong>{[order.addressDistrict, order.addressCity].filter(Boolean).join(", ")}</strong></div><div><span>{labels.payment}</span><strong>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</strong></div><div><span>{labels.paymentStatus}</span><strong>{paymentLabel}</strong></div><div><span>{labels.subtotal}</span><strong>{formatPrice(order.subtotalFcfa, locale)}</strong></div><div><span>{labels.shipping}</span><strong>{formatPrice(order.deliveryFeeFcfa, locale)}</strong></div><div className="detail-total"><span>{labels.total}</span><strong>{formatPrice(order.totalFcfa, locale)}</strong></div></div>
      {order.paymentMethod !== "CASH_ON_DELIVERY" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED" && <Link className="full-button" href={`/${locale}/commande/suivi?order=${order.id}`}>{labels.paymentStatus}</Link>}
      <Button className="full-button" onClick={() => window.open(`https://wa.me/237678666069?text=${encodeURIComponent(`Commande ${order.reference}`)}`, "_blank", "noopener")}><ExternalLink data-icon="inline-start" />{labels.followWhatsApp}</Button><Link className="help-link" href={`/${locale}/mentions-legales`}>{labels.needHelp}</Link></CardContent>
      : <CardContent><p>{labels.loading}</p></CardContent>}
  </Card></div>;
}

function SharePanel({ order, locale, labels, onClose }: { order: Order; locale: Locale; labels: Labels; onClose: () => void }) {
  const item = order.items[0];
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/boutique` : "";
  const text = `${item?.productNameFr ?? "KEMI SHOES"} — ${shareUrl}`;
  return <div className="share-drawer"><div className="share-drawer-header"><div><span className="section-kicker">KEMI / SHARE</span><h3>{labels.shareTitle}</h3></div><Button variant="ghost" size="icon" aria-label={labels.close} onClick={onClose}><X /></Button></div><div className="share-product">{item ? <OrderThumb item={item} locale={locale} size="sm" /> : null}<div><strong>{item?.productNameFr}</strong><span>{item ? formatPrice(item.unitPriceFcfa, locale) : ""}</span></div></div><div className="share-actions"><Button variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener")}><span className="share-icon">W</span>WhatsApp</Button><Button variant="outline" onClick={() => navigator.clipboard?.writeText(shareUrl)}><Copy data-icon="inline-start" />{labels.copyLink}</Button></div></div>;
}

const emptyAddress: AddressForm = { label: "", fullName: "", phone: "", country: "Cameroun", city: "", district: "", street: "" };

function InformationPanel({ user, addresses, labels, onUserChange, onAddressesChange, onSignOut, onSignOutAll, onDelete }: { user: User; addresses: Address[]; labels: Labels; onUserChange: (user: User) => void; onAddressesChange: (addresses: Address[]) => void; onSignOut: () => void; onSignOutAll: () => void; onDelete: () => void }) {
  const [profile, setProfile] = useState({ name: user.name ?? "", email: user.email ?? "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyAddress);

  const connection = { GOOGLE: labels.connectedGoogle, FACEBOOK: labels.connectedFacebook, PHONE_OTP: labels.connectedPhone, PASSWORD: labels.connectedEmail }[user.provider];

  const saveProfile = async () => {
    setError("");
    try {
      const result = await backendRequest<{ user: User }>("/auth/me", { method: "PATCH", body: JSON.stringify({ ...(profile.name.trim() ? { name: profile.name.trim() } : {}), ...(profile.email.trim() ? { email: profile.email.trim() } : {}) }) });
      onUserChange(result.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : ""); }
  };

  const reloadAddresses = async () => onAddressesChange(await backendRequest<Address[]>("/addresses"));

  const saveAddress = async () => {
    setError("");
    const body = JSON.stringify({ ...form, label: form.label || undefined, district: form.district || undefined });
    try {
      if (editing === "new") await backendRequest<Address>("/addresses", { method: "POST", body });
      else if (editing) await backendRequest<Address>(`/addresses/${editing}`, { method: "PATCH", body });
      setEditing(null);
      await reloadAddresses();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : ""); }
  };

  const setDefault = async (id: string) => { await backendRequest<Address>(`/addresses/${id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }); await reloadAddresses(); };
  const removeAddress = async (id: string) => { await backendRequest<void>(`/addresses/${id}`, { method: "DELETE" }); await reloadAddresses(); };
  const startEdit = (address?: Address) => {
    setEditing(address?.id ?? "new");
    setForm(address ? { label: address.label ?? "", fullName: address.fullName, phone: address.phone, country: address.country, city: address.city, district: address.district ?? "", street: address.street } : { ...emptyAddress, fullName: user.name ?? "", phone: user.phone ?? "" });
  };

  return <div className="information-layout"><div className="account-section-heading"><h2>{labels.information}</h2></div>
    {error && <p className="auth-error">{error}</p>}
    <div className="information-grid"><Card><CardHeader><CardTitle>{labels.profile}</CardTitle></CardHeader><CardContent className="profile-fields">
      <EditableField label={labels.name} value={profile.name} onChange={(name) => setProfile((current) => ({ ...current, name }))} />
      <div className="editable-field"><div><span>{labels.phone}</span><strong>{user.phone ?? "—"}</strong></div></div>
      <EditableField label={labels.email} value={profile.email} type="email" onChange={(email) => setProfile((current) => ({ ...current, email }))} />
      <div className="profile-connection"><span>{labels.connection}</span><strong>{connection}</strong></div>
      <Button className="full-button" onClick={saveProfile}>{saved ? <><Check data-icon="inline-start" />{labels.saved}</> : labels.save}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{labels.addresses}</CardTitle></CardHeader><CardContent className="address-list">
      {!addresses.length && !editing && <p>{labels.noAddress}</p>}
      {addresses.map((address) => editing === address.id ? <AddressEditor key={address.id} form={form} labels={labels} onChange={setForm} onSave={saveAddress} onCancel={() => setEditing(null)} /> : <AddressCard key={address.id} address={address} labels={labels} onEdit={() => startEdit(address)} onDefault={() => setDefault(address.id)} onDelete={() => removeAddress(address.id)} />)}
      {editing === "new" ? <AddressEditor form={form} labels={labels} onChange={setForm} onSave={saveAddress} onCancel={() => setEditing(null)} /> : <Button variant="outline" className="full-button" onClick={() => startEdit()}><MapPin data-icon="inline-start" />{labels.addAddress}</Button>}
    </CardContent></Card></div>
    <div className="account-footer-actions"><Button variant="ghost" onClick={onSignOut}>{labels.signOut}</Button><Button variant="ghost" onClick={onSignOutAll}>{labels.signOutAll}</Button><Button variant="ghost" className="danger-action" onClick={onDelete}>{labels.deleteAccount}</Button></div></div>;
}

function EditableField({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  return <div className="editable-field"><div><span>{label}</span>{editing ? <input type={type} value={value} autoFocus onChange={(event) => onChange(event.target.value)} onBlur={() => setEditing(false)} /> : <strong>{value || "—"}</strong>}</div><Button variant="ghost" size="sm" aria-label={`${label}: edit`} onClick={() => setEditing(true)}><Pencil /></Button></div>;
}

function AddressCard({ address, labels, onEdit, onDefault, onDelete }: { address: Address; labels: Labels; onEdit: () => void; onDefault: () => void; onDelete: () => void }) {
  const isDefault = Boolean(address.isDefault);
  return <div className={`address-card ${isDefault ? "is-default" : ""}`}><div className="address-top"><strong>{address.label || address.fullName}</strong>{isDefault && <Badge>{labels.defaultAddress}</Badge>}</div><span>{[address.street, address.district, address.city].filter(Boolean).join(", ")} - {address.country}</span><div className="address-actions"><Button variant="link" size="sm" onClick={onEdit}>{labels.edit}</Button>{!isDefault && <Button variant="link" size="sm" onClick={onDefault}>{labels.setDefault}</Button>}<Button variant="link" size="sm" className="danger-action" onClick={onDelete}>{labels.delete}</Button></div></div>;
}

function AddressEditor({ form, labels, onChange, onSave, onCancel }: { form: AddressForm; labels: Labels; onChange: (form: AddressForm) => void; onSave: () => void; onCancel: () => void }) {
  const fields: Array<[keyof AddressForm, string]> = [["label", labels.addressLabel], ["fullName", labels.fullName], ["phone", labels.phone], ["country", labels.country], ["city", labels.city], ["district", labels.district], ["street", labels.street]];
  return <div className="address-card address-editor">{fields.map(([key, label]) => <label key={key} className="editable-field"><span>{label}</span><input value={form[key] ?? ""} onChange={(event) => onChange({ ...form, [key]: event.target.value })} /></label>)}<div className="address-actions"><Button size="sm" onClick={onSave}>{labels.save}</Button><Button variant="link" size="sm" onClick={onCancel}>{labels.cancel}</Button></div></div>;
}
