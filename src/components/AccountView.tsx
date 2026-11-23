import { Heart, LogOut, MapPin, Package, Plus, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import type { Product, UserProfile } from '../types.ts';
import {
  addAddress,
  deleteAddress,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '../lib/api.ts';
import { formatINR } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface AccountViewProps {
  user: UserProfile | null;
  catalog: Product[];
  onUserChange: (user: UserProfile | null) => void;
  onAddToCart: (product: Product, variant: string) => void;
  onToggleWishlist: (productId: string) => void;
  onViewOrders: () => void;
}

export function AccountView({
  user,
  catalog,
  onUserChange,
  onAddToCart,
  onToggleWishlist,
  onViewOrders,
}: AccountViewProps) {
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPin, setAddrPin] = useState('');
  const [addrError, setAddrError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      if (authMode === 'register') {
        const res = await registerAccount({ name, email, phone, password });
        onUserChange(res.user);
      } else {
        const res = await loginAccount({ email, password });
        onUserChange(res.user);
      }
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAccount();
    onUserChange(null);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError(null);
    try {
      const res = await addAddress({
        label: addrLabel,
        fullName: addrName,
        phone: addrPhone,
        street: addrStreet,
        city: addrCity,
        state: addrState,
        pinCode: addrPin,
      });
      onUserChange(res.user);
      setShowAddrForm(false);
      setAddrName('');
      setAddrPhone('');
      setAddrStreet('');
      setAddrCity('');
      setAddrState('');
      setAddrPin('');
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : 'Could not save address.');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      const res = await deleteAddress(id);
      onUserChange(res.user);
    } catch {
      // ignore transient error
    }
  };

  if (!user) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">
              {authMode === 'register' ? 'Create your NavaBazaar account' : 'Sign in to your account'}
            </h1>
            <p className="text-sm text-slate-600">
              Save delivery addresses, keep a wishlist, place demo orders, and track shipments live.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError(null);
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rohan Sharma"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rohan@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
              />
            </div>

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting
                ? 'Please wait...'
                : authMode === 'register'
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const wishlistedProducts = catalog.filter((p) => user.wishlist.includes(p.id));

  return (
    <section className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Profile Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">{user.name}</h1>
            <p className="text-sm text-slate-600">
              {user.email} <span aria-hidden="true">·</span> {user.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onViewOrders}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>My Orders</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Saved Addresses */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-700" />
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Saved Delivery Addresses
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAddrForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddrForm ? 'Cancel' : 'Add Address'}</span>
          </button>
        </div>

        {showAddrForm && (
          <form
            onSubmit={handleAddAddress}
            className="p-5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {addrError && (
              <div className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {addrError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Address Label</label>
              <input
                type="text"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                placeholder="Home / Office"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Recipient Name</label>
              <input
                type="text"
                required
                value={addrName}
                onChange={(e) => setAddrName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={addrPhone}
                onChange={(e) => setAddrPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={addrPin}
                onChange={(e) => setAddrPin(e.target.value)}
                placeholder="560038"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Street / Flat / Landmark</label>
              <input
                type="text"
                required
                value={addrStreet}
                onChange={(e) => setAddrStreet(e.target.value)}
                placeholder="Flat 402, Greenview Residency, MG Road"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                required
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                placeholder="Bengaluru"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                required
                value={addrState}
                onChange={(e) => setAddrState(e.target.value)}
                placeholder="Karnataka"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                Save Address
              </button>
            </div>
          </form>
        )}

        {user.addresses.length === 0 ? (
          <p className="text-sm text-slate-500">
            No saved addresses yet. Add one here or during checkout.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.addresses.map((addr) => (
              <div
                key={addr.id}
                className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-3"
              >
                <div className="text-sm space-y-1">
                  <div className="font-semibold text-slate-900">
                    {addr.fullName} <span className="text-xs font-normal text-slate-500">· {addr.label}</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    {addr.street}, {addr.city}, {addr.state} — <span className="font-mono">{addr.pinCode}</span>
                  </p>
                  <p className="text-xs text-slate-500">Phone: {addr.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(addr.id)}
                  aria-label="Delete address"
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wishlist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-slate-700" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Saved Wishlist ({wishlistedProducts.length})
          </h2>
        </div>

        {wishlistedProducts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Items you save with the heart icon will appear here for quick access.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlistedProducts.map((product) => (
              <div
                key={product.id}
                className="border border-slate-200 rounded-xl p-4 flex gap-3.5 items-center"
              >
                <div className="w-16 h-14 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <ProductImage src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{product.name}</div>
                  <div className="text-xs font-bold text-slate-700 tabular-nums mt-0.5">
                    {formatINR(product.price)}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      disabled={!product.inStock}
                      onClick={() => onAddToCart(product, product.variants[0])}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:text-slate-400 cursor-pointer"
                    >
                      {product.inStock ? 'Move to Cart' : 'Out of Stock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(product.id)}
                      className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
