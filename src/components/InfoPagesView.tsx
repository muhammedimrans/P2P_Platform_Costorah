import React, { useMemo, useState } from 'react';
import {
  ALL_FIAT_CURRENCIES,
  FIAT_SYMBOLS,
  type CryptoAsset,
  type FiatCurrency,
} from '../types';
import { calculateTradeBreakdown } from '../core/escrowEngine';
import { ALL_CRYPTO_ASSETS } from './CryptoAssetIcons';
import {
  CustomSelect,
  buildCryptoAssetOptions,
  buildFiatCurrencyOptions,
} from './CustomSelect';
import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  HelpCircle,
  Lock,
  Scale,
  Search,
  Shield,
} from 'lucide-react';

interface InfoPagesViewProps {
  feeBps: number;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  onNavigateMarket: () => void;
}

type InfoSection = 'ESCROW' | 'FEES' | 'CURRENCIES' | 'SECURITY' | 'FAQ' | 'LEGAL';
type FaqCategory = 'ALL' | 'ESCROW_LOCKING' | 'FEE_CALCULATIONS' | 'DISPUTE_RESOLUTION';

interface FaqAccordionItem {
  id: string;
  category: Exclude<FaqCategory, 'ALL'>;
  categoryLabel: string;
  question: string;
  answer: string;
  keyTakeaway: string;
}

export const InfoPagesView: React.FC<InfoPagesViewProps> = ({
  feeBps,
  supportedPaymentMethods,
  onNavigateMarket,
}) => {
  const [section, setSection] = useState<InfoSection>('ESCROW');
  const [calcFiatAmount, setCalcFiatAmount] = useState<string>('10000.00');
  const [calcUnitPrice, setCalcUnitPrice] = useState<string>('86.50');
  const [calcFiat, setCalcFiat] = useState<FiatCurrency>('INR');
  const [calcAsset, setCalcAsset] = useState<CryptoAsset>('USDT');

  // Interactive FAQ Accordion State
  const [faqCategory, setFaqCategory] = useState<FaqCategory>('ALL');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([
    'escrow-lock-1',
    'fee-calc-1',
    'dispute-res-1',
  ]);

  const feePctFormatted = (feeBps / 100).toFixed(2);

  const faqItems: FaqAccordionItem[] = useMemo(
    () => [
      {
        id: 'escrow-lock-1',
        category: 'ESCROW_LOCKING',
        categoryLabel: 'Escrow Locking',
        question:
          'How does Costorah’s 1:1 pre-funded escrow locking work before an offer or order starts?',
        answer:
          'When a seller publishes a SELL offer or accepts a BUY order, the exact cryptocurrency quantity (tracked in 6-decimal micro-units) is atomically transferred from their Available Balance to their Locked Escrow Balance in our double-entry ledger. Unbacked or fractional offers cannot be published.',
        keyTakeaway: '100% of trade crypto is locked in vault custody before fiat payment begins.',
      },
      {
        id: 'escrow-lock-2',
        category: 'ESCROW_LOCKING',
        categoryLabel: 'Escrow Locking',
        question:
          'Does clicking "Payment Sent" automatically release the seller’s cryptocurrency?',
        answer:
          'No. Clicking "Payment Sent" transitions the order state machine to PAYMENT_MARKED_SENT and logs your UTR/bank reference, which immediately freezes the automatic expiration timer. However, cryptocurrency is never auto-released — it is only released when the seller confirms bank receipt or an authorized ADMIN arbitrator resolves a dispute.',
        keyTakeaway:
          'PAYMENT_MARKED_SENT freezes expiry timers to protect buyers without auto-releasing seller funds.',
      },
      {
        id: 'escrow-lock-3',
        category: 'ESCROW_LOCKING',
        categoryLabel: 'Escrow Locking',
        question:
          'Why are locked funds in my Portfolio & Custody table blocked from withdrawal?',
        answer:
          'Locked funds actively back open P2P sell advertisements or in-progress escrow orders. To prevent double-spending, our ledger invariant strictly enforces that withdrawals can only draw from your Available Balance. Cancelling an open offer immediately returns unreserved crypto to your Available Balance.',
        keyTakeaway:
          'Locked funds cannot be withdrawn or double-pledged until the trade completes or the offer is cancelled.',
      },
      {
        id: 'fee-calc-1',
        category: 'FEE_CALCULATIONS',
        categoryLabel: 'Fee Calculations',
        question: `How is the ${feePctFormatted}% platform fee calculated, and who pays it?`,
        answer: `Costorah charges a flat ${feePctFormatted}% (${feeBps} bps) fee deducted from the seller’s gross fiat proceeds upon successful order completion. Buyers pay 0.00% platform fees and receive 100% of the escrowed cryptocurrency quantity. For example, on a ₹10,000.00 INR trade at ${feePctFormatted}%, the platform fee is ₹100.00 INR and the seller’s net proceeds are ₹9,900.00 INR.`,
        keyTakeaway: `Flat ${feePctFormatted}% seller fee on completed trades · 0.00% fee for buyers.`,
      },
      {
        id: 'fee-calc-2',
        category: 'FEE_CALCULATIONS',
        categoryLabel: 'Fee Calculations',
        question:
          'Why does Costorah use BigInt minor-unit integer math instead of floating-point numbers?',
        answer:
          'Standard IEEE-754 floating-point arithmetic introduces rounding drift (such as 0.1 + 0.2 !== 0.3). Costorah converts all fiat values into 2-decimal integer minor units (e.g., paise/cents) and all crypto quantities into 6-decimal micro-units using BigInt with deterministic half-up basis-point rounding, guaranteeing 1:1 ledger reconciliation.',
        keyTakeaway: 'Deterministic BigInt minor-unit accounting prevents rounding discrepancies.',
      },
      {
        id: 'dispute-res-1',
        category: 'DISPUTE_RESOLUTION',
        categoryLabel: 'Trade Dispute Resolutions',
        question:
          'How are trade disputes initiated and resolved if a counterparty is unresponsive?',
        answer:
          'Either party in an active order can click "Open Dispute" in the Trade Room. Opening a dispute immediately transitions the order to DISPUTED, freezes all countdown timers, and locks the escrowed cryptocurrency in place. An authorized ADMIN arbitrator reviews the immutable chat transcript and bank transfer proof before executing an idempotent RELEASE_TO_BUYER or REFUND_TO_SELLER settlement.',
        keyTakeaway:
          'Disputed orders are frozen in escrow until an ADMIN arbitrator issues a verified ruling.',
      },
      {
        id: 'dispute-res-2',
        category: 'DISPUTE_RESOLUTION',
        categoryLabel: 'Trade Dispute Resolutions',
        question:
          'What payment evidence is evaluated during arbitration, and how do disputes impact Trust Scores?',
        answer:
          'Arbitrators verify domestic payment rail identifiers — such as NPCI UPI 12-digit UTR numbers, IMPS reference codes, SEPA end-to-end IDs, or ACH trace numbers — alongside timestamped receipt attachments. Winning or losing a reviewed dispute directly updates each participant’s deterministic Advertiser Trust Score (0–100) and visible dispute win-rate badge.',
        keyTakeaway:
          'Verified UTR/bank proof determines arbitration outcomes and updates Advertiser Trust Scores.',
      },
    ],
    [feePctFormatted, feeBps]
  );

  const filteredFaqItems = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    return faqItems.filter((item) => {
      if (faqCategory !== 'ALL' && item.category !== faqCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [faqItems, faqCategory, faqSearch]);

  const toggleFaqItem = (id: string) => {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const expandAllFaqs = () => {
    setOpenFaqIds(filteredFaqItems.map((i) => i.id));
  };

  const collapseAllFaqs = () => {
    setOpenFaqIds([]);
  };

  const calcResult = useMemo(() => {
    try {
      return calculateTradeBreakdown({
        grossFiatInput: calcFiatAmount,
        unitPriceFiatInput: calcUnitPrice,
        fiatCurrency: calcFiat,
        cryptoAsset: calcAsset,
        feeBps,
      });
    } catch {
      return null;
    }
  }, [calcFiatAmount, calcUnitPrice, calcFiat, calcAsset, feeBps]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="text-xs font-medium text-slate-400">
            Protocol Documentation · Formal State Machine · Fee Accounting &amp; Legal Posture
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1">
            Escrow Architecture, 1% Fee Policy &amp; Compliance
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#131A24] p-1 rounded-lg border border-white/[0.08]">
          {(
            [
              { id: 'ESCROW', label: 'How Escrow Works' },
              { id: 'FEES', label: '1% Fee Calculator' },
              { id: 'CURRENCIES', label: 'Currencies & Rails' },
              { id: 'SECURITY', label: 'Security & Wallets' },
              { id: 'FAQ', label: 'FAQ & Help' },
              { id: 'LEGAL', label: 'Legal & KYC/AML' },
            ] as { id: InfoSection; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`info-tab-${tab.id}`}
              onClick={() => setSection(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                section === tab.id
                  ? 'bg-emerald-500 text-[#0B0E14]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'ESCROW' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-6">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-xl font-bold text-slate-100 font-display flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>01. How Costorah Escrow Protects Buyers &amp; Sellers</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              A database boolean flag is not real escrow. Every Costorah trade is governed by a
              formal 16-state order state machine backed by double-entry inventory reservations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-2">
              <div className="text-xs font-mono text-emerald-400">01. Inventory Lock</div>
              <h3 className="text-sm font-bold text-slate-100">Hard Reservation Before Trade</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a seller publishes an offer or accepts a buy order, the exact cryptocurrency
                quantity moves from Available to Locked balance atomically. Locked funds cannot be
                withdrawn or pledged to another order.
              </p>
            </div>
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-2">
              <div className="text-xs font-mono text-emerald-400">02. Verified Fiat Remittance</div>
              <h3 className="text-sm font-bold text-slate-100">No Auto-Release or Timer Theft</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clicking &ldquo;Payment Sent&rdquo; transitions the order to PAYMENT_MARKED_SENT and
                suspends automatic expiry timers so a seller cannot let a timer run out after
                receiving fiat.
              </p>
            </div>
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-2">
              <div className="text-xs font-mono text-emerald-400">03. Idempotent Settlement</div>
              <h3 className="text-sm font-bold text-slate-100">
                Seller Confirmation or Arbitration
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crypto is released only when the seller verifies bank receipt (or an authorized
                arbitrator resolves a dispute). Every settlement uses idempotency keys to prevent
                duplicate payouts.
              </p>
            </div>
          </div>
        </div>
      )}

      {section === 'FEES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-100 font-display flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <span>Interactive {feePctFormatted}% Platform Fee Calculator</span>
            </h2>
            <p className="text-xs text-slate-400">
              All calculations use integer minor-unit arithmetic (`BigInt`) with explicit half-up
              basis-point rounding—never IEEE-754 floating-point math.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="calc-fiat-val" className="block text-xs text-slate-300 mb-1">
                  Agreed Fiat Trade Value
                </label>
                <input
                  id="calc-fiat-val"
                  type="text"
                  value={calcFiatAmount}
                  onChange={(e) => setCalcFiatAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="calc-fiat-cur" className="block text-xs text-slate-300 mb-1">
                  Fiat Currency
                </label>
                <CustomSelect
                  id="calc-fiat-cur"
                  testId="calc-fiat-cur"
                  value={calcFiat}
                  onChange={(val) => setCalcFiat(val as FiatCurrency)}
                  options={buildFiatCurrencyOptions(ALL_FIAT_CURRENCIES)}
                />
              </div>
              <div>
                <label htmlFor="calc-price" className="block text-xs text-slate-300 mb-1">
                  Unit Price ({calcFiat} / {calcAsset})
                </label>
                <input
                  id="calc-price"
                  type="text"
                  value={calcUnitPrice}
                  onChange={(e) => setCalcUnitPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="calc-asset" className="block text-xs text-slate-300 mb-1">
                  Crypto Asset
                </label>
                <CustomSelect
                  id="calc-asset"
                  testId="calc-asset"
                  value={calcAsset}
                  onChange={(val) => setCalcAsset(val as CryptoAsset)}
                  options={buildCryptoAssetOptions(ALL_CRYPTO_ASSETS)}
                  searchable={false}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 font-display">
              Exact Accounting Output
            </h3>
            {calcResult ? (
              <div className="space-y-3 font-mono tabular-nums text-xs p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg">
                <div className="flex justify-between">
                  <span className="text-slate-400">Trade Value:</span>
                  <span className="text-slate-100 font-bold">
                    {FIAT_SYMBOLS[calcFiat]}
                    {calcResult.grossFiatFormatted} {calcFiat}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform Fee ({feePctFormatted}%):</span>
                  <span className="text-amber-400 font-bold">
                    {FIAT_SYMBOLS[calcFiat]}
                    {calcResult.platformFeeFiatFormatted} {calcFiat}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seller&apos;s Net Fiat Proceeds:</span>
                  <span className="text-emerald-400 font-bold">
                    {FIAT_SYMBOLS[calcFiat]}
                    {calcResult.sellerNetFiatFormatted} {calcFiat}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-slate-400">Escrow Crypto Quantity:</span>
                  <span className="text-slate-100 font-bold">
                    {calcResult.cryptoQuantityFormatted} {calcAsset}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-red-400">Enter valid numeric values above.</div>
            )}
          </div>
        </div>
      )}

      {section === 'CURRENCIES' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-100 font-display flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>Supported Cryptocurrencies &amp; Local Fiat Payment Rails</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(supportedPaymentMethods) as FiatCurrency[]).map((f) => (
              <div
                key={f}
                className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-2"
              >
                <div className="text-sm font-bold text-slate-100 font-mono">
                  {f} ({FIAT_SYMBOLS[f]}) Settlement Rails
                </div>
                <div className="text-xs text-slate-400">
                  {supportedPaymentMethods[f].join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'SECURITY' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-100 font-display flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>Wallet Security, SIWE Challenge Signing &amp; Custody Architecture</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-1.5">
              <div className="font-bold text-slate-100">
                Zero Private Key or Seed Phrase Exposure
              </div>
              <p className="text-slate-400">
                External wallets authenticate via EIP-4361 Sign-In with Ethereum (SIWE) challenges
                bound to our domain, single-use nonce, and 5-minute TTL. Embedded wallets generate
                recovery phrases client-side only; private keys never touch backend servers or logs.
              </p>
            </div>
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-1.5">
              <div className="font-bold text-slate-100">
                Wallet Connection vs. Escrow Deposit
              </div>
              <p className="text-slate-400">
                Connecting a wallet verifies ownership of an address for settlement and identity
                linking. Locking funds in escrow requires an explicit deposit or smart-contract
                escrow commitment.
              </p>
            </div>
          </div>
        </div>
      )}

      {section === 'LEGAL' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-100 font-display flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>Regulatory, KYC/AML &amp; Jurisdictional Compliance Disclosures</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Low-friction onboarding does not eliminate statutory AML/CFT, sanctions, or
            money-transmission obligations. Before enabling live fiat trading in production,
            operators must satisfy VASP/MSB registration (FinCEN MSB/MTL in the US, MiCA CASP in the
            EU, FIU-IND VDA registration in India, FCA registration in the
            UK) and enforce real-time OFAC/UN/EU sanctions screening.
          </p>
          <button
            type="button"
            onClick={onNavigateMarket}
            className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
          >
            Return to P2P Marketplace
          </button>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE FAQ ACCORDION SECTION
          Answers common questions about Escrow Locking, Fee Calculations, and
          Trade Dispute Resolutions with category filters and search.
         ===================================================================== */}
      <section
        data-testid="info-faq-accordion-section"
        className="bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              <span>Interactive Protocol Knowledge Base</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 font-display">
              Frequently Asked Questions: Escrow Locking, {feePctFormatted}% Fees &amp; Disputes
            </h2>
            <p className="text-xs text-slate-400">
              Click any question below to expand technical details, state-machine rules, and worked
              examples.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              data-testid="faq-expand-all-btn"
              onClick={expandAllFaqs}
              className="px-3 py-1.5 text-xs font-mono font-semibold bg-[#18212F] hover:bg-slate-700 text-slate-200 border border-white/10 rounded-lg cursor-pointer transition-colors"
            >
              Expand All ({filteredFaqItems.length})
            </button>
            <button
              type="button"
              data-testid="faq-collapse-all-btn"
              onClick={collapseAllFaqs}
              className="px-3 py-1.5 text-xs font-mono font-semibold bg-[#0B0E14] hover:bg-slate-800 text-slate-300 border border-white/10 rounded-lg cursor-pointer transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Category Filter Pills + Search Input */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="FAQ Categories">
            {(
              [
                { id: 'ALL', label: `All Topics (${faqItems.length})` },
                { id: 'ESCROW_LOCKING', label: 'Escrow Locking' },
                { id: 'FEE_CALCULATIONS', label: 'Fee Calculations' },
                { id: 'DISPUTE_RESOLUTION', label: 'Trade Dispute Resolutions' },
              ] as { id: FaqCategory; label: string }[]
            ).map((cat) => {
              const active = faqCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`faq-category-${cat.id}`}
                  onClick={() => setFaqCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-emerald-500 text-[#0B0E14] border-emerald-400 font-bold'
                      : 'bg-[#0B0E14] text-slate-300 border-white/10 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="info-faq-search-input"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Filter questions (e.g. UTR, BigInt, timer)..."
              aria-label="Filter FAQ questions"
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Accordion Items List */}
        <div className="space-y-3" data-testid="faq-accordion-list">
          {filteredFaqItems.length === 0 ? (
            <div className="p-6 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-center text-xs text-slate-400">
              No FAQ items match your current filter. Clear your search query to view all protocol
              questions.
            </div>
          ) : (
            filteredFaqItems.map((item) => {
              const isOpen = openFaqIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  data-testid={`faq-accordion-item-${item.id}`}
                  className="bg-[#0B0E14] border border-white/[0.08] rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    data-testid={`faq-accordion-trigger-${item.id}`}
                    onClick={() => toggleFaqItem(item.id)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {item.categoryLabel}
                      </span>
                      <div className="text-sm sm:text-base font-bold text-slate-100 font-display">
                        {item.question}
                      </div>
                    </div>

                    <span className="p-1.5 rounded-lg bg-[#18212F] text-slate-200 border border-white/10 shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      data-testid={`faq-accordion-content-${item.id}`}
                      className="px-5 pb-5 pt-2 border-t border-white/[0.06] space-y-3 text-xs sm:text-sm leading-relaxed text-slate-300"
                    >
                      <p>{item.answer}</p>
                      <div className="p-3 rounded-lg bg-[#131A24] border border-white/[0.06] flex items-center gap-2 text-xs font-mono text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Protocol Guarantee: {item.keyTakeaway}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
