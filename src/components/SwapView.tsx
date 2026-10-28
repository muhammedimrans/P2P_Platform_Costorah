import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  ExternalLink,
  Layers,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  SUPPORTED_SWAP_CHAINS,
  TOP_TRADING_COUNTRIES,
  USD_REFERENCE_RATES,
  calculateAutoUnitPriceFiat,
  calculateCrossChainSwapQuote,
  validateSwapChainDestinationAddress,
  type AssetBalance,
  type CryptoAsset,
  type LivePriceFeed,
  type SwapChainId,
  type SwapExecutionRecord,
  type UserProfile,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import { CRYPTO_ASSET_CATALOG, CryptoAssetIcon } from './CryptoAssetIcons';

interface SwapViewProps {
  currentUser: UserProfile;
  balances: AssetBalance[];
  livePriceFeed?: LivePriceFeed;
  swapHistory?: SwapExecutionRecord[];
  theme?: 'day' | 'night';
  onExecuteSwap: (payload: {
    fromAsset: CryptoAsset;
    toAsset: CryptoAsset;
    fromAmount: string;
    chain: SwapChainId;
    settlementMode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL';
    destinationAddress?: string;
    slippageBps?: number;
  }) => Promise<{ swap?: SwapExecutionRecord }>;
  onNavigateDashboard?: () => void;
}

const SWAP_CURRENCIES: CryptoAsset[] = ['USDT', 'USDC', 'BNB', 'ETH', 'SOL', 'BTC'];
const CHAIN_LIST: SwapChainId[] = ['BNB_CHAIN', 'SOL_CHAIN', 'ERC20_CHAIN'];

const SAMPLE_CHAIN_ADDRESSES: Record<SwapChainId, string> = {
  BNB_CHAIN: '0x71C95911E9a5D330f4D621842EC243EE1343292e',
  SOL_CHAIN: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  ERC20_CHAIN: '0x94A3B88C9129E001A4421B77E89C001122334455',
};

export const SwapView: React.FC<SwapViewProps> = ({
  currentUser,
  balances,
  livePriceFeed,
  swapHistory = [],
  theme = 'day',
  onExecuteSwap,
  onNavigateDashboard,
}) => {
  const isDay = theme === 'day';

  const [fromAsset, setFromAsset] = useState<CryptoAsset>('USDT');
  const [toAsset, setToAsset] = useState<CryptoAsset>('BNB');
  const [selectedChain, setSelectedChain] = useState<SwapChainId>('BNB_CHAIN');
  const [settlementMode, setSettlementMode] = useState<'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL'>(
    'EXCHANGE_INTERNAL'
  );
  const [fromAmountInput, setFromAmountInput] = useState<string>('250.00');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [slippageBps, setSlippageBps] = useState<number>(50); // 0.50%
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCompletedSwap, setLastCompletedSwap] = useState<SwapExecutionRecord | null>(null);

  const liveInrRate =
    livePriceFeed?.usdInrRate ??
    livePriceFeed?.fiatExchangeRates?.INR ??
    TOP_TRADING_COUNTRIES.IN.usdExchangeRate ??
    94.76;

  const liveUsdRates = useMemo<Partial<Record<CryptoAsset, number>>>(() => {
    return {
      USDT: livePriceFeed?.rates?.USDT?.usd ?? USD_REFERENCE_RATES.USDT,
      USDC: livePriceFeed?.rates?.USDC?.usd ?? USD_REFERENCE_RATES.USDC,
      BNB: livePriceFeed?.rates?.BNB?.usd ?? USD_REFERENCE_RATES.BNB,
      ETH: livePriceFeed?.rates?.ETH?.usd ?? USD_REFERENCE_RATES.ETH,
      SOL: livePriceFeed?.rates?.SOL?.usd ?? USD_REFERENCE_RATES.SOL,
      BTC: livePriceFeed?.rates?.BTC?.usd ?? USD_REFERENCE_RATES.BTC,
    };
  }, [livePriceFeed]);

  const balanceMap = useMemo(() => {
    const map = new Map<CryptoAsset, AssetBalance>();
    for (const b of balances) {
      map.set(b.asset, b);
    }
    return map;
  }, [balances]);

  const fromBalance = balanceMap.get(fromAsset) || {
    asset: fromAsset,
    availableMicro: 0,
    lockedMicro: 0,
  };
  const toBalance = balanceMap.get(toAsset) || {
    asset: toAsset,
    availableMicro: 0,
    lockedMicro: 0,
  };

  // Total portfolio holdings in INR
  const portfolioHoldings = useMemo(() => {
    let totalInrMinor = 0;
    const rows = SWAP_CURRENCIES.map((asset) => {
      const bal = balanceMap.get(asset);
      const availMicro = bal?.availableMicro ?? 0;
      const lockedMicro = bal?.lockedMicro ?? 0;
      const inrPrice = calculateAutoUnitPriceFiat({
        asset,
        countryCode: 'IN',
        pricingType: 'FIXED',
        liveCryptoUsdPrice: liveUsdRates[asset],
        liveLocalExchangeRate: liveInrRate,
      });
      const availInrMinor = Math.round((availMicro * inrPrice.unitPriceFiatMinor) / 1_000_000);
      totalInrMinor += availInrMinor;
      return {
        asset,
        availMicro,
        lockedMicro,
        availFormatted: formatMicro6(availMicro),
        availInrMinor,
        availInrFormatted: formatMinor2(availInrMinor),
        usdPrice: liveUsdRates[asset] ?? USD_REFERENCE_RATES[asset],
      };
    });
    return {
      totalInrMinor,
      totalInrFormatted: formatMinor2(totalInrMinor),
      rows,
    };
  }, [balanceMap, liveUsdRates, liveInrRate]);

  // Live cross-chain swap quote
  const quoteResult = useMemo(() => {
    try {
      const clean = fromAmountInput.replace(/,/g, '').trim();
      if (!clean || Number(clean) <= 0) {
        return { quote: null, error: null };
      }
      const quote = calculateCrossChainSwapQuote({
        fromAsset,
        toAsset,
        fromAmountInput: clean,
        chain: selectedChain,
        settlementMode,
        slippageBps,
        liveRates: liveUsdRates,
        usdInrRate: liveInrRate,
      });
      return { quote, error: null };
    } catch (e: unknown) {
      return {
        quote: null,
        error: e instanceof Error ? e.message : 'Enter a valid swap amount',
      };
    }
  }, [
    fromAsset,
    toAsset,
    fromAmountInput,
    selectedChain,
    settlementMode,
    slippageBps,
    liveUsdRates,
    liveInrRate,
  ]);

  const handleFlipAssets = () => {
    setErrorMsg(null);
    const prevFrom = fromAsset;
    const prevTo = toAsset;
    setFromAsset(prevTo);
    setToAsset(prevFrom);
    if (quoteResult.quote && quoteResult.quote.toAmountMicro > 0) {
      const nextInput = (quoteResult.quote.toAmountMicro / 1_000_000).toFixed(4).replace(/\.?0+$/, '');
      setFromAmountInput(nextInput || '1');
    }
  };

  const handleSelectPercentage = (pct: number) => {
    setErrorMsg(null);
    const targetMicro = Math.floor((fromBalance.availableMicro * pct) / 100);
    if (targetMicro <= 0) {
      setFromAmountInput('0');
      return;
    }
    const formatted =
      pct === 100
        ? formatMicro6(targetMicro)
        : (targetMicro / 1_000_000).toFixed(4).replace(/\.?0+$/, '') || '0.0001';
    setFromAmountInput(formatted);
  };

  const handleSelectFromAsset = (asset: CryptoAsset) => {
    setErrorMsg(null);
    if (asset === toAsset && settlementMode === 'EXCHANGE_INTERNAL') {
      setToAsset(fromAsset);
    }
    setFromAsset(asset);
    // Suggest a sensible default amount if switching between high-unit and low-unit assets
    if (asset === 'BTC') setFromAmountInput('0.01');
    else if (asset === 'ETH') setFromAmountInput('0.25');
    else if (asset === 'BNB') setFromAmountInput('1.00');
    else if (asset === 'SOL') setFromAmountInput('2.50');
    else setFromAmountInput('250.00');
  };

  const handleSelectToAsset = (asset: CryptoAsset) => {
    setErrorMsg(null);
    if (asset === fromAsset && settlementMode === 'EXCHANGE_INTERNAL') {
      setFromAsset(toAsset);
    }
    setToAsset(asset);
    // Auto-select native chain when user picks BNB, SOL, or ETH
    if (asset === 'BNB') setSelectedChain('BNB_CHAIN');
    else if (asset === 'SOL') setSelectedChain('SOL_CHAIN');
    else if (asset === 'ETH') setSelectedChain('ERC20_CHAIN');
  };

  const handleUseConnectedOrSampleAddress = () => {
    setErrorMsg(null);
    const matchingWallet = currentUser.wallets.find((w) => {
      if (selectedChain === 'SOL_CHAIN') {
        return w.networkFamily === 'SOLANA_SPL' || !w.address.startsWith('0x');
      }
      return w.address.startsWith('0x');
    });
    if (matchingWallet) {
      setDestinationAddress(matchingWallet.address);
    } else {
      setDestinationAddress(SAMPLE_CHAIN_ADDRESSES[selectedChain]);
    }
  };

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLastCompletedSwap(null);

    if (!quoteResult.quote) {
      setErrorMsg(quoteResult.error || 'Please enter a valid swap amount.');
      return;
    }

    if (settlementMode === 'EXCHANGE_INTERNAL' && fromAsset === toAsset) {
      setErrorMsg(
        'Please select a different destination currency for an internal wallet exchange, or switch to "Swap & Withdraw to Chain" to withdraw on-chain.'
      );
      return;
    }

    if (quoteResult.quote.fromAmountMicro > fromBalance.availableMicro) {
      setErrorMsg(
        `Insufficient available ${fromAsset} balance. Available: ${formatMicro6(
          fromBalance.availableMicro
        )} ${fromAsset}.`
      );
      return;
    }

    if (settlementMode === 'WITHDRAW_EXTERNAL') {
      const check = validateSwapChainDestinationAddress(destinationAddress, selectedChain);
      if (!check.valid) {
        setErrorMsg(check.error || 'Invalid destination wallet address for the selected chain.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await onExecuteSwap({
        fromAsset,
        toAsset,
        fromAmount: fromAmountInput.trim(),
        chain: selectedChain,
        settlementMode,
        destinationAddress:
          settlementMode === 'WITHDRAW_EXTERNAL' ? destinationAddress.trim() : undefined,
        slippageBps,
      });
      if (res?.swap) {
        setLastCompletedSwap(res.swap);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Swap execution failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeChainMeta = SUPPORTED_SWAP_CHAINS[selectedChain];

  return (
    <div data-testid="swap-view-page" className="space-y-6">
      {/* Top Institutional Banner */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
          isDay
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-[#131A24] border-white/[0.08] shadow-xl'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Multi-Chain Instant Liquidity Router · BNB Chain · Solana · ERC-20</span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-bold font-display tracking-tight ${
                isDay ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              Swap &amp; Cross-Chain Currency Exchange
            </h1>
            <p className={`text-xs sm:text-sm ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
              Instantly swap between <span className="font-mono font-semibold text-emerald-400">ETH</span>,{' '}
              <span className="font-mono font-semibold text-emerald-400">SOL</span>,{' '}
              <span className="font-mono font-semibold text-emerald-400">USDT</span>,{' '}
              <span className="font-mono font-semibold text-emerald-400">USDC</span>,{' '}
              <span className="font-mono font-semibold text-amber-400">BNB</span>, and{' '}
              <span className="font-mono font-semibold text-amber-400">BTC</span> across{' '}
              <span className="font-semibold">BNB Chain (BEP-20)</span>,{' '}
              <span className="font-semibold">Solana Chain (SPL)</span>, and{' '}
              <span className="font-semibold">ERC-20 Chain</span> to exchange or withdraw directly to your external wallet.
            </p>
          </div>

          {/* Right Summary Pill: Total Crypto Holding Worth in Rupees */}
          <div
            data-testid="swap-page-total-holdings-inr"
            className={`p-4 rounded-xl border font-mono shrink-0 ${
              isDay
                ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                : 'bg-[#0B0E14] border-emerald-500/30 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
              <Wallet className="w-3.5 h-3.5" />
              <span>Your Total Crypto Holding Worth</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              ₹{Number(portfolioHoldings.totalInrFormatted).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-semibold">INR</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              1 USD = ₹{liveInrRate.toFixed(2)} INR · 6 Supported Currencies
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Left = Swap & Chain Withdraw Terminal, Right = Live Chain Routing & Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Interactive Swap & Chain Withdraw Terminal */}
        <div
          className={`lg:col-span-7 rounded-2xl border p-5 sm:p-6 space-y-5 ${
            isDay
              ? 'bg-white border-slate-200 shadow-sm'
              : 'bg-[#131A24] border-white/[0.08] shadow-xl'
          }`}
        >
          {/* Step 1: Select Blockchain Network (BNB Chain, SOL Chain, ERC-20 Chain) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>1. Select Blockchain Network</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-400">
                {activeChainMeta.estimatedConfirmationText}
              </span>
            </div>

            <div
              data-testid="swap-chain-selector"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
            >
              {CHAIN_LIST.map((chainId) => {
                const meta = SUPPORTED_SWAP_CHAINS[chainId];
                const isSelected = selectedChain === chainId;
                return (
                  <button
                    key={chainId}
                    type="button"
                    data-testid={`swap-chain-btn-${chainId}`}
                    onClick={() => {
                      setSelectedChain(chainId);
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? chainId === 'BNB_CHAIN'
                          ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-md'
                          : chainId === 'SOL_CHAIN'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-md'
                          : 'bg-sky-500/15 border-sky-400 text-sky-300 shadow-md'
                        : isDay
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CryptoAssetIcon
                          asset={meta.nativeGasSymbol}
                          className="w-5 h-5 shrink-0"
                        />
                        <span className="font-bold text-xs font-display">{meta.shortLabel}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isSelected
                            ? 'bg-black/30 text-white'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {meta.tokenStandard}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono opacity-85 flex items-center justify-between">
                      <span>Gas: ${meta.networkFeeUsd.toFixed(2)}</span>
                      <span>{isSelected ? '● Active' : 'Select'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Action Mode (Instant Wallet Exchange vs Swap & Withdraw to Chain) */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Settlement Mode (Exchange vs Chain Withdrawal)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
              <button
                type="button"
                data-testid="swap-mode-exchange-internal"
                onClick={() => {
                  setSettlementMode('EXCHANGE_INTERNAL');
                  setErrorMsg(null);
                  if (fromAsset === toAsset) {
                    setToAsset(fromAsset === 'USDT' ? 'BNB' : 'USDT');
                  }
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                  settlementMode === 'EXCHANGE_INTERNAL'
                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 font-bold'
                    : isDay
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Instant Wallet Exchange</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    0 Gas Fee · Credits Costorah Wallet
                  </div>
                </div>
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                data-testid="swap-mode-withdraw-external"
                onClick={() => {
                  setSettlementMode('WITHDRAW_EXTERNAL');
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                  settlementMode === 'WITHDRAW_EXTERNAL'
                    ? 'bg-sky-500/15 border-sky-400 text-sky-300 font-bold'
                    : isDay
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Swap &amp; Withdraw to Chain</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Withdraws to {activeChainMeta.shortLabel} ({activeChainMeta.tokenStandard})
                  </div>
                </div>
                <Send className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitSwap} className="space-y-4">
            {/* FROM Currency Box */}
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-[#0B0E14] border-white/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="text-slate-400 font-semibold uppercase">From (You Pay / Swap)</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    Available:{' '}
                    <strong
                      data-testid="swap-from-available-balance"
                      className="text-emerald-400"
                    >
                      {formatMicro6(fromBalance.availableMicro)} {fromAsset}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Currency Pills for From Asset */}
              <div className="flex flex-wrap items-center gap-1.5">
                {SWAP_CURRENCIES.map((asset) => {
                  const active = fromAsset === asset;
                  return (
                    <button
                      key={asset}
                      type="button"
                      data-testid={`swap-from-asset-${asset}`}
                      onClick={() => handleSelectFromAsset(asset)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#0B65C6] text-white border-sky-400 shadow-sm'
                          : isDay
                          ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          : 'bg-[#131A24] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <CryptoAssetIcon asset={asset} className="w-4 h-4 shrink-0" />
                      <span>{asset}</span>
                    </button>
                  );
                })}
              </div>

              {/* Amount Input + Percentage Quick Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex-1">
                  <input
                    id="swap-from-amount-input"
                    data-testid="swap-from-amount-input"
                    type="text"
                    inputMode="decimal"
                    value={fromAmountInput}
                    onChange={(e) => {
                      setFromAmountInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="0.00"
                    className={`w-full text-2xl sm:text-3xl font-bold font-mono bg-transparent focus:outline-none tabular-nums ${
                      isDay ? 'text-slate-900' : 'text-slate-100'
                    }`}
                  />
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    {quoteResult.quote ? (
                      <>
                        ≈ ${quoteResult.quote.grossUsdValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        USD ·{' '}
                        <span className="text-emerald-400 font-semibold">
                          ₹{quoteResult.quote.grossInrValue.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          INR
                        </span>
                      </>
                    ) : (
                      <span>Enter amount of {fromAsset} to swap</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  {[
                    { label: '25%', pct: 25 },
                    { label: '50%', pct: 50 },
                    { label: '75%', pct: 75 },
                    { label: 'MAX', pct: 100 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      data-testid={`swap-pct-${btn.pct}`}
                      onClick={() => handleSelectPercentage(btn.pct)}
                      className={`px-2.5 py-1 rounded-md border font-bold cursor-pointer transition-colors ${
                        isDay
                          ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          : 'bg-[#131A24] border-white/15 text-emerald-400 hover:bg-emerald-500/15'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Flip Direction Button */}
            <div className="flex items-center justify-center -my-2 relative z-10">
              <button
                type="button"
                data-testid="swap-flip-currencies-btn"
                onClick={handleFlipAssets}
                title="Flip From and To Currencies"
                className={`p-2.5 rounded-xl border shadow-lg cursor-pointer transition-transform hover:scale-105 ${
                  isDay
                    ? 'bg-white border-slate-300 text-[#0B65C6] hover:bg-sky-50'
                    : 'bg-[#172130] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>

            {/* TO Currency Box */}
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-[#0B0E14] border-white/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="text-slate-400 font-semibold uppercase">
                  To (You Receive on {activeChainMeta.shortLabel})
                </span>
                <span className="text-slate-400">
                  Holding:{' '}
                  <strong data-testid="swap-to-available-balance" className="text-slate-200">
                    {formatMicro6(toBalance.availableMicro)} {toAsset}
                  </strong>
                </span>
              </div>

              {/* Currency Pills for To Asset */}
              <div className="flex flex-wrap items-center gap-1.5">
                {SWAP_CURRENCIES.map((asset) => {
                  const active = toAsset === asset;
                  return (
                    <button
                      key={asset}
                      type="button"
                      data-testid={`swap-to-asset-${asset}`}
                      onClick={() => handleSelectToAsset(asset)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-[#0B0E14] border-emerald-300 shadow-sm'
                          : isDay
                          ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          : 'bg-[#131A24] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <CryptoAssetIcon asset={asset} className="w-4 h-4 shrink-0" />
                      <span>{asset}</span>
                    </button>
                  );
                })}
              </div>

              {/* Calculated Output Quantity */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div
                  data-testid="swap-estimated-output"
                  className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tabular-nums"
                >
                  {quoteResult.quote ? quoteResult.quote.toAmountFormatted : '0.000000'}{' '}
                  <span className="text-base font-semibold">{toAsset}</span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {quoteResult.quote ? (
                    <>
                      Net Worth:{' '}
                      <span className="text-slate-200 font-semibold">
                        ${quoteResult.quote.netUsdValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>{' '}
                      ·{' '}
                      <span className="text-emerald-400 font-bold">
                        ₹{quoteResult.quote.netInrValue.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        INR
                      </span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>

            {/* External Chain Destination Wallet Input (Shown when WITHDRAW_EXTERNAL is active) */}
            {settlementMode === 'WITHDRAW_EXTERNAL' && (
              <div
                data-testid="swap-external-withdraw-box"
                className={`p-4 rounded-xl border space-y-2.5 ${
                  isDay
                    ? 'bg-sky-50/70 border-sky-200'
                    : 'bg-sky-950/20 border-sky-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <label
                    htmlFor="swap-destination-address"
                    className="font-bold text-sky-400 uppercase"
                  >
                    Destination {activeChainMeta.name} Address ({activeChainMeta.tokenStandard})
                  </label>
                  <button
                    type="button"
                    data-testid="swap-fill-wallet-address-btn"
                    onClick={handleUseConnectedOrSampleAddress}
                    className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Use Connected / Sample {activeChainMeta.tokenStandard} Address
                  </button>
                </div>
                <input
                  id="swap-destination-address"
                  data-testid="swap-destination-address"
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => {
                    setDestinationAddress(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={activeChainMeta.addressFormatHint}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:border-emerald-400 ${
                    isDay
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#0B0E14] border-white/15 text-slate-100'
                  }`}
                />
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Network Standard: {activeChainMeta.tokenStandard}</span>
                  <span>Est. Arrival: {activeChainMeta.estimatedConfirmationText}</span>
                </div>
              </div>
            )}

            {/* Quote & Route Details Summary Box */}
            {quoteResult.quote && (
              <div
                data-testid="swap-quote-breakdown"
                className={`p-3.5 rounded-xl border text-xs font-mono space-y-2 ${
                  isDay
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-[#0B0E14] border-white/[0.08] text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Conversion Rate</span>
                  <span className="font-bold">
                    1 {fromAsset} = {quoteResult.quote.exchangeRate} {toAsset}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Selected Network</span>
                  <span className="font-bold text-emerald-400">
                    {activeChainMeta.name} ({activeChainMeta.tokenStandard})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Liquidity Swap Fee (0.25%)</span>
                  <span>${quoteResult.quote.swapFeeUsd.toFixed(4)} USD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain Withdrawal Gas Fee</span>
                  <span>
                    {settlementMode === 'WITHDRAW_EXTERNAL'
                      ? `$${quoteResult.quote.networkGasFeeUsd.toFixed(2)} USD (${activeChainMeta.shortLabel})`
                      : '$0.00 (Internal Wallet Credit)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Slippage Tolerance</span>
                  <div className="flex items-center gap-1">
                    {[10, 50, 100].map((bps) => (
                      <button
                        key={bps}
                        type="button"
                        onClick={() => setSlippageBps(bps)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          slippageBps === bps
                            ? 'bg-emerald-500 text-[#0B0E14]'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {(bps / 100).toFixed(1)}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                  <span className="text-slate-400">Minimum Received</span>
                  <span className="font-bold text-emerald-400">
                    {quoteResult.quote.minimumReceivedFormatted} {toAsset}
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                data-testid="swap-error-banner"
                className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono"
              >
                {errorMsg}
              </div>
            )}

            {lastCompletedSwap && (
              <div
                data-testid="swap-success-banner"
                className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-mono space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      {lastCompletedSwap.settlementMode === 'WITHDRAW_EXTERNAL'
                        ? 'Cross-Chain Swap & Withdrawal Dispatched!'
                        : 'Instant Currency Swap Completed!'}
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {lastCompletedSwap.chainName}
                  </span>
                </div>
                <div>
                  Swapped{' '}
                  <strong>
                    {lastCompletedSwap.fromAmountFormatted} {lastCompletedSwap.fromAsset}
                  </strong>{' '}
                  →{' '}
                  <strong className="text-emerald-300">
                    {lastCompletedSwap.toAmountFormatted} {lastCompletedSwap.toAsset}
                  </strong>{' '}
                  (₹{lastCompletedSwap.netInrValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR)
                </div>
                {lastCompletedSwap.destinationAddress && (
                  <div className="text-[11px] text-slate-300 truncate">
                    Withdrawn to: {lastCompletedSwap.destinationAddress}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 truncate">
                  Tx Hash: {lastCompletedSwap.txHash}
                </div>
              </div>
            )}

            <button
              type="submit"
              data-testid="swap-submit-button"
              disabled={submitting || !quoteResult.quote}
              className="w-full py-3.5 px-5 rounded-xl font-display font-bold text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#0B0E14] shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Executing Cross-Chain Swap...'
                  : settlementMode === 'WITHDRAW_EXTERNAL'
                  ? `Swap ${fromAsset} → ${toAsset} & Withdraw on ${activeChainMeta.shortLabel}`
                  : `Swap ${fromAsset} to ${toAsset} on ${activeChainMeta.shortLabel}`}
              </span>
            </button>
          </form>
        </div>

        {/* Right Column (5 cols): User Holdings & Chain Liquidity Overview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Your Wallet Holdings Card (Click any currency to set as From Asset) */}
          <div
            data-testid="swap-wallet-holdings-card"
            className={`rounded-2xl border p-5 space-y-4 ${
              isDay
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-[#131A24] border-white/[0.08] shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2
                  className={`text-sm font-bold font-display flex items-center gap-2 ${
                    isDay ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>Your Crypto Balances &amp; Rupee Worth</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click any asset below to select it for swapping or chain withdrawal
                </p>
              </div>
              {onNavigateDashboard && (
                <button
                  type="button"
                  onClick={onNavigateDashboard}
                  className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Deposit</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 font-mono text-xs">
              {portfolioHoldings.rows.map((row) => {
                const isFrom = fromAsset === row.asset;
                const isTo = toAsset === row.asset;
                return (
                  <div
                    key={row.asset}
                    data-testid={`swap-holding-row-${row.asset}`}
                    onClick={() => handleSelectFromAsset(row.asset)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isFrom
                        ? 'bg-sky-500/15 border-sky-400/50'
                        : isTo
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : isDay
                        ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        : 'bg-[#0B0E14] border-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CryptoAssetIcon asset={row.asset} className="w-6 h-6 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              isDay ? 'text-slate-900' : 'text-slate-100'
                            }`}
                          >
                            {row.asset}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {CRYPTO_ASSET_CATALOG[row.asset]?.name}
                          </span>
                          {isFrom && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">
                              FROM
                            </span>
                          )}
                          {isTo && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                              TO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          1 {row.asset} = ${row.usdPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right tabular-nums">
                      <div
                        className={`font-bold ${
                          isDay ? 'text-slate-900' : 'text-slate-100'
                        }`}
                      >
                        {Number(row.availFormatted).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}{' '}
                        {row.asset}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-400">
                        ₹{Number(row.availInrFormatted).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        INR
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supported Chains & Withdrawal Networks Specification Card */}
          <div
            className={`rounded-2xl border p-5 space-y-3.5 ${
              isDay
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-[#131A24] border-white/[0.08] shadow-xl'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Supported Swap &amp; Withdrawal Chains</span>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              {CHAIN_LIST.map((chainId) => {
                const c = SUPPORTED_SWAP_CHAINS[chainId];
                return (
                  <div
                    key={chainId}
                    className={`p-3 rounded-xl border ${
                      isDay
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-[#0B0E14] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold ${
                          isDay ? 'text-slate-900' : 'text-slate-100'
                        }`}
                      >
                        {c.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                        {c.tokenStandard}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>Assets: ETH · SOL · USDT · USDC · BNB</span>
                      <span>Fee: ${c.networkFeeUsd.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Swap & Cross-Chain Withdrawal Activity Table */}
      <div
        data-testid="swap-history-section"
        className={`rounded-2xl border overflow-hidden ${
          isDay
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-[#131A24] border-white/[0.08] shadow-xl'
        }`}
      >
        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              className={`text-sm font-bold font-display ${
                isDay ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              Recent Currency Swaps &amp; Chain Withdrawals
            </h2>
            <p className="text-xs text-slate-400">
              Double-entry ledger verified swaps across BNB Chain (BEP-20), Solana (SPL), and Ethereum (ERC-20)
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            {swapHistory.length} Completed Swap{swapHistory.length === 1 ? '' : 's'}
          </span>
        </div>

        {swapHistory.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-400">
            No swaps executed yet in this session. Select your currencies and chain above to swap or withdraw.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr
                  className={`border-b text-[11px] ${
                    isDay
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-[#0B0E14] border-white/[0.06] text-slate-400'
                  }`}
                >
                  <th className="py-3 px-4">Swap Pair</th>
                  <th className="py-3 px-4">Chain Network</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Received</th>
                  <th className="py-3 px-4 text-right">Rupee Worth (₹)</th>
                  <th className="py-3 px-4">Tx Hash / Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {swapHistory.map((item) => (
                  <tr
                    key={item.id}
                    data-testid={`swap-history-row-${item.id}`}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 font-bold">
                      <div className="flex items-center gap-1.5">
                        <CryptoAssetIcon asset={item.fromAsset} className="w-4 h-4 shrink-0" />
                        <span>{item.fromAsset}</span>
                        <span className="text-slate-500">→</span>
                        <CryptoAssetIcon asset={item.toAsset} className="w-4 h-4 shrink-0" />
                        <span className="text-emerald-400">{item.toAsset}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px]">
                        {item.chainName} ({item.tokenStandard})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.settlementMode === 'WITHDRAW_EXTERNAL'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.settlementMode === 'WITHDRAW_EXTERNAL'
                          ? 'Chain Withdraw'
                          : 'Wallet Exchange'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      -{Number(item.fromAmountFormatted).toLocaleString('en-US', { maximumFractionDigits: 6 })}{' '}
                      {item.fromAsset}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                      +{Number(item.toAmountFormatted).toLocaleString('en-US', { maximumFractionDigits: 6 })}{' '}
                      {item.toAsset}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-400 tabular-nums">
                      ₹{item.netInrValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400 max-w-[200px] truncate">
                      {item.destinationAddress
                        ? `To: ${item.destinationAddress}`
                        : `Tx: ${item.txHash.slice(0, 18)}...`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
