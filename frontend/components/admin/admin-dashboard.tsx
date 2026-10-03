"use client";

import { useEffect, useMemo, useState } from "react";
import { backendRequest, resolveMediaUrl, uploadProductImage } from "@/lib/backend-api";

type TabId =
  | "overview"
  | "orders"
  | "products"
  | "customers"
  | "delivery"
  | "payment"
  | "reviews"
  | "content"
  | "settings";
type OrderStatus = "pending" | "progress" | "done" | "cancel";
type ProductStatus = "active" | "draft" | "out";

type NavItem = { id: TabId; label: string; iconClass: string };

type Product = {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  price: string;
  compareAtPrice: string;
  status: ProductStatus;
  description: string;
  descriptionEn: string;
  color: string;
  images: string[];
  sizes: string[];
  customizableColor: boolean;
  customizableMaterial: boolean;
};

type DeliveryZone = {
  id: string;
  country: string;
  regionOrCity: string | null;
  feeFcfa: number;
  etaMinHours: number;
  etaMaxHours: number;
  codAvailable: boolean;
  paymentMethods: string[];
  active: boolean;
};

type ApiProduct = {
  id: string;
  nameFr: string;
  nameEn: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  status: string;
  descriptionFr: string;
  descriptionEn: string;
  colorCustomizable: boolean;
  materialCustomizable: boolean;
  images?: { url: string; isMain?: boolean }[];
  colors?: { hex: string }[];
  sizes?: { size: string; available?: boolean }[];
};
type ApiOrder = {
  id: string;
  reference: string;
  guestName: string;
  status: string;
  totalFcfa: number;
  createdAt: string;
  deliveryZoneId: string;
};
type AdminOrder = { uuid: string; id: string; client: string; date: string; zone: string; status: OrderStatus; rawStatus: string; total: string };
type AdminReview = { id: string; productId: string; rating: number; comment: string; createdAt: string; status: string };
type ContentPage = { id: string; slug: string; titleFr: string; titleEn?: string | null; bodyFr: string; bodyEn?: string | null };
type UserRole = "CUSTOMER" | "PRODUCT_MANAGER" | "ADMIN";
type AdminUser = { id: string; name: string | null; email: string | null; phone: string | null; role: UserRole; provider: string; createdAt: string; orderCount: number; lastOrderAt: string | null };
type PaymentProvider = { id: string; name: string; description: string; status: "live" | "demo" | "not_configured"; methods: string[]; webhookConfigured?: boolean; maxAmountXaf?: number | null };
type StoreSettings = { storeName: string; phone: string; whatsapp: string; email: string; address: string; instagram: string; facebook: string };

const providerLabels: Record<string, string> = { GOOGLE: "Google", FACEBOOK: "Facebook", PHONE_OTP: "Téléphone", PASSWORD: "Email" };
const roleLabels: Record<UserRole, string> = { ADMIN: "Administrateur", PRODUCT_MANAGER: "Gestionnaire produit", CUSTOMER: "Client" };
const paymentMethodLabels: Record<string, string> = { mobile_money: "Mobile Money", card: "Carte", cod: "COD" };
const providerStatusLabels: Record<PaymentProvider["status"], string> = { live: "Connecté", demo: "Mode test (demo)", not_configured: "Non configuré" };

const tabsConfig: NavItem[] = [
  {
    id: "overview",
    label: "Vue d'ensemble",
    iconClass: "fa-solid fa-gauge-high",
  },
  { id: "orders", label: "Commandes", iconClass: "fa-solid fa-clipboard-list" },
  { id: "products", label: "Produits", iconClass: "fa-solid fa-box-open" },
  { id: "customers", label: "Clients", iconClass: "fa-solid fa-users" },
  { id: "delivery", label: "Livraison", iconClass: "fa-solid fa-truck" },
  { id: "payment", label: "Paiement", iconClass: "fa-solid fa-credit-card" },
  { id: "reviews", label: "Avis clients", iconClass: "fa-solid fa-star" },
  {
    id: "content",
    label: "Contenu & traductions",
    iconClass: "fa-regular fa-file-lines",
  },
  { id: "settings", label: "Paramètres", iconClass: "fa-solid fa-gear" },
];

const orderStatusClasses: Record<
  OrderStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "En attente", bg: "#eee", color: "#666" },
  progress: { label: "En livraison", bg: "#f6efdf", color: "#a6741f" },
  done: { label: "Livrée", bg: "#e8f0ea", color: "#3f6b4a" },
  cancel: { label: "Annulée", bg: "#f6e6e3", color: "#a13b2f" },
};

const overviewKpis: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}[] = [];

const topProducts: { name: string; sales: number; percent: number }[] = [];

const recentOrders: {
  id: string;
  client: string;
  status: OrderStatus;
  total: string;
}[] = [];

const alerts: string[] = [];

const allOrders: {
  id: string;
  client: string;
  date: string;
  zone: string;
  status: OrderStatus;
  total: string;
}[] = [];

const defaultProducts: Product[] = [];

const availableSizes = ["38", "39", "40", "41", "42", "43"];

const statusChipLabels: Record<ProductStatus, string> = {
  active: "Actif",
  draft: "Brouillon",
  out: "Rupture",
};

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  >("all");
  const [productView, setProductView] = useState<"catalog" | "new">("catalog");
  const [productFilter, setProductFilter] = useState<
    "all" | "active" | "draft"
  >("all");
  const [productPreviewTab, setProductPreviewTab] = useState<"card" | "pdp">(
    "card",
  );
  const [productLang, setProductLang] = useState<"fr" | "en">("fr");
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminReviews, setAdminReviews] = useState<AdminReview[]>([]);
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [editingContent, setEditingContent] = useState<ContentPage | null>(null);
  const [orderNote, setOrderNote] = useState("");
  const [focusedOrder, setFocusedOrder] = useState<(ApiOrder & { internalNote?: string | null; items?: { productNameFr: string; quantity: number; size: string }[] }) | null>(null);
  const [adminError, setAdminError] = useState("");
  const [dashboardKpis, setDashboardKpis] = useState(overviewKpis);
  const [dashboardTopProducts, setDashboardTopProducts] = useState(topProducts);
  const [dashboardAlerts, setDashboardAlerts] = useState(alerts);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    country: "Cameroun",
    regionOrCity: "",
    feeFcfa: "",
    etaMinHours: "24",
    etaMaxHours: "48",
    codAvailable: true,
  });
  const [showToggles, setShowToggles] = useState({
    customizableColor: true,
    customizableMaterial: true,
  });
  const [productMessage, setProductMessage] = useState("");
  const [sizeAvailability, setSizeAvailability] = useState<Record<string, boolean>>({});
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    // Chargements indépendants : un 403 (ex. gestionnaire produit sur /users)
    // ne doit pas empêcher l'affichage du reste du tableau de bord.
    backendRequest<{ items: AdminUser[]; total: number }>("/users?role=CUSTOMER&pageSize=100")
      .then((result) => { setCustomers(result.items); setCustomersTotal(result.total); })
      .catch(() => undefined);
    Promise.all([
      backendRequest<{ items: AdminUser[] }>("/users?role=ADMIN"),
      backendRequest<{ items: AdminUser[] }>("/users?role=PRODUCT_MANAGER"),
    ]).then(([admins, managers]) => setStaffUsers([...admins.items, ...managers.items])).catch(() => undefined);
    backendRequest<PaymentProvider[]>("/payments/providers").then(setPaymentProviders).catch(() => undefined);
    backendRequest<StoreSettings>("/settings").then(setStoreSettings).catch(() => undefined);
  }, []);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const period = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
    Promise.all([
      backendRequest<{ items: ApiProduct[] }>("/products?pageSize=100"),
      backendRequest<DeliveryZone[]>("/delivery-zones"),
      backendRequest<{ items: ApiOrder[] }>("/orders?pageSize=100"),
      backendRequest<{
        orders: number;
        unitsSold: number;
        revenueFcfa: number;
        averageBasketFcfa: number;
      }>(`/dashboard/kpis${period}`),
      backendRequest<
        { productNameFr: string; units: number; trendPercent: number }[]
      >(`/dashboard/top-products${period}`),
      backendRequest<{
        outOfStockSizes: { productName: string; size: string }[];
        pendingCustomizationsCount: number;
      }>("/dashboard/alerts"),
      backendRequest<AdminReview[]>("/reviews?status=pending"),
      backendRequest<ContentPage[]>("/content"),
    ])
      .then(([productResult, zones, orderResult, kpis, top, alertResult, reviewResult, pages]) => {
        setProducts(
          productResult.items.map((product) => ({
            id: product.id,
            name: product.nameFr,
            nameEn: product.nameEn,
            category: product.category,
            price: `${product.price.toLocaleString("fr-FR")}f`,
            compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
            status:
              product.status === "out_of_stock"
                ? "out"
                : (product.status as ProductStatus),
            description: product.descriptionFr,
            descriptionEn: product.descriptionEn,
            color: product.colors?.[0]?.hex ?? "#14120F",
            images: product.images?.map((image) => image.url) ?? [],
            sizes: product.sizes?.map((size) => size.size) ?? [],
            customizableColor: product.colorCustomizable,
            customizableMaterial: product.materialCustomizable,
          })),
        );
        setDeliveryZones(zones);
        setAdminOrders(
          orderResult.items.map((order) => ({
            uuid: order.id,
            id: order.reference,
            client: order.guestName,
            date: new Date(order.createdAt).toLocaleDateString("fr-FR"),
            zone: order.deliveryZoneId,
            status:
              order.status === "DELIVERED"
                ? "done"
                : order.status === "CANCELLED"
                  ? "cancel"
                  : order.status === "PENDING"
                    ? "pending"
                    : "progress",
              rawStatus: order.status,
            total: `${order.totalFcfa.toLocaleString("fr-FR")}f`,
          })),
        );
          setAdminReviews(reviewResult);
          setContentPages(pages);
        setDashboardKpis([
          {
            label: "Commandes",
            value: String(kpis.orders),
            delta: "Données backend",
            positive: true,
          },
          {
            label: "Ventes (unités)",
            value: String(kpis.unitsSold),
            delta: "Données backend",
            positive: true,
          },
          {
            label: "Chiffre d'affaires",
            value: `${kpis.revenueFcfa.toLocaleString("fr-FR")}f`,
            delta: "Données backend",
            positive: true,
          },
          {
            label: "Panier moyen",
            value: `${kpis.averageBasketFcfa.toLocaleString("fr-FR")}f`,
            delta: "Données backend",
            positive: true,
          },
        ]);
        setDashboardTopProducts(
          top.map((item) => ({
            name: item.productNameFr,
            sales: item.units,
            percent: Math.min(100, Math.max(0, item.trendPercent)),
          })),
        );
        setDashboardAlerts([
          ...alertResult.outOfStockSizes.map(
            (item) => `Taille ${item.size} en rupture - ${item.productName}`,
          ),
          `${alertResult.pendingCustomizationsCount} personnalisation(s) en attente`,
        ]);
      })
      .catch(() => {
        setProducts([]);
        setAdminOrders([]);
        setDashboardKpis([]);
        setDashboardTopProducts([]);
        setDashboardAlerts([]);
        setAdminReviews([]);
        setContentPages([]);
      });
  }, []);

  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0];

  const orderList = useMemo(() => {
    if (orderFilter === "all") return adminOrders;
    if (orderFilter === "pending")
      return adminOrders.filter((order) => order.status === "pending");
    if (orderFilter === "confirmed")
      return adminOrders.filter(
        (order) => order.status === "progress" || order.status === "done",
      );
    if (orderFilter === "shipped")
      return adminOrders.filter((order) => order.status === "progress");
    if (orderFilter === "delivered")
      return adminOrders.filter((order) => order.status === "done");
    return adminOrders.filter((order) => order.status === "cancel");
  }, [adminOrders, orderFilter]);

  const filteredProducts = useMemo(() => {
    if (productFilter === "all") return products;
    return products.filter((product) => product.status === productFilter);
  }, [productFilter, products]);

  const updateSelectedProduct = <K extends keyof Product>(
    field: K,
    value: Product[K],
  ) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === selectedProductId
          ? { ...product, [field]: value }
          : product,
      ),
    );
  };

  const selectProduct = async (productId: string) => {
    try {
      const product = await backendRequest<ApiProduct & { colors?: { name: string; hex: string }[]; sizes?: { size: string; available: boolean }[] }>(`/products/${productId}`);
      setProducts((current) => {
        const mapped: Product = {
          id: product.id,
          name: product.nameFr,
          nameEn: product.nameEn,
          category: product.category,
          price: String(product.price),
          compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
          status: product.status === "out_of_stock" ? "out" : product.status as ProductStatus,
          description: product.descriptionFr,
          descriptionEn: product.descriptionEn,
          color: product.colors?.[0]?.hex ?? "#14120F",
          images: product.images?.map((image) => image.url) ?? [],
          sizes: product.sizes?.map((size) => size.size) ?? [],
          customizableColor: product.colorCustomizable,
          customizableMaterial: product.materialCustomizable,
        };
        return [mapped, ...current.filter((item) => item.id !== productId)];
      });
      setShowToggles({ customizableColor: product.colorCustomizable, customizableMaterial: product.materialCustomizable });
      setSizeAvailability(Object.fromEntries((product.sizes ?? []).map((size) => [size.size, Boolean(size.available)])));
      setSelectedProductId(productId);
      setProductMessage("");
      setProductView("new");
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Chargement du produit impossible.");
    }
  };

  const createProduct = () => {
    const newProduct: Product = {
      id: "new",
      name: "",
      nameEn: "",
      category: "Homme",
      price: "",
      compareAtPrice: "",
      status: "draft",
      description: "",
      descriptionEn: "",
      color: "#14120F",
      images: [],
      sizes: [],
      customizableColor: true,
      customizableMaterial: true,
    };
    setProducts((current) => [newProduct, ...current.filter((product) => product.id !== "new")]);
    setSelectedProductId(newProduct.id);
    setSizeAvailability({});
    setShowToggles({ customizableColor: true, customizableMaterial: true });
    setProductMessage("");
    setProductView("new");
  };

  const saveProduct = async (status: "draft" | "active") => {
    if (!selectedProduct) return;
    setSavingProduct(true);
    setProductMessage("");
    try {
      const price = Number(selectedProduct.price.replace(/\D/g, ""));
      const compareAtPrice = Number(selectedProduct.compareAtPrice.replace(/\D/g, ""));
      const payload = {
        nameFr: selectedProduct.name,
        nameEn: selectedProduct.nameEn,
        descriptionFr: selectedProduct.description,
        descriptionEn: selectedProduct.descriptionEn,
        category: selectedProduct.category,
        price,
        ...(compareAtPrice > 0 ? { compareAtPrice } : {}),
        status,
        colorCustomizable: showToggles.customizableColor,
        materialCustomizable: showToggles.customizableMaterial,
        images: selectedProduct.images.map((url, index) => ({ url, isMain: index === 0 })),
        colors: [{ name: "Couleur", hex: selectedProduct.color }],
        sizes: selectedProduct.sizes.map((size) => ({ size, available: sizeAvailability[size] ?? true })),
      };
      if (!payload.nameFr.trim() || !payload.nameEn.trim() || !payload.descriptionFr.trim() || !payload.descriptionEn.trim() || !price) {
        throw new Error("Complétez les noms, descriptions et le prix dans les deux langues.");
      }
      const saved = selectedProduct.id === "new"
        ? await backendRequest<ApiProduct>("/products", { method: "POST", body: JSON.stringify(payload) })
        : await backendRequest<ApiProduct>(`/products/${selectedProduct.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const refreshed = await backendRequest<{ items: ApiProduct[] }>("/products?pageSize=100");
      setProducts(refreshed.items.map((item) => ({
        id: item.id, name: item.nameFr, nameEn: item.nameEn, category: item.category,
        price: `${item.price.toLocaleString("fr-FR")}f`, compareAtPrice: item.compareAtPrice ? String(item.compareAtPrice) : "",
        status: item.status === "out_of_stock" ? "out" : item.status as ProductStatus,
        description: item.descriptionFr, descriptionEn: item.descriptionEn, color: item.colors?.[0]?.hex ?? "#14120F",
        images: item.images?.map((image) => image.url) ?? [], sizes: item.sizes?.map((size) => size.size) ?? [],
        customizableColor: item.colorCustomizable, customizableMaterial: item.materialCustomizable,
      })));
      setSelectedProductId(saved.id);
      setProductMessage("Produit enregistré.");
      setProductView("catalog");
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductFiles = async (files: FileList | File[]) => {
    if (!selectedProduct) return;
    const candidates = Array.from(files);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (candidates.some((file) => !allowed.has(file.type) || file.size > 5 * 1024 * 1024)) {
      setProductMessage("Images JPEG, PNG ou WebP uniquement, 5 Mo maximum chacune.");
      return;
    }
    setProductMessage("");
    try {
      const uploads = await Promise.all(candidates.map((file) => uploadProductImage(file)));
      updateSelectedProduct("images", [...selectedProduct.images, ...uploads.map((upload) => upload.url)]);
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Échec de l'upload.");
    }
  };

  const changeOrderStatus = async (order: AdminOrder, status: string) => {
    setAdminError("");
    try {
      await backendRequest(`/orders/${order.uuid}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setAdminOrders((current) => current.map((item) => item.uuid === order.uuid ? { ...item, rawStatus: status, status: status === "DELIVERED" ? "done" : status === "CANCELLED" ? "cancel" : status === "PENDING" ? "pending" : "progress" } : item));
      return true;
    } catch (error) { setAdminError(error instanceof Error ? error.message : "Mise à jour du statut impossible."); }
    return false;
  };

  const saveOrderNote = async (order: AdminOrder) => {
    setAdminError("");
    try {
      await backendRequest(`/orders/${order.uuid}/note`, { method: "PATCH", body: JSON.stringify({ note: orderNote }) });
      setOrderNote("");
    } catch (error) { setAdminError(error instanceof Error ? error.message : "Enregistrement de la note impossible."); }
  };

  const openOrder = async (order: AdminOrder) => {
    try {
      setFocusedOrder(await backendRequest<ApiOrder & { internalNote?: string | null; items?: { productNameFr: string; quantity: number; size: string }[] }>(`/orders/${order.uuid}`));
      setOrderNote("");
      setAdminError("");
    } catch (error) { setAdminError(error instanceof Error ? error.message : "Chargement de la commande impossible."); }
  };

  const moderateReview = async (review: AdminReview, status: "approved" | "hidden") => {
    try {
      await backendRequest(`/reviews/${review.id}/moderate`, { method: "PATCH", body: JSON.stringify({ status }) });
      setAdminReviews((current) => current.filter((item) => item.id !== review.id));
    } catch (error) { setAdminError(error instanceof Error ? error.message : "Modération impossible."); }
  };

  const saveContentPage = async () => {
    if (!editingContent) return;
    try {
      const page = await backendRequest<ContentPage>(`/content/${encodeURIComponent(editingContent.slug)}`, { method: "PUT", body: JSON.stringify(editingContent) });
      setContentPages((current) => [page, ...current.filter((item) => item.slug !== page.slug)]);
      setEditingContent(null);
      setAdminError("");
    } catch (error) { setAdminError(error instanceof Error ? error.message : "Enregistrement du contenu impossible."); }
  };

  const createDeliveryZone = async () => {
    try {
      const zone = await backendRequest<DeliveryZone>("/delivery-zones", {
        method: "POST",
        body: JSON.stringify({
          ...deliveryForm,
          feeFcfa: Number(deliveryForm.feeFcfa),
          etaMinHours: Number(deliveryForm.etaMinHours),
          etaMaxHours: Number(deliveryForm.etaMaxHours),
          paymentMethods: [
            "mobile_money",
            "card",
            ...(deliveryForm.codAvailable ? ["cod"] : []),
          ],
        }),
      });
      setDeliveryZones((current) => [...current, zone]);
      setShowDeliveryForm(false);
    } catch {
      /* UI remains on the form so the user can retry. */
    }
  };

  const toggleDeliveryZone = async (zone: DeliveryZone) => {
    try {
      await backendRequest<DeliveryZone>(`/delivery-zones/${zone.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !zone.active }),
      });
      setDeliveryZones((current) =>
        current.map((item) =>
          item.id === zone.id ? { ...item, active: !item.active } : item,
        ),
      );
    } catch {
      /* Keep the current state when the API rejects the mutation. */
    }
  };

  const deleteDeliveryZone = async (id: string) => {
    try {
      await backendRequest<void>(`/delivery-zones/${id}`, { method: "DELETE" });
      setDeliveryZones((current) => current.filter((zone) => zone.id !== id));
    } catch {
      /* Keep the current state when the API rejects the mutation. */
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Supprimer définitivement « ${product.name} » ?`)) return;
    try {
      await backendRequest<void>(`/products/${product.id}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setProductMessage("Produit supprimé.");
    } catch (error) { setProductMessage(error instanceof Error ? error.message : "Suppression impossible."); }
  };

  // Rupture temporaire d'une taille, sans réenregistrer toute la fiche produit.
  const toggleSizeAvailability = async (size: string) => {
    if (!selectedProduct || selectedProduct.id === "new") return;
    const available = !(sizeAvailability[size] ?? true);
    try {
      await backendRequest(`/products/${selectedProduct.id}/sizes`, { method: "PATCH", body: JSON.stringify({ size, available }) });
      setSizeAvailability((current) => ({ ...current, [size]: available }));
    } catch (error) { setProductMessage(error instanceof Error ? error.message : "Mise à jour de la taille impossible."); }
  };

  const saveStoreSettings = async () => {
    if (!storeSettings) return;
    try {
      setStoreSettings(await backendRequest<StoreSettings>("/settings", { method: "PUT", body: JSON.stringify(storeSettings) }));
      setSettingsMessage("Paramètres enregistrés.");
    } catch (error) { setSettingsMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
  };

  const changeUserRole = async (user: AdminUser, role: UserRole) => {
    try {
      const updated = await backendRequest<AdminUser>(`/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setStaffUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role: updated.role } : item)));
      setSettingsMessage("Rôle mis à jour.");
    } catch (error) { setSettingsMessage(error instanceof Error ? error.message : "Changement de rôle impossible."); }
  };

  const zoneLabel = (zoneId: string) => {
    const zone = deliveryZones.find((item) => item.id === zoneId);
    return zone ? zone.regionOrCity || zone.country : "—";
  };

  const toggleSize = (size: string) => {
    if (!selectedProduct) return;
    const nextSizes = selectedProduct.sizes.includes(size)
      ? selectedProduct.sizes.filter((item) => item !== size)
      : [...selectedProduct.sizes, size];
    updateSelectedProduct("sizes", nextSizes);
  };

  const renderPage = () => {
    if (activeTab === "overview") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-(--font-fraunces) text-[21px]  tracking-[-0.01em]">
                Vue d&apos;ensemble
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                Aperçu de l&apos;activité de la boutique
              </div>
            </div>
            <div className="rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[11.5px] font-semibold text-[#14120F]">
              30 derniers jours ▾
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardKpis.map((item) => (
              <div
                key={item.label}
                className="rounded-[10px] border border-[#E4DDD5] bg-white p-4"
              >
                <div className="mb-2 text-[10.5px] uppercase tracking-wider text-[#8a8378]">
                  {item.label}
                </div>
                <div className="font-(--font-fraunces) text-[27px] font-semibold leading-none tracking-[-0.01em]">
                  {item.value}
                </div>
                <div
                  className="mt-2 text-[11px] font-semibold"
                  style={{ color: item.positive ? "#3f6b4a" : "#a13b2f" }}
                >
                  {item.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-5 rounded-[10px] border border-[#E4DDD5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E4DDD5] px-[18px] py-[14px]">
              <h3 className="text-[13.5px] font-semibold">Top 10 produits</h3>
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className="text-[11px] font-bold text-[#D2531E]"
              >
                Voir tout →
              </button>
            </div>
            <div className="p-[18px]">
              {dashboardTopProducts.map((product) => (
                <div
                  key={product.name}
                  className="mb-3.5 flex items-center gap-3 last:mb-0"
                >
                  <div className="h-8.5 w-8.5 shrink-0 rounded-[6px] bg-linear-to-br from-[#3a2c22] to-[#171310]" />
                  <div className="w-37.5 shrink-0 text-[12px] font-semibold">
                    {product.name}
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F3ECE6]">
                    <div
                      className="h-full rounded-full bg-[#D2531E]"
                      style={{ width: `${product.percent}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-[11.5px] font-bold">
                    {product.sales} ventes
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[10px] border border-[#E4DDD5] bg-white">
              <div className="flex items-center justify-between border-b border-[#E4DDD5] px-[18px] py-[14px]">
                <h3 className="text-[13.5px] font-semibold">
                  Commandes récentes
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="text-[11px] font-bold text-[#D2531E]"
                >
                  Voir tout →
                </button>
              </div>
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F3ECE6]">
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Commande
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Client
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Statut
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adminOrders.slice(0, 5).map((order) => {
                    const status = orderStatusClasses[order.status];
                    return (
                      <tr key={order.id} className="border-t border-[#E4DDD5]">
                        <td className="px-[14px] py-[12px] font-semibold">
                          {order.id}
                        </td>
                        <td className="px-[14px] py-[12px]">{order.client}</td>
                        <td className="px-[14px] py-[12px]">
                          <span
                            className="inline-block rounded-full px-[10px] py-[3px] text-[10px] font-bold"
                            style={{
                              background: status.bg,
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-[14px] py-[12px]">{order.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-[10px] border border-[#E4DDD5] bg-white">
              <div className="border-b border-[#E4DDD5] px-4.5 py-3.5">
                <h3 className="text-[13.5px] font-semibold">Alertes</h3>
              </div>
              <div className="p-[18px]">
                {dashboardAlerts.map((alert) => (
                  <div
                    key={alert}
                    className="flex items-start gap-[9px] border-b border-[#E4DDD5] py-[9px] text-[12px] last:border-0"
                  >
                    <span className="mt-[5px] h-[6px] w-[6px] rounded-full bg-[#a13b2f]" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "orders") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Commandes
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                128 commandes sur la période
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[
              ["all", "Toutes (128)"],
              ["pending", "En attente (6)"],
              ["confirmed", "Confirmées (14)"],
              ["shipped", "Expédiées (22)"],
              ["delivered", "Livrées (78)"],
              ["cancelled", "Annulées (8)"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrderFilter(value as typeof orderFilter)}
                className={`rounded-[6px] border px-[14px] py-[7px] text-[11.5px] font-semibold ${
                  orderFilter === value
                    ? "border-[#14120F] bg-[#14120F] text-white"
                    : "border-[#E4DDD5] bg-white text-[#14120F]"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[11.5px] text-[#8a8378]">
              Zone : Toutes ▾
            </div>
          </div>

          <div className="rounded-[10px] border border-[#E4DDD5] bg-white overflow-hidden">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3ECE6]">
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Commande
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Client
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Date
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Zone
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Statut
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Total
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]" />
                </tr>
              </thead>
              <tbody>
                {orderList.map((order) => {
                  const status = orderStatusClasses[order.status];
                  return (
                    <tr key={order.id} className="border-t border-[#E4DDD5]">
                      <td className="px-[14px] py-[12px] font-semibold">
                        {order.id}
                      </td>
                      <td className="px-[14px] py-[12px]">{order.client}</td>
                      <td className="px-[14px] py-[12px]">{order.date}</td>
                      <td className="px-[14px] py-[12px]">{zoneLabel(order.zone)}</td>
                      <td className="px-[14px] py-[12px]">
                        <span
                          className="inline-block rounded-full px-[10px] py-[3px] text-[10px] font-bold"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-[14px] py-[12px]">{order.total}</td>
                      <td className="px-[14px] py-[12px]">
                        <button
                          type="button"
                          onClick={() => void openOrder(order)}
                          className="text-[11px] font-bold text-[#D2531E]"
                        >
                          Voir / modifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {focusedOrder && (
            <div className="mt-4 rounded-[8px] border border-[#E4DDD5] bg-white p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{focusedOrder.reference}</h2><button type="button" onClick={() => setFocusedOrder(null)} aria-label="Fermer">×</button></div>
              <p className="mb-3 text-sm">{focusedOrder.items?.map((item) => `${item.productNameFr} × ${item.quantity} (taille ${item.size})`).join(", ")}</p>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold">Statut<select value={focusedOrder.status} onChange={(event) => {
                  const order = adminOrders.find((item) => item.uuid === focusedOrder.id);
                  if (!order) return;
                  const nextStatus = event.target.value;
                  void changeOrderStatus(order, nextStatus).then((saved) => {
                    if (saved) setFocusedOrder((current) => current ? { ...current, status: nextStatus } : current);
                  });
                }} className="mt-1 block rounded border border-[#E4DDD5] px-2 py-2">
                  <option value={focusedOrder.status}>{focusedOrder.status}</option>
                  {(focusedOrder.status === "PENDING" ? ["CONFIRMED", "CANCELLED"] : focusedOrder.status === "CONFIRMED" ? ["PREPARING", "CANCELLED"] : focusedOrder.status === "PREPARING" ? ["SHIPPED", "CANCELLED"] : focusedOrder.status === "SHIPPED" ? ["DELIVERED"] : []).map((status) => <option key={status} value={status}>{status}</option>)}
                </select></label>
                <label className="min-w-[240px] flex-1 text-xs font-semibold">Note interne<textarea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} rows={2} className="mt-1 block w-full rounded border border-[#E4DDD5] p-2" /></label>
                <button type="button" onClick={() => { const order = adminOrders.find((item) => item.uuid === focusedOrder.id); if (order) void saveOrderNote(order); }} className="rounded bg-[#14120F] px-4 py-2 text-sm font-semibold text-white">Enregistrer la note</button>
              </div>
              {adminError && <p role="alert" className="text-sm text-red-700">{adminError}</p>}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "products") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Produits
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                {products.length} produits au catalogue
              </div>
            </div>
            <button
              type="button"
              onClick={createProduct}
              className="rounded-[6px] bg-[#D2531E] px-4 py-[9px] text-[12.5px] font-bold text-white hover:bg-[#A83E14]"
            >
              + Nouveau produit
            </button>
          </div>

          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProductView("catalog")}
                className={`rounded-[6px] border px-[14px] py-[7px] text-[11.5px] font-semibold ${productView === "catalog" ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
              >
                Catalogue
              </button>
              <button
                type="button"
                onClick={createProduct}
                className={`rounded-[6px] border px-[14px] py-[7px] text-[11.5px] font-semibold ${productView === "new" ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
              >
                Nouveau produit
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tous"],
                  ["active", "Actifs"],
                  ["draft", "Brouillons"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProductFilter(value)}
                  className={`rounded-[6px] border px-[12px] py-[7px] text-[11px] font-semibold ${productFilter === value ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {productView === "catalog" ? (
            <div className="overflow-hidden rounded-[10px] border border-[#E4DDD5] bg-white">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F3ECE6]">
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]" />
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Produit
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Catégorie
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Prix
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Statut
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]" />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`border-t border-[#E4DDD5] ${selectedProductId === product.id ? "bg-[#F3ECE6]" : ""}`}
                    >
                      <td className="px-[14px] py-[12px]">
                        <div className="h-[36px] w-[36px] rounded-[6px] bg-gradient-to-br from-[#3a2c22] to-[#171310] bg-cover bg-center" style={product.images[0] ? { backgroundImage: `url(${JSON.stringify(resolveMediaUrl(product.images[0]))})` } : undefined} />
                      </td>
                      <td className="px-[14px] py-[12px] font-bold">
                        {product.name}
                      </td>
                      <td className="px-[14px] py-[12px]">
                        {product.category}
                      </td>
                      <td className="px-[14px] py-[12px]">{product.price}</td>
                      <td className="px-[14px] py-[12px]">
                        <span
                          className={`inline-block rounded-full px-[10px] py-[3px] text-[10px] font-bold ${product.status === "active" ? "bg-[#e8f0ea] text-[#3f6b4a]" : "bg-[#eee] text-[#777]"}`}
                        >
                          {product.status === "active" ? "Actif" : "Brouillon"}
                        </span>
                      </td>
                      <td className="px-[14px] py-[12px]">
                        <button
                          type="button"
                          onClick={() => selectProduct(product.id)}
                          className="text-[11px] font-bold text-[#D2531E]"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteProduct(product)}
                          className="ml-3 text-[11px] font-bold text-[#a13b2f]"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">
              <div className="rounded-[10px] border border-[#E4DDD5] bg-white p-5">
                <div className="mb-4 text-[13.5px] font-semibold">
                  Informations produit
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Photos
                  </label>
                  <label
                    className="mb-3 block cursor-pointer rounded-[8px] border-2 border-dashed border-[#E4DDD5] p-[20px] text-center text-[12px] text-[#8a8378]"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); void handleProductFiles(event.dataTransfer.files); }}
                  >
                    <i className="fa-solid fa-arrow-up-from-bracket mr-2" /> Sélectionnez ou déposez vos images ici (JPEG, PNG, WebP, 5 Mo max.)
                    <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { if (event.target.files) void handleProductFiles(event.target.files); event.currentTarget.value = ""; }} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedProduct?.images ?? []).map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="relative size-[60px] overflow-hidden rounded-[6px] border border-[#E4DDD5]">
                        <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(resolveMediaUrl(imageUrl))})` }} />
                        <button type="button" aria-label="Retirer l'image" onClick={() => updateSelectedProduct("images", selectedProduct.images.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-0 top-0 bg-black/70 px-1 text-white">×</button>
                        {index === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-[8px] text-white">Principale</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">Nom en anglais</label>
                  <input type="text" value={selectedProduct?.nameEn ?? ""} onChange={(event) => updateSelectedProduct("nameEn", event.target.value)} className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]" />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Nom du produit
                  </label>
                  <input
                    type="text"
                    value={selectedProduct?.name ?? ""}
                    onChange={(event) =>
                      updateSelectedProduct("name", event.target.value)
                    }
                    className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                  />
                </div>

                <div className="mb-4">
                  <div className="mb-2 flex gap-2">
                    {(["fr", "en"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setProductLang(lang)}
                        className={`rounded-[6px] border px-[12px] py-[5px] text-[10.5px] font-bold ${productLang === lang ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                      >
                        Description ({lang === "fr" ? "FR" : "EN"})
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                    value={productLang === "fr" ? selectedProduct?.description ?? "" : selectedProduct?.descriptionEn ?? ""}
                    onChange={(event) => updateSelectedProduct(productLang === "fr" ? "description" : "descriptionEn", event.target.value)}
                  />
                </div>

                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                      Catégorie
                    </label>
                    <select
                      value={selectedProduct?.category ?? "Homme"}
                      onChange={(event) =>
                        updateSelectedProduct("category", event.target.value)
                      }
                      className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                    >
                      <option value="Homme">Homme</option>
                      <option value="Femme">Femme</option>
                      <option value="Nouveautes">Nouveautés</option>
                      <option value="Couple-Enfant">Couple / enfant</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                      Statut
                    </label>
                    <div className="flex gap-2">
                      {(["active", "draft", "out"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            updateSelectedProduct("status", status)
                          }
                          className={`rounded-[6px] border px-[13px] py-[7px] text-[11px] font-bold ${selectedProduct?.status === status ? "border-[#14120F] bg-[#F3ECE6] text-[#14120F]" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                        >
                          {statusChipLabels[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                      Prix
                    </label>
                    <input
                      type="text"
                      value={selectedProduct?.price ?? ""}
                      onChange={(event) =>
                        updateSelectedProduct("price", event.target.value)
                      }
                      className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                      Prix barré (optionnel)
                    </label>
                    <input
                      type="text"
                      value={selectedProduct?.compareAtPrice ?? ""}
                      onChange={(event) => updateSelectedProduct("compareAtPrice", event.target.value)}
                      placeholder="—"
                      className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Couleurs disponibles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["#161616", "#8B4A2B", "#D2531E"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateSelectedProduct("color", color)}
                        className={`h-[24px] w-[24px] rounded-full border-2 ${selectedProduct?.color === color ? "border-[#14120F]" : "border-white"} shadow-[0_0_0_1px_#E4DDD5]`}
                        style={{ background: color }}
                      />
                    ))}
                    <button
                      type="button"
                      className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-dashed border-[#E4DDD5] bg-white text-[13px] text-[#8a8378]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Personnalisation
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 py-[9px] text-[12.5px]">
                      <span>Couleur personnalisable sur demande</span>
                      <button
                        type="button"
                        onClick={() => { const customizableColor = !showToggles.customizableColor; setShowToggles((state) => ({ ...state, customizableColor })); updateSelectedProduct("customizableColor", customizableColor); }}
                        className={`relative h-[21px] w-[38px] rounded-full ${showToggles.customizableColor ? "bg-[#D2531E]" : "bg-[#E4DDD5]"}`}
                      >
                        <span
                          className={`absolute top-[2px] h-[17px] w-[17px] rounded-full bg-white transition-all ${showToggles.customizableColor ? "left-[19px]" : "left-[2px]"}`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-[9px] text-[12.5px]">
                      <span>Matière personnalisable sur demande</span>
                      <button
                        type="button"
                        onClick={() => { const customizableMaterial = !showToggles.customizableMaterial; setShowToggles((state) => ({ ...state, customizableMaterial })); updateSelectedProduct("customizableMaterial", customizableMaterial); }}
                        className={`relative h-[21px] w-[38px] rounded-full ${showToggles.customizableMaterial ? "bg-[#D2531E]" : "bg-[#E4DDD5]"}`}
                      >
                        <span
                          className={`absolute top-[2px] h-[17px] w-[17px] rounded-full bg-white transition-all ${showToggles.customizableMaterial ? "left-[19px]" : "left-[2px]"}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Tailles disponibles pour ce produit
                  </label>
                  <div className="flex flex-wrap gap-[7px]">
                    {availableSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`rounded-[6px] border px-[12px] py-[6px] text-[11.5px] ${(selectedProduct?.sizes ?? []).includes(size) ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {selectedProduct && selectedProduct.id !== "new" && selectedProduct.sizes.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 text-[10.5px] text-[#8a8378]">Disponibilité immédiate (cliquez pour passer une taille en rupture)</div>
                      <div className="flex flex-wrap gap-[7px]">
                        {selectedProduct.sizes.map((size) => {
                          const available = sizeAvailability[size] ?? true;
                          return (
                            <button key={size} type="button" onClick={() => void toggleSizeAvailability(size)} className={`rounded-[6px] border px-[10px] py-[5px] text-[11px] ${available ? "border-[#3f6b4a] bg-[#e8f0ea] text-[#3f6b4a]" : "border-[#a13b2f] bg-[#f6e6e3] text-[#a13b2f] line-through"}`}>
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={savingProduct}
                    onClick={() => void saveProduct("draft")}
                    className="rounded-[6px] border border-[#E4DDD5] bg-white px-4 py-[9px] text-[12.5px] font-bold text-[#14120F] hover:bg-[#F3ECE6] disabled:opacity-50"
                  >
                    {savingProduct ? "Enregistrement..." : "Enregistrer le brouillon"}
                  </button>
                  <button
                    type="button"
                    disabled={savingProduct}
                    onClick={() => void saveProduct("active")}
                    className="rounded-[6px] bg-[#D2531E] px-4 py-[9px] text-[12.5px] font-bold text-white hover:bg-[#A83E14] disabled:opacity-50"
                  >
                    Publier
                  </button>
                </div>
                {productMessage && <p className="mt-3 text-[12px] text-[#8a8378]" role="status">{productMessage}</p>}
              </div>

              <div className="rounded-[10px] border border-[#E4DDD5] bg-white p-5">
                <div className="mb-4 text-[13.5px] font-semibold">
                  Aperçu en temps réel
                </div>
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setProductPreviewTab("card")}
                    className={`rounded-[6px] border px-[12px] py-[7px] text-[11.5px] font-semibold ${productPreviewTab === "card" ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                  >
                    Carte catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductPreviewTab("pdp")}
                    className={`rounded-[6px] border px-[12px] py-[7px] text-[11.5px] font-semibold ${productPreviewTab === "pdp" ? "border-[#14120F] bg-[#14120F] text-white" : "border-[#E4DDD5] bg-white text-[#14120F]"}`}
                  >
                    Fiche produit
                  </button>
                </div>
                <div className="mb-3 text-[10.5px] italic text-[#8a8378]">
                  Utilise les vrais composants du site public
                </div>

                {productPreviewTab === "card" ? (
                  <div className="mx-auto w-[220px] overflow-hidden rounded-[8px] border border-[#E4DDD5] bg-white">
                    <div className="h-[150px] bg-linear-to-br from-[#3a2c22] to-[#171310]" />
                    <div className="p-[12px]">
                      <div className="font-(--font-fraunces) text-[13.5px] font-semibold">
                        Multicolore Black and White
                      </div>
                      <div className="mt-[2px] text-[11.5px] text-[#8a8378]">
                        6 500 FCFA
                      </div>
                      <div className="mt-2 flex gap-[5px]">
                        {[
                          selectedProduct?.color ?? "#161616",
                          "#8B4A2B",
                          "#D2531E",
                        ].map((color) => (
                          <span
                            key={color}
                            className="h-[12px] w-[12px] rounded-full border border-[#E4DDD5]"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <div className="h-[190px] w-[170px] shrink-0 rounded-[8px] bg-linear-to-br from-[#3a2c22] to-[#171310]" />
                    <div>
                      <div className="font-(--font-fraunces) text-[16px] font-semibold">
                        {selectedProduct?.name ?? "Produit"}
                      </div>
                      <div className="mt-[6px] text-[14px] font-bold text-[#14120F]">
                        {selectedProduct?.price ?? "6 500 FCFA"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-[5px]">
                        {(selectedProduct?.sizes ?? []).map((size) => (
                          <span
                            key={size}
                            className="rounded-[4px] border border-[#E4DDD5] px-[7px] py-[3px] text-[9px]"
                          >
                            {size}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 inline-block rounded-[6px] bg-[#D2531E] px-[16px] py-[8px] text-[10px] font-bold text-white">
                        Ajouter au panier
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "customers") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Clients
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                {customersTotal} comptes créés
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[10px] border border-[#E4DDD5] bg-white">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3ECE6]">
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Client
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Téléphone
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Connexion
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Commandes
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Dernière commande
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[#E4DDD5]">
                    <td className="px-[14px] py-[12px] font-bold">{customer.name || customer.email || "—"}</td>
                    <td className="px-[14px] py-[12px]">{customer.phone ?? "—"}</td>
                    <td className="px-[14px] py-[12px]">{providerLabels[customer.provider] ?? customer.provider}</td>
                    <td className="px-[14px] py-[12px]">{customer.orderCount}</td>
                    <td className="px-[14px] py-[12px]">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}</td>
                  </tr>
                ))}
                {!customers.length && (
                  <tr className="border-t border-[#E4DDD5]"><td colSpan={5} className="px-[14px] py-[12px] text-[#8a8378]">Aucun client pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "delivery") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Zones de livraison
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                Pilote les frais, délais et moyens de paiement affichés au
                checkout
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeliveryForm((current) => !current)}
              className="rounded-[6px] bg-[#D2531E] px-4 py-[9px] text-[12.5px] font-bold text-white hover:bg-[#A83E14]"
            >
              + Ajouter une zone
            </button>
          </div>

          {showDeliveryForm && (
            <div className="mb-5 rounded-[10px] border border-[#E4DDD5] bg-white p-5">
              <div className="mb-4 text-[13.5px] font-semibold">
                Nouvelle zone
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["country", "Pays"],
                    ["regionOrCity", "Région ou ville"],
                    ["feeFcfa", "Frais (FCFA)"],
                    ["etaMinHours", "Délai min. (heures)"],
                    ["etaMaxHours", "Délai max. (heures)"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="text-[11px] font-bold text-[#8a8378]"
                  >
                    {label}
                    <input
                      value={deliveryForm[field]}
                      onChange={(event) =>
                        setDeliveryForm((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] font-normal text-[#14120F] outline-none focus:border-[#D2531E]"
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-[12px] font-semibold text-[#14120F]">
                  <input
                    type="checkbox"
                    checked={deliveryForm.codAvailable}
                    onChange={(event) =>
                      setDeliveryForm((current) => ({
                        ...current,
                        codAvailable: event.target.checked,
                      }))
                    }
                  />{" "}
                  Paiement à la livraison
                </label>
              </div>
              <button
                type="button"
                onClick={createDeliveryZone}
                className="mt-4 rounded-[6px] bg-[#D2531E] px-4 py-[9px] text-[12px] font-bold text-white"
              >
                Enregistrer
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-[10px] border border-[#E4DDD5] bg-white">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3ECE6]">
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Zone
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Frais
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Délai
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Paiement à la livraison
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Moyens de paiement
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliveryZones.map((zone) => (
                  <tr
                    key={zone.id}
                    className="border-t border-[#E4DDD5] align-top"
                  >
                    <td className="px-[14px] py-[12px]">
                      <div className="font-bold">
                        {zone.regionOrCity || "Toutes zones"}
                      </div>
                      <div className="text-[11px] text-[#8a8378]">
                        {zone.country}
                      </div>
                    </td>
                    <td className="px-[14px] py-[12px]">
                      {zone.feeFcfa.toLocaleString("fr-FR")}f
                    </td>
                    <td className="px-[14px] py-[12px]">
                      {zone.etaMinHours}–{zone.etaMaxHours}h
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <span
                        className={`inline-block rounded-full px-[10px] py-[3px] text-[10px] font-bold ${zone.codAvailable ? "bg-[#e8f0ea] text-[#3f6b4a]" : "bg-[#f6e6e3] text-[#a13b2f]"}`}
                      >
                        {zone.codAvailable ? "Oui" : "Non"}
                      </span>
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <div className="flex flex-wrap gap-[4px]">
                        {zone.paymentMethods.map((method) => (
                          <span
                            key={method}
                            className="inline-block rounded-full border border-[#E4DDD5] bg-[#F3ECE6] px-[9px] py-[2px] text-[10px]"
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <button
                        type="button"
                        onClick={() => toggleDeliveryZone(zone)}
                        className={`relative h-[21px] w-[38px] rounded-full ${zone.active ? "bg-[#D2531E]" : "bg-[#E4DDD5]"}`}
                      >
                        <span
                          className={`absolute top-[2px] h-[17px] w-[17px] rounded-full bg-white transition-all ${zone.active ? "left-[19px]" : "left-[2px]"}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDeliveryZone(zone.id)}
                        className="ml-3 text-[11px] font-bold text-[#a13b2f]"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deliveryZones.length === 0 && (
              <div className="p-8 text-center text-[12px] text-[#8a8378]">
                Aucune zone de livraison configurée.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "payment") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Paiement
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                Agrégateurs connectés et disponibilité par zone
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            {paymentProviders.map((provider) => (
              <div key={provider.id} className="rounded-[10px] border border-[#E4DDD5] bg-white p-[18px]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-(--font-fraunces) text-[15px] font-semibold">{provider.name}</span>
                  <span className={`inline-block rounded-full px-[10px] py-[3px] text-[10px] font-bold ${provider.status === "live" ? "bg-[#e8f0ea] text-[#3f6b4a]" : provider.status === "demo" ? "bg-[#f6efdf] text-[#a6741f]" : "bg-[#eee] text-[#666]"}`}>
                    {providerStatusLabels[provider.status]}
                  </span>
                </div>
                <div className="mb-2 text-[11.5px] text-[#8a8378]">{provider.description}</div>
                {provider.id === "campay" && (
                  <ul className="text-[11px] text-[#8a8378]">
                    <li>Webhook : {provider.webhookConfigured ? "configuré" : "non configuré"}</li>
                    {provider.maxAmountXaf ? <li>Montant plafonné à {provider.maxAmountXaf} XAF par transaction (compte demo)</li> : null}
                  </ul>
                )}
              </div>
            ))}
            {!paymentProviders.length && <div className="text-[12px] text-[#8a8378]">Chargement des fournisseurs…</div>}
          </div>

          <div className="rounded-[10px] border border-[#E4DDD5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E4DDD5] px-[18px] py-[14px]">
              <h3 className="text-[13.5px] font-semibold">
                Disponibilité par zone
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab("delivery")}
                className="text-[11px] font-bold text-[#D2531E]"
              >
                Gérer les zones →
              </button>
            </div>
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3ECE6]">
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Zone
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                    Moyens actifs
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliveryZones.map((zone) => (
                  <tr key={zone.id} className="border-t border-[#E4DDD5]">
                    <td className="px-[14px] py-[12px]">{zone.regionOrCity || zone.country}{zone.active ? "" : " (inactive)"}</td>
                    <td className="px-[14px] py-[12px]">
                      <div className="flex flex-wrap gap-[4px]">
                        {zone.paymentMethods.map((method) => (
                          <span key={method} className="inline-block rounded-full border border-[#E4DDD5] bg-[#F3ECE6] px-[9px] py-[2px] text-[10px]">
                            {paymentMethodLabels[method] ?? method}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "reviews") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Avis clients
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">{adminReviews.length} avis en attente de modération</div>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#E4DDD5] bg-white">
            <div className="p-[18px]">
              {adminReviews.map((review) => (
                <div
                  key={review.id}
                  className="flex flex-col gap-3 border-b border-[#E4DDD5] py-[14px] last:border-0 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex-1">
                    <div className="text-[12px] text-[#D2531E]">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </div>
                    <div className="mt-1 text-[12.5px]">
                      « {review.comment} »
                    </div>
                    <div className="mt-2 text-[10.5px] text-[#8a8378]">
                      {products.find((product) => product.id === review.productId)?.name ?? review.productId} · {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="flex gap-2 md:shrink-0">
                    <button
                      type="button"
                      onClick={() => void moderateReview(review, "approved")}
                      className="rounded-[6px] bg-[#D2531E] px-[12px] py-[7px] text-[11px] font-bold text-white"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => void moderateReview(review, "hidden")}
                      className="rounded-[6px] border border-[#E4DDD5] bg-white px-[12px] py-[7px] text-[11px] font-bold text-[#14120F]"
                    >
                      Masquer
                    </button>
                  </div>
                </div>
              ))}
              {adminReviews.length === 0 && <p className="py-6 text-center text-sm text-[#8a8378]">Aucun avis en attente.</p>}
              {adminError && <p role="alert" className="text-sm text-red-700">{adminError}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "content") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Contenu &amp; traductions
              </h1>
              <div className="mt-1 text-[12px] text-[#8a8378]">
                Pages de contenu du site, en français et anglais
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setEditingContent({ id: "", slug: "", titleFr: "", titleEn: "", bodyFr: "", bodyEn: "" })} className="rounded-[6px] bg-[#D2531E] px-4 py-2 text-sm font-semibold text-white">Créer une page</button>
          </div>
          {editingContent && <div className="mb-4 rounded-[8px] border border-[#E4DDD5] bg-white p-5"><h2 className="mb-4 font-semibold">Page de contenu</h2><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Slug<input value={editingContent.slug} onChange={(event) => setEditingContent({ ...editingContent, slug: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs font-semibold">Titre FR<input value={editingContent.titleFr} onChange={(event) => setEditingContent({ ...editingContent, titleFr: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs font-semibold">Titre EN<input value={editingContent.titleEn ?? ""} onChange={(event) => setEditingContent({ ...editingContent, titleEn: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs font-semibold">Corps FR<textarea rows={5} value={editingContent.bodyFr} onChange={(event) => setEditingContent({ ...editingContent, bodyFr: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs font-semibold">Corps EN<textarea rows={5} value={editingContent.bodyEn ?? ""} onChange={(event) => setEditingContent({ ...editingContent, bodyEn: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => void saveContentPage()} className="rounded bg-[#14120F] px-4 py-2 text-sm font-semibold text-white">Enregistrer</button><button type="button" onClick={() => setEditingContent(null)} className="rounded border px-4 py-2 text-sm">Annuler</button></div>{adminError && <p role="alert" className="mt-2 text-sm text-red-700">{adminError}</p>}</div>}
          <div className="rounded-[10px] border border-[#E4DDD5] bg-white">
            <div className="p-[18px]">
              {contentPages.map((page) => (
                <div
                  key={page.id}
                  className="flex flex-col gap-3 border-b border-[#E4DDD5] py-[14px] last:border-0 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-[13px] font-bold">
                      {page.titleFr}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <span
                        className={`inline-block rounded-full px-[8px] py-[2px] text-[9.5px] ${page.bodyFr ? "bg-[#e8f0ea] text-[#3f6b4a]" : "bg-[#f6e6e3] text-[#a13b2f]"}`}
                      >
                        FR {page.bodyFr ? "✓" : "à compléter"}
                      </span>
                      <span
                        className={`inline-block rounded-full px-[8px] py-[2px] text-[9.5px] ${page.bodyEn ? "bg-[#e8f0ea] text-[#3f6b4a]" : "bg-[#f6e6e3] text-[#a13b2f]"}`}
                      >
                        EN {page.bodyEn ? "✓" : "à compléter"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingContent(page)}
                    className="rounded-[6px] border border-[#E4DDD5] bg-white px-[12px] py-[7px] text-[11px] font-bold text-[#14120F]"
                  >
                    Éditer
                  </button>
                </div>
              ))}
              {contentPages.length === 0 && <p className="py-6 text-center text-sm text-[#8a8378]">Aucune page de contenu enregistrée.</p>}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "settings") {
      return (
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">
                Paramètres
              </h1>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-[14px] font-semibold">
              Informations boutique
            </h3>
            <div className="rounded-[10px] border border-[#E4DDD5] bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Nom de la boutique
                  </label>
                  <input
                    type="text"
                    value={storeSettings?.storeName ?? ""}
                    onChange={(event) => setStoreSettings((current) => (current ? { ...current, storeName: event.target.value } : current))}
                    className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                    Téléphone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={storeSettings?.phone ?? ""}
                    onChange={(event) => setStoreSettings((current) => (current ? { ...current, phone: event.target.value } : current))}
                    className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {(["whatsapp", "instagram", "facebook"] as const).map((key) => (
                  <div key={key}>
                    <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">{key === "whatsapp" ? "Numéro WhatsApp" : key === "instagram" ? "Lien Instagram" : "Lien Facebook"}</label>
                    <input type="text" value={storeSettings?.[key] ?? ""} onChange={(event) => setStoreSettings((current) => (current ? { ...current, [key]: event.target.value } : current))} className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]" />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                  Adresse
                </label>
                <input
                  type="text"
                  value={storeSettings?.address ?? ""}
                    onChange={(event) => setStoreSettings((current) => (current ? { ...current, address: event.target.value } : current))}
                  className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={() => void saveStoreSettings()} className="rounded-[6px] bg-[#D2531E] px-4 py-[9px] text-[12.5px] font-bold text-white hover:bg-[#A83E14]">
                  Enregistrer
                </button>
                {settingsMessage && <span className="text-[12px] text-[#8a8378]" role="status">{settingsMessage}</span>}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-[14px] font-semibold">
              Utilisateurs &amp; rôles
            </h3>
            <div className="overflow-hidden rounded-[10px] border border-[#E4DDD5] bg-white">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F3ECE6]">
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Nom
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Rôle
                    </th>
                    <th className="px-[14px] py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8a8378]">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[#E4DDD5]">
                      <td className="px-[14px] py-[12px]">{user.name || "—"}</td>
                      <td className="px-[14px] py-[12px]">
                        <select value={user.role} onChange={(event) => void changeUserRole(user, event.target.value as UserRole)} className="rounded-[6px] border border-[#E4DDD5] bg-white px-2 py-1 text-[12px]">
                          {(Object.keys(roleLabels) as UserRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                        </select>
                      </td>
                      <td className="px-[14px] py-[12px]">{user.email || user.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[14px] font-semibold">
              Langue &amp; cookies
            </h3>
            <div className="rounded-[10px] border border-[#E4DDD5] bg-white p-5">
              <div className="mb-4">
                <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                  Langue par défaut du site
                </label>
                <select className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]">
                  <option>Français</option>
                  <option>English</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#8a8378]">
                  Texte de la bannière cookies (FR)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]"
                >
                  Nous utilisons des cookies pour améliorer votre expérience…
                </textarea>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="min-h-screen bg-[#FCF7F8] text-[#14120F]"
      style={{ fontFamily: "var(--font-archivo), sans-serif" }}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col bg-[#000000] text-[#FCF7F8] transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <div className="font-(--font-fraunces) text-[17px] font-semibold tracking-[-0.01em]">
              KEMI<span className="text-[#D2531E]">·</span>SHOES
            </div>
            <div className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/45">
              Admin
            </div>
          </div>

          <div className="px-2.5 py-3.5">
            {tabsConfig.slice(0, 4).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2.5 text-[12.5px] font-medium transition ${activeTab === tab.id ? "bg-[#D2531E] text-white font-bold" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="w-4 text-center text-xs">
                  <i className={tab.iconClass} />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="px-2.5 pt-3.5 pb-1">
            <div className="px-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/40">
              Configuration
            </div>
            {tabsConfig.slice(4).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2.5 text-[12.5px] font-medium transition ${activeTab === tab.id ? "bg-[#D2531E] text-white font-bold" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="w-4 text-center text-xs">
                  <i className={tab.iconClass} />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-white/10 px-5 py-3.5 text-[10.5px] text-white/40">
            KEMI SHOES © 2026
            <div className="mt-1">Nexa Digital Lab</div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E4DDD5] bg-white px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((state) => !state)}
                className="block text-[18px] text-[#14120F] lg:hidden"
              >
                <i className="fa-solid fa-bars" />
              </button>
              <div className="hidden w-[260px] items-center gap-2 rounded-[6px] border border-[#E4DDD5] bg-white px-[14px] py-[8px] text-[12.5px] text-[#8a8378] md:flex">
                <i className="fa-solid fa-magnifying-glass text-[12px]" />
                <span>Rechercher…</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="relative text-[15px]">
                <i className="fa-solid fa-bell" />
                <span className="absolute -right-1 -top-1 h-[6px] w-[6px] rounded-full bg-[#D2531E]" />
              </span>
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#14120F] text-[12px] font-bold text-white">
                D
              </div>
            </div>
          </header>

          <main>{renderPage()}</main>
        </div>
      </div>
    </div>
  );
}
