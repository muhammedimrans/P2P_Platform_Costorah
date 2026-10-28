import React, { useState } from 'react';
import {
  ALL_FIAT_CURRENCIES,
  FIAT_SYMBOLS,
  type AuditEvent,
  type EscrowOrderRecord,
  type FiatCurrency,
  type SecurityIncident,
  type UserProfile,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import {
  ShieldAlert,
  CheckCircle2,
  Scale,
  Sliders,
  FileSpreadsheet,
  Lock,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { CustomSelect, buildFiatCurrencyOptions } from './CustomSelect';

interface AdminViewProps {
  currentUser: UserProfile;
  orders: EscrowOrderRecord[];
  allUsers: UserProfile[];
  auditLogs: AuditEvent[];
  incidents: SecurityIncident[];
  feeBps: number;
  supportedPaymentMethods: Record<FiatCurrency, string[]>;
  reconciliation: {
    isValid: boolean;
    totalUsersChecked: number;
    discrepancies: string[];
  };
  onAdminLogin: (username: string, password: string) => Promise<void>;
  onLogoutAdmin: () => Promise<void>;
  onResolveDispute: (params: {
    orderId: string;
    outcome: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER';
    resolutionNote: string;
  }) => Promise<void>;
  onUpdateFeeBps: (feeBps: number) => Promise<void>;
  onAddPaymentRail: (fiatCurrency: FiatCurrency, methodName: string) => Promise<void>;
  onCreateIncident: (title: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', notes: string) => Promise<void>;
  onResolveIncident: (incidentId: string) => Promise<void>;
  onOpenOrder: (orderId: string) => void;
}

type AdminTab = 'DISPUTES' | 'ORDERS_ESCROW' | 'FEE_AND_RAILS' | 'AUDIT_INCIDENTS';

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  orders,
  allUsers,
  auditLogs,
  incidents,
  feeBps,
  supportedPaymentMethods,
  reconciliation,
  onAdminLogin,
  onLogoutAdmin,
  onResolveDispute,
  onUpdateFeeBps,
  onAddPaymentRail,
  onCreateIncident,
  onResolveIncident,
  onOpenOrder,
}) => {
  const [tab, setTab] = useState<AdminTab>('DISPUTES');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [feeInputBps, setFeeInputBps] = useState<string>(String(feeBps));
  const [newRailFiat, setNewRailFiat] = useState<FiatCurrency>('INR');
  const [newRailName, setNewRailName] = useState<string>('');
  const [incTitle, setIncTitle] = useState<string>('');
  const [incSeverity, setIncSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [incNotes, setIncNotes] = useState<string>('');
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Admin Login Gate State
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState<boolean>(false);

  const disputedOrders = orders.filter((o) => o.state === 'DISPUTED');

  const handleAdminGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      await onAdminLogin(adminUsername, adminPassword);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Invalid administrator credentials');
    } finally {
      setLoginBusy(false);
    }
  };

  if (currentUser.role !== 'ADMIN') {
    return (
      <div
        data-testid="admin-login-gate"
        className="max-w-xl mx-auto my-8 bg-[#131A24] border border-white/15 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 text-[#020617] text-[11px] font-mono font-bold uppercase">
              <Lock className="w-3.5 h-3.5" />
              <span>Restricted Administrator Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 font-display mt-2">
              Costorah Admin Console Login
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              You are currently signed in as a Trader User ({currentUser.displayName}). Enter Administrator credentials to unlock Escrow Arbitration, Fee Governance & Audit Controls.
            </p>
          </div>
        </div>

        {loginError && (
          <div
            role="alert"
            data-testid="admin-gate-error"
            className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-xs font-semibold text-red-200 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <div className="p-3.5 bg-[#0B0E14] border border-white/15 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div>
            <span className="text-slate-300">Admin Login Credentials: </span>
            <strong className="text-emerald-400">admin</strong>
            <span className="text-slate-400"> / </span>
            <strong className="text-emerald-400">admin</strong>
          </div>
          <button
            type="button"
            data-testid="admin-page-autofill-btn"
            onClick={() => {
              setAdminUsername('admin');
              setAdminPassword('admin');
              setLoginError(null);
            }}
            className="px-3 py-1 rounded-lg bg-[#0B65C6] text-white text-xs font-bold cursor-pointer"
          >
            Fill admin / admin
          </button>
        </div>

        <form onSubmit={handleAdminGateSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-page-username" className="block text-xs font-bold text-slate-200 mb-1.5">
              Administrator Username
            </label>
            <input
              id="admin-page-username"
              data-testid="admin-page-username-input"
              type="text"
              required
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="admin-page-password" className="block text-xs font-bold text-slate-200 mb-1.5">
              Administrator Password
            </label>
            <input
              id="admin-page-password"
              data-testid="admin-page-password-input"
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="admin"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
            />
          </div>

          <button
            type="submit"
            data-testid="admin-page-login-btn"
            disabled={loginBusy}
            className="w-full py-3 px-5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Lock className="w-4 h-4" />
            <span>{loginBusy ? 'Verifying Administrator...' : 'Sign In to Admin Console'}</span>
          </button>
        </form>
      </div>
    );
  }

  const handleArbitrate = async (
    orderId: string,
    outcome: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER'
  ) => {
    const note =
      resolutionNotes[orderId] ||
      (outcome === 'RELEASE_TO_BUYER'
        ? 'Verified bank credit evidence; authorized release to Buyer.'
        : 'Counterparty failed to provide valid UTR/SEPA proof; refunded escrow to Seller.');
    await onResolveDispute({ orderId, outcome, resolutionNote: note });
    setAdminFeedback(`Dispute on ${orderId} resolved with outcome: ${outcome}`);
  };

  const handleFeeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateFeeBps(Number(feeInputBps));
    setAdminFeedback(`Updated global platform fee to ${feeInputBps} bps (${(Number(feeInputBps) / 100).toFixed(2)}%).`);
  };

  const handleAddRail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRailName.trim()) return;
    await onAddPaymentRail(newRailFiat, newRailName.trim());
    setNewRailName('');
    setAdminFeedback(`Added payment rail "${newRailName}" to ${newRailFiat}.`);
  };

  const handleCreateInc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim()) return;
    await onCreateIncident(incTitle, incSeverity, incNotes);
    setIncTitle('');
    setIncNotes('');
    setAdminFeedback('Security incident logged to audit ledger.');
  };

  return (
    <div className="space-y-6" data-testid="admin-console-authenticated">
      {/* Header & Reconciliation Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-[#020617] font-mono font-bold text-[10px]">
              ADMIN SESSION: {currentUser.displayName}
            </span>
            <span>
              · Double-Entry Ledger Reconciliation:{' '}
              <span className="text-emerald-400 font-mono">
                {reconciliation.isValid
                  ? `VERIFIED (${reconciliation.totalUsersChecked} accounts reconciled, 0 discrepancies)`
                  : 'DISCREPANCY DETECTED'}
              </span>
            </span>
            <button
              type="button"
              data-testid="admin-page-logout-btn"
              onClick={onLogoutAdmin}
              className="ml-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit Admin Mode (Return to User)</span>
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1.5">
            Escrow Arbitration, Fee Policy & Audit Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#131A24] p-1 rounded-lg border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setTab('DISPUTES')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'DISPUTES' ? 'bg-emerald-500 text-[#0B0E14]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Dispute Review ({disputedOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('ORDERS_ESCROW')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'ORDERS_ESCROW' ? 'bg-emerald-500 text-[#0B0E14]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Order & User Monitoring
          </button>
          <button
            type="button"
            onClick={() => setTab('FEE_AND_RAILS')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'FEE_AND_RAILS' ? 'bg-emerald-500 text-[#0B0E14]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fee & Payment Config
          </button>
          <button
            type="button"
            onClick={() => setTab('AUDIT_INCIDENTS')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'AUDIT_INCIDENTS' ? 'bg-emerald-500 text-[#0B0E14]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Audit Logs & Incidents ({auditLogs.length})
          </button>
        </div>
      </div>

      {adminFeedback && (
        <div role="status" className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{adminFeedback}</span>
        </div>
      )}

      {tab === 'DISPUTES' && (
        <div className="space-y-4">
          <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>Frozen Disputed Orders Requiring Arbitration ({disputedOrders.length})</span>
            </h2>

            {disputedOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                All disputed orders have been resolved. Escrow ledger is in 100% equilibrium.
              </div>
            ) : (
              <div className="space-y-4">
                {disputedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-5 bg-[#0B0E14] border border-amber-500/30 rounded-xl space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                      <div>
                        <span className="text-sm font-bold text-slate-100 font-mono">
                          Order {ord.id}
                        </span>
                        <span className="text-xs text-slate-400 ml-3">
                          Escrow Locked: {formatMicro6(ord.cryptoQuantityMicro)} {ord.asset} · Gross Fiat:{' '}
                          {FIAT_SYMBOLS[ord.fiatCurrency]}
                          {formatMinor2(ord.grossFiatMinor)} {ord.fiatCurrency}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenOrder(ord.id)}
                        className="text-xs text-emerald-400 hover:underline cursor-pointer"
                      >
                        Inspect Full Trade Room Transcript
                      </button>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <div>
                        <span className="text-slate-400">Dispute Reason:</span> {ord.disputeReason}
                      </div>
                      <div className="font-mono text-slate-400">
                        Submitted Payment Reference: {ord.paymentReference || 'None'} · Evidence:{' '}
                        {ord.paymentEvidenceUrl || 'None'}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`note-${ord.id}`}
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Arbitrator Decision & Audit Rationale
                      </label>
                      <input
                        id={`note-${ord.id}`}
                        type="text"
                        placeholder="Record verification findings (e.g. verified bank UTR or confirmed buyer default)..."
                        value={resolutionNotes[ord.id] || ''}
                        onChange={(e) =>
                          setResolutionNotes((prev) => ({ ...prev, [ord.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleArbitrate(ord.id, 'RELEASE_TO_BUYER')}
                        className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
                      >
                        Authorize Escrow Release to Buyer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArbitrate(ord.id, 'REFUND_TO_SELLER')}
                        className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-950/60 border border-amber-500/40 hover:bg-amber-900/60 rounded-lg cursor-pointer"
                      >
                        Authorize Escrow Refund to Seller
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'ORDERS_ESCROW' && (
        <div className="space-y-6">
          <div className="bg-[#131A24] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#0F141C] border-b border-white/[0.08] flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Platform-Wide Escrow Orders ({orders.length})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-400 bg-[#0B0E14]">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Buyer / Seller</th>
                    <th className="py-3 px-4 text-right">Escrow Crypto</th>
                    <th className="py-3 px-4 text-right">Fiat & 1% Fee</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs font-mono tabular-nums">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-semibold text-slate-100">{o.id}</td>
                      <td className="py-3 px-4 text-emerald-400">{o.state}</td>
                      <td className="py-3 px-4 font-sans text-slate-300">
                        {o.buyerId} → {o.sellerId}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100">
                        {formatMicro6(o.cryptoQuantityMicro)} {o.asset}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {FIAT_SYMBOLS[o.fiatCurrency]}
                        {formatMinor2(o.grossFiatMinor)} (Fee: {FIAT_SYMBOLS[o.fiatCurrency]}
                        {formatMinor2(o.platformFeeFiatMinor)})
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => onOpenOrder(o.id)}
                          className="text-emerald-400 hover:underline cursor-pointer"
                        >
                          View Room
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registered Users Directory */}
          <div className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-100 font-display">
              Unified User Accounts & Reputation ({allUsers.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3.5 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-100">
                      {u.displayName} ({u.role})
                    </div>
                    <div className="text-slate-400 font-mono mt-0.5">
                      {u.email} · {u.wallets.length} linked wallet(s) · {u.completedTrades} trades ({u.completionRatePct}%)
                    </div>
                  </div>
                  <span className="text-emerald-400 font-mono">{u.kycTier}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'FEE_AND_RAILS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Configurable 1% Fee Policy */}
          <form
            onSubmit={handleFeeSave}
            className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Platform Trading Fee Configuration</span>
            </h2>
            <p className="text-xs text-slate-400">
              Default business policy is 100 basis points (1.00%) charged to the seller on the agreed fiat value using exact integer minor-unit arithmetic.
            </p>
            <div>
              <label htmlFor="admin-fee-bps" className="block text-xs font-medium text-slate-300 mb-1">
                Platform Fee in Basis Points (100 bps = 1.00%)
              </label>
              <input
                id="admin-fee-bps"
                type="number"
                min={0}
                max={500}
                value={feeInputBps}
                onChange={(e) => setFeeInputBps(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
            >
              Update Fee Policy
            </button>
          </form>

          {/* Payment Method Configuration */}
          <form
            onSubmit={handleAddRail}
            className="bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-100 font-display">
              Supported Local Fiat Payment Rails
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rail-fiat" className="block text-xs text-slate-300 mb-1">
                  Fiat Currency
                </label>
                <CustomSelect
                  id="rail-fiat"
                  testId="rail-fiat"
                  value={newRailFiat}
                  onChange={(val) => setNewRailFiat(val as FiatCurrency)}
                  options={buildFiatCurrencyOptions(ALL_FIAT_CURRENCIES)}
                />
              </div>
              <div>
                <label htmlFor="rail-name" className="block text-xs text-slate-300 mb-1">
                  New Payment Method Name
                </label>
                <input
                  id="rail-name"
                  type="text"
                  placeholder="e.g. Pix / FedWire"
                  value={newRailName}
                  onChange={(e) => setNewRailName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
            >
              Enable Payment Method
            </button>

            <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs">
              {(Object.keys(supportedPaymentMethods) as FiatCurrency[]).map((f) => (
                <div key={f} className="text-slate-400">
                  <span className="font-mono font-bold text-slate-200">{f}:</span>{' '}
                  {supportedPaymentMethods[f].join(' · ')}
                </div>
              ))}
            </div>
          </form>
        </div>
      )}

      {tab === 'AUDIT_INCIDENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Immutable Audit Logs */}
          <div className="lg:col-span-7 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-100 font-display">
              Immutable Cryptographic Audit Trail ({auditLogs.length})
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {auditLogs.map((a) => (
                <div
                  key={a.id}
                  className="p-3 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-xs font-mono"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-emerald-400 font-semibold">{a.action}</span>
                    <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-200 font-sans mt-1">{a.details}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Actor: {a.actorId} ({a.actorRole}) · Target: {a.targetType}/{a.targetId}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Incident Management */}
          <div className="lg:col-span-5 bg-[#131A24] border border-white/[0.08] rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-100 font-display flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Incident & Operational Risk Management</span>
            </h2>

            <form onSubmit={handleCreateInc} className="space-y-3 pb-4 border-b border-white/[0.06]">
              <div>
                <label htmlFor="inc-title" className="block text-xs text-slate-300 mb-1">
                  Incident Title
                </label>
                <input
                  id="inc-title"
                  type="text"
                  required
                  placeholder="e.g. Arbitrum Sepolia RPC Latency Spike"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="inc-sev" className="block text-xs text-slate-300 mb-1">
                  Severity
                </label>
                <CustomSelect
                  id="inc-sev"
                  testId="inc-sev"
                  value={incSeverity}
                  onChange={(val) => setIncSeverity(val as 'LOW' | 'MEDIUM' | 'HIGH')}
                  options={[
                    { value: 'LOW', badgeText: 'LOW', badgeVariant: 'emerald', label: 'LOW — Minor Notice' },
                    { value: 'MEDIUM', badgeText: 'MED', badgeVariant: 'amber', label: 'MEDIUM — Degraded Rail' },
                    { value: 'HIGH', badgeText: 'HIGH', badgeVariant: 'blue', label: 'HIGH — Critical Alert' },
                  ]}
                  searchable={false}
                />
              </div>
              <div>
                <label htmlFor="inc-notes" className="block text-xs text-slate-300 mb-1">
                  Mitigation Notes
                </label>
                <input
                  id="inc-notes"
                  type="text"
                  value={incNotes}
                  onChange={(e) => setIncNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-lg text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold text-[#0B0E14] bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
              >
                Log Operational Incident
              </button>
            </form>

            <div className="space-y-2.5">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 bg-[#0B0E14] border border-white/[0.06] rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{inc.title}</span>
                    <span className="font-mono text-amber-400">
                      {inc.severity} · {inc.status}
                    </span>
                  </div>
                  <p className="text-slate-400">{inc.notes}</p>
                  {inc.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => onResolveIncident(inc.id)}
                      className="text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
                    >
                      Mark Incident Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
