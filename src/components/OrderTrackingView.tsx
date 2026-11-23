import { ArrowRight, Check, MapPin, PackageCheck, Search, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Order, PublicTrackingInfo } from '../types.ts';
import { advanceOrderStage, trackShipment } from '../lib/api.ts';
import { formatDateTime, formatINR } from '../lib/format.ts';

interface OrderTrackingViewProps {
  initialTrackingNumber?: string;
  userOrders: Order[];
  onOrderUpdated: (updated: Order) => void;
}

export function OrderTrackingView({
  initialTrackingNumber = '',
  userOrders,
  onOrderUpdated,
}: OrderTrackingViewProps) {
  const [query, setQuery] = useState(initialTrackingNumber || 'NB-DEMO-2026');
  const [tracking, setTracking] = useState<PublicTrackingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const performLookup = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const res = await trackShipment(clean);
      setTracking(res.tracking);
    } catch (err) {
      setTracking(null);
      setError(err instanceof Error ? err.message : 'Unable to locate tracking ID.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const target = initialTrackingNumber || 'NB-DEMO-2026';
    setQuery(target);
    void performLookup(target);
  }, [initialTrackingNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLookup(query);
  };

  const handleAdvanceStage = async () => {
    if (!tracking?.order) return;
    setAdvancing(true);
    try {
      const { order } = await advanceOrderStage(tracking.order.id);
      onOrderUpdated(order);
      await performLookup(order.trackingNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update shipment stage.');
    } finally {
      setAdvancing(false);
    }
  };

  const completedSteps = tracking ? tracking.timeline.filter((s) => s.completed).length : 0;
  const totalSteps = tracking ? tracking.timeline.length : 5;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">
            Live Order Tracking
          </h1>
          <p className="text-sm text-slate-600">
            Enter your NavaBazaar tracking ID to view real-time hub scans and delivery milestones.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter tracking number (e.g. NB-DEMO-2026)"
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {loading ? 'Checking...' : 'Track Shipment'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Quick lookup:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('NB-DEMO-2026');
              void performLookup('NB-DEMO-2026');
            }}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono rounded-md cursor-pointer"
          >
            NB-DEMO-2026
          </button>
          {userOrders.slice(0, 3).map((ord) => (
            <button
              key={ord.id}
              type="button"
              onClick={() => {
                setQuery(ord.trackingNumber);
                void performLookup(ord.trackingNumber);
              }}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono rounded-md cursor-pointer"
            >
              {ord.trackingNumber}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {tracking && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8">
          {/* Shipment Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                Tracking ID <span className="font-mono font-semibold text-slate-900">{tracking.trackingNumber}</span>
                <span aria-hidden="true"> · </span>
                <span>{tracking.courierName}</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {tracking.orderStatus}
              </h2>
              <p className="text-sm text-slate-600">
                Destination: {tracking.destinationCity} <span aria-hidden="true">·</span> Estimated Delivery:{' '}
                <span className="font-semibold text-slate-900">{tracking.estimatedDelivery}</span>
              </p>
            </div>

            {tracking.isOwner && tracking.order && tracking.orderStatus !== 'Delivered' && (
              <button
                type="button"
                disabled={advancing}
                onClick={handleAdvanceStage}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <Truck className="w-4 h-4" />
                <span>{advancing ? 'Updating...' : 'Simulate Next Delivery Stage'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2 tabular-nums">
              <span>Shipment Progress</span>
              <span>
                {completedSteps} of {totalSteps} checkpoints completed ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Vertical Milestone Timeline */}
          <ol className="space-y-6 relative">
            {tracking.timeline.map((step, index) => {
              const isLast = index === tracking.timeline.length - 1;
              return (
                <li key={step.stage} className="relative flex gap-4">
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-4 top-8 -bottom-6 w-0.5 ${
                        step.completed ? 'bg-blue-700' : 'bg-slate-200'
                      }`}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                      step.completed
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {step.completed ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-mono">{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 pb-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h3
                        className={`text-sm font-semibold ${
                          step.completed ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {step.title}
                      </h3>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {formatDateTime(step.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{step.description}</p>
                    <div className="inline-flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{step.location}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Shipment Summary */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-display font-semibold text-slate-900">
                <PackageCheck className="w-4 h-4 text-slate-700" />
                <span>Items in Shipment ({tracking.itemCount})</span>
              </div>
              <ul className="space-y-1 text-xs text-slate-600">
                {tracking.itemNames.map((itemLabel, idx) => (
                  <li key={idx}>· {itemLabel}</li>
                ))}
              </ul>
            </div>

            {tracking.isOwner && tracking.order && (
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="font-display text-sm font-semibold text-slate-900">
                  Order &amp; Billing Summary
                </div>
                <div>
                  Delivering to: <span className="font-medium text-slate-900">{tracking.order.shippingAddress.fullName}</span>
                </div>
                <div>
                  {tracking.order.shippingAddress.street}, {tracking.order.shippingAddress.city},{' '}
                  {tracking.order.shippingAddress.state} — {tracking.order.shippingAddress.pinCode}
                </div>
                <div>
                  Payment: {tracking.order.paymentSummary} ({tracking.order.paymentStatus})
                </div>
                <div className="text-sm font-bold text-slate-900 tabular-nums pt-1">
                  Order Total: {formatINR(tracking.order.total)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
