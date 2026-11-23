import { Heart, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useState } from 'react';
import type { FilterState, Product, ProductCategory, SortOption } from '../types.ts';
import { formatINR, getDiscountPercent } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface CatalogViewProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  filters: FilterState;
  allBrands: string[];
  wishlist: string[];
  onChangeFilters: (next: Partial<FilterState>) => void;
  onResetFilters: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, variant: string) => void;
  onToggleWishlist: (productId: string) => void;
}

const CATEGORIES: ('All' | ProductCategory)[] = [
  'All',
  'Electronics',
  'Audio',
  'Fashion',
  'Home & Living',
];

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'All Prices', min: null, max: null },
  { label: 'Under ₹5,000', min: null, max: 5000 },
  { label: '₹5,000 – ₹15,000', min: 5000, max: 15000 },
  { label: '₹15,000 – ₹50,000', min: 15000, max: 50000 },
  { label: 'Above ₹50,000', min: 50000, max: null },
];

export function CatalogView({
  products,
  loading,
  error,
  filters,
  allBrands,
  wishlist,
  onChangeFilters,
  onResetFilters,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
}: CatalogViewProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount =
    (filters.category !== 'All' ? 1 : 0) +
    filters.brands.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  const toggleBrand = (brand: string) => {
    const exists = filters.brands.includes(brand);
    onChangeFilters({
      brands: exists
        ? filters.brands.filter((b) => b !== brand)
        : [...filters.brands, brand],
    });
  };

  const renderFilterControls = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-slate-900">Filters</h2>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Price presets */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Price Range
        </h3>
        <div className="space-y-1.5">
          {PRICE_PRESETS.map((preset) => {
            const isSelected =
              filters.minPrice === preset.min && filters.maxPrice === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onChangeFilters({ minPrice: preset.min, maxPrice: preset.max })
                }
                className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 text-blue-800 font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating filter */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Customer Rating
        </h3>
        <div className="space-y-1.5">
          {[
            { label: 'All Ratings', value: 0 },
            { label: '4.5 ★ & above', value: 4.5 },
            { label: '4.0 ★ & above', value: 4.0 },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeFilters({ minRating: opt.value })}
              className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                filters.minRating === opt.value
                  ? 'bg-blue-50 text-blue-800 font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Brand
        </h3>
        <div className="space-y-2">
          {allBrands.map((brand) => {
            const checked = filters.brands.includes(brand);
            return (
              <label
                key={brand}
                className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBrand(brand)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span>{brand}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Stock Availability */}
      <div className="pt-4 border-t border-slate-200">
        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => onChangeFilters({ inStockOnly: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
          />
          <span>Exclude out of stock</span>
        </label>
      </div>
    </div>
  );

  return (
    <section id="catalog-section" className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search, Category Tabs & Sort Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onChangeFilters({ search: e.target.value })}
              placeholder="Search headphones, cameras, keyboards, sneakers, brands..."
              aria-label="Search products"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChangeFilters({ search: '' })}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>

            <label className="sr-only" htmlFor="sort-select">
              Sort products
            </label>
            <select
              id="sort-select"
              value={filters.sort}
              onChange={(e) => onChangeFilters({ sort: e.target.value as SortOption })}
              className="px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700 cursor-pointer"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Customer Rating</option>
              <option value="discount_desc">Highest Savings</option>
            </select>
          </div>
        </div>

        {/* Category Segmented Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {CATEGORIES.map((cat) => {
            const active = filters.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChangeFilters({ category: cat })}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-slate-500 whitespace-nowrap shrink-0 pl-3 tabular-nums">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </span>
        </div>
      </div>

      {/* Mobile Collapsible Filter Drawer */}
      {mobileFiltersOpen && (
        <div className="lg:hidden bg-white border border-slate-200 rounded-xl p-5 mb-6">
          {renderFilterControls()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 sticky top-24">
          {renderFilterControls()}
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-slate-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-5 bg-slate-200 rounded w-4/5" />
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-9 bg-slate-200 rounded w-full mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <h3 className="font-display text-lg font-semibold text-slate-900 mb-2">
                No matching products found
              </h3>
              <p className="text-sm text-slate-600 mb-5">
                Try clearing some filters or searching for another product category or brand.
              </p>
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((product) => {
                const discount = getDiscountPercent(product.price, product.mrp);
                const isWishlisted = wishlist.includes(product.id);

                return (
                  <article
                    key={product.id}
                    className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onSelectProduct(product)}
                        className="w-full h-full block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
                        aria-label={`View details for ${product.name}`}
                      >
                        <ProductImage
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleWishlist(product.id)}
                        aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                        className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/90 hover:bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600 text-rose-600' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 mb-1.5">
                        <span>{product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.brand}</span>
                        {!product.inStock && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-red-600 font-semibold">Out of Stock</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct(product)}
                        className="text-left cursor-pointer"
                      >
                        <h3 className="font-display text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2 mb-1">
                          {product.name}
                        </h3>
                      </button>

                      <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                        {product.tagline}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-4 tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="font-semibold text-slate-900">{product.rating.toFixed(1)}</span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span>{product.reviewCount.toLocaleString('en-IN')} reviews</span>
                      </div>

                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div className="tabular-nums">
                          <div className="text-base font-bold text-slate-900">
                            {formatINR(product.price)}
                          </div>
                          {discount > 0 && (
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <span className="line-through">{formatINR(product.mrp)}</span>
                              <span className="text-emerald-700 font-medium">{discount}% off</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!product.inStock}
                          onClick={() => onAddToCart(product, product.variants[0])}
                          className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            product.inStock
                              ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {product.inStock ? 'Add to Cart' : 'Unavailable'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
