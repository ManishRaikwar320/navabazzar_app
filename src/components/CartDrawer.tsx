import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { PROMO_CODES } from '../data/catalog.ts';
import type { CartItem, Product } from '../types.ts';
import { formatINR } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  catalog: Product[];
  appliedPromo: string;
  onClose: () => void;
  onUpdateQty: (productId: string, variant: string, delta: number) => void;
  onRemoveItem: (productId: string, variant: string) => void;
  onApplyPromo: (code: string) => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  open,
  items,
  catalog,
  appliedPromo,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onApplyPromo,
  onProceedToCheckout,
}: CartDrawerProps) {
  const [promoInput, setPromoInput] = useState(appliedPromo);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  if (!open) return null;

  const lineItems = items
    .map((item) => {
      const product = catalog.find((p) => p.id === item.productId);
      return product ? { ...item, product } : null;
    })
    .filter((entry): entry is CartItem & { product: Product } => entry !== null);

  const subtotal = lineItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const promoRule = appliedPromo ? PROMO_CODES[appliedPromo] : undefined;
  const discount = promoRule
    ? Math.min(Math.round((subtotal * promoRule.discountPercent) / 100), promoRule.maxDiscount)
    : 0;
  const shippingFee = subtotal === 0 || subtotal >= 999 ? 0 : 79;
  const total = Math.max(0, subtotal - discount + shippingFee);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      onApplyPromo('');
      setPromoMsg(null);
      return;
    }
    if (!PROMO_CODES[code]) {
      setPromoMsg('Try NAVA10 (10% off) or WELCOME500 (5% off).');
      return;
    }
    onApplyPromo(code);
    setPromoMsg(`Applied ${code}: ${PROMO_CODES[code].label}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div
        className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-slate-900" />
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Shopping Bag
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {lineItems.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-display text-base font-semibold text-slate-900 mb-1">
                Your cart is empty
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Add items from the catalog to test demo checkout and order tracking.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                Browse Products
              </button>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-200">
                {lineItems.map((item) => (
                  <div
                    key={`${item.productId}-${item.variant}`}
                    className="py-4 first:pt-0 flex gap-4"
                  >
                    <div className="w-20 h-16 rounded-lg overflow-hidden bg-stone-100 border border-slate-200 shrink-0">
                      <ProductImage
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {item.product.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId, item.variant)}
                          aria-label={`Remove ${item.product.name}`}
                          className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.variant}</p>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center border border-slate-200 rounded-lg">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, item.variant, -1)}
                            aria-label="Decrease quantity"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-semibold tabular-nums text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, item.variant, 1)}
                            aria-label="Increase quantity"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          {formatINR(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Promo Code */}
              <form onSubmit={handleApplyPromo} className="pt-4 border-t border-slate-200 space-y-2">
                <label htmlFor="cart-promo" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Promo Code (Try NAVA10)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-promo"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="NAVA10"
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg uppercase font-mono focus:outline-none focus:bg-white focus:border-blue-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMsg && <p className="text-xs text-slate-600">{promoMsg}</p>}
              </form>
            </>
          )}
        </div>

        {lineItems.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3 tabular-nums">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promo ({appliedPromo})</span>
                  <span>-{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <span>{shippingFee === 0 ? 'Free' : formatINR(shippingFee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
                <span>Total Payable</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
