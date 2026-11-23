import { ArrowRight, MapPin } from 'lucide-react';
import { HERO_BANNER_IMAGE } from '../data/catalog.ts';
import { ProductImage } from './ProductImage.tsx';

interface HeroSectionProps {
  onBrowseCatalog: () => void;
  onTrackOrder: () => void;
}

export function HeroSection({ onBrowseCatalog, onTrackOrder }: HeroSectionProps) {
  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-center py-2 lg:py-4">
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500 mb-3">
              Curated Marketplace · Free Shipping Above ₹999
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.12] text-balance mb-4">
              Everyday tools &amp; hardware built to last.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-lg mb-6">
              Explore studio audio, precision electronics, home coffee gear, and commuter carry. Create an account for instant demo checkout and live shipment tracking across India.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onBrowseCatalog}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                <span>Shop Featured Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onTrackOrder}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                <MapPin className="w-4 h-4 text-slate-600" />
                <span>Track Shipment</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative h-64 sm:h-80 lg:h-full min-h-[280px] rounded-xl overflow-hidden bg-stone-100 border border-slate-200">
              <ProductImage
                src={HERO_BANNER_IMAGE}
                alt="Curated home workspace featuring aluminum laptop, wireless headphones, and ceramic kettle"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4 text-white">
                <div className="text-xs sm:text-sm font-medium">
                  Use code <span className="font-mono font-semibold">NAVA10</span> for 10% instant savings at demo checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
