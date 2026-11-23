import type {
  Address,
  Order,
  PaymentMethod,
  Product,
  PublicTrackingInfo,
  UserProfile,
} from '../types.ts';

let memoryAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryAuthToken = token;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryAuthToken) {
    headers['Authorization'] = `Bearer ${memoryAuthToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export interface ProductQueryParams {
  q?: string;
  category?: string;
  brands?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number;
  inStockOnly?: boolean;
  sort?: string;
}

export async function fetchProducts(params: ProductQueryParams): Promise<{ products: Product[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.category && params.category !== 'All') sp.set('category', params.category);
  if (params.brands && params.brands.length > 0) sp.set('brand', params.brands.join(','));
  if (params.minPrice !== null && params.minPrice !== undefined) sp.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== null && params.maxPrice !== undefined) sp.set('maxPrice', String(params.maxPrice));
  if (params.minRating && params.minRating > 0) sp.set('minRating', String(params.minRating));
  if (params.inStockOnly) sp.set('inStock', 'true');
  if (params.sort) sp.set('sort', params.sort);

  const qs = sp.toString();
  return apiFetch<{ products: Product[]; total: number }>(`/api/products${qs ? `?${qs}` : ''}`);
}

export async function getCurrentUser(): Promise<{ user: UserProfile | null }> {
  return apiFetch<{ user: UserProfile | null }>('/api/auth/me');
}

export async function registerAccount(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ user: UserProfile; token: string }> {
  const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(res.token);
  return res;
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile; token: string }> {
  const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(res.token);
  return res;
}

export async function logoutAccount(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  setAuthToken(null);
}

export async function addAddress(address: Omit<Address, 'id'>): Promise<{ user: UserProfile; address: Address }> {
  return apiFetch<{ user: UserProfile; address: Address }>('/api/account/addresses', {
    method: 'POST',
    body: JSON.stringify(address),
  });
}

export async function deleteAddress(addressId: string): Promise<{ user: UserProfile }> {
  return apiFetch<{ user: UserProfile }>(`/api/account/addresses/${encodeURIComponent(addressId)}`, {
    method: 'DELETE',
  });
}

export async function toggleWishlistItem(productId: string): Promise<{ user: UserProfile }> {
  return apiFetch<{ user: UserProfile }>('/api/account/wishlist/toggle', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export async function fetchOrders(): Promise<{ orders: Order[] }> {
  return apiFetch<{ orders: Order[] }>('/api/orders');
}

export async function placeDemoOrder(payload: {
  items: { productId: string; variant: string; quantity: number }[];
  address: Omit<Address, 'id'> & { id?: string };
  paymentMethod: PaymentMethod;
  paymentSummary: string;
  promoCode?: string;
}): Promise<{ order: Order }> {
  return apiFetch<{ order: Order }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function trackShipment(trackingNumber: string): Promise<{ tracking: PublicTrackingInfo }> {
  return apiFetch<{ tracking: PublicTrackingInfo }>(
    `/api/orders/track/${encodeURIComponent(trackingNumber.trim())}`
  );
}

export async function advanceOrderStage(orderId: string): Promise<{ order: Order }> {
  return apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}/advance-tracking`, {
    method: 'POST',
  });
}
