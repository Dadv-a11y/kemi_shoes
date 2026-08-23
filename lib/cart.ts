export type CartItem = {
  id: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  material: string;
  price: number;
  image: string;
  quantity: number;
};

export const CART_COOKIE = "kemi-cart";
export const PREFERENCES_COOKIE = "kemi-preferences";
export const CART_UPDATED_EVENT = "kemi-cart-updated";

function readCookie<T>(name: string, fallback: T): T {
  if (typeof document === "undefined") return fallback;
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))?.split("=")[1];
  if (!value) return fallback;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return fallback;
  }
}

function writeCookie(name: string, value: unknown) {
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=31536000; samesite=lax`;
}

export function getCart() {
  return readCookie<CartItem[]>(CART_COOKIE, []);
}

export function saveCart(items: CartItem[]) {
  writeCookie(CART_COOKIE, items);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addToCart(item: Omit<CartItem, "id" | "quantity">, quantity: number) {
  const items = getCart();
  const id = `${item.slug}:${item.size}:${item.color}:${item.material}`;
  const existing = items.find((cartItem) => cartItem.id === id);
  if (existing) existing.quantity += quantity;
  else items.push({ ...item, id, quantity });
  saveCart(items);
}

export function savePreferences(preferences: { size: string; color: string; material: string }) {
  writeCookie(PREFERENCES_COOKIE, preferences);
}