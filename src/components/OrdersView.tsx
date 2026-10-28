import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Search,
  Send,
  Copy,
  Check,
  Filter,
  FileCheck2,
  ExternalLink,
  Lock,
  XCircle,
  RotateCcw,
  Clock,
  UploadCloud,
  ImageIcon,
  Eye,
  ZoomIn,
  Trash2,
  X,
  BellRing,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  getOrderStatusBadgeDescriptor,
  categorizeUserOrders,
  type EscrowOrderRecord,
  type TradeMessage,
  type UserProfile,
  type CryptoAsset,
  type OrderStatusBadgeDescriptor,
  type OrderState,
  type OfferRecord,
  type FiatCurrency,
} from '../types';
import { formatMinor2, formatMicro6 } from '../core/escrowEngine';
import { CryptoAssetIcon, ALL_CRYPTO_ASSETS } from './CryptoAssetIcons';
import { CustomSelect, buildCryptoAssetOptions } from './CustomSelect';
import { PublishedOffersManager, type EditOfferPayload } from './PublishedOffersManager';

export type OrderCategoryTab = 'ALL' | 'SELF_BUY' | 'SELF_SELL' | 'COMPLETED' | 'ACTIVE';

export type TradeBadgeType =
  | 'ESCROW_LOCKED'
  | 'PAYMENT_SENT'
  | 'DISPUTED'
  | 'RELEASED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface TradeStatusConfig {
  badgeType: TradeBadgeType;
  label: string;
  subLabel: string;
  badgeClass: string;
  dotClass: string;
  icon: React.ReactNode;
  tooltip: string;
}

export function getTradeStatusConfig(state: OrderState, paymentReference?: string): TradeStatusConfig {
  switch (state) {
    case 'ESCROW_LOCKED':
    case 'PAYMENT_PENDING':
    case 'ORDER_RESERVED':
    case 'ESCROW_FUNDING':
    case 'OFFER_OPEN':
    case 'DRAFT':
      return {
        badgeType: 'ESCROW_LOCKED',
        label: 'Escrow Locked',
        subLabel: state === 'PAYMENT_PENDING' ? 'Awaiting Payment' : '1:1 Custody Secured',
        badgeClass:
          'bg-amber-500/15 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/25 shadow-sm shadow-amber-950/40',
        dotClass: 'bg-amber-400',
        icon: <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        tooltip: 'Crypto principal locked in 1:1 protocol escrow; awaiting buyer fiat payment',
      };
    case 'PAYMENT_MARKED_SENT':
    case 'PAYMENT_REVIEW':
      return {
        badgeType: 'PAYMENT_SENT',
        label: 'Payment Sent',
        subLabel: paymentReference ? `Ref: ${paymentReference}` : 'Awaiting Seller Release',
        badgeClass:
          'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/25 shadow-sm shadow-cyan-950/40',
        dotClass: 'bg-cyan-400 animate-pulse',
        icon: <Send className="w-3.5 h-3.5 text-cyan-400 shrink-0" />,
        tooltip: 'Buyer declared payment sent with reference; auto-expiry timer frozen awaiting seller release',
      };
    case 'DISPUTED':
    case 'ESCROW_RECOVERY_REQUIRED':
      return {
        badgeType: 'DISPUTED',
        label: 'Disputed',
        subLabel: 'Arbitration Hold',
        badgeClass:
          'bg-red-500/15 text-red-300 border-red-500/40 ring-1 ring-red-500/25 shadow-sm shadow-red-950/40',
        dotClass: 'bg-red-400 animate-ping',
        icon: <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />,
        tooltip: 'Dispute opened by counterparty; escrow principal frozen under administrative arbitration',
      };
    case 'COMPLETED':
    case 'RELEASE_PENDING':
      return {
        badgeType: 'RELEASED',
        label: 'Released',
        subLabel: 'Settled · 100% Crypto',
        badgeClass:
          'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/25 shadow-sm shadow-emerald-950/40',
        dotClass: 'bg-emerald-400',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        tooltip: 'Escrow crypto released to buyer; seller received net fiat and trade is completed',
      };
    case 'CANCELLED':
    case 'EXPIRED':
      return {
        badgeType: 'CANCELLED',
        label: 'Cancelled',
        subLabel: 'Escrow Restored',
        badgeClass:
          'bg-slate-700/30 text-slate-300 border-slate-600/40 ring-1 ring-slate-500/15 shadow-sm shadow-slate-950/40',
        dotClass: 'bg-slate-400',
        icon: <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
        tooltip: 'Order voided before fiat transfer; 100% of escrowed crypto released back to seller',
      };
    case 'REFUND_PENDING':
    case 'REFUNDED':
      return {
        badgeType: 'REFUNDED',
        label: 'Refunded',
        subLabel: 'Principal Returned',
        badgeClass:
          'bg-purple-500/15 text-purple-300 border-purple-500/40 ring-1 ring-purple-500/25 shadow-sm shadow-purple-950/40',
        dotClass: 'bg-purple-400',
        icon: <RotateCcw className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
        tooltip: 'Dispute concluded by arbitrator; escrowed funds returned',
      };
    default:
      return {
        badgeType: 'ESCROW_LOCKED',
        label: 'Escrow Locked',
        subLabel: 'Active Escrow',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20',
        dotClass: 'bg-amber-400',
        icon: <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        tooltip: 'In progress trade state',
      };
  }
}

export interface TradeStatusBadgeProps {
  state: OrderState;
  paymentReference?: string;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export const TradeStatusBadge: React.FC<TradeStatusBadgeProps> = ({
  state,
  paymentReference,
  variant = 'compact',
  className = '',
}) => {
  const config = getTradeStatusConfig(state, paymentReference);

  if (variant === 'compact') {
    return (
      <span
        data-testid={`trade-status-badge-${config.badgeType.toLowerCase()}`}
        title={config.tooltip}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-bold rounded-md border tracking-tight transition-all ${config.badgeClass} ${className}`}
      >
        <span className="shrink-0">{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div
      data-testid={`trade-status-badge-detailed-${config.badgeType.toLowerCase()}`}
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
    >
      <span
        title={config.tooltip}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-md border ${config.badgeClass}`}
      >
        <span className="shrink-0">{config.icon}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        <span>{config.label}</span>
      </span>
      <span className="px-2 py-0.5 text-[11px] font-mono text-slate-300 bg-[#0B0E14] border border-white/10 rounded">
        {config.subLabel}
      </span>
    </div>
  );
};

function renderOrderStatusBadge(descriptor: OrderStatusBadgeDescriptor, paymentReference?: string) {
  return <TradeStatusBadge state={descriptor.state} paymentReference={paymentReference} variant="detailed" />;
}

export interface OrdersViewProps {
  currentUser: UserProfile;
  orders: EscrowOrderRecord[];
  offers?: OfferRecord[];
  supportedPaymentMethods?: Record<FiatCurrency, string[]>;
  messagesByOrder: Record<string, TradeMessage[]>;
  allUsers?: UserProfile[];
  initialCategoryTab?: OrderCategoryTab;
  onOpenTradeRoom: (orderId: string) => void;
  onMarkPaymentSent: (
    orderId: string,
    paymentReference: string,
    notes: string,
    paymentEvidenceUrl?: string
  ) => Promise<void>;
  onConfirmAndRelease: (orderId: string) => Promise<void>;
  onOpenDispute: (orderId: string, reason: string) => Promise<void>;
  onSendChatMessage: (orderId: string, message: string) => Promise<void>;
  onNavigateToMarket: () => void;
  onCancelOrder?: (orderId: string, reason?: string) => Promise<void>;
  onUpdateOfferStatus?: (offerId: string, action: 'PAUSE' | 'RESUME' | 'CANCEL') => Promise<void>;
  onEditOffer?: (offerId: string, payload: EditOfferPayload) => Promise<void>;
  onNotifyPaymentCompleted?: (params: {
    orderId: string;
    customMessage: string;
    channel: 'IN_APP' | 'EMAIL' | 'BOTH';
  }) => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  currentUser,
  orders,
  offers = [],
  supportedPaymentMethods = {} as Record<FiatCurrency, string[]>,
  messagesByOrder,
  allUsers = [],
  initialCategoryTab = 'ALL',
  onOpenTradeRoom,
  onMarkPaymentSent,
  onConfirmAndRelease,
  onOpenDispute,
  onSendChatMessage,
  onNavigateToMarket,
  onCancelOrder,
  onUpdateOfferStatus,
  onEditOffer,
  onNotifyPaymentCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<OrderCategoryTab>(initialCategoryTab);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TradeBadgeType>('ALL');
  const [assetFilter, setAssetFilter] = useState<CryptoAsset | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);

  // Order Action Form States
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentEvidenceImage, setPaymentEvidenceImage] = useState<string>('');
  const [paymentEvidenceFileName, setPaymentEvidenceFileName] = useState<string>('');
  const [paymentEvidenceFileSize, setPaymentEvidenceFileSize] = useState<string>('');
  const [receiptModalImage, setReceiptModalImage] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [notifyInput, setNotifyInput] = useState('');
  const [notifyChannel, setNotifyChannel] = useState<'IN_APP' | 'BOTH'>('BOTH');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers) {
      map.set(u.id, u.displayName);
    }
    map.set(currentUser.id, currentUser.displayName);
    return map;
  }, [allUsers, currentUser.id, currentUser.displayName]);

  const getUserDisplayName = (userId: string) => userNameMap.get(userId) || userId;

  const categorized = useMemo(
    () => categorizeUserOrders(orders, currentUser.id),
    [orders, currentUser.id]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<'ALL' | TradeBadgeType, number> = {
      ALL: categorized.allMyOrders.length,
      ESCROW_LOCKED: 0,
      PAYMENT_SENT: 0,
      DISPUTED: 0,
      RELEASED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };
    for (const o of categorized.allMyOrders) {
      const config = getTradeStatusConfig(o.state, o.paymentReference);
      counts[config.badgeType] = (counts[config.badgeType] || 0) + 1;
    }
    return counts;
  }, [categorized.allMyOrders]);

  const displayedOrders = useMemo(() => {
    let baseList: EscrowOrderRecord[];
    switch (activeTab) {
      case 'SELF_BUY':
        baseList = categorized.selfBuyOrders;
        break;
      case 'SELF_SELL':
        baseList = categorized.selfSellOrders;
        break;
      case 'COMPLETED':
        baseList = categorized.completedOrders;
        break;
      case 'ACTIVE':
        baseList = categorized.activeOrders;
        break;
      case 'ALL':
      default:
        baseList = categorized.allMyOrders;
        break;
    }

    return baseList.filter((o) => {
      if (assetFilter !== 'ALL' && o.asset !== assetFilter) return false;
      if (statusFilter !== 'ALL') {
        const config = getTradeStatusConfig(o.state, o.paymentReference);
        if (config.badgeType !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchId = o.id.toLowerCase().includes(q);
        const matchAsset = o.asset.toLowerCase().includes(q);
        const matchFiat = o.fiatCurrency.toLowerCase().includes(q);
        const matchBuyer = getUserDisplayName(o.buyerId).toLowerCase().includes(q);
        const matchSeller = getUserDisplayName(o.sellerId).toLowerCase().includes(q);
        const matchPm = o.paymentMethod.toLowerCase().includes(q);
        const config = getTradeStatusConfig(o.state, o.paymentReference);
        const matchStatus =
          config.label.toLowerCase().includes(q) || config.subLabel.toLowerCase().includes(q);
        return matchId || matchAsset || matchFiat || matchBuyer || matchSeller || matchPm || matchStatus;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorized, activeTab, statusFilter, assetFilter, searchQuery, userNameMap]);

  useEffect(() => {
    if (displayedOrders.length > 0) {
      if (!selectedOrderId || !displayedOrders.some((o) => o.id === selectedOrderId)) {
        setSelectedOrderId(displayedOrders[0].id);
      }
    } else {
      setSelectedOrderId(null);
    }
  }, [displayedOrders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => displayedOrders.find((o) => o.id === selectedOrderId) || null,
    [displayedOrders, selectedOrderId]
  );

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const processPaymentEvidenceFile = (file: File) => {
    if (!file) return;
    setPaymentEvidenceFileName(file.name);
    setPaymentEvidenceFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;

      if (file.type.startsWith('image/') && !file.type.includes('svg') && file.size > 250 * 1024) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1400;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setPaymentEvidenceImage(compressed);
            setPaymentEvidenceFileSize(`${Math.round((compressed.length * 0.75) / 1024)} KB`);
            return;
          }
          setPaymentEvidenceImage(result);
        };
        img.src = result;
      } else {
        setPaymentEvidenceImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaymentEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPaymentEvidenceFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processPaymentEvidenceFile(file);
    }
  };

  const generateSampleReceiptInOrders = (order: EscrowOrderRecord) => {
    const ref = paymentRef.trim() || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setPaymentRef(ref);
    const sym = FIAT_SYMBOLS[order.fiatCurrency] || '$';
    const amountStr = `${sym}${formatMinor2(order.grossFiatMinor)} ${order.fiatCurrency}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <rect width="600" height="400" rx="16" fill="url(#g)"/>
      <rect x="20" y="20" width="560" height="360" rx="12" fill="#0B132B" stroke="#10b981" stroke-width="2"/>
      <circle cx="300" cy="70" r="26" fill="#10b981"/>
      <path d="M290 70l7 7 14-14" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="300" y="125" fill="#f8fafc" font-size="16" font-family="monospace" font-weight="bold" text-anchor="middle">PAYMENT CONFIRMED</text>
      <text x="300" y="155" fill="#10b981" font-size="20" font-family="monospace" font-weight="bold" text-anchor="middle">${amountStr}</text>
      <line x1="50" y1="180" x2="550" y2="180" stroke="#334155" stroke-width="1"/>
      <text x="50" y="210" fill="#94a3b8" font-size="12" font-family="sans-serif">Transaction Reference / UTR:</text>
      <text x="550" y="210" fill="#38bdf8" font-size="12" font-family="monospace" font-weight="bold" text-anchor="end">${ref}</text>
      <text x="50" y="245" fill="#94a3b8" font-size="12" font-family="sans-serif">Payment Rail:</text>
      <text x="550" y="245" fill="#f8fafc" font-size="12" font-family="sans-serif" text-anchor="end">${order.paymentMethod} Verified</text>
      <text x="50" y="280" fill="#94a3b8" font-size="12" font-family="sans-serif">Escrow Order ID:</text>
      <text x="550" y="280" fill="#a78bfa" font-size="12" font-family="monospace" text-anchor="end">${order.id}</text>
      <rect x="50" y="315" width="500" height="24" rx="4" fill="#1e293b"/>
      <text x="300" y="331" fill="#34d399" font-size="10" font-family="sans-serif" text-anchor="middle">Official Verified Transfer Confirmation Proof · Costorah 1:1 Escrow</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setPaymentEvidenceImage(dataUrl);
    setPaymentEvidenceFileName(`transfer-receipt-${ref.slice(-6)}.png`);
    setPaymentEvidenceFileSize('12.5 KB');
  };

  const handleMarkSent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setBusyAction('mark-sent');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onMarkPaymentSent(
        selectedOrder.id,
        paymentRef.trim() || `UTR-${Date.now().toString().slice(-8)}`,
        paymentNotes.trim() || 'Transferred via verified bank/payment rail',
        paymentEvidenceImage || undefined
      );
      setPaymentRef('');
      setPaymentNotes('');
      setPaymentEvidenceImage('');
      setPaymentEvidenceFileName('');
      setActionSuccess('Payment marked as sent with receipt proof. Escrow expiry timer is now frozen awaiting seller release.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark payment sent');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRelease = async () => {
    if (!selectedOrder) return;
    setBusyAction('release');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onConfirmAndRelease(selectedOrder.id);
      setActionSuccess('Escrow released! Order is now in Completed Orders.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to release escrow');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !disputeReason.trim()) return;
    setBusyAction('dispute');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onOpenDispute(selectedOrder.id, disputeReason.trim());
      setDisputeReason('');
      setActionSuccess('Dispute opened. Escrow remains locked for compliance review.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to open dispute');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !chatInput.trim()) return;
    setBusyAction('chat');
    setActionError(null);
    try {
      await onSendChatMessage(selectedOrder.id, chatInput.trim());
      setChatInput('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="costorah-orders-view">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>COSTORAH Escrow Order Ledger · Self Buy, Self Sell & Completed Trades</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1">
            My P2P Orders & Settlement History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inspect and manage your self buy orders, self sell orders, and completed escrow settlements in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateToMarket}
            className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            + New Trade in Marketplace
          </button>
        </div>
      </div>

      {/* Summary KPI Cards for Self Buy, Self Sell, Completed, and Total Orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          data-testid="orders-kpi-self-buy"
          onClick={() => setActiveTab('SELF_BUY')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'SELF_BUY'
              ? 'bg-emerald-500/15 border-emerald-500/50'
              : 'bg-[#131A24] border-white/[0.08] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Self Buy Orders</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {categorized.selfBuyOrders.length}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            Orders where you buy crypto with fiat
          </div>
        </button>

        <button
          type="button"
          data-testid="orders-kpi-self-sell"
          onClick={() => setActiveTab('SELF_SELL')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'SELF_SELL'
              ? 'bg-amber-500/15 border-amber-500/50'
              : 'bg-[#131A24] border-white/[0.08] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Self Sell Orders</span>
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {categorized.selfSellOrders.length}
          </div>
          <div className="text-[11px] text-amber-400 mt-1">
            Orders where you sell crypto & receive fiat
          </div>
        </button>

        <button
          type="button"
          data-testid="orders-kpi-completed"
          onClick={() => setActiveTab('COMPLETED')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'COMPLETED'
              ? 'bg-cyan-500/15 border-cyan-500/50'
              : 'bg-[#131A24] border-white/[0.08] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Completed Orders</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {categorized.completedOrders.length}
          </div>
          <div className="text-[11px] text-cyan-400 mt-1">
            Settled & verified escrow releases
          </div>
        </button>

        <button
          type="button"
          data-testid="orders-kpi-all"
          onClick={() => setActiveTab('ALL')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-blue-500/15 border-blue-500/50'
              : 'bg-[#131A24] border-white/[0.08] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total User Orders</span>
            <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {categorized.allMyOrders.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {categorized.activeOrders.length} currently in active escrow
          </div>
        </button>
      </div>

      {/* Your Published P2P Offers (Buy & Sell Ads) Section right inside Orders Page */}
      {onUpdateOfferStatus && onEditOffer && (
        <PublishedOffersManager
          offers={offers}
          currentUserId={currentUser.id}
          currentUser={currentUser}
          supportedPaymentMethods={supportedPaymentMethods}
          onUpdateOfferStatus={onUpdateOfferStatus}
          onEditOffer={onEditOffer}
        />
      )}

      {/* Category Tabs & Filter Bar */}
      <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Segmented Tabs */}
          <div
            role="tablist"
            aria-label="Order Category Filter"
            className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B0E14] border border-white/[0.08] rounded-lg"
          >
            {(
              [
                { id: 'ALL', label: `All Orders (${categorized.allMyOrders.length})` },
                { id: 'SELF_BUY', label: `Self Buy Orders (${categorized.selfBuyOrders.length})` },
                { id: 'SELF_SELL', label: `Self Sell Orders (${categorized.selfSellOrders.length})` },
                { id: 'COMPLETED', label: `Completed Orders (${categorized.completedOrders.length})` },
                { id: 'ACTIVE', label: `Active Escrow (${categorized.activeOrders.length})` },
              ] as { id: OrderCategoryTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-testid={`orders-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-[#0B0E14]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Crypto Asset Filter */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                data-testid="orders-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID, BTC, counterparty..."
                className="w-full sm:w-auto pl-8 pr-3 py-2 sm:py-1.5 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto sm:min-w-[230px]">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <CustomSelect
                testId="orders-asset-filter"
                value={assetFilter}
                onChange={(val) => setAssetFilter(val as CryptoAsset | 'ALL')}
                options={buildCryptoAssetOptions(ALL_CRYPTO_ASSETS, {
                  includeAllLabel: 'All Assets (BTC, ETH, SOL, USDT, USDC)',
                })}
                searchable={false}
                size="sm"
                align="right"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Status Badges Quick Filter Bar */}
        <div
          data-testid="orders-status-filter-bar"
          className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/[0.06]"
        >
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <span>Status Badges:</span>
          </span>
          {(
            [
              { id: 'ALL', label: 'All States', count: statusCounts.ALL, icon: null },
              {
                id: 'ESCROW_LOCKED',
                label: 'Escrow Locked',
                count: statusCounts.ESCROW_LOCKED,
                icon: <Lock className="w-3 h-3 text-amber-400" />,
                activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30',
                inactiveClass: 'text-amber-300/80 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40',
              },
              {
                id: 'PAYMENT_SENT',
                label: 'Payment Sent',
                count: statusCounts.PAYMENT_SENT,
                icon: <Send className="w-3 h-3 text-cyan-400" />,
                activeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 ring-1 ring-cyan-500/30',
                inactiveClass: 'text-cyan-300/80 bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40',
              },
              {
                id: 'DISPUTED',
                label: 'Disputed',
                count: statusCounts.DISPUTED,
                icon: <AlertOctagon className="w-3 h-3 text-red-400" />,
                activeClass: 'bg-red-500/20 text-red-300 border-red-500/50 ring-1 ring-red-500/30',
                inactiveClass: 'text-red-300/80 bg-red-500/10 border-red-500/20 hover:border-red-500/40',
              },
              {
                id: 'RELEASED',
                label: 'Released',
                count: statusCounts.RELEASED,
                icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
                activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 ring-1 ring-emerald-500/30',
                inactiveClass: 'text-emerald-300/80 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40',
              },
              {
                id: 'CANCELLED',
                label: 'Cancelled',
                count: statusCounts.CANCELLED,
                icon: <XCircle className="w-3 h-3 text-slate-400" />,
                activeClass: 'bg-slate-700/50 text-slate-200 border-slate-500 ring-1 ring-slate-400/20',
                inactiveClass: 'text-slate-400 bg-slate-800/40 border-slate-700/50 hover:border-slate-600',
              },
            ] as const
          ).map((item) => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`orders-status-filter-${item.id.toLowerCase()}`}
                onClick={() => setStatusFilter(item.id as 'ALL' | TradeBadgeType)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'activeClass' in item && item.activeClass
                      ? item.activeClass
                      : 'bg-white/15 text-white border-white/30 ring-1 ring-white/20'
                    : 'inactiveClass' in item && item.inactiveClass
                    ? item.inactiveClass
                    : 'text-slate-400 border-white/10 hover:border-white/20'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/40 text-slate-300 font-bold">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Master-Detail Split Layout: Orders Table + Selected Order Inspector */}
      {displayedOrders.length === 0 ? (
        <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-12 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-200">
            No orders found in this category ({activeTab.replace('_', ' ')}).
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Switch tabs above or visit the P2P Marketplace to buy or sell BTC, ETH, SOL, USDT, or USDC with instant escrow protection.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {activeTab !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setAssetFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-[#0B0E14] border border-white/15 rounded-lg hover:border-white/30 cursor-pointer"
              >
                View All Orders
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateToMarket}
              className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
            >
              Browse Marketplace Offers
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Orders List Table (7 cols) */}
          <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                Showing {displayedOrders.length} Order{displayedOrders.length === 1 ? '' : 's'}
              </span>
              <span className="font-mono text-slate-400">
                Click any order row to inspect escrow & settlement
              </span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {displayedOrders.map((order) => {
                const isSelfBuy = order.buyerId === currentUser.id;
                const isSelected = selectedOrder?.id === order.id;
                const sym = FIAT_SYMBOLS[order.fiatCurrency];
                const badge = getOrderStatusBadgeDescriptor(order.state, order.paymentReference);
                const counterpartyName = isSelfBuy
                  ? getUserDisplayName(order.sellerId)
                  : getUserDisplayName(order.buyerId);

                return (
                  <div
                    key={order.id}
                    data-testid={`orders-row-${order.id}`}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setActionError(null);
                      setActionSuccess(null);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setTimeout(() => {
                          document.getElementById('order-inspector')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }
                    }}
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/[0.08] border-l-4 border-l-emerald-400'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <CryptoAssetIcon asset={order.asset} className="w-7 h-7 shrink-0" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded ${
                                isSelfBuy
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {isSelfBuy ? 'SELF BUY' : 'SELF SELL'}
                            </span>
                            <span className="font-bold text-slate-100 text-sm">
                              {formatMicro6(order.cryptoQuantityMicro)} {order.asset}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              #{order.id}
                            </span>
                            <TradeStatusBadge
                              state={order.state}
                              paymentReference={order.paymentReference}
                              variant="compact"
                            />
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Counterparty:{' '}
                            <span className="text-slate-200 font-medium">
                              {counterpartyName}
                            </span>{' '}
                            · Rail: <span className="text-slate-300">{order.paymentMethod}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <div className="text-sm font-bold text-slate-100">
                          {sym}
                          {formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Unit Price: {sym}
                          {formatMinor2(order.unitPriceFiatMinor)}/{order.asset}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                      <TradeStatusBadge
                        state={order.state}
                        paymentReference={order.paymentReference}
                        variant="detailed"
                      />
                      <div className="text-[11px] font-mono text-slate-400">
                        {isSelfBuy ? (
                          <span>You Pay: {sym}{formatMinor2(order.grossFiatMinor)}</span>
                        ) : (
                          <span className="text-emerald-400">
                            Net Proceeds (99%): {sym}{formatMinor2(order.sellerNetFiatMinor)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Order Execution & Settlement Inspector (5 cols) */}
          <div className="lg:col-span-5">
            {selectedOrder ? (
              <div
                id="order-inspector"
                data-testid="selected-order-inspector"
                className="bg-[#131A24] border border-white/15 rounded-xl overflow-hidden space-y-5 p-5 scroll-mt-20"
              >
                {(() => {
                  const isSelfBuy = selectedOrder.buyerId === currentUser.id;
                  const isSelfSell = selectedOrder.sellerId === currentUser.id;
                  const sym = FIAT_SYMBOLS[selectedOrder.fiatCurrency];
                  const badge = getOrderStatusBadgeDescriptor(
                    selectedOrder.state,
                    selectedOrder.paymentReference
                  );
                  const orderMessages = messagesByOrder[selectedOrder.id] || [];

                  return (
                    <>
                      {/* Inspector Header */}
                      <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                                isSelfBuy
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {isSelfBuy ? 'Self Buy Order' : 'Self Sell Order'}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              Order #{selectedOrder.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(selectedOrder.id)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                              title="Copy Order ID"
                            >
                              {copiedId === selectedOrder.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <h2 className="text-lg font-bold text-slate-100 font-display mt-1">
                            {isSelfBuy ? 'Buy' : 'Sell'} {formatMicro6(selectedOrder.cryptoQuantityMicro)}{' '}
                            {selectedOrder.asset}
                          </h2>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(null)}
                            className="lg:hidden px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-[#0B0E14] border border-white/10 rounded-lg hover:text-white cursor-pointer"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenTradeRoom(selectedOrder.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <span>Full Trade Room</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {/* Distinct Color-Coded Status Badge in Inspector */}
                      <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-xl flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            Current Trade State
                          </div>
                          <TradeStatusBadge
                            state={selectedOrder.state}
                            paymentReference={selectedOrder.paymentReference}
                            variant="detailed"
                          />
                        </div>
                        <div className="text-right text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/10 font-bold">
                            Stage {badge.stepNumber} of {badge.totalSteps}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1 max-w-[220px] truncate sm:max-w-none">
                            {badge.stepSummary}
                          </div>
                        </div>
                      </div>

                      {/* Financial & Escrow Breakdown */}
                      <div className="p-4 bg-[#0B0E14] border border-white/[0.08] rounded-lg space-y-2 text-xs font-mono tabular-nums">
                        <div className="flex justify-between text-slate-400">
                          <span>Buyer Counterparty:</span>
                          <span className="text-slate-200 font-sans font-medium">
                            {getUserDisplayName(selectedOrder.buyerId)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Seller Counterparty:</span>
                          <span className="text-slate-200 font-sans font-medium">
                            {getUserDisplayName(selectedOrder.sellerId)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 pt-1.5 border-t border-white/[0.06]">
                          <span>Crypto Unit Price:</span>
                          <span className="text-slate-100 font-semibold">
                            {sym}
                            {formatMinor2(selectedOrder.unitPriceFiatMinor)} / {selectedOrder.asset}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Gross Fiat Value:</span>
                          <span className="text-slate-100 font-bold">
                            {sym}
                            {formatMinor2(selectedOrder.grossFiatMinor)} {selectedOrder.fiatCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Platform Escrow Fee (1.00% Seller):</span>
                          <span className="text-amber-400">
                            -{sym}
                            {formatMinor2(selectedOrder.platformFeeFiatMinor)} {selectedOrder.fiatCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300 pt-1.5 border-t border-white/[0.06]">
                          <span>Seller Net Proceeds (99.00%):</span>
                          <span className="text-emerald-400 font-bold">
                            {sym}
                            {formatMinor2(selectedOrder.sellerNetFiatMinor)} {selectedOrder.fiatCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Payment Method:</span>
                          <span className="text-slate-100 font-sans font-semibold">
                            {selectedOrder.paymentMethod}
                          </span>
                        </div>
                        {selectedOrder.paymentReference && (
                          <div className="flex justify-between text-slate-300">
                            <span>Payment Reference / UTR:</span>
                            <span className="text-cyan-300 font-semibold">
                              {selectedOrder.paymentReference}
                            </span>
                          </div>
                        )}
                      </div>

                      {actionError && (
                        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{actionError}</span>
                        </div>
                      )}

                      {actionSuccess && (
                        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{actionSuccess}</span>
                        </div>
                      )}

                      {/* Interactive Settlement Actions based on Role & Order State */}
                      {(selectedOrder.state === 'PAYMENT_PENDING' ||
                        selectedOrder.state === 'ESCROW_LOCKED') &&
                        isSelfBuy && (
                          <form
                            onSubmit={handleMarkSent}
                            className="p-4 bg-[#0B0E14] border border-emerald-500/30 rounded-lg space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                              <span>
                                Step 2: Send {sym}
                                {formatMinor2(selectedOrder.grossFiatMinor)} via {selectedOrder.paymentMethod}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const r = `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
                                  setPaymentRef(r);
                                }}
                                className="text-[10px] text-cyan-400 hover:underline font-mono"
                              >
                                + Auto UTR
                              </button>
                            </div>

                            <input
                              type="text"
                              required
                              value={paymentRef}
                              onChange={(e) => setPaymentRef(e.target.value)}
                              placeholder="Enter bank UTR / transfer reference ID *"
                              className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                            />

                            {/* Payment Receipt Image Upload in OrdersView */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-300">
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Payment Receipt Screenshot</span>
                                </span>
                                {paymentEvidenceImage && (
                                  <span className="text-[10px] text-emerald-400 font-mono">Receipt Attached ✓</span>
                                )}
                              </div>

                              <input
                                id="orders-inspector-file-input"
                                type="file"
                                accept="image/*"
                                onChange={handlePaymentEvidenceUpload}
                                className="hidden"
                              />

                              {!paymentEvidenceImage ? (
                                <div
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  onDrop={handleDrop}
                                  className={`p-3 rounded-lg text-center space-y-1.5 transition-all border-2 border-dashed ${
                                    isDragging
                                      ? 'border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-500/20 scale-[1.01]'
                                      : 'bg-[#131A24] border-white/15 hover:border-emerald-500/40'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => document.getElementById('orders-inspector-file-input')?.click()}
                                    className="px-3.5 py-2 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium cursor-pointer inline-flex items-center gap-1.5 shadow-sm min-h-[40px]"
                                  >
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>Upload Payment Proof</span>
                                  </button>
                                  <p className="text-[10px] text-slate-400">
                                    {isDragging ? 'Drop receipt screenshot here!' : 'Drag and drop or browse screenshot'}
                                  </p>
                                  <div className="flex items-center justify-center gap-2 pt-1 border-t border-white/[0.06]">
                                    <button
                                      type="button"
                                      onClick={() => generateSampleReceiptInOrders(selectedOrder)}
                                      className="text-[10px] text-cyan-300 hover:underline cursor-pointer font-mono"
                                    >
                                      ⚡ Auto-Generate Receipt
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 bg-[#131A24] border border-emerald-500/40 rounded-lg flex items-center justify-between gap-2">
                                  <div
                                    onClick={() => setReceiptModalImage(paymentEvidenceImage)}
                                    className="flex items-center gap-2 cursor-pointer min-w-0"
                                  >
                                    <img
                                      src={paymentEvidenceImage}
                                      alt="Receipt preview"
                                      className="w-10 h-10 object-cover rounded border border-emerald-500/30 shrink-0"
                                    />
                                    <div className="min-w-0 text-left">
                                      <div className="text-[11px] font-semibold text-emerald-300 truncate">
                                        {paymentEvidenceFileName || 'Receipt.png'}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {paymentEvidenceFileSize || 'Verified proof'} · Click to inspect
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setReceiptModalImage(paymentEvidenceImage)}
                                      className="p-1 text-slate-300 hover:text-white rounded"
                                      title="Inspect Receipt"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPaymentEvidenceImage('');
                                        setPaymentEvidenceFileName('');
                                        setPaymentEvidenceFileSize('');
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-400 rounded"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <input
                              type="text"
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="Optional payment note to seller"
                              className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                            />

                            <button
                              type="submit"
                              disabled={busyAction !== null}
                              className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{busyAction === 'mark-sent' ? 'Marking Sent...' : 'Mark Payment Sent with Proof'}</span>
                            </button>
                          </form>
                        )}

                      {/* Display Uploaded Payment Receipt Proof if Available */}
                      {selectedOrder.paymentEvidenceUrl && (
                        <div className="p-3 bg-[#0B0E14] border border-emerald-500/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Attached Payment Receipt</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setReceiptModalImage(selectedOrder.paymentEvidenceUrl || null)}
                              className="text-[11px] text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <ZoomIn className="w-3 h-3" />
                              <span>Inspect Full</span>
                            </button>
                          </div>

                          <div
                            onClick={() => setReceiptModalImage(selectedOrder.paymentEvidenceUrl || null)}
                            className="rounded overflow-hidden border border-white/10 bg-black/40 max-h-36 flex items-center justify-center cursor-pointer group"
                          >
                            <img
                              src={selectedOrder.paymentEvidenceUrl}
                              alt="Payment Evidence Proof"
                              className="max-h-36 w-auto object-contain group-hover:scale-102 transition-transform"
                            />
                          </div>
                        </div>
                      )}

                      {selectedOrder.state === 'PAYMENT_MARKED_SENT' && (
                        <div className="p-4 bg-[#0B0E14] border border-amber-500/40 rounded-lg space-y-3">
                          <div className="text-xs font-semibold text-amber-300">
                            Payment Declared Sent ({selectedOrder.paymentReference || 'Verified Rail'})
                          </div>
                          <p className="text-xs text-slate-300">
                            Verify receipt of {sym}
                            {formatMinor2(selectedOrder.grossFiatMinor)} in your bank account before releasing{' '}
                            {formatMicro6(selectedOrder.cryptoQuantityMicro)} {selectedOrder.asset} from escrow.
                          </p>
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={handleRelease}
                            className="w-full py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {busyAction === 'release'
                                ? 'Releasing Escrow...'
                                : isSelfSell
                                ? `Confirm Receipt & Release ${formatMicro6(selectedOrder.cryptoQuantityMicro)} ${selectedOrder.asset}`
                                : `Confirm Receipt & Release Escrow (Simulate Seller)`}
                            </span>
                          </button>
                        </div>
                      )}

                      {selectedOrder.state === 'COMPLETED' && (
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-200 flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-semibold">Escrow Settlement Completed</div>
                            <div className="text-emerald-300/80 text-[11px]">
                              {formatMicro6(selectedOrder.cryptoQuantityMicro)} {selectedOrder.asset} credited to buyer custody · 1% fee settled.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notify Counterparty User of Payment Completion (Alert + Direct Message) */}
                      {(selectedOrder.state === 'PAYMENT_MARKED_SENT' ||
                        selectedOrder.state === 'COMPLETED') && (
                        <div
                          data-testid="orders-view-notify-payment-box"
                          className="p-4 bg-[#0B0E14] border border-emerald-500/35 rounded-xl space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                              <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Notify User of Payment Completion</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setNotifyChannel('IN_APP')}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                  notifyChannel === 'IN_APP'
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-[#131A24] border-white/10 text-slate-400'
                                }`}
                              >
                                In-App + Chat
                              </button>
                              <button
                                type="button"
                                onClick={() => setNotifyChannel('BOTH')}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                  notifyChannel === 'BOTH'
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-[#131A24] border-white/10 text-slate-400'
                                }`}
                              >
                                In-App + Email
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400">
                            Send an instant alert &amp; message to{' '}
                            <span className="text-slate-200 font-semibold">
                              {getUserDisplayName(
                                isSelfBuy ? selectedOrder.sellerId : selectedOrder.buyerId
                              ).replace(' (You)', '')}
                            </span>{' '}
                            informing them that payment of {sym}
                            {formatMinor2(selectedOrder.grossFiatMinor)} {selectedOrder.fiatCurrency} is completed.
                          </p>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              data-testid="orders-notify-payment-input"
                              value={notifyInput}
                              onChange={(e) => setNotifyInput(e.target.value)}
                              placeholder={`Payment of ${sym}${formatMinor2(selectedOrder.grossFiatMinor)} ${selectedOrder.fiatCurrency} (Ref: ${selectedOrder.paymentReference || 'UTR-VERIFIED'}) is completed...`}
                              className="flex-1 px-3 py-1.5 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                            />
                            <button
                              type="button"
                              data-testid="orders-send-payment-alert-btn"
                              disabled={busyAction !== null}
                              onClick={async () => {
                                setBusyAction('notify-payment');
                                setActionError(null);
                                setActionSuccess(null);
                                const recipientName = getUserDisplayName(
                                  isSelfBuy ? selectedOrder.sellerId : selectedOrder.buyerId
                                ).replace(' (You)', '');
                                const defaultText =
                                  selectedOrder.state === 'COMPLETED'
                                    ? `Payment & escrow settlement completed for Order #${selectedOrder.id} (${sym}${formatMinor2(selectedOrder.grossFiatMinor)} ${selectedOrder.fiatCurrency} · ${formatMicro6(selectedOrder.cryptoQuantityMicro)} ${selectedOrder.asset} released)!`
                                    : `Payment of ${sym}${formatMinor2(selectedOrder.grossFiatMinor)} ${selectedOrder.fiatCurrency} via ${selectedOrder.paymentMethod} is completed (Ref: ${selectedOrder.paymentReference || 'UTR-VERIFIED'}). Please check your account and release ${formatMicro6(selectedOrder.cryptoQuantityMicro)} ${selectedOrder.asset}.`;
                                const finalMsg = notifyInput.trim() || defaultText;
                                try {
                                  if (onNotifyPaymentCompleted) {
                                    await onNotifyPaymentCompleted({
                                      orderId: selectedOrder.id,
                                      customMessage: finalMsg,
                                      channel: notifyChannel,
                                    });
                                  } else {
                                    await onSendChatMessage(
                                      selectedOrder.id,
                                      `🔔 PAYMENT COMPLETION ALERT TO ${recipientName.toUpperCase()}: ${finalMsg}`
                                    );
                                  }
                                  setNotifyInput('');
                                  setActionSuccess(
                                    `Payment completion alert & message delivered to ${recipientName}!`
                                  );
                                } catch (err: unknown) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to send payment completion alert'
                                  );
                                } finally {
                                  setBusyAction(null);
                                }
                              }}
                              className="px-3.5 py-1.5 text-xs font-bold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              <span>
                                {busyAction === 'notify-payment' ? 'Sending...' : 'Notify User'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Dispute & Double-Confirm Cancel Trigger for Active Orders */}
                      {(selectedOrder.state === 'PAYMENT_PENDING' ||
                        selectedOrder.state === 'ESCROW_LOCKED' ||
                        selectedOrder.state === 'PAYMENT_MARKED_SENT') && (
                        <div className="space-y-2.5">
                          <form onSubmit={handleDispute} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={disputeReason}
                              onChange={(e) => setDisputeReason(e.target.value)}
                              placeholder="Need help? Enter dispute reason..."
                              className="flex-1 px-3 py-1.5 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                            />
                            <button
                              type="submit"
                              disabled={busyAction !== null || !disputeReason.trim()}
                              className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              Open Dispute
                            </button>
                          </form>

                          {onCancelOrder &&
                            (selectedOrder.state === 'PAYMENT_PENDING' ||
                              selectedOrder.state === 'ESCROW_LOCKED') && (
                              <div>
                                {confirmCancelOrderId === selectedOrder.id ? (
                                  <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg space-y-2 text-xs">
                                    <div className="font-semibold text-red-200 flex items-center gap-1.5">
                                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                      <span>Confirm Cancel Order #{selectedOrder.id}?</span>
                                    </div>
                                    <p className="text-red-200/80 text-[11px]">
                                      Cancelling this order will return 100% of the locked {selectedOrder.asset} escrow back to the seller.
                                    </p>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmCancelOrderId(null)}
                                        className="px-3 py-1 text-xs font-medium text-slate-300 bg-[#0B0E14] border border-white/10 rounded cursor-pointer"
                                      >
                                        No, Keep Order
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyAction === 'cancel-order'}
                                        onClick={async () => {
                                          setBusyAction('cancel-order');
                                          setActionError(null);
                                          try {
                                            await onCancelOrder(selectedOrder.id, 'Cancelled by user with confirmation');
                                            setConfirmCancelOrderId(null);
                                            setActionSuccess(`Order #${selectedOrder.id} cancelled.`);
                                          } catch (err: unknown) {
                                            setActionError(
                                              err instanceof Error ? err.message : 'Failed to cancel order'
                                            );
                                          } finally {
                                            setBusyAction(null);
                                          }
                                        }}
                                        className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-400 rounded cursor-pointer"
                                      >
                                        {busyAction === 'cancel-order' ? 'Cancelling...' : 'Yes, Confirm Cancel'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCancelOrderId(selectedOrder.id)}
                                    className="w-full py-2 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Cancel Order (Requires Confirmation)</span>
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      )}

                      {/* Counterparty Order Chat */}
                      <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                        <div className="text-xs font-semibold text-slate-300">
                          Encrypted Order Audit & Chat Log ({orderMessages.length})
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-2 p-3 bg-[#0B0E14] border border-white/[0.06] rounded-lg">
                          {orderMessages.map((msg: TradeMessage) => (
                            <div key={msg.id} className="text-xs space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span
                                  className={
                                    msg.senderRole === 'SYSTEM'
                                      ? 'text-emerald-400 font-mono font-semibold'
                                      : 'text-slate-200 font-semibold'
                                  }
                                >
                                  {msg.senderName} ({msg.senderRole})
                                </span>
                                <span className="font-mono">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-300">{msg.content}</p>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={handleSendChat} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Message counterparty in order log..."
                            className="flex-1 px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                          />
                          <button
                            type="submit"
                            disabled={busyAction === 'chat' || !chatInput.trim()}
                            className="px-3.5 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg cursor-pointer inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        </form>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR PAYMENT EVIDENCE INSPECTION */}
      {receiptModalImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={() => setReceiptModalImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-[#0F141C] border border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#131A24] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-100 font-display">
                  Payment Verification Receipt
                </span>
                {selectedOrder && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {selectedOrder.id}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={receiptModalImage}
                  download="payment-receipt.png"
                  className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReceiptModalImage(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center bg-black/60 min-h-[250px]">
              <img
                src={receiptModalImage}
                alt="Full Payment Receipt"
                className="max-h-[70vh] w-auto object-contain rounded shadow"
              />
            </div>

            {selectedOrder && (
              <div className="px-4 py-2.5 bg-[#0B0E14] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>UTR: {selectedOrder.paymentReference || 'N/A'}</span>
                <span>Rail: {selectedOrder.paymentMethod}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
