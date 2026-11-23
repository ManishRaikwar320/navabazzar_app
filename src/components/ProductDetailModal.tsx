import { Check, Heart, ShieldCheck, Star, Truck, X } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../types.ts';
import { formatINR, getDiscountPercent } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductDetailModalProps {
  product: Product;
  isWishlisted: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, variant: string) => void;
  onBuyNow: (product: Product, variant: string) => void;
  onToggleWishlist: (productId: string) => void;
}

export function ProductDetailModal({
  product,
  isWishlisted,
  onClose,
  onAddToCart,
  onBuyNow,
  onToggleWishlist,
}: ProductDetailModalProps) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [pinCode, setPinCode] = useState('');
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  const discount = getDiscountPercent(product.price, product.mrp);

  const handleCheckPin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pinCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setPinStatus('Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    const estDate = new Date(
      Date.now() + product.deliveryDays * 24 * 60 * 60 * 1000
    ).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    setPinStatus(`Delivery to ${trimmed} by ${estDate} · Cash on Delivery available`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            {product.category} · {product.brand}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Studio Photography & Highlights */}
          <div className="lg:col-span-6 space-y-6">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 border border-slate-200">
              <ProductImage
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                Key Specifications
              </h3>
              <ul className="space-y-2">
                {product.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Contiguous Purchase Module */}
          <div className="lg:col-span-6 flex flex-col space-y-5">
            <div>
              <h2 id="pdp-title" className="font-display text-2xl font-bold text-slate-900 mb-2">
                {product.name}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                {product.description}
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-600 tabular-nums">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-slate-900">{product.rating.toFixed(1)}</span>
                <span aria-hidden="true">·</span>
                <span>{product.reviewCount.toLocaleString('en-IN')} verified ratings</span>
                <span aria-hidden="true">·</span>
                <span className={product.inStock ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                  {product.inStock ? `In Stock (${product.stockCount} units)` : 'Currently Out of Stock'}
                </span>
              </div>
            </div>

            <div className="py-4 border-y border-slate-200 tabular-nums">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-slate-900">
                  {formatINR(product.price)}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-base text-slate-400 line-through">
                      {formatINR(product.mrp)}
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">
                      Save {formatINR(product.mrp - product.price)} ({discount}% off)
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Inclusive of all taxes · Free shipping on orders ₹999+</p>
            </div>

            {/* Variant Selector */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">
                Select Option: <span className="text-slate-900">{selectedVariant}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const active = selectedVariant === variant;
                  return (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {variant}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Purchase Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={!product.inStock}
                onClick={() => onAddToCart(product, selectedVariant)}
                className={`flex-1 min-w-[140px] px-5 py-3 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  product.inStock
                    ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Add to Cart
              </button>
              <button
                type="button"
                disabled={!product.inStock}
                onClick={() => onBuyNow(product, selectedVariant)}
                className={`flex-1 min-w-[140px] px-5 py-3 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  product.inStock
                    ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Buy Now
              </button>
              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                aria-label="Toggle wishlist"
                className="p-3 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-slate-300 cursor-pointer"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
              </button>
            </div>

            {/* PIN Code Delivery Check */}
            <form onSubmit={handleCheckPin} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Truck className="w-4 h-4 text-slate-600" />
                <span>Check Delivery Estimate</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="Enter 6-digit PIN (e.g. 560038)"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-blue-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Check
                </button>
              </div>
              {pinStatus && <p className="text-xs text-slate-700">{pinStatus}</p>}
            </form>

            {/* Seller & Warranty */}
            <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>{product.warranty}</span>
              </div>
              <div>
                Sold by <span className="font-medium text-slate-900">{product.seller}</span> · 7-day replacement policy
              </div>
            </div>

            {/* Verified Reviews */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Recent Customer Reviews
              </h3>
              {product.reviews.map((rev) => (
                <div key={rev.id} className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-medium text-slate-900">
                      {rev.author} · {rev.city}
                    </span>
                    <span className="tabular-nums">{rev.rating}.0 ★ · {rev.date}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mb-0.5">{rev.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
