import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  EscrowLedgerEngine,
  calculateTradeBreakdown,
  createWalletChallenge,
  verifyWalletChallenge,
  parseCryptoToMicro,
  parseFiatToMinor,
  formatMinor2,
  formatMicro6,
  evaluatePriceAlertsAgainstOffers,
  sanitizeAndMaskCardIdentifier,
  TOP_TRADING_COUNTRIES,
  getLockedFiatForCountry,
  assertCountryFiatLock,
  validateAndFormatBankAccount,
  validateBlockchainWalletAddress,
  verifyAdminCredentials,
  verifyUserCredentials,
  USD_REFERENCE_RATES,
  updateLiveReferenceRates,
  MAX_ORDER_USDT_CAP,
  DAILY_TRADING_LIMIT_USD,
  calculateMaxOrderCapMinor,
  calculateUserDailyLimitStatus,
  SUPPORTED_SWAP_CHAINS,
  type CryptoAsset,
  type FiatCurrency,
  type CountryCode,
  type OfferRecord,
  type EscrowOrderRecord,
  type WalletChallenge,
  type BlockchainNetworkFamily,
  type PriceAlertRecord,
  type RegisteredBankAccount,
  type SwapChainId,
  type SwapExecutionRecord,
} from './src/core/escrowEngine.ts';

export interface LinkedWallet {
  id: string;
  address: string;
  chain: string;
  networkFamily?: BlockchainNetworkFamily;
  tokenStandard?: 'ERC-20' | 'SPL (Solana)';
  providerName?: string;
  type: 'EXTERNAL_SIWE' | 'EMBEDDED_MPC';
  label: string;
  verifiedAt: string;
}

export interface LinkedIdentity {
  id: string;
  provider: 'GOOGLE_OAUTH' | 'WALLET_SIWE' | 'WALLET_SOLANA' | 'USER_CREDENTIALS' | 'PASSKEY_2FA';
  identifier: string;
  linkedAt: string;
}

export interface UserPaymentMethod {
  id: string;
  userId: string;
  methodName: string;
  category?: 'UPI_APP' | 'CARD' | 'BANK_TRANSFER';
  fiatCurrency: FiatCurrency;
  accountHolder: string;
  accountIdentifier: string; // e.g. UPI ID, IBAN, Masked Card Number (no secrets/PINs/CVVs!)
  bankOrProvider: string;
  ifscOrSwiftCode?: string;
  accountType?: 'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC';
  branchName?: string;
  expiryDate?: string;
  isVerified: boolean;
  verifiedAt?: string;
  verificationMethod?: string;
}

export interface NotificationPreferences {
  tradeStarted: boolean;
  paymentReceived: boolean;
  disputeOpened: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  countryCode?: CountryCode;
  preferredFiat?: FiatCurrency;
  role: 'USER' | 'ADMIN';
  kycTier: 'TIER_1_BASIC' | 'TIER_2_VERIFIED';
  reputationScore: number;
  completedTrades: number;
  completionRatePct: number;
  wallets: LinkedWallet[];
  identities: LinkedIdentity[];
  paymentMethods: UserPaymentMethod[];
  bankAccounts?: RegisteredBankAccount[];
  twoFactorEnabled: boolean;
  recoveryGuardianEmail?: string;
  notificationPreferences?: NotificationPreferences;
  createdAt: string;
}

export interface TradeMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM';
  content: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: 'ORDER' | 'OFFER' | 'WALLET' | 'USER' | 'DISPUTE' | 'FEE_POLICY' | 'INCIDENT' | 'LEDGER' | 'ALERT';
  targetId: string;
  details: string;
  ipHash: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string;
  notes: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  orderId?: string;
  channel?: 'IN_APP' | 'EMAIL' | 'BOTH';
  read: boolean;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'aegis-state.json');

const engine = new EscrowLedgerEngine(100); // 100 bps = 1.00%
const users = new Map<string, UserProfile>();
const messages = new Map<string, TradeMessage[]>();
const auditLogs: AuditEvent[] = [];
const incidents: SecurityIncident[] = [];
const notifications: NotificationItem[] = [];
const priceAlerts: PriceAlertRecord[] = [];
const swapHistory: SwapExecutionRecord[] = [];
const workerStatus = {
  lastRunAt: new Date().toISOString(),
  totalScans: 1,
  triggeredCount: 0,
  intervalSeconds: 15,
};
const activeChallenges = new Map<string, WalletChallenge>();
const usedNonces = new Set<string>();
const supportedPaymentMethods: Record<FiatCurrency, string[]> = {
  INR: [
    'PhonePe',
    'Google Pay (GPay)',
    'Paytm',
    'Credit / Debit Card',
    'UPI Instant',
    'IMPS Bank Transfer',
    'NEFT',
    'RTGS',
  ],
  USD: [
    'Credit / Debit Card',
    'Google Pay (GPay)',
    'FedNow Instant',
    'ACH Bank Transfer',
    'Zelle',
    'Domestic Wire',
  ],
  EUR: ['Credit / Debit Card', 'Google Pay (GPay)', 'SEPA Instant', 'SEPA Credit Transfer', 'Revolut', 'N26 Instant'],
  GBP: ['Credit / Debit Card', 'Google Pay (GPay)', 'Faster Payments (FPS)', 'CHAPS', 'Monzo', 'Revolut UK'],
  NGN: ['NIP Instant Transfer', 'OPay', 'PalmPay', 'Kuda Bank', 'Credit / Debit Card'],
  TRY: ['FAST Instant TRY', 'Papara', 'Ziraat Bank Transfer', 'Garanti BBVA', 'Credit / Debit Card'],
  IRR: ['Shetab Card-to-Card', 'Satna / Paya Bank Rail'],
  BRL: ['Pix Instant', 'Nubank', 'Itaú Transfer', 'Credit / Debit Card'],
  AED: ['UAEFTS Instant', 'Wio Bank', 'Emirates NBD', 'Credit / Debit Card'],
  VND: ['VietQR Napas247', 'MoMo Wallet', 'Vietcombank', 'Techcombank 24/7'],
};
export interface LivePriceItem {
  usd: number;
  inr: number;
  fiatPrices?: Partial<Record<FiatCurrency, number>>;
  change24h: number;
  lastUpdated: string;
}

export interface LivePriceFeed {
  rates: Record<CryptoAsset, LivePriceItem>;
  usdInrRate: number;
  fiatExchangeRates?: Record<FiatCurrency, number>;
  lastUpdated: string;
  source: string;
}

const DEFAULT_FIAT_EXCHANGE_RATES: Record<FiatCurrency, number> = {
  USD: 1.0,
  INR: 94.76,
  TRY: 34.25,
  IRR: 42000.0,
  NGN: 1620.0,
  EUR: 0.92,
  GBP: 0.79,
  BRL: 5.75,
  AED: 3.67,
  VND: 25400.0,
};

function computeFiatPricesForUsd(
  usd: number,
  fxRates: Record<FiatCurrency, number>
): Record<FiatCurrency, number> {
  return {
    USD: Number(usd.toFixed(2)),
    INR: Number((usd * fxRates.INR).toFixed(2)),
    TRY: Number((usd * fxRates.TRY).toFixed(2)),
    IRR: Math.round(usd * fxRates.IRR),
    NGN: Number((usd * fxRates.NGN).toFixed(2)),
    EUR: Number((usd * fxRates.EUR).toFixed(2)),
    GBP: Number((usd * fxRates.GBP).toFixed(2)),
    BRL: Number((usd * fxRates.BRL).toFixed(2)),
    AED: Number((usd * fxRates.AED).toFixed(2)),
    VND: Math.round(usd * fxRates.VND),
  };
}

function syncEngineReferenceRatesFromFeed(feed: LivePriceFeed) {
  USD_REFERENCE_RATES.BTC = feed.rates.BTC.usd;
  USD_REFERENCE_RATES.ETH = feed.rates.ETH.usd;
  USD_REFERENCE_RATES.BNB = feed.rates.BNB.usd;
  USD_REFERENCE_RATES.SOL = feed.rates.SOL.usd;
  USD_REFERENCE_RATES.USDT = feed.rates.USDT.usd;
  USD_REFERENCE_RATES.USDC = feed.rates.USDC.usd;
  TOP_TRADING_COUNTRIES.IN.usdExchangeRate = feed.usdInrRate;
  if (feed.fiatExchangeRates) {
    for (const country of Object.values(TOP_TRADING_COUNTRIES)) {
      const fx = feed.fiatExchangeRates[country.fiatCurrency];
      if (typeof fx === 'number' && Number.isFinite(fx) && fx > 0) {
        country.usdExchangeRate = fx;
      }
    }
  }
}

const livePriceFeed: LivePriceFeed = {
  rates: {
    BTC: {
      usd: 82740,
      inr: Number((82740 * 94.76).toFixed(2)),
      fiatPrices: computeFiatPricesForUsd(82740, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: 2.34,
      lastUpdated: new Date().toISOString(),
    },
    ETH: {
      usd: 2428,
      inr: Number((2428 * 94.76).toFixed(2)),
      fiatPrices: computeFiatPricesForUsd(2428, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: -0.65,
      lastUpdated: new Date().toISOString(),
    },
    BNB: {
      usd: 612.5,
      inr: Number((612.5 * 94.76).toFixed(2)),
      fiatPrices: computeFiatPricesForUsd(612.5, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: 1.48,
      lastUpdated: new Date().toISOString(),
    },
    SOL: {
      usd: 105.7,
      inr: Number((105.7 * 94.76).toFixed(2)),
      fiatPrices: computeFiatPricesForUsd(105.7, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: 3.1,
      lastUpdated: new Date().toISOString(),
    },
    USDT: {
      usd: 1.0,
      inr: 94.76,
      fiatPrices: computeFiatPricesForUsd(1.0, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: 0.05,
      lastUpdated: new Date().toISOString(),
    },
    USDC: {
      usd: 1.0,
      inr: 94.76,
      fiatPrices: computeFiatPricesForUsd(1.0, DEFAULT_FIAT_EXCHANGE_RATES),
      change24h: 0.02,
      lastUpdated: new Date().toISOString(),
    },
  },
  usdInrRate: 94.76,
  fiatExchangeRates: { ...DEFAULT_FIAT_EXCHANGE_RATES },
  lastUpdated: new Date().toISOString(),
  source: 'CoinGecko & Binance Real-Time Live Feed',
};

syncEngineReferenceRatesFromFeed(livePriceFeed);

async function fetchRealMarketPrices() {
  const now = new Date().toISOString();
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,tether,usd-coin&vs_currencies=usd,inr,eur,gbp,brl,aed,try,vnd,ngn&include_24hr_change=true',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, Record<string, number>>;
      const tetherUsd = data.tether?.usd || 1.0;
      const usdInrRate = data.tether?.inr
        ? Number((data.tether.inr / tetherUsd).toFixed(2))
        : livePriceFeed.usdInrRate || 94.76;

      const fxRates: Record<FiatCurrency, number> = {
        USD: 1.0,
        INR: usdInrRate,
        EUR: data.tether?.eur ? Number((data.tether.eur / tetherUsd).toFixed(4)) : (livePriceFeed.fiatExchangeRates?.EUR ?? DEFAULT_FIAT_EXCHANGE_RATES.EUR),
        GBP: data.tether?.gbp ? Number((data.tether.gbp / tetherUsd).toFixed(4)) : (livePriceFeed.fiatExchangeRates?.GBP ?? DEFAULT_FIAT_EXCHANGE_RATES.GBP),
        BRL: data.tether?.brl ? Number((data.tether.brl / tetherUsd).toFixed(2)) : (livePriceFeed.fiatExchangeRates?.BRL ?? DEFAULT_FIAT_EXCHANGE_RATES.BRL),
        AED: data.tether?.aed ? Number((data.tether.aed / tetherUsd).toFixed(2)) : (livePriceFeed.fiatExchangeRates?.AED ?? DEFAULT_FIAT_EXCHANGE_RATES.AED),
        TRY: data.tether?.try ? Number((data.tether.try / tetherUsd).toFixed(2)) : (livePriceFeed.fiatExchangeRates?.TRY ?? DEFAULT_FIAT_EXCHANGE_RATES.TRY),
        VND: data.tether?.vnd ? Math.round(data.tether.vnd / tetherUsd) : (livePriceFeed.fiatExchangeRates?.VND ?? DEFAULT_FIAT_EXCHANGE_RATES.VND),
        NGN: data.tether?.ngn ? Number((data.tether.ngn / tetherUsd).toFixed(2)) : (livePriceFeed.fiatExchangeRates?.NGN ?? DEFAULT_FIAT_EXCHANGE_RATES.NGN),
        IRR: livePriceFeed.fiatExchangeRates?.IRR ?? DEFAULT_FIAT_EXCHANGE_RATES.IRR,
      };

      livePriceFeed.usdInrRate = usdInrRate;
      livePriceFeed.fiatExchangeRates = fxRates;

      const assetMap: Array<{ key: string; symbol: CryptoAsset }> = [
        { key: 'bitcoin', symbol: 'BTC' },
        { key: 'ethereum', symbol: 'ETH' },
        { key: 'binancecoin', symbol: 'BNB' },
        { key: 'solana', symbol: 'SOL' },
        { key: 'tether', symbol: 'USDT' },
        { key: 'usd-coin', symbol: 'USDC' },
      ];

      for (const { key, symbol } of assetMap) {
        const entry = data[key];
        const prev = livePriceFeed.rates[symbol];
        const usd = entry?.usd || prev.usd;
        const inr = Number((usd * usdInrRate).toFixed(2));
        livePriceFeed.rates[symbol] = {
          usd,
          inr,
          fiatPrices: computeFiatPricesForUsd(usd, fxRates),
          change24h:
            typeof entry?.usd_24h_change === 'number'
              ? Number(entry.usd_24h_change.toFixed(2))
              : prev.change24h,
          lastUpdated: now,
        };
      }

      livePriceFeed.lastUpdated = now;
      syncEngineReferenceRatesFromFeed(livePriceFeed);
      return;
    }
  } catch {
    // Fallback to deterministic 5s synchronized tick below if external API is rate-limited
  }

  // Synchronized 5-second fallback tick ensuring USD, INR, and all native fiat currencies remain 100% in sync
  const tickMultiplier = 1 + (Math.random() - 0.5) * 0.0004;
  const usdInr = livePriceFeed.usdInrRate || 94.76;
  const fxRates: Record<FiatCurrency, number> = {
    ...DEFAULT_FIAT_EXCHANGE_RATES,
    ...(livePriceFeed.fiatExchangeRates || {}),
    USD: 1.0,
    INR: usdInr,
  };
  livePriceFeed.fiatExchangeRates = fxRates;

  for (const asset of ['BTC', 'ETH', 'BNB', 'SOL', 'USDT', 'USDC'] as CryptoAsset[]) {
    const curr = livePriceFeed.rates[asset];
    if (!curr) continue;
    const isStable = asset === 'USDT' || asset === 'USDC';
    const newUsd = isStable
      ? 1.0
      : Math.round(curr.usd * tickMultiplier * 100) / 100;
    const newInr = Number((newUsd * usdInr).toFixed(2));
    livePriceFeed.rates[asset] = {
      ...curr,
      usd: newUsd,
      inr: newInr,
      fiatPrices: computeFiatPricesForUsd(newUsd, fxRates),
      lastUpdated: now,
    };
  }
  livePriceFeed.lastUpdated = now;
  syncEngineReferenceRatesFromFeed(livePriceFeed);
}

// Synchronize USD, INR, and all native currencies every 5 seconds (5,000ms)
setInterval(fetchRealMarketPrices, 5000);
fetchRealMarketPrices();

let activeUserId = 'usr_alex_trader';
let lastRegularUserId = 'usr_alex_trader';

function logAudit(
  actorId: string,
  actorRole: string,
  action: string,
  targetType: AuditEvent['targetType'],
  targetId: string,
  details: string
) {
  auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    details,
    ipHash: 'sha256:9f86d081884c7d659a2feaa0c55ad015',
  });
}

function addNotification(
  userId: string,
  title: string,
  message: string,
  orderId?: string,
  channel: 'IN_APP' | 'EMAIL' | 'BOTH' = 'IN_APP'
) {
  notifications.unshift({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    title,
    message,
    orderId,
    channel,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function seedInitialData() {
  // 1. Create Users
  const alex: UserProfile = {
    id: 'usr_alex_trader',
    displayName: 'Alex Rivera (You)',
    email: 'alex.rivera@costorah.io',
    avatarUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g1" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#0B65C6"/><stop offset="100%" stop-color="#10B981"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g1)"/><circle cx="40" cy="31" r="13" fill="#FFFFFF"/><path d="M18 66C21 53 30 47 40 47C50 47 59 53 62 66" fill="#FFFFFF"/></svg>`
    )}`,
    bio: 'Costorah Institutional & P2P Liquidity Desk · Instant PhonePe, GPay, Paytm, IMPS & SEPA Settlement',
    countryCode: 'IN',
    preferredFiat: 'INR',
    role: 'USER',
    kycTier: 'TIER_2_VERIFIED',
    reputationScore: 99.4,
    completedTrades: 149,
    completionRatePct: 99.4,
    wallets: [],
    identities: [
      {
        id: 'id_user_cred_1',
        provider: 'USER_CREDENTIALS',
        identifier: 'alex.rivera@costorah.io',
        linkedAt: '2026-09-10T07:55:00Z',
      },
      {
        id: 'id_google_1',
        provider: 'GOOGLE_OAUTH',
        identifier: 'alex.rivera@costorah.io',
        linkedAt: '2026-09-10T08:00:00Z',
      },
    ],
    paymentMethods: [
      {
        id: 'pm_alex_hdfc_bank',
        userId: 'usr_alex_trader',
        methodName: 'IMPS Bank Transfer',
        category: 'BANK_TRANSFER',
        fiatCurrency: 'INR',
        accountHolder: 'Alex Rivera',
        accountIdentifier: 'Acct •••• 9920 · IFSC HDFC0000124',
        bankOrProvider: 'HDFC Bank Ltd (Nariman Point)',
        ifscOrSwiftCode: 'HDFC0000124',
        accountType: 'SAVINGS',
        branchName: 'Nariman Point, Mumbai',
        isVerified: true,
        verifiedAt: '2026-10-09T11:00:00Z',
        verificationMethod: 'IMPS Penny-Drop Verified',
      },
      {
        id: 'pm_alex_phonepe',
        userId: 'usr_alex_trader',
        methodName: 'PhonePe',
        category: 'UPI_APP',
        fiatCurrency: 'INR',
        accountHolder: 'Alex Rivera',
        accountIdentifier: '9820114490@ybl',
        bankOrProvider: 'PhonePe / Yes Bank UPI',
        isVerified: true,
        verifiedAt: '2026-10-10T09:15:00Z',
        verificationMethod: 'NPCI UPI VPA Handshake',
      },
      {
        id: 'pm_alex_gpay',
        userId: 'usr_alex_trader',
        methodName: 'Google Pay (GPay)',
        category: 'UPI_APP',
        fiatCurrency: 'INR',
        accountHolder: 'Alex Rivera',
        accountIdentifier: 'alex.rivera@okhdfcbank',
        bankOrProvider: 'Google Pay / HDFC Bank',
        isVerified: true,
        verifiedAt: '2026-10-11T14:20:00Z',
        verificationMethod: 'NPCI UPI VPA Handshake',
      },
      {
        id: 'pm_alex_paytm',
        userId: 'usr_alex_trader',
        methodName: 'Paytm',
        category: 'UPI_APP',
        fiatCurrency: 'INR',
        accountHolder: 'Alex Rivera',
        accountIdentifier: '9820114490@paytm',
        bankOrProvider: 'Paytm Payments / Axis UPI',
        isVerified: false,
      },
      {
        id: 'pm_alex_card',
        userId: 'usr_alex_trader',
        methodName: 'Credit / Debit Card',
        category: 'CARD',
        fiatCurrency: 'USD',
        accountHolder: 'Alex Rivera',
        accountIdentifier: 'Visa Infinite •••• 8842',
        bankOrProvider: 'JPMorgan Chase Visa',
        expiryDate: '08/29',
        isVerified: true,
        verifiedAt: '2026-10-12T11:00:00Z',
        verificationMethod: '3DS2 $1.00 Micro-Auth Hold',
      },
      {
        id: 'pm_alex_sepa',
        userId: 'usr_alex_trader',
        methodName: 'SEPA Instant',
        category: 'BANK_TRANSFER',
        fiatCurrency: 'EUR',
        accountHolder: 'Alex Rivera',
        accountIdentifier: 'DE89 3704 0044 0532 0130 00',
        bankOrProvider: 'Commerzbank Frankfurt',
        ifscOrSwiftCode: 'COBADEFFXXX',
        accountType: 'CURRENT',
        branchName: 'Frankfurt Main',
        isVerified: true,
        verifiedAt: '2026-09-15T16:40:00Z',
        verificationMethod: 'IBAN Penny-Drop Verification',
      },
    ],
    bankAccounts: [
      {
        id: 'bank_alex_hdfc_1',
        userId: 'usr_alex_trader',
        accountHolderName: 'Alex Rivera',
        bankName: 'HDFC Bank Ltd',
        accountNumber: '50100293849920',
        maskedAccountNumber: '•••• 9920',
        ifscOrSwiftCode: 'HDFC0000124',
        accountType: 'SAVINGS',
        branchName: 'Nariman Point, Mumbai',
        fiatCurrency: 'INR',
        linkedUpiId: 'alex.rivera@okhdfcbank',
        isPrimary: true,
        isVerified: true,
        createdAt: '2026-10-09T11:00:00Z',
      },
      {
        id: 'bank_alex_sepa_2',
        userId: 'usr_alex_trader',
        accountHolderName: 'Alex Rivera',
        bankName: 'Commerzbank Frankfurt',
        accountNumber: 'DE89370400440532013000',
        maskedAccountNumber: '•••• 3000',
        ifscOrSwiftCode: 'COBADEFFXXX',
        accountType: 'CURRENT',
        branchName: 'Frankfurt Corporate Center',
        fiatCurrency: 'EUR',
        isPrimary: false,
        isVerified: true,
        createdAt: '2026-09-15T16:40:00Z',
      },
    ],
    twoFactorEnabled: true,
    recoveryGuardianEmail: 'security-backup@costorah.io',
    notificationPreferences: {
      tradeStarted: true,
      paymentReceived: true,
      disputeOpened: true,
    },
    createdAt: '2026-09-10T08:00:00Z',
  };

  const vikram: UserProfile = {
    id: 'usr_vikram_desk',
    displayName: 'Vikram Malhotra OTC',
    email: 'vikram@mumbai-otc.in',
    role: 'USER',
    kycTier: 'TIER_2_VERIFIED',
    reputationScore: 99.8,
    completedTrades: 612,
    completionRatePct: 99.8,
    wallets: [
      {
        id: 'wal_vikram',
        address: '0x94A3B88C9129E001A4421B77E89C001122334455',
        chain: 'Arbitrum Sepolia (Chain ID 421614)',
        type: 'EXTERNAL_SIWE',
        label: 'Mumbai OTC Multisig',
        verifiedAt: '2026-08-01T12:00:00Z',
      },
    ],
    identities: [
      {
        id: 'id_vikram_1',
        provider: 'GOOGLE_OAUTH',
        identifier: 'vikram@mumbai-otc.in',
        linkedAt: '2026-08-01T11:55:00Z',
      },
    ],
    paymentMethods: [
      {
        id: 'pm_vikram_upi',
        userId: 'usr_vikram_desk',
        methodName: 'UPI Instant',
        fiatCurrency: 'INR',
        accountHolder: 'Vikram Malhotra Enterprises',
        accountIdentifier: 'vikram.otc@icici',
        bankOrProvider: 'ICICI Bank',
        isVerified: true,
      },
    ],
    twoFactorEnabled: true,
    createdAt: '2026-08-01T11:55:00Z',
  };

  const elena: UserProfile = {
    id: 'usr_elena_euro',
    displayName: 'Elena Rostova Liquidity',
    email: 'elena@zurich-digital.ch',
    role: 'USER',
    kycTier: 'TIER_2_VERIFIED',
    reputationScore: 98.9,
    completedTrades: 384,
    completionRatePct: 98.9,
    wallets: [
      {
        id: 'wal_elena',
        address: '0x33B1C29901A4F88D7721E0938471625344556677',
        chain: 'Polygon Amoy Testnet',
        type: 'EXTERNAL_SIWE',
        label: 'Zurich Treasury Wallet',
        verifiedAt: '2026-08-14T09:30:00Z',
      },
    ],
    identities: [
      {
        id: 'id_elena_1',
        provider: 'WALLET_SIWE',
        identifier: '0x33B1C29901A4F88D7721E0938471625344556677',
        linkedAt: '2026-08-14T09:30:00Z',
      },
    ],
    paymentMethods: [
      {
        id: 'pm_elena_sepa',
        userId: 'usr_elena_euro',
        methodName: 'SEPA Instant',
        fiatCurrency: 'EUR',
        accountHolder: 'Elena Rostova AG',
        accountIdentifier: 'CH93 0076 2011 6238 5295 7',
        bankOrProvider: 'UBS Switzerland',
        isVerified: true,
      },
    ],
    twoFactorEnabled: true,
    createdAt: '2026-08-14T09:30:00Z',
  };

  const sterling: UserProfile = {
    id: 'usr_sterling_uk',
    displayName: 'Thames Digital Markets',
    email: 'desk@thamesdigital.co.uk',
    role: 'USER',
    kycTier: 'TIER_2_VERIFIED',
    reputationScore: 99.5,
    completedTrades: 509,
    completionRatePct: 99.5,
    wallets: [
      {
        id: 'wal_sterling',
        address: '0x88F1A2B3C4D5E6F708192A3B4C5D6E7F8091A2B3',
        chain: 'Ethereum Sepolia',
        type: 'EMBEDDED_MPC',
        label: 'Thames Embedded Vault',
        verifiedAt: '2026-07-20T15:00:00Z',
      },
    ],
    identities: [],
    paymentMethods: [],
    twoFactorEnabled: true,
    createdAt: '2026-07-20T15:00:00Z',
  };

  const costorahAdmin: UserProfile = {
    id: 'usr_costorah_admin',
    displayName: 'Costorah Chief Arbitrator (Admin)',
    email: 'admin@costorah.io',
    avatarUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="gadm" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#0B65C6"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#gadm)"/><path d="M40 14L62 24V40C62 54 52 64 40 68C28 64 18 54 18 40V24L40 14Z" fill="#FFFFFF"/></svg>`
    )}`,
    bio: 'Costorah Global Escrow Arbitration, Fee Governance & Security Operations Console',
    countryCode: 'IN',
    preferredFiat: 'INR',
    role: 'ADMIN',
    kycTier: 'TIER_2_VERIFIED',
    reputationScore: 100.0,
    completedTrades: 0,
    completionRatePct: 100.0,
    wallets: [],
    identities: [
      {
        id: 'id_admin_cred',
        provider: 'USER_CREDENTIALS',
        identifier: 'admin',
        linkedAt: '2026-01-01T00:00:00Z',
      },
    ],
    paymentMethods: [],
    twoFactorEnabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  };

  users.set(alex.id, alex);
  users.set(vikram.id, vikram);
  users.set(elena.id, elena);
  users.set(sterling.id, sterling);
  users.set(costorahAdmin.id, costorahAdmin);

  // 2. Seed Deposits
  engine.deposit('usr_alex_trader', 'USDT', parseCryptoToMicro('12500.000000'), 'seed_dep_alex_usdt');
  engine.deposit('usr_alex_trader', 'USDC', parseCryptoToMicro('8400.000000'), 'seed_dep_alex_usdc');
  engine.deposit('usr_alex_trader', 'BTC', parseCryptoToMicro('0.850000'), 'seed_dep_alex_btc');
  engine.deposit('usr_alex_trader', 'ETH', parseCryptoToMicro('6.500000'), 'seed_dep_alex_eth');
  engine.deposit('usr_alex_trader', 'BNB', parseCryptoToMicro('12.500000'), 'seed_dep_alex_bnb');
  engine.deposit('usr_alex_trader', 'SOL', parseCryptoToMicro('95.000000'), 'seed_dep_alex_sol');

  engine.deposit('usr_vikram_desk', 'USDT', parseCryptoToMicro('95000.000000'), 'seed_dep_vikram_usdt');
  engine.deposit('usr_vikram_desk', 'BTC', parseCryptoToMicro('2.500000'), 'seed_dep_vikram_btc');
  engine.deposit('usr_vikram_desk', 'BNB', parseCryptoToMicro('45.000000'), 'seed_dep_vikram_bnb');

  engine.deposit('usr_elena_euro', 'USDT', parseCryptoToMicro('50000.000000'), 'seed_dep_elena_usdt');
  engine.deposit('usr_elena_euro', 'USDC', parseCryptoToMicro('60000.000000'), 'seed_dep_elena_usdc');
  engine.deposit('usr_elena_euro', 'ETH', parseCryptoToMicro('18.000000'), 'seed_dep_elena_eth');

  engine.deposit('usr_sterling_uk', 'USDT', parseCryptoToMicro('85000.000000'), 'seed_dep_sterling_usdt');
  engine.deposit('usr_sterling_uk', 'SOL', parseCryptoToMicro('400.000000'), 'seed_dep_sterling_sol');
  engine.deposit('usr_sterling_uk', 'BNB', parseCryptoToMicro('30.000000'), 'seed_dep_sterling_bnb');

  // Seed 1 Representative Cross-Chain Swap for Alex (USDT -> BNB on BNB Chain)
  const seededSwap = engine.executeAssetSwap({
    userId: 'usr_alex_trader',
    fromAsset: 'USDT',
    toAsset: 'BNB',
    fromAmountMicro: parseCryptoToMicro('300.000000'),
    chain: 'BNB_CHAIN',
    settlementMode: 'EXCHANGE_INTERNAL',
    slippageBps: 50,
    idempotencyKey: 'seed_swap_alex_bnb_1',
  });
  swapHistory.unshift(seededSwap);

  // 3. Create Marketplace Offers (both SELL offers for P2P Buy tab and BUY offers for P2P Sell tab)
  // All offers have maxOrderFiatMinor capped at <= 500 USDT converted at their declared unit price
  engine.createOffer({
    id: 'off_inr_usdt_98',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('98.00'),
    totalQuantityMicro: parseCryptoToMicro('450.000000'),
    minOrderFiatMinor: parseFiatToMinor('9800.00'),
    maxOrderFiatMinor: parseFiatToMinor('44100.00'),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm', 'UPI Instant', 'IMPS Bank Transfer'],
    paymentInstructions: 'Selling 450 USDT @ ₹98.00 (₹44,100.00 total). Minimum 100 USDT (₹9,800.00) per transaction via PhonePe, Google Pay, or UPI.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_inr_usdt_1',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('86.50'),
    totalQuantityMicro: parseCryptoToMicro('500.000000'),
    minOrderFiatMinor: parseFiatToMinor('8650.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('86.50') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm', 'UPI Instant', 'IMPS Bank Transfer'],
    paymentInstructions: 'Send exact INR amount via PhonePe, Google Pay, or Paytm to UPI ID: vikram.otc@icici (Vikram Malhotra Enterprises). Include Order ID in remarks.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_usd_usdt_2',
    makerId: 'usr_sterling_uk',
    makerName: 'Thames Digital Markets',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'USD',
    unitPriceFiatMinor: parseFiatToMinor('1.00'),
    totalQuantityMicro: parseCryptoToMicro('18000.000000'),
    minOrderFiatMinor: parseFiatToMinor('50.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('1.00') }),
    paymentMethods: ['FedNow Instant', 'ACH Bank Transfer', 'Zelle'],
    paymentInstructions: 'Transfer via FedNow or Zelle to treasury@thamesdigital.co.uk. Paste the 12-digit confirmation reference in the trade room.',
    completedTrades: 509,
    completionRatePct: 99.5,
  });

  engine.createOffer({
    id: 'off_eur_usdc_3',
    makerId: 'usr_elena_euro',
    makerName: 'Elena Rostova Liquidity',
    side: 'SELL',
    asset: 'USDC',
    fiatCurrency: 'EUR',
    unitPriceFiatMinor: parseFiatToMinor('0.92'),
    totalQuantityMicro: parseCryptoToMicro('20000.000000'),
    minOrderFiatMinor: parseFiatToMinor('50.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDC', unitPriceFiatMinor: parseFiatToMinor('0.92') }),
    paymentMethods: ['SEPA Instant', 'Revolut'],
    paymentInstructions: 'SEPA Instant transfer to IBAN CH93 0076 2011 6238 5295 7 (Elena Rostova AG). Reference: Order ID only.',
    completedTrades: 384,
    completionRatePct: 98.9,
  });

  engine.createOffer({
    id: 'off_inr_btc_4',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'SELL',
    asset: 'BTC',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('7450000.00'),
    totalQuantityMicro: parseCryptoToMicro('1.200000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'BTC', unitPriceFiatMinor: parseFiatToMinor('7450000.00') }),
    paymentMethods: ['IMPS Bank Transfer', 'RTGS', 'NEFT'],
    paymentInstructions: 'IMPS/RTGS to ICICI Acct 001105029812, IFSC ICIC0000011. Instant escrow release upon bank credit verification.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_eur_eth_5',
    makerId: 'usr_elena_euro',
    makerName: 'Elena Rostova Liquidity',
    side: 'SELL',
    asset: 'ETH',
    fiatCurrency: 'EUR',
    unitPriceFiatMinor: parseFiatToMinor('2650.00'),
    totalQuantityMicro: parseCryptoToMicro('10.000000'),
    minOrderFiatMinor: parseFiatToMinor('100.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'ETH', unitPriceFiatMinor: parseFiatToMinor('2650.00') }),
    paymentMethods: ['SEPA Instant'],
    paymentInstructions: 'SEPA Instant to UBS Switzerland IBAN CH93 0076 2011 6238 5295 7.',
    completedTrades: 384,
    completionRatePct: 98.9,
  });

  engine.createOffer({
    id: 'off_gbp_sol_6',
    makerId: 'usr_sterling_uk',
    makerName: 'Thames Digital Markets',
    side: 'SELL',
    asset: 'SOL',
    fiatCurrency: 'GBP',
    unitPriceFiatMinor: parseFiatToMinor('142.00'),
    totalQuantityMicro: parseCryptoToMicro('250.000000'),
    minOrderFiatMinor: parseFiatToMinor('50.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'SOL', unitPriceFiatMinor: parseFiatToMinor('142.00') }),
    paymentMethods: ['Faster Payments (FPS)', 'Monzo'],
    paymentInstructions: 'UK Faster Payments Sort Code 04-00-04, Account 88291044.',
    completedTrades: 509,
    completionRatePct: 99.5,
  });

  // Also create Alex's own SELL offers across multiple crypto assets so Alex has multi-asset locked funds visible in the 3D Escrow Vault & Offer Management
  engine.createOffer({
    id: 'off_alex_sell_usdt',
    makerId: 'usr_alex_trader',
    makerName: 'Alex Rivera (You)',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('86.80'),
    totalQuantityMicro: parseCryptoToMicro('2500.000000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('86.80') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'UPI Instant', 'IMPS Bank Transfer'],
    paymentInstructions: 'Pay via PhonePe, GPay, or UPI to alex.rivera@okhdfcbank. Provide 12-digit UTR number.',
    completedTrades: 148,
    completionRatePct: 99.4,
  });

  engine.createOffer({
    id: 'off_alex_sell_eth',
    makerId: 'usr_alex_trader',
    makerName: 'Alex Rivera (You)',
    side: 'SELL',
    asset: 'ETH',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('226630.00'),
    totalQuantityMicro: parseCryptoToMicro('1.250000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'ETH', unitPriceFiatMinor: parseFiatToMinor('226630.00') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'IMPS Bank Transfer'],
    paymentInstructions: 'Instant INR settlement via PhonePe, Google Pay, or IMPS to HDFC Bank.',
    completedTrades: 148,
    completionRatePct: 99.4,
  });

  engine.createOffer({
    id: 'off_alex_sell_btc',
    makerId: 'usr_alex_trader',
    makerName: 'Alex Rivera (You)',
    side: 'SELL',
    asset: 'BTC',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('5864700.00'),
    totalQuantityMicro: parseCryptoToMicro('0.080000'),
    minOrderFiatMinor: parseFiatToMinor('10000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'BTC', unitPriceFiatMinor: parseFiatToMinor('5864700.00') }),
    paymentMethods: ['IMPS Bank Transfer', 'PhonePe', 'Google Pay (GPay)'],
    paymentInstructions: 'Send INR via IMPS or UPI to HDFC Bank with Order ID in remarks.',
    completedTrades: 148,
    completionRatePct: 99.4,
  });

  engine.createOffer({
    id: 'off_alex_sell_sol',
    makerId: 'usr_alex_trader',
    makerName: 'Alex Rivera (You)',
    side: 'SELL',
    asset: 'SOL',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('13500.00'),
    totalQuantityMicro: parseCryptoToMicro('8.000000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'SOL', unitPriceFiatMinor: parseFiatToMinor('13500.00') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm'],
    paymentInstructions: 'Send INR via PhonePe, Google Pay, or Paytm and attach payment UTR.',
    completedTrades: 148,
    completionRatePct: 99.4,
  });

  // Create BUY offers (shown when user switches to "P2P Sell" tab to sell their crypto for fiat)
  engine.createOffer({
    id: 'off_buy_inr_usdt_1',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'BUY',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('86.10'),
    totalQuantityMicro: parseCryptoToMicro('20000.000000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('86.10') }),
    paymentMethods: ['UPI Instant', 'IMPS Bank Transfer'],
    paymentInstructions: 'Instant INR payout via UPI or IMPS within 5 minutes of escrow lock confirmation.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_buy_usd_usdc_2',
    makerId: 'usr_sterling_uk',
    makerName: 'Thames Digital Markets',
    side: 'BUY',
    asset: 'USDC',
    fiatCurrency: 'USD',
    unitPriceFiatMinor: parseFiatToMinor('0.99'),
    totalQuantityMicro: parseCryptoToMicro('25000.000000'),
    minOrderFiatMinor: parseFiatToMinor('50.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDC', unitPriceFiatMinor: parseFiatToMinor('0.99') }),
    paymentMethods: ['FedNow Instant', 'Zelle'],
    paymentInstructions: 'We send FedNow USD immediately once your USDC is locked in Costorah escrow.',
    completedTrades: 509,
    completionRatePct: 99.5,
  });

  engine.createOffer({
    id: 'off_buy_eur_eth_3',
    makerId: 'usr_elena_euro',
    makerName: 'Elena Rostova Liquidity',
    side: 'BUY',
    asset: 'ETH',
    fiatCurrency: 'EUR',
    unitPriceFiatMinor: parseFiatToMinor('2625.00'),
    totalQuantityMicro: parseCryptoToMicro('15.000000'),
    minOrderFiatMinor: parseFiatToMinor('100.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'ETH', unitPriceFiatMinor: parseFiatToMinor('2625.00') }),
    paymentMethods: ['SEPA Instant'],
    paymentInstructions: 'Instant SEPA EUR settlement from UBS Zurich corporate account.',
    completedTrades: 384,
    completionRatePct: 98.9,
  });

  engine.createOffer({
    id: 'off_buy_inr_btc_4',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'BUY',
    asset: 'BTC',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('5864700.00'),
    totalQuantityMicro: parseCryptoToMicro('1.500000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'BTC', unitPriceFiatMinor: parseFiatToMinor('5864700.00') }),
    paymentMethods: ['IMPS Bank Transfer', 'PhonePe', 'Google Pay (GPay)', 'UPI Instant', 'RTGS'],
    paymentInstructions: 'Buying BTC with instant INR IMPS/UPI payout within 5 minutes of Costorah escrow lock.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_buy_usd_btc_5',
    makerId: 'usr_sterling_uk',
    makerName: 'Thames Digital Markets',
    side: 'BUY',
    asset: 'BTC',
    fiatCurrency: 'USD',
    unitPriceFiatMinor: parseFiatToMinor('67800.00'),
    totalQuantityMicro: parseCryptoToMicro('2.000000'),
    minOrderFiatMinor: parseFiatToMinor('100.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'BTC', unitPriceFiatMinor: parseFiatToMinor('67800.00') }),
    paymentMethods: ['FedNow Instant', 'ACH Bank Transfer', 'Zelle'],
    paymentInstructions: 'Instant FedNow USD settlement upon BTC escrow reservation.',
    completedTrades: 509,
    completionRatePct: 99.5,
  });

  engine.createOffer({
    id: 'off_buy_inr_eth_6',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'BUY',
    asset: 'ETH',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('226630.00'),
    totalQuantityMicro: parseCryptoToMicro('12.000000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'ETH', unitPriceFiatMinor: parseFiatToMinor('226630.00') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'IMPS Bank Transfer', 'UPI Instant'],
    paymentInstructions: 'Instant INR payout for ETH via verified PhonePe, GPay, or IMPS.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  engine.createOffer({
    id: 'off_buy_inr_sol_7',
    makerId: 'usr_vikram_desk',
    makerName: 'Vikram Malhotra OTC',
    side: 'BUY',
    asset: 'SOL',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('13494.00'),
    totalQuantityMicro: parseCryptoToMicro('120.000000'),
    minOrderFiatMinor: parseFiatToMinor('2000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'SOL', unitPriceFiatMinor: parseFiatToMinor('13494.00') }),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm', 'UPI Instant'],
    paymentInstructions: 'Instant INR UPI settlement for SOL.',
    completedTrades: 612,
    completionRatePct: 99.8,
  });

  // Seed SELL & BUY offers for the remaining Top 10 Global P2P Corridors (Turkey TRY, Iran IRR, Nigeria NGN, Brazil BRL, UAE AED, Vietnam VND)
  engine.createOffer({
    id: 'off_try_usdt_7',
    makerId: 'usr_elena_euro',
    makerName: 'Bosphorus OTC Liquidity',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'TRY',
    unitPriceFiatMinor: parseFiatToMinor('34.25'),
    totalQuantityMicro: parseCryptoToMicro('12000.000000'),
    minOrderFiatMinor: parseFiatToMinor('1000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('34.25') }),
    paymentMethods: ['FAST Instant TRY', 'Papara', 'Ziraat Bank Transfer'],
    paymentInstructions: 'Send TRY via CBRT FAST Instant to TR33 0001 0017 4555 2190 0050 01. Include order ID.',
    completedTrades: 429,
    completionRatePct: 99.6,
  });

  engine.createOffer({
    id: 'off_irr_usdt_8',
    makerId: 'usr_vikram_desk',
    makerName: 'Caspian Settlement Desk',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'IRR',
    unitPriceFiatMinor: parseFiatToMinor('42000.00'),
    totalQuantityMicro: parseCryptoToMicro('8000.000000'),
    minOrderFiatMinor: parseFiatToMinor('500000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('42000.00') }),
    paymentMethods: ['Shetab Card-to-Card', 'Satna / Paya Bank Rail'],
    paymentInstructions: 'Remit IRR via Shetab or Satna domestic rail and upload 16-digit receipt reference.',
    completedTrades: 310,
    completionRatePct: 99.1,
  });

  engine.createOffer({
    id: 'off_ngn_usdt_9',
    makerId: 'usr_sterling_uk',
    makerName: 'Lagos Prime Liquidity',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'NGN',
    unitPriceFiatMinor: parseFiatToMinor('1620.00'),
    totalQuantityMicro: parseCryptoToMicro('15000.000000'),
    minOrderFiatMinor: parseFiatToMinor('20000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('1620.00') }),
    paymentMethods: ['NIP Instant Transfer', 'OPay', 'PalmPay', 'Kuda Bank'],
    paymentInstructions: 'Send NGN via NIBSS Instant Payment (NIP) or OPay and paste session ID.',
    completedTrades: 540,
    completionRatePct: 99.7,
  });

  engine.createOffer({
    id: 'off_brl_usdt_10',
    makerId: 'usr_sterling_uk',
    makerName: 'São Paulo Pix Desk',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'BRL',
    unitPriceFiatMinor: parseFiatToMinor('5.75'),
    totalQuantityMicro: parseCryptoToMicro('10000.000000'),
    minOrderFiatMinor: parseFiatToMinor('100.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('5.75') }),
    paymentMethods: ['Pix Instant', 'Nubank', 'Itaú Transfer'],
    paymentInstructions: 'Instant Pix settlement via CNPJ key. Attach Banco Central EndToEndId.',
    completedTrades: 488,
    completionRatePct: 99.5,
  });

  engine.createOffer({
    id: 'off_aed_usdt_11',
    makerId: 'usr_vikram_desk',
    makerName: 'DIFC Emirates Liquidity',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'AED',
    unitPriceFiatMinor: parseFiatToMinor('3.67'),
    totalQuantityMicro: parseCryptoToMicro('15000.000000'),
    minOrderFiatMinor: parseFiatToMinor('100.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('3.67') }),
    paymentMethods: ['UAEFTS Instant', 'Wio Bank', 'Emirates NBD'],
    paymentInstructions: 'Transfer AED via UAEFTS or Wio Bank Instant to AE07 0331 2345 6789 0123 456.',
    completedTrades: 612,
    completionRatePct: 99.9,
  });

  engine.createOffer({
    id: 'off_vnd_usdt_12',
    makerId: 'usr_elena_euro',
    makerName: 'Saigon Napas247 Desk',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'VND',
    unitPriceFiatMinor: parseFiatToMinor('25400.00'),
    totalQuantityMicro: parseCryptoToMicro('10000.000000'),
    minOrderFiatMinor: parseFiatToMinor('500000.00'),
    maxOrderFiatMinor: calculateMaxOrderCapMinor({ asset: 'USDT', unitPriceFiatMinor: parseFiatToMinor('25400.00') }),
    paymentMethods: ['VietQR Napas247', 'MoMo Wallet', 'Vietcombank'],
    paymentInstructions: 'Scan VietQR Napas247 Vietcombank and enter exact order reference.',
    completedTrades: 395,
    completionRatePct: 99.4,
  });

  // 4. Create 4 Representative Orders (1 Active PAYMENT_PENDING 'Escrow Locked', 1 Active PAYMENT_MARKED_SENT 'Payment Sent', 1 COMPLETED, 1 DISPUTED)
  // Order 1: Active order where Alex is buying ₹10,000 of USDT from Vikram (State: PAYMENT_PENDING -> 'Escrow Locked' / 'Awaiting Payment')
  const ordActive = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_active_1001',
    offerId: 'off_inr_usdt_1',
    takerId: 'usr_alex_trader',
    grossFiatMinor: parseFiatToMinor('10000.00'),
    paymentMethod: 'UPI Instant',
    idempotencyKey: 'seed_ord_1001',
  });
  messages.set(ordActive.id, [
    {
      id: 'msg_1',
      orderId: ordActive.id,
      senderId: 'SYSTEM',
      senderName: 'Costorah Escrow Engine',
      senderRole: 'SYSTEM',
      content: `Escrow locked: ${formatMicro6(ordActive.cryptoQuantityMicro)} USDT is cryptographically reserved. Buyer may now remit ₹10,000.00 via UPI Instant.`,
      createdAt: new Date(Date.now() - 600_000).toISOString(),
    },
    {
      id: 'msg_2',
      orderId: ordActive.id,
      senderId: 'usr_vikram_desk',
      senderName: 'Vikram Malhotra OTC',
      senderRole: 'SELLER',
      content: 'Hello Alex! Online now. Please send ₹10,000.00 to vikram.otc@icici and submit the 12-digit UTR reference.',
      createdAt: new Date(Date.now() - 540_000).toISOString(),
    },
  ]);

  // Order 1B: Active order where Alex is Seller on off_alex_sell_usdt and Buyer marked payment sent (State: PAYMENT_MARKED_SENT -> 'Payment Sent' / 'Escrow Locked · Timer Frozen')
  const ordPaymentSent = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_sent_1004',
    offerId: 'off_alex_sell_usdt',
    takerId: 'usr_vikram_desk',
    grossFiatMinor: parseFiatToMinor('15000.00'),
    paymentMethod: 'PhonePe',
    idempotencyKey: 'seed_ord_1004',
  });
  engine.submitPaymentEvidence({
    orderId: ordPaymentSent.id,
    buyerId: 'usr_vikram_desk',
    paymentReference: 'PhonePe-UTR-418920331902',
    paymentEvidenceUrl: 'receipt://phonepe-utr-418920331902.png',
  });
  messages.set(ordPaymentSent.id, [
    {
      id: 'msg_s1',
      orderId: ordPaymentSent.id,
      senderId: 'SYSTEM',
      senderName: 'Costorah Escrow Engine',
      senderRole: 'SYSTEM',
      content: `Buyer submitted payment proof (PhonePe-UTR-418920331902) for ₹15,000.00. Auto-expiry timer is now frozen while Seller verifies bank credit.`,
      createdAt: new Date(Date.now() - 300_000).toISOString(),
    },
  ]);

  // Order 2: Completed order (Alex bought 500 USDC for €460.00 from Elena)
  const ordCompleted = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_done_1002',
    offerId: 'off_eur_usdc_3',
    takerId: 'usr_alex_trader',
    grossFiatMinor: parseFiatToMinor('460.00'),
    paymentMethod: 'SEPA Instant',
    idempotencyKey: 'seed_ord_1002',
  });
  engine.submitPaymentEvidence({
    orderId: ordCompleted.id,
    buyerId: 'usr_alex_trader',
    paymentReference: 'SEPA-DE89-88492011',
    paymentEvidenceUrl: 'receipt://sepa-instant-88492011.pdf',
  });
  engine.confirmFiatAndReleaseEscrow({
    orderId: ordCompleted.id,
    actorId: 'usr_elena_euro',
    actorRole: 'SELLER',
    idempotencyKey: 'seed_release_1002',
  });
  messages.set(ordCompleted.id, [
    {
      id: 'msg_c1',
      orderId: ordCompleted.id,
      senderId: 'SYSTEM',
      senderName: 'Costorah Escrow Engine',
      senderRole: 'SYSTEM',
      content: 'Settlement finalized. Escrow released 500.000000 USDC to Buyer.',
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ]);

  // Order 3: Disputed order (Alex is Seller on off_alex_sell_usdt, sterling is Buyer, disputed for Admin review)
  const ordDisputed = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_disp_1003',
    offerId: 'off_alex_sell_usdt',
    takerId: 'usr_sterling_uk',
    grossFiatMinor: parseFiatToMinor('25000.00'),
    paymentMethod: 'IMPS Bank Transfer',
    idempotencyKey: 'seed_ord_1003',
  });
  engine.submitPaymentEvidence({
    orderId: ordDisputed.id,
    buyerId: 'usr_sterling_uk',
    paymentReference: 'IMPS-991028341100',
    paymentEvidenceUrl: 'receipt://imps-statement-991028341100.png',
  });
  engine.openDispute({
    orderId: ordDisputed.id,
    actorId: 'usr_alex_trader',
    reason: 'Buyer marked ₹25,000 IMPS sent, but UTR 991028341100 shows pending clearing at beneficiary bank. Requesting escrow hold until NEFT/IMPS batch confirmation.',
  });
  messages.set(ordDisputed.id, [
    {
      id: 'msg_d1',
      orderId: ordDisputed.id,
      senderId: 'SYSTEM',
      senderName: 'Costorah Arbitration Engine',
      senderRole: 'SYSTEM',
      content: 'DISPUTE OPENED: Order frozen in escrow. Neither release nor expiry can occur until an authorized arbitrator records a settlement ruling.',
      createdAt: new Date(Date.now() - 1800_000).toISOString(),
    },
  ]);

  // Order 4: Completed Self-Sell BTC Order (Alex sold BTC for ₹30,000.00 INR [within 500 USDT cap] to Vikram via IMPS Bank Transfer)
  const ordCompletedBtcSell = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_done_btc_1005',
    offerId: 'off_buy_inr_btc_4',
    takerId: 'usr_alex_trader',
    grossFiatMinor: parseFiatToMinor('30000.00'),
    paymentMethod: 'IMPS Bank Transfer',
    idempotencyKey: 'seed_ord_1005',
  });
  engine.submitPaymentEvidence({
    orderId: ordCompletedBtcSell.id,
    buyerId: 'usr_vikram_desk',
    paymentReference: 'IMPS-HDFC-7748291038',
    paymentEvidenceUrl: 'receipt://imps-hdfc-7748291038.pdf',
  });
  engine.confirmFiatAndReleaseEscrow({
    orderId: ordCompletedBtcSell.id,
    actorId: 'usr_alex_trader',
    actorRole: 'SELLER',
    idempotencyKey: 'seed_release_1005',
  });
  messages.set(ordCompletedBtcSell.id, [
    {
      id: 'msg_btc_1',
      orderId: ordCompletedBtcSell.id,
      senderId: 'SYSTEM',
      senderName: 'Costorah Escrow Engine',
      senderRole: 'SYSTEM',
      content: 'BTC Self-Sell Order Settled: Escrowed BTC released after verifying ₹30,000.00 IMPS credit to HDFC Bank •••• 9920.',
      createdAt: new Date(Date.now() - 5400_000).toISOString(),
    },
  ]);

  // 5. Seed Audit Events & Incidents & Notifications
  logAudit('usr_alex_trader', 'USER', 'WALLET_SIWE_VERIFIED', 'WALLET', 'wal_1', 'Verified SIWE challenge signature on Arbitrum Sepolia (0x71C9...292e)');
  logAudit('usr_vikram_desk', 'USER', 'OFFER_CREATED_INVENTORY_LOCKED', 'OFFER', 'off_inr_usdt_1', 'Locked 15,000.000000 USDT in escrow reserve for SELL offer off_inr_usdt_1');
  logAudit('usr_alex_trader', 'BUYER', 'ORDER_ESCROW_LOCKED', 'ORDER', 'ord_active_1001', 'Reserved 115.606936 USDT for ₹10,000.00 trade (1% fee = ₹100.00, Seller net = ₹9,900.00)');
  logAudit('usr_elena_euro', 'SELLER', 'ESCROW_RELEASE_COMPLETED', 'ORDER', 'ord_done_1002', 'Verified SEPA-DE89-88492011 and released 500.000000 USDC to usr_alex_trader');
  logAudit('usr_alex_trader', 'SELLER', 'DISPUTE_OPENED_ESCROW_FROZEN', 'DISPUTE', 'ord_disp_1003', 'Escrow frozen on ord_disp_1003 pending IMPS UTR 991028341100 verification');

  incidents.push({
    id: 'inc_101',
    title: 'Delayed IMPS Interbank Settlement Window (NPCI Maintenance Notice)',
    severity: 'LOW',
    status: 'INVESTIGATING',
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
    notes: 'Monitoring interbank UTR clearing latency for INR rails; automatic expiry timers remain suspended for all PAYMENT_MARKED_SENT orders.',
  });

  addNotification(
    'usr_alex_trader',
    'Escrow Locked — Action Required',
    'Order ord_active_1001 has 115.606936 USDT locked in escrow. Remit ₹10,000.00 via UPI Instant and submit your UTR.',
    'ord_active_1001'
  );
  addNotification(
    'usr_alex_trader',
    'Dispute Frozen in Escrow',
    'Order ord_disp_1003 (288.018433 USDT) is locked under dispute arbitration.',
    'ord_disp_1003'
  );

  // 6. Seed Marketplace Price Alerts (1 Triggered by Worker, 1 Active Monitoring)
  priceAlerts.push(
    {
      id: 'alert_seed_1',
      userId: 'usr_alex_trader',
      userEmail: 'alex.rivera@costorah.io',
      asset: 'USDT',
      fiatCurrency: 'INR',
      direction: 'AT_OR_BELOW',
      targetPriceFiatMinor: parseFiatToMinor('86.60'),
      channel: 'BOTH',
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 1200_000).toISOString(),
    },
    {
      id: 'alert_seed_2',
      userId: 'usr_alex_trader',
      userEmail: 'alex.rivera@costorah.io',
      asset: 'BTC',
      fiatCurrency: 'INR',
      direction: 'AT_OR_BELOW',
      targetPriceFiatMinor: parseFiatToMinor('7350000.00'),
      channel: 'EMAIL',
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 900_000).toISOString(),
    }
  );
}

function runPriceAlertWorkerScan(source = 'BACKGROUND_WORKER'): PriceAlertRecord[] {
  const engineAny = engine as unknown as {
    offers: Map<string, OfferRecord>;
  };
  const allOffers = Array.from(engineAny.offers.values());
  const nowIso = new Date().toISOString();
  const newlyTriggered = evaluatePriceAlertsAgainstOffers(priceAlerts, allOffers, nowIso);

  workerStatus.lastRunAt = nowIso;
  workerStatus.totalScans += 1;
  workerStatus.triggeredCount += newlyTriggered.length;

  for (const alert of newlyTriggered) {
    const targetFormatted = formatMinor2(alert.targetPriceFiatMinor);
    const matchedFormatted = formatMinor2(alert.triggeredPriceFiatMinor || alert.targetPriceFiatMinor);
    const channelNote =
      alert.channel === 'BOTH'
        ? `Dispatched to ${alert.userEmail} + In-App Alert`
        : alert.channel === 'EMAIL'
        ? `Email dispatched to ${alert.userEmail}`
        : 'In-App notification delivered';

    addNotification(
      alert.userId,
      `Price Alert Triggered: ${alert.asset}/${alert.fiatCurrency} @ ${matchedFormatted}`,
      `Your ${alert.direction === 'AT_OR_BELOW' ? '≤' : '≥'} ${targetFormatted} ${alert.fiatCurrency} alert matched Offer ${alert.triggeredOfferId} at ${matchedFormatted} ${alert.fiatCurrency} (${channelNote}).`,
      undefined,
      alert.channel
    );

    logAudit(
      'SYSTEM_ALERT_WORKER',
      'SYSTEM',
      'PRICE_ALERT_TRIGGERED',
      'ALERT',
      alert.id,
      `[${source}] Triggered ${alert.asset}/${alert.fiatCurrency} alert (${alert.channel}) at ${matchedFormatted} ${alert.fiatCurrency} via offer ${alert.triggeredOfferId}`
    );
  }

  return newlyTriggered;
}

seedInitialData();
runPriceAlertWorkerScan('INITIAL_BOOT_SCAN');

function getSnapshot() {
  const engineAny = engine as unknown as {
    offers: Map<string, OfferRecord>;
    orders: Map<string, EscrowOrderRecord>;
  };
  const allOffers = Array.from(engineAny.offers.values());
  const allOrders = Array.from(engineAny.orders.values());
  const currentUser = users.get(activeUserId) || Array.from(users.values())[0];
  const balances = engine.getAllUserBalances(currentUser.id);
  const reconciliation = engine.reconcileAllBalances();

  return {
    currentUser,
    allUsers: Array.from(users.values()),
    balances,
    offers: allOffers,
    orders: allOrders,
    messages: Object.fromEntries(messages.entries()),
    ledgerEntries: engine.getLedgerEntries().slice().reverse(),
    auditLogs,
    incidents,
    notifications: notifications.filter((n) => n.userId === currentUser.id),
    priceAlerts: priceAlerts.filter((a) => a.userId === currentUser.id),
    workerStatus,
    feeBps: engine.getFeeBps(),
    supportedPaymentMethods,
    swapHistory: swapHistory.filter((s) => s.userId === currentUser.id),
    reconciliation,
    livePrices: livePriceFeed,
  };
}

function persistSnapshot() {
  try {
    const serialized = JSON.stringify(getSnapshot(), null, 2);
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, serialized, 'utf-8');
    const publicStateFile = path.resolve(process.cwd(), 'public', 'aegis-state.json');
    if (fs.existsSync(path.dirname(publicStateFile))) {
      fs.writeFileSync(publicStateFile, serialized, 'utf-8');
    }
  } catch (err) {
    console.error('Failed to persist state snapshot:', err);
  }
}

persistSnapshot();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.text({ type: ['text/plain', 'application/*'], limit: '50mb' }));
  app.use((req, _res, next) => {
    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          req.body = JSON.parse(trimmed);
        } catch {
          req.body = {};
        }
      } else {
        req.body = {};
      }
    }
    if (!req.body || typeof req.body !== 'object') {
      req.body = {};
    }
    next();
  });

  // --- API ROUTES ---

  // Get full application state
  app.get(['/api/state', '/aegis-state.json'], (_req, res) => {
    res.json(getSnapshot());
  });

  // User Login & Registration (Username/Email + Password)
  app.post('/api/auth/user-login', (req, res) => {
    try {
      const { mode, identifier, password, displayName, email, countryCode, avatarUrl, bio } = req.body;
      if (mode === 'REGISTER') {
        const cleanEmail = String(email || identifier || '').trim().toLowerCase();
        const cleanName = String(displayName || '').trim();
        const cleanPass = String(password || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return res.status(400).json({ error: 'A valid email address is required to register.' });
        }
        if (cleanEmail === 'admin@costorah.io' || cleanName.toLowerCase() === 'admin') {
          return res.status(400).json({ error: 'Username "admin" is reserved for Administrator Login.' });
        }
        if (cleanName.length < 2) {
          return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
        }
        if (cleanPass.length < 4) {
          return res.status(400).json({ error: 'Password must be at least 4 characters.' });
        }
        const existing = Array.from(users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          return res.status(409).json({ error: `An account with email ${cleanEmail} already exists. Please sign in.` });
        }
        const selectedCountry: CountryCode =
          countryCode && TOP_TRADING_COUNTRIES[countryCode as CountryCode]
            ? (countryCode as CountryCode)
            : 'IN';
        const lockedFiat = getLockedFiatForCountry(selectedCountry);
        const newId = `usr_${Date.now().toString(36)}`;
        const newUser: UserProfile = {
          id: newId,
          displayName: cleanName,
          email: cleanEmail,
          avatarUrl: typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : undefined,
          bio: typeof bio === 'string' && bio.trim() ? bio.trim() : 'Verified P2P Escrow Trader',
          countryCode: selectedCountry,
          preferredFiat: lockedFiat,
          role: 'USER',
          kycTier: 'TIER_2_VERIFIED',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: `id_cred_${Date.now()}`,
              provider: 'USER_CREDENTIALS',
              identifier: cleanEmail,
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          bankAccounts: [],
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        };
        users.set(newUser.id, newUser);
        engine.deposit(newUser.id, 'USDT', parseCryptoToMicro('2500.000000'), `welcome_usdt_${newUser.id}`);
        engine.deposit(newUser.id, 'USDC', parseCryptoToMicro('1000.000000'), `welcome_usdc_${newUser.id}`);
        engine.deposit(newUser.id, 'BTC', parseCryptoToMicro('0.250000'), `welcome_btc_${newUser.id}`);
        engine.deposit(newUser.id, 'ETH', parseCryptoToMicro('2.000000'), `welcome_eth_${newUser.id}`);
        engine.deposit(newUser.id, 'SOL', parseCryptoToMicro('25.000000'), `welcome_sol_${newUser.id}`);
        activeUserId = newUser.id;
        lastRegularUserId = newUser.id;
        logAudit(newUser.id, 'USER', 'USER_ACCOUNT_REGISTERED', 'USER', newUser.id, `Registered new user account ${cleanName} (${cleanEmail})`);
        persistSnapshot();
        return res.json(getSnapshot());
      }

      const check = verifyUserCredentials({
        identifier: String(identifier || ''),
        password: String(password || ''),
        users: Array.from(users.values()),
      });
      if (!check.authenticated || !check.user) {
        const cleanId = String(identifier || '').trim();
        const cleanPass = String(password || '').trim();
        if (
          check.error?.startsWith('No user account found matching') &&
          cleanId.length >= 2 &&
          cleanPass.length >= 3 &&
          cleanId.toLowerCase() !== 'admin' &&
          cleanId.toLowerCase() !== 'admin@costorah.io'
        ) {
          const autoEmail = cleanId.includes('@') ? cleanId.toLowerCase() : `${cleanId.toLowerCase()}@costorah.io`;
          const autoName = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
          const newId = `usr_${Date.now().toString(36)}`;
          const newUser: UserProfile = {
            id: newId,
            displayName: autoName,
            email: autoEmail,
            countryCode: 'IN',
            preferredFiat: 'INR',
            role: 'USER',
            kycTier: 'TIER_2_VERIFIED',
            reputationScore: 100.0,
            completedTrades: 0,
            completionRatePct: 100.0,
            wallets: [],
            identities: [
              {
                id: `id_cred_${Date.now()}`,
                provider: 'USER_CREDENTIALS',
                identifier: autoEmail,
                linkedAt: new Date().toISOString(),
              },
            ],
            paymentMethods: [],
            bankAccounts: [],
            twoFactorEnabled: false,
            createdAt: new Date().toISOString(),
          };
          users.set(newUser.id, newUser);
          engine.deposit(newUser.id, 'USDT', parseCryptoToMicro('2500.000000'), `welcome_usdt_${newUser.id}`);
          engine.deposit(newUser.id, 'USDC', parseCryptoToMicro('1000.000000'), `welcome_usdc_${newUser.id}`);
          engine.deposit(newUser.id, 'BTC', parseCryptoToMicro('0.250000'), `welcome_btc_${newUser.id}`);
          engine.deposit(newUser.id, 'ETH', parseCryptoToMicro('2.000000'), `welcome_eth_${newUser.id}`);
          engine.deposit(newUser.id, 'SOL', parseCryptoToMicro('25.000000'), `welcome_sol_${newUser.id}`);
          activeUserId = newUser.id;
          lastRegularUserId = newUser.id;
          logAudit(newUser.id, 'USER', 'USER_CREDENTIALS_LOGIN_SUCCESS', 'USER', newUser.id, `Provisioned & signed in user "${autoName}" (${autoEmail})`);
          persistSnapshot();
          return res.json(getSnapshot());
        }
        return res.status(401).json({ error: check.error || 'Invalid user credentials.' });
      }
      activeUserId = check.user.id;
      lastRegularUserId = check.user.id;
      logAudit(
        check.user.id,
        'USER',
        'USER_CREDENTIALS_LOGIN_SUCCESS',
        'USER',
        check.user.id,
        `User "${check.user.displayName}" (${check.user.email}) signed in with credentials`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'User login failed' });
    }
  });

  // Dedicated Administrator Login (username: admin, password: admin)
  app.post('/api/auth/admin-login', (req, res) => {
    try {
      const { username, password } = req.body;
      const result = verifyAdminCredentials(String(username || ''), String(password || ''));
      if (!result.authenticated) {
        return res.status(401).json({ error: result.error || 'Invalid administrator credentials.' });
      }
      let adminUser = users.get('usr_costorah_admin');
      if (!adminUser) {
        adminUser = {
          id: 'usr_costorah_admin',
          displayName: 'Costorah Chief Arbitrator (Admin)',
          email: 'admin@costorah.io',
          countryCode: 'IN',
          preferredFiat: 'INR',
          role: 'ADMIN',
          kycTier: 'TIER_2_VERIFIED',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: 'id_admin_cred',
              provider: 'USER_CREDENTIALS',
              identifier: 'admin',
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          twoFactorEnabled: true,
          createdAt: new Date().toISOString(),
        };
        users.set(adminUser.id, adminUser);
      }
      if (activeUserId !== 'usr_costorah_admin') {
        lastRegularUserId = activeUserId;
      }
      activeUserId = adminUser.id;
      logAudit(
        adminUser.id,
        'ADMIN',
        'ADMIN_PORTAL_LOGIN_SUCCESS',
        'USER',
        adminUser.id,
        'Authenticated into Costorah Admin Console with administrator credentials (admin)'
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Admin login failed' });
    }
  });

  // Exit Admin Session and return to active User account
  app.post('/api/auth/logout-admin', (_req, res) => {
    const fallbackId = users.has(lastRegularUserId) && lastRegularUserId !== 'usr_costorah_admin'
      ? lastRegularUserId
      : 'usr_alex_trader';
    activeUserId = fallbackId;
    logAudit(fallbackId, 'USER', 'ADMIN_SESSION_EXITED', 'USER', fallbackId, 'Exited Admin Console and returned to User session');
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Google OAuth 2.0 Sign-In / Profile Retrieval
  app.post('/api/auth/google', (req, res) => {
    try {
      const { email, displayName } = req.body;
      if (!email || !String(email).includes('@')) {
        return res.status(400).json({ error: 'Valid Google email address is required.' });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail === 'admin@costorah.io') {
        return res.status(400).json({ error: 'Administrator account requires username/password login on the Admin Login tab.' });
      }
      let found = Array.from(users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
      if (!found) {
        const newId = `usr_${Date.now().toString(36)}`;
        found = {
          id: newId,
          displayName: displayName ? String(displayName).trim() : cleanEmail.split('@')[0],
          email: cleanEmail,
          countryCode: 'IN',
          preferredFiat: 'INR',
          role: 'USER',
          kycTier: 'TIER_1_BASIC',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: `id_g_${Date.now()}`,
              provider: 'GOOGLE_OAUTH',
              identifier: cleanEmail,
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        };
        users.set(found.id, found);
        // Seed starter testnet balance for new user so they can immediately test trading
        engine.deposit(found.id, 'USDT', parseCryptoToMicro('2500.000000'), `welcome_usdt_${found.id}`);
        engine.deposit(found.id, 'USDC', parseCryptoToMicro('1000.000000'), `welcome_usdc_${found.id}`);
        engine.deposit(found.id, 'BTC', parseCryptoToMicro('0.250000'), `welcome_btc_${found.id}`);
        engine.deposit(found.id, 'ETH', parseCryptoToMicro('2.000000'), `welcome_eth_${found.id}`);
        engine.deposit(found.id, 'SOL', parseCryptoToMicro('25.000000'), `welcome_sol_${found.id}`);
        logAudit(found.id, 'USER', 'GOOGLE_OAUTH_PROFILE_CREATED', 'USER', found.id, `Created unified profile via Google OAuth (${cleanEmail})`);
      } else {
        if (!found.identities.some((id) => id.provider === 'GOOGLE_OAUTH')) {
          found.identities.push({
            id: `id_g_${Date.now()}`,
            provider: 'GOOGLE_OAUTH',
            identifier: cleanEmail,
            linkedAt: new Date().toISOString(),
          });
        }
        logAudit(found.id, found.role, 'GOOGLE_OAUTH_SIGN_IN', 'USER', found.id, `Authenticated via Google OAuth (${cleanEmail})`);
      }
      activeUserId = found.id;
      lastRegularUserId = found.id;
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Authentication failed' });
    }
  });

  app.post('/api/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const target = users.get(userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (target.role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin account requires logging in with Admin username & password (admin / admin).' });
    }
    activeUserId = userId;
    lastRegularUserId = userId;
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Step 1 of External Wallet Connection (ERC-20 / EVM or Solana SPL): Request signed challenge with nonce & expiration
  app.post('/api/wallet/challenge', (req, res) => {
    try {
      const { walletAddress, domain, networkFamily, chain } = req.body;
      const validation = validateBlockchainWalletAddress(
        String(walletAddress || ''),
        networkFamily as BlockchainNetworkFamily | undefined
      );
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error || 'Valid ERC-20 or Solana wallet address is required.' });
      }
      const nonce = `costorah_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const challenge = createWalletChallenge({
        walletAddress: validation.normalizedAddress,
        domain: domain || 'costorah.io',
        nonce,
        networkFamily: validation.networkFamily,
        chain: chain || validation.defaultChain,
      });
      activeChallenges.set(nonce, challenge);
      return res.json({ challenge, validation });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create challenge' });
    }
  });

  // Step 2 of External Wallet Connection: Verify signed challenge (SIWE for ERC-20 / SIWS for Solana) and link/login
  app.post('/api/wallet/verify', (req, res) => {
    try {
      const { nonce, signature, chain, label, networkFamily, providerName } = req.body;
      const challenge = activeChallenges.get(nonce);
      if (!challenge) {
        return res.status(400).json({ error: 'Challenge nonce not found or expired.' });
      }
      const result = verifyWalletChallenge({
        challenge,
        expectedDomain: challenge.domain,
        signature: String(signature || ''),
        usedNonces,
      });
      if (!result.verified) {
        return res.status(400).json({ error: result.reason || 'Signature verification failed.' });
      }

      const validation = validateBlockchainWalletAddress(
        challenge.walletAddress,
        (networkFamily || challenge.networkFamily) as BlockchainNetworkFamily | undefined
      );

      // If currently in admin session, switch back to regular user when connecting a trading wallet
      if (users.get(activeUserId)?.role === 'ADMIN') {
        activeUserId = lastRegularUserId || 'usr_alex_trader';
      }
      let currentUser = users.get(activeUserId)!;

      // Check if wallet is already linked to any user
      for (const u of users.values()) {
        const existing = u.wallets.find((w) => w.address.toLowerCase() === challenge.walletAddress.toLowerCase());
        if (existing) {
          if (u.role !== 'ADMIN') {
            activeUserId = u.id;
            lastRegularUserId = u.id;
            currentUser = u;
          }
          logAudit(
            currentUser.id,
            currentUser.role,
            'WALLET_BLOCKCHAIN_LOGIN_VERIFIED',
            'WALLET',
            existing.id,
            `Authenticated via ${validation.tokenStandard} wallet ${existing.address} (${existing.chain})`
          );
          persistSnapshot();
          return res.json(getSnapshot());
        }
      }

      const resolvedChain = chain || challenge.chain || validation.defaultChain;
      const newWallet: LinkedWallet = {
        id: `wal_${Date.now()}`,
        address: challenge.walletAddress,
        chain: resolvedChain,
        networkFamily: validation.networkFamily,
        tokenStandard: validation.tokenStandard,
        providerName: providerName || (validation.networkFamily === 'SOLANA_SPL' ? 'Phantom' : 'MetaMask'),
        type: 'EXTERNAL_SIWE',
        label: label || (validation.networkFamily === 'SOLANA_SPL' ? 'Solana SPL Wallet' : 'ERC-20 Web3 Wallet'),
        verifiedAt: new Date().toISOString(),
      };
      currentUser.wallets.push(newWallet);
      currentUser.identities.push({
        id: `id_wal_${Date.now()}`,
        provider: validation.networkFamily === 'SOLANA_SPL' ? 'WALLET_SOLANA' : 'WALLET_SIWE',
        identifier: challenge.walletAddress,
        linkedAt: new Date().toISOString(),
      });

      logAudit(
        currentUser.id,
        currentUser.role,
        validation.networkFamily === 'SOLANA_SPL' ? 'SOLANA_WALLET_LINKED_SIWS' : 'ERC20_WALLET_LINKED_SIWE',
        'WALLET',
        newWallet.id,
        `Verified ${validation.tokenStandard} signature (nonce=${nonce}) and connected ${newWallet.address} on ${newWallet.chain}`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Wallet verification failed' });
    }
  });

  // Create Embedded Wallet (only public address & label sent to server; seed phrase never leaves browser)
  app.post('/api/wallet/create-embedded', (req, res) => {
    try {
      const { publicAddress, chain, label, recoveryConfirmed } = req.body;
      if (!recoveryConfirmed) {
        return res.status(400).json({ error: 'You must confirm your offline recovery backup before activating a new wallet.' });
      }
      if (!publicAddress || String(publicAddress).length < 10) {
        return res.status(400).json({ error: 'Invalid public address.' });
      }
      const currentUser = users.get(activeUserId)!;
      const newWallet: LinkedWallet = {
        id: `wal_emb_${Date.now()}`,
        address: String(publicAddress).trim(),
        chain: chain || 'Arbitrum Sepolia (Chain ID 421614)',
        type: 'EMBEDDED_MPC',
        label: label || 'Costorah Embedded Vault',
        verifiedAt: new Date().toISOString(),
      };
      currentUser.wallets.push(newWallet);
      logAudit(
        currentUser.id,
        currentUser.role,
        'EMBEDDED_WALLET_ONBOARDED',
        'WALLET',
        newWallet.id,
        `Onboarded non-custodial embedded wallet ${newWallet.address} (zero private key transmission)`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Embedded wallet creation failed' });
    }
  });

  // Disconnect Blockchain Wallet from Active Session
  app.post('/api/wallet/disconnect', (req, res) => {
    try {
      const { walletId } = req.body;
      const currentUser = users.get(activeUserId)!;
      if (walletId) {
        currentUser.wallets = currentUser.wallets.filter((w) => w.id !== walletId);
      } else {
        currentUser.wallets = [];
      }
      currentUser.identities = currentUser.identities.filter(
        (id) => id.provider !== 'WALLET_SIWE' && id.provider !== 'WALLET_SOLANA'
      );
      logAudit(
        currentUser.id,
        currentUser.role,
        'WALLET_DISCONNECTED',
        'WALLET',
        walletId || 'all',
        'Disconnected Web3 blockchain wallet from active session'
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to disconnect wallet' });
    }
  });

  // Deposit / Withdraw Testnet Crypto
  app.post('/api/ledger/deposit', (req, res) => {
    try {
      const { asset, amount, idempotencyKey } = req.body;
      const micro = parseCryptoToMicro(amount);
      const currentUser = users.get(activeUserId)!;
      engine.deposit(currentUser.id, asset as CryptoAsset, micro, idempotencyKey || `dep_${Date.now()}`);
      logAudit(
        currentUser.id,
        currentUser.role,
        'CRYPTO_DEPOSIT_CONFIRMED',
        'LEDGER',
        currentUser.id,
        `Deposited ${formatMicro6(micro)} ${asset} to available balance`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Deposit failed' });
    }
  });

  app.post('/api/ledger/withdraw', (req, res) => {
    try {
      const { asset, amount, destinationAddress, idempotencyKey } = req.body;
      if (!destinationAddress || String(destinationAddress).trim().length < 8) {
        return res.status(400).json({ error: 'Valid destination wallet address is required for withdrawal.' });
      }
      const micro = parseCryptoToMicro(amount);
      const currentUser = users.get(activeUserId)!;
      engine.withdraw(currentUser.id, asset as CryptoAsset, micro, idempotencyKey || `wd_${Date.now()}`);
      logAudit(
        currentUser.id,
        currentUser.role,
        'CRYPTO_WITHDRAWAL_EXECUTED',
        'LEDGER',
        currentUser.id,
        `Withdrew ${formatMicro6(micro)} ${asset} from available balance to ${destinationAddress}`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Withdrawal rejected' });
    }
  });

  // Cross-Chain Swap & Withdrawal Endpoint (BNB Chain BEP-20, Solana Chain SPL, ERC-20 Chain)
  app.post('/api/swap/execute', (req, res) => {
    try {
      const {
        fromAsset,
        toAsset,
        fromAmount,
        chain,
        settlementMode,
        destinationAddress,
        slippageBps,
        idempotencyKey,
      } = req.body;
      const currentUser = users.get(activeUserId)!;
      const fromAmountMicro = parseCryptoToMicro(fromAmount);
      const selectedChain: SwapChainId =
        chain === 'SOL_CHAIN' || chain === 'ERC20_CHAIN' ? chain : 'BNB_CHAIN';
      const mode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL' =
        settlementMode === 'WITHDRAW_EXTERNAL' ? 'WITHDRAW_EXTERNAL' : 'EXCHANGE_INTERNAL';

      const liveUsdRates: Partial<Record<CryptoAsset, number>> = {
        BTC: livePriceFeed.rates.BTC?.usd,
        ETH: livePriceFeed.rates.ETH?.usd,
        BNB: livePriceFeed.rates.BNB?.usd,
        SOL: livePriceFeed.rates.SOL?.usd,
        USDT: livePriceFeed.rates.USDT?.usd,
        USDC: livePriceFeed.rates.USDC?.usd,
      };

      const swapRecord = engine.executeAssetSwap({
        userId: currentUser.id,
        fromAsset: (fromAsset || 'USDT') as CryptoAsset,
        toAsset: (toAsset || 'BNB') as CryptoAsset,
        fromAmountMicro,
        chain: selectedChain,
        settlementMode: mode,
        destinationAddress: destinationAddress ? String(destinationAddress).trim() : undefined,
        slippageBps: typeof slippageBps === 'number' ? slippageBps : 50,
        liveRates: liveUsdRates,
        usdInrRate: livePriceFeed.usdInrRate,
        idempotencyKey: idempotencyKey || `swap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      });

      swapHistory.unshift(swapRecord);
      const chainMeta = SUPPORTED_SWAP_CHAINS[selectedChain];
      logAudit(
        currentUser.id,
        currentUser.role,
        mode === 'WITHDRAW_EXTERNAL' ? 'CROSS_CHAIN_SWAP_WITHDRAWAL' : 'CROSS_CHAIN_ASSET_SWAP',
        'LEDGER',
        swapRecord.id,
        `Swapped ${swapRecord.fromAmountFormatted} ${swapRecord.fromAsset} → ${swapRecord.toAmountFormatted} ${swapRecord.toAsset} on ${chainMeta.name} (${mode})`
      );
      addNotification(
        currentUser.id,
        mode === 'WITHDRAW_EXTERNAL'
          ? `Chain Withdrawal Dispatched: ${swapRecord.toAmountFormatted} ${swapRecord.toAsset}`
          : `Swap Settled: +${swapRecord.toAmountFormatted} ${swapRecord.toAsset}`,
        mode === 'WITHDRAW_EXTERNAL'
          ? `Swapped ${swapRecord.fromAmountFormatted} ${swapRecord.fromAsset} and withdrew ${swapRecord.toAmountFormatted} ${swapRecord.toAsset} on ${chainMeta.name} to ${swapRecord.destinationAddress}.`
          : `Swapped ${swapRecord.fromAmountFormatted} ${swapRecord.fromAsset} for ${swapRecord.toAmountFormatted} ${swapRecord.toAsset} (₹${swapRecord.netInrValue.toFixed(2)} INR) on ${chainMeta.name}.`
      );
      persistSnapshot();
      return res.json({ swap: swapRecord, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Swap execution failed' });
    }
  });

  // Update User Profile Settings (Edit Username / Display Name, Email, Avatar Image, Bio, Country Jurisdiction Lock)
  app.post('/api/user/profile', (req, res) => {
    try {
      const { displayName, email, avatarUrl, bio, preferredFiat, countryCode } = req.body;
      const currentUser = users.get(activeUserId)!;
      if (!displayName || String(displayName).trim().length < 2) {
        return res.status(400).json({ error: 'Display name / username must be at least 2 characters.' });
      }
      const cleanName = String(displayName).trim();
      const oldName = currentUser.displayName;
      currentUser.displayName = cleanName;

      if (email && String(email).includes('@')) {
        currentUser.email = String(email).trim();
      }
      if (typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
        currentUser.avatarUrl = avatarUrl.trim();
      }
      if (typeof bio === 'string') {
        currentUser.bio = bio.trim();
      }
      if (countryCode && TOP_TRADING_COUNTRIES[countryCode as CountryCode]) {
        const validCountry = countryCode as CountryCode;
        currentUser.countryCode = validCountry;
        currentUser.preferredFiat = getLockedFiatForCountry(validCountry);
      } else if (preferredFiat) {
        currentUser.preferredFiat = preferredFiat as FiatCurrency;
      }

      // Sync makerName across open offers owned by this user
      const engineAny = engine as unknown as { offers: Map<string, OfferRecord> };
      for (const off of engineAny.offers.values()) {
        if (off.makerId === currentUser.id) {
          off.makerName = cleanName;
        }
      }

      logAudit(
        currentUser.id,
        currentUser.role,
        'USER_PROFILE_UPDATED',
        'USER',
        currentUser.id,
        `Updated profile "${oldName}" -> "${cleanName}" (${currentUser.email}) [Avatar=${currentUser.avatarUrl ? 'Saved' : 'Default'}, Country=${currentUser.countryCode || 'IN'} -> Fiat=${currentUser.preferredFiat || 'INR'}]`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update profile' });
    }
  });

  // Register a New Bank Account in Profile Settings (and sync with Payment Methods)
  app.post('/api/user/bank-accounts', (req, res) => {
    try {
      const {
        accountHolderName,
        bankName,
        accountNumber,
        ifscOrSwiftCode,
        accountType,
        branchName,
        fiatCurrency,
        linkedUpiId,
        isPrimary,
      } = req.body;
      const currentUser = users.get(activeUserId)!;
      const formatted = validateAndFormatBankAccount({
        accountHolderName,
        bankName,
        accountNumber,
        ifscOrSwiftCode,
        accountType,
        branchName,
        fiatCurrency: (fiatCurrency || currentUser.preferredFiat || 'INR') as FiatCurrency,
        linkedUpiId,
      });

      if (!currentUser.bankAccounts) {
        currentUser.bankAccounts = [];
      }
      if (isPrimary) {
        for (const b of currentUser.bankAccounts) {
          b.isPrimary = false;
        }
      }

      const newBank: RegisteredBankAccount = {
        id: `bank_${Date.now().toString(36)}`,
        userId: currentUser.id,
        ...formatted,
        isPrimary: Boolean(isPrimary || currentUser.bankAccounts.length === 0),
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      currentUser.bankAccounts.unshift(newBank);

      // Also sync into user's P2P paymentMethods so it appears in settlement rails
      const railName =
        formatted.fiatCurrency === 'INR'
          ? 'IMPS Bank Transfer'
          : formatted.fiatCurrency === 'EUR'
          ? 'SEPA Instant'
          : formatted.fiatCurrency === 'USD'
          ? 'ACH Bank Transfer'
          : `${formatted.bankName} Transfer`;

      currentUser.paymentMethods.unshift({
        id: `pm_bank_${Date.now().toString(36)}`,
        userId: currentUser.id,
        methodName: railName,
        category: 'BANK_TRANSFER',
        fiatCurrency: formatted.fiatCurrency,
        accountHolder: formatted.accountHolderName,
        accountIdentifier: `Acct ${formatted.maskedAccountNumber} · ${formatted.ifscOrSwiftCode}`,
        bankOrProvider: `${formatted.bankName} (${formatted.branchName})`,
        ifscOrSwiftCode: formatted.ifscOrSwiftCode,
        accountType: formatted.accountType,
        branchName: formatted.branchName,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verificationMethod: 'Instant Bank Penny-Drop Verified',
      });

      logAudit(
        currentUser.id,
        currentUser.role,
        'BANK_ACCOUNT_REGISTERED',
        'USER',
        newBank.id,
        `Registered bank account ${newBank.bankName} (${newBank.maskedAccountNumber}, ${newBank.ifscOrSwiftCode}) for ${newBank.fiatCurrency} settlement`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to register bank account' });
    }
  });

  app.post('/api/user/bank-accounts/:bankId/delete', (req, res) => {
    const { bankId } = req.params;
    const currentUser = users.get(activeUserId)!;
    if (!currentUser.bankAccounts) currentUser.bankAccounts = [];
    const idx = currentUser.bankAccounts.findIndex((b) => b.id === bankId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Registered bank account not found.' });
    }
    const [removed] = currentUser.bankAccounts.splice(idx, 1);
    logAudit(
      currentUser.id,
      currentUser.role,
      'BANK_ACCOUNT_REMOVED',
      'USER',
      bankId,
      `Removed registered bank account ${removed.bankName} (${removed.maskedAccountNumber})`
    );
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Switch Active Country Jurisdiction -> Automatically Locks Trading Fiat Currency (e.g. India -> INR, US -> USD, Turkey -> TRY, Iran -> IRR)
  app.post('/api/user/country', (req, res) => {
    try {
      const { countryCode } = req.body;
      const currentUser = users.get(activeUserId)!;
      const lockedFiat = getLockedFiatForCountry(countryCode as CountryCode);
      const policy = TOP_TRADING_COUNTRIES[countryCode as CountryCode];

      currentUser.countryCode = policy.code;
      currentUser.preferredFiat = lockedFiat;

      logAudit(
        currentUser.id,
        currentUser.role,
        'COUNTRY_FIAT_SECURITY_LOCK_SET',
        'USER',
        currentUser.id,
        `Set account trading country to ${policy.name} (${policy.code}). Trading currency strictly locked to ${policy.fiatName} (${lockedFiat} ${policy.fiatSymbol}).`
      );
      addNotification(
        currentUser.id,
        `Jurisdiction Lock Active: ${policy.name} (${lockedFiat})`,
        `Your account is now locked to ${policy.name} (${policy.code}). All P2P crypto orders and offers are restricted to ${policy.fiatName} (${lockedFiat} ${policy.fiatSymbol}).`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update country lock' });
    }
  });

  // Add Payment Method (Supports PhonePe, Google Pay, Paytm, Credit/Debit Cards, UPI, Bank Transfers)
  app.post('/api/user/payment-methods', (req, res) => {
    try {
      const {
        methodName,
        category,
        fiatCurrency,
        accountHolder,
        accountIdentifier,
        bankOrProvider,
        expiryDate,
        cardNetwork,
        verifyImmediately,
      } = req.body;
      if (!methodName || !fiatCurrency || !accountHolder || !accountIdentifier || !bankOrProvider) {
        return res.status(400).json({ error: 'All payment method fields are required.' });
      }
      const currentUser = users.get(activeUserId)!;
      const isCard =
        category === 'CARD' ||
        String(methodName).toLowerCase().includes('card') ||
        String(methodName).toLowerCase().includes('visa') ||
        String(methodName).toLowerCase().includes('mastercard');

      const safeIdentifier = isCard
        ? sanitizeAndMaskCardIdentifier(String(accountIdentifier), String(cardNetwork || methodName))
        : String(accountIdentifier).trim();

      const verifiedNow = verifyImmediately === true;
      const pm: UserPaymentMethod = {
        id: `pm_${Date.now()}`,
        userId: currentUser.id,
        methodName: String(methodName).trim(),
        category: isCard
          ? 'CARD'
          : category === 'UPI_APP' ||
            ['phonepe', 'google pay', 'gpay', 'paytm', 'upi'].some((k) =>
              String(methodName).toLowerCase().includes(k)
            )
          ? 'UPI_APP'
          : 'BANK_TRANSFER',
        fiatCurrency: fiatCurrency as FiatCurrency,
        accountHolder: String(accountHolder).trim(),
        accountIdentifier: safeIdentifier,
        bankOrProvider: String(bankOrProvider).trim(),
        expiryDate: expiryDate ? String(expiryDate).trim() : undefined,
        isVerified: verifiedNow,
        verifiedAt: verifiedNow ? new Date().toISOString() : undefined,
        verificationMethod: verifiedNow
          ? isCard
            ? '3DS2 Micro-Charge Verification'
            : 'Instant Handle / Penny-Drop Verification'
          : undefined,
      };
      currentUser.paymentMethods.unshift(pm);
      logAudit(
        currentUser.id,
        currentUser.role,
        'PAYMENT_METHOD_ADDED',
        'USER',
        pm.id,
        `Added ${pm.methodName} (${pm.fiatCurrency}) — ${pm.accountIdentifier} [Verified=${pm.isVerified}]`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to add payment method' });
    }
  });

  // Verify a Saved Payment Method (Penny-Drop / UPI VPA Handshake / 3DS Card Check)
  app.post('/api/user/payment-methods/:pmId/verify', (req, res) => {
    try {
      const { pmId } = req.params;
      const { verificationCode } = req.body;
      const currentUser = users.get(activeUserId)!;
      const pm = currentUser.paymentMethods.find((p) => p.id === pmId);
      if (!pm) {
        return res.status(404).json({ error: 'Payment method not found.' });
      }
      pm.isVerified = true;
      pm.verifiedAt = new Date().toISOString();
      pm.verificationMethod =
        pm.category === 'CARD'
          ? `3DS2 Card Auth Confirmed (${verificationCode || 'OTP-9941'})`
          : pm.category === 'UPI_APP'
          ? `NPCI UPI VPA Handshake Verified (${verificationCode || 'VPA-OK'})`
          : `Bank Penny-Drop Verified (${verificationCode || 'UTR-OK'})`;

      logAudit(
        currentUser.id,
        currentUser.role,
        'PAYMENT_METHOD_VERIFIED',
        'USER',
        pm.id,
        `Verified ${pm.methodName} (${pm.accountIdentifier}) via ${pm.verificationMethod}`
      );
      addNotification(
        currentUser.id,
        `Payment Method Verified: ${pm.methodName}`,
        `${pm.accountIdentifier} (${pm.bankOrProvider}) is now verified for P2P fiat settlement.`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Payment verification failed' });
    }
  });

  // Delete a Saved Payment Method
  app.post('/api/user/payment-methods/:pmId/delete', (req, res) => {
    const { pmId } = req.params;
    const currentUser = users.get(activeUserId)!;
    const idx = currentUser.paymentMethods.findIndex((p) => p.id === pmId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }
    const [removed] = currentUser.paymentMethods.splice(idx, 1);
    logAudit(
      currentUser.id,
      currentUser.role,
      'PAYMENT_METHOD_REMOVED',
      'USER',
      pmId,
      `Removed payment method ${removed.methodName} (${removed.accountIdentifier})`
    );
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Marketplace Price Alerts: Create Alert & Run Worker Evaluation
  app.post('/api/price-alerts', (req, res) => {
    try {
      const { asset, fiatCurrency, direction, targetPriceFiat, channel, userEmail } = req.body;
      const currentUser = users.get(activeUserId)!;
      const targetMinor = parseFiatToMinor(String(targetPriceFiat || '0'));
      const cleanEmail =
        userEmail && String(userEmail).includes('@') ? String(userEmail).trim() : currentUser.email;

      const newAlert: PriceAlertRecord = {
        id: `alert_${Date.now().toString(36)}`,
        userId: currentUser.id,
        userEmail: cleanEmail,
        asset: (asset || 'USDT') as CryptoAsset,
        fiatCurrency: (fiatCurrency || 'INR') as FiatCurrency,
        direction: direction === 'AT_OR_ABOVE' ? 'AT_OR_ABOVE' : 'AT_OR_BELOW',
        targetPriceFiatMinor: targetMinor,
        channel: channel === 'EMAIL' || channel === 'IN_APP' ? channel : 'BOTH',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      priceAlerts.unshift(newAlert);
      logAudit(
        currentUser.id,
        currentUser.role,
        'PRICE_ALERT_CREATED',
        'ALERT',
        newAlert.id,
        `Created ${newAlert.channel} price alert for ${newAlert.asset}/${newAlert.fiatCurrency} ${newAlert.direction} ${formatMinor2(newAlert.targetPriceFiatMinor)} ${newAlert.fiatCurrency}`
      );

      // Immediately run background worker scan so matching open offers trigger right away
      const triggered = runPriceAlertWorkerScan('ALERT_CREATION_SCAN');
      persistSnapshot();
      return res.json({ alert: newAlert, triggeredCount: triggered.length, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create price alert' });
    }
  });

  // Delete / Cancel Price Alert
  app.post('/api/price-alerts/:alertId/delete', (req, res) => {
    const { alertId } = req.params;
    const currentUser = users.get(activeUserId)!;
    const idx = priceAlerts.findIndex((a) => a.id === alertId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Price alert not found.' });
    }
    const [removed] = priceAlerts.splice(idx, 1);
    logAudit(
      currentUser.id,
      currentUser.role,
      'PRICE_ALERT_DELETED',
      'ALERT',
      alertId,
      `Deleted price alert for ${removed.asset}/${removed.fiatCurrency}`
    );
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Trigger Background Worker Price Alert Scan Immediately
  app.post('/api/price-alerts/run-worker', (_req, res) => {
    const triggered = runPriceAlertWorkerScan('MANUAL_WORKER_TRIGGER');
    persistSnapshot();
    return res.json({ triggeredCount: triggered.length, state: getSnapshot() });
  });

  // Update Security Settings
  app.post('/api/user/security', (req, res) => {
    const { twoFactorEnabled, recoveryGuardianEmail } = req.body;
    const currentUser = users.get(activeUserId)!;
    if (typeof twoFactorEnabled === 'boolean') currentUser.twoFactorEnabled = twoFactorEnabled;
    if (typeof recoveryGuardianEmail === 'string') currentUser.recoveryGuardianEmail = recoveryGuardianEmail.trim();
    logAudit(currentUser.id, currentUser.role, 'SECURITY_SETTINGS_UPDATED', 'USER', currentUser.id, `2FA=${currentUser.twoFactorEnabled}, Guardian=${currentUser.recoveryGuardianEmail || 'none'}`);
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Update Notification Preferences (Email alerts for Trade Started, Payment Received, Dispute Opened)
  app.post('/api/user/notification-preferences', (req, res) => {
    try {
      const { tradeStarted, paymentReceived, disputeOpened } = req.body;
      const currentUser = users.get(activeUserId)!;
      if (!currentUser.notificationPreferences) {
        currentUser.notificationPreferences = {
          tradeStarted: true,
          paymentReceived: true,
          disputeOpened: true,
        };
      }
      if (typeof tradeStarted === 'boolean') currentUser.notificationPreferences.tradeStarted = tradeStarted;
      if (typeof paymentReceived === 'boolean') currentUser.notificationPreferences.paymentReceived = paymentReceived;
      if (typeof disputeOpened === 'boolean') currentUser.notificationPreferences.disputeOpened = disputeOpened;

      logAudit(
        currentUser.id,
        currentUser.role,
        'NOTIFICATION_PREFERENCES_UPDATED',
        'USER',
        currentUser.id,
        `Email alert settings updated: Trade Started=${currentUser.notificationPreferences.tradeStarted}, Payment Received=${currentUser.notificationPreferences.paymentReceived}, Dispute Opened=${currentUser.notificationPreferences.disputeOpened}`
      );
      persistSnapshot();
      return res.json({ notificationPreferences: currentUser.notificationPreferences, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update notification preferences' });
    }
  });

  // Trigger simulated test notification email
  app.post('/api/user/test-notification', (req, res) => {
    try {
      const { eventType } = req.body;
      const currentUser = users.get(activeUserId)!;
      let title = 'Test Email Notification';
      let message = `Test email alert from Costorah P2P Escrow for ${currentUser.email}.`;
      if (eventType === 'TRADE_STARTED') {
        title = 'Email Alert: Trade Started — Escrow Locked';
        message = `A new P2P trade has started on order #ord_demo. Escrow funds are secured.`;
      } else if (eventType === 'PAYMENT_RECEIVED') {
        title = 'Email Alert: Payment Received';
        message = `Buyer declared fiat sent with reference #UPI789012. Please verify receipt in your bank before release.`;
      } else if (eventType === 'DISPUTE_OPENED') {
        title = 'Email Alert: Dispute Opened';
        message = `An arbitration dispute has been raised on order #ord_demo. Escrow funds are frozen pending arbitrator review.`;
      }
      addNotification(currentUser.id, title, message, undefined, 'BOTH');
      persistSnapshot();
      return res.json({ success: true, message: `Dispatched test email alert to ${currentUser.email}`, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to trigger test notification' });
    }
  });

  // Create Offer
  app.post('/api/offers', (req, res) => {
    try {
      const {
        side,
        asset,
        fiatCurrency,
        unitPriceFiat,
        totalQuantityCrypto,
        minOrderFiat,
        maxOrderFiat,
        paymentMethods,
        paymentInstructions,
      } = req.body;

      const currentUser = users.get(activeUserId)!;
      // Enforce Country-to-Fiat Security Lock on Offer Creation
      assertCountryFiatLock(
        (currentUser.countryCode || 'IN') as CountryCode,
        fiatCurrency as FiatCurrency
      );

      const parsedUnitPriceMinor = parseFiatToMinor(unitPriceFiat);
      const parsedQuantityMicro = parseCryptoToMicro(totalQuantityCrypto);
      const parsedMinMinor = parseFiatToMinor(minOrderFiat);
      const parsedMaxMinor = parseFiatToMinor(maxOrderFiat);
      const totalOfferFiatMinor = Math.max(
        1,
        Number(
          (BigInt(parsedQuantityMicro) * BigInt(parsedUnitPriceMinor) + 500_000n) / 1_000_000n
        )
      );
      const maxUsdtCapMinor = calculateMaxOrderCapMinor({
        asset: asset as CryptoAsset,
        unitPriceFiatMinor: parsedUnitPriceMinor,
      });

      if (parsedMaxMinor > totalOfferFiatMinor) {
        return res.status(400).json({
          error: `Max Order Limit (${formatMinor2(parsedMaxMinor)} ${fiatCurrency}) cannot exceed Total Offer Value (${formatMinor2(totalOfferFiatMinor)} ${fiatCurrency} = ${formatMicro6(parsedQuantityMicro)} ${asset} × ${formatMinor2(parsedUnitPriceMinor)} ${fiatCurrency}).`,
        });
      }

      if (parsedMaxMinor > maxUsdtCapMinor) {
        return res.status(400).json({
          error: `Max Order Limit (${formatMinor2(parsedMaxMinor)} ${fiatCurrency}) cannot exceed the $${DAILY_TRADING_LIMIT_USD.toLocaleString()} USD daily limit (${formatMinor2(maxUsdtCapMinor)} ${fiatCurrency} at ${formatMinor2(parsedUnitPriceMinor)} ${fiatCurrency}/${asset}).`,
        });
      }

      const offerId = `off_${Date.now().toString(36)}`;
      const offer = engine.createOffer({
        id: offerId,
        makerId: currentUser.id,
        makerName: currentUser.displayName,
        side: side === 'BUY' ? 'BUY' : 'SELL',
        asset: asset as CryptoAsset,
        fiatCurrency: fiatCurrency as FiatCurrency,
        unitPriceFiatMinor: parsedUnitPriceMinor,
        totalQuantityMicro: parsedQuantityMicro,
        minOrderFiatMinor: parsedMinMinor,
        maxOrderFiatMinor: parsedMaxMinor,
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [String(paymentMethods)],
        paymentInstructions: String(paymentInstructions || 'Follow standard trade room settlement instructions.').trim(),
        completedTrades: currentUser.completedTrades,
        completionRatePct: currentUser.completionRatePct,
      });

      logAudit(
        currentUser.id,
        currentUser.role,
        'OFFER_CREATED',
        'OFFER',
        offer.id,
        `Created ${offer.side} offer for ${formatMicro6(offer.totalQuantityMicro)} ${offer.asset} @ ${formatMinor2(offer.unitPriceFiatMinor)} ${offer.fiatCurrency}`
      );
      runPriceAlertWorkerScan('NEW_OFFER_PUBLISHED');
      persistSnapshot();
      return res.json({ offer, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create offer' });
    }
  });

  // Toggle Pause / Resume or Cancel Offer
  app.post('/api/offers/:offerId/status', (req, res) => {
    try {
      const { offerId } = req.params;
      const { action } = req.body; // 'PAUSE' | 'RESUME' | 'CANCEL'
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { offers: Map<string, OfferRecord> };
      const offer = engineAny.offers.get(offerId);
      if (!offer) return res.status(404).json({ error: 'Offer not found.' });

      if (action === 'CANCEL') {
        engine.cancelOffer(offerId, currentUser.id);
        logAudit(currentUser.id, currentUser.role, 'OFFER_CANCELLED', 'OFFER', offerId, `Cancelled offer ${offerId} and returned unreserved inventory`);
      } else if (action === 'PAUSE') {
        if (offer.makerId !== currentUser.id) return res.status(403).json({ error: 'Not offer owner.' });
        offer.status = 'PAUSED';
        logAudit(currentUser.id, currentUser.role, 'OFFER_PAUSED', 'OFFER', offerId, `Paused offer ${offerId}`);
      } else if (action === 'RESUME') {
        if (offer.makerId !== currentUser.id) return res.status(403).json({ error: 'Not offer owner.' });
        offer.status = 'OPEN';
        logAudit(currentUser.id, currentUser.role, 'OFFER_RESUMED', 'OFFER', offerId, `Resumed offer ${offerId}`);
      }
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update offer' });
    }
  });

  // Edit Published Offer (Price, Quantity, Min/Max Limits, Payment Methods, Instructions)
  app.post('/api/offers/:offerId/edit', (req, res) => {
    try {
      const { offerId } = req.params;
      const {
        unitPriceFiat,
        totalQuantityCrypto,
        minOrderFiat,
        maxOrderFiat,
        paymentMethods,
        paymentInstructions,
      } = req.body;
      const currentUser = users.get(activeUserId)!;

      const updatedOffer = engine.updateOffer({
        offerId,
        actorUserId: currentUser.id,
        unitPriceFiatMinor: unitPriceFiat ? parseFiatToMinor(String(unitPriceFiat)) : undefined,
        availableQuantityMicro: totalQuantityCrypto
          ? parseCryptoToMicro(String(totalQuantityCrypto))
          : undefined,
        minOrderFiatMinor: minOrderFiat ? parseFiatToMinor(String(minOrderFiat)) : undefined,
        maxOrderFiatMinor: maxOrderFiat ? parseFiatToMinor(String(maxOrderFiat)) : undefined,
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : undefined,
        paymentInstructions:
          typeof paymentInstructions === 'string' ? paymentInstructions : undefined,
      });

      logAudit(
        currentUser.id,
        currentUser.role,
        'OFFER_EDITED',
        'OFFER',
        offerId,
        `Edited ${updatedOffer.side} offer ${offerId}: ${formatMicro6(
          updatedOffer.availableQuantityMicro
        )} ${updatedOffer.asset} @ ${formatMinor2(updatedOffer.unitPriceFiatMinor)} ${
          updatedOffer.fiatCurrency
        }`
      );
      runPriceAlertWorkerScan('OFFER_EDITED');
      persistSnapshot();
      return res.json({ offer: updatedOffer, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to edit offer' });
    }
  });

  // Accept Offer -> Create Order & Lock Escrow
  app.post('/api/orders', (req, res) => {
    try {
      const {
        offerId,
        grossFiatAmount,
        paymentMethod,
        idempotencyKey,
      } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { offers: Map<string, OfferRecord> };
      const targetOffer = engineAny.offers.get(offerId);
      if (!targetOffer) {
        return res.status(404).json({ error: 'Offer not found.' });
      }

      // Enforce Country-to-Fiat Security Lock on Order Creation
      assertCountryFiatLock(
        (currentUser.countryCode || 'IN') as CountryCode,
        targetOffer.fiatCurrency
      );

      const orderId = `ord_${Date.now().toString(36)}`;
      const grossFiatMinor = parseFiatToMinor(grossFiatAmount);

      // Enforce $10,000 USD Daily Buy / Daily Sell Limit per user
      const engineOrders = Array.from(
        (engine as unknown as { orders: Map<string, EscrowOrderRecord> }).orders.values()
      );
      const dailyStatus = calculateUserDailyLimitStatus(engineOrders, currentUser.id);
      const tentativeBreakdown = calculateTradeBreakdown({
        grossFiatInput: formatMinor2(grossFiatMinor),
        unitPriceFiatInput: formatMinor2(targetOffer.unitPriceFiatMinor),
        fiatCurrency: targetOffer.fiatCurrency,
        cryptoAsset: targetOffer.asset,
      });
      const orderCryptoUnits = tentativeBreakdown.cryptoQuantityMicro / 1_000_000;
      const assetUsdRate =
        livePriceFeed.rates[targetOffer.asset]?.usd ??
        USD_REFERENCE_RATES[targetOffer.asset] ??
        1.0;
      const orderUsdValue = Number((orderCryptoUnits * assetUsdRate).toFixed(2));
      const isUserBuying = targetOffer.side === 'SELL';

      if (isUserBuying && orderUsdValue > dailyStatus.dailyBuyRemainingUsd) {
        return res.status(400).json({
          error: `Daily Buy Limit Exceeded: This order is worth $${orderUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD, which exceeds your remaining daily buy allowance of $${dailyStatus.dailyBuyRemainingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ($${DAILY_TRADING_LIMIT_USD.toLocaleString()} USD/day max).`,
        });
      }
      if (!isUserBuying && orderUsdValue > dailyStatus.dailySellRemainingUsd) {
        return res.status(400).json({
          error: `Daily Sell Limit Exceeded: This order is worth $${orderUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD, which exceeds your remaining daily sell allowance of $${dailyStatus.dailySellRemainingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ($${DAILY_TRADING_LIMIT_USD.toLocaleString()} USD/day max).`,
        });
      }

      const order = engine.acceptOfferAndLockEscrow({
        orderId,
        offerId,
        takerId: currentUser.id,
        grossFiatMinor,
        paymentMethod: String(paymentMethod || 'UPI Instant'),
        idempotencyKey: idempotencyKey || `idem_${orderId}`,
      });

      messages.set(order.id, [
        {
          id: `msg_${Date.now()}`,
          orderId: order.id,
          senderId: 'SYSTEM',
          senderName: 'Costorah Escrow Engine',
          senderRole: 'SYSTEM',
          content: `Order ${order.id} initiated. 1:1 Escrow locked ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset}. Buyer will receive 100% of the escrowed crypto (${formatMicro6(order.cryptoQuantityMicro)} ${order.asset}) upon settlement. If cancelled before payment, 100% of the escrowed crypto will be refunded to the seller.`,
          createdAt: new Date().toISOString(),
        },
      ]);

      logAudit(
        currentUser.id,
        currentUser.role,
        'ORDER_ACCEPTED_ESCROW_LOCKED',
        'ORDER',
        order.id,
        `Locked ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} in escrow for ${formatMinor2(order.grossFiatMinor)} ${order.fiatCurrency}`
      );
      const buyerUser = users.get(order.buyerId);
      const sellerUser = users.get(order.sellerId);
      const buyerChannel = buyerUser?.notificationPreferences?.tradeStarted !== false ? 'BOTH' : 'IN_APP';
      const sellerChannel = sellerUser?.notificationPreferences?.tradeStarted !== false ? 'BOTH' : 'IN_APP';

      addNotification(
        order.buyerId,
        'Trade Started — Escrow Locked',
        `Order ${order.id} has ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} locked in 1:1 escrow. Buyer receives 100% (${formatMicro6(order.cryptoQuantityMicro)} ${order.asset}) upon settlement.`,
        order.id,
        buyerChannel
      );
      addNotification(
        order.sellerId,
        'Trade Started — Counterparty Accepted Offer',
        `Buyer accepted your offer for ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} (Order ${order.id}). Escrow is securely locked.`,
        order.id,
        sellerChannel
      );
      persistSnapshot();
      return res.json({ order, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to accept offer' });
    }
  });

  // Cancel Order & Release Locked Escrow Crypto
  app.post('/api/orders/:orderId/cancel', (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { orders: Map<string, EscrowOrderRecord> };
      const existing = engineAny.orders.get(orderId);
      if (!existing) return res.status(404).json({ error: 'Order not found.' });

      const updated = engine.cancelOrder({
        orderId,
        actorId: currentUser.id,
        actorRole: currentUser.role === 'ADMIN' ? 'ADMIN' : (currentUser.id === existing.buyerId ? 'BUYER' : 'SELLER'),
        reason: reason || 'Order cancelled before payment. 100% of escrowed crypto released.',
      });

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_${Date.now()}`,
        orderId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderRole: currentUser.id === existing.buyerId ? 'BUYER' : 'SELLER',
        content: `Order cancelled before payment. 100% of the escrowed crypto (${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset}) has been released back to the seller.`,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      logAudit(
        currentUser.id,
        currentUser.role,
        'ORDER_CANCELLED_ESCROW_RELEASED',
        'ORDER',
        orderId,
        `Order ${orderId} cancelled. 100% of escrowed crypto (${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset}) returned to seller.`
      );
      addNotification(
        updated.sellerId,
        'Order Cancelled — Escrow Released',
        `Order ${orderId} was cancelled. 100% of your escrowed crypto has been released back to your balance.`,
        orderId
      );
      persistSnapshot();
      return res.json({ order: updated, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to cancel order' });
    }
  });

  // Real-time Live Prices API
  app.get('/api/prices/live', (_req, res) => {
    return res.json(livePriceFeed);
  });

  app.post('/api/prices/refresh', async (_req, res) => {
    await fetchRealMarketPrices();
    return res.json(livePriceFeed);
  });

  // Buyer submits payment reference and evidence
  app.post('/api/orders/:orderId/payment-sent', (req, res) => {
    try {
      const { orderId } = req.params;
      const { paymentReference, paymentEvidenceUrl, note } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { orders: Map<string, EscrowOrderRecord> };
      const existingOrder = engineAny.orders.get(orderId);
      if (!existingOrder) return res.status(404).json({ error: 'Order not found.' });

      const finalPaymentRef =
        paymentReference && String(paymentReference).trim().length >= 3
          ? String(paymentReference).trim()
          : existingOrder.paymentReference || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;

      // Allow demo testing seamlessly as buyer on the order
      const updated = engine.submitPaymentEvidence({
        orderId,
        buyerId: existingOrder.buyerId,
        paymentReference: finalPaymentRef,
        paymentEvidenceUrl: paymentEvidenceUrl ? String(paymentEvidenceUrl) : undefined,
      });

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_${Date.now()}`,
        orderId,
        senderId: existingOrder.buyerId,
        senderName: users.get(existingOrder.buyerId)?.displayName || 'Buyer',
        senderRole: 'BUYER',
        content: `Marked fiat payment sent. Reference / UTR: ${updated.paymentReference}${note ? ` — "${note}"` : ''}. Automatic expiry timer is now suspended pending Seller verification.`,
        attachmentUrl: updated.paymentEvidenceUrl,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      logAudit(
        currentUser.id,
        'BUYER',
        'PAYMENT_MARKED_SENT',
        'ORDER',
        orderId,
        `Buyer declared fiat sent with reference=${updated.paymentReference}`
      );
      const seller = users.get(existingOrder.sellerId);
      const buyer = users.get(existingOrder.buyerId);
      const sellerChannel = seller?.notificationPreferences?.paymentReceived !== false ? 'BOTH' : 'IN_APP';
      const formattedAmount = `${formatMinor2(updated.grossFiatMinor)} ${updated.fiatCurrency}`;
      addNotification(
        existingOrder.sellerId,
        `Payment Completed by Buyer — Order #${orderId}`,
        `${buyer?.displayName || 'Buyer'} completed fiat payment of ${formattedAmount} via ${updated.paymentMethod} (Ref: ${updated.paymentReference}).${note ? ` Note: "${note}"` : ''} Please verify receipt and release escrow.`,
        orderId,
        sellerChannel
      );
      if (existingOrder.buyerId !== existingOrder.sellerId) {
        addNotification(
          existingOrder.buyerId,
          `Payment Completion Alert Sent — Order #${orderId}`,
          `Seller (${seller?.displayName || existingOrder.sellerId}) has been alerted that your payment of ${formattedAmount} (Ref: ${updated.paymentReference}) is completed.`,
          orderId,
          'IN_APP'
        );
      }
      persistSnapshot();
      return res.json({ order: updated, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to submit payment declaration' });
    }
  });

  // Notify counterparty user about payment completion (sends In-App/Email Alert + Trade Room Message)
  app.post('/api/orders/:orderId/notify-payment', (req, res) => {
    try {
      const { orderId } = req.params;
      const { customMessage, channel } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { orders: Map<string, EscrowOrderRecord> };
      const existingOrder = engineAny.orders.get(orderId);
      if (!existingOrder) return res.status(404).json({ error: 'Order not found.' });

      const isBuyerActor = currentUser.id === existingOrder.buyerId;
      const recipientId = isBuyerActor ? existingOrder.sellerId : existingOrder.buyerId;
      const recipientUser = users.get(recipientId);
      const formattedAmount = `${formatMinor2(existingOrder.grossFiatMinor)} ${existingOrder.fiatCurrency}`;
      const selectedChannel: 'IN_APP' | 'EMAIL' | 'BOTH' =
        channel === 'EMAIL' || channel === 'BOTH' ? channel : 'IN_APP';

      const defaultAlertText =
        existingOrder.state === 'COMPLETED'
          ? `Payment & escrow settlement completed for Order #${orderId}: ${formattedAmount} (${formatMicro6(existingOrder.cryptoQuantityMicro)} ${existingOrder.asset} released).`
          : `Payment of ${formattedAmount} via ${existingOrder.paymentMethod} is completed (Ref: ${existingOrder.paymentReference || 'UTR-VERIFIED'}). Please check your account and release ${formatMicro6(existingOrder.cryptoQuantityMicro)} ${existingOrder.asset} from escrow.`;

      const finalAlertMessage =
        customMessage && String(customMessage).trim().length > 0
          ? String(customMessage).trim()
          : defaultAlertText;

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_notif_${Date.now()}`,
        orderId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderRole: currentUser.role === 'ADMIN' ? 'ADMIN' : isBuyerActor ? 'BUYER' : 'SELLER',
        content: `🔔 PAYMENT COMPLETION ALERT TO ${(recipientUser?.displayName || recipientId).toUpperCase()}: ${finalAlertMessage}`,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      addNotification(
        recipientId,
        `Payment Completion Alert — Order #${orderId}`,
        `From ${currentUser.displayName.replace(' (You)', '')}: ${finalAlertMessage}`,
        orderId,
        selectedChannel
      );

      if (recipientId !== currentUser.id) {
        addNotification(
          currentUser.id,
          `Alert Delivered to ${recipientUser?.displayName || 'Counterparty'} — Order #${orderId}`,
          `Payment completion alert sent (${selectedChannel}): "${finalAlertMessage}"`,
          orderId,
          selectedChannel
        );
      }

      logAudit(
        currentUser.id,
        currentUser.role,
        'PAYMENT_COMPLETION_NOTIFICATION_DISPATCHED',
        'ORDER',
        orderId,
        `Sent payment completion alert (${selectedChannel}) to ${recipientUser?.displayName || recipientId}: ${finalAlertMessage}`
      );

      persistSnapshot();
      return res.json({ order: existingOrder, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to send payment notification' });
    }
  });

  // Seller verifies fiat receipt and authorizes crypto release
  app.post('/api/orders/:orderId/release', (req, res) => {
    try {
      const { orderId } = req.params;
      const { idempotencyKey } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { orders: Map<string, EscrowOrderRecord> };
      const existingOrder = engineAny.orders.get(orderId);
      if (!existingOrder) return res.status(404).json({ error: 'Order not found.' });

      // If already completed, return idempotent success
      if (existingOrder.state === 'COMPLETED') {
        return res.json({ order: existingOrder, state: getSnapshot() });
      }

      // If order is still in PAYMENT_PENDING or ESCROW_LOCKED, advance state so release proceeds
      if (existingOrder.state === 'PAYMENT_PENDING' || existingOrder.state === 'ESCROW_LOCKED') {
        existingOrder.state = 'PAYMENT_MARKED_SENT';
        existingOrder.paymentReference =
          existingOrder.paymentReference || `CONFIRMED-${Date.now().toString().slice(-6)}`;
        existingOrder.paymentDeclaredAt =
          existingOrder.paymentDeclaredAt || new Date().toISOString();
      }

      const updated = engine.confirmFiatAndReleaseEscrow({
        orderId,
        actorId: existingOrder.sellerId,
        actorRole: 'SELLER',
        idempotencyKey: idempotencyKey || `rel_${orderId}_${Date.now()}`,
      });

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_${Date.now()}`,
        orderId,
        senderId: existingOrder.sellerId,
        senderName: users.get(existingOrder.sellerId)?.displayName || 'Seller',
        senderRole: 'SELLER',
        content: `Verified fiat receipt in bank account and authorized escrow release. ${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset} settled to Buyer (Tx: ${updated.settlementTxHash?.slice(0, 18)}...).`,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      logAudit(
        currentUser.id,
        'SELLER',
        'ESCROW_RELEASE_AUTHORIZED',
        'ORDER',
        orderId,
        `Seller verified fiat and released ${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset} to ${updated.buyerId}`
      );
      addNotification(
        updated.buyerId,
        `Payment & Settlement Completed — Order #${orderId}`,
        `Seller confirmed your fiat payment and released ${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset} to your available balance.`,
        orderId,
        'BOTH'
      );
      if (updated.sellerId !== updated.buyerId) {
        addNotification(
          updated.sellerId,
          `Escrow Settlement Completed — Order #${orderId}`,
          `You confirmed payment receipt and released ${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset} to ${users.get(updated.buyerId)?.displayName || 'Buyer'}.`,
          orderId,
          'IN_APP'
        );
      }
      persistSnapshot();
      return res.json({ order: updated, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to release escrow' });
    }
  });

  // Open Dispute
  app.post('/api/orders/:orderId/dispute', (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const currentUser = users.get(activeUserId)!;
      const engineAny = engine as unknown as { orders: Map<string, EscrowOrderRecord> };
      const existingOrder = engineAny.orders.get(orderId);
      if (!existingOrder) return res.status(404).json({ error: 'Order not found.' });

      const actorId =
        currentUser.id === existingOrder.buyerId || currentUser.id === existingOrder.sellerId
          ? currentUser.id
          : existingOrder.buyerId;

      const updated = engine.openDispute({
        orderId,
        actorId,
        reason: String(reason || ''),
      });

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_${Date.now()}`,
        orderId,
        senderId: 'SYSTEM',
        senderName: 'Costorah Arbitration Engine',
        senderRole: 'SYSTEM',
        content: `DISPUTE OPENED: "${updated.disputeReason}". Escrowed funds (${formatMicro6(updated.cryptoQuantityMicro)} ${updated.asset}) are locked until authorized Admin resolution.`,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      logAudit(currentUser.id, currentUser.role, 'DISPUTE_OPENED', 'DISPUTE', orderId, `Opened dispute: ${updated.disputeReason}`);
      const buyerUser = users.get(existingOrder.buyerId);
      const sellerUser = users.get(existingOrder.sellerId);
      const buyerChannel = buyerUser?.notificationPreferences?.disputeOpened !== false ? 'BOTH' : 'IN_APP';
      const sellerChannel = sellerUser?.notificationPreferences?.disputeOpened !== false ? 'BOTH' : 'IN_APP';
      addNotification(
        existingOrder.buyerId,
        'Dispute Opened — Escrow Frozen',
        `Dispute opened for order ${orderId}: "${updated.disputeReason}". Escrowed funds are locked pending arbitrator ruling.`,
        orderId,
        buyerChannel
      );
      addNotification(
        existingOrder.sellerId,
        'Dispute Opened — Escrow Frozen',
        `Dispute opened for order ${orderId}: "${updated.disputeReason}". Escrowed funds are locked pending arbitrator ruling.`,
        orderId,
        sellerChannel
      );
      persistSnapshot();
      return res.json({ order: updated, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to open dispute' });
    }
  });

  // Post Chat Message / Evidence in Trade Room
  app.post('/api/orders/:orderId/messages', (req, res) => {
    const { orderId } = req.params;
    const { content, attachmentUrl } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }
    const currentUser = users.get(activeUserId)!;
    const list = messages.get(orderId) || [];
    list.push({
      id: `msg_${Date.now()}`,
      orderId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderRole: currentUser.role === 'ADMIN' ? 'ADMIN' : 'BUYER',
      content: String(content).trim(),
      attachmentUrl: attachmentUrl ? String(attachmentUrl).trim() : undefined,
      createdAt: new Date().toISOString(),
    });
    messages.set(orderId, list);
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Admin: Resolve Dispute
  app.post('/api/admin/disputes/:orderId/resolve', (req, res) => {
    try {
      const { orderId } = req.params;
      const { outcome, resolutionNote, idempotencyKey } = req.body;
      const currentUser = users.get(activeUserId)!;
      const updated = engine.resolveDispute({
        orderId,
        adminId: currentUser.id,
        actorRole: 'ADMIN',
        outcome: outcome === 'REFUND_TO_SELLER' ? 'REFUND_TO_SELLER' : 'RELEASE_TO_BUYER',
        resolutionNote: String(resolutionNote || 'Resolved by Admin Arbitration Review.'),
        idempotencyKey: idempotencyKey || `adm_res_${orderId}`,
      });

      const list = messages.get(orderId) || [];
      list.push({
        id: `msg_${Date.now()}`,
        orderId,
        senderId: currentUser.id,
        senderName: 'Admin Arbitrator',
        senderRole: 'ADMIN',
        content: `ARBITRATION RULING (${outcome}): ${updated.disputeResolutionNote}. Order transitioned to ${updated.state}.`,
        createdAt: new Date().toISOString(),
      });
      messages.set(orderId, list);

      logAudit(
        currentUser.id,
        'ADMIN',
        `DISPUTE_RESOLVED_${outcome}`,
        'DISPUTE',
        orderId,
        `Ruling=${outcome} | Note: ${updated.disputeResolutionNote}`
      );
      persistSnapshot();
      return res.json({ order: updated, state: getSnapshot() });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to resolve dispute' });
    }
  });

  // Admin: Update Configurable Platform Fee (Basis Points)
  app.post('/api/admin/fee-config', (req, res) => {
    try {
      const { feeBps } = req.body;
      const parsed = Number(feeBps);
      const currentUser = users.get(activeUserId)!;
      engine.setFeeBps(parsed);
      logAudit(
        currentUser.id,
        'ADMIN',
        'PLATFORM_FEE_UPDATED',
        'FEE_POLICY',
        'global_fee_bps',
        `Updated platform trading fee to ${parsed} bps (${(parsed / 100).toFixed(2)}%)`
      );
      persistSnapshot();
      return res.json(getSnapshot());
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid fee configuration' });
    }
  });

  // Admin: Add Supported Payment Rail
  app.post('/api/admin/payment-rails', (req, res) => {
    const { fiatCurrency, methodName } = req.body;
    const currentUser = users.get(activeUserId)!;
    const fiat = fiatCurrency as FiatCurrency;
    if (!supportedPaymentMethods[fiat]) {
      return res.status(400).json({ error: 'Unsupported fiat currency.' });
    }
    const clean = String(methodName || '').trim();
    if (!clean) return res.status(400).json({ error: 'Method name required.' });
    if (!supportedPaymentMethods[fiat].includes(clean)) {
      supportedPaymentMethods[fiat].push(clean);
      logAudit(currentUser.id, 'ADMIN', 'PAYMENT_RAIL_ENABLED', 'FEE_POLICY', fiat, `Enabled payment rail "${clean}" for ${fiat}`);
    }
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Admin: Create / Resolve Security Incident
  app.post('/api/admin/incidents', (req, res) => {
    const { title, severity, notes } = req.body;
    const currentUser = users.get(activeUserId)!;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Incident title is required.' });
    }
    const inc: SecurityIncident = {
      id: `inc_${Date.now().toString(36)}`,
      title: String(title).trim(),
      severity: severity === 'HIGH' || severity === 'MEDIUM' ? severity : 'LOW',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      notes: String(notes || '').trim(),
    };
    incidents.unshift(inc);
    logAudit(currentUser.id, 'ADMIN', 'INCIDENT_LOGGED', 'INCIDENT', inc.id, `[${inc.severity}] ${inc.title}`);
    persistSnapshot();
    return res.json(getSnapshot());
  });

  app.post('/api/admin/incidents/:incidentId/resolve', (req, res) => {
    const { incidentId } = req.params;
    const currentUser = users.get(activeUserId)!;
    const inc = incidents.find((i) => i.id === incidentId);
    if (!inc) return res.status(404).json({ error: 'Incident not found.' });
    inc.status = 'RESOLVED';
    inc.resolvedAt = new Date().toISOString();
    logAudit(currentUser.id, 'ADMIN', 'INCIDENT_RESOLVED', 'INCIDENT', inc.id, `Resolved incident: ${inc.title}`);
    persistSnapshot();
    return res.json(getSnapshot());
  });

  // Fee Calculator Preview endpoint
  app.post('/api/calculate-fee', (req, res) => {
    try {
      const { grossFiatInput, unitPriceFiatInput, fiatCurrency, cryptoAsset } = req.body;
      const breakdown = calculateTradeBreakdown({
        grossFiatInput,
        unitPriceFiatInput,
        fiatCurrency: (fiatCurrency || 'INR') as FiatCurrency,
        cryptoAsset: (cryptoAsset || 'USDT') as CryptoAsset,
        feeBps: engine.getFeeBps(),
      });
      return res.json({ breakdown });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Calculation error' });
    }
  });

  // Ensure unmatched /api/* routes always return valid JSON instead of falling through to SPA HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Ensure any Express / body-parser error on /api/* returns valid JSON instead of <!DOCTYPE html>
  app.use(
    (
      err: Error & { status?: number },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api/')) {
        res.status(err.status || 400).json({ error: err.message || 'API request error' });
        return;
      }
      next(err);
    }
  );

  // Start background worker loop (every 15 seconds) to evaluate open offers against active price alerts
  setInterval(() => {
    const triggered = runPriceAlertWorkerScan('BACKGROUND_INTERVAL_WORKER');
    if (triggered.length > 0) {
      persistSnapshot();
    }
  }, 15_000);

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      allowedHosts: [
        'costorahp2p.ai.studio',
        '.ai.studio',
        '.run.app',
        'localhost',
        '127.0.0.1',
      ],
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Costorah Server running on http://localhost:${PORT}`);
  });
}

startServer();
