import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Lock,
  Menu,
  MessageSquare,
  Moon,
  PlusCircle,
  Search,
  ShieldCheck,
  Store,
  Sun,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  TOP_TRADING_COUNTRIES,
  calculateAdvertiserTrustScore,
  calculateAutoUnitPriceFiat,
  type AppRoute,
  type AssetBalance,
  type CryptoAsset,
  type EscrowOrderRecord,
  type FiatCurrency,
  type LivePriceFeed,
  type OfferRecord,
  type NotificationItem,
  type UserProfile,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import {
  ALL_CRYPTO_ASSETS,
  CRYPTO_ASSET_CATALOG,
  CryptoAssetIcon,
  CostorahLogoIcon,
} from './CryptoAssetIcons';
import type { AccountModalTab } from './AccountModal';

export interface GlobalSearchSelection {
  query?: string;
  asset?: CryptoAsset | 'ALL';
  paymentMethod?: string;
  offerId?: string;
}

interface NavbarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  currentUser: UserProfile;
  onOpenAccountModal: (tab?: AccountModalTab) => void;
  theme?: 'day' | 'night';
  onToggleTheme?: () => void;
  offers?: OfferRecord[];
  orders?: EscrowOrderRecord[];
  allUsers?: UserProfile[];
  balances?: AssetBalance[];
  livePriceFeed?: LivePriceFeed;
  supportedPaymentMethods?: Record<FiatCurrency, string[]>;
  notifications?: NotificationItem[];
  onOpenOrderFromNotification?: (orderId: string) => void;
  onGlobalSearchSelect?: (selection: GlobalSearchSelection) => void;
}

const NAV_ITEMS: { route: AppRoute; label: string; icon: React.ReactNode }[] = [
  { route: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { route: 'marketplace', label: 'P2P Market', icon: <Store className="w-4 h-4" /> },
  { route: 'pulse', label: 'Trader Feed', icon: <MessageSquare className="w-4 h-4" /> },
  { route: 'swap', label: 'Swap', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { route: 'create-offer', label: 'Post Ad', icon: <PlusCircle className="w-4 h-4" /> },
  { route: 'orders', label: 'Orders', icon: <FileText className="w-4 h-4" /> },
  { route: 'dashboard', label: 'Profile', icon: <LayoutDashboard className="w-4 h-4" /> },
  { route: 'admin', label: 'Admin', icon: <Lock className="w-4 h-4" /> },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeRoute,
  onNavigate,
  currentUser,
  onOpenAccountModal,
  theme = 'day',
  onToggleTheme,
  offers = [],
  orders = [],
  allUsers = [],
  balances = [],
  livePriceFeed,
  supportedPaymentMethods,
  notifications = [],
  onOpenOrderFromNotification,
  onGlobalSearchSelect,
}) => {
  const shortName = currentUser.displayName.replace(' (You)', '').split(' ')[0];
  const countryCode = currentUser.countryCode || 'IN';
  const lockedFiat = TOP_TRADING_COUNTRIES[countryCode]?.fiatCurrency || 'INR';
  const isDay = theme === 'day';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [walletBreakdownOpen, setWalletBreakdownOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const walletBreakdownRef = useRef<HTMLDivElement | null>(null);

  // Calculate user's crypto holding balances and total worth in Rupees (₹ INR)
  const walletHoldingSummary = useMemo(() => {
    const liveInrRate =
      livePriceFeed?.usdInrRate ??
      livePriceFeed?.fiatExchangeRates?.INR ??
      TOP_TRADING_COUNTRIES.IN.usdExchangeRate;

    const balanceMap = new Map<CryptoAsset, AssetBalance>();
    for (const b of balances) {
      balanceMap.set(b.asset, b);
    }

    let totalInrMinor = 0;
    const perAsset = ALL_CRYPTO_ASSETS.map((asset) => {
      const bal = balanceMap.get(asset);
      const availableMicro = bal?.availableMicro ?? 0;
      const lockedMicro = bal?.lockedMicro ?? 0;
      const totalHoldingMicro = availableMicro + lockedMicro;
      const inrPrice = calculateAutoUnitPriceFiat({
        asset,
        countryCode: 'IN',
        pricingType: 'FIXED',
        liveCryptoUsdPrice: livePriceFeed?.rates?.[asset]?.usd,
        liveLocalExchangeRate: liveInrRate,
      });
      const availableInrMinor = Math.round(
        (availableMicro * inrPrice.unitPriceFiatMinor) / 1_000_000
      );
      const totalInrAssetMinor = Math.round(
        (totalHoldingMicro * inrPrice.unitPriceFiatMinor) / 1_000_000
      );
      totalInrMinor += availableInrMinor;
      return {
        asset,
        availableMicro,
        lockedMicro,
        totalHoldingMicro,
        unitPriceInrMinor: inrPrice.unitPriceFiatMinor,
        availableInrMinor,
        totalInrAssetMinor,
      };
    });

    const usdtRow = perAsset.find((r) => r.asset === 'USDT');
    const usdtFormatted = ((usdtRow?.availableMicro ?? 0) / 1_000_000).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return {
      totalInrMinor,
      totalInrFormatted: formatMinor2(totalInrMinor),
      usdtFormatted,
      perAsset,
    };
  }, [balances, livePriceFeed]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.buyerId === currentUser.id || o.sellerId === currentUser.id) &&
        !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.state)
    ).length;
  }, [orders, currentUser.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
      if (
        walletBreakdownRef.current &&
        !walletBreakdownRef.current.contains(e.target as Node)
      ) {
        setWalletBreakdownOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allPaymentRails = useMemo(() => {
    const rails = new Set<string>();
    const activeRails =
      supportedPaymentMethods?.[lockedFiat] ||
      TOP_TRADING_COUNTRIES[countryCode]?.localPaymentMethods ||
      [];
    for (const r of activeRails) rails.add(r);
    if (supportedPaymentMethods) {
      for (const list of Object.values(supportedPaymentMethods)) {
        for (const r of list) rails.add(r);
      }
    }
    return Array.from(rails);
  }, [supportedPaymentMethods, lockedFiat, countryCode]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchedAssets = useMemo(() => {
    if (!normalizedQuery) return ALL_CRYPTO_ASSETS.slice(0, 5);
    return ALL_CRYPTO_ASSETS.filter((sym) => {
      const meta = CRYPTO_ASSET_CATALOG[sym];
      return (
        sym.toLowerCase().includes(normalizedQuery) ||
        meta.name.toLowerCase().includes(normalizedQuery) ||
        meta.tagline.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery]);

  const matchedPaymentMethods = useMemo(() => {
    if (!normalizedQuery) {
      return (
        supportedPaymentMethods?.[lockedFiat] ||
        TOP_TRADING_COUNTRIES[countryCode]?.localPaymentMethods ||
        []
      ).slice(0, 4);
    }
    return allPaymentRails
      .filter((rail) => rail.toLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }, [normalizedQuery, allPaymentRails, supportedPaymentMethods, lockedFiat, countryCode]);

  const matchedOffers = useMemo(() => {
    const openOffers = offers.filter((o) => o.status === 'OPEN');
    if (!normalizedQuery) {
      return openOffers.filter((o) => o.fiatCurrency === lockedFiat).slice(0, 3);
    }
    return openOffers
      .filter((o) => {
        const hay = `${o.makerName} ${o.asset} ${o.fiatCurrency} ${o.paymentMethods.join(' ')} ${o.id}`.toLowerCase();
        return hay.includes(normalizedQuery);
      })
      .slice(0, 4);
  }, [offers, normalizedQuery, lockedFiat]);

  const userById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of allUsers) map.set(u.id, u);
    return map;
  }, [allUsers]);

  const triggerSelection = (selection: GlobalSearchSelection) => {
    if (onGlobalSearchSelect) {
      onGlobalSearchSelect(selection);
    } else {
      onNavigate('marketplace');
    }
    setSearchOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    const exactAsset = ALL_CRYPTO_ASSETS.find(
      (a) => a.toLowerCase() === q.toLowerCase() || CRYPTO_ASSET_CATALOG[a].name.toLowerCase() === q.toLowerCase()
    );
    const exactRail = allPaymentRails.find((r) => r.toLowerCase() === q.toLowerCase());

    if (exactAsset) {
      triggerSelection({ asset: exactAsset, query: '' });
    } else if (exactRail) {
      triggerSelection({ paymentMethod: exactRail, query: '' });
    } else {
      triggerSelection({ query: q });
    }
  };

  return (
    <>
      <header
      className={`sticky top-0 z-40 flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-2 gap-x-2 sm:gap-x-4 px-3 sm:px-8 py-2.5 sm:py-3 border-b transition-colors ${
        isDay
          ? 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]'
          : 'bg-[#0B0E14]/95 backdrop-blur-md border-white/[0.08] text-slate-100'
      }`}
    >
      {/* Zone 1: Brand Wordmark & Official COSTORAH SVG Icon */}
      <a
        href="#home"
        data-testid="navbar-brand-logo"
        onClick={(e) => {
          e.preventDefault();
          onNavigate('home');
        }}
        className="flex items-center gap-2 sm:gap-3 whitespace-nowrap shrink-0 group"
      >
        <CostorahLogoIcon className="w-8 h-8 sm:w-11 sm:h-11 shrink-0 drop-shadow-sm transition-transform group-hover:scale-105" />
        <div className="flex flex-col leading-none">
          <span
            className={`text-base sm:text-xl font-black tracking-tight font-display ${
              isDay ? 'text-[#0B65C6]' : 'text-slate-100'
            }`}
          >
            COSTO<span className={isDay ? 'text-emerald-600' : 'text-emerald-400'}>RAH</span>
          </span>
          <span
            className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-widest mt-0.5 ${
              isDay ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            1:1 P2P ESCROW
          </span>
        </div>
      </a>

      {/* Zone 2: Navigation Links + Global Marketplace Search Bar (Desktop) */}
      <div className="hidden lg:flex items-center justify-center gap-6">
        <nav
          aria-label="Primary Navigation"
          className={`flex items-center gap-5 text-xs sm:text-sm font-mono font-semibold shrink-0 ${
            isDay ? 'text-slate-900' : 'text-slate-200'
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.route;
            const isAdminNav = item.route === 'admin';
            return (
              <a
                key={item.route}
                data-testid={`nav-link-${item.route}`}
                href={`#${item.route}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.route);
                }}
                className={`py-1 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? isDay
                      ? 'text-[#0B65C6] border-[#0B65C6] font-bold'
                      : 'text-emerald-400 border-emerald-400 font-bold'
                    : isDay
                    ? 'text-slate-900 border-transparent hover:text-[#0B65C6] hover:border-slate-400'
                    : 'text-slate-200 border-transparent hover:text-white hover:border-slate-500'
                }`}
              >
                {isAdminNav && <Lock className="w-3 h-3 opacity-80" />}
                <span>{item.label}</span>
                {item.route === 'orders' && activeOrdersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-[#020617]">
                    ({activeOrdersCount})
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Global Search Bar for Assets, Payment Methods & Active Trade Offers */}
        <div
          ref={searchContainerRef}
          className="relative w-full sm:w-64 md:w-72 lg:w-80 shrink-0"
          data-testid="navbar-global-search-container"
        >
          <form onSubmit={handleFormSubmit} className="relative">
            <Search
              className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDay ? 'text-slate-400' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              data-testid="navbar-global-search-input"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search BTC, UPI, PhonePe, offers..."
              aria-label="Global search for assets, payment methods, or active trade offers"
              className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs font-mono border transition-colors focus:outline-none ${
                isDay
                  ? 'bg-slate-100/90 focus:bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-[#0B65C6]'
                  : 'bg-[#141C2B] focus:bg-[#0F1726] border-white/15 text-white placeholder:text-slate-400 focus:border-emerald-400'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(true);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Interactive Global Search Results Dropdown */}
          {searchOpen && (
            <div
              data-testid="navbar-global-search-dropdown"
              className={`absolute left-0 right-0 sm:w-[370px] mt-2 rounded-2xl border p-3.5 space-y-3.5 z-50 max-h-[430px] overflow-y-auto ${
                isDay
                  ? 'bg-white border-slate-200 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.16)]'
                  : 'bg-[#0D1422] border-white/15 text-slate-100 shadow-2xl'
              }`}
            >
              {/* 1. Matching Crypto Assets */}
              {matchedAssets.length > 0 && (
                <div className="space-y-1.5">
                  <div
                    className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                      isDay ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Crypto Assets ({matchedAssets.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchedAssets.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        data-testid={`global-search-asset-${sym}`}
                        onClick={() => triggerSelection({ asset: sym, query: '' })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                          isDay
                            ? 'bg-slate-50 hover:bg-[#0B65C6] text-slate-800 hover:text-white border-slate-200'
                            : 'bg-[#141E30] hover:bg-emerald-400 text-white hover:text-[#05080D] border-white/10'
                        }`}
                      >
                        <CryptoAssetIcon asset={sym} className="w-4 h-4 shrink-0" />
                        <span>{sym}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Matching Payment Methods */}
              {matchedPaymentMethods.length > 0 && (
                <div className="space-y-1.5">
                  <div
                    className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                      isDay ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Payment Methods ({matchedPaymentMethods.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchedPaymentMethods.map((rail) => (
                      <button
                        key={rail}
                        type="button"
                        data-testid={`global-search-rail-${rail}`}
                        onClick={() => triggerSelection({ paymentMethod: rail, query: '' })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                          isDay
                            ? 'bg-sky-50 hover:bg-[#0B65C6] text-[#0B65C6] hover:text-white border-sky-200'
                            : 'bg-[#141E30] hover:bg-emerald-400 text-emerald-300 hover:text-[#05080D] border-white/10'
                        }`}
                      >
                        <CreditCard className="w-3 h-3 shrink-0" />
                        <span>{rail}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Matching Active Trade Offers */}
              <div className="space-y-1.5">
                <div
                  className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                    isDay ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Active Trade Offers ({matchedOffers.length})
                </div>

                {matchedOffers.length === 0 ? (
                  <div className="text-xs font-mono text-slate-500 py-2">
                    No open offers matching &ldquo;{searchQuery}&rdquo;. Press Enter to search full
                    marketplace.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {matchedOffers.map((offer) => {
                      const u = userById.get(offer.makerId);
                      const trust = calculateAdvertiserTrustScore({
                        makerId: offer.makerId,
                        offerCompletedTrades: offer.completedTrades,
                        offerCompletionRatePct: offer.completionRatePct,
                        userCompletedTrades: u?.completedTrades,
                        userCompletionRatePct: u?.completionRatePct,
                        orders,
                      });
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          data-testid={`global-search-offer-${offer.id}`}
                          onClick={() =>
                            triggerSelection({
                              asset: offer.asset,
                              query: offer.makerName,
                              offerId: offer.id,
                            })
                          }
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isDay
                              ? 'bg-slate-50 hover:bg-sky-50 border-slate-200'
                              : 'bg-[#131C2E] hover:bg-[#19253D] border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CryptoAssetIcon asset={offer.asset} className="w-6 h-6 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 text-xs font-bold truncate">
                                <span className="truncate">{offer.makerName}</span>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-mono text-emerald-600">
                                  {trust.trustScore.toFixed(0)}/100
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 truncate">
                                {offer.side} {offer.asset} · {offer.paymentMethods.slice(0, 2).join(', ')}
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <div className="text-xs font-bold">
                              {FIAT_SYMBOLS[offer.fiatCurrency]}
                              {formatMinor2(offer.unitPriceFiatMinor)} {offer.fiatCurrency}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {formatMicro6(offer.availableQuantityMicro)} {offer.asset}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => triggerSelection({ query: searchQuery.trim() })}
                className={`w-full py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDay
                    ? 'bg-[#0B65C6] text-white hover:bg-[#0852A3]'
                    : 'bg-emerald-400 text-[#05080D] hover:bg-emerald-300'
                }`}
              >
                <span>Open Marketplace with Filter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Alerts Bell + Day/Night Theme Switcher + Active Account Action + Wallet Holding Balance Below on Right */}
      <div
        ref={walletBreakdownRef}
        className="relative flex flex-col items-end gap-1 sm:gap-1.5 shrink-0 max-w-full"
      >
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Payment & Order Alerts Dropdown Trigger */}
          <button
            type="button"
            data-testid="navbar-notifications-btn"
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setWalletBreakdownOpen(false);
            }}
            title="Payment Completion Alerts & Order Notifications"
            className={`relative p-1.5 sm:px-2.5 sm:py-2 rounded-lg text-xs font-mono font-bold inline-flex items-center gap-1 sm:gap-1.5 border transition-colors cursor-pointer ${
              isDay
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                : 'bg-[#141C2B] hover:bg-[#1C2638] text-emerald-400 border-white/15'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden xl:inline">Alerts</span>
            {notifications.length > 0 && (
              <span className="px-1 sm:px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500 text-[#020617]">
                {notifications.length}
              </span>
            )}
          </button>

          {onToggleTheme && (
            <button
              type="button"
              data-testid="theme-toggle-btn"
              onClick={onToggleTheme}
              title={isDay ? 'Switch to Night Mode' : 'Switch to Day Mode'}
              className={`p-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-mono font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isDay
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-[#141C2B] hover:bg-[#1C2638] text-emerald-400 border-white/15'
              }`}
            >
              {isDay ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Day UI</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Night UI</span>
                </>
              )}
            </button>
          )}

          {currentUser.wallets && currentUser.wallets.length > 0 ? (
            <button
              type="button"
              data-testid="navbar-connected-wallet-btn"
              onClick={() => onOpenAccountModal('CONNECT_WALLET')}
              className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-mono font-bold rounded-lg border transition-all whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1 sm:gap-1.5 shadow-xs ${
                isDay
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-500'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border-emerald-500/50'
              }`}
              title={`Connected: ${currentUser.wallets[0].address} (${currentUser.wallets[0].chain}) — Click to view details or disconnect`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100 hidden sm:inline">
                {currentUser.wallets[0].address.slice(0, 6)}...{currentUser.wallets[0].address.slice(-4)}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 inline sm:hidden">
                {currentUser.wallets[0].address.slice(0, 4)}..
              </span>
              <span
                className={`hidden md:inline px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                  currentUser.wallets[0].networkFamily === 'SOLANA_SPL'
                    ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-400/30'
                    : 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {currentUser.wallets[0].networkFamily === 'SOLANA_SPL' ? 'SOL' : 'EVM'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="navbar-connect-wallet-btn"
              onClick={() => onOpenAccountModal('CONNECT_WALLET')}
              className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-mono font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1 sm:gap-1.5 ${
                isDay
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-[#141C2B] hover:bg-[#1C2638] text-emerald-400 border-emerald-500/40'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="inline sm:hidden">Wallet</span>
            </button>
          )}

          <button
            type="button"
            data-testid="navbar-account-btn"
            onClick={() => onOpenAccountModal('USER_LOGIN')}
            className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1 sm:gap-1.5 ${
              isDay
                ? 'bg-[#0B65C6] hover:bg-[#0953A6] text-white shadow-sm'
                : 'bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14]'
            }`}
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={shortName}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-white/40 shrink-0"
              />
            ) : (
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden md:inline">
              {currentUser.role === 'ADMIN'
                ? 'Admin'
                : `${shortName} · ${countryCode}/${lockedFiat}`}
            </span>
            <span className="inline md:hidden max-w-[64px] truncate">{shortName}</span>
          </button>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            data-testid="navbar-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`lg:hidden p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isDay
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                : 'bg-[#141C2B] hover:bg-[#1C2638] text-slate-200 border-white/15'
            }`}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* User Wallet Balance & Total Worth in Rupees (₹ INR) directly below Wallet / Login on the Right */}
        <button
          type="button"
          data-testid="navbar-wallet-holding-balance"
          onClick={() => setWalletBreakdownOpen((prev) => !prev)}
          title="Click to inspect your crypto holdings and total Rupee (INR) worth"
          className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono tabular-nums inline-flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer max-w-full truncate ${
            isDay
              ? 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300 text-slate-900'
              : 'bg-[#131A24] hover:bg-[#1A2433] border-emerald-500/35 text-slate-200'
          }`}
        >
          <Wallet className={`w-3 h-3 shrink-0 ${isDay ? 'text-emerald-700' : 'text-emerald-400'}`} />
          <span className="text-slate-400 hidden sm:inline">Holding:</span>
          <span className="font-bold truncate">
            {walletHoldingSummary.usdtFormatted} USDT
          </span>
          <span className="text-slate-500">·</span>
          <span className={`font-bold truncate ${isDay ? 'text-emerald-800' : 'text-emerald-400'}`}>
            Worth ₹{walletHoldingSummary.totalInrFormatted} INR
          </span>
        </button>

        {/* Payment Completion Alerts & Notifications Popover */}
        {notificationsOpen && (
          <div
            data-testid="navbar-notifications-popover"
            className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full mt-1 sm:mt-2 w-auto sm:w-96 rounded-2xl border p-4 space-y-3 z-50 ${
              isDay
                ? 'bg-white border-slate-200 text-slate-900 shadow-2xl'
                : 'bg-[#0D1422] border-emerald-500/35 text-slate-100 shadow-2xl'
            }`}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400">
                  Payment &amp; Order Alerts ({notifications.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-mono">
                No payment completion alerts yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.slice(0, 12).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setNotificationsOpen(false);
                      if (notif.orderId && onOpenOrderFromNotification) {
                        onOpenOrderFromNotification(notif.orderId);
                      } else {
                        onNavigate('orders');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer space-y-1 ${
                      isDay
                        ? 'bg-slate-50 hover:bg-emerald-50/70 border-slate-200'
                        : 'bg-[#131A24] hover:bg-[#192434] border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-400 truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{notif.message}</p>
                    {notif.orderId && (
                      <div className="text-[10px] font-mono text-cyan-400 pt-0.5">
                        Click to open Order #{notif.orderId} →
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right-Aligned Wallet Holdings & Rupee Worth Breakdown Popover */}
        {walletBreakdownOpen && (
          <div
            data-testid="navbar-wallet-holdings-popover"
            className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full mt-1 sm:mt-2 w-auto sm:w-96 rounded-2xl border p-4 space-y-3 z-50 ${
              isDay
                ? 'bg-white border-slate-200 text-slate-900 shadow-2xl'
                : 'bg-[#0D1422] border-emerald-500/35 text-slate-100 shadow-2xl'
            }`}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400">
                  Wallet Holdings &amp; Rupee Worth
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWalletBreakdownOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                aria-label="Close wallet holdings breakdown"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border font-mono ${
                isDay
                  ? 'bg-emerald-50 border-emerald-200 text-slate-900'
                  : 'bg-[#131A24] border-emerald-500/30 text-slate-100'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Total Worth of Crypto Holdings (Rupees)
              </div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                ₹{walletHoldingSummary.totalInrFormatted} INR
              </div>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {walletHoldingSummary.perAsset.map((row) => (
                <div
                  key={row.asset}
                  className={`px-3 py-2 rounded-lg border flex items-center justify-between text-xs font-mono ${
                    isDay
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-[#131A24]/80 border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CryptoAssetIcon asset={row.asset} className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-bold">{row.asset}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatMicro6(row.availableMicro)} {row.asset}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">
                      ₹{formatMinor2(row.availableInrMinor)} INR
                    </div>
                    <div className="text-[10px] text-slate-400">
                      @ ₹{formatMinor2(row.unitPriceInrMinor)}/{row.asset}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setWalletBreakdownOpen(false);
                  onOpenAccountModal('CONNECT_WALLET');
                }}
                className="py-2 px-3 rounded-lg text-xs font-mono font-bold bg-emerald-500 text-[#0B0E14] hover:bg-emerald-400 cursor-pointer text-center"
              >
                Open Wallet
              </button>
              <button
                type="button"
                onClick={() => {
                  setWalletBreakdownOpen(false);
                  onNavigate('dashboard');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border cursor-pointer text-center ${
                  isDay
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-[#141C2B] hover:bg-[#1C2638] border-white/15 text-slate-200'
                }`}
              >
                Profile &amp; Custody
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Slide-Down Drawer (< lg screens) */}
      {mobileMenuOpen && (
        <div
          data-testid="navbar-mobile-drawer"
          className={`lg:hidden w-full border-t px-4 py-4 space-y-4 transition-all ${
            isDay
              ? 'bg-white border-slate-200 shadow-xl'
              : 'bg-[#0B0E14] border-white/10'
          }`}
        >
          {/* Mobile Global Search Bar */}
          <div className="relative">
            <form onSubmit={handleFormSubmit} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search BTC, ETH, SOL, UPI, IMPS..."
                className={`w-full pl-8 pr-8 py-2 rounded-lg text-xs font-mono border focus:outline-none ${
                  isDay
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    : 'bg-[#131A24] border-white/15 text-slate-100 placeholder:text-slate-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </form>
          </div>

          {/* Navigation Links with Icons */}
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  data-testid={`mobile-drawer-link-${item.route}`}
                  onClick={() => {
                    onNavigate(item.route);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-mono font-bold transition-colors text-left cursor-pointer ${
                    isActive
                      ? isDay
                        ? 'bg-sky-100 text-[#0B65C6]'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isDay
                      ? 'text-slate-800 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? (isDay ? 'text-[#0B65C6]' : 'text-emerald-400') : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.route === 'orders' && activeOrdersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-[#020617]">
                        {activeOrdersCount} active
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Footer Status */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Corridor: {countryCode}/{lockedFiat}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenAccountModal('USER_LOGIN');
                setMobileMenuOpen(false);
              }}
              className="text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Account Details
            </button>
          </div>
        </div>
      )}
    </header>

    {/* Mobile Bottom Navigation Bar (< lg screens) */}
    <nav
      data-testid="navbar-mobile-bottom-bar"
      aria-label="Mobile Bottom Navigation"
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 px-1 sm:px-2 py-1.5 border-t backdrop-blur-md grid grid-cols-6 gap-0.5 items-center transition-colors ${
        isDay
          ? 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]'
          : 'bg-[#0B0E14]/95 border-white/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]'
      }`}
    >
      {[
        { route: 'marketplace' as AppRoute, label: 'P2P Market', icon: <Store className="w-4 h-4 sm:w-5 sm:h-5" /> },
        { route: 'pulse' as AppRoute, label: 'Trader Feed', icon: <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" /> },
        { route: 'swap' as AppRoute, label: 'Swap', icon: <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" /> },
        { route: 'create-offer' as AppRoute, label: 'Post Ad', icon: <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" /> },
        {
          route: 'orders' as AppRoute,
          label: activeOrdersCount > 0 ? `Orders (${activeOrdersCount})` : 'Orders',
          icon: (
            <div className="relative">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </div>
          ),
        },
        { route: 'dashboard' as AppRoute, label: 'Profile', icon: <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" /> },
      ].map((item) => {
        const isActive = activeRoute === item.route;
        return (
          <button
            key={item.route}
            type="button"
            data-testid={`mobile-bottom-nav-${item.route}`}
            onClick={() => onNavigate(item.route)}
            className={`flex flex-col items-center justify-center gap-1 min-w-0 w-full py-1 px-0.5 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? isDay
                  ? 'text-[#0B65C6] font-bold'
                  : 'text-emerald-400 font-bold'
                : isDay
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[9px] sm:text-[10px] font-mono leading-none truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  </>
  );
};
