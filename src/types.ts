import {
  TOP_TRADING_COUNTRIES,
  COUNTRY_ORDER_LIST,
  getLockedFiatForCountry,
  isFiatAllowedForCountry,
  assertCountryFiatLock,
  calculateAdvertiserTrustScore,
  getOrderStatusBadgeDescriptor,
  calculateAutoUnitPriceFiat,
  getRecommendedOfferDefaults,
  calculateFiatFromCryptoQuantity,
  categorizeUserOrders,
  validateAndFormatBankAccount,
  validateBlockchainWalletAddress,
  verifyAdminCredentials,
  verifyUserCredentials,
  USD_REFERENCE_RATES,
  updateLiveReferenceRates,
  MAX_ORDER_USDT_CAP,
  DAILY_TRADING_LIMIT_USD,
  calculateMaxOrderCapMinor,
  calculateBinanceOrderLimits,
  calculateUserDailyLimitStatus,
  generateAuthenticatorSetup,
  normalizeOrderStatusForSoundTrigger,
  getSoundPingAcousticProfile,
  detectOrderStatusSoundEvents,
  SUPPORTED_SWAP_CHAINS,
  calculateCrossChainSwapQuote,
  validateSwapChainDestinationAddress,
  type CryptoAsset,
  type FiatCurrency,
  type CountryCode,
  type CountryTradingPolicy,
  type OrderState,
  type OfferRecord,
  type EscrowOrderRecord,
  type AssetBalance,
  type LedgerEntry,
  type WalletChallenge,
  type BlockchainNetworkFamily,
  type WalletValidationResult,
  type TradeFeeBreakdown,
  type PriceAlertRecord,
  type AdvertiserTrustMetrics,
  type OrderStatusBadgeDescriptor,
  type AutoPriceCalculationResult,
  type BinanceOrderLimitsResult,
  type UserDailyTradingLimitStatus,
  type AuthenticatorSetupDescriptor,
  type RecommendedOfferDefaults,
  type CategorizedUserOrders,
  type RegisteredBankAccount,
  type SoundNotificationTrigger,
  type SoundPingAcousticProfile,
  type OrderSoundNotificationEvent,
  type SwapChainId,
  type SwapChainMetadata,
  type CrossChainSwapQuote,
  type SwapExecutionRecord,
} from './core/escrowEngine';

export {
  TOP_TRADING_COUNTRIES,
  COUNTRY_ORDER_LIST,
  getLockedFiatForCountry,
  isFiatAllowedForCountry,
  assertCountryFiatLock,
  calculateAdvertiserTrustScore,
  getOrderStatusBadgeDescriptor,
  calculateAutoUnitPriceFiat,
  getRecommendedOfferDefaults,
  calculateFiatFromCryptoQuantity,
  categorizeUserOrders,
  validateAndFormatBankAccount,
  validateBlockchainWalletAddress,
  verifyAdminCredentials,
  verifyUserCredentials,
  USD_REFERENCE_RATES,
  updateLiveReferenceRates,
  MAX_ORDER_USDT_CAP,
  DAILY_TRADING_LIMIT_USD,
  calculateMaxOrderCapMinor,
  calculateBinanceOrderLimits,
  calculateUserDailyLimitStatus,
  generateAuthenticatorSetup,
  normalizeOrderStatusForSoundTrigger,
  getSoundPingAcousticProfile,
  detectOrderStatusSoundEvents,
  SUPPORTED_SWAP_CHAINS,
  calculateCrossChainSwapQuote,
  validateSwapChainDestinationAddress,
};

export type {
  CryptoAsset,
  FiatCurrency,
  CountryCode,
  CountryTradingPolicy,
  OrderState,
  OfferRecord,
  EscrowOrderRecord,
  AssetBalance,
  LedgerEntry,
  WalletChallenge,
  BlockchainNetworkFamily,
  WalletValidationResult,
  TradeFeeBreakdown,
  PriceAlertRecord,
  AdvertiserTrustMetrics,
  OrderStatusBadgeDescriptor,
  AutoPriceCalculationResult,
  BinanceOrderLimitsResult,
  UserDailyTradingLimitStatus,
  AuthenticatorSetupDescriptor,
  RecommendedOfferDefaults,
  CategorizedUserOrders,
  RegisteredBankAccount,
  SoundNotificationTrigger,
  SoundPingAcousticProfile,
  OrderSoundNotificationEvent,
  SwapChainId,
  SwapChainMetadata,
  CrossChainSwapQuote,
  SwapExecutionRecord,
};

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
  accountIdentifier: string;
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

export interface PriceAlertWorkerStatus {
  lastRunAt: string;
  totalScans: number;
  triggeredCount: number;
  intervalSeconds: number;
}

export interface MarketTweetComment {
  id: string;
  tweetId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  content: string;
  createdAt: string;
}

export interface MarketTweetOrderAttachment {
  offerId?: string;
  orderId?: string;
  side: 'BUY' | 'SELL';
  asset: CryptoAsset;
  fiatCurrency: FiatCurrency;
  unitPriceFormatted: string;
  quantityFormatted: string;
  minOrderFormatted: string;
  maxOrderFormatted: string;
  paymentMethods: string[];
}

export interface MarketTweetRecord {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  authorVerified: boolean;
  authorReputationScore: number;
  content: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ORDER_ALERT';
  taggedAssets: CryptoAsset[];
  taggedUserHandles: string[];
  imageUrl?: string;
  imageCaption?: string;
  orderAttachment?: MarketTweetOrderAttachment;
  likedByUserIds: string[];
  retweetedByUserIds: string[];
  retweetOfId?: string;
  retweetedByName?: string;
  retweetedByHandle?: string;
  comments: MarketTweetComment[];
  createdAt: string;
}

export interface AppStateSnapshot {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  balances: AssetBalance[];
  offers: OfferRecord[];
  orders: EscrowOrderRecord[];
  messages: Record<string, TradeMessage[]>;
  ledgerEntries: LedgerEntry[];
  auditLogs: AuditEvent[];
  incidents: SecurityIncident[];
  notifications: NotificationItem[];
  priceAlerts: PriceAlertRecord[];
  workerStatus: PriceAlertWorkerStatus;
  feeBps: number;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  swapHistory?: SwapExecutionRecord[];
  marketTweets?: MarketTweetRecord[];
  reconciliation: {
    isValid: boolean;
    totalUsersChecked: number;
    discrepancies: string[];
  };
}

export type AppRoute =
  | 'home'
  | 'marketplace'
  | 'swap'
  | 'pulse'
  | 'create-offer'
  | 'orders'
  | 'dashboard'
  | 'trade-room'
  | 'info'
  | 'admin';

export const FIAT_SYMBOLS: Record<FiatCurrency, string> = {
  INR: '₹',
  USD: '$',
  TRY: '₺',
  IRR: 'Rl ',
  NGN: '₦',
  EUR: '€',
  GBP: '£',
  BRL: 'R$',
  AED: 'Dh ',
  VND: '₫',
};

export const ALL_FIAT_CURRENCIES: FiatCurrency[] = [
  'INR',
  'USD',
  'TRY',
  'IRR',
  'NGN',
  'EUR',
  'GBP',
  'BRL',
  'AED',
  'VND',
];

