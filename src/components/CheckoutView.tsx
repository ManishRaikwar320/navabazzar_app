import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldAlert,
  Smartphone,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { PROMO_CODES } from '../data/catalog.ts';
import type { Address, CartItem, Order, PaymentMethod, Product, UserProfile } from '../types.ts';
import { loginAccount, placeDemoOrder, registerAccount } from '../lib/api.ts';
import { formatINR } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface CheckoutViewProps {
  user: UserProfile | null;
  items: CartItem[];
  catalog: Product[];
  appliedPromo: string;
  onUserChange: (user: UserProfile) => void;
  onOrderPlaced: (order: Order) => void;
  onBackToCatalog: () => void;
}

export function CheckoutView({
  user,
  items,
  catalog,
  appliedPromo,
  onUserChange,
  onOrderPlaced,
  onBackToCatalog,
}: CheckoutViewProps) {
  // Inline auth state if guest enters checkout
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Address state
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    user?.addresses[0]?.id || 'new'
  );
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Demo Payment Gateway state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('demo.user@okaxis');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  const [cardCvv, setCardCvv] = useState('424');
  const [bankName, setBankName] = useState('HDFC Bank (Demo)');

  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [demoOtp, setDemoOtp] = useState('123456');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

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

  const handleInlineAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const res =
        authMode === 'register'
          ? await registerAccount({
              name: authName,
              email: authEmail,
              phone: authPhone,
              password: authPassword,
            })
          : await loginAccount({ email: authEmail, password: authPassword });
      onUserChange(res.user);
      setFullName(res.user.name);
      setPhone(res.user.phone);
      if (res.user.addresses.length > 0) {
        setSelectedAddressId(res.user.addresses[0].id);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Account sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const resolveShippingAddress = (): (Omit<Address, 'id'> & { id?: string }) | null => {
    if (user && selectedAddressId !== 'new') {
      const saved = user.addresses.find((a) => a.id === selectedAddressId);
      if (saved) return saved;
    }
    if (!fullName.trim() || !phone.trim() || !street.trim() || !city.trim() || !stateName.trim() || !/^\d{6}$/.test(pinCode.trim())) {
      return null;
    }
    return {
      label: 'Delivery',
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      city: city.trim(),
      state: stateName.trim(),
      pinCode: pinCode.trim(),
    };
  };

  const getPaymentSummary = (): string => {
    if (paymentMethod === 'upi') return `Demo UPI (${upiId.trim() || 'demo@upi'})`;
    if (paymentMethod === 'card') {
      const digits = cardNumber.replace(/\s+/g, '');
      return `Demo Card •••• ${digits.slice(-4) || '4242'}`;
    }
    if (paymentMethod === 'netbanking') return `Demo NetBanking (${bankName})`;
    return 'Cash on Delivery';
  };

  const handleOpenDemoGateway = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    if (!user) {
      setCheckoutError('Please sign in or create an account in Step 1 before placing an order.');
      return;
    }
    const addr = resolveShippingAddress();
    if (!addr) {
      setCheckoutError('Please complete all delivery address fields including a 6-digit PIN code.');
      return;
    }
    if (paymentMethod === 'cod') {
      void submitOrder(addr);
      return;
    }
    setGatewayModalOpen(true);
  };

  const submitOrder = async (addrOverride?: Omit<Address, 'id'> & { id?: string }) => {
    const addr = addrOverride || resolveShippingAddress();
    if (!addr) return;

    setPlacingOrder(true);
    setCheckoutError(null);
    try {
      const { order } = await placeDemoOrder({
        items: lineItems.map((i) => ({
          productId: i.productId,
          variant: i.variant,
          quantity: i.quantity,
        })),
        address: addr,
        paymentMethod,
        paymentSummary: getPaymentSummary(),
        promoCode: appliedPromo || undefined,
      });
      setGatewayModalOpen(false);
      onOrderPlaced(order);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to complete demo order.');
      setGatewayModalOpen(false);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (lineItems.length === 0) {
    return (
      <section className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
          Your cart is empty
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Add a product before proceeding to demo checkout.
        </p>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
        >
          Return to Catalog
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={onBackToCatalog}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 text-xs sm:text-sm text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Demo Payment Mode:</span> This checkout uses a simulated dummy gateway screen. No real Stripe, Razorpay, bank, or card APIs are connected and zero real charges are made.
        </div>
      </div>

      {checkoutError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
          {checkoutError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Account Verification */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                1. Customer Account
              </h2>
              {user && (
                <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Signed in
                </span>
              )}
            </div>

            {user ? (
              <div className="text-sm text-slate-700">
                Ordering as <span className="font-semibold text-slate-900">{user.name}</span> ({user.email})
              </div>
            ) : (
              <form onSubmit={handleInlineAuth} className="space-y-4">
                <div className="flex items-center gap-4 text-xs font-medium border-b border-slate-200 pb-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`cursor-pointer ${
                      authMode === 'register' ? 'text-blue-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Create New Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`cursor-pointer ${
                      authMode === 'login' ? 'text-blue-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Existing User Sign In
                  </button>
                </div>

                {authError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {authError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {authMode === 'register' && (
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Full Name"
                      className="px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  )}
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email Address"
                    className="px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  {authMode === 'register' && (
                    <input
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="Mobile Number"
                      className="px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  )}
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    className="px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {authBusy
                    ? 'Processing...'
                    : authMode === 'register'
                    ? 'Create Account & Continue'
                    : 'Sign In & Continue'}
                </button>
              </form>
            )}
          </div>

          {/* Step 2: Delivery Address */}
          <form onSubmit={handleOpenDemoGateway} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                2. Delivery Address
              </h2>

              {user && user.addresses.length > 0 && (
                <div className="space-y-2.5">
                  {user.addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        selectedAddressId === addr.id
                          ? 'border-blue-700 bg-blue-50/40'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping-address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 text-blue-700"
                      />
                      <div className="text-sm">
                        <div className="font-semibold text-slate-900">
                          {addr.fullName} · {addr.label}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {addr.street}, {addr.city}, {addr.state} — {addr.pinCode}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Phone: {addr.phone}</div>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${
                      selectedAddressId === 'new'
                        ? 'border-blue-700 bg-blue-50/40'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping-address"
                      checked={selectedAddressId === 'new'}
                      onChange={() => setSelectedAddressId('new')}
                      className="text-blue-700"
                    />
                    <span className="text-sm font-medium text-slate-900">
                      Deliver to a new address
                    </span>
                  </label>
                </div>
              )}

              {(selectedAddressId === 'new' || !user || user.addresses.length === 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Recipient full name"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="House/Flat No, Building, Street, Area"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Mumbai / Bengaluru / Delhi"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="Maharashtra"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="400001"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Demo Payment Gateway */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  3. Payment Gateway (Demo Screen)
                </h2>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Lock className="w-3.5 h-3.5" />
                  Simulated
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'upi' as const, label: 'UPI Demo', icon: Smartphone },
                  { id: 'card' as const, label: 'Card Demo', icon: CreditCard },
                  { id: 'netbanking' as const, label: 'NetBanking', icon: Building2 },
                  { id: 'cod' as const, label: 'Cash on Delivery', icon: Truck },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-800'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1.5" />
                      <div className="text-xs font-semibold whitespace-nowrap">{opt.label}</div>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'upi' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Demo UPI ID (e.g. GPay / PhonePe / Paytm)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full max-w-sm px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
                  />
                  <p className="text-xs text-slate-500">
                    Clicking Pay opens a simulated UPI approval prompt — no real money leaves your account.
                  </p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Test Card Details</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCardNumber('4242 4242 4242 4242');
                        setCardExpiry('12/29');
                        setCardCvv('424');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      Autofill Test Card
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="Card Number"
                      className="sm:col-span-3 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
                    />
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
                    />
                    <input
                      type="text"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="CVV"
                      maxLength={4}
                      className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-xs font-medium text-slate-700">Select Demo Bank</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full max-w-sm px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  >
                    <option>HDFC Bank (Demo)</option>
                    <option>ICICI Bank (Demo)</option>
                    <option>State Bank of India (Demo)</option>
                    <option>Axis Bank (Demo)</option>
                  </select>
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  Pay {formatINR(total)} via cash or UPI when the courier arrives at your doorstep.
                </div>
              )}

              <button
                type="submit"
                disabled={placingOrder}
                className="w-full py-3.5 px-6 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer tabular-nums"
              >
                {paymentMethod === 'cod'
                  ? `Place COD Order (${formatINR(total)})`
                  : `Continue to Demo Payment (${formatINR(total)})`}
              </button>
            </div>
          </form>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 sticky top-24">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Order Summary ({lineItems.reduce((s, i) => s + i.quantity, 0)} items)
          </h2>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {lineItems.map((item) => (
              <div key={`${item.productId}-${item.variant}`} className="py-3 first:pt-0 flex gap-3">
                <div className="w-14 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <ProductImage src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 line-clamp-1">{item.product.name}</div>
                  <div className="text-xs text-slate-500">
                    {item.variant} · Qty {item.quantity}
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-900 tabular-nums">
                  {formatINR(item.product.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({appliedPromo})</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? 'Free' : formatINR(shippingFee)}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Dummy Payment Gateway Authorization Modal */}
      {gatewayModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Demo Payment Gateway"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  NavaBazaar Demo Gateway
                </div>
                <div className="font-display text-lg font-bold text-slate-900 tabular-nums">
                  Pay {formatINR(total)}
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">SANDBOX UI</span>
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <div>
                Method: <span className="font-medium text-slate-900">{getPaymentSummary()}</span>
              </div>
              <div>Merchant: NavaBazaar Retail Demo</div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Simulated Verification OTP (pre-filled for demo)
              </label>
              <input
                type="text"
                value={demoOtp}
                onChange={(e) => setDemoOtp(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg font-mono tracking-widest text-center"
              />
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                disabled={placingOrder}
                onClick={() => void submitOrder()}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {placingOrder ? 'Confirming Demo Payment...' : 'Authorize Demo Payment'}
              </button>
              <button
                type="button"
                disabled={placingOrder}
                onClick={() => {
                  setGatewayModalOpen(false);
                  setCheckoutError('Demo payment was cancelled. No order was placed.');
                }}
                className="w-full py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel &amp; Return
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
