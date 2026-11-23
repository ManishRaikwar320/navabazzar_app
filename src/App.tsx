import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATALOG_PRODUCTS } from './data/catalog.ts';
import {
  fetchOrders,
  fetchProducts,
  getCurrentUser,
  toggleWishlistItem,
} from './lib/api.ts';
import type { CartItem, FilterState, Order, Product, UserProfile } from './types.ts';
import { AccountView } from './components/AccountView.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { CheckoutView } from './components/CheckoutView.tsx';
import { Footer } from './components/Footer.tsx';
import { Header, type AppView } from './components/Header.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { MyOrdersView } from './components/MyOrdersView.tsx';
import { OrderTrackingView } from './components/OrderTrackingView.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';

const INITIAL_FILTERS: FilterState = {
  search: '',
  category: 'All',
  brands: [],
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  inStockOnly: false,
  sort: 'featured',
};

const CART_STORAGE_KEY = 'navabazaar_cart_v1';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('store');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>(CATALOG_PRODUCTS);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore invalid storage
    }
    return [];
  });

  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [trackingLookupId, setTrackingLookupId] = useState<string>('NB-DEMO-2026');
  const [toast, setToast] = useState<string | null>(null);

  const allBrands = useMemo(
    () => Array.from(new Set(CATALOG_PRODUCTS.map((p) => p.brand))).sort(),
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3200);
  }, []);

  // Persist non-sensitive cart items locally
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  // Restore active user session on boot
  useEffect(() => {
    getCurrentUser()
      .then((res) => {
        if (res.user) setUser(res.user);
      })
      .catch(() => {
        // visitor mode
      });
  }, []);

  // Fetch user's orders whenever signed-in user changes
  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      return;
    }
    setOrdersLoading(true);
    fetchOrders()
      .then((res) => setUserOrders(res.orders))
      .catch(() => setUserOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user]);

  // Fetch filtered products from backend API
  useEffect(() => {
    let cancelled = false;
    setLoadingProducts(true);
    setProductsError(null);

    const timer = window.setTimeout(() => {
      fetchProducts({
        q: filters.search,
        category: filters.category,
        brands: filters.brands,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        inStockOnly: filters.inStockOnly,
        sort: filters.sort,
      })
        .then((res) => {
          if (!cancelled) setProducts(res.products);
        })
        .catch((err) => {
          if (!cancelled) {
            setProductsError(err instanceof Error ? err.message : 'Unable to load products.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingProducts(false);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters]);

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product: Product, variant: string) => {
    if (!product.inStock) return;
    setCartItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && i.variant === variant
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id && i.variant === variant
            ? { ...i, quantity: Math.min(10, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { productId: product.id, variant, quantity: 1 }];
    });
    showToast(`Added ${product.name} to bag`);
  };

  const handleBuyNow = (product: Product, variant: string) => {
    handleAddToCart(product, variant);
    setSelectedProduct(null);
    setCartOpen(false);
    handleNavigate('checkout');
  };

  const handleUpdateQty = (productId: string, variant: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.productId === productId && item.variant === variant
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (productId: string, variant: string) => {
    setCartItems((prev) =>
      prev.filter((item) => !(item.productId === productId && item.variant === variant))
    );
  };

  const handleToggleWishlist = async (productId: string) => {
    if (!user) {
      showToast('Sign in or create an account to save wishlist items');
      handleNavigate('account');
      return;
    }
    try {
      const res = await toggleWishlistItem(productId);
      setUser(res.user);
      const saved = res.user.wishlist.includes(productId);
      showToast(saved ? 'Saved to your wishlist' : 'Removed from wishlist');
    } catch {
      showToast('Could not update wishlist');
    }
  };

  const handleOrderPlaced = (order: Order) => {
    setCartItems([]);
    setAppliedPromo('');
    setUserOrders((prev) => [order, ...prev]);
    setTrackingLookupId(order.trackingNumber);
    showToast(`Order ${order.trackingNumber} confirmed`);
    handleNavigate('track');
  };

  const handleOrderUpdated = (updated: Order) => {
    setUserOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    showToast(`Shipment updated: ${updated.orderStatus}`);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeView={activeView}
        onNavigate={handleNavigate}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        user={user}
      />

      <main className="flex-1">
        {activeView === 'store' && (
          <>
            <HeroSection
              onBrowseCatalog={() => {
                document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onTrackOrder={() => handleNavigate('track')}
            />
            <CatalogView
              products={products}
              loading={loadingProducts}
              error={productsError}
              filters={filters}
              allBrands={allBrands}
              wishlist={user?.wishlist || []}
              onChangeFilters={(next) => setFilters((prev) => ({ ...prev, ...next }))}
              onResetFilters={() => setFilters(INITIAL_FILTERS)}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onAddToCart={handleAddToCart}
              onToggleWishlist={(id) => void handleToggleWishlist(id)}
            />
          </>
        )}

        {activeView === 'track' && (
          <OrderTrackingView
            initialTrackingNumber={trackingLookupId}
            userOrders={userOrders}
            onOrderUpdated={handleOrderUpdated}
          />
        )}

        {activeView === 'orders' && (
          <MyOrdersView
            user={user}
            orders={userOrders}
            loading={ordersLoading}
            onTrackOrder={(trk) => {
              setTrackingLookupId(trk);
              handleNavigate('track');
            }}
            onGoToAccount={() => handleNavigate('account')}
            onBrowseCatalog={() => handleNavigate('store')}
          />
        )}

        {activeView === 'account' && (
          <AccountView
            user={user}
            catalog={CATALOG_PRODUCTS}
            onUserChange={(next) => setUser(next)}
            onAddToCart={handleAddToCart}
            onToggleWishlist={(id) => void handleToggleWishlist(id)}
            onViewOrders={() => handleNavigate('orders')}
          />
        )}

        {activeView === 'checkout' && (
          <CheckoutView
            user={user}
            items={cartItems}
            catalog={CATALOG_PRODUCTS}
            appliedPromo={appliedPromo}
            onUserChange={(next) => setUser(next)}
            onOrderPlaced={handleOrderPlaced}
            onBackToCatalog={() => handleNavigate('store')}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={Boolean(user?.wishlist.includes(selectedProduct.id))}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onToggleWishlist={(id) => void handleToggleWishlist(id)}
        />
      )}

      <CartDrawer
        open={cartOpen}
        items={cartItems}
        catalog={CATALOG_PRODUCTS}
        appliedPromo={appliedPromo}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveCartItem}
        onApplyPromo={setAppliedPromo}
        onProceedToCheckout={() => {
          setCartOpen(false);
          handleNavigate('checkout');
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
