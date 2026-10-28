import React, { useState } from 'react';
import {
  Info,
  Scale,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  type EscrowOrderRecord,
  type UserProfile,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';

export interface TradeSettlementSummaryProps {
  order: EscrowOrderRecord;
  buyerUser?: UserProfile;
  sellerUser?: UserProfile;
  currentUser: UserProfile;
  className?: string;
}

export const TradeSettlementSummary: React.FC<TradeSettlementSummaryProps> = ({
  order,
  buyerUser,
  sellerUser,
  currentUser,
  className = '',
}) => {
  const [showLedgerMatrix, setShowLedgerMatrix] = useState<boolean>(true);

  const fiatSym = FIAT_SYMBOLS[order.fiatCurrency] || '₹';
  const grossCrypto = order.cryptoQuantityMicro;
  const buyerNetCryptoMicro = grossCrypto;
  const platformFeeFiatMinor = order.platformFeeFiatMinor;
  const sellerNetFiatMinor = order.sellerNetFiatMinor;

  const isCurrentUserBuyer = currentUser.id === order.buyerId;
  const isCurrentUserSeller = currentUser.id === order.sellerId;

  // Derive real-time progression state metadata
  const getProgressionMeta = () => {
    switch (order.state) {
      case 'ORDER_RESERVED':
      case 'ESCROW_FUNDING':
      case 'ESCROW_LOCKED':
        return {
          stepIndex: 1,
          stepLabel: '01. Escrow Locked',
          color: 'text-amber-400',
          bgBadge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          dotColor: 'bg-amber-400',
          description:
            '100% of crypto inventory is locked in 1:1 protocol escrow custody. Awaiting fiat transfer from buyer.',
          buyerStatus: 'Escrow Secured · Ready for Payment',
          sellerStatus: 'Crypto Locked in Escrow',
        };
      case 'PAYMENT_PENDING':
        return {
          stepIndex: 2,
          stepLabel: '02. Buyer Fiat Transfer Pending',
          color: 'text-amber-300',
          bgBadge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          dotColor: 'bg-amber-400 animate-pulse',
          description:
            'Buyer is transmitting fiat via agreed payment rail while 100% of crypto remains locked in escrow.',
          buyerStatus: 'Transfer Fiat to Seller Account',
          sellerStatus: 'Awaiting Bank/UPI Transfer',
        };
      case 'PAYMENT_MARKED_SENT':
        return {
          stepIndex: 3,
          stepLabel: '03. Payment Declared Sent',
          color: 'text-blue-400',
          bgBadge: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
          dotColor: 'bg-blue-400 animate-pulse',
          description:
            'Buyer submitted payment reference. Seller is verifying bank receipt prior to final settlement release.',
          buyerStatus: 'Payment Sent · Verification Active',
          sellerStatus: 'Verify Fiat Receipt & Release',
        };
      case 'RELEASE_PENDING':
      case 'PAYMENT_REVIEW':
        return {
          stepIndex: 4,
          stepLabel: '04. Settlement Verification',
          color: 'text-purple-400',
          bgBadge: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
          dotColor: 'bg-purple-400 animate-pulse',
          description:
            'Dual-party release authorization in progress. 100% of escrowed crypto preparing for buyer settlement.',
          buyerStatus: 'Settlement in Final Transit',
          sellerStatus: 'Receipt Verified · Authorizing',
        };
      case 'COMPLETED':
        return {
          stepIndex: 5,
          stepLabel: '05. Settlement Settled & Completed',
          color: 'text-emerald-400',
          bgBadge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          dotColor: 'bg-emerald-400',
          description:
            'Trade finalized. 100% of escrowed crypto credited to buyer wallet and 99% net fiat proceeds received by seller.',
          buyerStatus: '✓ 100% Crypto Credited',
          sellerStatus: '✓ Net Fiat Received in Bank',
        };
      case 'CANCELLED':
        return {
          stepIndex: 0,
          stepLabel: 'Order Cancelled · Escrow Restored',
          color: 'text-slate-400',
          bgBadge: 'bg-slate-700/30 border-slate-600/40 text-slate-300',
          dotColor: 'bg-slate-400',
          description:
            'Order cancelled before fiat transfer. 100% of escrowed crypto is released back to the seller.',
          buyerStatus: '✕ Trade Voided (No Debit)',
          sellerStatus: '↩ Escrow Returned (100%)',
        };
      case 'DISPUTED':
        return {
          stepIndex: -1,
          stepLabel: 'Dispute Active · Escrow Frozen',
          color: 'text-red-400',
          bgBadge: 'bg-red-500/15 border-red-500/30 text-red-300',
          dotColor: 'bg-red-400 animate-ping',
          description:
            'Dispute opened by a counterparty. 100% of escrowed funds remain securely locked under arbitrator review.',
          buyerStatus: 'Escrow Frozen in Dispute',
          sellerStatus: 'Escrow Frozen in Dispute',
        };
      default:
        return {
          stepIndex: 2,
          stepLabel: `State: ${order.state}`,
          color: 'text-slate-300',
          bgBadge: 'bg-slate-800 border-slate-700 text-slate-300',
          dotColor: 'bg-slate-400',
          description: 'Trade is processing through the escrow pipeline.',
          buyerStatus: 'In Progress',
          sellerStatus: 'In Progress',
        };
    }
  };

  const meta = getProgressionMeta();

  return (
    <div
      data-testid="trade-settlement-summary"
      className={`bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl ${className}`}
    >
      {/* Header Bar */}
      <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 font-display">
                Trade Settlement Summary
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                REAL-TIME SETTLEMENT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live double-entry breakdown of 1% seller platform fee, counterparty net payouts, and 1:1 escrow custody states.
            </p>
          </div>
        </div>

        {/* Current State Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-semibold ${meta.bgBadge}`}
          >
            <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
            <span>{meta.stepLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLedgerMatrix(!showLedgerMatrix)}
            className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-[#0B0E14] border border-white/[0.08] rounded-lg transition-colors cursor-pointer"
          >
            {showLedgerMatrix ? 'Hide Ledger Matrix' : 'Show Ledger Matrix'}
          </button>
        </div>
      </div>

      {/* Real-Time Settlement Progression Bar */}
      <div className="px-5 py-3.5 bg-[#0B0E14]/80 border-b border-white/[0.06] text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-slate-400 text-[11px]">
            Progression Milestone: <span className="text-slate-200 font-bold">{meta.stepLabel}</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            State Machine: <span className="text-emerald-400 font-semibold">{order.state}</span>
          </span>
        </div>

        {/* 4-Stage Visual Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { step: 1, label: '1. Escrow Lock', state: meta.stepIndex >= 1 },
            { step: 2, label: '2. Fiat Transfer', state: meta.stepIndex >= 2 },
            { step: 3, label: '3. Payment Verified', state: meta.stepIndex >= 3 },
            { step: 4, label: '4. Escrow Crypto Settled', state: meta.stepIndex >= 5 },
          ].map((s) => (
            <div key={s.step} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  order.state === 'CANCELLED'
                    ? 'bg-slate-700'
                    : order.state === 'DISPUTED'
                    ? 'bg-red-500/60'
                    : s.state
                    ? 'bg-emerald-400'
                    : 'bg-white/[0.08]'
                }`}
              />
              <div
                className={`text-[10px] font-mono truncate ${
                  s.state ? 'text-slate-200 font-semibold' : 'text-slate-500'
                }`}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-400 mt-2 font-sans flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{meta.description}</span>
        </div>
      </div>

      {/* Side-by-Side Dual Counterparty Net Settlement Cards */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* BUYER SETTLEMENT CARD */}
        <div
          data-testid="buyer-settlement-card"
          className={`p-4 rounded-xl border space-y-3.5 transition-all ${
            isCurrentUserBuyer
              ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
              : 'bg-[#0B0E14] border-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-sans text-slate-200">
                  Buyer Net Settlement
                </span>
                {isCurrentUserBuyer && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {buyerUser?.displayName || order.buyerId}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                order.state === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : order.state === 'CANCELLED'
                  ? 'bg-slate-700/50 text-slate-300 border border-slate-600'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {meta.buyerStatus}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gross Crypto Purchased:</span>
              <span className="text-slate-200 font-bold">
                {formatMicro6(grossCrypto)} {order.asset}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-300">
              <span className="text-[11px]">Buyer Platform Fee (0%):</span>
              <span className="font-bold">0.000000 {order.asset}</span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-slate-100 font-bold text-sm block">
                  Net Crypto Payout (100%):
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Credited directly to buyer custody
                </span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-base block">
                  {formatMicro6(buyerNetCryptoMicro)} {order.asset}
                </span>
                <span className="text-[10px] text-emerald-500/90 font-mono block">
                  {order.state === 'COMPLETED' ? 'Settled in Wallet' : 'Locked in Escrow'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Total Fiat Cost Paid:</span>
              <span className="text-slate-100 font-bold">
                {fiatSym}{formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* SELLER SETTLEMENT CARD */}
        <div
          data-testid="seller-settlement-card"
          className={`p-4 rounded-xl border space-y-3.5 transition-all ${
            isCurrentUserSeller
              ? 'bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/20'
              : 'bg-[#0B0E14] border-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-sans text-slate-200">
                  Seller Net Settlement
                </span>
                {isCurrentUserSeller && (
                  <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {sellerUser?.displayName || order.sellerId}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                order.state === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : order.state === 'CANCELLED'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {meta.sellerStatus}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gross Fiat Proceeds:</span>
              <span className="text-slate-200 font-bold">
                {fiatSym}{formatMinor2(order.grossFiatMinor)} {order.fiatCurrency}
              </span>
            </div>

            <div className="flex items-center justify-between text-amber-300">
              <span className="text-[11px]">Platform Protocol Fee (1%):</span>
              <span className="font-bold">
                -{fiatSym}{formatMinor2(platformFeeFiatMinor)} {order.fiatCurrency}
              </span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-slate-100 font-bold text-sm block">
                  Net Fiat Payout (99%):
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Received in bank via {order.paymentMethod}
                </span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-base block">
                  {fiatSym}{formatMinor2(sellerNetFiatMinor)} {order.fiatCurrency}
                </span>
                <span className="text-[10px] text-emerald-500/90 font-mono block">
                  {order.state === 'COMPLETED'
                    ? 'Fiat Received & Released'
                    : 'Awaiting Bank Receipt'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Total Escrow Relinquished:</span>
              <span className="text-slate-100 font-bold">
                {formatMicro6(grossCrypto)} {order.asset}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Double-Entry Settlement Matrix Table */}
      {showLedgerMatrix && (
        <div className="border-t border-white/[0.08] overflow-hidden">
          <div className="px-5 py-2.5 bg-[#0F141C] flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 font-display">
              Double-Entry Settlement Matrix (Real-Time Accounting)
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              Currency: {order.fiatCurrency} · Asset: {order.asset}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#0B0E14] text-slate-400 border-b border-white/[0.06] text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Party</th>
                  <th className="py-2.5 px-4 font-semibold">Fiat Leg</th>
                  <th className="py-2.5 px-4 font-semibold">Platform Fee (1%)</th>
                  <th className="py-2.5 px-4 font-semibold">Crypto Leg</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Net Payout Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-bold text-slate-100 font-sans">
                    Buyer ({buyerUser?.displayName || order.buyerId})
                  </td>
                  <td className="py-3 px-4 text-red-400">
                    -{fiatSym}{formatMinor2(order.grossFiatMinor)}
                  </td>
                  <td className="py-3 px-4 text-emerald-400">
                    {fiatSym}0.00 (0% Buyer Fee)
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    +{formatMicro6(buyerNetCryptoMicro)} {order.asset}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.state === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : order.state === 'CANCELLED'
                          ? 'bg-slate-700/50 text-slate-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {order.state === 'COMPLETED' ? 'Credited 100% Crypto' : order.state === 'CANCELLED' ? 'Void' : 'Pending Transfer'}
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-bold text-slate-100 font-sans">
                    Seller ({sellerUser?.displayName || order.sellerId})
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    +{fiatSym}{formatMinor2(sellerNetFiatMinor)}
                  </td>
                  <td className="py-3 px-4 text-amber-400">
                    -{fiatSym}{formatMinor2(platformFeeFiatMinor)} (1% Fee)
                  </td>
                  <td className="py-3 px-4 text-red-400">
                    -{formatMicro6(grossCrypto)} {order.asset}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.state === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : order.state === 'CANCELLED'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {order.state === 'COMPLETED' ? 'Net Fiat Received (99%)' : order.state === 'CANCELLED' ? 'Escrow Restored' : 'Awaiting Receipt'}
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-sans text-sky-300">
                    Costorah Protocol Treasury
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    +{fiatSym}{formatMinor2(platformFeeFiatMinor)}
                  </td>
                  <td className="py-3 px-4 text-amber-400 font-bold">
                    1.00% Seller Escrow Fee
                  </td>
                  <td className="py-3 px-4 text-slate-400">1:1 Escrow Custody</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.state === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : order.state === 'CANCELLED'
                          ? 'bg-slate-700/50 text-slate-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {order.state === 'COMPLETED' ? 'Fee Settled' : order.state === 'CANCELLED' ? 'No Fee Charged' : 'Pending Settlement'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
