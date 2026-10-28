import React, { useEffect, useMemo, useState } from 'react';
import {
  ALL_FIAT_CURRENCIES,
  COUNTRY_ORDER_LIST,
  FIAT_SYMBOLS,
  TOP_TRADING_COUNTRIES,
  calculateAdvertiserTrustScore,
  type AdvertiserTrustMetrics,
  type AssetBalance,
  type CountryCode,
  type CryptoAsset,
  type EscrowOrderRecord,
  type FiatCurrency,
  type LivePriceFeed,
  type OfferRecord,
  type PriceAlertRecord,
  type PriceAlertWorkerStatus,
  type UserProfile,
} from '../types';
import {
  calculateTradeBreakdown,
  calculateAutoUnitPriceFiat,
  calculateFiatFromCryptoQuantity,
  formatMicro6,
  formatMinor2,
  parseFiatToMinor,
  DAILY_TRADING_LIMIT_USD,
  calculateMaxOrderCapMinor,
  calculateUserDailyLimitStatus,
  USD_REFERENCE_RATES,
} from '../core/escrowEngine';
import { CryptoAssetIcon } from './CryptoAssetIcons';
import {
  CustomSelect,
  buildCountryCurrencyOptions,
  buildCryptoAssetOptions,
  buildFiatCurrencyOptions,
} from './CustomSelect';
import {
  AlertTriangle,
  ArrowUpDown,
  BellRing,
  CheckCircle2,
  Globe2,
  Lock,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  Plus,
} from 'lucide-react';

import type { GlobalSearchSelection } from './Navbar';
import { PublishedOffersManager, type EditOfferPayload } from './PublishedOffersManager';

interface MarketplaceViewProps {
  offers: OfferRecord[];
  orders?: EscrowOrderRecord[];
  allUsers?: UserProfile[];
  currentUser?: UserProfile;
  balances: AssetBalance[];
  feeBps: number;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  currentUserId: string;
  userEmail: string;
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => Promise<void>;
  priceAlerts: PriceAlertRecord[];
  workerStatus: PriceAlertWorkerStatus;
  initialSide?: 'BUY_CRYPTO' | 'SELL_CRYPTO';
  externalSearchSelection?: GlobalSearchSelection | null;
  onAcceptOffer: (params: {
    offerId: string;
    grossFiatAmount: string;
    paymentMethod: string;
  }) => Promise<void>;
  onUpdateOfferStatus?: (
    offerId: string,
    action: 'PAUSE' | 'RESUME' | 'CANCEL'
  ) => Promise<void>;
  onEditOffer?: (offerId: string, payload: EditOfferPayload) => Promise<void>;
  onAddPaymentMethod?: (payload: {
    methodName: string;
    category: 'UPI_APP' | 'CARD' | 'BANK_TRANSFER';
    fiatCurrency: FiatCurrency;
    accountHolder: string;
    accountIdentifier: string;
    bankOrProvider: string;
    verifyImmediately: boolean;
  }) => Promise<void>;
  onCreatePriceAlert: (params: {
    asset: CryptoAsset;
    fiatCurrency: FiatCurrency;
    direction: 'AT_OR_BELOW' | 'AT_OR_ABOVE';
    targetPriceFiat: string;
    channel: 'IN_APP' | 'EMAIL' | 'BOTH';
    userEmail: string;
  }) => Promise<void>;
  onDeletePriceAlert: (alertId: string) => Promise<void>;
  onRunAlertWorker: () => Promise<void>;
  livePriceFeed?: LivePriceFeed;
}

const ASSETS: CryptoAsset[] = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL'];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  offers,
  orders = [],
  allUsers = [],
  currentUser,
  balances = [],
  feeBps,
  supportedPaymentMethods,
  currentUserId,
  userEmail,
  selectedCountry,
  onSelectCountry,
  priceAlerts,
  workerStatus,
  initialSide = 'BUY_CRYPTO',
  externalSearchSelection,
  onAcceptOffer,
  onUpdateOfferStatus,
  onEditOffer,
  onAddPaymentMethod,
  onCreatePriceAlert,
  onDeletePriceAlert,
  onRunAlertWorker,
  livePriceFeed,
}) => {
  const activeCountryPolicy = TOP_TRADING_COUNTRIES[selectedCountry] || TOP_TRADING_COUNTRIES.IN;
  const lockedFiatForCountry = activeCountryPolicy.fiatCurrency;
  const liveLocalExchangeRate =
    livePriceFeed?.fiatExchangeRates?.[lockedFiatForCountry] ??
    (lockedFiatForCountry === 'INR' && livePriceFeed?.usdInrRate
      ? livePriceFeed.usdInrRate
      : activeCountryPolicy.usdExchangeRate);

  const balanceMap = useMemo(() => {
    const map = new Map<CryptoAsset, AssetBalance>();
    for (const b of balances) {
      map.set(b.asset, b);
    }
    return map;
  }, [balances]);

  // BUY_CRYPTO means user wants to buy crypto (looks at maker SELL offers)
  // SELL_CRYPTO means user wants to sell crypto (looks at maker BUY offers)
  const [tradeTab, setTradeTab] = useState<'BUY_CRYPTO' | 'SELL_CRYPTO'>(initialSide);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | 'ALL'>('ALL');
  const [selectedFiat, setSelectedFiat] = useState<FiatCurrency | 'ALL'>(lockedFiatForCountry);
  const [strictCountryFilter, setStrictCountryFilter] = useState<boolean>(true);
  const [fiatAmountFilter, setFiatAmountFilter] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [advertiserQuery, setAdvertiserQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'PRICE' | 'TRUST_SCORE' | 'TRADES' | 'COMPLETION'>('PRICE');

  // Price Alerts Drawer / Panel State (collapsed by default so Buy/Sell page stays clean & simple)
  const [showAlertsPanel, setShowAlertsPanel] = useState<boolean>(false);
  const [alertAsset, setAlertAsset] = useState<CryptoAsset>('USDT');
  const [alertFiat, setAlertFiat] = useState<FiatCurrency>(lockedFiatForCountry);
  const [alertDirection, setAlertDirection] = useState<'AT_OR_BELOW' | 'AT_OR_ABOVE'>('AT_OR_BELOW');
  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('87.00');
  const [alertChannel, setAlertChannel] = useState<'IN_APP' | 'EMAIL' | 'BOTH'>('IN_APP');
  const [alertEmail, setAlertEmail] = useState<string>(userEmail || 'alex.rivera@costorah.io');
  const [alertBusy, setAlertBusy] = useState<boolean>(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Selected offer for modal/drawer order placement & details inspection
  const [activeOffer, setActiveOffer] = useState<OfferRecord | null>(null);
  const [orderFiatInput, setOrderFiatInput] = useState<string>('10000.00');
  const [orderCryptoInput, setOrderCryptoInput] = useState<string>('0.000000');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Inline "+ Add Payment Method to Profile" inside Order Modal (Binance P2P style)
  const [showAddPmInline, setShowAddPmInline] = useState<boolean>(false);
  const [newPmName, setNewPmName] = useState<string>('PhonePe');
  const [newPmIdentifier, setNewPmIdentifier] = useState<string>('');
  const [newPmBank, setNewPmBank] = useState<string>('Yes Bank / UPI');
  const [addingPmBusy, setAddingPmBusy] = useState<boolean>(false);

  // Double-confirmation modal/popover state for Pause & Cancel on own offers in the Market Order Book & Inspect Modal
  const [orderBookConfirmOfferAction, setOrderBookConfirmOfferAction] = useState<{
    offer: OfferRecord;
    action: 'PAUSE' | 'CANCEL';
  } | null>(null);
  const [orderBookOfferActionBusy, setOrderBookOfferActionBusy] = useState<boolean>(false);

  const handleConfirmOrderBookOfferAction = async () => {
    if (!orderBookConfirmOfferAction || !onUpdateOfferStatus) return;
    setOrderBookOfferActionBusy(true);
    try {
      await onUpdateOfferStatus(
        orderBookConfirmOfferAction.offer.id,
        orderBookConfirmOfferAction.action
      );
      if (activeOffer?.id === orderBookConfirmOfferAction.offer.id) {
        setActiveOffer(null);
      }
      setOrderBookConfirmOfferAction(null);
    } finally {
      setOrderBookOfferActionBusy(false);
    }
  };

  const activeUserProfile = useMemo(() => {
    if (currentUser) return currentUser;
    return allUsers.find((u) => u.id === currentUserId);
  }, [currentUser, allUsers, currentUserId]);

  const userSavedPaymentMethods = useMemo(() => {
    return activeUserProfile?.paymentMethods || [];
  }, [activeUserProfile]);

  const dailyLimitStatus = useMemo(
    () => calculateUserDailyLimitStatus(orders, currentUserId),
    [orders, currentUserId]
  );

  // Sync selectedFiat and alertFiat whenever user changes their active Country Lock
  useEffect(() => {
    setSelectedFiat(lockedFiatForCountry);
    setAlertFiat(lockedFiatForCountry);
    const autoAlertPrice = calculateAutoUnitPriceFiat({
      asset: alertAsset,
      countryCode: selectedCountry,
      pricingType: 'FIXED',
    });
    setAlertTargetPrice(autoAlertPrice.unitPriceFiatFormatted);
    setSelectedPaymentMethod('ALL');
  }, [lockedFiatForCountry, selectedCountry, alertAsset]);

  // Apply selections triggered from the Navbar Global Search Bar
  useEffect(() => {
    if (!externalSearchSelection) return;
    if (externalSearchSelection.asset !== undefined) {
      setSelectedAsset(externalSearchSelection.asset);
    }
    if (externalSearchSelection.paymentMethod !== undefined) {
      setSelectedPaymentMethod(externalSearchSelection.paymentMethod);
    } else {
      setSelectedPaymentMethod('ALL');
    }
    if (externalSearchSelection.query !== undefined) {
      setAdvertiserQuery(externalSearchSelection.query);
    }
    if (externalSearchSelection.offerId) {
      const target = offers.find((o) => o.id === externalSearchSelection.offerId);
      if (target) {
        setTradeTab(target.side === 'SELL' ? 'BUY_CRYPTO' : 'SELL_CRYPTO');
      }
    }
  }, [externalSearchSelection, offers]);

  const effectiveFiatFilter = strictCountryFilter ? lockedFiatForCountry : selectedFiat;

  const availablePaymentFilterOptions = useMemo(() => {
    if (effectiveFiatFilter === 'ALL') {
      return Array.from(new Set(Object.values(supportedPaymentMethods).flat()));
    }
    return supportedPaymentMethods[effectiveFiatFilter] || [];
  }, [effectiveFiatFilter, supportedPaymentMethods]);

  const trustByOfferId = useMemo(() => {
    const map = new Map<string, AdvertiserTrustMetrics>();
    const userById = new Map<string, UserProfile>();
    for (const u of allUsers) {
      userById.set(u.id, u);
    }
    for (const o of offers) {
      const u = userById.get(o.makerId);
      map.set(
        o.id,
        calculateAdvertiserTrustScore({
          makerId: o.makerId,
          offerCompletedTrades: o.completedTrades,
          offerCompletionRatePct: o.completionRatePct,
          userCompletedTrades: u?.completedTrades,
          userCompletionRatePct: u?.completionRatePct,
          userReputationScore: u?.reputationScore,
          orders,
        })
      );
    }
    return map;
  }, [offers, allUsers, orders]);

  const filteredOffers = useMemo(() => {
    const targetMakerSide = tradeTab === 'BUY_CRYPTO' ? 'SELL' : 'BUY';

    return offers
      .filter((o) => {
        if (o.status === 'CANCELLED' || o.status === 'FILLED') return false;
        if (o.side !== targetMakerSide) return false;
        if (onlyAvailable && (o.status !== 'OPEN' || o.availableQuantityMicro <= 0)) return false;
        if (selectedAsset !== 'ALL' && o.asset !== selectedAsset) return false;
        if (
          effectiveFiatFilter !== 'ALL' &&
          o.fiatCurrency !== effectiveFiatFilter &&
          o.makerId !== currentUserId
        ) {
          return false;
        }
        if (selectedPaymentMethod !== 'ALL' && !o.paymentMethods.includes(selectedPaymentMethod)) {
          return false;
        }
        if (advertiserQuery.trim()) {
          const q = advertiserQuery.trim().toLowerCase();
          const searchable = `${o.makerName} ${o.asset} ${o.fiatCurrency} ${o.paymentMethods.join(' ')} ${o.id}`.toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        if (fiatAmountFilter.trim()) {
          try {
            const minor = parseFiatToMinor(fiatAmountFilter);
            if (minor < o.minOrderFiatMinor || minor > o.maxOrderFiatMinor) return false;
          } catch {
            // Ignore partial invalid filter typing
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE') {
          return tradeTab === 'BUY_CRYPTO'
            ? a.unitPriceFiatMinor - b.unitPriceFiatMinor
            : b.unitPriceFiatMinor - a.unitPriceFiatMinor;
        }
        if (sortBy === 'TRUST_SCORE') {
          const scoreA = trustByOfferId.get(a.id)?.trustScore ?? 0;
          const scoreB = trustByOfferId.get(b.id)?.trustScore ?? 0;
          return scoreB - scoreA;
        }
        if (sortBy === 'TRADES') {
          return b.completedTrades - a.completedTrades;
        }
        return b.completionRatePct - a.completionRatePct;
      });
  }, [
    offers,
    tradeTab,
    onlyAvailable,
    selectedAsset,
    effectiveFiatFilter,
    selectedPaymentMethod,
    advertiserQuery,
    fiatAmountFilter,
    sortBy,
    trustByOfferId,
  ]);

  const openOrderModal = (offer: OfferRecord) => {
    setActiveOffer(offer);
    const maxCapMinor = calculateMaxOrderCapMinor({
      asset: offer.asset,
      unitPriceFiatMinor: offer.unitPriceFiatMinor,
    });
    const offerTotalFiatMinor = Math.max(
      1,
      Math.round((offer.availableQuantityMicro * offer.unitPriceFiatMinor) / 1_000_000)
    );
    const effectiveMaxMinor = Math.min(
      offer.maxOrderFiatMinor,
      offerTotalFiatMinor,
      maxCapMinor
    );
    const effectiveMinMinor = Math.min(offer.minOrderFiatMinor, effectiveMaxMinor);
    const defaultFiat = Math.max(
      effectiveMinMinor,
      Math.min(Math.round(effectiveMaxMinor * 0.5), effectiveMaxMinor)
    );
    const formattedFiat = formatMinor2(defaultFiat);
    setOrderFiatInput(formattedFiat);
    try {
      const bd = calculateTradeBreakdown({
        grossFiatInput: formattedFiat,
        unitPriceFiatInput: formatMinor2(offer.unitPriceFiatMinor),
        fiatCurrency: offer.fiatCurrency,
        cryptoAsset: offer.asset,
        feeBps,
      });
      setOrderCryptoInput(bd.cryptoQuantityFormatted);
    } catch {
      setOrderCryptoInput('0.000000');
    }
    const matchingSaved = userSavedPaymentMethods.filter(
      (pm) => pm.fiatCurrency === offer.fiatCurrency
    );
    const preferredSaved =
      matchingSaved.find((pm) => offer.paymentMethods.includes(pm.methodName)) ||
      matchingSaved[0];
    setOrderPaymentMethod(preferredSaved?.methodName || offer.paymentMethods[0] || 'PhonePe');
    setShowAddPmInline(false);
    setOrderError(null);
  };

  const handleQuickAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddPaymentMethod || !activeOffer) return;
    if (!newPmIdentifier.trim()) {
      setOrderError('Please enter your UPI ID or bank account number to save to your profile.');
      return;
    }
    setAddingPmBusy(true);
    setOrderError(null);
    try {
      const isUpi = ['phonepe', 'google pay', 'gpay', 'paytm', 'upi'].some((k) =>
        newPmName.toLowerCase().includes(k)
      );
      await onAddPaymentMethod({
        methodName: newPmName,
        category: isUpi ? 'UPI_APP' : 'BANK_TRANSFER',
        fiatCurrency: activeOffer.fiatCurrency,
        accountHolder: activeUserProfile?.displayName.replace(' (You)', '') || 'Verified Trader',
        accountIdentifier: newPmIdentifier.trim(),
        bankOrProvider: newPmBank.trim() || newPmName,
        verifyImmediately: true,
      });
      setOrderPaymentMethod(newPmName);
      setNewPmIdentifier('');
      setShowAddPmInline(false);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'Failed to save payment method');
    } finally {
      setAddingPmBusy(false);
    }
  };

  const handleOrderFiatChange = (nextFiat: string) => {
    setOrderFiatInput(nextFiat);
    if (!activeOffer) return;
    try {
      const bd = calculateTradeBreakdown({
        grossFiatInput: nextFiat,
        unitPriceFiatInput: formatMinor2(activeOffer.unitPriceFiatMinor),
        fiatCurrency: activeOffer.fiatCurrency,
        cryptoAsset: activeOffer.asset,
        feeBps,
      });
      setOrderCryptoInput(bd.cryptoQuantityFormatted);
    } catch {
      // ignore partial input while typing
    }
  };

  const handleOrderCryptoChange = (nextCrypto: string) => {
    setOrderCryptoInput(nextCrypto);
    if (!activeOffer) return;
    try {
      const calc = calculateFiatFromCryptoQuantity({
        cryptoQuantityInput: nextCrypto,
        unitPriceFiatInput: formatMinor2(activeOffer.unitPriceFiatMinor),
        fiatCurrency: activeOffer.fiatCurrency,
        cryptoAsset: activeOffer.asset,
        feeBps,
      });
      if (calc && calc.grossFiatMinor > 0) {
        setOrderFiatInput(calc.grossFiatFormatted);
      }
    } catch {
      // ignore partial input while typing
    }
  };

  const liveBreakdown = useMemo(() => {
    if (!activeOffer) return null;
    try {
      return calculateTradeBreakdown({
        grossFiatInput: orderFiatInput,
        unitPriceFiatInput: formatMinor2(activeOffer.unitPriceFiatMinor),
        fiatCurrency: activeOffer.fiatCurrency,
        cryptoAsset: activeOffer.asset,
        feeBps,
      });
    } catch {
      return null;
    }
  }, [activeOffer, orderFiatInput, feeBps]);

  const activeOfferCapMinor = useMemo(() => {
    if (!activeOffer) return 0;
    return calculateMaxOrderCapMinor({
      asset: activeOffer.asset,
      unitPriceFiatMinor: activeOffer.unitPriceFiatMinor,
    });
  }, [activeOffer]);

  const activeOfferTotalFiatMinor = useMemo(() => {
    if (!activeOffer) return 0;
    return Math.max(
      1,
      Math.round((activeOffer.availableQuantityMicro * activeOffer.unitPriceFiatMinor) / 1_000_000)
    );
  }, [activeOffer]);

  const activeOfferEffectiveMaxMinor = useMemo(() => {
    if (!activeOffer) return 0;
    return Math.min(
      activeOffer.maxOrderFiatMinor,
      activeOfferTotalFiatMinor,
      activeOfferCapMinor
    );
  }, [activeOffer, activeOfferTotalFiatMinor, activeOfferCapMinor]);

  const activeOfferEffectiveMinMinor = useMemo(() => {
    if (!activeOffer) return 0;
    return Math.min(activeOffer.minOrderFiatMinor, activeOfferEffectiveMaxMinor);
  }, [activeOffer, activeOfferEffectiveMaxMinor]);

  const orderUsdEquivalent = useMemo(() => {
    if (!activeOffer || !liveBreakdown) return 0;
    const cryptoUnits = liveBreakdown.cryptoQuantityMicro / 1_000_000;
    const usdRate =
      livePriceFeed?.rates?.[activeOffer.asset]?.usd ??
      USD_REFERENCE_RATES[activeOffer.asset] ??
      1.0;
    return Number((cryptoUnits * usdRate).toFixed(2));
  }, [activeOffer, liveBreakdown, livePriceFeed]);

  const orderLimitValidationError = useMemo(() => {
    if (!activeOffer) return null;
    const sym = FIAT_SYMBOLS[activeOffer.fiatCurrency];
    let enteredMinor = 0;
    try {
      enteredMinor = parseFiatToMinor(orderFiatInput);
    } catch {
      return `Please enter a valid order amount in ${activeOffer.fiatCurrency}.`;
    }
    if (enteredMinor < activeOfferEffectiveMinMinor) {
      return `Order amount (${sym}${formatMinor2(enteredMinor)}) is below the Min Order Limit of ${sym}${formatMinor2(activeOfferEffectiveMinMinor)} ${activeOffer.fiatCurrency}.`;
    }
    if (enteredMinor > activeOfferEffectiveMaxMinor) {
      return `Order amount (${sym}${formatMinor2(enteredMinor)}) exceeds the Max Order Limit of ${sym}${formatMinor2(activeOfferEffectiveMaxMinor)} ${activeOffer.fiatCurrency}.`;
    }
    const isBuying = activeOffer.side === 'SELL';
    const remainingDailyUsd = isBuying
      ? dailyLimitStatus.dailyBuyRemainingUsd
      : dailyLimitStatus.dailySellRemainingUsd;
    if (orderUsdEquivalent > remainingDailyUsd) {
      return `Daily ${isBuying ? 'Buy' : 'Sell'} Limit Exceeded: This order ($${orderUsdEquivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD) exceeds your remaining daily ${isBuying ? 'buy' : 'sell'} limit of $${remainingDailyUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ($${DAILY_TRADING_LIMIT_USD.toLocaleString()}/day max).`;
    }
    return null;
  }, [
    activeOffer,
    orderFiatInput,
    activeOfferEffectiveMinMinor,
    activeOfferEffectiveMaxMinor,
    orderUsdEquivalent,
    dailyLimitStatus,
  ]);

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOffer) return;
    setOrderError(null);
    if (orderLimitValidationError) {
      setOrderError(orderLimitValidationError);
      return;
    }
    setSubmitting(true);
    try {
      await onAcceptOffer({
        offerId: activeOffer.id,
        grossFiatAmount: orderFiatInput,
        paymentMethod: orderPaymentMethod || activeOffer.paymentMethods[0],
      });
      setActiveOffer(null);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'Failed to lock escrow order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    setAlertFeedback(null);
    setAlertBusy(true);
    try {
      await onCreatePriceAlert({
        asset: alertAsset,
        fiatCurrency: alertFiat,
        direction: alertDirection,
        targetPriceFiat: alertTargetPrice,
        channel: alertChannel,
        userEmail: alertEmail,
      });
      setAlertFeedback(
        `Created ${alertChannel} alert for ${alertAsset}/${alertFiat} (${
          alertDirection === 'AT_OR_BELOW' ? '≤' : '≥'
        } ${FIAT_SYMBOLS[alertFiat]}${alertTargetPrice}). Background worker evaluated active offers.`
      );
    } catch (err: unknown) {
      setAlertError(err instanceof Error ? err.message : 'Failed to create price alert');
    } finally {
      setAlertBusy(false);
    }
  };

  const handleManualWorkerScan = async () => {
    setAlertBusy(true);
    setAlertError(null);
    try {
      await onRunAlertWorker();
      setAlertFeedback('Background worker scan completed against open P2P order book.');
    } catch (err: unknown) {
      setAlertError(err instanceof Error ? err.message : 'Worker scan failed');
    } finally {
      setAlertBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Buy/Sell Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="text-xs font-medium text-slate-400 flex flex-wrap items-center gap-2">
            <span>Escrow-Protected Order Book · {(feeBps / 100).toFixed(2)}% Seller Fee · 0% Buyer Fee</span>
            <span
              data-testid="daily-trading-limit-badge"
              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
            >
              Daily Limit: Buy ${dailyLimitStatus.dailyBuyRemainingUsd.toLocaleString()} / $10,000 · Sell ${dailyLimitStatus.dailySellRemainingUsd.toLocaleString()} / $10,000
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1">
            P2P Cryptocurrency Marketplace
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start">
          <button
            type="button"
            onClick={() => setShowAlertsPanel((prev) => !prev)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <BellRing className="w-3.5 h-3.5 text-emerald-400" />
            <span>Price Alerts ({priceAlerts.length})</span>
          </button>

          {/* Interactive Segmented Control (Buy Crypto vs Sell Crypto) */}
          <div
            role="tablist"
            aria-label="Trade Direction"
            className="inline-flex p-1 bg-[#131A24] border border-white/[0.08] rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tradeTab === 'BUY_CRYPTO'}
              onClick={() => setTradeTab('BUY_CRYPTO')}
              className={`px-5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tradeTab === 'BUY_CRYPTO'
                  ? 'bg-emerald-500 text-[#0B0E14]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Buy Crypto with Fiat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tradeTab === 'SELL_CRYPTO'}
              onClick={() => setTradeTab('SELL_CRYPTO')}
              className={`px-5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tradeTab === 'SELL_CRYPTO'
                  ? 'bg-amber-400 text-[#0B0E14]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sell Crypto for Fiat
            </button>
          </div>
        </div>
      </div>

      {/* Removed duplicate Country-to-Fiat Lock Bar & Top 10 Corridors row per user request; unified into a single Country & Currency dropdown in the Filter Bar below */}

      {/* Asset/Fiat Price Alerts & Background Worker Console */}
      {showAlertsPanel && (
        <section
          aria-label="Marketplace Price Alerts"
          className="bg-[#131A24] border border-emerald-500/25 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5" />
                <span>
                  Background Price Alert Worker · Scans Every {workerStatus.intervalSeconds}s · Total Scans:{' '}
                  {workerStatus.totalScans}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-100 font-display mt-0.5">
                Automated Email & In-App Price Alerts by Asset/Fiat Pair
              </h2>
            </div>

            <button
              type="button"
              onClick={handleManualWorkerScan}
              disabled={alertBusy}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#18212F] hover:bg-slate-700 border border-white/10 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 self-start"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${alertBusy ? 'animate-spin' : ''}`} />
              <span>Run Worker Scan Now</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Create Price Alert Form */}
            <form
              onSubmit={handleCreateAlertSubmit}
              className="lg:col-span-5 bg-[#0B0E14] border border-white/[0.06] rounded-lg p-4 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-200">
                Create New Asset / Fiat Price Alert
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="alert-asset" className="block text-xs text-slate-400 mb-1">
                    Crypto Asset
                  </label>
                  <CustomSelect
                    id="alert-asset"
                    testId="alert-asset"
                    value={alertAsset}
                    onChange={(val) => setAlertAsset(val as CryptoAsset)}
                    options={buildCryptoAssetOptions(ASSETS)}
                    searchable={false}
                  />
                </div>

                <div>
                  <label htmlFor="alert-fiat" className="block text-xs text-slate-400 mb-1">
                    Fiat Currency
                  </label>
                  <CustomSelect
                    id="alert-fiat"
                    testId="alert-fiat"
                    value={alertFiat}
                    onChange={(val) => setAlertFiat(val as FiatCurrency)}
                    options={buildFiatCurrencyOptions(ALL_FIAT_CURRENCIES)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="alert-direction" className="block text-xs text-slate-400 mb-1">
                    Trigger Condition
                  </label>
                  <CustomSelect
                    id="alert-direction"
                    testId="alert-direction"
                    value={alertDirection}
                    onChange={(val) => setAlertDirection(val as 'AT_OR_BELOW' | 'AT_OR_ABOVE')}
                    options={[
                      {
                        value: 'AT_OR_BELOW',
                        badgeText: '≤ DIP',
                        badgeVariant: 'emerald',
                        label: 'Price ≤ Target (Buy Dip)',
                      },
                      {
                        value: 'AT_OR_ABOVE',
                        badgeText: '≥ PEAK',
                        badgeVariant: 'amber',
                        label: 'Price ≥ Target (Sell Peak)',
                      },
                    ]}
                    searchable={false}
                  />
                </div>

                <div>
                  <label htmlFor="alert-target-price" className="block text-xs text-slate-400 mb-1">
                    Target Price ({FIAT_SYMBOLS[alertFiat]})
                  </label>
                  <input
                    id="alert-target-price"
                    type="text"
                    required
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    placeholder="e.g. 87.00"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className={alertChannel === 'IN_APP' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="alert-channel" className="block text-xs text-slate-400 mb-1">
                    Delivery Channel
                  </label>
                  <CustomSelect
                    id="alert-channel"
                    testId="alert-channel"
                    value={alertChannel}
                    onChange={(val) => setAlertChannel(val as 'IN_APP' | 'EMAIL' | 'BOTH')}
                    options={[
                      {
                        value: 'IN_APP',
                        badgeText: 'BELL',
                        badgeVariant: 'emerald',
                        label: 'In-App Notification Only',
                      },
                      {
                        value: 'BOTH',
                        badgeText: 'ALL',
                        badgeVariant: 'blue',
                        label: 'Email + In-App Alert',
                      },
                      {
                        value: 'EMAIL',
                        badgeText: 'MAIL',
                        badgeVariant: 'amber',
                        label: 'Email Dispatch Only',
                      },
                    ]}
                    searchable={false}
                  />
                </div>

                {alertChannel !== 'IN_APP' && (
                  <div>
                    <label htmlFor="alert-email" className="block text-xs text-slate-400 mb-1">
                      Recipient Email
                    </label>
                    <input
                      id="alert-email"
                      type="email"
                      required
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                    />
                  </div>
                )}
              </div>

              {alertChannel === 'IN_APP' && (
                <div
                  data-testid="in-app-only-alert-hint"
                  className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2"
                >
                  In-App Notification Only selected — no email address required. Alerts appear directly in your account notification bell.
                </div>
              )}

              {alertError && (
                <div className="text-xs text-red-300 bg-red-950/50 border border-red-500/30 rounded px-3 py-2">
                  {alertError}
                </div>
              )}
              {alertFeedback && (
                <div className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded px-3 py-2">
                  {alertFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={alertBusy}
                className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                {alertBusy ? 'Saving Price Alert...' : `Create ${alertAsset}/${alertFiat} Price Alert`}
              </button>
            </form>

            {/* Stored Price Alerts Table / List */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Stored Backend Price Alerts ({priceAlerts.length})</span>
                <span className="font-mono text-slate-400">
                  Triggered Total: {workerStatus.triggeredCount}
                </span>
              </div>

              {priceAlerts.length === 0 ? (
                <div className="p-6 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-center text-xs text-slate-500">
                  No price alerts configured yet. Create an Email or In-App alert on the left.
                </div>
              ) : (
                <div className="space-y-2">
                  {priceAlerts.map((al) => {
                    const sym = FIAT_SYMBOLS[al.fiatCurrency];
                    return (
                      <div
                        key={al.id}
                        className="p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 font-mono">
                              {al.asset}/{al.fiatCurrency}
                            </span>
                            <span className="text-slate-300 font-mono">
                              {al.direction === 'AT_OR_BELOW' ? '≤' : '≥'} {sym}
                              {formatMinor2(al.targetPriceFiatMinor)}
                            </span>
                            <span
                              className={`font-mono font-semibold ${
                                al.status === 'TRIGGERED' ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              · {al.status}
                            </span>
                          </div>
                          <div className="text-slate-400 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>
                                Channel:{' '}
                                {al.channel === 'IN_APP'
                                  ? 'In-App Notification Only'
                                  : `${al.channel} (${al.userEmail})`}
                              </span>
                            </span>
                            {al.status === 'TRIGGERED' && al.triggeredPriceFiatMinor !== undefined && (
                              <span className="text-emerald-300 font-mono">
                                · Matched Offer {al.triggeredOfferId} @ {sym}
                                {formatMinor2(al.triggeredPriceFiatMinor)}
                                {al.emailDispatched ? ' · Email Sent' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={`Delete alert ${al.asset}/${al.fiatCurrency}`}
                          onClick={() => onDeletePriceAlert(al.id)}
                          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-[#131A24] border border-white/[0.06] rounded-md cursor-pointer inline-flex items-center gap-1 self-start sm:self-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Filter Bar + Live Crypto Auto-Price Reflection Ticker */}
      <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-4 space-y-4">
        {/* Live Crypto Auto-Price Selector Strip */}
        <div
          data-testid="market-live-crypto-price-strip"
          className="flex flex-wrap items-center gap-2 pb-3 border-b border-white/[0.06]"
        >
          <span className="text-xs font-semibold text-slate-300 mr-1">
            Live Auto-Price ({lockedFiatForCountry} · $1 USD = {FIAT_SYMBOLS[lockedFiatForCountry]}
            {liveLocalExchangeRate.toFixed(2)}):
          </span>
          <button
            type="button"
            onClick={() => setSelectedAsset('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              selectedAsset === 'ALL'
                ? 'bg-emerald-500 text-[#0B0E14] border-emerald-400'
                : 'bg-[#0B0E14] text-slate-300 border-white/10 hover:border-white/25'
            }`}
          >
            All Cryptos
          </button>
          {ASSETS.map((a) => {
            const autoP = calculateAutoUnitPriceFiat({
              asset: a,
              countryCode: selectedCountry,
              pricingType: 'FIXED',
              liveCryptoUsdPrice: livePriceFeed?.rates?.[a]?.usd,
              liveLocalExchangeRate,
            });
            const isSel = selectedAsset === a;
            return (
              <button
                key={a}
                type="button"
                data-testid={`market-crypto-pill-${a}`}
                onClick={() => setSelectedAsset(a)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  isSel
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                    : 'bg-[#0B0E14] text-slate-300 border-white/10 hover:border-white/25'
                }`}
              >
                <CryptoAssetIcon asset={a} className="w-4 h-4 shrink-0" />
                <span className="font-bold text-slate-100">{a}:</span>
                <span className="text-emerald-400">
                  {FIAT_SYMBOLS[lockedFiatForCountry]}
                  {autoP.unitPriceFiatFormatted}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Asset Filter */}
          <div>
            <label htmlFor="filter-asset" className="block text-xs font-medium text-slate-400 mb-1">
              Cryptocurrency
            </label>
            <CustomSelect
              id="filter-asset"
              testId="filter-asset"
              value={selectedAsset}
              onChange={(val) => setSelectedAsset(val as CryptoAsset | 'ALL')}
              options={buildCryptoAssetOptions(ASSETS, {
                includeAllLabel: 'All Cryptocurrencies (5)',
              })}
              searchable={false}
            />
          </div>

          {/* Single Unified Country & Fiat Currency Selector */}
          <div>
            <label htmlFor="market-country-select" className="block text-xs font-medium text-slate-400 mb-1">
              Country &amp; Currency
            </label>
            <CustomSelect
              id="market-country-select"
              testId="market-country-select"
              value={strictCountryFilter ? selectedCountry : 'ALL'}
              onChange={(val) => {
                if (val === 'ALL') {
                  setStrictCountryFilter(false);
                  setSelectedFiat('ALL');
                } else {
                  setStrictCountryFilter(true);
                  onSelectCountry(val as CountryCode);
                }
                setSelectedPaymentMethod('ALL');
              }}
              options={buildCountryCurrencyOptions(true)}
              searchPlaceholder="Search country or currency (INR, USD, EUR...)"
            />
          </div>

          {/* Fiat Amount Filter */}
          <div>
            <label htmlFor="filter-amount" className="block text-xs font-medium text-slate-400 mb-1">
              Order Amount ({effectiveFiatFilter === 'ALL' ? 'Fiat' : effectiveFiatFilter})
            </label>
            <input
              id="filter-amount"
              type="text"
              placeholder="e.g. 10000"
              value={fiatAmountFilter}
              onChange={(e) => setFiatAmountFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 min-h-[38px]"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <label htmlFor="filter-pm" className="block text-xs font-medium text-slate-400 mb-1">
              Payment Rail
            </label>
            <CustomSelect
              id="filter-pm"
              testId="filter-pm"
              value={selectedPaymentMethod}
              onChange={(val) => setSelectedPaymentMethod(val)}
              options={[
                {
                  value: 'ALL',
                  badgeText: 'ALL RAILS',
                  badgeVariant: 'emerald',
                  label: 'All Payment Methods',
                },
                ...availablePaymentFilterOptions.map((pm) => ({
                  value: pm,
                  badgeText: effectiveFiatFilter === 'ALL' ? 'P2P' : effectiveFiatFilter,
                  badgeVariant: 'blue' as const,
                  label: pm,
                })),
              ]}
            />
          </div>

          {/* Advertiser Search */}
          <div>
            <label htmlFor="filter-advertiser" className="block text-xs font-medium text-slate-400 mb-1">
              Advertiser
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="filter-advertiser"
                type="text"
                placeholder="Search merchant..."
                value={advertiserQuery}
                onChange={(e) => setAdvertiserQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 min-h-[38px]"
              />
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label htmlFor="filter-sort" className="block text-xs font-medium text-slate-400 mb-1">
              Sort Order
            </label>
            <CustomSelect
              id="filter-sort"
              testId="filter-sort"
              value={sortBy}
              onChange={(val) =>
                setSortBy(val as 'PRICE' | 'TRUST_SCORE' | 'TRADES' | 'COMPLETION')
              }
              options={[
                {
                  value: 'PRICE',
                  badgeText: 'PRICE',
                  badgeVariant: 'emerald',
                  label:
                    tradeTab === 'BUY_CRYPTO'
                      ? 'Price: Lowest to Highest'
                      : 'Price: Highest to Lowest',
                },
                {
                  value: 'TRUST_SCORE',
                  badgeText: 'TRUST',
                  badgeVariant: 'blue',
                  label: 'Advertiser Trust Score: High to Low',
                },
                {
                  value: 'TRADES',
                  badgeText: 'DEALS',
                  badgeVariant: 'slate',
                  label: 'Completed Trades: High to Low',
                },
                {
                  value: 'COMPLETION',
                  badgeText: 'RATE',
                  badgeVariant: 'amber',
                  label: 'Completion Rate: High to Low',
                },
              ]}
              searchable={false}
              align="right"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs text-slate-400">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded accent-emerald-400"
            />
            <span>Show only active offers with verified escrow inventory</span>
          </label>
          <div className="font-mono tabular-nums">
            Showing {filteredOffers.length} verified P2P {tradeTab === 'BUY_CRYPTO' ? 'sell' : 'buy'} offers
            {strictCountryFilter ? ` for ${activeCountryPolicy.name} (${lockedFiatForCountry})` : ''}
          </div>
        </div>
      </div>

      {/* Your Published P2P Offers Management Panel (Edit, Pause with Confirm, Cancel with Confirm) */}
      {onUpdateOfferStatus && onEditOffer && (
        <PublishedOffersManager
          offers={offers}
          currentUserId={currentUserId}
          currentUser={currentUser}
          supportedPaymentMethods={supportedPaymentMethods}
          onUpdateOfferStatus={onUpdateOfferStatus}
          onEditOffer={onEditOffer}
          title="Your Published P2P Offers"
          subtitle="All of your active and paused Buy & Sell ads appear here and in the live order book below. Edit pricing/limits, pause with confirmation, or cancel with confirmation."
        />
      )}

      {/* High-Density Financial Order Book Table */}
      <div className="bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden">
        {filteredOffers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-300">
              No P2P offers match the current filter criteria.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Reset your filters or switch to Buy Crypto with Fiat to view all active offers for {activeCountryPolicy.name} ({lockedFiatForCountry}).
            </p>
            <button
              type="button"
              onClick={() => {
                setTradeTab('BUY_CRYPTO');
                setSelectedAsset('ALL');
                setFiatAmountFilter('');
                setSelectedPaymentMethod('ALL');
                setAdvertiserQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors cursor-pointer"
            >
              Show All {lockedFiatForCountry} Offers
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs font-medium text-slate-400 bg-[#0F141C]">
                  <th className="py-3.5 px-4">Advertiser &amp; Visual Trust Score</th>
                  <th className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center gap-1">
                      Price <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right">Selling / Buying &amp; Order Limits</th>
                  <th className="py-3.5 px-4">Supported Payment Rails</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {filteredOffers.map((offer) => {
                  const symbol = FIAT_SYMBOLS[offer.fiatCurrency];
                  const isOwnOffer = offer.makerId === currentUserId;
                  const isBlockedByCountryLock = offer.fiatCurrency !== lockedFiatForCountry;
                  const trust =
                    trustByOfferId.get(offer.id) ||
                    calculateAdvertiserTrustScore({
                      makerId: offer.makerId,
                      offerCompletedTrades: offer.completedTrades,
                      offerCompletionRatePct: offer.completionRatePct,
                    });

                  return (
                    <tr
                      key={offer.id}
                      data-testid={`offer-row-${offer.id}`}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Advertiser & Visual Trust Score Indicator */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-slate-100">{offer.makerName}</span>
                          {isOwnOffer && (
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                              YOUR OFFER
                            </span>
                          )}
                          <ShieldCheck
                            className="w-4 h-4 text-emerald-400 shrink-0"
                            aria-label="Verified Escrow Counterparty"
                          />
                          <span className="text-xs text-slate-500" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-medium text-emerald-400">
                            {trust.tierLabel}
                          </span>
                        </div>

                        {/* Visual Trust Score Bar & Breakdown */}
                        <div
                          data-testid={`trust-score-indicator-${offer.id}`}
                          className="mt-2 min-w-0 max-w-sm space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-4 text-xs font-mono tabular-nums">
                            <span className="text-slate-300 font-semibold whitespace-nowrap">
                              Trust Score:{' '}
                              <span
                                className={
                                  trust.trustScore >= 98
                                    ? 'text-emerald-400'
                                    : trust.trustScore >= 94
                                    ? 'text-cyan-400'
                                    : 'text-amber-400'
                                }
                              >
                                {trust.trustScore.toFixed(1)} / 100
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                              {trust.disputeSuccessRatePct.toFixed(0)}% dispute win rate
                            </span>
                          </div>

                          {/* Segmented Visual Trust Meter */}
                          <div
                            role="progressbar"
                            aria-label={`${offer.makerName} Trust Score ${trust.trustScore.toFixed(1)} out of 100`}
                            aria-valuenow={Math.round(trust.trustScore)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-1.5 w-full bg-[#090D14] border border-white/[0.08] rounded-sm overflow-hidden"
                          >
                            <div
                              style={{ width: `${Math.min(100, Math.max(15, trust.trustScore))}%` }}
                              className={`h-full transition-opacity ${
                                trust.trustScore >= 98
                                  ? 'bg-emerald-400'
                                  : trust.trustScore >= 94
                                  ? 'bg-cyan-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {trust.completedTrades} completed trades · {trust.successfulDisputes}/
                            {trust.totalDisputesReviewed} successful disputes ·{' '}
                            {trust.completionRatePct.toFixed(1)}% completion
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-4 px-4 text-right align-top font-mono tabular-nums">
                        <div className="text-base font-bold text-slate-100">
                          {symbol}
                          {formatMinor2(offer.unitPriceFiatMinor)}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            {offer.fiatCurrency}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          per 1 {offer.asset}
                        </div>
                      </td>

                      {/* Selling / Buying Amount & Order Limits */}
                      <td className="py-4 px-4 text-right align-top font-mono tabular-nums">
                        {(() => {
                          const offerTotalFiatMinor = Math.max(
                            1,
                            Math.round(
                              (offer.availableQuantityMicro * offer.unitPriceFiatMinor) / 1_000_000
                            )
                          );
                          const offerCapMinor = calculateMaxOrderCapMinor({
                            asset: offer.asset,
                            unitPriceFiatMinor: offer.unitPriceFiatMinor,
                          });
                          const offerEffectiveMaxMinor = Math.min(
                            offer.maxOrderFiatMinor,
                            offerTotalFiatMinor,
                            offerCapMinor
                          );
                          const offerEffectiveMinMinor = Math.min(
                            offer.minOrderFiatMinor,
                            offerEffectiveMaxMinor
                          );
                          return (
                            <>
                              <div className="text-xs text-slate-200">
                                {offer.side === 'SELL' ? 'Selling:' : 'Buying Order:'}{' '}
                                <span className="font-semibold text-slate-100">
                                  {formatMicro6(offer.availableQuantityMicro)} {offer.asset}
                                </span>{' '}
                                <span className="text-emerald-400 font-semibold">
                                  ({symbol}
                                  {formatMinor2(offerTotalFiatMinor)} {offer.fiatCurrency})
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                Order Limit: {symbol}
                                {formatMinor2(offerEffectiveMinMinor)} – {symbol}
                                {formatMinor2(offerEffectiveMaxMinor)} {offer.fiatCurrency}
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      {/* Payment Methods */}
                      <td className="py-4 px-4 align-top">
                        <div className="text-xs text-slate-200 font-medium">
                          {offer.paymentMethods.join(' · ')}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">
                          {offer.paymentInstructions}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right align-top">
                        {isOwnOffer ? (
                          <div className="space-y-2">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openOrderModal(offer)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-[#18212F] hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Inspect Your Offer
                              </button>
                              {onUpdateOfferStatus && (
                                <>
                                  {offer.status === 'OPEN' && (
                                    <button
                                      type="button"
                                      data-testid={`market-pause-offer-btn-${offer.id}`}
                                      onClick={() =>
                                        setOrderBookConfirmOfferAction({
                                          offer,
                                          action: 'PAUSE',
                                        })
                                      }
                                      className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      Pause
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    data-testid={`market-cancel-offer-btn-${offer.id}`}
                                    onClick={() =>
                                      setOrderBookConfirmOfferAction({
                                        offer,
                                        action: 'CANCEL',
                                      })
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>

                            {orderBookConfirmOfferAction?.offer.id === offer.id && (
                              <div
                                role="region"
                                aria-label={`Confirm ${orderBookConfirmOfferAction.action} for offer ${offer.id}`}
                                data-testid={`market-inline-confirm-popover-${offer.id}`}
                                className={`p-2.5 rounded-lg border text-left text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                                  orderBookConfirmOfferAction.action === 'CANCEL'
                                    ? 'bg-red-950/85 border-red-500/50 text-red-200'
                                    : 'bg-amber-950/85 border-amber-500/50 text-amber-200'
                                }`}
                              >
                                <span>
                                  {orderBookConfirmOfferAction.action === 'CANCEL'
                                    ? `Confirm cancelling ${offer.id}?`
                                    : `Confirm pausing ${offer.id}?`}
                                </span>
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={orderBookOfferActionBusy}
                                    onClick={() => setOrderBookConfirmOfferAction(null)}
                                    className="px-2 py-0.5 rounded bg-[#0B0E14] border border-white/15 text-slate-300 hover:text-white cursor-pointer"
                                  >
                                    Keep
                                  </button>
                                  <button
                                    type="button"
                                    disabled={orderBookOfferActionBusy}
                                    onClick={handleConfirmOrderBookOfferAction}
                                    className={`px-2.5 py-0.5 rounded font-semibold cursor-pointer ${
                                      orderBookConfirmOfferAction.action === 'CANCEL'
                                        ? 'bg-red-500 hover:bg-red-400 text-white'
                                        : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                                    }`}
                                  >
                                    {orderBookOfferActionBusy
                                      ? 'Processing...'
                                      : orderBookConfirmOfferAction.action === 'CANCEL'
                                      ? 'Confirm Cancel'
                                      : 'Confirm Pause'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openOrderModal(offer)}
                            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                              isBlockedByCountryLock
                                ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                                : tradeTab === 'BUY_CRYPTO'
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0B0E14]'
                                : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                            }`}
                          >
                            {isBlockedByCountryLock
                              ? `Locked (${selectedCountry} → ${lockedFiatForCountry} Only)`
                              : tradeTab === 'BUY_CRYPTO'
                              ? `Buy ${offer.asset}`
                              : `Sell ${offer.asset}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch-Optimized Cards View */}
          <div className="block md:hidden divide-y divide-white/[0.06]">
            {filteredOffers.map((offer) => {
              const symbol = FIAT_SYMBOLS[offer.fiatCurrency];
              const isOwnOffer = offer.makerId === currentUserId;
              const isBlockedByCountryLock = offer.fiatCurrency !== lockedFiatForCountry;
              const trust =
                trustByOfferId.get(offer.id) ||
                calculateAdvertiserTrustScore({
                  makerId: offer.makerId,
                  offerCompletedTrades: offer.completedTrades,
                  offerCompletionRatePct: offer.completionRatePct,
                });

              return (
                <div
                  key={offer.id}
                  data-testid={`offer-card-mobile-${offer.id}`}
                  className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Top Row: Advertiser, Trust Score & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-100 text-sm truncate">{offer.makerName}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold">
                          {trust.trustScore.toFixed(0)}/100
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {offer.completedTrades} trades · {offer.completionRatePct.toFixed(0)}% completion
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-base font-black text-slate-100">
                        {symbol}{formatMinor2(offer.unitPriceFiatMinor)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        per {offer.asset}
                      </div>
                    </div>
                  </div>

                  {/* Selling / Buying Amount & Order Limits */}
                  {(() => {
                    const offerTotalFiatMinor = Math.max(
                      1,
                      Math.round(
                        (offer.availableQuantityMicro * offer.unitPriceFiatMinor) / 1_000_000
                      )
                    );
                    const offerCapMinor = calculateMaxOrderCapMinor({
                      asset: offer.asset,
                      unitPriceFiatMinor: offer.unitPriceFiatMinor,
                    });
                    const offerEffectiveMaxMinor = Math.min(
                      offer.maxOrderFiatMinor,
                      offerTotalFiatMinor,
                      offerCapMinor
                    );
                    const offerEffectiveMinMinor = Math.min(
                      offer.minOrderFiatMinor,
                      offerEffectiveMaxMinor
                    );
                    return (
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-white/[0.06] text-xs font-mono space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">
                            {offer.side === 'SELL' ? 'Selling:' : 'Buying Order:'}
                          </span>
                          <span className="font-semibold text-slate-100">
                            {formatMicro6(offer.availableQuantityMicro)} {offer.asset}{' '}
                            <span className="text-emerald-400">
                              ({symbol}
                              {formatMinor2(offerTotalFiatMinor)})
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Order Limit:</span>
                          <span className="text-slate-200">
                            {symbol}
                            {formatMinor2(offerEffectiveMinMinor)} – {symbol}
                            {formatMinor2(offerEffectiveMaxMinor)} {offer.fiatCurrency}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Payment Rails */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {offer.paymentMethods.map((pm) => (
                      <span
                        key={pm}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.05] border border-white/10 text-slate-300"
                      >
                        {pm}
                      </span>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div>
                    {isOwnOffer ? (
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => openOrderModal(offer)}
                          className="py-2 text-xs font-bold text-slate-300 bg-[#18212F] hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-center"
                        >
                          Inspect
                        </button>
                        {onUpdateOfferStatus && offer.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() =>
                              setOrderBookConfirmOfferAction({ offer, action: 'PAUSE' })
                            }
                            className="py-2 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            Pause
                          </button>
                        )}
                        {onUpdateOfferStatus && (
                          <button
                            type="button"
                            onClick={() =>
                              setOrderBookConfirmOfferAction({ offer, action: 'CANCEL' })
                            }
                            className="py-2 text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openOrderModal(offer)}
                        className={`w-full py-2.5 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center shadow-sm ${
                          isBlockedByCountryLock
                            ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                            : tradeTab === 'BUY_CRYPTO'
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0B0E14]'
                            : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                        }`}
                      >
                        {isBlockedByCountryLock
                          ? `Locked (${selectedCountry} → ${lockedFiatForCountry} Only)`
                          : tradeTab === 'BUY_CRYPTO'
                          ? `Buy ${offer.asset}`
                          : `Sell ${offer.asset}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
        )}
      </div>

      {/* Double-Confirmation Modal for Pause & Cancel triggered from Market Order Book or Inspect Modal */}
      {orderBookConfirmOfferAction && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="market-offer-confirm-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-[#131A24] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    orderBookConfirmOfferAction.action === 'CANCEL'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Double-Confirmation Required
                  </div>
                  <h3 className="text-base font-bold text-slate-100 font-display">
                    {orderBookConfirmOfferAction.action === 'CANCEL'
                      ? 'Confirm Cancel P2P Offer'
                      : 'Confirm Pause P2P Offer'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close Offer Confirmation Modal"
                onClick={() => setOrderBookConfirmOfferAction(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-lg font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Offer ID:</span>
                  <span className="text-slate-100 font-bold">
                    {orderBookConfirmOfferAction.offer.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantity &amp; Price:</span>
                  <span className="text-slate-200">
                    {formatMicro6(orderBookConfirmOfferAction.offer.availableQuantityMicro)}{' '}
                    {orderBookConfirmOfferAction.offer.asset} @{' '}
                    {FIAT_SYMBOLS[orderBookConfirmOfferAction.offer.fiatCurrency]}
                    {formatMinor2(orderBookConfirmOfferAction.offer.unitPriceFiatMinor)}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">
                {orderBookConfirmOfferAction.action === 'PAUSE'
                  ? 'Please confirm that you want to pause this P2P offer. It will be hidden from the active Market order book until you resume it.'
                  : 'Please confirm that you want to permanently cancel this P2P offer. It will be removed from your Published P2P Offers and any locked crypto will return to your available balance.'}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  disabled={orderBookOfferActionBusy}
                  onClick={() => setOrderBookConfirmOfferAction(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B0E14] border border-white/10 hover:border-white/25 rounded-lg cursor-pointer"
                >
                  No, Keep Offer
                </button>
                <button
                  type="button"
                  data-testid="market-confirm-modal-proceed-btn"
                  disabled={orderBookOfferActionBusy}
                  onClick={handleConfirmOrderBookOfferAction}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    orderBookConfirmOfferAction.action === 'CANCEL'
                      ? 'bg-red-500 hover:bg-red-400 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                  }`}
                >
                  {orderBookOfferActionBusy
                    ? 'Processing...'
                    : orderBookConfirmOfferAction.action === 'CANCEL'
                    ? 'Yes, Confirm Cancel'
                    : 'Yes, Confirm Pause'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Details & Pre-Confirmation 1% Fee Breakdown Modal */}
      {activeOffer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto"
        >
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-[#131A24] border border-white/15 rounded-xl overflow-hidden shadow-2xl my-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#0F141C] border-b border-white/[0.08] shrink-0">
              <div>
                <div className="text-xs text-slate-400 font-mono">
                  Offer ID: {activeOffer.id} · {activeOffer.makerName}
                </div>
                <h2 id="order-modal-title" className="text-base sm:text-lg font-bold text-slate-100 font-display">
                  {activeOffer.side === 'SELL' ? `Buy ${activeOffer.asset}` : `Sell ${activeOffer.asset}`} with{' '}
                  {activeOffer.fiatCurrency}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Offer Modal"
                onClick={() => setActiveOffer(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder} className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Country-to-Fiat Security Check Banner inside Modal */}
              {activeOffer.fiatCurrency !== lockedFiatForCountry && (
                <div className="p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-lg text-xs text-amber-200 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      Region Lock: Your active region is {activeCountryPolicy.name} ({lockedFiatForCountry}). Switch your country filter to match {activeOffer.fiatCurrency} before placing this order.
                    </span>
                  </div>
                </div>
              )}

              {/* Clean Offer Summary Header */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl font-mono tabular-nums text-xs">
                <div>
                  <div className="text-slate-400 font-sans">Price per {activeOffer.asset}</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {FIAT_SYMBOLS[activeOffer.fiatCurrency]}
                    {formatMinor2(activeOffer.unitPriceFiatMinor)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 font-sans">
                    {activeOffer.side === 'SELL' ? 'Available to Buy' : 'Buyer Wants'}
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-0.5">
                    {formatMicro6(activeOffer.availableQuantityMicro)} {activeOffer.asset}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ({FIAT_SYMBOLS[activeOffer.fiatCurrency]}{formatMinor2(activeOfferTotalFiatMinor)})
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 font-sans">Order Range</div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5">
                    {FIAT_SYMBOLS[activeOffer.fiatCurrency]}
                    {formatMinor2(activeOfferEffectiveMinMinor)} – {FIAT_SYMBOLS[activeOffer.fiatCurrency]}
                    {formatMinor2(activeOfferEffectiveMaxMinor)}
                  </div>
                  <div className="text-[11px] text-emerald-400">
                    Daily Limit: $10,000/day
                  </div>
                </div>
              </div>

              {/* Step 1: Easy Two-Box Amount Calculator */}
              <div className="p-4 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    1. Enter How Much You Want to {activeOffer.side === 'SELL' ? 'Buy' : 'Sell'}
                  </span>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleOrderFiatChange(formatMinor2(activeOfferEffectiveMinMinor))
                      }
                      className="px-2 py-0.5 text-[11px] font-mono bg-[#131A24] border border-white/10 rounded text-slate-300 hover:border-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      Min ({FIAT_SYMBOLS[activeOffer.fiatCurrency]}{formatMinor2(activeOfferEffectiveMinMinor)})
                    </button>
                    <button
                      type="button"
                      data-testid="order-max-limit-btn"
                      onClick={() =>
                        handleOrderFiatChange(formatMinor2(activeOfferEffectiveMaxMinor))
                      }
                      className="px-2 py-0.5 text-[11px] font-mono bg-emerald-500/15 border border-emerald-500/30 rounded text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      Max ({FIAT_SYMBOLS[activeOffer.fiatCurrency]}{formatMinor2(activeOfferEffectiveMaxMinor)})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="order-fiat-input" className="block text-xs font-medium text-slate-300 mb-1">
                      {activeOffer.side === 'SELL' ? 'You Pay' : 'You Receive'} ({activeOffer.fiatCurrency})
                    </label>
                    <input
                      id="order-fiat-input"
                      data-testid="order-fiat-input"
                      type="text"
                      required
                      value={orderFiatInput}
                      onChange={(e) => handleOrderFiatChange(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-[#131A24] border rounded-lg text-emerald-300 focus:outline-none ${
                        orderLimitValidationError
                          ? 'border-red-500/60 focus:border-red-400'
                          : 'border-emerald-500/40 focus:border-emerald-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="order-crypto-input" className="block text-xs font-medium text-slate-300 mb-1">
                      {activeOffer.side === 'SELL' ? 'You Receive' : 'You Sell'} ({activeOffer.asset})
                    </label>
                    <input
                      id="order-crypto-input"
                      data-testid="order-crypto-input"
                      type="text"
                      value={orderCryptoInput}
                      onChange={(e) => handleOrderCryptoChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* Live Order Limit & $10,000/day Validation Banner */}
                <div
                  data-testid="order-limit-validation-banner"
                  className={`px-3 py-2 rounded-lg border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
                    orderLimitValidationError
                      ? 'bg-red-950/50 border-red-500/40 text-red-200'
                      : 'bg-[#131A24] border-emerald-500/25 text-slate-300'
                  }`}
                >
                  <span>
                    {orderLimitValidationError
                      ? orderLimitValidationError
                      : `Valid order · Approx. $${orderUsdEquivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (Daily ${activeOffer.side === 'SELL' ? 'Buy' : 'Sell'} Remaining: $${(activeOffer.side === 'SELL' ? dailyLimitStatus.dailyBuyRemainingUsd : dailyLimitStatus.dailySellRemainingUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / $${DAILY_TRADING_LIMIT_USD.toLocaleString()})`}
                  </span>
                </div>
              </div>

              {/* Step 2: Saved Profile Payment Methods Only (Binance P2P Style) */}
              <div className="p-4 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label htmlFor="order-pm-select" className="block text-xs font-semibold text-slate-200">
                      2. Select Payment Method (Saved on Your Profile)
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Only payment methods linked to your profile are shown. Counterparty accepts:{' '}
                      <span className="text-emerald-300 font-medium">
                        {activeOffer.paymentMethods.join(', ')}
                      </span>
                    </p>
                  </div>
                  {onAddPaymentMethod && (
                    <button
                      type="button"
                      data-testid="order-toggle-add-pm-btn"
                      onClick={() => setShowAddPmInline((prev) => !prev)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                    >
                      {showAddPmInline ? 'Cancel' : '+ Add Payment Method'}
                    </button>
                  )}
                </div>

                {(() => {
                  const savedForFiat = userSavedPaymentMethods.filter(
                    (pm) => pm.fiatCurrency === activeOffer.fiatCurrency
                  );
                  const matchingSaved = savedForFiat.filter((pm) =>
                    activeOffer.paymentMethods.includes(pm.methodName)
                  );
                  const displayList = matchingSaved.length > 0 ? matchingSaved : savedForFiat;

                  if (displayList.length === 0) {
                    return (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs text-amber-200 flex items-center justify-between gap-2">
                        <span>
                          You have no saved {activeOffer.fiatCurrency} payment methods in your profile yet. Click <strong>+ Add Payment Method</strong> to link your UPI or bank account.
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="order-pm-select">
                      {displayList.map((pm) => {
                        const isSelected = orderPaymentMethod === pm.methodName;
                        const isAcceptedByOffer = activeOffer.paymentMethods.includes(pm.methodName);
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setOrderPaymentMethod(pm.methodName)}
                            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-400 text-slate-100'
                                : 'bg-[#131A24] border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold flex items-center gap-1.5">
                                <span>{pm.methodName}</span>
                                {isAcceptedByOffer && (
                                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                    Matched
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                {pm.accountIdentifier} · {pm.accountHolder}
                              </div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-emerald-400 bg-emerald-400 text-[#0B0E14]' : 'border-slate-600'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Inline Add Payment Method to Profile Form */}
                {showAddPmInline && (
                  <div
                    data-testid="order-inline-add-pm-form"
                    className="p-3.5 bg-[#131A24] border border-emerald-500/35 rounded-lg space-y-3"
                  >
                    <div className="text-xs font-semibold text-emerald-300">
                      Link New {activeOffer.fiatCurrency} Payment Method to Your Profile
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Payment Rail</label>
                        <select
                          value={newPmName}
                          onChange={(e) => setNewPmName(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                        >
                          {activeOffer.paymentMethods.map((m) => (
                            <option key={m} value={m}>
                              {m} (Supported by Offer)
                            </option>
                          ))}
                          {(supportedPaymentMethods[activeOffer.fiatCurrency] || [])
                            .filter((m: string) => !activeOffer.paymentMethods.includes(m))
                            .map((m: string) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          UPI ID / Account Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. name@okaxis or Acct #"
                          value={newPmIdentifier}
                          onChange={(e) => setNewPmIdentifier(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Bank / App Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank / PhonePe"
                          value={newPmBank}
                          onChange={(e) => setNewPmBank(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={addingPmBusy}
                        onClick={handleQuickAddPaymentMethod}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] rounded-lg cursor-pointer"
                      >
                        {addingPmBusy ? 'Saving...' : 'Save to Profile & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Concise Summary Box */}
              {liveBreakdown && (
                <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-slate-300">
                    <span>Order Fiat Total:</span>
                    <span className="font-bold text-slate-100">
                      {FIAT_SYMBOLS[activeOffer.fiatCurrency]}
                      {liveBreakdown.grossFiatFormatted} {activeOffer.fiatCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Fee ({(feeBps / 100).toFixed(2)}% Seller · 0% Buyer):</span>
                    <span className="text-amber-400">
                      {FIAT_SYMBOLS[activeOffer.fiatCurrency]}
                      {liveBreakdown.platformFeeFiatFormatted} {activeOffer.fiatCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold pt-1.5 border-t border-white/[0.06]">
                    <span>Escrow Crypto Quantity:</span>
                    <span className="text-sm">
                      {liveBreakdown.cryptoQuantityFormatted} {activeOffer.asset}
                    </span>
                  </div>
                </div>
              )}

              {orderError && (
                <div role="alert" className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveOffer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                >
                  Close
                </button>
                {activeOffer.makerId === currentUserId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-amber-400 font-medium mr-1">
                      This is your published offer:
                    </span>
                    {onUpdateOfferStatus && activeOffer.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() =>
                          setOrderBookConfirmOfferAction({
                            offer: activeOffer,
                            action: 'PAUSE',
                          })
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 rounded-lg cursor-pointer"
                      >
                        Pause Offer
                      </button>
                    )}
                    {onUpdateOfferStatus && (
                      <button
                        type="button"
                        onClick={() =>
                          setOrderBookConfirmOfferAction({
                            offer: activeOffer,
                            action: 'CANCEL',
                          })
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg cursor-pointer"
                      >
                        Cancel Offer
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !liveBreakdown || Boolean(orderLimitValidationError)}
                    className="px-5 py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Placing Order...'
                        : `${activeOffer.side === 'SELL' ? 'Buy' : 'Sell'} ${liveBreakdown ? liveBreakdown.cryptoQuantityFormatted : ''} ${activeOffer.asset}`}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
