import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  PauseCircle,
  PlayCircle,
  XCircle,
  Plus,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  TOP_TRADING_COUNTRIES,
  getLockedFiatForCountry,
  calculateAutoUnitPriceFiat,
  getRecommendedOfferDefaults,
  calculateFiatFromCryptoQuantity,
  calculateBinanceOrderLimits,
  DAILY_TRADING_LIMIT_USD,
  calculateUserDailyLimitStatus,
  USD_REFERENCE_RATES,
  type AssetBalance,
  type CryptoAsset,
  type CountryCode,
  type FiatCurrency,
  type LivePriceFeed,
  type OfferRecord,
  type EscrowOrderRecord,
  type UserProfile,
  type UserPaymentMethod,
} from '../types';
import {
  formatMicro6,
  formatMinor2,
  parseFiatToMinor,
  parseCryptoToMicro,
  calculateMaxOrderCapMinor,
} from '../core/escrowEngine';
import { CryptoAssetIcon } from './CryptoAssetIcons';
import {
  CustomSelect,
  buildCountryCurrencyOptions,
} from './CustomSelect';
import { PublishedOffersManager, type EditOfferPayload } from './PublishedOffersManager';

interface CreateOfferViewProps {
  balances: AssetBalance[];
  offers: OfferRecord[];
  orders?: EscrowOrderRecord[];
  currentUserId: string;
  currentUser?: UserProfile;
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => void;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  feeBps: number;
  onCreateOffer: (payload: {
    side: 'SELL' | 'BUY';
    asset: CryptoAsset;
    fiatCurrency: FiatCurrency;
    unitPriceFiat: string;
    totalQuantityCrypto: string;
    minOrderFiat: string;
    maxOrderFiat: string;
    paymentMethods: string[];
    paymentInstructions: string;
    postAsTweet?: boolean;
    tweetContent?: string;
    tweetSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ORDER_ALERT';
    tweetTaggedAssets?: CryptoAsset[];
    tweetImageUrl?: string;
  }) => Promise<void>;
  onUpdateOfferStatus: (offerId: string, action: 'PAUSE' | 'RESUME' | 'CANCEL') => Promise<void>;
  onEditOffer: (offerId: string, payload: EditOfferPayload) => Promise<void>;
  onAddPaymentMethod?: (payload: {
    methodName: string;
    category: UserPaymentMethod['category'];
    fiatCurrency: FiatCurrency;
    accountHolder: string;
    accountIdentifier: string;
    bankOrProvider: string;
    verifyImmediately: boolean;
  }) => Promise<void>;
  onNavigatePulse?: () => void;
  livePriceFeed?: LivePriceFeed;
}

const ASSETS: CryptoAsset[] = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL'];

export const CreateOfferView: React.FC<CreateOfferViewProps> = ({
  balances,
  offers,
  orders = [],
  currentUserId,
  currentUser,
  selectedCountry,
  onSelectCountry,
  supportedPaymentMethods,
  feeBps,
  onCreateOffer,
  onUpdateOfferStatus,
  onEditOffer,
  onAddPaymentMethod,
  onNavigatePulse,
  livePriceFeed,
}) => {
  const [side, setSide] = useState<'SELL' | 'BUY'>('SELL');
  const [asset, setAsset] = useState<CryptoAsset>('USDT');
  const [countryCode, setCountryCode] = useState<CountryCode>(selectedCountry);
  const [pricingType, setPricingType] = useState<'FIXED' | 'FLOATING'>('FIXED');
  const [floatingMarginBps, setFloatingMarginBps] = useState<number>(50);
  const [autoSyncPrice, setAutoSyncPrice] = useState<boolean>(true);
  const [singleTransactionOnly, setSingleTransactionOnly] = useState<boolean>(false);
  const [perOrderMinCryptoInput, setPerOrderMinCryptoInput] = useState<string>('100.00');

  // Inline Add Payment Method to Profile state
  const [showAddPmForm, setShowAddPmForm] = useState(false);
  const [newPmName, setNewPmName] = useState('PhonePe');
  const [newPmIdentifier, setNewPmIdentifier] = useState('');
  const [newPmBank, setNewPmBank] = useState('');
  const [addingPmBusy, setAddingPmBusy] = useState(false);

  // Post Order on Market as a Tweet state
  const [postAsTweet, setPostAsTweet] = useState<boolean>(true);
  const [tweetSentiment, setTweetSentiment] = useState<'BULLISH' | 'BEARISH' | 'ORDER_ALERT'>('ORDER_ALERT');
  const [tweetCustomText, setTweetCustomText] = useState<string>('');
  const [tweetTaggedAssets, setTweetTaggedAssets] = useState<CryptoAsset[]>(['BTC', 'ETH', 'USDT']);
  const [tweetImageUrl, setTweetImageUrl] = useState<string>('');

  const lockedFiatCurrency = getLockedFiatForCountry(countryCode);
  const countryPolicy = TOP_TRADING_COUNTRIES[countryCode] || TOP_TRADING_COUNTRIES.IN;
  const liveLocalExchangeRate =
    livePriceFeed?.fiatExchangeRates?.[lockedFiatCurrency] ??
    (lockedFiatCurrency === 'INR' && livePriceFeed?.usdInrRate
      ? livePriceFeed.usdInrRate
      : countryPolicy.usdExchangeRate);

  const dailyLimitStatus = useMemo(
    () => calculateUserDailyLimitStatus(orders, currentUserId),
    [orders, currentUserId]
  );

  const balanceMap = useMemo(() => {
    const map = new Map<CryptoAsset, AssetBalance>();
    for (const b of balances) {
      map.set(b.asset, b);
    }
    return map;
  }, [balances]);

  const availableMicro = balanceMap.get(asset)?.availableMicro ?? 0;

  // Saved profile payment methods for the currently selected fiat currency
  const savedProfileMethodsForFiat = useMemo(() => {
    const allSaved = currentUser?.paymentMethods || [];
    return allSaved.filter((pm) => pm.fiatCurrency === lockedFiatCurrency);
  }, [currentUser?.paymentMethods, lockedFiatCurrency]);

  const liveAutoPrice = useMemo(
    () =>
      calculateAutoUnitPriceFiat({
        asset,
        countryCode,
        pricingType,
        floatingMarginBps,
        liveCryptoUsdPrice: livePriceFeed?.rates?.[asset]?.usd,
        liveLocalExchangeRate,
      }),
    [asset, countryCode, pricingType, floatingMarginBps, livePriceFeed, liveLocalExchangeRate]
  );

  const initialDefaults = useMemo(
    () =>
      getRecommendedOfferDefaults({
        asset,
        countryCode,
        pricingType,
        availableBalanceMicro: availableMicro,
        side,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [unitPriceFiat, setUnitPriceFiat] = useState<string>(initialDefaults.unitPriceFiatFormatted);
  const [totalQuantityCrypto, setTotalQuantityCrypto] = useState<string>(
    initialDefaults.recommendedQuantityFormatted
  );
  const [minOrderFiat, setMinOrderFiat] = useState<string>(initialDefaults.minOrderFiatFormatted);
  const [maxOrderFiat, setMaxOrderFiat] = useState<string>(initialDefaults.maxOrderFiatFormatted);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Instant settlement via verified bank / UPI rail. Include Order ID in remarks. Third-party accounts strictly rejected.'
  );
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCountryCode(selectedCountry);
  }, [selectedCountry]);

  // Default selected payment methods to the user's saved profile methods for this currency
  useEffect(() => {
    const savedNames = Array.from(new Set(savedProfileMethodsForFiat.map((pm) => pm.methodName)));
    setSelectedMethods(savedNames);
    const defaultRail = (supportedPaymentMethods[lockedFiatCurrency] || [])[0] || 'Bank Transfer';
    setNewPmName(defaultRail);
  }, [lockedFiatCurrency, savedProfileMethodsForFiat, supportedPaymentMethods]);

  const syncBinanceLimitsFromPriceAndQty = (
    nextAsset: CryptoAsset,
    nextUnitPriceStr: string,
    nextTotalQtyStr: string,
    nextSingleTx: boolean,
    nextPerOrderMinCryptoStr?: string
  ) => {
    try {
      const unitMinor = parseFiatToMinor(nextUnitPriceStr);
      const qtyMicro = parseCryptoToMicro(nextTotalQtyStr);
      let minCryptoMicro: number | undefined;
      const rawPerOrder = nextPerOrderMinCryptoStr ?? perOrderMinCryptoInput;
      try {
        minCryptoMicro = parseCryptoToMicro(rawPerOrder);
      } catch {
        minCryptoMicro = undefined;
      }

      const limits = calculateBinanceOrderLimits({
        asset: nextAsset,
        unitPriceFiatMinor: unitMinor,
        totalQuantityMicro: qtyMicro,
        minOrderCryptoMicro: minCryptoMicro,
        singleTransactionOnly: nextSingleTx,
        liveCryptoUsdPrice: livePriceFeed?.rates?.[nextAsset]?.usd,
      });

      setMaxOrderFiat(limits.maxOrderFiatFormatted);
      setMinOrderFiat(limits.minOrderFiatFormatted);
      const minCryptoNum = limits.minOrderCryptoMicro / 1_000_000;
      setPerOrderMinCryptoInput(
        nextAsset === 'USDT' || nextAsset === 'USDC'
          ? minCryptoNum.toFixed(2)
          : formatMicro6(limits.minOrderCryptoMicro)
      );
    } catch {
      // ignore while user is mid-typing
    }
  };

  const applyRecommendedForAsset = (
    nextAsset: CryptoAsset,
    nextSide: 'SELL' | 'BUY',
    nextMode: 'FIXED' | 'FLOATING',
    nextMargin: number,
    nextCountry: CountryCode
  ) => {
    const walletAvail = balanceMap.get(nextAsset)?.availableMicro ?? 0;
    const rec = getRecommendedOfferDefaults({
      asset: nextAsset,
      countryCode: nextCountry,
      pricingType: nextMode,
      availableBalanceMicro: walletAvail,
      side: nextSide,
    });
    const autoP = calculateAutoUnitPriceFiat({
      asset: nextAsset,
      countryCode: nextCountry,
      pricingType: nextMode,
      floatingMarginBps: nextMargin,
      liveCryptoUsdPrice: livePriceFeed?.rates?.[nextAsset]?.usd,
    });
    const limits = calculateBinanceOrderLimits({
      asset: nextAsset,
      unitPriceFiatMinor: autoP.unitPriceFiatMinor,
      totalQuantityMicro: rec.recommendedQuantityMicro,
      singleTransactionOnly: false,
      liveCryptoUsdPrice: livePriceFeed?.rates?.[nextAsset]?.usd,
    });
    setSingleTransactionOnly(false);
    setUnitPriceFiat(autoP.unitPriceFiatFormatted);
    setTotalQuantityCrypto(rec.recommendedQuantityFormatted);
    setMinOrderFiat(limits.minOrderFiatFormatted);
    setMaxOrderFiat(limits.maxOrderFiatFormatted);
    const minCryptoNum = limits.minOrderCryptoMicro / 1_000_000;
    setPerOrderMinCryptoInput(
      nextAsset === 'USDT' || nextAsset === 'USDC'
        ? minCryptoNum.toFixed(2)
        : formatMicro6(limits.minOrderCryptoMicro)
    );
    setAutoSyncPrice(true);
    setError(null);
    setSuccessMsg(null);
  };

  useEffect(() => {
    if (autoSyncPrice) {
      setUnitPriceFiat(liveAutoPrice.unitPriceFiatFormatted);
      syncBinanceLimitsFromPriceAndQty(
        asset,
        liveAutoPrice.unitPriceFiatFormatted,
        totalQuantityCrypto,
        singleTransactionOnly
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAutoPrice.unitPriceFiatFormatted, autoSyncPrice]);

  const liveOfferValuation = useMemo(() => {
    try {
      return calculateFiatFromCryptoQuantity({
        cryptoQuantityInput: totalQuantityCrypto,
        unitPriceFiatInput: unitPriceFiat,
        fiatCurrency: lockedFiatCurrency,
        cryptoAsset: asset,
        feeBps,
      });
    } catch {
      return null;
    }
  }, [totalQuantityCrypto, unitPriceFiat, lockedFiatCurrency, asset, feeBps]);

  const liveBinanceLimits = useMemo(() => {
    try {
      const unitMinor = parseFiatToMinor(unitPriceFiat);
      const qtyMicro = parseCryptoToMicro(totalQuantityCrypto);
      let minMinor: number | undefined;
      try {
        minMinor = parseFiatToMinor(minOrderFiat);
      } catch {
        minMinor = undefined;
      }
      return calculateBinanceOrderLimits({
        asset,
        unitPriceFiatMinor: unitMinor,
        totalQuantityMicro: qtyMicro,
        minOrderFiatMinor: minMinor,
        singleTransactionOnly,
        liveCryptoUsdPrice: livePriceFeed?.rates?.[asset]?.usd,
      });
    } catch {
      return calculateBinanceOrderLimits({
        asset,
        unitPriceFiatMinor: liveAutoPrice.unitPriceFiatMinor,
        totalQuantityMicro: initialDefaults.recommendedQuantityMicro,
        singleTransactionOnly,
        liveCryptoUsdPrice: livePriceFeed?.rates?.[asset]?.usd,
      });
    }
  }, [
    unitPriceFiat,
    totalQuantityCrypto,
    minOrderFiat,
    asset,
    singleTransactionOnly,
    livePriceFeed,
    liveAutoPrice.unitPriceFiatMinor,
    initialDefaults.recommendedQuantityMicro,
  ]);

  const maxDailyCapMinor = liveBinanceLimits.maxUsdtCapMinor;
  const totalOfferFiatMinor = liveBinanceLimits.totalOfferFiatMinor;
  const effectiveMaxAllowedMinor = liveBinanceLimits.maxOrderFiatMinor;

  const offerUsdEquivalent = useMemo(() => {
    try {
      const qtyMicro = parseCryptoToMicro(totalQuantityCrypto);
      const cryptoUnits = qtyMicro / 1_000_000;
      const usdRate =
        livePriceFeed?.rates?.[asset]?.usd ??
        USD_REFERENCE_RATES[asset] ??
        1.0;
      return Number((cryptoUnits * usdRate).toFixed(2));
    } catch {
      return 0;
    }
  }, [totalQuantityCrypto, asset, livePriceFeed]);

  const limitValidationError = useMemo(() => {
    let minMinor = 0;
    let maxMinor = 0;
    try {
      minMinor = parseFiatToMinor(minOrderFiat);
    } catch {
      return `Enter a valid Min Order Limit in ${lockedFiatCurrency}.`;
    }
    try {
      maxMinor = parseFiatToMinor(maxOrderFiat);
    } catch {
      return `Enter a valid Max Order Limit in ${lockedFiatCurrency}.`;
    }
    if (minMinor <= 0) {
      return 'Min Order Limit must be greater than zero.';
    }
    if (maxMinor < minMinor) {
      return `Max Order Limit (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(maxMinor)}) cannot be less than Min Order Limit (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(minMinor)}).`;
    }
    if (maxMinor > totalOfferFiatMinor) {
      return `Max Order Limit (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(maxMinor)}) cannot exceed Total Offer Value (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(totalOfferFiatMinor)} = ${totalQuantityCrypto} ${asset} × ${FIAT_SYMBOLS[lockedFiatCurrency]}${unitPriceFiat}).`;
    }
    const remainingDailyUsd =
      side === 'SELL' ? dailyLimitStatus.dailySellRemainingUsd : dailyLimitStatus.dailyBuyRemainingUsd;
    if (offerUsdEquivalent > remainingDailyUsd) {
      return `Daily ${side === 'SELL' ? 'Sell' : 'Buy'} Limit Exceeded: Offering $${offerUsdEquivalent.toLocaleString()} USD exceeds your remaining daily ${side === 'SELL' ? 'sell' : 'buy'} limit of $${remainingDailyUsd.toLocaleString()} USD ($${DAILY_TRADING_LIMIT_USD.toLocaleString()}/day max).`;
    }
    if (maxMinor > maxDailyCapMinor) {
      return `Max Order Limit cannot exceed the $${DAILY_TRADING_LIMIT_USD.toLocaleString()}/day limit (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(maxDailyCapMinor)} ${lockedFiatCurrency}).`;
    }
    return null;
  }, [
    minOrderFiat,
    maxOrderFiat,
    totalOfferFiatMinor,
    maxDailyCapMinor,
    lockedFiatCurrency,
    unitPriceFiat,
    totalQuantityCrypto,
    asset,
    side,
    offerUsdEquivalent,
    dailyLimitStatus,
  ]);

  const handleSelectAsset = (nextAsset: CryptoAsset) => {
    setAsset(nextAsset);
    applyRecommendedForAsset(nextAsset, side, pricingType, floatingMarginBps, countryCode);
  };

  const handleSelectSide = (nextSide: 'SELL' | 'BUY') => {
    setSide(nextSide);
    applyRecommendedForAsset(asset, nextSide, pricingType, floatingMarginBps, countryCode);
  };

  const handleCountryChange = (nextCountry: CountryCode) => {
    setCountryCode(nextCountry);
    onSelectCountry(nextCountry);
    applyRecommendedForAsset(asset, side, pricingType, floatingMarginBps, nextCountry);
  };

  const handleUnitPriceChange = (nextPriceStr: string) => {
    setAutoSyncPrice(false);
    setUnitPriceFiat(nextPriceStr);
    syncBinanceLimitsFromPriceAndQty(
      asset,
      nextPriceStr,
      totalQuantityCrypto,
      singleTransactionOnly
    );
  };

  const handleTotalQuantityChange = (nextQtyStr: string) => {
    setTotalQuantityCrypto(nextQtyStr);
    syncBinanceLimitsFromPriceAndQty(
      asset,
      unitPriceFiat,
      nextQtyStr,
      singleTransactionOnly
    );
  };

  const handleMinOrderFiatChange = (nextMinFiatStr: string) => {
    setMinOrderFiat(nextMinFiatStr);
    try {
      const minMinor = parseFiatToMinor(nextMinFiatStr);
      const unitMinor = parseFiatToMinor(unitPriceFiat);
      if (unitMinor > 0 && minMinor > 0) {
        const eqCryptoMicro = Number(
          (BigInt(minMinor) * 1_000_000n + BigInt(unitMinor) / 2n) / BigInt(unitMinor)
        );
        const eqNum = eqCryptoMicro / 1_000_000;
        setPerOrderMinCryptoInput(
          asset === 'USDT' || asset === 'USDC' ? eqNum.toFixed(2) : formatMicro6(eqCryptoMicro)
        );
        setSingleTransactionOnly(minMinor === effectiveMaxAllowedMinor);
      }
    } catch {
      // ignore mid-typing
    }
  };

  const handleSetExecutionMode = (singleTx: boolean) => {
    setSingleTransactionOnly(singleTx);
    syncBinanceLimitsFromPriceAndQty(
      asset,
      unitPriceFiat,
      totalQuantityCrypto,
      singleTx,
      singleTx ? undefined : asset === 'USDT' || asset === 'USDC' ? '100.00' : undefined
    );
  };

  const handleSetQuantityPercent = (pct: number) => {
    if (availableMicro <= 0) return;
    const targetMicro = Math.max(1000, Math.floor((availableMicro * pct) / 100));
    const formattedQty = formatMicro6(targetMicro);
    setTotalQuantityCrypto(formattedQty);
    syncBinanceLimitsFromPriceAndQty(
      asset,
      unitPriceFiat,
      formattedQty,
      singleTransactionOnly
    );
  };

  const toggleMethod = (pm: string) => {
    setSelectedMethods((prev) =>
      prev.includes(pm) ? prev.filter((item) => item !== pm) : [...prev, pm]
    );
  };

  const handleAddProfilePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddPaymentMethod) return;
    if (!newPmIdentifier.trim()) {
      setError('Please enter your UPI ID or bank account number to save to your profile.');
      return;
    }
    setAddingPmBusy(true);
    setError(null);
    try {
      const isUpi = ['phonepe', 'google pay', 'gpay', 'paytm', 'upi'].some((k) =>
        newPmName.toLowerCase().includes(k)
      );
      await onAddPaymentMethod({
        methodName: newPmName,
        category: isUpi ? 'UPI_APP' : 'BANK_TRANSFER',
        fiatCurrency: lockedFiatCurrency,
        accountHolder: currentUser?.displayName.replace(' (You)', '') || 'Verified Trader',
        accountIdentifier: newPmIdentifier.trim(),
        bankOrProvider: newPmBank.trim() || newPmName,
        verifyImmediately: true,
      });
      setSelectedMethods((prev) => (prev.includes(newPmName) ? prev : [...prev, newPmName]));
      setNewPmIdentifier('');
      setNewPmBank('');
      setShowAddPmForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method to profile');
    } finally {
      setAddingPmBusy(false);
    }
  };

  const primaryBank = useMemo(() => {
    const accounts = currentUser?.bankAccounts || [];
    return accounts.find((b) => b.isPrimary) || accounts[0] || null;
  }, [currentUser?.bankAccounts]);

  const handleInsertBankDetails = () => {
    if (!primaryBank) return;
    const upiPart = primaryBank.linkedUpiId ? ` | UPI: ${primaryBank.linkedUpiId}` : '';
    setPaymentInstructions(
      `Bank: ${primaryBank.bankName} (${primaryBank.accountType}) | A/C Holder: ${primaryBank.accountHolderName} | A/C: ${primaryBank.maskedAccountNumber} | IFSC/SWIFT: ${primaryBank.ifscOrSwiftCode}${upiPart}. Include COSTORAH Order ID in transfer notes.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (selectedMethods.length === 0) {
      setError(
        'Please select at least one saved payment method from your profile (or click "+ Add Payment Method to Profile").'
      );
      return;
    }
    if (limitValidationError) {
      setError(limitValidationError);
      return;
    }
    setSubmitting(true);
    try {
      const symLocal = FIAT_SYMBOLS[lockedFiatCurrency];
      const defaultTweetBody =
        tweetCustomText.trim() ||
        `Just posted a new P2P ${side} Order on the Market: ${totalQuantityCrypto} $${asset} @ ${symLocal}${unitPriceFiat} ${lockedFiatCurrency} via ${selectedMethods.join(', ')}. Limits: ${symLocal}${minOrderFiat} – ${symLocal}${maxOrderFiat}. Instant escrow settlement! #Bitcoin #Ethereum #${asset}`;

      await onCreateOffer({
        side,
        asset,
        fiatCurrency: lockedFiatCurrency,
        unitPriceFiat,
        totalQuantityCrypto,
        minOrderFiat,
        maxOrderFiat,
        paymentMethods: selectedMethods,
        paymentInstructions,
        postAsTweet,
        tweetContent: defaultTweetBody,
        tweetSentiment,
        tweetTaggedAssets: Array.from(new Set([asset, ...tweetTaggedAssets])),
        tweetImageUrl: tweetImageUrl.trim() || undefined,
      });
      setSuccessMsg(
        `Published ${side} offer for ${totalQuantityCrypto} ${asset} (${FIAT_SYMBOLS[lockedFiatCurrency]}${formatMinor2(totalOfferFiatMinor)} ${lockedFiatCurrency}) @ ${FIAT_SYMBOLS[lockedFiatCurrency]}${unitPriceFiat}/${asset}${postAsTweet ? ' & shared on Market Tweet Feed!' : '!'}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish offer');
    } finally {
      setSubmitting(false);
    }
  };

  const sym = FIAT_SYMBOLS[lockedFiatCurrency];
  const myOffers = useMemo(
    () => offers.filter((o) => o.makerId === currentUserId),
    [offers, currentUserId]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="create-offer-view">
      {/* Clean Page Header + Daily $10,000 Buy/Sell Limit Summary */}
      <div className="pb-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
            Simple 3-Step P2P Ad Creator · $10,000 USD Daily Limit
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1">
            Post Buy or Sell Offer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Buy or sell up to <strong>$10,000 USD per day</strong> in {lockedFiatCurrency} ({sym}). Select your price, amount, and saved profile payment methods below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <div
            data-testid="live-auto-price-badge"
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Market {asset}: <strong>{sym}{liveAutoPrice.unitPriceFiatFormatted}</strong>
            </span>
          </div>
          <div
            data-testid="offer-daily-limit-pill"
            className="px-3 py-1.5 rounded-lg bg-[#131A24] border border-white/10 text-xs font-mono text-slate-300"
          >
            Daily Remaining:{' '}
            <strong className="text-emerald-400">
              ${(side === 'SELL' ? dailyLimitStatus.dailySellRemainingUsd : dailyLimitStatus.dailyBuyRemainingUsd).toLocaleString()}
            </strong>{' '}
            / $10,000 USD
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#131A24] border border-white/[0.08] rounded-xl p-4 sm:p-6 space-y-6">
        {/* STEP 1: Choose I Want to Sell / Buy & Select Asset */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Step 1
              </span>
              <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                Choose What You Want to Do &amp; Select Asset
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 bg-[#0B0E14] border border-white/10 rounded-lg">
              <button
                type="button"
                data-testid="create-offer-side-sell"
                onClick={() => handleSelectSide('SELL')}
                className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                  side === 'SELL'
                    ? 'bg-emerald-500 text-[#0B0E14]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                I Want to Sell Crypto
              </button>
              <button
                type="button"
                data-testid="create-offer-side-buy"
                onClick={() => handleSelectSide('BUY')}
                className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                  side === 'BUY'
                    ? 'bg-amber-400 text-[#0B0E14]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                I Want to Buy Crypto
              </button>
            </div>
          </div>

          {/* 5 Clean Crypto Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {ASSETS.map((itemAsset) => {
              const isSelected = asset === itemAsset;
              const assetAuto = calculateAutoUnitPriceFiat({
                asset: itemAsset,
                countryCode,
                pricingType,
                floatingMarginBps,
                liveCryptoUsdPrice: livePriceFeed?.rates?.[itemAsset]?.usd,
                liveLocalExchangeRate,
              });
              const walletBal = balanceMap.get(itemAsset)?.availableMicro ?? 0;

              return (
                <button
                  key={itemAsset}
                  type="button"
                  data-testid={`create-offer-asset-${itemAsset}`}
                  onClick={() => handleSelectAsset(itemAsset)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm'
                      : 'bg-[#0B0E14] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CryptoAssetIcon asset={itemAsset} className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-bold text-slate-100">{itemAsset}</span>
                    </div>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </div>
                  <div className="mt-1.5 text-xs font-mono font-bold text-emerald-400 truncate">
                    {sym}{assetAuto.unitPriceFiatFormatted}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                    Bal: {formatMicro6(walletBal)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Country / Fiat Currency Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-xl">
            <div>
              <label htmlFor="offer-country" className="block text-xs font-medium text-slate-300 mb-1">
                Your Country &amp; Local Currency
              </label>
              <CustomSelect
                id="offer-country"
                testId="offer-country-select"
                value={countryCode}
                onChange={(val) => handleCountryChange(val as CountryCode)}
                options={buildCountryCurrencyOptions()}
                searchPlaceholder="Search country or currency (INR, USD, EUR...)"
              />
            </div>

            <div
              data-testid="create-offer-fiat-lock-banner"
              className="text-xs space-y-1 sm:pl-2"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Settlement Currency: {countryPolicy.fiatName} ({lockedFiatCurrency} {sym})
                </span>
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                Available Wallet Balance: <strong className="text-slate-200">{formatMicro6(availableMicro)} {asset}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: Set Price, Total Amount & Order Limits */}
        <div className="space-y-4 pt-5 border-t border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Step 2
              </span>
              <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                Set Your Price &amp; Amount (Up to $10,000/Day)
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 bg-[#0B0E14] border border-white/10 rounded-lg self-start">
              <button
                type="button"
                data-testid="order-mode-multiple-tx"
                onClick={() => handleSetExecutionMode(false)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                  !singleTransactionOnly
                    ? 'bg-emerald-500 text-[#0B0E14]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Allow Partial Orders
              </button>
              <button
                type="button"
                data-testid="order-mode-single-tx"
                onClick={() => handleSetExecutionMode(true)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                  singleTransactionOnly
                    ? 'bg-emerald-500 text-[#0B0E14]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Single Full Order Only
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Box 1: Unit Price */}
            <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="unit-price" className="text-xs font-medium text-slate-300">
                  Your Price per 1 {asset} ({sym} {lockedFiatCurrency})
                </label>
                <button
                  type="button"
                  data-testid="sync-auto-price-btn"
                  onClick={() => {
                    setAutoSyncPrice(true);
                    setUnitPriceFiat(liveAutoPrice.unitPriceFiatFormatted);
                    syncBinanceLimitsFromPriceAndQty(
                      asset,
                      liveAutoPrice.unitPriceFiatFormatted,
                      totalQuantityCrypto,
                      singleTransactionOnly
                    );
                  }}
                  className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Use Market ({sym}{liveAutoPrice.unitPriceFiatFormatted})</span>
                </button>
              </div>
              <input
                id="unit-price"
                data-testid="offer-unit-price-input"
                type="text"
                required
                value={unitPriceFiat}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-[#131A24] border border-emerald-500/40 rounded-lg text-emerald-300"
              />
            </div>

            {/* Box 2: Total Quantity */}
            <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="total-qty" className="text-xs font-medium text-slate-300">
                  Total Quantity to {side === 'SELL' ? 'Sell' : 'Buy'} ({asset})
                </label>
                {side === 'SELL' && (
                  <div className="inline-flex items-center gap-1">
                    {[25, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleSetQuantityPercent(pct)}
                        className="px-1.5 py-0.5 text-[10px] font-mono bg-[#131A24] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                id="total-qty"
                data-testid="offer-total-qty-input"
                type="text"
                required
                value={totalQuantityCrypto}
                onChange={(e) => handleTotalQuantityChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
              />
              <div className="text-[11px] font-mono text-slate-400">
                Total Value: <strong className="text-emerald-400">{sym}{formatMinor2(totalOfferFiatMinor)} {lockedFiatCurrency}</strong> (≈ ${offerUsdEquivalent.toLocaleString()} USD)
              </div>
            </div>
          </div>

          {/* Min & Max Order Limits Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="min-fiat" className="text-xs font-medium text-slate-300">
                  Min Per-Order Amount ({sym} {lockedFiatCurrency})
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  Smallest single trade you accept
                </span>
              </div>
              <input
                id="min-fiat"
                data-testid="offer-min-fiat-input"
                type="text"
                required
                value={minOrderFiat}
                onChange={(e) => handleMinOrderFiatChange(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs font-mono bg-[#131A24] border rounded-lg text-slate-100 ${
                  limitValidationError ? 'border-red-500/60' : 'border-white/15'
                }`}
              />
            </div>

            <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="max-fiat" className="text-xs font-medium text-slate-300">
                  Max Per-Order Amount ({sym} {lockedFiatCurrency})
                </label>
                <button
                  type="button"
                  data-testid="set-max-500-usdt-btn"
                  onClick={() => setMaxOrderFiat(formatMinor2(effectiveMaxAllowedMinor))}
                  className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                >
                  Auto-Set Full ({sym}{formatMinor2(effectiveMaxAllowedMinor)})
                </button>
              </div>
              <input
                id="max-fiat"
                data-testid="offer-max-fiat-input"
                type="text"
                required
                value={maxOrderFiat}
                onChange={(e) => setMaxOrderFiat(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs font-mono bg-[#131A24] border rounded-lg text-slate-100 ${
                  limitValidationError ? 'border-red-500/60' : 'border-white/15'
                }`}
              />
            </div>
          </div>

          <div
            data-testid="offer-usdt-cap-banner"
            className={`px-3.5 py-2.5 rounded-lg border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
              limitValidationError
                ? 'bg-red-950/50 border-red-500/40 text-red-200'
                : 'bg-[#0B0E14] border-white/[0.08] text-slate-300'
            }`}
          >
            <span>
              {limitValidationError
                ? limitValidationError
                : `${side === 'SELL' ? 'Selling' : 'Buying'}: ${totalQuantityCrypto} ${asset} (${sym}${formatMinor2(totalOfferFiatMinor)} ${lockedFiatCurrency}) · Per-Order Range: ${sym}${minOrderFiat} – ${sym}${maxOrderFiat}`}
            </span>
            <span className="font-bold text-emerald-400">
              Daily Limit: Up to ${DAILY_TRADING_LIMIT_USD.toLocaleString()} USD/day
            </span>
          </div>
        </div>

        {/* STEP 3: Saved Profile Payment Methods Only (Binance P2P Style) */}
        <div className="space-y-4 pt-5 border-t border-white/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Step 3
              </span>
              <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                Select Your Saved Payment Methods ({lockedFiatCurrency})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Only payment methods saved on your profile are shown below. Select the methods you want to accept for this offer, or add a new payment method to your profile.
              </p>
            </div>

            {onAddPaymentMethod && (
              <button
                type="button"
                data-testid="create-offer-add-pm-btn"
                onClick={() => setShowAddPmForm((prev) => !prev)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddPmForm ? 'Close Form' : 'Add Payment Method to Profile'}</span>
              </button>
            )}
          </div>

          {savedProfileMethodsForFiat.length === 0 ? (
            <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>
                You don&apos;t have any saved <strong>{lockedFiatCurrency}</strong> payment methods on your profile yet. Click <strong>Add Payment Method to Profile</strong> to add your UPI ID or Bank Account first.
              </span>
              {onAddPaymentMethod && !showAddPmForm && (
                <button
                  type="button"
                  onClick={() => setShowAddPmForm(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-400 text-[#0B0E14] rounded-lg cursor-pointer shrink-0"
                >
                  + Add {lockedFiatCurrency} Payment Method
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-testid="saved-profile-payment-methods-list">
              {savedProfileMethodsForFiat.map((pm) => {
                const active = selectedMethods.includes(pm.methodName);
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => toggleMethod(pm.methodName)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-slate-100'
                        : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>{pm.methodName}</span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          Saved on Profile
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {pm.accountIdentifier} · {pm.accountHolder} ({pm.bankOrProvider})
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-emerald-400 border-emerald-400 text-[#0B0E14]'
                          : 'border-slate-600'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Inline Add Payment Method to Profile Form */}
          {showAddPmForm && (
            <div
              data-testid="create-offer-inline-add-pm-form"
              className="p-4 bg-[#0B0E14] border border-emerald-500/35 rounded-xl space-y-3"
            >
              <div className="text-xs font-bold text-emerald-300">
                Add New {lockedFiatCurrency} Payment Method to Your Profile
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Payment Method Type</label>
                  <select
                    value={newPmName}
                    onChange={(e) => setNewPmName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                  >
                    {(supportedPaymentMethods[lockedFiatCurrency] || []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    UPI ID / Bank Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. alex@okaxis or Acct #"
                    value={newPmIdentifier}
                    onChange={(e) => setNewPmIdentifier(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Bank or Provider Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank / PhonePe"
                    value={newPmBank}
                    onChange={(e) => setNewPmBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={addingPmBusy}
                  onClick={handleAddProfilePaymentMethod}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] rounded-lg cursor-pointer"
                >
                  {addingPmBusy ? 'Saving to Profile...' : 'Save to Profile & Select'}
                </button>
              </div>
            </div>
          )}

          {/* Optional Payment Notes */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="payment-instructions" className="block text-xs font-medium text-slate-300">
                Payment Instructions / Terms for Counterparty
              </label>
              {primaryBank && (
                <button
                  type="button"
                  data-testid="insert-registered-bank-btn"
                  onClick={handleInsertBankDetails}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Building2 className="w-3 h-3" />
                  <span>Insert Registered Bank ({primaryBank.bankName})</span>
                </button>
              )}
            </div>
            <textarea
              id="payment-instructions"
              rows={2}
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
            />
          </div>
        </div>

        {/* Clean Fee & Net Proceeds Summary */}
        {liveOfferValuation && (
          <div
            data-testid="offer-live-valuation-card"
            className="p-4 bg-[#0B0E14] border border-emerald-500/30 rounded-xl space-y-2 text-xs font-mono tabular-nums"
          >
            <div className="flex items-center justify-between text-slate-200 font-sans font-semibold pb-1.5 border-b border-white/[0.06]">
              <span className="inline-flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>
                  Summary: {side === 'SELL' ? 'Sell' : 'Buy'} {totalQuantityCrypto} {asset} @ {sym}{unitPriceFiat}
                </span>
              </span>
              <span className="text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                {(feeBps / 100).toFixed(2)}% Seller Fee
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <div className="text-slate-400">Gross Fiat Total</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {sym}{liveOfferValuation.grossFiatFormatted} {lockedFiatCurrency}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Platform Fee ({(feeBps / 100).toFixed(2)}%)</div>
                <div className="text-sm font-semibold text-amber-400 mt-0.5">
                  -{sym}{liveOfferValuation.platformFeeFiatFormatted} {lockedFiatCurrency}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Net Seller Proceeds</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {sym}{liveOfferValuation.sellerNetFiatFormatted} {lockedFiatCurrency}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Order on Market Tweet Feed Option */}
        <div
          data-testid="create-offer-tweet-broadcast-box"
          className="p-4 bg-[#0B0E14] border border-sky-500/35 rounded-xl space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                data-testid="post-order-as-tweet-checkbox"
                checked={postAsTweet}
                onChange={(e) => setPostAsTweet(e.target.checked)}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-100">
                Also Post This Order on the Market Tweet Feed (Share Order &amp; Market Sentiment)
              </span>
            </label>

            {postAsTweet && (
              <div className="inline-flex p-0.5 bg-[#131A24] border border-white/10 rounded-lg text-[11px]">
                {(['ORDER_ALERT', 'BULLISH', 'BEARISH'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTweetSentiment(mode)}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      tweetSentiment === mode
                        ? 'bg-emerald-500 text-[#0B0E14]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'ORDER_ALERT' ? 'Order Broadcast' : mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {postAsTweet && (
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Tweet Commentary &amp; Market Sentiment (Leave blank to auto-generate with #Bitcoin #Ethereum)
                </label>
                <textarea
                  rows={2}
                  data-testid="create-offer-tweet-textarea"
                  value={tweetCustomText}
                  onChange={(e) => setTweetCustomText(e.target.value)}
                  placeholder={`Just posted a new P2P ${side} Order: ${totalQuantityCrypto} $${asset} @ ${sym}${unitPriceFiat} ${lockedFiatCurrency}! Tagging #Bitcoin #Ethereum`}
                  className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400 mr-1">Tag Assets:</span>
                  {(['BTC', 'ETH', 'SOL', 'USDT', 'USDC'] as CryptoAsset[]).map((tagSym) => {
                    const active = tweetTaggedAssets.includes(tagSym);
                    return (
                      <button
                        key={tagSym}
                        type="button"
                        onClick={() =>
                          setTweetTaggedAssets((prev) =>
                            prev.includes(tagSym)
                              ? prev.filter((item) => item !== tagSym)
                              : [...prev, tagSym]
                          )
                        }
                        className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer inline-flex items-center gap-1 ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-[#131A24] border-white/10 text-slate-400'
                        }`}
                      >
                        <CryptoAssetIcon asset={tagSym} className="w-3 h-3" />
                        <span>
                          {tagSym === 'BTC'
                            ? '#Bitcoin'
                            : tagSym === 'ETH'
                            ? '#Ethereum'
                            : `#${tagSym}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={tweetImageUrl}
                  onChange={(e) => setTweetImageUrl(e.target.value)}
                  placeholder="Optional chart / image URL (https://...)"
                  className="px-3 py-1.5 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100 w-full sm:w-64"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            {onNavigatePulse && (
              <button
                type="button"
                onClick={onNavigatePulse}
                className="px-3 py-1 rounded-lg bg-emerald-400 text-[#0B0E14] font-bold text-xs cursor-pointer shrink-0"
              >
                View on Market Tweet Feed →
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            data-testid="publish-offer-submit-btn"
            disabled={submitting || Boolean(limitValidationError)}
            className="px-6 py-3 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {submitting
                ? 'Publishing Offer...'
                : side === 'SELL'
                ? `Publish Sell Offer · ${totalQuantityCrypto} ${asset} (${sym}${formatMinor2(totalOfferFiatMinor)})${postAsTweet ? ' + Tweet' : ''}`
                : `Publish Buy Offer · ${totalQuantityCrypto} ${asset} (${sym}${formatMinor2(totalOfferFiatMinor)})${postAsTweet ? ' + Tweet' : ''}`}
            </span>
          </button>
        </div>
      </form>

      {/* Active & Paused Published Offers Management Table (with Edit, double-confirm Pause, double-confirm Cancel) */}
      <PublishedOffersManager
        offers={offers}
        currentUserId={currentUserId}
        currentUser={currentUser}
        supportedPaymentMethods={supportedPaymentMethods}
        onUpdateOfferStatus={onUpdateOfferStatus}
        onEditOffer={onEditOffer}
      />
    </div>
  );
};
