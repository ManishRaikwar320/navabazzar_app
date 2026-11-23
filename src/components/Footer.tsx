import type { AppView } from './Header.tsx';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-sm text-slate-600">
        <div>
          <div className="font-display text-base font-bold text-slate-900">NavaBazaar</div>
          <p className="text-xs text-slate-500 mt-1">
            Modern multi-category marketplace · Demo payment checkout &amp; shipment tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
          <button type="button" onClick={() => onNavigate('store')} className="hover:text-slate-900 cursor-pointer">
            Catalog
          </button>
          <button type="button" onClick={() => onNavigate('track')} className="hover:text-slate-900 cursor-pointer">
            Track Order
          </button>
          <button type="button" onClick={() => onNavigate('orders')} className="hover:text-slate-900 cursor-pointer">
            My Orders
          </button>
          <button type="button" onClick={() => onNavigate('account')} className="hover:text-slate-900 cursor-pointer">
            Account
          </button>
        </div>
      </div>
    </footer>
  );
}
