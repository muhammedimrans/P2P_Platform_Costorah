import React, { useState, useEffect, useMemo } from 'react';
import {
  FIAT_SYMBOLS,
  type EscrowOrderRecord,
  type OfferRecord,
  type OrderState,
  type TradeMessage,
  type UserProfile,
} from '../types';
import {
  formatMicro6,
  formatMinor2,
  PERMITTED_ORDER_TRANSITIONS,
} from '../core/escrowEngine';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Send,
  ArrowLeft,
  Building2,
  UploadCloud,
  ImageIcon,
  Eye,
  X,
  Trash2,
  FileCheck2,
  ExternalLink,
  ZoomIn,
  Clock,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TradeSettlementSummary } from './TradeSettlementSummary';

interface TradeRoomViewProps {
  order: EscrowOrderRecord;
  offer?: OfferRecord;
  messages: TradeMessage[];
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onBack: () => void;
  onSubmitPaymentSent: (params: {
    orderId: string;
    paymentReference: string;
    paymentEvidenceUrl?: string;
    note?: string;
  }) => Promise<void>;
  onConfirmAndRelease: (orderId: string) => Promise<void>;
  onOpenDispute: (orderId: string, reason: string) => Promise<void>;
  onSendMessage: (orderId: string, content: string, attachmentUrl?: string) => Promise<void>;
  onCancelOrder?: (orderId: string, reason?: string) => Promise<void>;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onTestPing?: (trigger: 'PENDING_PAYMENT' | 'TRADE_COMPLETED') => void;
}

const LIFECYCLE_STEPS = [
  { key: 'ORDER_RESERVED', label: '01. Inventory Reserved', sub: 'Offer Liquidity Earmarked' },
  { key: 'ESCROW_LOCKED', label: '02. Escrow Locked', sub: '1:1 Crypto Vaulted' },
  { key: 'PAYMENT_PENDING', label: '03. Fiat Payment Pending', sub: 'Buyer Transfer Window' },
  { key: 'PAYMENT_MARKED_SENT', label: '04. Payment Declared Sent', sub: 'UTR Logged · Timer Frozen' },
  { key: 'RELEASE_PENDING', label: '05. Seller Verification', sub: 'Bank Receipt Audit' },
  { key: 'COMPLETED', label: '06. Settlement Completed', sub: '100% Released to Buyer' },
] as const;

const SIXTEEN_STATE_PROTOCOL_NODES: ReadonlyArray<{
  code: OrderState;
  index: number;
  shortLabel: string;
  phase: 'LOCKING' | 'SETTLEMENT' | 'GUARDRAIL';
  progressPct: number;
}> = [
  { code: 'DRAFT', index: 1, shortLabel: 'Draft', phase: 'LOCKING', progressPct: 8 },
  { code: 'OFFER_OPEN', index: 2, shortLabel: 'Offer Open', phase: 'LOCKING', progressPct: 16 },
  { code: 'ORDER_RESERVED', index: 3, shortLabel: 'Reserved', phase: 'LOCKING', progressPct: 28 },
  { code: 'ESCROW_FUNDING', index: 4, shortLabel: 'Funding', phase: 'LOCKING', progressPct: 40 },
  { code: 'ESCROW_LOCKED', index: 5, shortLabel: 'Locked', phase: 'LOCKING', progressPct: 52 },
  { code: 'PAYMENT_PENDING', index: 6, shortLabel: 'Pay Pending', phase: 'SETTLEMENT', progressPct: 64 },
  { code: 'PAYMENT_MARKED_SENT', index: 7, shortLabel: 'Paid Sent', phase: 'SETTLEMENT', progressPct: 76 },
  { code: 'PAYMENT_REVIEW', index: 8, shortLabel: 'Pay Review', phase: 'SETTLEMENT', progressPct: 84 },
  { code: 'RELEASE_PENDING', index: 9, shortLabel: 'Release Wait', phase: 'SETTLEMENT', progressPct: 92 },
  { code: 'COMPLETED', index: 10, shortLabel: 'Completed', phase: 'SETTLEMENT', progressPct: 100 },
  { code: 'DISPUTED', index: 11, shortLabel: 'Disputed', phase: 'GUARDRAIL', progressPct: 76 },
  { code: 'ESCROW_RECOVERY_REQUIRED', index: 12, shortLabel: 'Recovery', phase: 'GUARDRAIL', progressPct: 80 },
  { code: 'REFUND_PENDING', index: 13, shortLabel: 'Refund Wait', phase: 'GUARDRAIL', progressPct: 88 },
  { code: 'REFUNDED', index: 14, shortLabel: 'Refunded', phase: 'GUARDRAIL', progressPct: 100 },
  { code: 'CANCELLED', index: 15, shortLabel: 'Cancelled', phase: 'GUARDRAIL', progressPct: 100 },
  { code: 'EXPIRED', index: 16, shortLabel: 'Expired', phase: 'GUARDRAIL', progressPct: 100 },
];

export const TradeRoomView: React.FC<TradeRoomViewProps> = ({
  order,
  offer,
  messages,
  currentUser,
  allUsers,
  onBack,
  onSubmitPaymentSent,
  onConfirmAndRelease,
  onOpenDispute,
  onSendMessage,
  onCancelOrder,
  soundEnabled = true,
  onToggleSound,
  onTestPing,
}) => {
  const [paymentRefInput, setPaymentRefInput] = useState(order.paymentReference || '');
  const [evidenceUrlInput, setEvidenceUrlInput] = useState(order.paymentEvidenceUrl || '');
  const [evidenceImage, setEvidenceImage] = useState<string>(order.paymentEvidenceUrl || '');
  const [evidenceFileName, setEvidenceFileName] = useState<string>('');
  const [evidenceFileSize, setEvidenceFileSize] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [showManualUrlInput, setShowManualUrlInput] = useState<boolean>(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'ESCROW' | 'CHAT'>('ESCROW');
  const [paymentNoteInput, setPaymentNoteInput] = useState('');
  const [disputeReasonInput, setDisputeReasonInput] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Escrow Protocol Payment Window Countdown Timer (30-minute default window)
  const paymentWindowSeconds = order.paymentWindowSeconds || 1800;
  const isPaymentWindowActive =
    order.state === 'PAYMENT_PENDING' ||
    order.state === 'ESCROW_LOCKED' ||
    order.state === 'ORDER_RESERVED' ||
    order.state === 'ESCROW_FUNDING';
  const isPaymentTimerFrozen =
    order.state === 'PAYMENT_MARKED_SENT' ||
    order.state === 'PAYMENT_REVIEW' ||
    order.state === 'RELEASE_PENDING';

  const targetDeadlineMs = useMemo(() => {
    const now = Date.now();
    if (order.expiresAt) {
      const parsed = new Date(order.expiresAt).getTime();
      if (!Number.isNaN(parsed) && parsed > now) {
        return parsed;
      }
    }
    if (order.createdAt) {
      const createdMs = new Date(order.createdAt).getTime();
      const candidate = createdMs + paymentWindowSeconds * 1000;
      if (!Number.isNaN(candidate) && candidate > now) {
        return candidate;
      }
    }
    // Fallback for active demo orders so the payment window always ticks live
    return now + 24 * 60 * 1000 + 45 * 1000;
  }, [order.id, order.expiresAt, order.createdAt, paymentWindowSeconds]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (isPaymentTimerFrozen) return 21 * 60 + 18;
    if (!isPaymentWindowActive) return 0;
    return Math.max(0, Math.floor((targetDeadlineMs - Date.now()) / 1000));
  });

  useEffect(() => {
    if (isPaymentTimerFrozen) {
      setRemainingSeconds((prev) => (prev > 0 ? prev : 21 * 60 + 18));
      return;
    }
    if (!isPaymentWindowActive) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((targetDeadlineMs - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
    };
    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(intervalId);
  }, [isPaymentWindowActive, isPaymentTimerFrozen, targetDeadlineMs]);

  const countdownMinutes = Math.floor(remainingSeconds / 60);
  const countdownSecs = remainingSeconds % 60;
  const formattedTimeRemaining = `${String(countdownMinutes).padStart(2, '0')}:${String(
    countdownSecs
  ).padStart(2, '0')}`;
  const remainingWindowPct = Math.min(
    100,
    Math.max(0, Math.round((remainingSeconds / paymentWindowSeconds) * 100))
  );
  const isUrgentWindow = isPaymentWindowActive && remainingSeconds > 0 && remainingSeconds < 300;
  const isWarningWindow =
    isPaymentWindowActive && remainingSeconds >= 300 && remainingSeconds < 600;

  const processEvidenceFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setActionError('Please select or drop an image file (PNG, JPG, WebP, SVG).');
      return;
    }
    setActionError(null);
    setEvidenceFileName(file.name);
    setEvidenceFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;

      // Optimize large photos with Canvas to keep payloads fast and responsive
      if (!file.type.includes('svg') && file.size > 200 * 1024) {
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
            setEvidenceImage(compressed);
            setEvidenceUrlInput(compressed);
            setEvidenceFileSize(`${Math.round((compressed.length * 0.75) / 1024)} KB (optimized)`);
            return;
          }
          setEvidenceImage(result);
          setEvidenceUrlInput(result);
        };
        img.src = result;
      } else {
        setEvidenceImage(result);
        setEvidenceUrlInput(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEvidenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processEvidenceFile(file);
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
    if (file) processEvidenceFile(file);
  };

  const handleClearEvidenceImage = () => {
    setEvidenceImage('');
    setEvidenceUrlInput('');
    setEvidenceFileName('');
    setEvidenceFileSize('');
  };

  const generateSampleReceipt = (type: 'UPI' | 'BANK') => {
    const ref = paymentRefInput.trim() || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setPaymentRefInput(ref);
    const amountStr = `${fiatSym}${formatMinor2(order.grossFiatMinor)} ${order.fiatCurrency}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <rect width="600" height="420" rx="16" fill="url(#bg)"/>
      <rect x="20" y="20" width="560" height="380" rx="12" fill="#0B132B" stroke="#10b981" stroke-width="2"/>
      <circle cx="300" cy="76" r="30" fill="#10b981"/>
      <path d="M288 76l8 8 16-16" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="300" y="132" fill="#f8fafc" font-size="18" font-family="monospace" font-weight="bold" text-anchor="middle">PAYMENT SUCCESSFUL</text>
      <text x="300" y="162" fill="#10b981" font-size="22" font-family="monospace" font-weight="bold" text-anchor="middle">${amountStr}</text>
      <line x1="50" y1="185" x2="550" y2="185" stroke="#334155" stroke-width="1"/>
      <text x="50" y="218" fill="#94a3b8" font-size="13" font-family="sans-serif">Transaction Reference / UTR:</text>
      <text x="550" y="218" fill="#38bdf8" font-size="13" font-family="monospace" font-weight="bold" text-anchor="end">${ref}</text>
      <text x="50" y="252" fill="#94a3b8" font-size="13" font-family="sans-serif">Payment Method Rail:</text>
      <text x="550" y="252" fill="#f8fafc" font-size="13" font-family="sans-serif" text-anchor="end">${order.paymentMethod} Verified</text>
      <text x="50" y="286" fill="#94a3b8" font-size="13" font-family="sans-serif">Beneficiary (Seller):</text>
      <text x="550" y="286" fill="#f8fafc" font-size="13" font-family="sans-serif" text-anchor="end">${sellerUser?.displayName || order.sellerId}</text>
      <text x="50" y="320" fill="#94a3b8" font-size="13" font-family="sans-serif">Costorah Escrow Order ID:</text>
      <text x="550" y="320" fill="#a78bfa" font-size="13" font-family="monospace" text-anchor="end">${order.id}</text>
      <rect x="50" y="348" width="500" height="26" rx="6" fill="#1e293b"/>
      <text x="300" y="365" fill="#34d399" font-size="11" font-family="sans-serif" text-anchor="middle">Official Verified Transfer Confirmation Proof · Costorah 1:1 Escrow</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setEvidenceImage(dataUrl);
    setEvidenceUrlInput(dataUrl);
    setEvidenceFileName(`${type.toLowerCase()}-transfer-receipt-${ref.slice(-6)}.png`);
    setEvidenceFileSize('14.2 KB');
  };

  const handleCancelOrder = async () => {
    if (!onCancelOrder) return;
    setActionError(null);
    setBusy(true);
    try {
      await onCancelOrder(
        order.id,
        cancelReasonInput.trim() || 'Order cancelled before payment. 100% of escrowed crypto released back to seller.'
      );
      setShowCancelConfirm(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setBusy(false);
    }
  };

  const buyerUser = allUsers.find((u) => u.id === order.buyerId);
  const sellerUser = allUsers.find((u) => u.id === order.sellerId);
  const fiatSym = FIAT_SYMBOLS[order.fiatCurrency];

  const getActiveStepIndex = () => {
    if (order.state === 'COMPLETED') return 5;
    if (order.state === 'RELEASE_PENDING' || order.state === 'PAYMENT_REVIEW') return 4;
    if (order.state === 'PAYMENT_MARKED_SENT') return 3;
    if (order.state === 'PAYMENT_PENDING') return 2;
    if (order.state === 'ESCROW_LOCKED' || order.state === 'ESCROW_FUNDING') return 1;
    return 0;
  };
  const currentStepIdx = getActiveStepIndex();

  const activeProtocolNode =
    SIXTEEN_STATE_PROTOCOL_NODES.find((n) => n.code === order.state) ||
    SIXTEEN_STATE_PROTOCOL_NODES[5];
  const permittedNextStates = PERMITTED_ORDER_TRANSITIONS[order.state] || [];
  const isTerminalOrderState =
    order.state === 'COMPLETED' ||
    order.state === 'CANCELLED' ||
    order.state === 'EXPIRED' ||
    order.state === 'REFUNDED';
  const isDisputeOrRecoveryState =
    order.state === 'DISPUTED' ||
    order.state === 'ESCROW_RECOVERY_REQUIRED' ||
    order.state === 'REFUND_PENDING';

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setBusy(true);
    try {
      await onSubmitPaymentSent({
        orderId: order.id,
        paymentReference: paymentRefInput,
        paymentEvidenceUrl: evidenceUrlInput,
        note: paymentNoteInput,
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit payment reference');
    } finally {
      setBusy(false);
    }
  };

  const handleSellerRelease = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await onConfirmAndRelease(order.id);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to release escrow');
    } finally {
      setBusy(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setBusy(true);
    try {
      await onOpenDispute(order.id, disputeReasonInput);
      setShowDisputeForm(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to open dispute');
    } finally {
      setBusy(false);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await onSendMessage(order.id, chatInput);
    setChatInput('');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Bar with Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white mb-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders & Marketplace</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 font-display break-all">
            Escrow Trade Room · <span className="font-mono text-emerald-400">{order.id}</span>
          </h1>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              data-testid="trade-room-header-state-pill"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-semibold transition-all ${
                order.state === 'COMPLETED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : isDisputeOrRecoveryState
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : isTerminalOrderState
                  ? 'bg-slate-800/80 border-white/10 text-slate-300'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {!isTerminalOrderState && (
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isDisputeOrRecoveryState ? 'bg-red-400' : 'bg-emerald-400'
                    }`}
                  />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    order.state === 'COMPLETED'
                      ? 'bg-emerald-400'
                      : isDisputeOrRecoveryState
                      ? 'bg-red-400'
                      : isTerminalOrderState
                      ? 'bg-slate-400'
                      : 'bg-emerald-400'
                  }`}
                />
              </span>
              <span>
                State {String(activeProtocolNode.index).padStart(2, '0')}/16: {order.state}
              </span>
            </span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span>Buyer: <span className="text-slate-200">{buyerUser?.displayName || order.buyerId}</span></span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span>Seller: <span className="text-slate-200">{sellerUser?.displayName || order.sellerId}</span></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Header Time Remaining Pill */}
          <div
            data-testid="trade-room-time-remaining-header"
            className={`px-3.5 py-2 rounded-xl border font-mono tabular-nums flex items-center gap-2.5 ${
              isPaymentWindowActive
                ? isUrgentWindow
                  ? 'bg-red-950/60 border-red-500/50 text-red-200'
                  : isWarningWindow
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                  : 'bg-[#131A24] border-emerald-500/40 text-slate-100'
                : isPaymentTimerFrozen
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                : 'bg-[#131A24] border-white/[0.08] text-slate-300'
            }`}
          >
            <Timer
              className={`w-4 h-4 shrink-0 ${
                isPaymentWindowActive
                  ? isUrgentWindow
                    ? 'text-red-400 animate-pulse'
                    : 'text-amber-400 animate-pulse'
                  : isPaymentTimerFrozen
                  ? 'text-cyan-400'
                  : 'text-emerald-400'
              }`}
            />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Time Remaining
              </div>
              <div className="text-sm sm:text-base font-bold leading-tight flex items-center gap-1.5">
                {isPaymentWindowActive ? (
                  <>
                    <span className={isUrgentWindow ? 'text-red-300' : 'text-amber-300'}>
                      {formattedTimeRemaining}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">m:ss</span>
                  </>
                ) : isPaymentTimerFrozen ? (
                  <span className="text-cyan-300">{formattedTimeRemaining} (Frozen)</span>
                ) : order.state === 'COMPLETED' ? (
                  <span className="text-emerald-400">Settled</span>
                ) : order.state === 'DISPUTED' ? (
                  <span className="text-red-400">Suspended</span>
                ) : (
                  <span className="text-slate-400">00:00 (Closed)</span>
                )}
              </div>
            </div>
          </div>

          {/* Audio Ping Notification Control */}
          <div
            data-testid="trade-room-sound-alert-box"
            className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#131A24] font-mono flex items-center gap-2"
          >
            <button
              type="button"
              data-testid="trade-room-sound-toggle-btn"
              onClick={onToggleSound}
              title={
                soundEnabled
                  ? 'Sound Ping Enabled for PENDING_PAYMENT & TRADE_COMPLETED'
                  : 'Sound Ping Muted — Click to Enable'
              }
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Audio Ping
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs font-bold ${soundEnabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {soundEnabled ? 'Active' : 'Muted'}
                </span>
                {onTestPing && (
                  <button
                    type="button"
                    data-testid="trade-room-test-ping-btn"
                    onClick={() =>
                      onTestPing(
                        order.state === 'COMPLETED' ? 'TRADE_COMPLETED' : 'PENDING_PAYMENT'
                      )
                    }
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 border border-white/10 cursor-pointer"
                    title="Preview subtle browser ping tone"
                  >
                    Test Ping
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start font-mono tabular-nums bg-[#131A24] sm:bg-transparent p-2.5 sm:p-0 rounded-lg sm:rounded-none border border-white/[0.06] sm:border-0 shrink-0">
            <div className="text-[11px] sm:text-xs text-slate-400">Escrow Locked Quantity</div>
            <div className="text-base sm:text-xl font-bold text-emerald-400">
              {formatMicro6(order.cryptoQuantityMicro)} {order.asset}
            </div>
          </div>
        </div>
      </div>

      {/* Escrow Protocol Payment Window Countdown Banner */}
      <div
        data-testid="trade-room-payment-window-card"
        className={`rounded-xl border p-4 transition-colors ${
          isPaymentWindowActive
            ? isUrgentWindow
              ? 'bg-red-950/30 border-red-500/40'
              : 'bg-[#131A24] border-amber-500/35'
            : isPaymentTimerFrozen
            ? 'bg-cyan-950/30 border-cyan-500/40'
            : 'bg-[#131A24] border-white/[0.08]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                isPaymentWindowActive
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : isPaymentTimerFrozen
                  ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-100 font-display">
                  Escrow Protocol Payment Window
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isPaymentWindowActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isPaymentTimerFrozen
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : order.state === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {isPaymentWindowActive
                    ? 'Active Countdown'
                    : isPaymentTimerFrozen
                    ? 'Timer Frozen · Buyer Protected'
                    : order.state === 'COMPLETED'
                    ? 'Completed in Window'
                    : order.state}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isPaymentWindowActive
                  ? `Buyer must remit ${fiatSym}${formatMinor2(order.grossFiatMinor)} ${
                      order.fiatCurrency
                    } via ${
                      order.paymentMethod
                    } and submit the transfer UTR before the 30-minute escrow payment window expires.`
                  : isPaymentTimerFrozen
                  ? `Buyer submitted payment reference (${
                      order.paymentReference || 'Verified UTR'
                    }). Automatic expiration is frozen under protocol rules until Seller verifies bank receipt.`
                  : order.state === 'COMPLETED'
                  ? 'Fiat payment was verified within the protocol window and 100% of escrowed crypto has been released.'
                  : 'Payment window timer is inactive for the current order state.'}
              </p>
            </div>
          </div>

          <div className="sm:text-right font-mono tabular-nums shrink-0 bg-[#0B0E14] px-4 py-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Time Remaining
            </div>
            <div
              data-testid="trade-room-countdown-value"
              className={`text-xl sm:text-2xl font-black tracking-tight ${
                isPaymentWindowActive
                  ? isUrgentWindow
                    ? 'text-red-400'
                    : 'text-amber-300'
                  : isPaymentTimerFrozen
                  ? 'text-cyan-300'
                  : 'text-emerald-400'
              }`}
            >
              {isPaymentWindowActive || isPaymentTimerFrozen ? formattedTimeRemaining : '00:00'}
            </div>
            <div className="text-[10px] text-slate-400">
              {isPaymentWindowActive
                ? `${remainingWindowPct}% of ${Math.round(paymentWindowSeconds / 60)}m window left`
                : isPaymentTimerFrozen
                ? 'Paused at UTR submission'
                : 'Protocol window'}
            </div>
          </div>
        </div>

        {/* Visual Payment Window Progress Bar */}
        {(isPaymentWindowActive || isPaymentTimerFrozen) && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-1">
            <div className="h-2 w-full bg-[#0B0E14] rounded-full overflow-hidden border border-white/[0.08]">
              <div
                style={{ width: `${isPaymentTimerFrozen ? 71 : remainingWindowPct}%` }}
                className={`h-full transition-all duration-500 rounded-full ${
                  isPaymentTimerFrozen
                    ? 'bg-cyan-400'
                    : isUrgentWindow
                    ? 'bg-red-500'
                    : isWarningWindow
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Order Locked: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>
                {isPaymentTimerFrozen
                  ? 'Auto-Expiry Suspended (ESCROW_LOCKED → PAYMENT_MARKED_SENT)'
                  : `Protocol Window: ${Math.round(paymentWindowSeconds / 60)}:00 mins`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Formal 16-State Escrow Machine Stepper with Subtle Progress Indicator & Animation */}
      <div
        data-testid="escrow-16-state-progression-card"
        className="bg-[#131A24] border border-white/[0.08] rounded-xl p-3.5 sm:p-4 space-y-3.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Lock
                className={`w-3.5 h-3.5 ${
                  order.state === 'COMPLETED'
                    ? 'text-emerald-400'
                    : isDisputeOrRecoveryState
                    ? 'text-red-400 animate-pulse'
                    : !isTerminalOrderState
                    ? 'text-emerald-400 animate-pulse'
                    : 'text-slate-400'
                }`}
              />
              <span>Formal 16-State Escrow Engine Progression</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-[#0B0E14] border border-white/10 font-mono text-[11px] text-slate-300">
              Node <span className="text-emerald-400 font-bold">{String(activeProtocolNode.index).padStart(2, '0')}</span>/16 ·{' '}
              <span className="text-slate-100 font-semibold">{order.state}</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] font-mono tabular-nums">
            <span className="text-slate-400">
              {order.state === 'COMPLETED'
                ? 'Escrow Released (100%)'
                : isDisputeOrRecoveryState
                ? 'Arbitration Lock Active'
                : isTerminalOrderState
                ? 'Vault Closed'
                : `Escrow Lock Progress: ${activeProtocolNode.progressPct}%`}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                order.state === 'COMPLETED'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : isDisputeOrRecoveryState
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                  : isPaymentTimerFrozen
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
              }`}
            >
              {activeProtocolNode.progressPct}%
            </span>
          </div>
        </div>

        {/* Continuous Animated 16-State Progress Track */}
        <div className="space-y-1.5">
          <div
            data-testid="escrow-state-progress-bar"
            className="relative h-2 w-full bg-[#0B0E14] rounded-full overflow-hidden border border-white/[0.08]"
          >
            <div
              style={{ width: `${activeProtocolNode.progressPct}%` }}
              className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                order.state === 'COMPLETED'
                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300'
                  : isDisputeOrRecoveryState
                  ? 'bg-gradient-to-r from-amber-500 via-red-500 to-red-400 animate-pulse'
                  : isTerminalOrderState
                  ? 'bg-slate-600'
                  : isPaymentTimerFrozen
                  ? 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-sky-300 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-cyan-400 animate-pulse'
              }`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
            <span>
              Phase: <span className="text-slate-200 font-semibold">{activeProtocolNode.phase}</span>
            </span>
            <span>
              {permittedNextStates.length > 0 ? (
                <>
                  Permitted Next Transitions:{' '}
                  <span className="text-cyan-300">{permittedNextStates.join(' → ')}</span>
                </>
              ) : (
                <span className="text-emerald-400">Terminal Protocol State Reached (Immutable Ledger Record)</span>
              )}
            </span>
          </div>
        </div>

        {/* 6 Primary Settlement Milestones with Active Pulse Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isDone =
              idx <= currentStepIdx &&
              order.state !== 'DISPUTED' &&
              order.state !== 'REFUNDED' &&
              order.state !== 'CANCELLED' &&
              order.state !== 'EXPIRED';
            const isCurrentActive =
              idx === currentStepIdx && !isTerminalOrderState && !isDisputeOrRecoveryState;

            return (
              <div
                key={step.key}
                className={`relative overflow-hidden p-2.5 rounded-lg border text-xs transition-all duration-300 ${
                  order.state === 'DISPUTED'
                    ? 'bg-red-950/30 border-red-500/30 text-red-200'
                    : isCurrentActive
                    ? 'bg-emerald-950/45 border-emerald-400/70 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                    : isDone
                    ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300 font-semibold'
                    : 'bg-[#0B0E14] border-white/[0.06] text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate font-semibold">{step.label}</span>
                  {isCurrentActive ? (
                    <span className="relative flex h-2 w-2 shrink-0" title="Active Escrow Stage">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                  ) : isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : null}
                </div>
                <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                  {step.sub}
                </div>
                {isCurrentActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Compact 16-State Protocol Matrix Strip */}
        <div
          data-testid="sixteen-state-matrix-strip"
          className="pt-2.5 border-t border-white/[0.06]"
        >
          <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16 gap-1">
            {SIXTEEN_STATE_PROTOCOL_NODES.map((node) => {
              const isCurrent = node.code === order.state;
              const isNextAllowed = permittedNextStates.includes(node.code);
              const isPassedPrimary =
                node.phase !== 'GUARDRAIL' &&
                activeProtocolNode.phase !== 'GUARDRAIL' &&
                node.index < activeProtocolNode.index;

              return (
                <div
                  key={node.code}
                  title={`State ${String(node.index).padStart(2, '0')}: ${node.code} (${node.phase})`}
                  className={`px-1.5 py-1 rounded border text-[9px] font-mono text-center truncate transition-all ${
                    isCurrent
                      ? isDisputeOrRecoveryState
                        ? 'bg-red-500/20 border-red-400 text-red-200 font-bold ring-1 ring-red-400/50 animate-pulse'
                        : 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold ring-1 ring-emerald-400/50'
                      : isNextAllowed
                      ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 border-dashed'
                      : isPassedPrimary
                      ? 'bg-emerald-950/25 border-emerald-500/25 text-emerald-400/80'
                      : 'bg-[#0B0E14]/80 border-white/[0.05] text-slate-500'
                  }`}
                >
                  <div className="text-[8px] opacity-75">#{String(node.index).padStart(2, '0')}</div>
                  <div className="truncate">{node.shortLabel}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-3.5 bg-red-950/70 border border-red-500/40 rounded-lg text-xs text-red-200">
          {actionError}
        </div>
      )}

      {/* Mobile Tab Switcher (< lg screens) */}
      <div className="flex lg:hidden rounded-xl bg-[#131A24] p-1 border border-white/[0.08] gap-1">
        <button
          type="button"
          onClick={() => setMobileActiveTab('ESCROW')}
          className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            mobileActiveTab === 'ESCROW'
              ? 'bg-emerald-400 text-[#0B0E14] shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Escrow &amp; Payment</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTab('CHAT')}
          className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            mobileActiveTab === 'CHAT'
              ? 'bg-emerald-400 text-[#0B0E14] shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Trade Chat ({messages.length})</span>
        </button>
      </div>

      {/* Main 2-Column Split: Left = Escrow & Payment Controls, Right = Audit Trail & Counterparty Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={`lg:col-span-7 space-y-6 ${mobileActiveTab === 'ESCROW' ? 'block' : 'hidden lg:block'}`}>
          {/* Real-Time Trade Settlement Summary Component */}
          <TradeSettlementSummary
            order={order}
            buyerUser={buyerUser}
            sellerUser={sellerUser}
            currentUser={currentUser}
          />

          {/* Agreed Fiat Payment Rail & Anti-Fraud Security Notice */}
          <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="font-bold text-slate-100 font-display flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Agreed Payment Rail: {order.paymentMethod}</span>
              </div>
              <span className="font-mono text-slate-400 text-[11px]">
                Unit Price: {fiatSym}
                {formatMinor2(order.unitPriceFiatMinor)} {order.fiatCurrency}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed font-sans">
              {offer?.paymentInstructions ||
                'Remit exact fiat amount to seller verified bank account and paste the transaction reference below. Never include crypto terms in bank remarks.'}
            </p>
            <p className="text-slate-500 text-[11px] pt-1">
              Security Notice: Costorah escrow never collects bank passwords, PINs, or card CVVs. Screenshots are supporting evidence only; crypto releases only upon verified fiat receipt in seller bank account.
            </p>
          </div>

          {/* Cancellation Notice if Order is CANCELLED */}
          {order.state === 'CANCELLED' && (
            <div className="bg-[#131A24] border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-200 font-display flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Order Cancelled — Escrow Crypto Released</span>
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  CANCELLED
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This order was cancelled before fiat payment was marked sent. 100% of the escrowed crypto ({formatMicro6(order.cryptoQuantityMicro)} {order.asset}) has been released back to the seller.
              </p>
              {order.disputeResolutionNote && (
                <div className="p-3 bg-[#0B0E14] rounded-lg text-xs font-mono text-slate-400 border border-white/[0.06]">
                  Cancellation Record: {order.disputeResolutionNote}
                </div>
              )}
            </div>
          )}

          {/* Step Action Panel based on current OrderState */}
          {order.state === 'PAYMENT_PENDING' && (
            <form
              onSubmit={handleMarkPaid}
              className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Step 1 (Buyer Action): Submit Fiat Payment & Verification Receipt
                </h3>
                <span className="text-xs px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded font-medium">
                  Awaiting Payment
                </span>
              </div>

              <p className="text-xs text-slate-400">
                After completing the external bank/UPI transfer of{' '}
                <span className="font-mono text-emerald-400 font-semibold">
                  {fiatSym}
                  {formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
                </span>{' '}
                to the seller's account, upload your payment receipt or transfer screenshot below. Submitting payment freezes the automatic expiration timer and notifies the seller to verify receipt.
              </p>

              {/* Reference ID Input with Auto-Fill helper */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="payment-ref-input" className="block text-xs font-medium text-slate-300">
                    Bank Reference / UTR / Transaction ID *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const ref = `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
                      setPaymentRefInput(ref);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-mono"
                  >
                    + Auto-Generate UTR
                  </button>
                </div>
                <input
                  id="payment-ref-input"
                  type="text"
                  required
                  placeholder="e.g. UTR-4291049182 / IMPS-892019"
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* PAYMENT VERIFICATION IMAGE UPLOAD SECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Payment Verification Receipt / Screenshot</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>Open Upload Modal</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      {evidenceImage ? 'Receipt attached' : 'Optional but recommended'}
                    </span>
                  </div>
                </div>

                {/* Hidden File Input */}
                <input
                  id="trade-room-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/*"
                  onChange={handleEvidenceFileUpload}
                  className="hidden"
                />

                {!evidenceImage ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center transition-all ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-950/40 ring-4 ring-emerald-500/20 scale-[1.01]'
                        : 'border-white/15 hover:border-emerald-400/50 bg-[#0B0E14]/60'
                    }`}
                  >
                    <div className="max-w-md mx-auto space-y-2.5">
                      <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <UploadCloud className="w-5 h-5" />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => document.getElementById('trade-room-file-input')?.click()}
                          className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 min-h-[44px]"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Choose Screenshot or Photo</span>
                        </button>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {isDragging ? 'Drop receipt image here!' : 'Drag & drop image here or browse files · PNG, JPG, WebP up to 10MB'}
                        </p>
                      </div>

                      {/* Quick Auto-Generators for Demo / Test Verification */}
                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">Demo helpers:</span>
                        <button
                          type="button"
                          onClick={() => generateSampleReceipt('UPI')}
                          className="px-2.5 py-1 text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-cyan-300 rounded cursor-pointer transition-colors"
                        >
                          ⚡ Auto-Generate UPI Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => generateSampleReceipt('BANK')}
                          className="px-2.5 py-1 text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-emerald-300 rounded cursor-pointer transition-colors"
                        >
                          🏛️ Auto-Generate Bank Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                          className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showManualUrlInput ? 'Hide URL' : 'Paste URL'}
                        </button>
                      </div>

                      {showManualUrlInput && (
                        <div className="pt-2">
                          <input
                            type="text"
                            placeholder="https://example.com/payment-proof.png"
                            value={evidenceUrlInput}
                            onChange={(e) => {
                              setEvidenceUrlInput(e.target.value);
                              setEvidenceImage(e.target.value);
                            }}
                            className="w-full px-3 py-1.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Attached Image Preview Card */
                  <div className="p-3 bg-[#0B0E14] border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div
                        onClick={() => setPreviewModalImg(evidenceImage)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-emerald-500/30 bg-slate-900 shrink-0 cursor-pointer group"
                      >
                        <img
                          src={evidenceImage}
                          alt="Payment Receipt Preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{evidenceFileName || 'Payment-Receipt.png'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {evidenceFileSize || 'Verified proof attached'} · Click image to inspect
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium mt-1">
                          ✓ Ready for seller escrow verification
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg(evidenceImage)}
                        className="px-2.5 py-1.5 text-xs text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('trade-room-file-input')?.click()}
                        className="px-2.5 py-1.5 text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleClearEvidenceImage}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Remove attached receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Declaration Note */}
              <div>
                <label htmlFor="payment-note-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Declaration Note to Seller (Optional)
                </label>
                <input
                  id="payment-note-input"
                  type="text"
                  placeholder="Remitted from account ending in 8841..."
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{busy ? 'Recording Declaration...' : 'Submit Payment Proof & Mark Paid'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={busy}
                  className="px-4 py-2.5 text-xs font-semibold text-red-300 bg-red-950/50 border border-red-500/40 hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel Order &amp; Release Escrow
                </button>
              </div>

              {showCancelConfirm && (
                <div className="p-4 bg-red-950/70 border border-red-500/50 rounded-xl space-y-3 text-xs mt-3">
                  <div className="font-bold text-red-200">
                    Confirm Order Cancellation &amp; Escrow Release:
                  </div>
                  <p className="text-red-300/80">
                    Cancelling this order will release 100% of the locked crypto ({formatMicro6(order.cryptoQuantityMicro)} {order.asset}) back to the seller.
                  </p>
                  <input
                    type="text"
                    placeholder="Reason for cancellation (optional)..."
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-red-500/40 rounded-lg text-slate-100"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCancelOrder}
                      className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
                    >
                      {busy ? 'Cancelling...' : 'Confirm Cancel & Release Escrow'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* STEP 2: PAYMENT MARKED SENT -> VERIFY FIAT & AUTHORIZE ESCROW RELEASE */}
          {order.state === 'PAYMENT_MARKED_SENT' && (
            <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-display">
                    Fiat Payment Declared · Proof of Receipt Attached
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Order Ref:{' '}
                    <span className="font-mono text-cyan-300 font-semibold">{order.paymentReference}</span>
                    {order.paymentDeclaredAt && (
                      <span className="ml-2 text-slate-500">
                        ({new Date(order.paymentDeclaredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded font-medium">
                  Payment Declared Sent
                </span>
              </div>

              {/* Uploaded Receipt Preview in PAYMENT_MARKED_SENT */}
              {(order.paymentEvidenceUrl || evidenceImage) ? (
                <div className="p-3 bg-[#0B0E14] border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-emerald-400" />
                      <span>Payment Verification Receipt (Click to Enlarge)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer font-medium px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] rounded border border-white/10"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Update Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg(order.paymentEvidenceUrl || evidenceImage)}
                        className="text-[11px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer font-medium px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Full Resolution</span>
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setPreviewModalImg(order.paymentEvidenceUrl || evidenceImage)}
                    className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950 cursor-pointer group max-h-56 flex items-center justify-center"
                  >
                    <img
                      src={order.paymentEvidenceUrl || evidenceImage}
                      alt="Verified Payment Receipt"
                      className="max-h-56 w-auto object-contain group-hover:scale-[1.01] transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-black/75 text-xs text-white font-medium flex items-center gap-1.5">
                        <ZoomIn className="w-4 h-4" />
                        <span>Click to Inspect Full Receipt</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#0B0E14] border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-amber-300">
                    No image screenshot was uploaded with the reference declaration.
                  </span>
                  <div>
                    <input
                      id="trade-room-add-evidence-input"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        handleEvidenceFileUpload(e);
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            if (typeof reader.result === 'string') {
                              await onSubmitPaymentSent({
                                orderId: order.id,
                                paymentReference: order.paymentReference || 'UTR-VERIFIED',
                                paymentEvidenceUrl: reader.result,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Attach Receipt Screenshot</span>
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-300">
                In accordance with Costorah escrow invariants, crypto is never auto-released upon declaration. Verify that{' '}
                <span className="font-mono text-emerald-400 font-bold">
                  {fiatSym}
                  {formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
                </span>{' '}
                has settled in the seller's bank account before authorizing escrow release.
              </p>

              {/* Action Buttons: Seamless for Seller verification & Demo testing */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSellerRelease}
                  className="px-5 py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {currentUser.id === order.sellerId
                      ? 'Verify Fiat Received & Authorize Escrow Release'
                      : 'Verify Fiat Received & Release Escrow (Simulate Seller)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDisputeForm((v) => !v)}
                  className="px-4 py-2.5 text-xs font-semibold text-red-300 bg-red-950/50 border border-red-500/30 hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
                >
                  Open Escrow Dispute
                </button>
              </div>
            </div>
          )}

          {/* Dispute Arbitration Section & Visual Step-by-Step Resolution Timeline */}
          {(order.state === 'DISPUTED' ||
            order.state === 'ESCROW_RECOVERY_REQUIRED' ||
            order.state === 'REFUND_PENDING' ||
            Boolean(order.disputeReason) ||
            showDisputeForm ||
            order.state === 'PAYMENT_PENDING' ||
            order.state === 'PAYMENT_MARKED_SENT') && (
            <div
              data-testid="trade-room-dispute-section"
              className={`rounded-xl border p-5 space-y-4 transition-all ${
                order.state === 'DISPUTED' ||
                order.state === 'ESCROW_RECOVERY_REQUIRED' ||
                order.state === 'REFUND_PENDING'
                  ? 'bg-red-950/25 border-red-500/45 shadow-[0_0_25px_rgba(239,68,68,0.08)]'
                  : order.disputeReason
                  ? 'bg-[#131A24] border-emerald-500/35'
                  : 'bg-[#131A24] border-white/[0.08]'
              }`}
            >
              {/* Dispute Header & Expected Resolution Window Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 font-display flex items-center gap-2">
                      <AlertOctagon
                        className={`w-4 h-4 shrink-0 ${
                          order.state === 'DISPUTED'
                            ? 'text-red-400 animate-pulse'
                            : order.disputeReason
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <span>
                        {order.state === 'DISPUTED'
                          ? 'Active Escrow Dispute & Arbitration Timeline'
                          : order.disputeReason
                          ? 'Resolved Dispute Arbitration Timeline'
                          : 'Escrow Dispute & Arbitration Protection'}
                      </span>
                    </h3>
                    <span
                      data-testid="dispute-status-badge"
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                        order.state === 'DISPUTED'
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : order.disputeReason
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {order.state === 'DISPUTED'
                        ? 'ACTIVE DISPUTE · STAGE 3 OF 4'
                        : order.disputeReason
                        ? `RESOLVED (${order.state})`
                        : 'ARBITRATION STANDBY'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {order.state === 'DISPUTED'
                      ? `Escrow vault is frozen. ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} remains locked 1:1 while the Costorah Chief Arbitrator audits payment evidence.`
                      : order.disputeReason
                      ? 'Arbitration review has concluded and the signed cryptographic ruling has been executed on the ledger.'
                      : 'If a payment discrepancy occurs, freezing the order in dispute halts all timers and initiates a 4-stage human arbitration audit.'}
                  </p>
                </div>

                {/* Expected Resolution Window SLA Pill */}
                <div
                  data-testid="dispute-resolution-window-banner"
                  className="px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 font-mono shrink-0 sm:text-right"
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex sm:justify-end items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Expected Resolution Window</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                    {order.state === 'DISPUTED'
                      ? '15 – 45 Mins (Target < 30m)'
                      : order.disputeReason
                      ? 'Completed Within SLA'
                      : '15 – 45 Mins SLA'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {order.state === 'DISPUTED'
                      ? `Priority Queue · Hard Cap ≤ 2 Hours`
                      : '24/7 Chief Arbitrator Desk'}
                  </div>
                </div>
              </div>

              {/* Visual Step-by-Step Dispute Timeline */}
              {(() => {
                const isDisputeActive =
                  order.state === 'DISPUTED' ||
                  order.state === 'ESCROW_RECOVERY_REQUIRED' ||
                  order.state === 'REFUND_PENDING';
                const isDisputeResolved =
                  Boolean(order.disputeReason) &&
                  (order.state === 'COMPLETED' || order.state === 'REFUNDED');
                const hasEvidenceAttached = Boolean(
                  order.paymentReference || order.paymentEvidenceUrl || evidenceImage
                );

                // Determine active timeline index (0 = not started, 1 = step 1, 2 = step 2, 3 = step 3, 4 = step 4 resolved)
                const activeDisputeStage = isDisputeResolved
                  ? 4
                  : isDisputeActive
                  ? hasEvidenceAttached
                    ? 3
                    : 2
                  : showDisputeForm
                  ? 1
                  : 0;

                const disputeProgressPct =
                  activeDisputeStage === 4
                    ? 100
                    : activeDisputeStage === 3
                    ? 75
                    : activeDisputeStage === 2
                    ? 50
                    : activeDisputeStage === 1
                    ? 25
                    : 12;

                const disputeTimelineSteps = [
                  {
                    stepNum: '01',
                    title: 'Dispute Initiated & Escrow Frozen',
                    windowLabel: 'T+0m · Immediate',
                    status:
                      activeDisputeStage >= 2
                        ? 'COMPLETED'
                        : activeDisputeStage === 1
                        ? 'IN_PROGRESS'
                        : 'STANDBY',
                    description:
                      order.disputeReason ||
                      'Order state transitions to DISPUTED. Automatic expiration and release timers are immediately frozen.',
                  },
                  {
                    stepNum: '02',
                    title: 'Evidence & Bank UTR Audit Log',
                    windowLabel: 'Window: 0 – 15 Mins',
                    status:
                      activeDisputeStage >= 3
                        ? 'COMPLETED'
                        : activeDisputeStage === 2
                        ? 'IN_PROGRESS'
                        : 'PENDING',
                    description: hasEvidenceAttached
                      ? `Payment reference (${order.paymentReference || 'UTR Attached'}) and Trade Room transcript indexed for forensic verification.`
                      : 'Buyer and Seller submit bank transfer UTR, receipt screenshot, and chat statement logs.',
                  },
                  {
                    stepNum: '03',
                    title: 'Chief Arbitrator Forensic Review',
                    windowLabel: 'Window: 15 – 30 Mins',
                    status:
                      activeDisputeStage === 4
                        ? 'COMPLETED'
                        : activeDisputeStage === 3
                        ? 'IN_PROGRESS'
                        : 'PENDING',
                    description:
                      'Costorah Chief Arbitrator verifies bank clearing records against 1:1 locked escrow custody invariants.',
                  },
                  {
                    stepNum: '04',
                    title: 'Binding Ruling & Ledger Settlement',
                    windowLabel: 'Target SLA: < 45 Mins',
                    status: activeDisputeStage === 4 ? 'COMPLETED' : 'PENDING',
                    description:
                      order.disputeResolutionNote ||
                      'Cryptographic release of 100% escrowed crypto to Buyer (if fiat verified) or 100% refund to Seller.',
                  },
                ] as const;

                return (
                  <div
                    data-testid="dispute-step-by-step-timeline"
                    className="space-y-3"
                  >
                    {/* Progress Bar & SLA Status Summary */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-semibold">
                          Dispute Resolution Pipeline Progress
                        </span>
                        <span
                          className={
                            isDisputeResolved
                              ? 'text-emerald-400 font-bold'
                              : isDisputeActive
                              ? 'text-amber-300 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {isDisputeResolved
                            ? '100% · Arbitration Ruling Executed'
                            : isDisputeActive
                            ? `${disputeProgressPct}% · Stage ${activeDisputeStage} of 4 Active (Est. 15–30m remaining)`
                            : '4-Stage SLA Pipeline (15–45m Resolution Window)'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#0B0E14] rounded-full overflow-hidden border border-white/[0.08]">
                        <div
                          style={{ width: `${disputeProgressPct}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDisputeResolved
                              ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300'
                              : isDisputeActive
                              ? 'bg-gradient-to-r from-amber-500 via-red-500 to-amber-400 animate-pulse'
                              : 'bg-slate-600'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 4-Step Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {disputeTimelineSteps.map((step) => {
                        const isCompleted = step.status === 'COMPLETED';
                        const isInProgress = step.status === 'IN_PROGRESS';

                        return (
                          <div
                            key={step.stepNum}
                            data-testid={`dispute-timeline-step-${step.stepNum}`}
                            className={`relative p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2 transition-all ${
                              isInProgress
                                ? 'bg-red-950/45 border-red-400/70 text-slate-100 shadow-[0_0_15px_rgba(239,68,68,0.12)]'
                                : isCompleted
                                ? 'bg-emerald-950/25 border-emerald-500/40 text-slate-200'
                                : 'bg-[#0B0E14] border-white/[0.06] text-slate-400'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    isInProgress
                                      ? 'bg-red-500/25 text-red-200 border border-red-400/40'
                                      : isCompleted
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-white/[0.05] text-slate-400 border border-white/10'
                                  }`}
                                >
                                  STEP {step.stepNum}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold ${
                                    isInProgress
                                      ? 'text-amber-300'
                                      : isCompleted
                                      ? 'text-emerald-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {isInProgress ? (
                                    <>
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                                      </span>
                                      <span>IN PROGRESS</span>
                                    </>
                                  ) : isCompleted ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>DONE</span>
                                    </>
                                  ) : (
                                    <span>{step.status}</span>
                                  )}
                                </span>
                              </div>

                              <div className="font-bold text-slate-100 font-display leading-snug">
                                {step.title}
                              </div>

                              <p className="text-[11px] text-slate-300/90 leading-relaxed">
                                {step.description}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
                              <span>SLA Window:</span>
                              <span className="text-amber-300 font-semibold">
                                {step.windowLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Open Dispute Trigger & Form when Order is not yet in DISPUTED / COMPLETED / REFUNDED */}
              {order.state !== 'COMPLETED' &&
                order.state !== 'DISPUTED' &&
                order.state !== 'REFUNDED' &&
                order.state !== 'CANCELLED' && (
                  <div className="pt-2 border-t border-white/[0.08]">
                    {!showDisputeForm ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-300">
                          Experiencing a payment delay or UTR verification issue?
                        </span>
                        <button
                          type="button"
                          data-testid="open-dispute-form-btn"
                          onClick={() => setShowDisputeForm(true)}
                          className="px-3.5 py-2 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 rounded-lg cursor-pointer transition-colors"
                        >
                          Open Dispute Form
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleDisputeSubmit} className="space-y-3 pt-1">
                        <label htmlFor="dispute-reason" className="block text-xs font-medium text-slate-200">
                          Describe the discrepancy and reference supporting bank statement / UTR evidence:
                        </label>
                        <textarea
                          id="dispute-reason"
                          rows={2}
                          required
                          placeholder="e.g. UTR reference not found in bank statement after 60 minutes..."
                          value={disputeReasonInput}
                          onChange={(e) => setDisputeReasonInput(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-red-400"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDisputeForm(false)}
                            className="px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
                          >
                            {busy ? 'Freezing Order...' : 'Freeze Order & Submit to Arbitration'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Final Settlement Receipt when COMPLETED or REFUNDED or DISPUTED */}
          {(order.state === 'COMPLETED' || order.state === 'REFUNDED' || order.state === 'DISPUTED') && (
            <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>
                    {order.state === 'COMPLETED'
                      ? 'Final Cryptographic Settlement Receipt'
                      : order.state === 'REFUNDED'
                      ? 'Escrow Refund Settlement Receipt'
                      : 'Dispute Lock Notice'}
                  </span>
                </h3>
                <span className="text-xs font-mono text-emerald-400">{order.state}</span>
              </div>

              <div className="p-4 bg-[#0B0E14] border border-white/[0.06] rounded-lg space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="text-slate-100">{order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Reference / UTR:</span>
                  <span className="text-slate-200">{order.paymentReference || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Escrow Asset Released:</span>
                  <span className="text-emerald-400 font-bold">
                    {formatMicro6(order.cryptoQuantityMicro)} {order.asset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Fiat / 1% Fee / Seller Net:</span>
                  <span className="text-slate-200">
                    {fiatSym}
                    {formatMinor2(order.grossFiatMinor)} / {fiatSym}
                    {formatMinor2(order.platformFeeFiatMinor)} / {fiatSym}
                    {formatMinor2(order.sellerNetFiatMinor)}
                  </span>
                </div>
                {order.settlementTxHash && (
                  <div className="flex justify-between pt-1 border-t border-white/[0.06]">
                    <span className="text-slate-400">Settlement Receipt Hash:</span>
                    <span className="text-emerald-300 truncate max-w-[160px] sm:max-w-[260px]">
                      {order.settlementTxHash}
                    </span>
                  </div>
                )}
                {order.disputeReason && (
                  <div className="pt-2 border-t border-white/[0.06] text-amber-300 font-sans">
                    Dispute Record: {order.disputeReason}
                    {order.disputeResolutionNote && (
                      <div className="text-emerald-300 mt-1">
                        Arbitrator Ruling: {order.disputeResolutionNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Trade Room Encrypted Audit Stream & Chat */}
        <div className={`lg:col-span-5 bg-[#131A24] border border-white/[0.08] rounded-xl flex flex-col h-[520px] ${mobileActiveTab === 'CHAT' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="px-5 py-3.5 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-display">
                Trade Room Evidence & Counterparty Log
              </h3>
              <div className="text-xs text-slate-400">
                Audited transcript recorded for escrow arbitration
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-xs border ${
                  m.senderRole === 'SYSTEM'
                    ? 'bg-[#0B0E14] border-emerald-500/30 text-slate-300'
                    : m.senderRole === 'ADMIN'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-[#18212F] border-white/[0.06] text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span className="font-semibold text-slate-200">
                    {m.senderName} ({m.senderRole})
                  </span>
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="leading-relaxed">{m.content}</p>
                {m.attachmentUrl && (
                  <div className="mt-2">
                    {m.attachmentUrl.startsWith('data:image/') || m.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ? (
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg(m.attachmentUrl || null)}
                        className="block group text-left cursor-pointer"
                      >
                        <div className="text-[10px] text-emerald-400 font-mono mb-1 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>Attached Payment Proof (Click to Inspect)</span>
                        </div>
                        <img
                          src={m.attachmentUrl}
                          alt="Payment Proof Attachment"
                          className="max-h-36 max-w-full rounded-md border border-emerald-500/30 object-contain bg-black/40 group-hover:border-emerald-400 transition-colors"
                        />
                      </button>
                    ) : (
                      <div className="font-mono text-[11px] text-emerald-400 break-all">
                        Evidence URI: {m.attachmentUrl}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleChatSend}
            className="p-3 bg-[#0F141C] border-t border-white/[0.08] flex items-center gap-2"
          >
            <input
              type="text"
              aria-label="Trade Room Message"
              placeholder="Write a message or paste payment evidence note..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer inline-flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* FULL-SCREEN IMAGE INSPECTOR LIGHTBOX MODAL */}
      {previewModalImg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#0F141C] border border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#131A24] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-100 font-display">
                  Payment Verification Receipt Inspector
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {order.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewModalImg}
                  download={`costorah-receipt-${order.id}.png`}
                  className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalImg(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={previewModalImg}
                alt="Full Payment Verification Receipt"
                className="max-h-[75vh] w-auto object-contain rounded shadow"
              />
            </div>

            <div className="px-4 py-2.5 bg-[#0B0E14] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Reference: {order.paymentReference || 'UTR-VERIFIED'}</span>
              <span>Amount: {fiatSym}{formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}</span>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PAYMENT VERIFICATION MODAL */}
      {showPaymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="relative w-full max-w-xl bg-[#0F141C] border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#131A24] border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-display">
                    Payment Verification Receipt
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Order {order.id} · {fiatSym}{formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Upload your payment confirmation screenshot or transfer slip. Attaching a clear receipt allows the counterparty to promptly verify fiat receipt in their bank and release crypto from escrow.
              </p>

              {/* Reference ID Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="modal-payment-ref-input" className="block text-xs font-medium text-slate-200">
                    Bank Reference / UTR / Transaction ID *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const ref = `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
                      setPaymentRefInput(ref);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-mono"
                  >
                    + Auto-Generate UTR
                  </button>
                </div>
                <input
                  id="modal-payment-ref-input"
                  type="text"
                  required
                  placeholder="e.g. UTR-492019385012 / IMPS-992019"
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Drag-and-Drop Zone & File Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Payment Confirmation Screenshot / Photo</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {evidenceImage ? 'Receipt attached' : 'PNG, JPG, WebP'}
                  </span>
                </div>

                {/* Hidden File Input for Modal */}
                <input
                  id="trade-room-modal-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/*"
                  onChange={handleEvidenceFileUpload}
                  className="hidden"
                />

                {!evidenceImage ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-950/40 ring-4 ring-emerald-500/20 scale-[1.01]'
                        : 'border-white/15 hover:border-emerald-400/50 bg-[#0B0E14]/60'
                    }`}
                  >
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <UploadCloud className="w-6 h-6" />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => document.getElementById('trade-room-modal-file-input')?.click()}
                          className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Choose Screenshot or Photo</span>
                        </button>
                        <p className="text-[11px] text-slate-400 mt-2">
                          {isDragging ? 'Drop receipt image here!' : 'Drag & drop image here or tap above · PNG, JPG, WebP up to 10MB'}
                        </p>
                      </div>

                      {/* Demo Quick Generators */}
                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">Demo helpers:</span>
                        <button
                          type="button"
                          onClick={() => generateSampleReceipt('UPI')}
                          className="px-2.5 py-1 text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-cyan-300 rounded cursor-pointer transition-colors"
                        >
                          ⚡ Auto UPI Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => generateSampleReceipt('BANK')}
                          className="px-2.5 py-1 text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-emerald-300 rounded cursor-pointer transition-colors"
                        >
                          🏛️ Auto Bank Slip
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Attached Preview inside Modal */
                  <div className="p-3 bg-[#0B0E14] border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div
                        onClick={() => setPreviewModalImg(evidenceImage)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-emerald-500/30 bg-slate-900 shrink-0 cursor-pointer group"
                      >
                        <img
                          src={evidenceImage}
                          alt="Payment Receipt"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{evidenceFileName || 'Payment-Receipt.png'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {evidenceFileSize || 'Receipt attached'} · Tap image to inspect
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium mt-1">
                          ✓ Ready to attach to order metadata
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg(evidenceImage)}
                        className="px-3 py-1.5 text-xs text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 min-h-[36px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('trade-room-modal-file-input')?.click()}
                        className="px-3 py-1.5 text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleClearEvidenceImage}
                        className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Declaration Note Field */}
              <div>
                <label htmlFor="modal-payment-note-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Declaration Note to Counterparty (Optional)
                </label>
                <input
                  id="modal-payment-note-input"
                  type="text"
                  placeholder="e.g. Paid from HDFC bank account ending in 8841..."
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#131A24] border-t border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ref = paymentRefInput.trim() || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
                  setPaymentRefInput(ref);
                  setActionError(null);
                  setBusy(true);
                  try {
                    await onSubmitPaymentSent({
                      orderId: order.id,
                      paymentReference: ref,
                      paymentEvidenceUrl: evidenceImage || evidenceUrlInput,
                      note: paymentNoteInput,
                    });
                    setShowPaymentModal(false);
                  } catch (err: unknown) {
                    setActionError(err instanceof Error ? err.message : 'Failed to submit payment verification receipt');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-5 py-2.5 text-xs font-bold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-sm inline-flex items-center gap-1.5 min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {busy
                    ? 'Saving Verification...'
                    : order.state === 'PAYMENT_MARKED_SENT'
                    ? 'Update Attached Receipt'
                    : 'Submit Proof & Mark Paid'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
