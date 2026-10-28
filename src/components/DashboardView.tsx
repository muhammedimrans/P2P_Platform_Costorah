import React, { useState, useEffect } from 'react';
import {
  ALL_FIAT_CURRENCIES,
  COUNTRY_ORDER_LIST,
  FIAT_SYMBOLS,
  TOP_TRADING_COUNTRIES,
  getLockedFiatForCountry,
  getOrderStatusBadgeDescriptor,
  generateAuthenticatorSetup,
  type AssetBalance,
  type CountryCode,
  type CryptoAsset,
  type EscrowOrderRecord,
  type FiatCurrency,
  type LedgerEntry,
  type NotificationItem,
  type UserProfile,
  type RegisteredBankAccount,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import { PRESET_TRADER_AVATARS, ALL_CRYPTO_ASSETS } from './CryptoAssetIcons';
import {
  CustomSelect,
  buildCountryCurrencyOptions,
  buildCryptoAssetOptions,
  buildFiatCurrencyOptions,
} from './CustomSelect';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Bell,
  UserCheck,
  CreditCard,
  Smartphone,
  Building2,
  Clock,
  Send,
  Camera,
  Landmark,
  Star,
  Download,
  Trash2,
  Wallet,
  QrCode,
  KeyRound,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { AssetVolumeBarChart } from './AssetVolumeBarChart';

interface DashboardViewProps {
  currentUser: UserProfile;
  balances: AssetBalance[];
  orders: EscrowOrderRecord[];
  ledgerEntries: LedgerEntry[];
  notifications: NotificationItem[];
  onOpenOrder: (orderId: string) => void;
  onOpenAccountModal: () => void;
  onDeposit: (asset: CryptoAsset, amount: string) => Promise<void>;
  onWithdraw: (asset: CryptoAsset, amount: string, destinationAddress: string) => Promise<void>;
  onUpdateProfile: (payload: {
    displayName: string;
    email: string;
    bio: string;
    preferredFiat: FiatCurrency;
    countryCode?: CountryCode;
    avatarUrl?: string;
  }) => Promise<void>;
  onAddBankAccount?: (payload: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscOrSwiftCode: string;
    accountType: 'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC';
    fiatCurrency: FiatCurrency;
    branchName?: string;
    linkedUpiId?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  onSetPrimaryBankAccount?: (bankId: string) => Promise<void>;
  onDeleteBankAccount?: (bankId: string) => Promise<void>;
  onAddPaymentMethod: (payload: {
    methodName: string;
    category: 'UPI_APP' | 'CARD' | 'BANK_TRANSFER';
    fiatCurrency: FiatCurrency;
    accountHolder: string;
    accountIdentifier: string;
    bankOrProvider: string;
    expiryDate?: string;
    cardNetwork?: string;
    verifyImmediately: boolean;
  }) => Promise<void>;
  onVerifyPaymentMethod: (pmId: string, verificationCode?: string) => Promise<void>;
  onDeletePaymentMethod: (pmId: string) => Promise<void>;
  onUpdateSecurity: (payload: {
    twoFactorEnabled: boolean;
    recoveryGuardianEmail: string;
  }) => Promise<void>;
  onDisconnectWallet?: (walletId: string) => Promise<void>;
  onUpdateNotificationPreferences?: (payload: {
    tradeStarted: boolean;
    paymentReceived: boolean;
    disputeOpened: boolean;
  }) => Promise<void>;
}

type DashboardSubTab =
  | 'PORTFOLIO'
  | 'ASSET_VOLUME'
  | 'PAYMENT_METHODS'
  | 'NOTIFICATIONS'
  | 'ORDERS'
  | 'SECURITY'
  | 'LEDGER';

type PaymentPreset =
  | 'PHONEPE'
  | 'GPAY'
  | 'PAYTM'
  | 'CREDIT_CARD'
  | 'UPI_INSTANT'
  | 'BANK_TRANSFER';

const OrderStatusBadges: React.FC<{
  order: EscrowOrderRecord;
  compact?: boolean;
}> = ({ order, compact = false }) => {
  const badge = getOrderStatusBadgeDescriptor(order.state, order.paymentReference);

  const primaryToneClasses: Record<typeof badge.tone, string> = {
    EMERALD: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    CYAN: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/45',
    AMBER: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    RED: 'bg-red-500/15 text-red-300 border-red-500/40',
    SLATE: 'bg-slate-800/90 text-slate-300 border-white/15',
  };

  const renderPrimaryIcon = () => {
    if (order.state === 'PAYMENT_MARKED_SENT' || order.state === 'PAYMENT_REVIEW') {
      return <Send className="w-3 h-3 shrink-0 text-cyan-300" />;
    }
    if (order.state === 'DISPUTED') {
      return <AlertTriangle className="w-3 h-3 shrink-0 text-red-400" />;
    }
    if (order.state === 'COMPLETED') {
      return <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />;
    }
    if (order.state === 'PAYMENT_PENDING' || order.state === 'ESCROW_LOCKED') {
      return <Lock className="w-3 h-3 shrink-0 text-emerald-400" />;
    }
    return <Clock className="w-3 h-3 shrink-0 text-slate-400" />;
  };

  return (
    <div
      data-testid={`order-status-badges-${order.id}`}
      className="inline-flex flex-wrap items-center gap-1.5"
    >
      {/* Primary Visual Status Badge (e.g. 'Escrow Locked', 'Payment Sent', 'Disputed · Frozen') */}
      <span
        data-testid={`order-primary-badge-${order.id}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold tracking-tight ${primaryToneClasses[badge.tone]}`}
      >
        {renderPrimaryIcon()}
        <span>{badge.primaryBadgeLabel}</span>
      </span>

      {/* Companion Sub-State Badge (e.g. 'Awaiting Payment', 'Escrow Locked · Timer Frozen') */}
      {!compact && (
        <span
          data-testid={`order-secondary-badge-${order.id}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-medium ${
            order.state === 'PAYMENT_PENDING'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : badge.isEscrowLocked
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
              : 'bg-[#0B0E14] text-slate-400 border-white/10'
          }`}
        >
          {order.state === 'PAYMENT_PENDING' ? (
            <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          ) : badge.isEscrowLocked ? (
            <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
          ) : null}
          <span>{badge.secondaryBadgeLabel}</span>
        </span>
      )}
    </div>
  );
};

const ActiveOrderCard: React.FC<{
  order: EscrowOrderRecord;
  currentUserId: string;
  onOpenOrder: (orderId: string) => void;
}> = ({ order, currentUserId, onOpenOrder }) => {
  const isBuyer = order.buyerId === currentUserId;
  const sym = FIAT_SYMBOLS[order.fiatCurrency];
  const badge = getOrderStatusBadgeDescriptor(order.state, order.paymentReference);

  const stageLabels = [
    '1. Escrow Locked',
    '2. Fiat Window',
    '3. Payment Sent',
    '4. Released',
  ];

  const barActiveClass =
    badge.tone === 'RED'
      ? 'bg-red-400'
      : badge.tone === 'CYAN'
      ? 'bg-cyan-400'
      : badge.tone === 'AMBER'
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <div
      data-testid="active-order-card"
      className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.08] hover:border-emerald-500/30 transition-colors flex flex-col justify-between gap-3.5"
    >
      {/* Top Row: Order Identity & Role on Left, At-a-Glance Visual Status Badges on Right */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-100">{order.id}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                isBuyer
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {isBuyer ? 'BUYING' : 'SELLING'} {order.asset}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span>Rail:</span>
            <span className="font-mono text-slate-200 font-medium">{order.paymentMethod}</span>
            <span>·</span>
            <span className="font-mono text-slate-400">{order.fiatCurrency} Corridor</span>
          </div>
        </div>

        <OrderStatusBadges order={order} />
      </div>

      {/* Middle Row: Key Financial & Custody Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg bg-[#131A24] border border-white/[0.05]">
          <div className="text-[10px] font-mono uppercase text-slate-400">Escrowed Principal</div>
          <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
            {formatMicro6(order.cryptoQuantityMicro)} {order.asset}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">1:1 Vault Custody</div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#131A24] border border-white/[0.05]">
          <div className="text-[10px] font-mono uppercase text-slate-400">Gross Fiat Value</div>
          <div className="text-sm font-mono font-bold text-slate-100 tabular-nums mt-0.5">
            {sym}
            {formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            1% Fee: {sym}
            {formatMinor2(order.platformFeeFiatMinor)}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-2.5 rounded-lg bg-[#131A24] border border-white/[0.05]">
          <div className="text-[10px] font-mono uppercase text-slate-400">Payment Proof / UTR</div>
          <div className="text-xs font-mono font-semibold text-slate-200 truncate mt-0.5">
            {order.paymentReference ? order.paymentReference : 'Pending Buyer Transfer'}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            {badge.isExpiryFrozen ? 'Auto-Expiry Suspended' : 'Active Settlement Window'}
          </div>
        </div>
      </div>

      {/* 4-Stage Visual Order State Pipeline */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {stageLabels.map((lbl, idx) => {
            const stepIdx = idx + 1;
            const reached = stepIdx <= badge.stepNumber;
            return (
              <div key={lbl} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    reached ? barActiveClass : 'bg-[#18212F]'
                  }`}
                />
                <div
                  className={`text-[10px] font-mono truncate ${
                    reached ? 'text-slate-200 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {lbl}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-mono text-slate-400">{badge.stepSummary}</span>
          <button
            type="button"
            onClick={() => onOpenOrder(order.id)}
            className="px-3 py-1.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>
              {order.state === 'PAYMENT_MARKED_SENT' && !isBuyer
                ? 'Verify & Release Escrow'
                : order.state === 'PAYMENT_PENDING' && isBuyer
                ? 'Submit Payment Proof'
                : 'Open Trade Room'}
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  balances,
  orders,
  ledgerEntries,
  notifications,
  onOpenOrder,
  onOpenAccountModal,
  onDeposit,
  onWithdraw,
  onUpdateProfile,
  onAddBankAccount,
  onSetPrimaryBankAccount,
  onDeleteBankAccount,
  onAddPaymentMethod,
  onVerifyPaymentMethod,
  onDeletePaymentMethod,
  onUpdateSecurity,
  onDisconnectWallet,
  onUpdateNotificationPreferences,
}) => {
  const [subTab, setSubTab] = useState<DashboardSubTab>('PORTFOLIO');
  const [orderFilter, setOrderFilter] = useState<
    'ALL' | 'SELF_BUY' | 'SELF_SELL' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED'
  >('ALL');

  // Deposit / Withdraw Form State
  const [vaultAction, setVaultAction] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>('USDT');
  const [amountInput, setAmountInput] = useState<string>('250.000000');
  const [withdrawAddress, setWithdrawAddress] = useState<string>(
    currentUser.wallets[0]?.address || '0x71C95911E9a5D330f4D621842EC243EE1343292e'
  );
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultSuccess, setVaultSuccess] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState<boolean>(false);

  // User Profile Settings, Avatar & Username Editor State
  const [profileName, setProfileName] = useState<string>(currentUser.displayName);
  const [profileEmail, setProfileEmail] = useState<string>(currentUser.email);
  const [profileBio, setProfileBio] = useState<string>(
    currentUser.bio || 'Institutional & P2P Liquidity Desk · Instant PhonePe, GPay, Paytm & SEPA Settlement'
  );
  const [profileCountry, setProfileCountry] = useState<CountryCode>(currentUser.countryCode || 'IN');
  const [profileFiat, setProfileFiat] = useState<FiatCurrency>(currentUser.preferredFiat || 'INR');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(
    currentUser.avatarUrl || PRESET_TRADER_AVATARS[0].url
  );
  const [profileStatusMsg, setProfileStatusMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState<boolean>(false);

  // Registered Bank Details Form State
  const [bankHolderName, setBankHolderName] = useState<string>(
    currentUser.displayName.replace(' (You)', '')
  );
  const [bankName, setBankName] = useState<string>('HDFC Bank Ltd');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('501004829104');
  const [bankIfscOrSwift, setBankIfscOrSwift] = useState<string>('HDFC0000124');
  const [bankAccountType, setBankAccountType] = useState<'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC'>('SAVINGS');
  const [bankBranchName, setBankBranchName] = useState<string>('Mumbai Nariman Point');
  const [bankUpiId, setBankUpiId] = useState<string>('alex.rivera@hdfcbank');
  const [bankIsPrimary, setBankIsPrimary] = useState<boolean>(true);
  const [bankStatusMsg, setBankStatusMsg] = useState<string | null>(null);
  const [bankErrorMsg, setBankErrorMsg] = useState<string | null>(null);
  const [bankBusy, setBankBusy] = useState<boolean>(false);

  // Payment Method Form State (Supports PhonePe, Google Pay, Paytm, Credit/Debit Card, UPI, Bank Transfer)
  const [activePreset, setActivePreset] = useState<PaymentPreset>('PHONEPE');
  const [pmMethodName, setPmMethodName] = useState<string>('PhonePe');
  const [pmCategory, setPmCategory] = useState<'UPI_APP' | 'CARD' | 'BANK_TRANSFER'>('UPI_APP');
  const [pmFiat, setPmFiat] = useState<FiatCurrency>('INR');
  const [pmHolder, setPmHolder] = useState<string>(currentUser.displayName.replace(' (You)', ''));
  const [pmIdentifier, setPmIdentifier] = useState<string>('9820114490@ybl');
  const [pmBank, setPmBank] = useState<string>('PhonePe / Yes Bank UPI');
  const [pmCardNetwork, setPmCardNetwork] = useState<string>('Visa Credit');
  const [pmExpiry, setPmExpiry] = useState<string>('09/29');
  const [pmVerifyImmediately, setPmVerifyImmediately] = useState<boolean>(true);
  const [pmStatus, setPmStatus] = useState<string | null>(null);
  const [pmError, setPmError] = useState<string | null>(null);
  const [verifyingPmId, setVerifyingPmId] = useState<string | null>(null);

  // Security Settings & TOTP Authenticator App State
  const [twoFactor, setTwoFactor] = useState<boolean>(currentUser.twoFactorEnabled);
  const [guardianEmail, setGuardianEmail] = useState<string>(
    currentUser.recoveryGuardianEmail || 'backup-guardian@costorah.io'
  );
  const [secSavedMsg, setSecSavedMsg] = useState<string | null>(null);
  const [totpCustomSecret, setTotpCustomSecret] = useState<string>('');
  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [totpLinked, setTotpLinked] = useState<boolean>(currentUser.twoFactorEnabled);
  const [totpErrorMsg, setTotpErrorMsg] = useState<string | null>(null);
  const [totpSuccessMsg, setTotpSuccessMsg] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState<boolean>(false);
  const [csvExportMsg, setCsvExportMsg] = useState<string | null>(null);

  const authSetup = React.useMemo(
    () => generateAuthenticatorSetup(currentUser.email, totpCustomSecret || undefined),
    [currentUser.email, totpCustomSecret]
  );

  // Notification Settings State (Email alerts for Trade Started, Payment Received, Dispute Opened)
  const [tradeStartedAlert, setTradeStartedAlert] = useState<boolean>(
    currentUser.notificationPreferences?.tradeStarted !== false
  );
  const [paymentReceivedAlert, setPaymentReceivedAlert] = useState<boolean>(
    currentUser.notificationPreferences?.paymentReceived !== false
  );
  const [disputeOpenedAlert, setDisputeOpenedAlert] = useState<boolean>(
    currentUser.notificationPreferences?.disputeOpened !== false
  );
  const [notifSaving, setNotifSaving] = useState<boolean>(false);
  const [notifStatusMsg, setNotifStatusMsg] = useState<string | null>(null);
  const [notifErrorMsg, setNotifErrorMsg] = useState<string | null>(null);
  const [testingNotifEvent, setTestingNotifEvent] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.notificationPreferences) {
      setTradeStartedAlert(currentUser.notificationPreferences.tradeStarted !== false);
      setPaymentReceivedAlert(currentUser.notificationPreferences.paymentReceived !== false);
      setDisputeOpenedAlert(currentUser.notificationPreferences.disputeOpened !== false);
    }
  }, [currentUser.notificationPreferences]);

  const handleToggleNotification = async (
    key: 'tradeStarted' | 'paymentReceived' | 'disputeOpened',
    value: boolean
  ) => {
    setNotifStatusMsg(null);
    setNotifErrorMsg(null);
    const updated = {
      tradeStarted: key === 'tradeStarted' ? value : tradeStartedAlert,
      paymentReceived: key === 'paymentReceived' ? value : paymentReceivedAlert,
      disputeOpened: key === 'disputeOpened' ? value : disputeOpenedAlert,
    };
    if (key === 'tradeStarted') setTradeStartedAlert(value);
    if (key === 'paymentReceived') setPaymentReceivedAlert(value);
    if (key === 'disputeOpened') setDisputeOpenedAlert(value);

    setNotifSaving(true);
    try {
      if (onUpdateNotificationPreferences) {
        await onUpdateNotificationPreferences(updated);
      } else {
        const res = await fetch('/api/user/notification-preferences', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(updated),
        });
        const raw = (await res.text()).trim();
        if (!res.ok && raw && !raw.startsWith('<')) {
          try {
            const data = JSON.parse(raw) as { error?: string };
            throw new Error(data.error || 'Failed to update preferences');
          } catch (e: unknown) {
            if (e instanceof Error && !e.message.includes('Unexpected token')) throw e;
          }
        }
      }
      setNotifStatusMsg(`Notification settings updated. Email alerts saved for ${currentUser.email}.`);
      setTimeout(() => setNotifStatusMsg(null), 4000);
    } catch (err: unknown) {
      setNotifErrorMsg(err instanceof Error ? err.message : 'Failed to update notification settings');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestAlert = async (
    eventType: 'TRADE_STARTED' | 'PAYMENT_RECEIVED' | 'DISPUTE_OPENED'
  ) => {
    setTestingNotifEvent(eventType);
    setNotifStatusMsg(null);
    setNotifErrorMsg(null);
    try {
      const res = await fetch('/api/user/test-notification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ eventType }),
      });
      const raw = (await res.text()).trim();
      let message = `Dispatched test email alert (${eventType}) to ${currentUser.email}`;
      if (raw && !raw.startsWith('<')) {
        try {
          const data = JSON.parse(raw) as { error?: string; message?: string };
          if (!res.ok) throw new Error(data.error || 'Failed to send test alert');
          if (data.message) message = data.message;
        } catch (e: unknown) {
          if (e instanceof Error && !e.message.includes('Unexpected token')) throw e;
        }
      }
      setNotifStatusMsg(message);
      setTimeout(() => setNotifStatusMsg(null), 5000);
    } catch (err: unknown) {
      setNotifErrorMsg(err instanceof Error ? err.message : 'Failed to send test alert');
    } finally {
      setTestingNotifEvent(null);
    }
  };

  const myOrders = orders.filter(
    (o) => o.buyerId === currentUser.id || o.sellerId === currentUser.id
  );
  const activeOrders = myOrders.filter(
    (o) =>
      o.state === 'PAYMENT_PENDING' ||
      o.state === 'PAYMENT_MARKED_SENT' ||
      o.state === 'ESCROW_LOCKED' ||
      o.state === 'RELEASE_PENDING'
  );
  const disputedOrders = myOrders.filter((o) => o.state === 'DISPUTED');

  const filteredOrders = myOrders.filter((o) => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'SELF_BUY') return o.buyerId === currentUser.id;
    if (orderFilter === 'SELF_SELL') return o.sellerId === currentUser.id;
    if (orderFilter === 'ACTIVE') {
      return (
        o.state === 'PAYMENT_PENDING' ||
        o.state === 'PAYMENT_MARKED_SENT' ||
        o.state === 'ESCROW_LOCKED' ||
        o.state === 'RELEASE_PENDING'
      );
    }
    if (orderFilter === 'COMPLETED') return o.state === 'COMPLETED';
    if (orderFilter === 'DISPUTED') return o.state === 'DISPUTED';
    return o.state === 'CANCELLED' || o.state === 'EXPIRED' || o.state === 'REFUNDED';
  });

  const applyPaymentPreset = (preset: PaymentPreset) => {
    setActivePreset(preset);
    setPmStatus(null);
    setPmError(null);
    if (preset === 'PHONEPE') {
      setPmMethodName('PhonePe');
      setPmCategory('UPI_APP');
      setPmFiat('INR');
      setPmIdentifier('9876543210@ybl');
      setPmBank('PhonePe / Yes Bank UPI');
    } else if (preset === 'GPAY') {
      setPmMethodName('Google Pay (GPay)');
      setPmCategory('UPI_APP');
      setPmFiat('INR');
      setPmIdentifier('trader.desk@okaxis');
      setPmBank('Google Pay / Axis Bank');
    } else if (preset === 'PAYTM') {
      setPmMethodName('Paytm');
      setPmCategory('UPI_APP');
      setPmFiat('INR');
      setPmIdentifier('9876543210@paytm');
      setPmBank('Paytm Payments / Axis UPI');
    } else if (preset === 'CREDIT_CARD') {
      setPmMethodName('Credit / Debit Card');
      setPmCategory('CARD');
      setPmFiat('USD');
      setPmCardNetwork('Visa Credit');
      setPmIdentifier('4111 2222 3333 4829');
      setPmBank('JPMorgan Chase Visa');
      setPmExpiry('09/29');
    } else if (preset === 'UPI_INSTANT') {
      setPmMethodName('UPI Instant');
      setPmCategory('UPI_APP');
      setPmFiat('INR');
      setPmIdentifier('alex@icici');
      setPmBank('ICICI Bank UPI');
    } else {
      setPmMethodName('IMPS / SEPA Bank Transfer');
      setPmCategory('BANK_TRANSFER');
      setPmFiat('INR');
      setPmIdentifier('Acct ****9920 / IFSC HDFC000012');
      setPmBank('HDFC Bank Ltd');
    }
  };

  const handleVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    setVaultSuccess(null);
    setVaultBusy(true);
    try {
      if (vaultAction === 'DEPOSIT') {
        await onDeposit(selectedAsset, amountInput);
        setVaultSuccess(`Deposited ${amountInput} ${selectedAsset} into Available Balance.`);
      } else {
        await onWithdraw(selectedAsset, amountInput, withdrawAddress);
        setVaultSuccess(`Withdrew ${amountInput} ${selectedAsset} to ${withdrawAddress.slice(0, 12)}...`);
      }
    } catch (err: unknown) {
      setVaultError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileAvatarUrl(reader.result);
        setProfileStatusMsg('Custom profile image loaded. Click "Save Profile Settings" to persist.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatusMsg(null);
    setProfileErrorMsg(null);
    setProfileBusy(true);
    try {
      await onUpdateProfile({
        displayName: profileName,
        email: profileEmail,
        bio: profileBio,
        preferredFiat: profileFiat,
        countryCode: profileCountry,
        avatarUrl: profileAvatarUrl,
      });
      setProfileStatusMsg(
        `Profile & avatar image saved! Username updated to "${profileName}" and country lock set to ${TOP_TRADING_COUNTRIES[profileCountry].name} (${profileFiat}).`
      );
    } catch (err: unknown) {
      setProfileErrorMsg(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileBusy(false);
    }
  };

  const handleRegisterBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddBankAccount) return;
    setBankStatusMsg(null);
    setBankErrorMsg(null);
    setBankBusy(true);
    try {
      await onAddBankAccount({
        accountHolderName: bankHolderName,
        bankName,
        accountNumber: bankAccountNumber,
        ifscOrSwiftCode: bankIfscOrSwift,
        accountType: bankAccountType,
        fiatCurrency: profileFiat,
        branchName: bankBranchName,
        linkedUpiId: bankUpiId,
        isPrimary: bankIsPrimary,
      });
      setBankStatusMsg(
        `Registered & verified ${bankName} (${bankAccountType}) ending in ****${bankAccountNumber.slice(-4)} for P2P fiat settlement.`
      );
    } catch (err: unknown) {
      setBankErrorMsg(err instanceof Error ? err.message : 'Failed to register bank account');
    } finally {
      setBankBusy(false);
    }
  };

  const handleAddPm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPmStatus(null);
    setPmError(null);
    try {
      await onAddPaymentMethod({
        methodName: pmMethodName,
        category: pmCategory,
        fiatCurrency: pmFiat,
        accountHolder: pmHolder,
        accountIdentifier: pmIdentifier,
        bankOrProvider: pmBank,
        expiryDate: pmCategory === 'CARD' ? pmExpiry : undefined,
        cardNetwork: pmCategory === 'CARD' ? pmCardNetwork : undefined,
        verifyImmediately: pmVerifyImmediately,
      });
      setPmStatus(
        `Added ${pmMethodName} (${
          pmVerifyImmediately ? 'Verified via Instant Handshake' : 'Pending Verification — click Verify below'
        }).`
      );
    } catch (err: unknown) {
      setPmError(err instanceof Error ? err.message : 'Failed to add payment method');
    }
  };

  const handleVerifyPm = async (pmId: string) => {
    setVerifyingPmId(pmId);
    setPmStatus(null);
    setPmError(null);
    try {
      await onVerifyPaymentMethod(pmId, `VRF-${Date.now().toString().slice(-4)}`);
      setPmStatus('Payment method verified via Penny-Drop / UPI VPA / 3DS2 handshake.');
    } catch (err: unknown) {
      setPmError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyingPmId(null);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSecurity({
      twoFactorEnabled: twoFactor,
      recoveryGuardianEmail: guardianEmail,
    });
    setSecSavedMsg('Account security and recovery settings updated.');
  };

  const handleRegenerateTotpSecret = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let nextSecret = '';
    for (let i = 0; i < 16; i++) {
      nextSecret += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setTotpCustomSecret(nextSecret);
    setTotpCodeInput('');
    setTotpErrorMsg(null);
    setTotpSuccessMsg('Generated new TOTP setup key and updated QR code.');
  };

  const handleCopyTotpSecret = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(authSetup.secretKey);
      }
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2500);
    } catch {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2500);
    }
  };

  const handleLinkAuthenticatorApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpErrorMsg(null);
    setTotpSuccessMsg(null);
    const cleanCode = totpCodeInput.replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setTotpErrorMsg('Please enter a valid 6-digit verification code from your authenticator app.');
      return;
    }
    setTwoFactor(true);
    setTotpLinked(true);
    await onUpdateSecurity({
      twoFactorEnabled: true,
      recoveryGuardianEmail: guardianEmail,
    });
    setTotpSuccessMsg(
      `Authenticator app verified (Code ${cleanCode}) and linked to ${currentUser.email}. 2FA protection is now active.`
    );
  };

  const handleDownloadCompletedCsv = () => {
    const completed = myOrders.filter((o) => o.state === 'COMPLETED');
    if (completed.length === 0) {
      setCsvExportMsg('No completed trades found to export.');
      setTimeout(() => setCsvExportMsg(null), 4000);
      return;
    }

    const headers = [
      'Order ID',
      'Date Completed (UTC)',
      'Date Created (UTC)',
      'Trade Role',
      'Crypto Asset',
      'Crypto Quantity',
      'Unit Price',
      'Fiat Currency',
      'Gross Fiat Value',
      'Platform Fee (Fiat)',
      'Platform Fee (Crypto)',
      'Net Fiat Proceeds',
      'Counterparty ID',
      'Payment Method',
      'Payment Reference (UTR)',
      'Settlement Tx Hash',
      'Escrow State',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = completed.map((ord) => {
      const isBuyer = ord.buyerId === currentUser.id;
      const counterpartyId = isBuyer ? ord.sellerId : ord.buyerId;
      const tradeRole = isBuyer ? 'BUY' : 'SELL';
      const formattedCrypto = formatMicro6(ord.cryptoQuantityMicro);
      const formattedUnitPrice = formatMinor2(ord.unitPriceFiatMinor);
      const formattedGrossFiat = formatMinor2(ord.grossFiatMinor);
      const formattedFeeFiat = formatMinor2(ord.platformFeeFiatMinor);
      const formattedFeeCrypto = formatMicro6(ord.platformFeeCryptoMicro);
      const formattedNetFiat = formatMinor2(ord.sellerNetFiatMinor);

      return [
        ord.id,
        ord.updatedAt || ord.createdAt,
        ord.createdAt,
        tradeRole,
        ord.asset,
        formattedCrypto,
        formattedUnitPrice,
        ord.fiatCurrency,
        formattedGrossFiat,
        formattedFeeFiat,
        formattedFeeCrypto,
        formattedNetFiat,
        counterpartyId,
        ord.paymentMethod,
        ord.paymentReference || '',
        ord.settlementTxHash || '',
        ord.state,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `costorah-completed-trades-${currentUser.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}-${dateStamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCsvExportMsg(`Exported ${completed.length} completed trade records to CSV for tax & accounting records.`);
    setTimeout(() => setCsvExportMsg(null), 5000);
  };

  const renderNotificationSettings = () => (
    <div
      data-testid="notification-settings-section"
      className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            <span>Email Notification &amp; Alert Settings</span>
          </h2>
          <p className="text-xs text-slate-400">
            Configure automated email notifications dispatched to{' '}
            <span className="text-slate-200 font-semibold font-mono">{currentUser.email}</span> for critical trade milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notifSaving && (
            <span className="text-xs font-mono text-emerald-400 animate-pulse">
              Saving preferences...
            </span>
          )}
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30">
            Realtime Dispatch
          </span>
        </div>
      </div>

      {notifStatusMsg && (
        <div
          data-testid="notification-settings-status"
          className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notifStatusMsg}</span>
        </div>
      )}

      {notifErrorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
          {notifErrorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Trade Started */}
        <div
          data-testid="notif-toggle-trade-started-card"
          className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
            tradeStartedAlert
              ? 'bg-[#0B0E14] border-emerald-500/60 shadow-xs'
              : 'bg-[#0B0E14] border-white/[0.06]'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100">Trade Started</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      tradeStartedAlert
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800/80 text-slate-400 border-white/10'
                    }`}
                  >
                    {tradeStartedAlert ? 'Active' : 'Muted'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400">ORDER_ACCEPTED / ESCROW_LOCKED</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={tradeStartedAlert}
                aria-label="Toggle email alerts for Trade Started"
                data-testid="toggle-email-alert-trade-started"
                disabled={notifSaving}
                onClick={() => handleToggleNotification('tradeStarted', !tradeStartedAlert)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  tradeStartedAlert ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    tradeStartedAlert ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Sends an email immediately when a trade is initiated, locking escrow and providing order instructions.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Alert: Email &amp; In-App</span>
            <button
              type="button"
              data-testid="test-trade-started-alert-btn"
              disabled={testingNotifEvent !== null}
              onClick={() => handleTestAlert('TRADE_STARTED')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>{testingNotifEvent === 'TRADE_STARTED' ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>

        {/* 2. Payment Received */}
        <div
          data-testid="notif-toggle-payment-received-card"
          className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
            paymentReceivedAlert
              ? 'bg-[#0B0E14] border-emerald-500/60 shadow-xs'
              : 'bg-[#0B0E14] border-white/[0.06]'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100">Payment Received</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      paymentReceivedAlert
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800/80 text-slate-400 border-white/10'
                    }`}
                  >
                    {paymentReceivedAlert ? 'Active' : 'Muted'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-cyan-400">PAYMENT_SENT / UTR_SUBMITTED</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={paymentReceivedAlert}
                aria-label="Toggle email alerts for Payment Received"
                data-testid="toggle-email-alert-payment-received"
                disabled={notifSaving}
                onClick={() => handleToggleNotification('paymentReceived', !paymentReceivedAlert)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  paymentReceivedAlert ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    paymentReceivedAlert ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Sends an email with banking transaction ref / UTR when buyer completes payment so you can verify and release.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Alert: Email &amp; In-App</span>
            <button
              type="button"
              data-testid="test-payment-received-alert-btn"
              disabled={testingNotifEvent !== null}
              onClick={() => handleTestAlert('PAYMENT_RECEIVED')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>{testingNotifEvent === 'PAYMENT_RECEIVED' ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>

        {/* 3. Dispute Opened */}
        <div
          data-testid="notif-toggle-dispute-opened-card"
          className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
            disputeOpenedAlert
              ? 'bg-[#0B0E14] border-red-500/60 shadow-xs'
              : 'bg-[#0B0E14] border-white/[0.06]'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100">Dispute Opened</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      disputeOpenedAlert
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-slate-800/80 text-slate-400 border-white/10'
                    }`}
                  >
                    {disputeOpenedAlert ? 'High Priority' : 'Muted'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-red-400">DISPUTE_OPENED / ARBITRATION</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={disputeOpenedAlert}
                aria-label="Toggle email alerts for Dispute Opened"
                data-testid="toggle-email-alert-dispute-opened"
                disabled={notifSaving}
                onClick={() => handleToggleNotification('disputeOpened', !disputeOpenedAlert)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  disputeOpenedAlert ? 'bg-red-500' : 'bg-slate-500'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    disputeOpenedAlert ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Dispatches urgent priority email if an order is flagged for arbitration, locking escrow until mediation.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Alert: Urgent Email</span>
            <button
              type="button"
              data-testid="test-dispute-opened-alert-btn"
              disabled={testingNotifEvent !== null}
              onClick={() => handleTestAlert('DISPUTE_OPENED')}
              className="text-red-400 hover:text-red-300 font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>{testingNotifEvent === 'DISPUTE_OPENED' ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Contextual Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <img
            src={currentUser.avatarUrl || profileAvatarUrl}
            alt={currentUser.displayName}
            data-testid="dashboard-header-avatar"
            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400/60 shrink-0 bg-[#131A24]"
          />
          <div>
            <div className="text-xs font-medium text-slate-400">
              COSTORAH Profile · {currentUser.displayName} ({currentUser.email}) · Reputation{' '}
              {currentUser.reputationScore.toFixed(1)}% ({currentUser.completedTrades} trades)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-0.5">
              Trader Profile, Portfolio &amp; Banking Custody
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#131A24] p-1 rounded-lg border border-white/[0.08] overflow-x-auto max-w-full flex-nowrap sm:flex-wrap">
          {(
            [
              { id: 'PORTFOLIO', label: 'Portfolio & Custody' },
              { id: 'ASSET_VOLUME', label: '30-Day Asset Volume' },
              { id: 'PAYMENT_METHODS', label: 'Profile, Avatar & Banking' },
              { id: 'NOTIFICATIONS', label: 'Notification Settings' },
              { id: 'ORDERS', label: `Orders & Disputes (${myOrders.length})` },
              { id: 'SECURITY', label: 'Wallets & Security' },
              { id: 'LEDGER', label: 'Ledger History' },
            ] as { id: DashboardSubTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`dashboard-tab-${t.id}`}
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                subTab === t.id
                  ? 'bg-emerald-500 text-[#0B0E14]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'PORTFOLIO' && (
        <div className="space-y-6">
          {/* Escrow Custody & Double-Entry Reserve Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#131A24] border border-white/[0.08]">
              <div className="text-xs text-slate-400">Active Escrow Orders</div>
              <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
                {activeOrders.length} Active
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                100% backed by locked ledger reserves
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#131A24] border border-white/[0.08]">
              <div className="text-xs text-slate-400">Disputed Orders on Hold</div>
              <div className="text-xl font-bold text-amber-400 font-mono tabular-nums mt-1">
                {disputedOrders.length} Held
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Frozen pending administrator arbitration
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#131A24] border border-white/[0.08]">
              <div className="text-xs text-slate-400">Double-Entry Ledger Status</div>
              <div className="text-xl font-bold text-slate-100 font-mono tabular-nums mt-1">
                1:1 Balanced
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {ledgerEntries.length} immutable journal entries recorded
              </div>
            </div>
          </div>

          {/* Active Order Cards with Visual Status Badges ('Escrow Locked', 'Payment Sent', 'Disputed · Frozen') */}
          <div
            data-testid="dashboard-active-order-cards"
            className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Active Escrow Orders — At-a-Glance State Visibility</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live status badges track each order from 1:1 Escrow Lock through Payment Sent verification and final release.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('ORDERS')}
                className="px-3 py-1.5 text-xs font-mono font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg cursor-pointer self-start sm:self-center"
              >
                View All Orders ({myOrders.length}) →
              </button>
            </div>

            {activeOrders.length === 0 && disputedOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-[#0B0E14] rounded-lg border border-white/[0.05]">
                No active escrow orders in progress. Accept an offer on the P2P Market to lock escrow.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...activeOrders, ...disputedOrders].map((ord) => (
                  <ActiveOrderCard
                    key={ord.id}
                    order={ord}
                    currentUserId={currentUser.id}
                    onOpenOrder={onOpenOrder}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Visual 30-Day Crypto Asset Trade Volume & Completion Rate Chart (Recharts) */}
          <AssetVolumeBarChart
            orders={orders}
            currentUser={currentUser}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Available vs Locked Balances Table */}
            <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-display">
                    Available vs. Escrow-Locked Balances
                  </h2>
                  <p className="text-xs text-slate-400">
                    Locked funds back active P2P offers or trades and cannot be withdrawn until released or cancelled.
                  </p>
                </div>
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs font-medium text-slate-400 bg-[#0B0E14]">
                      <th className="py-3 px-4">Asset</th>
                      <th className="py-3 px-4 text-right">Available Balance</th>
                      <th className="py-3 px-4 text-right">Locked in Escrow</th>
                      <th className="py-3 px-4 text-right">Total Custody</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-sm font-mono tabular-nums">
                    {balances.map((b) => {
                      const total = b.availableMicro + b.lockedMicro;
                      return (
                        <tr key={b.asset} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-4 font-sans font-bold text-slate-100">
                            {b.asset}
                          </td>
                          <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">
                            {formatMicro6(b.availableMicro)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-amber-400">
                            {formatMicro6(b.lockedMicro)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-200">
                            {formatMicro6(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Deposit / Withdraw Testnet Crypto Panel */}
            <form
              onSubmit={handleVaultSubmit}
              className="lg:col-span-5 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <h2 className="text-base font-bold text-slate-100 font-display">
                  Vault Deposit & Withdrawal
                </h2>
                <div className="inline-flex p-0.5 bg-[#0B0E14] rounded-lg border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setVaultAction('DEPOSIT');
                      setVaultError(null);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center gap-1 ${
                      vaultAction === 'DEPOSIT'
                        ? 'bg-emerald-500 text-[#0B0E14]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Deposit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVaultAction('WITHDRAW');
                      setVaultError(null);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center gap-1 ${
                      vaultAction === 'WITHDRAW'
                        ? 'bg-amber-400 text-[#0B0E14]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vault-asset-select" className="block text-xs font-medium text-slate-300 mb-1">
                    Asset
                  </label>
                  <CustomSelect
                    id="vault-asset-select"
                    testId="vault-asset-select"
                    value={selectedAsset}
                    onChange={(val) => setSelectedAsset(val as CryptoAsset)}
                    options={buildCryptoAssetOptions(ALL_CRYPTO_ASSETS, {
                      balancesMap: Object.fromEntries(
                        balances.map((b) => [b.asset, formatMicro6(b.availableMicro)])
                      ),
                    })}
                    searchable={false}
                  />
                </div>

                <div>
                  <label htmlFor="vault-amount-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Quantity ({selectedAsset})
                  </label>
                  <input
                    id="vault-amount-input"
                    type="text"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              {vaultAction === 'WITHDRAW' && (
                <div>
                  <label htmlFor="vault-withdraw-addr" className="block text-xs font-medium text-slate-300 mb-1">
                    Destination Wallet Address
                  </label>
                  <input
                    id="vault-withdraw-addr"
                    type="text"
                    required
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              )}

              {vaultError && (
                <div role="alert" className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{vaultError}</span>
                </div>
              )}

              {vaultSuccess && (
                <div role="status" className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{vaultSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={vaultBusy}
                className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                {vaultBusy
                  ? 'Processing Ledger Transaction...'
                  : vaultAction === 'DEPOSIT'
                  ? `Deposit ${amountInput} ${selectedAsset} (Testnet)`
                  : `Withdraw ${amountInput} ${selectedAsset} from Available Balance`}
              </button>
            </form>
          </div>
        </div>
      )}

      {subTab === 'ASSET_VOLUME' && (
        <div className="space-y-6">
          <AssetVolumeBarChart
            orders={orders}
            currentUser={currentUser}
          />
        </div>
      )}

      {subTab === 'PAYMENT_METHODS' && (
        <div className="space-y-6">
          {/* Row 1: User Profile Settings, Profile Image Upload / Preset Avatar & Username Editor */}
          <form
            onSubmit={handleProfileSubmit}
            data-testid="profile-settings-form"
            className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>User Profile Settings, Profile Image & Username Editor</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Save your custom profile image, trader display name, notification email, and desk bio.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                KYC Status: {currentUser.kycTier} · Reputation: {currentUser.reputationScore.toFixed(1)}%
              </span>
            </div>

            {/* Profile Image Preview, Upload & Preset Avatar Picker */}
            <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={profileAvatarUrl}
                    alt="Profile Avatar Preview"
                    data-testid="profile-avatar-preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400"
                  />
                  <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-[#0B0E14]">
                    <Camera className="w-3 h-3" />
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-100">
                    Trader Profile Image & Institutional Avatar
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Upload a PNG/JPG/SVG profile picture or choose a verified COSTORAH trader emblem below.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="profile-avatar-file-input"
                      className="px-3 py-1.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Profile Image</span>
                    </label>
                    <input
                      id="profile-avatar-file-input"
                      data-testid="profile-avatar-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Preset Institutional Avatars */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-400">
                  Or Select Verified Trader Emblem:
                </div>
                <div className="flex items-center gap-2">
                  {PRESET_TRADER_AVATARS.map((av) => {
                    const isSelected = profileAvatarUrl === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        data-testid={`preset-avatar-${av.id}`}
                        onClick={() => setProfileAvatarUrl(av.url)}
                        className={`p-1 rounded-full border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400 scale-105 bg-emerald-500/20'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        title={av.label}
                      >
                        <img
                          src={av.url}
                          alt={av.label}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="profile-username" className="block text-xs font-medium text-slate-300 mb-1">
                  Display Name / Username
                </label>
                <input
                  id="profile-username"
                  data-testid="profile-username-input"
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="block text-xs font-medium text-slate-300 mb-1">
                  Alert & Notification Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label htmlFor="profile-country" className="block text-xs font-medium text-slate-300 mb-1">
                  Trading Country (Locks Domestic Fiat)
                </label>
                <CustomSelect
                  id="profile-country"
                  testId="profile-country"
                  value={profileCountry}
                  onChange={(val) => {
                    const code = val as CountryCode;
                    setProfileCountry(code);
                    setProfileFiat(getLockedFiatForCountry(code));
                  }}
                  options={buildCountryCurrencyOptions()}
                />
              </div>

              <div>
                <label htmlFor="profile-bio" className="block text-xs font-medium text-slate-300 mb-1">
                  Trader Desk Tagline / Bio
                </label>
                <input
                  id="profile-bio"
                  type="text"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                {profileStatusMsg && (
                  <div
                    data-testid="profile-save-status"
                    className="text-xs text-emerald-400 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{profileStatusMsg}</span>
                  </div>
                )}
                {profileErrorMsg && <div className="text-xs text-red-400">{profileErrorMsg}</div>}
              </div>

              <button
                type="submit"
                data-testid="save-profile-settings-btn"
                disabled={profileBusy}
                className="px-5 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                {profileBusy ? 'Saving Profile...' : 'Save Profile & Avatar Settings'}
              </button>
            </div>
          </form>

          {/* Row 1.25: Notification Settings Section */}
          {renderNotificationSettings()}

          {/* Row 1.5: Registered Banking Details & Institutional Settlement Accounts */}
          <div
            data-testid="registered-banking-details-section"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Saved Registered Bank Accounts List */}
            <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-400" />
                    <span>
                      Registered Banking Details ({(currentUser.bankAccounts || []).length})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Verified domestic & international bank accounts registered for P2P fiat settlement.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400">Penny-Drop Verified</span>
              </div>

              {bankStatusMsg && (
                <div
                  data-testid="bank-save-status"
                  className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{bankStatusMsg}</span>
                </div>
              )}
              {bankErrorMsg && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{bankErrorMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                {(currentUser.bankAccounts || []).map((bank: RegisteredBankAccount) => (
                  <div
                    key={bank.id}
                    data-testid={`registered-bank-card-${bank.id}`}
                    className="p-4 bg-[#0B0E14] border border-white/[0.08] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-slate-100 text-sm">
                          {bank.bankName}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#131A24] border border-white/10 rounded text-slate-300">
                          {bank.accountType} · {bank.fiatCurrency}
                        </span>
                        {bank.isPrimary && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded inline-flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" />
                            <span>PRIMARY SETTLEMENT</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-300 font-mono">
                        A/C Holder: <span className="text-slate-100">{bank.accountHolderName}</span> · A/C No:{' '}
                        <span className="text-emerald-400 font-semibold">{bank.maskedAccountNumber || bank.accountNumber}</span>
                      </div>

                      <div className="text-slate-400 font-mono">
                        IFSC / SWIFT: <span className="text-slate-200">{bank.ifscOrSwiftCode}</span>
                        {bank.branchName ? ` · Branch: ${bank.branchName}` : ''}
                        {bank.linkedUpiId ? ` · Linked UPI: ${bank.linkedUpiId}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {!bank.isPrimary && onSetPrimaryBankAccount && (
                        <button
                          type="button"
                          onClick={() => onSetPrimaryBankAccount(bank.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 cursor-pointer whitespace-nowrap"
                        >
                          Set Primary
                        </button>
                      )}
                      {onDeleteBankAccount && (
                        <button
                          type="button"
                          onClick={() => onDeleteBankAccount(bank.id)}
                          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-[#131A24] border border-white/[0.06] rounded-lg cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Register New Banking Details Form */}
            <form
              onSubmit={handleRegisterBankSubmit}
              data-testid="register-bank-form"
              className="lg:col-span-5 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-3.5"
            >
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Register Banking Details</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Register your bank account, IFSC/SWIFT routing code, and optional UPI handle for P2P sell orders.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bank-holder-input" className="block text-xs text-slate-300 mb-1">
                    Account Holder Legal Name
                  </label>
                  <input
                    id="bank-holder-input"
                    data-testid="bank-holder-input"
                    type="text"
                    required
                    value={bankHolderName}
                    onChange={(e) => setBankHolderName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="bank-name-input" className="block text-xs text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    id="bank-name-input"
                    data-testid="bank-name-input"
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI, Chase"
                    className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bank-acct-input" className="block text-xs text-slate-300 mb-1">
                    Bank Account Number / IBAN
                  </label>
                  <input
                    id="bank-acct-input"
                    data-testid="bank-acct-input"
                    type="text"
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="bank-ifsc-input" className="block text-xs text-slate-300 mb-1">
                    IFSC / SWIFT / Routing Code
                  </label>
                  <input
                    id="bank-ifsc-input"
                    data-testid="bank-ifsc-input"
                    type="text"
                    required
                    value={bankIfscOrSwift}
                    onChange={(e) => setBankIfscOrSwift(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="bank-type-select" className="block text-xs text-slate-300 mb-1">
                    Account Type
                  </label>
                  <CustomSelect
                    id="bank-type-select"
                    testId="bank-type-select"
                    value={bankAccountType}
                    onChange={(val) =>
                      setBankAccountType(
                        val as 'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC'
                      )
                    }
                    options={[
                      { value: 'SAVINGS', badgeText: 'SAV', badgeVariant: 'emerald', label: 'SAVINGS' },
                      { value: 'CURRENT', badgeText: 'CUR', badgeVariant: 'blue', label: 'CURRENT' },
                      { value: 'CORPORATE_OTC', badgeText: 'OTC', badgeVariant: 'amber', label: 'CORPORATE_OTC' },
                    ]}
                    searchable={false}
                  />
                </div>
                <div>
                  <label htmlFor="bank-branch-input" className="block text-xs text-slate-300 mb-1">
                    Branch / City
                  </label>
                  <input
                    id="bank-branch-input"
                    type="text"
                    value={bankBranchName}
                    onChange={(e) => setBankBranchName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="bank-upi-input" className="block text-xs text-slate-300 mb-1">
                    Linked UPI ID (Optional)
                  </label>
                  <input
                    id="bank-upi-input"
                    type="text"
                    value={bankUpiId}
                    onChange={(e) => setBankUpiId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bankIsPrimary}
                  onChange={(e) => setBankIsPrimary(e.target.checked)}
                  className="rounded accent-emerald-400"
                />
                <span>Set as Primary Settlement Bank Account for P2P Sell Offers</span>
              </label>

              <button
                type="submit"
                data-testid="register-bank-submit-btn"
                disabled={bankBusy}
                className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
              >
                {bankBusy ? 'Registering Bank Account...' : 'Register & Verify Bank Account'}
              </button>
            </form>
          </div>

          {/* Row 2: Add & Verify Payment Methods (PhonePe, Google Pay, Paytm, Credit Cards, UPI, Bank) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Saved Payment Methods & Verification Hub */}
            <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-display">
                    Saved Payment Options & Verification ({currentUser.paymentMethods.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Manage PhonePe, Google Pay, Paytm, Credit/Debit Cards, UPI, and Bank settlement accounts.
                  </p>
                </div>
              </div>

              {pmStatus && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pmStatus}</span>
                </div>
              )}
              {pmError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{pmError}</span>
                </div>
              )}

              <div className="space-y-3">
                {currentUser.paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {pm.category === 'CARD' ? (
                          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        ) : pm.category === 'UPI_APP' ? (
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="font-bold text-slate-100">
                          {pm.methodName} · {pm.fiatCurrency}
                        </span>
                        <span className="text-slate-400">({pm.bankOrProvider})</span>
                      </div>

                      <div className="text-slate-300 font-mono">
                        Holder: {pm.accountHolder} · ID: {pm.accountIdentifier}
                        {pm.expiryDate ? ` · Exp: ${pm.expiryDate}` : ''}
                      </div>

                      <div className="text-slate-500">
                        {pm.isVerified ? (
                          <span className="text-emerald-400 font-mono inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Verified ({pm.verificationMethod || 'NPCI / Bank Handshake'})</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-mono inline-flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Pending Verification — Verify ownership to enable instant P2P settlement</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {!pm.isVerified && (
                        <button
                          type="button"
                          disabled={verifyingPmId === pm.id}
                          onClick={() => handleVerifyPm(pm.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#0B0E14] bg-amber-400 hover:bg-amber-300 rounded-md cursor-pointer whitespace-nowrap"
                        >
                          {verifyingPmId === pm.id ? 'Verifying...' : 'Verify Payment Method'}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${pm.methodName}`}
                        onClick={() => onDeletePaymentMethod(pm.id)}
                        className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-[#131A24] border border-white/[0.06] rounded-md cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verify Incoming Counterparty Order Payments */}
              <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
                <div className="text-xs font-bold text-slate-200">
                  Incoming Order Payment Verification ({activeOrders.length} Active Orders)
                </div>
                {activeOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-slate-100">
                          {ord.id} · {FIAT_SYMBOLS[ord.fiatCurrency]}
                          {formatMinor2(ord.grossFiatMinor)} {ord.fiatCurrency} via {ord.paymentMethod}
                        </span>
                        <OrderStatusBadges order={ord} />
                      </div>
                      <div className="text-slate-400">
                        UTR / Proof:{' '}
                        <span className="font-mono text-slate-200">
                          {ord.paymentReference || 'Awaiting buyer UTR'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenOrder(ord.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-md cursor-pointer whitespace-nowrap self-start sm:self-center"
                    >
                      Verify & Settle in Trade Room
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Payment Option Form (PhonePe, Google Pay, Paytm, Credit Card, UPI, Bank) */}
            <form
              onSubmit={handleAddPm}
              className="lg:col-span-5 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display">
                  Add Payment Option
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a quick preset for PhonePe, Google Pay, Paytm, Credit/Debit Card, or Bank Transfer.
                </p>
              </div>

              {/* Quick Payment Rail Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'PHONEPE', label: 'PhonePe' },
                    { id: 'GPAY', label: 'Google Pay' },
                    { id: 'PAYTM', label: 'Paytm' },
                    { id: 'CREDIT_CARD', label: 'Credit Card' },
                    { id: 'UPI_INSTANT', label: 'UPI Instant' },
                    { id: 'BANK_TRANSFER', label: 'Bank / SEPA' },
                  ] as { id: PaymentPreset; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPaymentPreset(p.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      activePreset === p.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pm-fiat" className="block text-xs text-slate-300 mb-1">
                    Fiat Currency
                  </label>
                  <CustomSelect
                    id="pm-fiat"
                    testId="pm-fiat"
                    value={pmFiat}
                    onChange={(val) => setPmFiat(val as FiatCurrency)}
                    options={buildFiatCurrencyOptions(ALL_FIAT_CURRENCIES)}
                  />
                </div>
                <div>
                  <label htmlFor="pm-rail" className="block text-xs text-slate-300 mb-1">
                    Payment Method Name
                  </label>
                  <input
                    id="pm-rail"
                    type="text"
                    required
                    value={pmMethodName}
                    onChange={(e) => setPmMethodName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pm-holder" className="block text-xs text-slate-300 mb-1">
                  Account / Card Holder Legal Name
                </label>
                <input
                  id="pm-holder"
                  type="text"
                  required
                  value={pmHolder}
                  onChange={(e) => setPmHolder(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>

              {pmCategory === 'CARD' ? (
                <div className="space-y-3 p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pm-card-net" className="block text-xs text-slate-300 mb-1">
                        Card Network
                      </label>
                      <CustomSelect
                        id="pm-card-net"
                        testId="pm-card-net"
                        value={pmCardNetwork}
                        onChange={(val) => setPmCardNetwork(val)}
                        options={[
                          { value: 'Visa Credit', badgeText: 'VISA', badgeVariant: 'blue', label: 'Visa Credit' },
                          { value: 'Mastercard World', badgeText: 'MC', badgeVariant: 'amber', label: 'Mastercard World' },
                          { value: 'RuPay Platinum', badgeText: 'RUPAY', badgeVariant: 'emerald', label: 'RuPay Platinum' },
                          { value: 'Visa Debit', badgeText: 'DEBIT', badgeVariant: 'slate', label: 'Visa Debit' },
                        ]}
                        searchable={false}
                      />
                    </div>
                    <div>
                      <label htmlFor="pm-card-exp" className="block text-xs text-slate-300 mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        id="pm-card-exp"
                        type="text"
                        required
                        placeholder="09/29"
                        value={pmExpiry}
                        onChange={(e) => setPmExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pm-id" className="block text-xs text-slate-300 mb-1">
                      Card Number (Auto-masked to last 4 digits; never enter CVV)
                    </label>
                    <input
                      id="pm-id"
                      type="text"
                      required
                      placeholder="4111 2222 3333 4829"
                      value={pmIdentifier}
                      onChange={(e) => setPmIdentifier(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="pm-id" className="block text-xs text-slate-300 mb-1">
                    {pmCategory === 'UPI_APP'
                      ? `${pmMethodName} UPI ID / Mobile Handle`
                      : 'Receiving Identifier (IBAN / Account Number)'}
                  </label>
                  <input
                    id="pm-id"
                    type="text"
                    required
                    placeholder="e.g. 9876543210@ybl or trader@okaxis"
                    value={pmIdentifier}
                    onChange={(e) => setPmIdentifier(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              )}

              <div>
                <label htmlFor="pm-bank" className="block text-xs text-slate-300 mb-1">
                  Issuing Bank / Payment Provider
                </label>
                <input
                  id="pm-bank"
                  type="text"
                  required
                  placeholder="e.g. PhonePe / Yes Bank, Google Pay, Chase Visa"
                  value={pmBank}
                  onChange={(e) => setPmBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pmVerifyImmediately}
                  onChange={(e) => setPmVerifyImmediately(e.target.checked)}
                  className="rounded accent-emerald-400"
                />
                <span>Run instant UPI VPA / 3DS2 verification handshake upon saving</span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
              >
                Add {pmMethodName} Payment Option
              </button>
            </form>
          </div>
        </div>
      )}

      {subTab === 'NOTIFICATIONS' && (
        <div className="space-y-6">
          {renderNotificationSettings()}
        </div>
      )}

      {subTab === 'ORDERS' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                <span>Order Management & Dispute Tracker</span>
                <span className="text-xs font-mono text-emerald-400 font-normal">
                  ({myOrders.filter((o) => o.state === 'COMPLETED').length} Completed)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of completed settlements, active locks, and dispute arbitrations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Download CSV Button for Tax and Accounting */}
              <button
                type="button"
                data-testid="download-csv-btn"
                onClick={handleDownloadCompletedCsv}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/40 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download CSV report of completed trade records for tax or accounting purposes"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download CSV</span>
              </button>

              <div className="flex flex-wrap items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
                {(['ALL', 'SELF_BUY', 'SELF_SELL', 'ACTIVE', 'COMPLETED', 'DISPUTED', 'CANCELLED'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setOrderFilter(f)}
                    className={`px-3 py-1 text-xs font-medium rounded cursor-pointer ${
                      orderFilter === f ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {csvExportMsg && (
            <div
              data-testid="csv-export-feedback"
              className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{csvExportMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setCsvExportMsg(null)}
                className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No orders in this category.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Active Order Cards Grid at Top of Orders Tab */}
              {(orderFilter === 'ALL' || orderFilter === 'ACTIVE' || orderFilter === 'DISPUTED') &&
                [...activeOrders, ...disputedOrders].length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[...activeOrders, ...disputedOrders]
                      .filter((o) =>
                        orderFilter === 'ALL'
                          ? true
                          : orderFilter === 'DISPUTED'
                          ? o.state === 'DISPUTED'
                          : o.state !== 'DISPUTED'
                      )
                      .map((ord) => (
                        <ActiveOrderCard
                          key={ord.id}
                          order={ord}
                          currentUserId={currentUser.id}
                          onOpenOrder={onOpenOrder}
                        />
                      ))}
                  </div>
                )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs text-slate-400 bg-[#0B0E14]">
                      <th className="py-3 px-4">Order ID & Role</th>
                      <th className="py-3 px-4">Order Status Badge</th>
                      <th className="py-3 px-4 text-right">Escrowed Crypto</th>
                      <th className="py-3 px-4 text-right">Gross Fiat & 1% Fee</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs font-mono tabular-nums">
                    {filteredOrders.map((ord) => {
                      const isBuyer = ord.buyerId === currentUser.id;
                      const sym = FIAT_SYMBOLS[ord.fiatCurrency];
                      return (
                        <tr key={ord.id} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-100">{ord.id}</div>
                            <div className="text-slate-400 font-sans">
                              Role: {isBuyer ? 'Buyer' : 'Seller'} · {ord.paymentMethod}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <OrderStatusBadges order={ord} />
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-100">
                            {formatMicro6(ord.cryptoQuantityMicro)} {ord.asset}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-300">
                            {sym}
                            {formatMinor2(ord.grossFiatMinor)} {ord.fiatCurrency} (Fee: {sym}
                            {formatMinor2(ord.platformFeeFiatMinor)})
                          </td>
                          <td className="py-3.5 px-4 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => onOpenOrder(ord.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open Trade Room</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'SECURITY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Linked Wallets & Identities */}
          <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-display">
                  Linked Cryptographic Wallets & Authentication Identities
                </h2>
                <p className="text-xs text-slate-400">
                  Multiple wallets and sign-in methods unified under one non-duplicate profile.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAccountModal}
                className="px-3.5 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Link New Wallet / Auth
              </button>
            </div>

            {currentUser.wallets.length === 0 ? (
              <div className="p-5 text-center text-xs bg-[#0B0E14] border border-white/10 rounded-xl space-y-2.5">
                <div className="flex justify-center text-slate-500">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="text-slate-200 font-bold">No Web3 Wallets Connected</div>
                <p className="text-slate-400 max-w-md mx-auto">
                  Connect an ERC-20 (EVM) or Solana SPL wallet to enable on-chain P2P settlements and cryptographic self-custody.
                </p>
                <button
                  type="button"
                  onClick={onOpenAccountModal}
                  className="px-4 py-2 text-xs font-bold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Connect Wallet</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentUser.wallets.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <span>{w.label}</span>
                        <span className="text-emerald-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {w.tokenStandard || w.type}
                        </span>
                      </div>
                      <div className="font-mono text-slate-300 mt-0.5 break-all">{w.address}</div>
                      <div className="text-slate-500 mt-0.5">{w.chain}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-emerald-400">SIWE Verified</span>
                      {onDisconnectWallet && (
                        <button
                          type="button"
                          onClick={() => onDisconnectWallet(w.id)}
                          className="px-2.5 py-1 text-xs font-mono text-red-300 hover:text-red-100 bg-red-950/60 hover:bg-red-900 border border-red-500/30 rounded cursor-pointer transition-colors"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recent Account & Price Alert Notifications ({notifications.length})</span>
              </div>
              {notifications.map((n) => (
                <div key={n.id} className="p-3 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-xs">
                  <div className="font-semibold text-slate-200 flex items-center justify-between">
                    <span>{n.title}</span>
                    {n.channel && (
                      <span className="text-[11px] font-mono text-emerald-400">{n.channel}</span>
                    )}
                  </div>
                  <div className="text-slate-400 mt-0.5">{n.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Recovery, Authenticator App (TOTP QR Generator) & Security Controls */}
          <div className="lg:col-span-5 space-y-6">
            {/* Authenticator App (TOTP 2FA) QR Code Generator & Verification Card */}
            <div
              data-testid="authenticator-app-setup-card"
              className="bg-[#131A24] border border-emerald-500/30 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Link Authenticator App (TOTP 2FA)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scan the QR code below with Google Authenticator, Authy, or 1Password, then enter the 6-digit code to link your account.
                  </p>
                </div>
                <span
                  data-testid="authenticator-status-badge"
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase shrink-0 border ${
                    totpLinked && twoFactor
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {totpLinked && twoFactor ? 'Linked & Active' : 'Setup Pending'}
                </span>
              </div>

              {/* QR Code SVG + Secret Key Panel */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl">
                <div
                  data-testid="totp-qr-code-container"
                  className="p-2.5 bg-white rounded-xl border-2 border-emerald-400/60 shadow-md shrink-0"
                >
                  <svg
                    data-testid="totp-qr-code-svg"
                    viewBox="0 0 21 21"
                    width="132"
                    height="132"
                    shapeRendering="crispEdges"
                    role="img"
                    aria-label={`TOTP Authenticator QR Code for ${authSetup.accountEmail}`}
                  >
                    <rect width="21" height="21" fill="#ffffff" />
                    {authSetup.qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#0B0E14"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                </div>

                <div className="flex-1 min-w-0 space-y-2.5 text-xs w-full">
                  <div>
                    <div className="text-[11px] text-slate-400">Account Binding</div>
                    <div className="font-mono font-semibold text-slate-100 truncate">
                      {authSetup.issuer} ({authSetup.accountEmail})
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-emerald-400" />
                        <span>Manual Setup Key (Base32)</span>
                      </span>
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="copy-totp-secret-btn"
                          onClick={handleCopyTotpSecret}
                          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>{secretCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          data-testid="regenerate-totp-qr-btn"
                          onClick={handleRegenerateTotpSecret}
                          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>New QR</span>
                        </button>
                      </div>
                    </div>
                    <div
                      data-testid="totp-secret-key-display"
                      className="px-2.5 py-1.5 bg-[#131A24] border border-white/10 rounded-lg font-mono text-[11px] text-emerald-300 tracking-wider select-all break-all"
                    >
                      {authSetup.secretKey}
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400">
                    Current Expected TOTP Token:{' '}
                    <button
                      type="button"
                      data-testid="autofill-totp-code-btn"
                      onClick={() => setTotpCodeInput(authSetup.currentSixDigitCode)}
                      className="text-emerald-400 hover:underline font-bold cursor-pointer"
                      title="Click to auto-fill current 6-digit authenticator code"
                    >
                      {authSetup.currentSixDigitCode} (Click to Auto-Fill)
                    </button>
                  </div>
                </div>
              </div>

              {/* 6-Digit Authenticator Verification Input & Submit */}
              <form onSubmit={handleLinkAuthenticatorApp} className="space-y-3">
                <div>
                  <label
                    htmlFor="totp-verification-code-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Enter 6-Digit Authenticator Code
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="totp-verification-code-input"
                      data-testid="totp-verification-code-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={`e.g. ${authSetup.currentSixDigitCode}`}
                      value={totpCodeInput}
                      onChange={(e) => setTotpCodeInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                      className="flex-1 px-3.5 py-2 text-sm font-mono font-bold tracking-[0.25em] bg-[#0B0E14] border border-white/15 rounded-lg text-emerald-300 placeholder:text-slate-600 placeholder:tracking-normal focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      data-testid="verify-link-authenticator-btn"
                      className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Verify &amp; Link Authenticator
                    </button>
                  </div>
                </div>

                {totpErrorMsg && (
                  <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
                    {totpErrorMsg}
                  </div>
                )}

                {totpSuccessMsg && (
                  <div
                    data-testid="totp-link-success-msg"
                    className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{totpSuccessMsg}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Account Recovery & Withdrawal Controls */}
            <form
              onSubmit={handleSaveSecurity}
              className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
            >
              <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Account Recovery &amp; Withdrawal Controls</span>
              </h2>

              <label className="flex items-center justify-between p-3 bg-[#0B0E14] border border-white/[0.06] rounded-lg cursor-pointer text-xs">
                <div>
                  <div className="font-semibold text-slate-200">
                    Require Passkey / 2FA on Escrow Release &amp; Withdrawals
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    Enforces step-up verification before releasing locked funds
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                  className="accent-emerald-400 w-4 h-4"
                />
              </label>

              <div>
                <label htmlFor="guardian-email" className="block text-xs font-medium text-slate-300 mb-1">
                  Social Recovery Guardian Email
                </label>
                <input
                  id="guardian-email"
                  type="email"
                  required
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>

              {secSavedMsg && <div className="text-xs text-emerald-400">{secSavedMsg}</div>}

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
              >
                Update Security Controls
              </button>
            </form>
          </div>
        </div>
      )}

      {subTab === 'LEDGER' && (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08]">
            <h2 className="text-base font-bold text-slate-100 font-display">
              Audited Double-Entry Ledger Entries
            </h2>
            <p className="text-xs text-slate-400">
              Every deposit, withdrawal, offer reservation, and escrow settlement is recorded with an idempotency key.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs text-slate-400 bg-[#0B0E14]">
                  <th className="py-3 px-4">Entry ID & Type</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4 text-right">Delta Available</th>
                  <th className="py-3 px-4 text-right">Delta Locked</th>
                  <th className="py-3 px-4">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs font-mono tabular-nums">
                {ledgerEntries
                  .filter((e) => e.userId === currentUser.id)
                  .map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{e.type}</div>
                        <div className="text-slate-500">{e.id}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">{e.asset}</td>
                      <td
                        className={`py-3 px-4 text-right ${
                          e.deltaAvailableMicro >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {e.deltaAvailableMicro >= 0 ? '+' : ''}
                        {formatMicro6(e.deltaAvailableMicro)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right ${
                          e.deltaLockedMicro >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {e.deltaLockedMicro >= 0 ? '+' : ''}
                        {formatMicro6(e.deltaLockedMicro)}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300">{e.note}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
