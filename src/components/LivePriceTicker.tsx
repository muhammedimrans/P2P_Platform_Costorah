import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  TOP_TRADING_COUNTRIES,
  type CountryCode,
  type CryptoAsset,
  type LivePriceFeed,
} from '../types';
import { CryptoAssetIcon } from './CryptoAssetIcons';

interface LivePriceTickerProps {
  feed: LivePriceFeed;
  selectedCountry?: CountryCode;
  onRefresh?: () => Promise<void>;
  theme?: string;
}

const ASSET_LIST: CryptoAsset[] = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'USDC'];

export const LivePriceTicker: React.FC<LivePriceTickerProps> = ({
  feed,
  selectedCountry = 'IN',
  onRefresh,
  theme,
}) => {
  const [displayMode, setDisplayMode] = useState<'BOTH' | 'INR' | 'USD'>('BOTH');
  const [refreshing, setRefreshing] = useState(false);

  const isDay = theme === 'day';
  const usdInr = feed.usdInrRate || 94.76;
  const activePolicy = TOP_TRADING_COUNTRIES[selectedCountry] || TOP_TRADING_COUNTRIES.IN;
  const activeFiat = activePolicy.fiatCurrency;
  const activeFxRate =
    feed.fiatExchangeRates?.[activeFiat] ??
    (activeFiat === 'INR' ? usdInr : activePolicy.usdExchangeRate);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <div
      data-testid="live-price-ticker-bar"
      className={`w-full border-b transition-colors text-xs font-mono py-1.5 px-4 sm:px-8 ${
        isDay
          ? 'bg-gradient-to-r from-slate-50 via-sky-50/50 to-emerald-50/50 border-slate-200 text-slate-800'
          : 'bg-gradient-to-r from-[#070A0F] via-[#0E1522] to-[#0A121C] border-white/[0.08] text-slate-200'
      }`}
    >
      <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        {/* USD/INR + Native Currency Conversion Header */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              isDay
                ? 'bg-sky-100 text-sky-900 border border-sky-300'
                : 'bg-sky-950/70 text-sky-300 border border-sky-500/30'
            }`}
            title="Real-time USD to INR Exchange Conversion Rate"
          >
            $1.00 USD = ₹{usdInr.toFixed(2)} INR
          </div>
          {activeFiat !== 'INR' && activeFiat !== 'USD' && (
            <div
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                isDay
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
              }`}
              title={`Real-time USD to ${activeFiat} Native Currency Conversion Rate`}
            >
              $1.00 USD = {activePolicy.fiatSymbol}
              {activeFxRate >= 100
                ? activeFxRate.toLocaleString('en-US', { maximumFractionDigits: 2 })
                : activeFxRate.toFixed(2)}{' '}
              {activeFiat}
            </div>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            title="Force refresh live rates from CoinGecko / Binance API"
            className={`p-1 rounded text-slate-400 hover:text-slate-100 cursor-pointer transition-transform ${
              refreshing ? 'animate-spin' : ''
            }`}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Crypto Assets Live Pricing Carousel */}
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto py-0.5 max-w-full">
          {ASSET_LIST.map((sym) => {
            const r = feed.rates[sym];
            if (!r) return null;
            const syncedInr = Number((r.usd * usdInr).toFixed(2));
            const syncedNative = Number((r.usd * activeFxRate).toFixed(2));
            const isPositive = (r.change24h ?? 0) >= 0;
            return (
              <div
                key={sym}
                data-testid={`ticker-item-${sym}`}
                className="inline-flex items-center gap-1.5 shrink-0"
              >
                <CryptoAssetIcon asset={sym} className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold">{sym}:</span>
                {displayMode !== 'INR' && (
                  <span className={isDay ? 'text-slate-700 font-semibold' : 'text-slate-300 font-semibold'}>
                    ${r.usd >= 1000 ? r.usd.toLocaleString('en-US', { maximumFractionDigits: 2 }) : r.usd.toFixed(2)}
                  </span>
                )}
                {displayMode === 'BOTH' && <span className="text-slate-500">/</span>}
                {displayMode !== 'USD' && (
                  <span className="text-emerald-400 font-bold">
                    ₹{syncedInr >= 100000 ? `${(syncedInr / 100000).toFixed(2)}L` : syncedInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                )}
                {activeFiat !== 'INR' && activeFiat !== 'USD' && (
                  <>
                    <span className="text-slate-500">/</span>
                    <span className="text-sky-400 font-bold">
                      {activePolicy.fiatSymbol}
                      {syncedNative >= 1000
                        ? syncedNative.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        : syncedNative.toFixed(2)}
                    </span>
                  </>
                )}
                <span
                  className={`text-[9px] font-semibold ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {r.change24h}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Controls: Display mode toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-0.5 bg-black/20 p-0.5 rounded border border-white/10 text-[10px]">
            <button
              type="button"
              onClick={() => setDisplayMode('BOTH')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${
                displayMode === 'BOTH' ? 'bg-[#0B65C6] text-white font-bold' : 'text-slate-400'
              }`}
            >
              $/₹
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('INR')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${
                displayMode === 'INR' ? 'bg-[#0B65C6] text-white font-bold' : 'text-slate-400'
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('USD')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${
                displayMode === 'USD' ? 'bg-[#0B65C6] text-white font-bold' : 'text-slate-400'
              }`}
            >
              $ USD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
