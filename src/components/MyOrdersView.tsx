import { ArrowRight, Package } from 'lucide-react';
import type { Order, UserProfile } from '../types.ts';
import { formatDateTime, formatINR } from '../lib/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface MyOrdersViewProps {
  user: UserProfile | null;
  orders: Order[];
  loading: boolean;
  onTrackOrder: (trackingNumber: string) => void;
  onGoToAccount: () => void;
  onBrowseCatalog: () => void;
}

export function MyOrdersView({
  user,
  orders,
  loading,
  onTrackOrder,
  onGoToAccount,
  onBrowseCatalog,
}: MyOrdersViewProps) {
  if (!user) {
    return (
      <section className="max-w-lg mx-auto px-4 py-16 text-center">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
          Sign in to view your orders
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Create a NavaBazaar account or sign in to access your order history and shipment tracking.
        </p>
        <button
          type="button"
          onClick={onGoToAccount}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
        >
          Sign In / Create Account
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-sm text-slate-600">
            View invoices, payment details, and track live delivery milestones.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse h-36" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-slate-900 mb-1">
            No orders placed yet
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Add an item to your bag and complete the demo checkout to test live order tracking.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <article
              key={order.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <span className="text-slate-500">Order Placed: </span>
                    <span className="font-medium text-slate-900">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tracking ID: </span>
                    <span className="font-mono font-semibold text-slate-900">{order.trackingNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment: </span>
                    <span className="font-medium text-slate-900">{order.paymentStatus}</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  {formatINR(order.total)}
                </div>
              </div>

              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {order.orderStatus} <span className="text-slate-400 font-normal">·</span>{' '}
                    <span className="text-xs font-normal text-slate-600">
                      Est. Delivery {order.estimatedDelivery}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {order.items.map((item) => (
                      <div key={`${item.productId}-${item.variant}`} className="flex items-center gap-3.5">
                        <div className="w-14 h-12 rounded-lg overflow-hidden bg-stone-100 border border-slate-200 shrink-0">
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {item.variant} · Qty {item.quantity} · {formatINR(item.unitPrice)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTrackOrder(order.trackingNumber)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Track Shipment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
