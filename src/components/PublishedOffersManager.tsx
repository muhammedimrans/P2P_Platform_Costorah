import React, { useState, useMemo } from 'react';
import {
  PauseCircle,
  PlayCircle,
  XCircle,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  calculateBinanceOrderLimits,
  DAILY_TRADING_LIMIT_USD,
  type OfferRecord,
  type FiatCurrency,
  type UserProfile,
} from '../types';
import {
  formatMicro6,
  formatMinor2,
  parseFiatToMinor,
  parseCryptoToMicro,
  calculateMaxOrderCapMinor,
} from '../core/escrowEngine';
import { CryptoAssetIcon } from './CryptoAssetIcons';

export interface EditOfferPayload {
  unitPriceFiat: string;
  totalQuantityCrypto: string;
  minOrderFiat: string;
  maxOrderFiat: string;
  paymentMethods: string[];
  paymentInstructions: string;
}

interface PublishedOffersManagerProps {
  offers: OfferRecord[];
  currentUserId: string;
  currentUser?: UserProfile;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  onUpdateOfferStatus: (offerId: string, action: 'PAUSE' | 'RESUME' | 'CANCEL') => Promise<void>;
  onEditOffer: (offerId: string, payload: EditOfferPayload) => Promise<void>;
  title?: string;
  subtitle?: string;
}

export const PublishedOffersManager: React.FC<PublishedOffersManagerProps> = ({
  offers,
  currentUserId,
  currentUser,
  supportedPaymentMethods,
  onUpdateOfferStatus,
  onEditOffer,
  title,
  subtitle,
}) => {
  // Only show non-cancelled offers belonging to the current user
  const myActiveAndPausedOffers = useMemo(
    () =>
      offers.filter(
        (o) => o.makerId === currentUserId && o.status !== 'CANCELLED' && o.status !== 'FILLED'
      ),
    [offers, currentUserId]
  );

  // Double-confirmation modal state for PAUSE and CANCEL
  const [confirmAction, setConfirmAction] = useState<{
    offer: OfferRecord;
    action: 'PAUSE' | 'CANCEL';
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Edit Offer modal state
  const [editingOffer, setEditingOffer] = useState<OfferRecord | null>(null);
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editMinFiat, setEditMinFiat] = useState('');
  const [editMaxFiat, setEditMaxFiat] = useState('');
  const [editMethods, setEditMethods] = useState<string[]>([]);
  const [editInstructions, setEditInstructions] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (offer: OfferRecord) => {
    setEditingOffer(offer);
    setEditUnitPrice(formatMinor2(offer.unitPriceFiatMinor));
    setEditQuantity(formatMicro6(offer.availableQuantityMicro));
    const totalFiatMinor = Math.max(
      1,
      Math.round((offer.availableQuantityMicro * offer.unitPriceFiatMinor) / 1_000_000)
    );
    const capMinor = calculateMaxOrderCapMinor({
      asset: offer.asset,
      unitPriceFiatMinor: offer.unitPriceFiatMinor,
    });
    const effMax = Math.min(offer.maxOrderFiatMinor, totalFiatMinor, capMinor);
    const effMin = Math.min(offer.minOrderFiatMinor, effMax);
    setEditMinFiat(formatMinor2(effMin));
    setEditMaxFiat(formatMinor2(effMax));
    setEditMethods([...offer.paymentMethods]);
    setEditInstructions(offer.paymentInstructions);
    setEditError(null);
  };

  const handleEditPriceOrQtyChange = (nextPrice: string, nextQty: string) => {
    setEditUnitPrice(nextPrice);
    setEditQuantity(nextQty);
    if (!editingOffer) return;
    try {
      const unitMinor = parseFiatToMinor(nextPrice);
      const qtyMicro = parseCryptoToMicro(nextQty);
      const limits = calculateBinanceOrderLimits({
        asset: editingOffer.asset,
        unitPriceFiatMinor: unitMinor,
        totalQuantityMicro: qtyMicro,
        singleTransactionOnly: false,
      });
      setEditMaxFiat(limits.maxOrderFiatFormatted);
      setEditMinFiat(limits.minOrderFiatFormatted);
    } catch {
      // ignore partial input while typing
    }
  };

  const toggleEditMethod = (pm: string) => {
    setEditMethods((prev) =>
      prev.includes(pm) ? prev.filter((m) => m !== pm) : [...prev, pm]
    );
  };

  const handleConfirmStatusAction = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onUpdateOfferStatus(confirmAction.offer.id, confirmAction.action);
      setActionFeedback(
        confirmAction.action === 'CANCEL'
          ? `Offer ${confirmAction.offer.id} has been cancelled and removed from your published offers.`
          : `Offer ${confirmAction.offer.id} has been paused.`
      );
      setConfirmAction(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update offer status');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResumeOffer = async (offer: OfferRecord) => {
    setActionBusy(true);
    setActionError(null);
    try {
      await onUpdateOfferStatus(offer.id, 'RESUME');
      setActionFeedback(`Offer ${offer.id} is now active (OPEN) on the Marketplace.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to resume offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    if (editMethods.length === 0) {
      setEditError('Please select at least one accepted payment method.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await onEditOffer(editingOffer.id, {
        unitPriceFiat: editUnitPrice,
        totalQuantityCrypto: editQuantity,
        minOrderFiat: editMinFiat,
        maxOrderFiat: editMaxFiat,
        paymentMethods: editMethods,
        paymentInstructions: editInstructions,
      });
      setActionFeedback(
        `Updated offer ${editingOffer.id}: ${editQuantity} ${editingOffer.asset} @ ${FIAT_SYMBOLS[editingOffer.fiatCurrency]}${editUnitPrice} ${editingOffer.fiatCurrency}.`
      );
      setEditingOffer(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update offer');
    } finally {
      setEditBusy(false);
    }
  };

  const availableMethodsForEditingOffer = useMemo(() => {
    if (!editingOffer) return [];
    const savedForFiat = (currentUser?.paymentMethods || [])
      .filter((pm) => pm.fiatCurrency === editingOffer.fiatCurrency)
      .map((pm) => pm.methodName);
    const combined = Array.from(
      new Set([
        ...savedForFiat,
        ...editingOffer.paymentMethods,
        ...(supportedPaymentMethods[editingOffer.fiatCurrency] || []),
      ])
    );
    return combined;
  }, [editingOffer, currentUser?.paymentMethods, supportedPaymentMethods]);

  return (
    <div
      data-testid="published-offers-manager"
      className="bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 font-display">
            {title || `Your Published P2P Offers (${myActiveAndPausedOffers.length})`}
          </h2>
          <p className="text-xs text-slate-400">
            {subtitle ||
              'Active and paused P2P Buy/Sell offers appear on the Market & Orders pages. Edit, pause, resume, or cancel your offers below (cancelled offers are automatically removed).'}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 self-start sm:self-center">
          {myActiveAndPausedOffers.filter((o) => o.status === 'OPEN').length} Active ·{' '}
          {myActiveAndPausedOffers.filter((o) => o.status === 'PAUSED').length} Paused
        </span>
      </div>

      {actionFeedback && (
        <div className="mx-5 mt-4 p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="mx-5 mt-4 p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {myActiveAndPausedOffers.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          You have no active or paused published offers right now.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-slate-400 bg-[#0B0E14]">
                <th className="py-3 px-4">Offer ID &amp; Type</th>
                <th className="py-3 px-4">Asset &amp; Unit Price</th>
                <th className="py-3 px-4 text-right">Amount &amp; Order Limits</th>
                <th className="py-3 px-4">Payment Methods</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions (Edit / Pause / Cancel)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-xs font-mono tabular-nums">
              {myActiveAndPausedOffers.map((off) => {
                const offSym = FIAT_SYMBOLS[off.fiatCurrency];
                const offTotalFiatMinor = Math.max(
                  1,
                  Math.round((off.availableQuantityMicro * off.unitPriceFiatMinor) / 1_000_000)
                );
                const offCapMinor = calculateMaxOrderCapMinor({
                  asset: off.asset,
                  unitPriceFiatMinor: off.unitPriceFiatMinor,
                });
                const offEffectiveMaxMinor = Math.min(
                  off.maxOrderFiatMinor,
                  offTotalFiatMinor,
                  offCapMinor
                );
                const offEffectiveMinMinor = Math.min(
                  off.minOrderFiatMinor,
                  offEffectiveMaxMinor
                );
                return (
                  <tr
                    key={off.id}
                    data-testid={`published-offer-row-${off.id}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{off.id}</div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          off.side === 'SELL'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {off.side === 'SELL' ? 'SELL CRYPTO AD' : 'BUY CRYPTO AD'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <CryptoAssetIcon asset={off.asset} className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-emerald-400">
                          {offSym}
                          {formatMinor2(off.unitPriceFiatMinor)} {off.fiatCurrency}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">per 1 {off.asset}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-200">
                      <div>
                        {off.side === 'SELL' ? 'Selling' : 'Buying'}:{' '}
                        <span className="font-semibold text-slate-100">
                          {formatMicro6(off.availableQuantityMicro)} {off.asset}
                        </span>{' '}
                        <span className="text-emerald-400 font-semibold">
                          ({offSym}
                          {formatMinor2(offTotalFiatMinor)} {off.fiatCurrency})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Limit: {offSym}
                        {formatMinor2(offEffectiveMinMinor)} – {offSym}
                        {formatMinor2(offEffectiveMaxMinor)} {off.fiatCurrency}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="text-xs text-slate-200">
                        {off.paymentMethods.join(', ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          off.status === 'OPEN'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {off.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans relative">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`edit-offer-btn-${off.id}`}
                          onClick={() => openEditModal(off)}
                          className="px-2.5 py-1 text-xs text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 rounded hover:bg-cyan-500/25 cursor-pointer inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {off.status === 'OPEN' ? (
                          <button
                            type="button"
                            data-testid={`pause-offer-btn-${off.id}`}
                            aria-expanded={
                              confirmAction?.offer.id === off.id &&
                              confirmAction?.action === 'PAUSE'
                            }
                            onClick={() => {
                              setActionError(null);
                              setConfirmAction({ offer: off, action: 'PAUSE' });
                            }}
                            className="px-2.5 py-1 text-xs text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded hover:bg-amber-500/25 cursor-pointer inline-flex items-center gap-1"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </button>
                        ) : off.status === 'PAUSED' ? (
                          <button
                            type="button"
                            data-testid={`resume-offer-btn-${off.id}`}
                            disabled={actionBusy}
                            onClick={() => handleResumeOffer(off)}
                            className="px-2.5 py-1 text-xs text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          data-testid={`cancel-offer-btn-${off.id}`}
                          aria-expanded={
                            confirmAction?.offer.id === off.id &&
                            confirmAction?.action === 'CANCEL'
                          }
                          onClick={() => {
                            setActionError(null);
                            setConfirmAction({ offer: off, action: 'CANCEL' });
                          }}
                          className="px-2.5 py-1 text-xs text-red-300 bg-red-500/15 border border-red-500/30 rounded hover:bg-red-500/25 cursor-pointer inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </div>

                      {/* Inline Popover Indicator when this row's Pause/Cancel is awaiting confirmation */}
                      {confirmAction?.offer.id === off.id && (
                        <div
                          role="region"
                          aria-label={`Confirm ${confirmAction.action} for offer ${off.id}`}
                          data-testid={`offer-inline-confirm-popover-${off.id}`}
                          className={`mt-2 p-2.5 rounded-lg border text-left text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                            confirmAction.action === 'CANCEL'
                              ? 'bg-red-950/80 border-red-500/50 text-red-200'
                              : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                          }`}
                        >
                          <span className="font-medium">
                            {confirmAction.action === 'CANCEL'
                              ? `Confirm cancelling ${off.id} (${formatMicro6(off.availableQuantityMicro)} ${off.asset})?`
                              : `Confirm pausing ${off.id} (${formatMicro6(off.availableQuantityMicro)} ${off.asset})?`}
                          </span>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => setConfirmAction(null)}
                              className="px-2 py-0.5 rounded bg-[#0B0E14] border border-white/15 text-slate-300 hover:text-white cursor-pointer"
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={handleConfirmStatusAction}
                              className={`px-2.5 py-0.5 rounded font-semibold cursor-pointer ${
                                confirmAction.action === 'CANCEL'
                                  ? 'bg-red-500 hover:bg-red-400 text-white'
                                  : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                              }`}
                            >
                              {actionBusy
                                ? 'Processing...'
                                : confirmAction.action === 'CANCEL'
                                ? 'Confirm Cancel'
                                : 'Confirm Pause'}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Double-Confirmation Modal for PAUSE and CANCEL */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-confirm-modal-title"
          data-testid="offer-action-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-[#131A24] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    confirmAction.action === 'CANCEL' ? 'text-red-400' : 'text-amber-400'
                  }`}
                />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Double-Confirmation Required · Prevent Accidental State Change
                  </div>
                  <h3
                    id="offer-confirm-modal-title"
                    className="text-base font-bold text-slate-100 font-display"
                  >
                    {confirmAction.action === 'CANCEL'
                      ? 'Confirm Cancel P2P Offer'
                      : 'Confirm Pause P2P Offer'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close Confirmation Modal"
                onClick={() => setConfirmAction(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* 2-Step Verification Progress Pill */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/[0.08] font-mono text-[11px]">
                <span className="text-emerald-400 font-semibold">
                  1. {confirmAction.action === 'CANCEL' ? 'Cancel' : 'Pause'} Requested
                </span>
                <span className="text-slate-500">→</span>
                <span
                  className={`font-semibold ${
                    confirmAction.action === 'CANCEL' ? 'text-red-300' : 'text-amber-300'
                  }`}
                >
                  2. Awaiting Explicit Confirmation
                </span>
              </div>

              <div className="p-3.5 bg-[#0B0E14] border border-white/[0.08] rounded-lg font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Offer ID:</span>
                  <span className="text-slate-100 font-bold">{confirmAction.offer.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Offer Direction:</span>
                  <span className="text-emerald-400 font-bold">
                    {confirmAction.offer.side === 'SELL' ? 'SELL CRYPTO AD' : 'BUY CRYPTO AD'} (
                    {confirmAction.offer.asset}/{confirmAction.offer.fiatCurrency})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantity &amp; Unit Price:</span>
                  <span className="text-slate-200">
                    {formatMicro6(confirmAction.offer.availableQuantityMicro)}{' '}
                    {confirmAction.offer.asset} @{' '}
                    {FIAT_SYMBOLS[confirmAction.offer.fiatCurrency]}
                    {formatMinor2(confirmAction.offer.unitPriceFiatMinor)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">State Transition:</span>
                  <span
                    className={`font-bold ${
                      confirmAction.action === 'CANCEL' ? 'text-red-400' : 'text-amber-400'
                    }`}
                  >
                    {confirmAction.offer.status} →{' '}
                    {confirmAction.action === 'CANCEL' ? 'CANCELLED (Removed)' : 'PAUSED (Hidden)'}
                  </span>
                </div>
              </div>

              {confirmAction.action === 'PAUSE' ? (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 leading-relaxed">
                  Please confirm that you want to <strong>pause</strong> this P2P offer. While paused, new counterparties cannot open trades against this ad on the Market page until you explicitly click <strong>Resume</strong>.
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 leading-relaxed">
                  Please confirm that you want to permanently <strong>cancel</strong> this P2P offer. Cancelling removes this ad from your Published P2P Offers list and immediately unlocks{' '}
                  <strong className="font-mono">
                    {formatMicro6(confirmAction.offer.availableQuantityMicro)}{' '}
                    {confirmAction.offer.asset}
                  </strong>{' '}
                  back to your available wallet balance.
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  data-testid="confirm-modal-back-btn"
                  disabled={actionBusy}
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B0E14] border border-white/10 hover:border-white/25 rounded-lg cursor-pointer"
                >
                  No, Keep Offer Active
                </button>
                <button
                  type="button"
                  data-testid="confirm-modal-proceed-btn"
                  disabled={actionBusy}
                  onClick={handleConfirmStatusAction}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 ${
                    confirmAction.action === 'CANCEL'
                      ? 'bg-red-500 hover:bg-red-400 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-[#0B0E14]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {actionBusy
                      ? 'Processing...'
                      : confirmAction.action === 'CANCEL'
                      ? 'Yes, Confirm Cancel Offer'
                      : 'Yes, Confirm Pause Offer'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Published Offer Modal */}
      {editingOffer && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="edit-offer-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-[#131A24] border border-white/15 rounded-xl overflow-hidden shadow-2xl my-auto">
            <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono text-cyan-400">
                  Editing Published Offer · {editingOffer.id}
                </div>
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Edit {editingOffer.side === 'SELL' ? 'Sell' : 'Buy'} {editingOffer.asset} Offer (
                  {editingOffer.fiatCurrency})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Unit Price ({FIAT_SYMBOLS[editingOffer.fiatCurrency]} {editingOffer.fiatCurrency})
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="edit-offer-price-input"
                    value={editUnitPrice}
                    onChange={(e) => handleEditPriceOrQtyChange(e.target.value, editQuantity)}
                    className="w-full px-3 py-2 font-mono font-bold bg-[#0B0E14] border border-emerald-500/40 rounded-lg text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Available Quantity ({editingOffer.asset})
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="edit-offer-qty-input"
                    value={editQuantity}
                    onChange={(e) => handleEditPriceOrQtyChange(editUnitPrice, e.target.value)}
                    className="w-full px-3 py-2 font-mono font-bold bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Min Order Limit ({FIAT_SYMBOLS[editingOffer.fiatCurrency]})
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="edit-offer-min-input"
                    value={editMinFiat}
                    onChange={(e) => setEditMinFiat(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Max Order Limit ({FIAT_SYMBOLS[editingOffer.fiatCurrency]} · ≤ ${DAILY_TRADING_LIMIT_USD.toLocaleString()}/day)
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="edit-offer-max-input"
                    value={editMaxFiat}
                    onChange={(e) => setEditMaxFiat(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Accepted Payment Methods ({editingOffer.fiatCurrency})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableMethodsForEditingOffer.map((pm) => {
                    const active = editMethods.includes(pm);
                    return (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => toggleEditMethod(pm)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {pm}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>

              {editError && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-lg text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOffer(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B0E14] border border-white/10 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-edited-offer-btn"
                  disabled={editBusy}
                  className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
                >
                  {editBusy ? 'Saving...' : 'Save Offer Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
