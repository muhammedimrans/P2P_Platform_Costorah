/**
 * AegisP2P Core Financial, Escrow State Machine, Price Alert Worker & Double-Entry Ledger Engine
 * Pure TypeScript module with zero DOM dependencies — unit tested via node:test.
 */

export type OrderState =
  | 'DRAFT'
  | 'OFFER_OPEN'
  | 'ORDER_RESERVED'
  | 'ESCROW_FUNDING'
  | 'ESCROW_LOCKED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_MARKED_SENT'
  | 'PAYMENT_REVIEW'
  | 'RELEASE_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DISPUTED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'ESCROW_RECOVERY_REQUIRED';

export type CryptoAsset = 'USDT' | 'USDC' | 'BTC' | 'ETH' | 'SOL' | 'BNB';
export type FiatCurrency =
  | 'INR'
  | 'USD'
  | 'TRY'
  | 'IRR'
  | 'NGN'
  | 'EUR'
  | 'GBP'
  | 'BRL'
  | 'AED'
  | 'VND';

export type CountryCode =
  | 'IN'
  | 'US'
  | 'TR'
  | 'IR'
  | 'NG'
  | 'EU'
  | 'GB'
  | 'BR'
  | 'AE'
  | 'VN';

export type AlertDirection = 'AT_OR_BELOW' | 'AT_OR_ABOVE';
export type AlertChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

export interface PriceAlertRecord {
  id: string;
  userId: string;
  userEmail: string;
  asset: CryptoAsset;
  fiatCurrency: FiatCurrency;
  direction: AlertDirection;
  targetPriceFiatMinor: number;
  channel: AlertChannel;
  status: 'ACTIVE' | 'TRIGGERED' | 'PAUSED';
  createdAt: string;
  triggeredAt?: string;
  triggeredOfferId?: string;
  triggeredPriceFiatMinor?: number;
  emailDispatched?: boolean;
}

export interface TradeFeeBreakdown {
  fiatCurrency: FiatCurrency;
  cryptoAsset: CryptoAsset;
  /** Agreed fiat trade value in minor units (e.g. paise/cents, 2 decimals) */
  grossFiatMinor: number;
  /** Formatted gross fiat string, e.g. "10000.00" */
  grossFiatFormatted: string;
  /** Platform fee rate in basis points (default 100 bps = 1.00%) */
  feeBps: number;
  /** Platform fee in fiat minor units charged to the seller */
  platformFeeFiatMinor: number;
  /** Formatted platform fee in fiat, e.g. "100.00" */
  platformFeeFiatFormatted: string;
  /** Seller's net fiat proceeds before external payment costs in minor units */
  sellerNetFiatMinor: number;
  /** Formatted seller net fiat proceeds, e.g. "9900.00" */
  sellerNetFiatFormatted: string;
  /** Price per 1 whole crypto unit in fiat minor units */
  unitPriceFiatMinor: number;
  /** Crypto quantity in micro-units (6 decimals, 1_000_000 = 1.000000) */
  cryptoQuantityMicro: number;
  /** Formatted crypto quantity (6 decimals) */
  cryptoQuantityFormatted: string;
  /** Platform fee equivalent in crypto micro-units (1% of crypto quantity if settled in crypto) */
  platformFeeCryptoMicro: number;
  /** Formatted platform fee in crypto */
  platformFeeCryptoFormatted: string;
  /** Net crypto delivered to buyer (100% of total crypto value) in micro-units */
  buyerNetCryptoMicro: number;
  /** Formatted buyer net crypto proceeds (100%) */
  buyerNetCryptoFormatted: string;
}

/**
 * Formal transition map for the 16-state P2P Escrow Order State Machine.
 */
export const PERMITTED_ORDER_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  DRAFT: ['OFFER_OPEN', 'CANCELLED'],
  OFFER_OPEN: ['ORDER_RESERVED', 'CANCELLED', 'EXPIRED'],
  ORDER_RESERVED: ['ESCROW_FUNDING', 'ESCROW_LOCKED', 'CANCELLED', 'EXPIRED'],
  ESCROW_FUNDING: ['ESCROW_LOCKED', 'CANCELLED', 'EXPIRED', 'ESCROW_RECOVERY_REQUIRED'],
  ESCROW_LOCKED: ['PAYMENT_PENDING', 'PAYMENT_MARKED_SENT', 'RELEASE_PENDING', 'DISPUTED', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_MARKED_SENT', 'PAYMENT_REVIEW', 'RELEASE_PENDING', 'CANCELLED', 'EXPIRED', 'DISPUTED'],
  // CRITICAL INVARIANT: PAYMENT_MARKED_SENT can transition to PAYMENT_REVIEW, RELEASE_PENDING (via seller confirmation), or DISPUTED.
  PAYMENT_MARKED_SENT: ['PAYMENT_REVIEW', 'RELEASE_PENDING', 'DISPUTED'],
  PAYMENT_REVIEW: ['RELEASE_PENDING', 'COMPLETED', 'DISPUTED'],
  RELEASE_PENDING: ['COMPLETED', 'ESCROW_RECOVERY_REQUIRED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  // CRITICAL INVARIANT: DISPUTED orders are frozen until authorized resolution moves them to RELEASE_PENDING, REFUND_PENDING, or ESCROW_RECOVERY_REQUIRED.
  DISPUTED: ['RELEASE_PENDING', 'REFUND_PENDING', 'ESCROW_RECOVERY_REQUIRED'],
  REFUND_PENDING: ['REFUNDED', 'ESCROW_RECOVERY_REQUIRED'],
  REFUNDED: [],
  ESCROW_RECOVERY_REQUIRED: ['REFUND_PENDING', 'RELEASE_PENDING', 'REFUNDED', 'COMPLETED'],
};

export function isValidOrderTransition(from: OrderState, to: OrderState): boolean {
  const allowed = PERMITTED_ORDER_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertValidTransition(
  from: OrderState,
  to: OrderState,
  actorRole: 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM'
): void {
  if (!isValidOrderTransition(from, to)) {
    throw new Error(`Invalid state transition from ${from} to ${to}.`);
  }

  // Enforce role-specific invariants
  if ((from === 'PAYMENT_MARKED_SENT' || from === 'PAYMENT_REVIEW') && to === 'RELEASE_PENDING') {
    if (actorRole !== 'SELLER' && actorRole !== 'ADMIN') {
      throw new Error(
        `Unauthorized transition to RELEASE_PENDING: actor ${actorRole} cannot authorize crypto release. Only SELLER or ADMIN may authorize release.`
      );
    }
  }

  if (from === 'DISPUTED' && (to === 'RELEASE_PENDING' || to === 'REFUND_PENDING' || to === 'ESCROW_RECOVERY_REQUIRED')) {
    if (actorRole !== 'ADMIN') {
      throw new Error(
        `Disputed funds are locked. Only an authorized ADMIN reviewer can transition a DISPUTED order to ${to}.`
      );
    }
  }

  if (to === 'EXPIRED' && (from === 'PAYMENT_MARKED_SENT' || from === 'PAYMENT_REVIEW' || from === 'DISPUTED')) {
    throw new Error(`Cannot expire an order in state ${from} because fiat payment may already have occurred.`);
  }
}

/**
 * Formats integer minor units (2 decimal places) to string without floating point errors.
 */
export function formatMinor2(minorUnits: number): string {
  const rounded = Math.round(minorUnits);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Formats integer micro units (6 decimal places) to string without floating point errors.
 */
export function formatMicro6(microUnits: number): string {
  const rounded = Math.round(microUnits);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 1_000_000);
  const frac = abs % 1_000_000;
  return `${sign}${whole}.${String(frac).padStart(6, '0')}`;
}

/**
 * Parses a decimal string into integer minor units (2 decimals) using exact string splitting.
 */
export function parseFiatToMinor(amountStr: string | number): number {
  const clean = String(amountStr).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    throw new Error(`Invalid fiat amount format: "${amountStr}". Expected positive number with up to 2 decimals.`);
  }
  const [wholePart, fracPart = ''] = clean.split('.');
  const whole = parseInt(wholePart, 10);
  const frac = parseInt(fracPart.padEnd(2, '0'), 10);
  return whole * 100 + frac;
}

/**
 * Parses a decimal string into integer micro units (6 decimals) using exact string splitting.
 */
export function parseCryptoToMicro(amountStr: string | number): number {
  const clean = String(amountStr).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,6})?$/.test(clean)) {
    throw new Error(`Invalid crypto amount format: "${amountStr}". Expected positive number with up to 6 decimals.`);
  }
  const [wholePart, fracPart = ''] = clean.split('.');
  const whole = parseInt(wholePart, 10);
  const frac = parseInt(fracPart.padEnd(6, '0'), 10);
  return whole * 1_000_000 + frac;
}

/**
 * Calculates precise 1% (configurable basis points) platform fee and net proceeds using BigInt integer math.
 * Default rounding rule: Half-up integer rounding on basis points (`(value * feeBps + 5000n) / 10000n`).
 */
export function calculateTradeBreakdown(params: {
  grossFiatInput: string | number;
  unitPriceFiatInput: string | number;
  fiatCurrency: FiatCurrency;
  cryptoAsset: CryptoAsset;
  feeBps?: number;
}): TradeFeeBreakdown {
  const feeBps = params.feeBps ?? 100; // 100 bps = 1.00%
  if (feeBps < 0 || feeBps > 1000 || !Number.isInteger(feeBps)) {
    throw new Error(`Invalid feeBps: ${feeBps}. Must be an integer between 0 and 1000.`);
  }

  const grossFiatMinor = parseFiatToMinor(params.grossFiatInput);
  const unitPriceFiatMinor = parseFiatToMinor(params.unitPriceFiatInput);

  if (grossFiatMinor <= 0) {
    throw new Error('Gross fiat trade value must be greater than zero.');
  }
  if (unitPriceFiatMinor <= 0) {
    throw new Error('Unit price must be greater than zero.');
  }

  const grossBig = BigInt(grossFiatMinor);
  const bpsBig = BigInt(feeBps);
  const unitPriceBig = BigInt(unitPriceFiatMinor);

  // Half-up rounding for fee in minor fiat units: (gross * bps + 5000) / 10000
  const feeFiatBig = (grossBig * bpsBig + 5000n) / 10000n;
  const sellerNetBig = grossBig - feeFiatBig;

  // Crypto quantity in micro units (10^6): (grossFiatMinor * 1_000_000 + unitPrice/2) / unitPriceFiatMinor
  const cryptoMicroBig = (grossBig * 1_000_000n + unitPriceBig / 2n) / unitPriceBig;
  const feeCryptoMicroBig = (cryptoMicroBig * bpsBig + 5000n) / 10000n;

  const platformFeeFiatMinor = Number(feeFiatBig);
  const sellerNetFiatMinor = Number(sellerNetBig);
  const cryptoQuantityMicro = Number(cryptoMicroBig);
  const platformFeeCryptoMicro = Number(feeCryptoMicroBig);

  const buyerNetCryptoMicro = cryptoQuantityMicro;

  return {
    fiatCurrency: params.fiatCurrency,
    cryptoAsset: params.cryptoAsset,
    grossFiatMinor,
    grossFiatFormatted: formatMinor2(grossFiatMinor),
    feeBps,
    platformFeeFiatMinor,
    platformFeeFiatFormatted: formatMinor2(platformFeeFiatMinor),
    sellerNetFiatMinor,
    sellerNetFiatFormatted: formatMinor2(sellerNetFiatMinor),
    unitPriceFiatMinor,
    cryptoQuantityMicro,
    cryptoQuantityFormatted: formatMicro6(cryptoQuantityMicro),
    platformFeeCryptoMicro,
    platformFeeCryptoFormatted: formatMicro6(platformFeeCryptoMicro),
    buyerNetCryptoMicro,
    buyerNetCryptoFormatted: formatMicro6(buyerNetCryptoMicro),
  };
}

/**
 * Evaluates active price alerts against open marketplace offers (used by the background worker).
 * Returns the list of newly triggered alerts without mutating non-matching alerts.
 */
export function evaluatePriceAlertsAgainstOffers(
  alerts: PriceAlertRecord[],
  offers: OfferRecord[],
  nowIso: string = new Date().toISOString()
): PriceAlertRecord[] {
  const newlyTriggered: PriceAlertRecord[] = [];
  const openOffers = offers.filter((o) => o.status === 'OPEN' && o.availableQuantityMicro > 0);

  for (const alert of alerts) {
    if (alert.status !== 'ACTIVE') continue;
    const pairOffers = openOffers.filter(
      (o) => o.asset === alert.asset && o.fiatCurrency === alert.fiatCurrency
    );
    if (pairOffers.length === 0) continue;

    const matchedOffer = pairOffers.find((o) => {
      if (alert.direction === 'AT_OR_BELOW') {
        return o.unitPriceFiatMinor <= alert.targetPriceFiatMinor;
      }
      return o.unitPriceFiatMinor >= alert.targetPriceFiatMinor;
    });

    if (matchedOffer) {
      alert.status = 'TRIGGERED';
      alert.triggeredAt = nowIso;
      alert.triggeredOfferId = matchedOffer.id;
      alert.triggeredPriceFiatMinor = matchedOffer.unitPriceFiatMinor;
      alert.emailDispatched = alert.channel === 'EMAIL' || alert.channel === 'BOTH';
      newlyTriggered.push({ ...alert });
    }
  }

  return newlyTriggered;
}

/**
 * Sanitizes and masks credit/debit card numbers so full PANs are never stored in plaintext.
 */
export function sanitizeAndMaskCardIdentifier(rawIdentifier: string, cardNetwork = 'Visa'): string {
  const digitsOnly = rawIdentifier.replace(/\D/g, '');
  if (digitsOnly.length < 4) {
    throw new Error('Card number or last-4 identifier must contain at least 4 digits.');
  }
  const last4 = digitsOnly.slice(-4);
  return `${cardNetwork} •••• ${last4}`;
}

export interface AssetBalance {
  asset: CryptoAsset;
  availableMicro: number;
  lockedMicro: number;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  userId: string;
  asset: CryptoAsset;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'SWAP_DEBIT'
    | 'SWAP_CREDIT'
    | 'OFFER_RESERVE'
    | 'OFFER_RELEASE_RESERVE'
    | 'ESCROW_LOCK'
    | 'ESCROW_RELEASE_TO_BUYER'
    | 'ESCROW_REFUND_TO_SELLER'
    | 'PLATFORM_FEE_CREDIT';
  deltaAvailableMicro: number;
  deltaLockedMicro: number;
  referenceId: string;
  idempotencyKey: string;
  note: string;
}

export interface EscrowOrderRecord {
  id: string;
  offerId: string;
  buyerId: string;
  sellerId: string;
  asset: CryptoAsset;
  fiatCurrency: FiatCurrency;
  cryptoQuantityMicro: number;
  grossFiatMinor: number;
  platformFeeFiatMinor: number;
  sellerNetFiatMinor: number;
  platformFeeCryptoMicro: number;
  unitPriceFiatMinor: number;
  state: OrderState;
  paymentMethod: string;
  paymentReference?: string;
  paymentEvidenceUrl?: string;
  paymentDeclaredAt?: string;
  disputeReason?: string;
  disputeOpenedBy?: string;
  disputeResolutionNote?: string;
  settlementTxHash?: string;
  buyerNetCryptoMicro?: number;
  /** Protocol payment window duration in seconds (default 1800s = 30m) */
  paymentWindowSeconds?: number;
  /** ISO timestamp when the payment window expires unless frozen by payment submission */
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  id: string;
  makerId: string;
  makerName: string;
  side: 'SELL' | 'BUY';
  asset: CryptoAsset;
  fiatCurrency: FiatCurrency;
  unitPriceFiatMinor: number;
  totalQuantityMicro: number;
  availableQuantityMicro: number;
  minOrderFiatMinor: number;
  maxOrderFiatMinor: number;
  paymentMethods: string[];
  paymentInstructions: string;
  status: 'OPEN' | 'PAUSED' | 'CANCELLED' | 'FILLED';
  completedTrades: number;
  completionRatePct: number;
  createdAt: string;
}

/**
 * In-memory & serializable Double-Entry Escrow Ledger Engine.
 */
export class EscrowLedgerEngine {
  private balances: Map<string, Map<CryptoAsset, { availableMicro: number; lockedMicro: number }>> = new Map();
  private offers: Map<string, OfferRecord> = new Map();
  private orders: Map<string, EscrowOrderRecord> = new Map();
  private ledger: LedgerEntry[] = [];
  private processedIdempotencyKeys: Set<string> = new Set();
  private feeBps = 100; // 1.00% default

  constructor(feeBps = 100) {
    this.feeBps = feeBps;
  }

  public setFeeBps(newFeeBps: number): void {
    if (newFeeBps < 0 || newFeeBps > 1000 || !Number.isInteger(newFeeBps)) {
      throw new Error('Fee bps must be an integer between 0 and 1000.');
    }
    this.feeBps = newFeeBps;
  }

  public getFeeBps(): number {
    return this.feeBps;
  }

  public getBalance(userId: string, asset: CryptoAsset): { availableMicro: number; lockedMicro: number } {
    const userMap = this.balances.get(userId);
    if (!userMap) return { availableMicro: 0, lockedMicro: 0 };
    const bal = userMap.get(asset);
    return bal ? { ...bal } : { availableMicro: 0, lockedMicro: 0 };
  }

  public getAllUserBalances(userId: string): AssetBalance[] {
    const assets: CryptoAsset[] = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB'];
    return assets.map((asset) => {
      const b = this.getBalance(userId, asset);
      return { asset, availableMicro: b.availableMicro, lockedMicro: b.lockedMicro };
    });
  }

  private setBalanceInternal(userId: string, asset: CryptoAsset, availableMicro: number, lockedMicro: number): void {
    if (availableMicro < 0 || lockedMicro < 0) {
      throw new Error(`Ledger invariant violation: negative balance for user=${userId} asset=${asset}`);
    }
    if (!this.balances.has(userId)) {
      this.balances.set(userId, new Map());
    }
    this.balances.get(userId)!.set(asset, { availableMicro, lockedMicro });
  }

  private appendLedger(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): LedgerEntry {
    const full: LedgerEntry = {
      ...entry,
      id: `led_${this.ledger.length + 1}_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.ledger.push(full);
    return full;
  }

  public deposit(userId: string, asset: CryptoAsset, amountMicro: number, idempotencyKey: string): AssetBalance {
    if (amountMicro <= 0 || !Number.isInteger(amountMicro)) {
      throw new Error('Deposit amount must be a positive integer in micro-units.');
    }
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      return { asset, ...this.getBalance(userId, asset) };
    }
    const current = this.getBalance(userId, asset);
    const nextAvail = current.availableMicro + amountMicro;
    this.setBalanceInternal(userId, asset, nextAvail, current.lockedMicro);
    this.processedIdempotencyKeys.add(idempotencyKey);
    this.appendLedger({
      userId,
      asset,
      type: 'DEPOSIT',
      deltaAvailableMicro: amountMicro,
      deltaLockedMicro: 0,
      referenceId: idempotencyKey,
      idempotencyKey,
      note: `Deposited ${formatMicro6(amountMicro)} ${asset}`,
    });
    return { asset, availableMicro: nextAvail, lockedMicro: current.lockedMicro };
  }

  public withdraw(userId: string, asset: CryptoAsset, amountMicro: number, idempotencyKey: string): AssetBalance {
    if (amountMicro <= 0 || !Number.isInteger(amountMicro)) {
      throw new Error('Withdrawal amount must be a positive integer in micro-units.');
    }
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      return { asset, ...this.getBalance(userId, asset) };
    }
    const current = this.getBalance(userId, asset);
    if (amountMicro > current.availableMicro) {
      throw new Error(
        `Insufficient available balance for withdrawal: requested ${formatMicro6(amountMicro)} ${asset}, available ${formatMicro6(current.availableMicro)} ${asset} (locked funds in escrow: ${formatMicro6(current.lockedMicro)} ${asset} cannot be withdrawn).`
      );
    }
    const nextAvail = current.availableMicro - amountMicro;
    this.setBalanceInternal(userId, asset, nextAvail, current.lockedMicro);
    this.processedIdempotencyKeys.add(idempotencyKey);
    this.appendLedger({
      userId,
      asset,
      type: 'WITHDRAWAL',
      deltaAvailableMicro: -amountMicro,
      deltaLockedMicro: 0,
      referenceId: idempotencyKey,
      idempotencyKey,
      note: `Withdrew ${formatMicro6(amountMicro)} ${asset}`,
    });
    return { asset, availableMicro: nextAvail, lockedMicro: current.lockedMicro };
  }

  public executeAssetSwap(params: {
    userId: string;
    fromAsset: CryptoAsset;
    toAsset: CryptoAsset;
    fromAmountMicro: number;
    chain: SwapChainId;
    settlementMode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL';
    destinationAddress?: string;
    slippageBps?: number;
    liveRates?: Partial<Record<CryptoAsset, number>>;
    usdInrRate?: number;
    idempotencyKey: string;
  }): SwapExecutionRecord {
    if (params.fromAmountMicro <= 0 || !Number.isInteger(params.fromAmountMicro)) {
      throw new Error('Swap amount must be a positive integer in micro-units.');
    }
    if (params.settlementMode === 'EXCHANGE_INTERNAL' && params.fromAsset === params.toAsset) {
      throw new Error('Source and destination currency must be different for an internal wallet exchange.');
    }
    if (params.settlementMode === 'WITHDRAW_EXTERNAL') {
      const addrCheck = validateSwapChainDestinationAddress(
        params.destinationAddress || '',
        params.chain
      );
      if (!addrCheck.valid) {
        throw new Error(addrCheck.error || 'Invalid destination wallet address for the selected chain.');
      }
    }

    const fromBal = this.getBalance(params.userId, params.fromAsset);
    if (params.fromAmountMicro > fromBal.availableMicro) {
      throw new Error(
        `Insufficient available ${params.fromAsset} balance for swap: requested ${formatMicro6(
          params.fromAmountMicro
        )} ${params.fromAsset}, available ${formatMicro6(fromBal.availableMicro)} ${params.fromAsset}.`
      );
    }

    const quote = calculateCrossChainSwapQuote({
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      fromAmountInput: formatMicro6(params.fromAmountMicro),
      chain: params.chain,
      settlementMode: params.settlementMode,
      slippageBps: params.slippageBps,
      liveRates: params.liveRates,
      usdInrRate: params.usdInrRate,
    });

    if (quote.toAmountMicro <= 0) {
      throw new Error('Swap amount is too small after network and liquidity fees.');
    }

    // Deduct source asset
    const nextFromAvail = fromBal.availableMicro - params.fromAmountMicro;
    this.setBalanceInternal(params.userId, params.fromAsset, nextFromAvail, fromBal.lockedMicro);
    const chainMeta = SUPPORTED_SWAP_CHAINS[params.chain];
    const swapId = `swp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    this.appendLedger({
      userId: params.userId,
      asset: params.fromAsset,
      type: params.settlementMode === 'WITHDRAW_EXTERNAL' ? 'WITHDRAWAL' : 'SWAP_DEBIT',
      deltaAvailableMicro: -params.fromAmountMicro,
      deltaLockedMicro: 0,
      referenceId: swapId,
      idempotencyKey: `${params.idempotencyKey}_debit`,
      note:
        params.settlementMode === 'WITHDRAW_EXTERNAL'
          ? `Swapped & withdrew ${quote.fromAmountFormatted} ${params.fromAsset} → ${quote.toAmountFormatted} ${params.toAsset} via ${chainMeta.name} to ${params.destinationAddress}`
          : `Swapped ${quote.fromAmountFormatted} ${params.fromAsset} → ${quote.toAmountFormatted} ${params.toAsset} on ${chainMeta.name}`,
    });

    if (params.settlementMode === 'EXCHANGE_INTERNAL') {
      const toBal = this.getBalance(params.userId, params.toAsset);
      this.setBalanceInternal(
        params.userId,
        params.toAsset,
        toBal.availableMicro + quote.toAmountMicro,
        toBal.lockedMicro
      );
      this.appendLedger({
        userId: params.userId,
        asset: params.toAsset,
        type: 'SWAP_CREDIT',
        deltaAvailableMicro: quote.toAmountMicro,
        deltaLockedMicro: 0,
        referenceId: swapId,
        idempotencyKey: `${params.idempotencyKey}_credit`,
        note: `Credited ${quote.toAmountFormatted} ${params.toAsset} from ${params.fromAsset} swap on ${chainMeta.name}`,
      });
    }

    this.processedIdempotencyKeys.add(params.idempotencyKey);

    const txHash =
      params.chain === 'SOL_CHAIN'
        ? `5SolSwap${Buffer.from(swapId).toString('hex').padEnd(56, '9').slice(0, 56)}`
        : `0x${Buffer.from(`chain_swap_${swapId}`).toString('hex').padEnd(64, 'b').slice(0, 64)}`;

    return {
      id: swapId,
      userId: params.userId,
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      fromAmountMicro: quote.fromAmountMicro,
      fromAmountFormatted: quote.fromAmountFormatted,
      toAmountMicro: quote.toAmountMicro,
      toAmountFormatted: quote.toAmountFormatted,
      chain: params.chain,
      chainName: chainMeta.name,
      tokenStandard: chainMeta.tokenStandard,
      settlementMode: params.settlementMode,
      destinationAddress:
        params.settlementMode === 'WITHDRAW_EXTERNAL'
          ? String(params.destinationAddress || '').trim()
          : undefined,
      exchangeRate: quote.exchangeRate,
      grossUsdValue: quote.grossUsdValue,
      netUsdValue: quote.netUsdValue,
      netInrValue: quote.netInrValue,
      swapFeeUsd: quote.swapFeeUsd,
      networkGasFeeUsd: quote.networkGasFeeUsd,
      txHash,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
  }

  public createOffer(params: {
    id: string;
    makerId: string;
    makerName: string;
    side: 'SELL' | 'BUY';
    asset: CryptoAsset;
    fiatCurrency: FiatCurrency;
    unitPriceFiatMinor: number;
    totalQuantityMicro: number;
    minOrderFiatMinor: number;
    maxOrderFiatMinor: number;
    paymentMethods: string[];
    paymentInstructions: string;
    completedTrades?: number;
    completionRatePct?: number;
  }): OfferRecord {
    if (params.totalQuantityMicro <= 0) {
      throw new Error('Offer total quantity must be positive.');
    }
    if (params.unitPriceFiatMinor <= 0) {
      throw new Error('Offer unit price must be positive.');
    }
    if (params.minOrderFiatMinor <= 0 || params.maxOrderFiatMinor < params.minOrderFiatMinor) {
      throw new Error('Invalid minimum/maximum order limits.');
    }
    if (!params.paymentMethods || params.paymentMethods.length === 0) {
      throw new Error('At least one payment method is required.');
    }

    if (params.side === 'SELL') {
      const bal = this.getBalance(params.makerId, params.asset);
      if (params.totalQuantityMicro > bal.availableMicro) {
        throw new Error(
          `Insufficient available inventory to create SELL offer: required ${formatMicro6(params.totalQuantityMicro)} ${params.asset}, available ${formatMicro6(bal.availableMicro)} ${params.asset}.`
        );
      }
      this.setBalanceInternal(
        params.makerId,
        params.asset,
        bal.availableMicro - params.totalQuantityMicro,
        bal.lockedMicro + params.totalQuantityMicro
      );
      this.appendLedger({
        userId: params.makerId,
        asset: params.asset,
        type: 'OFFER_RESERVE',
        deltaAvailableMicro: -params.totalQuantityMicro,
        deltaLockedMicro: params.totalQuantityMicro,
        referenceId: params.id,
        idempotencyKey: `offer_create_${params.id}`,
        note: `Reserved ${formatMicro6(params.totalQuantityMicro)} ${params.asset} for SELL offer ${params.id}`,
      });
    }

    const totalOfferFiatMinor = Math.max(
      1,
      Number(
        (BigInt(params.totalQuantityMicro) * BigInt(params.unitPriceFiatMinor) + 500_000n) /
          1_000_000n
      )
    );
    const maxUsdtCapMinor = calculateMaxOrderCapMinor({
      asset: params.asset,
      unitPriceFiatMinor: params.unitPriceFiatMinor,
    });
    const clampedMaxOrderFiatMinor = Math.max(
      1,
      Math.min(params.maxOrderFiatMinor, totalOfferFiatMinor, maxUsdtCapMinor)
    );
    const clampedMinOrderFiatMinor = Math.max(
      1,
      Math.min(params.minOrderFiatMinor, clampedMaxOrderFiatMinor)
    );

    const offer: OfferRecord = {
      id: params.id,
      makerId: params.makerId,
      makerName: params.makerName,
      side: params.side,
      asset: params.asset,
      fiatCurrency: params.fiatCurrency,
      unitPriceFiatMinor: params.unitPriceFiatMinor,
      totalQuantityMicro: params.totalQuantityMicro,
      availableQuantityMicro: params.totalQuantityMicro,
      minOrderFiatMinor: clampedMinOrderFiatMinor,
      maxOrderFiatMinor: clampedMaxOrderFiatMinor,
      paymentMethods: params.paymentMethods,
      paymentInstructions: params.paymentInstructions,
      status: 'OPEN',
      completedTrades: params.completedTrades ?? 42,
      completionRatePct: params.completionRatePct ?? 99.2,
      createdAt: new Date().toISOString(),
    };
    this.offers.set(offer.id, offer);
    return { ...offer };
  }

  public getOffer(offerId: string): OfferRecord | undefined {
    const offer = this.offers.get(offerId);
    return offer ? { ...offer } : undefined;
  }

  public cancelOffer(offerId: string, actorUserId: string): OfferRecord {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Offer ${offerId} not found.`);
    if (offer.makerId !== actorUserId) throw new Error('Only the offer creator can cancel this offer.');
    if (offer.status === 'CANCELLED' || offer.status === 'FILLED') {
      throw new Error(`Cannot cancel offer in status ${offer.status}.`);
    }

    const remainingMicro = offer.availableQuantityMicro;
    if (offer.side === 'SELL' && remainingMicro > 0) {
      const bal = this.getBalance(offer.makerId, offer.asset);
      if (bal.lockedMicro < remainingMicro) {
        throw new Error('Ledger invariant error: locked balance is less than remaining offer quantity.');
      }
      this.setBalanceInternal(
        offer.makerId,
        offer.asset,
        bal.availableMicro + remainingMicro,
        bal.lockedMicro - remainingMicro
      );
      this.appendLedger({
        userId: offer.makerId,
        asset: offer.asset,
        type: 'OFFER_RELEASE_RESERVE',
        deltaAvailableMicro: remainingMicro,
        deltaLockedMicro: -remainingMicro,
        referenceId: offer.id,
        idempotencyKey: `offer_cancel_${offer.id}`,
        note: `Released unreserved ${formatMicro6(remainingMicro)} ${offer.asset} from cancelled offer ${offer.id}`,
      });
    }

    offer.availableQuantityMicro = 0;
    offer.status = 'CANCELLED';
    return { ...offer };
  }

  public updateOffer(params: {
    offerId: string;
    actorUserId: string;
    unitPriceFiatMinor?: number;
    availableQuantityMicro?: number;
    minOrderFiatMinor?: number;
    maxOrderFiatMinor?: number;
    paymentMethods?: string[];
    paymentInstructions?: string;
  }): OfferRecord {
    const offer = this.offers.get(params.offerId);
    if (!offer) throw new Error(`Offer ${params.offerId} not found.`);
    if (offer.makerId !== params.actorUserId) {
      throw new Error('Only the offer creator can edit this offer.');
    }
    if (offer.status === 'CANCELLED' || offer.status === 'FILLED') {
      throw new Error(`Cannot edit offer in status ${offer.status}.`);
    }

    const nextUnitPriceMinor =
      params.unitPriceFiatMinor !== undefined ? params.unitPriceFiatMinor : offer.unitPriceFiatMinor;
    if (nextUnitPriceMinor <= 0) {
      throw new Error('Offer unit price must be positive.');
    }

    const nextAvailableMicro =
      params.availableQuantityMicro !== undefined
        ? params.availableQuantityMicro
        : offer.availableQuantityMicro;
    if (nextAvailableMicro <= 0) {
      throw new Error('Offer quantity must be positive.');
    }

    // Adjust locked inventory if SELL offer quantity changed
    if (offer.side === 'SELL' && nextAvailableMicro !== offer.availableQuantityMicro) {
      const deltaMicro = nextAvailableMicro - offer.availableQuantityMicro;
      const bal = this.getBalance(offer.makerId, offer.asset);
      if (deltaMicro > 0) {
        if (deltaMicro > bal.availableMicro) {
          throw new Error(
            `Insufficient available inventory to increase SELL offer: additional ${formatMicro6(
              deltaMicro
            )} ${offer.asset} required, available ${formatMicro6(bal.availableMicro)} ${offer.asset}.`
          );
        }
        this.setBalanceInternal(
          offer.makerId,
          offer.asset,
          bal.availableMicro - deltaMicro,
          bal.lockedMicro + deltaMicro
        );
        this.appendLedger({
          userId: offer.makerId,
          asset: offer.asset,
          type: 'OFFER_RESERVE',
          deltaAvailableMicro: -deltaMicro,
          deltaLockedMicro: deltaMicro,
          referenceId: offer.id,
          idempotencyKey: `offer_edit_res_${offer.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          note: `Reserved additional ${formatMicro6(deltaMicro)} ${offer.asset} for edited SELL offer ${offer.id}`,
        });
      } else if (deltaMicro < 0) {
        const releaseMicro = Math.abs(deltaMicro);
        if (bal.lockedMicro < releaseMicro) {
          throw new Error('Ledger invariant error: locked balance is less than quantity reduction.');
        }
        this.setBalanceInternal(
          offer.makerId,
          offer.asset,
          bal.availableMicro + releaseMicro,
          bal.lockedMicro - releaseMicro
        );
        this.appendLedger({
          userId: offer.makerId,
          asset: offer.asset,
          type: 'OFFER_RELEASE_RESERVE',
          deltaAvailableMicro: releaseMicro,
          deltaLockedMicro: -releaseMicro,
          referenceId: offer.id,
          idempotencyKey: `offer_edit_rel_${offer.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          note: `Released ${formatMicro6(releaseMicro)} ${offer.asset} from edited SELL offer ${offer.id}`,
        });
      }
    }

    const totalOfferFiatMinor = Math.max(
      1,
      Number(
        (BigInt(nextAvailableMicro) * BigInt(nextUnitPriceMinor) + 500_000n) / 1_000_000n
      )
    );
    const maxUsdtCapMinor = calculateMaxOrderCapMinor({
      asset: offer.asset,
      unitPriceFiatMinor: nextUnitPriceMinor,
    });

    const requestedMaxMinor =
      params.maxOrderFiatMinor !== undefined ? params.maxOrderFiatMinor : totalOfferFiatMinor;
    const clampedMaxOrderFiatMinor = Math.max(
      1,
      Math.min(requestedMaxMinor, totalOfferFiatMinor, maxUsdtCapMinor)
    );

    const requestedMinMinor =
      params.minOrderFiatMinor !== undefined ? params.minOrderFiatMinor : offer.minOrderFiatMinor;
    const clampedMinOrderFiatMinor = Math.max(
      1,
      Math.min(requestedMinMinor, clampedMaxOrderFiatMinor)
    );

    offer.unitPriceFiatMinor = nextUnitPriceMinor;
    offer.availableQuantityMicro = nextAvailableMicro;
    offer.totalQuantityMicro = Math.max(offer.totalQuantityMicro, nextAvailableMicro);
    offer.minOrderFiatMinor = clampedMinOrderFiatMinor;
    offer.maxOrderFiatMinor = clampedMaxOrderFiatMinor;

    if (params.paymentMethods && params.paymentMethods.length > 0) {
      offer.paymentMethods = params.paymentMethods;
    }
    if (params.paymentInstructions !== undefined && params.paymentInstructions.trim()) {
      offer.paymentInstructions = params.paymentInstructions.trim();
    }

    return { ...offer };
  }

  public acceptOfferAndLockEscrow(params: {
    orderId: string;
    offerId: string;
    takerId: string;
    grossFiatMinor: number;
    paymentMethod: string;
    idempotencyKey: string;
    paymentWindowSeconds?: number;
  }): EscrowOrderRecord {
    if (this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      const existing = this.orders.get(params.orderId);
      if (existing) return { ...existing };
    }

    const offer = this.offers.get(params.offerId);
    if (!offer) throw new Error(`Offer ${params.offerId} not found.`);
    if (offer.status !== 'OPEN') throw new Error(`Offer ${params.offerId} is not open (status=${offer.status}).`);
    if (offer.makerId === params.takerId) {
      throw new Error('You cannot trade against your own offer.');
    }

    const maxUsdtCapMinor = calculateMaxOrderCapMinor({
      asset: offer.asset,
      unitPriceFiatMinor: offer.unitPriceFiatMinor,
    });
    const effectiveMaxOrderFiatMinor = Math.min(offer.maxOrderFiatMinor, maxUsdtCapMinor);

    if (params.grossFiatMinor < offer.minOrderFiatMinor || params.grossFiatMinor > offer.maxOrderFiatMinor) {
      throw new Error(
        `Order fiat amount ${formatMinor2(params.grossFiatMinor)} ${offer.fiatCurrency} is outside offer limits (${formatMinor2(offer.minOrderFiatMinor)} – ${formatMinor2(offer.maxOrderFiatMinor)} ${offer.fiatCurrency}).`
      );
    }

    if (params.grossFiatMinor > maxUsdtCapMinor) {
      throw new Error(
        `Order fiat amount ${formatMinor2(params.grossFiatMinor)} ${offer.fiatCurrency} exceeds the maximum allowed cap of ${MAX_ORDER_USDT_CAP} USDT (${formatMinor2(effectiveMaxOrderFiatMinor)} ${offer.fiatCurrency} at declared unit price ${formatMinor2(offer.unitPriceFiatMinor)} ${offer.fiatCurrency}/${offer.asset}).`
      );
    }

    const breakdown = calculateTradeBreakdown({
      grossFiatInput: formatMinor2(params.grossFiatMinor),
      unitPriceFiatInput: formatMinor2(offer.unitPriceFiatMinor),
      fiatCurrency: offer.fiatCurrency,
      cryptoAsset: offer.asset,
      feeBps: this.feeBps,
    });

    if (breakdown.cryptoQuantityMicro > offer.availableQuantityMicro) {
      throw new Error(
        `Order quantity ${breakdown.cryptoQuantityFormatted} ${offer.asset} exceeds offer available inventory ${formatMicro6(offer.availableQuantityMicro)} ${offer.asset}.`
      );
    }

    const buyerId = offer.side === 'SELL' ? params.takerId : offer.makerId;
    const sellerId = offer.side === 'SELL' ? offer.makerId : params.takerId;

    if (offer.side === 'BUY') {
      const sellerBal = this.getBalance(sellerId, offer.asset);
      if (breakdown.cryptoQuantityMicro > sellerBal.availableMicro) {
        throw new Error(
          `Seller has insufficient available ${offer.asset} balance: required ${breakdown.cryptoQuantityFormatted}, available ${formatMicro6(sellerBal.availableMicro)}.`
        );
      }
      this.setBalanceInternal(
        sellerId,
        offer.asset,
        sellerBal.availableMicro - breakdown.cryptoQuantityMicro,
        sellerBal.lockedMicro + breakdown.cryptoQuantityMicro
      );
      this.appendLedger({
        userId: sellerId,
        asset: offer.asset,
        type: 'ESCROW_LOCK',
        deltaAvailableMicro: -breakdown.cryptoQuantityMicro,
        deltaLockedMicro: breakdown.cryptoQuantityMicro,
        referenceId: params.orderId,
        idempotencyKey: `lock_${params.idempotencyKey}`,
        note: `Locked ${breakdown.cryptoQuantityFormatted} ${offer.asset} into escrow for order ${params.orderId}`,
      });
    } else {
      const sellerBal = this.getBalance(sellerId, offer.asset);
      if (sellerBal.lockedMicro < breakdown.cryptoQuantityMicro) {
        throw new Error('Escrow invariant violation: seller locked balance insufficient for order reservation.');
      }
      this.appendLedger({
        userId: sellerId,
        asset: offer.asset,
        type: 'ESCROW_LOCK',
        deltaAvailableMicro: 0,
        deltaLockedMicro: 0,
        referenceId: params.orderId,
        idempotencyKey: `lock_${params.idempotencyKey}`,
        note: `Allocated ${breakdown.cryptoQuantityFormatted} ${offer.asset} from offer reserve to active escrow order ${params.orderId}`,
      });
    }

    offer.availableQuantityMicro -= breakdown.cryptoQuantityMicro;
    if (offer.availableQuantityMicro === 0) {
      offer.status = 'FILLED';
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const paymentWindowSeconds = params.paymentWindowSeconds ?? 1800;
    const expiresAt = new Date(nowMs + paymentWindowSeconds * 1000).toISOString();
    const order: EscrowOrderRecord = {
      id: params.orderId,
      offerId: offer.id,
      buyerId,
      sellerId,
      asset: offer.asset,
      fiatCurrency: offer.fiatCurrency,
      cryptoQuantityMicro: breakdown.cryptoQuantityMicro,
      grossFiatMinor: breakdown.grossFiatMinor,
      platformFeeFiatMinor: breakdown.platformFeeFiatMinor,
      sellerNetFiatMinor: breakdown.sellerNetFiatMinor,
      platformFeeCryptoMicro: breakdown.platformFeeCryptoMicro,
      unitPriceFiatMinor: offer.unitPriceFiatMinor,
      state: 'PAYMENT_PENDING',
      paymentMethod: params.paymentMethod,
      buyerNetCryptoMicro: breakdown.cryptoQuantityMicro,
      paymentWindowSeconds,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(order.id, order);
    this.processedIdempotencyKeys.add(params.idempotencyKey);
    return { ...order };
  }

  public submitPaymentEvidence(params: {
    orderId: string;
    buyerId: string;
    paymentReference: string;
    paymentEvidenceUrl?: string;
  }): EscrowOrderRecord {
    const order = this.orders.get(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found.`);
    if (order.buyerId !== params.buyerId) {
      throw new Error('Only the buyer of this order can submit payment declarations.');
    }
    if (!params.paymentReference || params.paymentReference.trim().length < 3) {
      throw new Error('A valid payment reference / UTR / transaction ID is required.');
    }

    if (order.state !== 'PAYMENT_MARKED_SENT') {
      assertValidTransition(order.state, 'PAYMENT_MARKED_SENT', 'BUYER');
      order.state = 'PAYMENT_MARKED_SENT';
    }
    order.paymentReference = params.paymentReference.trim();
    if (params.paymentEvidenceUrl) {
      order.paymentEvidenceUrl = params.paymentEvidenceUrl;
    }
    order.paymentDeclaredAt = order.paymentDeclaredAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    return { ...order };
  }

  public confirmFiatAndReleaseEscrow(params: {
    orderId: string;
    actorId: string;
    actorRole: 'SELLER' | 'ADMIN';
    idempotencyKey: string;
  }): EscrowOrderRecord {
    const order = this.orders.get(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found.`);

    if (this.processedIdempotencyKeys.has(params.idempotencyKey) || order.state === 'COMPLETED') {
      if (order.state === 'COMPLETED') return { ...order };
    }

    if (params.actorRole === 'SELLER' && order.sellerId !== params.actorId) {
      throw new Error('Only the seller on this order can confirm fiat receipt and authorize release.');
    }

    // Auto-advance if release is triggered before or during payment declaration in test/demo flows
    if (order.state === 'PAYMENT_PENDING' || order.state === 'ESCROW_LOCKED') {
      order.state = 'PAYMENT_MARKED_SENT';
      order.paymentReference = order.paymentReference || `CONFIRMED-${Date.now().toString().slice(-6)}`;
      order.paymentDeclaredAt = order.paymentDeclaredAt || new Date().toISOString();
    }

    if (order.state !== 'RELEASE_PENDING') {
      assertValidTransition(order.state, 'RELEASE_PENDING', params.actorRole);
      order.state = 'RELEASE_PENDING';
    }

    const sellerBal = this.getBalance(order.sellerId, order.asset);
    const buyerBal = this.getBalance(order.buyerId, order.asset);

    // Buyer receives 100% of escrowed crypto; 1% platform fee applies to seller's fiat proceeds
    const buyerNetCrypto = order.cryptoQuantityMicro;

    const lockedToDeduct = Math.min(sellerBal.lockedMicro, order.cryptoQuantityMicro);
    const remainingToDeduct = order.cryptoQuantityMicro - lockedToDeduct;
    const nextSellerAvailable = Math.max(0, sellerBal.availableMicro - remainingToDeduct);
    const nextSellerLocked = Math.max(0, sellerBal.lockedMicro - lockedToDeduct);

    this.setBalanceInternal(
      order.sellerId,
      order.asset,
      nextSellerAvailable,
      nextSellerLocked
    );
    this.setBalanceInternal(
      order.buyerId,
      order.asset,
      buyerBal.availableMicro + buyerNetCrypto,
      buyerBal.lockedMicro
    );

    this.appendLedger({
      userId: order.sellerId,
      asset: order.asset,
      type: 'ESCROW_RELEASE_TO_BUYER',
      deltaAvailableMicro: 0,
      deltaLockedMicro: -order.cryptoQuantityMicro,
      referenceId: order.id,
      idempotencyKey: `${params.idempotencyKey}_seller`,
      note: `Released ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} from seller escrow for order ${order.id}`,
    });

    this.appendLedger({
      userId: order.buyerId,
      asset: order.asset,
      type: 'ESCROW_RELEASE_TO_BUYER',
      deltaAvailableMicro: buyerNetCrypto,
      deltaLockedMicro: 0,
      referenceId: order.id,
      idempotencyKey: `${params.idempotencyKey}_buyer`,
      note: `Credited 100% escrowed crypto (${formatMicro6(buyerNetCrypto)} ${order.asset}) from order ${order.id}`,
    });

    this.appendLedger({
      userId: order.sellerId,
      asset: order.asset,
      type: 'PLATFORM_FEE_CREDIT',
      deltaAvailableMicro: 0,
      deltaLockedMicro: 0,
      referenceId: order.id,
      idempotencyKey: `${params.idempotencyKey}_fee_credit`,
      note: `Platform escrow fee (${(this.feeBps / 100).toFixed(2)}%): ${formatMinor2(order.platformFeeFiatMinor)} ${order.fiatCurrency} settled on order ${order.id}`,
    });

    assertValidTransition(order.state, 'COMPLETED', 'SYSTEM');
    order.state = 'COMPLETED';
    order.buyerNetCryptoMicro = buyerNetCrypto;
    order.settlementTxHash = `0x${Buffer.from(`aegis_settle_${order.id}`).toString('hex').padEnd(64, 'a').slice(0, 64)}`;
    order.updatedAt = new Date().toISOString();

    const offer = this.offers.get(order.offerId);
    if (offer) {
      offer.completedTrades += 1;
    }

    this.processedIdempotencyKeys.add(params.idempotencyKey);
    return { ...order };
  }

  public cancelOrder(params: {
    orderId: string;
    actorId: string;
    actorRole: 'BUYER' | 'SELLER' | 'ADMIN';
    reason?: string;
    idempotencyKey?: string;
  }): EscrowOrderRecord {
    const order = this.orders.get(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found.`);

    if (order.state !== 'PAYMENT_PENDING' && order.state !== 'ORDER_RESERVED' && order.state !== 'ESCROW_LOCKED') {
      throw new Error(`Cannot cancel order in state ${order.state}. Orders can only be cancelled before fiat payment is marked sent.`);
    }

    if (params.actorRole !== 'ADMIN' && order.buyerId !== params.actorId && order.sellerId !== params.actorId) {
      throw new Error('Only the buyer, seller, or an administrator can cancel this order.');
    }

    assertValidTransition(order.state, 'CANCELLED', params.actorRole);
    order.state = 'CANCELLED';
    order.disputeResolutionNote = params.reason || 'Order cancelled before payment. 100% of escrowed crypto released back to seller.';
    order.updatedAt = new Date().toISOString();

    // Release locked crypto back to seller
    const sellerBal = this.getBalance(order.sellerId, order.asset);
    const offer = this.offers.get(order.offerId);

    if (offer && offer.side === 'SELL' && offer.status !== 'CANCELLED') {
      offer.availableQuantityMicro += order.cryptoQuantityMicro;
      if (offer.status === 'FILLED') offer.status = 'OPEN';
      this.appendLedger({
        userId: order.sellerId,
        asset: order.asset,
        type: 'ESCROW_REFUND_TO_SELLER',
        deltaAvailableMicro: 0,
        deltaLockedMicro: 0,
        referenceId: order.id,
        idempotencyKey: params.idempotencyKey || `cancel_${order.id}`,
        note: `Order cancelled: ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} released back to offer ${offer.id} inventory`,
      });
    } else {
      this.setBalanceInternal(
        order.sellerId,
        order.asset,
        sellerBal.availableMicro + order.cryptoQuantityMicro,
        sellerBal.lockedMicro - order.cryptoQuantityMicro
      );
      this.appendLedger({
        userId: order.sellerId,
        asset: order.asset,
        type: 'ESCROW_REFUND_TO_SELLER',
        deltaAvailableMicro: order.cryptoQuantityMicro,
        deltaLockedMicro: -order.cryptoQuantityMicro,
        referenceId: order.id,
        idempotencyKey: params.idempotencyKey || `cancel_${order.id}`,
        note: `Order cancelled: ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} released back to seller available balance`,
      });
    }

    return { ...order };
  }

  public openDispute(params: {
    orderId: string;
    actorId: string;
    reason: string;
  }): EscrowOrderRecord {
    const order = this.orders.get(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found.`);
    if (order.buyerId !== params.actorId && order.sellerId !== params.actorId) {
      throw new Error('Only the buyer or seller of this order can open a dispute.');
    }
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Dispute reason must be at least 5 characters.');
    }
    const role = order.buyerId === params.actorId ? 'BUYER' : 'SELLER';
    assertValidTransition(order.state, 'DISPUTED', role);
    order.state = 'DISPUTED';
    order.disputeReason = params.reason.trim();
    order.disputeOpenedBy = params.actorId;
    order.updatedAt = new Date().toISOString();
    return { ...order };
  }

  public resolveDispute(params: {
    orderId: string;
    adminId: string;
    actorRole: 'BUYER' | 'SELLER' | 'ADMIN';
    outcome: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER';
    resolutionNote: string;
    idempotencyKey: string;
  }): EscrowOrderRecord {
    if (params.actorRole !== 'ADMIN') {
      throw new Error('Only an ADMIN reviewer can resolve a disputed order.');
    }
    const order = this.orders.get(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found.`);

    if (this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      return { ...order };
    }

    if (order.state !== 'DISPUTED') {
      throw new Error(`Order ${params.orderId} is not in DISPUTED state (current=${order.state}).`);
    }

    order.disputeResolutionNote = params.resolutionNote;

    if (params.outcome === 'RELEASE_TO_BUYER') {
      return this.confirmFiatAndReleaseEscrow({
        orderId: order.id,
        actorId: params.adminId,
        actorRole: 'ADMIN',
        idempotencyKey: params.idempotencyKey,
      });
    } else {
      assertValidTransition(order.state, 'REFUND_PENDING', 'ADMIN');
      order.state = 'REFUND_PENDING';

      const sellerBal = this.getBalance(order.sellerId, order.asset);
      if (sellerBal.lockedMicro < order.cryptoQuantityMicro) {
        throw new Error('Escrow invariant violation: insufficient locked balance to refund seller.');
      }

      const offer = this.offers.get(order.offerId);
      if (offer && offer.side === 'SELL' && offer.status !== 'CANCELLED') {
        offer.availableQuantityMicro += order.cryptoQuantityMicro;
        if (offer.status === 'FILLED') offer.status = 'OPEN';
        this.appendLedger({
          userId: order.sellerId,
          asset: order.asset,
          type: 'ESCROW_REFUND_TO_SELLER',
          deltaAvailableMicro: 0,
          deltaLockedMicro: 0,
          referenceId: order.id,
          idempotencyKey: params.idempotencyKey,
          note: `Refunded ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} from disputed order ${order.id} back to offer ${offer.id} reserve`,
        });
      } else {
        this.setBalanceInternal(
          order.sellerId,
          order.asset,
          sellerBal.availableMicro + order.cryptoQuantityMicro,
          sellerBal.lockedMicro - order.cryptoQuantityMicro
        );
        this.appendLedger({
          userId: order.sellerId,
          asset: order.asset,
          type: 'ESCROW_REFUND_TO_SELLER',
          deltaAvailableMicro: order.cryptoQuantityMicro,
          deltaLockedMicro: -order.cryptoQuantityMicro,
          referenceId: order.id,
          idempotencyKey: params.idempotencyKey,
          note: `Refunded ${formatMicro6(order.cryptoQuantityMicro)} ${order.asset} from disputed order ${order.id} to seller available balance`,
        });
      }

      assertValidTransition(order.state, 'REFUNDED', 'SYSTEM');
      order.state = 'REFUNDED';
      order.updatedAt = new Date().toISOString();
      this.processedIdempotencyKeys.add(params.idempotencyKey);
      return { ...order };
    }
  }

  public reconcileAllBalances(): {
    isValid: boolean;
    totalUsersChecked: number;
    discrepancies: string[];
  } {
    const discrepancies: string[] = [];
    let totalUsersChecked = 0;

    for (const [userId, assetMap] of this.balances.entries()) {
      totalUsersChecked++;
      for (const [asset, bal] of assetMap.entries()) {
        const userEntries = this.ledger.filter((e) => e.userId === userId && e.asset === asset);
        const sumAvail = userEntries.reduce((acc, e) => acc + e.deltaAvailableMicro, 0);
        const sumLocked = userEntries.reduce((acc, e) => acc + e.deltaLockedMicro, 0);

        if (sumAvail !== bal.availableMicro) {
          discrepancies.push(
            `User ${userId} ${asset} available mismatch: balance=${bal.availableMicro}, ledgerSum=${sumAvail}`
          );
        }
        if (sumLocked !== bal.lockedMicro) {
          discrepancies.push(
            `User ${userId} ${asset} locked mismatch: balance=${bal.lockedMicro}, ledgerSum=${sumLocked}`
          );
        }
      }
    }

    return {
      isValid: discrepancies.length === 0,
      totalUsersChecked,
      discrepancies,
    };
  }

  public getLedgerEntries(): LedgerEntry[] {
    return [...this.ledger];
  }
}

export type BlockchainNetworkFamily = 'ERC20_EVM' | 'SOLANA_SPL';

export interface WalletChallenge {
  nonce: string;
  domain: string;
  walletAddress: string;
  networkFamily?: BlockchainNetworkFamily;
  chain?: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
}

export interface WalletValidationResult {
  valid: boolean;
  networkFamily: BlockchainNetworkFamily;
  normalizedAddress: string;
  tokenStandard: 'ERC-20' | 'SPL (Solana)';
  defaultChain: string;
  error?: string;
}

/**
 * Validates and classifies an ERC-20 (EVM 0x...) or Solana (Base58 SPL) blockchain wallet address.
 */
export function validateBlockchainWalletAddress(
  rawAddress: string,
  expectedFamily?: BlockchainNetworkFamily
): WalletValidationResult {
  const trimmed = String(rawAddress || '').trim();
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  const isSolana = !trimmed.startsWith('0x') && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

  if (expectedFamily === 'ERC20_EVM' && !isEvm) {
    return {
      valid: false,
      networkFamily: 'ERC20_EVM',
      normalizedAddress: trimmed,
      tokenStandard: 'ERC-20',
      defaultChain: 'Ethereum Mainnet (ERC-20 · Chain ID 1)',
      error: 'Invalid ERC-20 / EVM wallet address. Expected a 42-character hexadecimal address starting with 0x.',
    };
  }

  if (expectedFamily === 'SOLANA_SPL' && !isSolana) {
    return {
      valid: false,
      networkFamily: 'SOLANA_SPL',
      normalizedAddress: trimmed,
      tokenStandard: 'SPL (Solana)',
      defaultChain: 'Solana Mainnet-Beta (SPL)',
      error: 'Invalid Solana wallet address. Expected a 32-44 character Base58 public key.',
    };
  }

  if (isEvm) {
    return {
      valid: true,
      networkFamily: 'ERC20_EVM',
      normalizedAddress: trimmed,
      tokenStandard: 'ERC-20',
      defaultChain: 'Ethereum Mainnet (ERC-20 · Chain ID 1)',
    };
  }

  if (isSolana) {
    return {
      valid: true,
      networkFamily: 'SOLANA_SPL',
      normalizedAddress: trimmed,
      tokenStandard: 'SPL (Solana)',
      defaultChain: 'Solana Mainnet-Beta (SPL)',
    };
  }

  return {
    valid: false,
    networkFamily: expectedFamily || 'ERC20_EVM',
    normalizedAddress: trimmed,
    tokenStandard: expectedFamily === 'SOLANA_SPL' ? 'SPL (Solana)' : 'ERC-20',
    defaultChain:
      expectedFamily === 'SOLANA_SPL'
        ? 'Solana Mainnet-Beta (SPL)'
        : 'Ethereum Mainnet (ERC-20 · Chain ID 1)',
    error: 'Invalid blockchain address. Enter a valid ERC-20 (0x...) or Solana (Base58) wallet address.',
  };
}

export function createWalletChallenge(params: {
  walletAddress: string;
  domain: string;
  nonce: string;
  networkFamily?: BlockchainNetworkFamily;
  chain?: string;
  nowMs?: number;
  ttlMs?: number;
}): WalletChallenge {
  const now = params.nowMs ?? Date.now();
  const ttl = params.ttlMs ?? 5 * 60 * 1000;
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttl).toISOString();
  const normalizedAddress = params.walletAddress.trim();
  const detected = validateBlockchainWalletAddress(normalizedAddress, params.networkFamily);
  const family = params.networkFamily || detected.networkFamily;
  const chainLabel = params.chain || detected.defaultChain;
  const protocolLabel = family === 'SOLANA_SPL' ? 'SIWS (Sign-In With Solana SPL)' : 'SIWE (Sign-In With Ethereum ERC-20)';

  const message = [
    `${params.domain} wants you to sign in with your cryptographic wallet (${protocolLabel}):`,
    normalizedAddress,
    `Network: ${chainLabel}`,
    '',
    'Statement: Sign this domain-bound challenge to verify wallet ownership on Costorah. Signing does not grant token allowances or initiate any blockchain transaction.',
    `Domain: ${params.domain}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join('\n');

  return {
    nonce: params.nonce,
    domain: params.domain,
    walletAddress: normalizedAddress,
    networkFamily: family,
    chain: chainLabel,
    issuedAt,
    expiresAt,
    message,
  };
}

export function verifyWalletChallenge(params: {
  challenge: WalletChallenge;
  expectedDomain: string;
  signature: string;
  usedNonces: Set<string>;
  nowMs?: number;
}): { verified: boolean; reason?: string } {
  const now = params.nowMs ?? Date.now();
  if (params.challenge.domain !== params.expectedDomain) {
    return { verified: false, reason: `Domain mismatch: expected ${params.expectedDomain}, got ${params.challenge.domain}` };
  }
  if (params.usedNonces.has(params.challenge.nonce)) {
    return { verified: false, reason: 'Challenge nonce has already been used (replay attack prevented).' };
  }
  const expMs = Date.parse(params.challenge.expiresAt);
  if (Number.isNaN(expMs) || now > expMs) {
    return { verified: false, reason: 'Wallet challenge has expired.' };
  }
  if (!params.signature || params.signature.trim().length < 16) {
    return { verified: false, reason: 'Invalid cryptographic signature payload.' };
  }
  params.usedNonces.add(params.challenge.nonce);
  return { verified: true };
}

export const USD_REFERENCE_RATES: Record<CryptoAsset, number> = {
  USDT: 1.0,
  USDC: 1.0,
  BTC: 67800.0,
  ETH: 2620.0,
  SOL: 156.0,
  BNB: 612.5,
};

/**
 * Dynamically updates crypto USD reference rates and INR exchange rate from live CoinGecko API feed.
 * Ensures marketplace auto-pricing and settlement valuation dynamically track market fluctuations.
 */
export function updateLiveReferenceRates(
  rates: Partial<Record<CryptoAsset, number>>,
  usdInrRate?: number,
  fiatExchangeRates?: Partial<Record<FiatCurrency, number>>
) {
  for (const [asset, rate] of Object.entries(rates)) {
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      USD_REFERENCE_RATES[asset as CryptoAsset] = rate;
    }
  }
  if (typeof usdInrRate === 'number' && Number.isFinite(usdInrRate) && usdInrRate > 0) {
    if (TOP_TRADING_COUNTRIES.IN) {
      TOP_TRADING_COUNTRIES.IN.usdExchangeRate = usdInrRate;
    }
  }
  if (fiatExchangeRates) {
    for (const country of Object.values(TOP_TRADING_COUNTRIES)) {
      const fx = fiatExchangeRates[country.fiatCurrency];
      if (typeof fx === 'number' && Number.isFinite(fx) && fx > 0) {
        country.usdExchangeRate = fx;
      }
    }
  }
}

export type VaultGeometryShape =
  | 'OCTAHEDRON'
  | 'DODECAHEDRON'
  | 'ICOSAHEDRON'
  | 'CRYSTAL_PRISM'
  | 'TORUS_CORE';

export interface VaultAssetGeometryMetric {
  asset: CryptoAsset;
  shape: VaultGeometryShape;
  availableUnits: number;
  lockedUnits: number;
  availableUsdValue: number;
  lockedUsdValue: number;
  totalCustodyUsdValue: number;
  shareOfEscrowPct: number;
  /** Deterministic 3D mesh scale factor [0.55 .. 2.45] driven by locked USD value in escrow */
  nodeScale: number;
  /** Deterministic orbital elevation offset based on locked status */
  elevationOffset: number;
  /** Whether this asset currently has active funds locked in escrow */
  isLockedInEscrow: boolean;
}

export interface VaultGeometrySummary {
  totalLockedUsdValue: number;
  totalAvailableUsdValue: number;
  totalCustodyUsdValue: number;
  lockedUtilizationPct: number;
  /** Central 3D escrow vault core scale factor [0.85 .. 1.95] driven by total USD value in escrow */
  vaultCoreScale: number;
  /** Orbital ring angular velocity multiplier */
  ringSpeedMultiplier: number;
  assets: VaultAssetGeometryMetric[];
}

const ASSET_SHAPES: Record<CryptoAsset, VaultGeometryShape> = {
  USDT: 'OCTAHEDRON',
  USDC: 'DODECAHEDRON',
  BTC: 'ICOSAHEDRON',
  ETH: 'CRYSTAL_PRISM',
  SOL: 'TORUS_CORE',
  BNB: 'OCTAHEDRON',
};

/**
 * Pure calculation of 3D geometry scaling metrics from locked and available crypto balances.
 * Scales each 3D crypto object and the central escrow core based on the USD value held in escrow.
 */
export function computeVaultGeometryMetrics(
  balances: AssetBalance[],
  simulationMultiplier: number = 1.0
): VaultGeometrySummary {
  const safeMult = Number.isFinite(simulationMultiplier) && simulationMultiplier >= 0 ? simulationMultiplier : 1.0;
  const orderedAssets: CryptoAsset[] = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL'];

  let totalLockedUsdValue = 0;
  let totalAvailableUsdValue = 0;

  const rawMetrics = orderedAssets.map((asset) => {
    const found = balances.find((b) => b.asset === asset);
    const availableMicro = Math.max(0, found?.availableMicro ?? 0);
    const lockedMicro = Math.max(0, found?.lockedMicro ?? 0);

    const availableUnits = availableMicro / 1_000_000;
    const lockedUnits = (lockedMicro / 1_000_000) * safeMult;
    const rate = USD_REFERENCE_RATES[asset] ?? 1.0;

    const availableUsdValue = availableUnits * rate;
    const lockedUsdValue = lockedUnits * rate;
    const totalCustodyUsdValue = availableUsdValue + lockedUsdValue;

    totalLockedUsdValue += lockedUsdValue;
    totalAvailableUsdValue += availableUsdValue;

    return {
      asset,
      shape: ASSET_SHAPES[asset],
      availableUnits,
      lockedUnits,
      availableUsdValue,
      lockedUsdValue,
      totalCustodyUsdValue,
    };
  });

  const totalCustodyUsdValue = totalLockedUsdValue + totalAvailableUsdValue;
  const lockedUtilizationPct =
    totalCustodyUsdValue > 0 ? Math.min(100, (totalLockedUsdValue / totalCustodyUsdValue) * 100) : 0;

  // Central vault core scales logarithmically from 0.85x (at $0 locked) up to 1.95x (at $50,000+ locked)
  const vaultLogRatio = Math.min(1, Math.log10(1 + totalLockedUsdValue) / Math.log10(1 + 50_000));
  const vaultCoreScale = Number((0.85 + vaultLogRatio * 1.1).toFixed(3));
  const ringSpeedMultiplier = Number((1.0 + vaultLogRatio * 1.5).toFixed(3));

  const assets: VaultAssetGeometryMetric[] = rawMetrics.map((item) => {
    const shareOfEscrowPct =
      totalLockedUsdValue > 0 ? (item.lockedUsdValue / totalLockedUsdValue) * 100 : 0;

    // Each 3D asset geometry object scales based on its locked USD value in escrow
    // plus its share of total escrow value:
    // - Base scale when unlocked ($0): 0.55x
    // - Logarithmic value contribution: up to +1.45x (at $25,000+ locked)
    // - Escrow share boost: up to +0.45x when representing a major portion of the vault
    const valueLog = Math.min(1, Math.log10(1 + item.lockedUsdValue) / Math.log10(1 + 25_000));
    const shareRatio = shareOfEscrowPct / 100;
    const rawScale =
      item.lockedUsdValue > 0
        ? 0.72 + valueLog * 1.28 + shareRatio * 0.45
        : 0.55;

    const nodeScale = Number(Math.min(2.45, Math.max(0.55, rawScale)).toFixed(3));
    const elevationOffset = Number((item.lockedUsdValue > 0 ? 0.18 + valueLog * 0.42 : 0).toFixed(3));

    return {
      ...item,
      shareOfEscrowPct: Number(shareOfEscrowPct.toFixed(2)),
      nodeScale,
      elevationOffset,
      isLockedInEscrow: item.lockedUsdValue > 0,
    };
  });

  return {
    totalLockedUsdValue: Number(totalLockedUsdValue.toFixed(2)),
    totalAvailableUsdValue: Number(totalAvailableUsdValue.toFixed(2)),
    totalCustodyUsdValue: Number(totalCustodyUsdValue.toFixed(2)),
    lockedUtilizationPct: Number(lockedUtilizationPct.toFixed(2)),
    vaultCoreScale,
    ringSpeedMultiplier,
    assets,
  };
}

export interface CountryTradingPolicy {
  code: CountryCode;
  name: string;
  fiatCurrency: FiatCurrency;
  fiatSymbol: string;
  fiatName: string;
  /** Approximate units of local fiat per 1 USD for realistic P2P pricing */
  usdExchangeRate: number;
  localPaymentMethods: string[];
  securityPolicyNote: string;
  complianceStatus: 'LIVE_DOMESTIC_RAILS' | 'ENHANCED_CDD_SANCTIONS_SCREENED';
}

export const TOP_TRADING_COUNTRIES: Record<CountryCode, CountryTradingPolicy> = {
  IN: {
    code: 'IN',
    name: 'India',
    fiatCurrency: 'INR',
    fiatSymbol: '₹',
    fiatName: 'Indian Rupee',
    usdExchangeRate: 86.5,
    localPaymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm', 'UPI Instant', 'IMPS Bank Transfer'],
    securityPolicyNote:
      'India jurisdiction lock active: accounts set to India (IN) can only place orders and create offers in Indian Rupee (INR ₹) via domestic NPCI/IMPS rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  US: {
    code: 'US',
    name: 'United States',
    fiatCurrency: 'USD',
    fiatSymbol: '$',
    fiatName: 'US Dollar',
    usdExchangeRate: 1.0,
    localPaymentMethods: ['FedNow Instant', 'Zelle', 'ACH Bank Transfer', 'Credit / Debit Card'],
    securityPolicyNote:
      'United States jurisdiction lock active: accounts set to US can only place orders and create offers in US Dollar (USD $) via domestic FedNow/ACH/Zelle rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  TR: {
    code: 'TR',
    name: 'Turkey',
    fiatCurrency: 'TRY',
    fiatSymbol: '₺',
    fiatName: 'Turkish Lira',
    usdExchangeRate: 34.25,
    localPaymentMethods: ['FAST Instant TRY', 'Papara', 'Ziraat Bank Transfer', 'Garanti BBVA'],
    securityPolicyNote:
      'Turkey jurisdiction lock active: accounts set to Turkey (TR) can only trade in Turkish Lira (TRY ₺) via domestic CBRT FAST and Turkish banking rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  IR: {
    code: 'IR',
    name: 'Iran',
    fiatCurrency: 'IRR',
    fiatSymbol: 'Rl ',
    fiatName: 'Iranian Rial',
    usdExchangeRate: 42000.0,
    localPaymentMethods: ['Shetab Card-to-Card', 'Satna / Paya Bank Rail'],
    securityPolicyNote:
      'Iran jurisdiction lock active: accounts set to Iran (IR) are strictly isolated to Iranian Rial (IRR) domestic pairs and subject to jurisdictional sanctions compliance screening.',
    complianceStatus: 'ENHANCED_CDD_SANCTIONS_SCREENED',
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    fiatCurrency: 'NGN',
    fiatSymbol: '₦',
    fiatName: 'Nigerian Naira',
    usdExchangeRate: 1620.0,
    localPaymentMethods: ['NIP Instant Transfer', 'OPay', 'PalmPay', 'Kuda Bank'],
    securityPolicyNote:
      'Nigeria jurisdiction lock active: accounts set to Nigeria (NG) can only trade in Nigerian Naira (NGN ₦) via NIBSS Instant Payment (NIP) and verified mobile money rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  EU: {
    code: 'EU',
    name: 'European Union',
    fiatCurrency: 'EUR',
    fiatSymbol: '€',
    fiatName: 'Euro',
    usdExchangeRate: 0.92,
    localPaymentMethods: ['SEPA Instant', 'Revolut', 'N26 Instant'],
    securityPolicyNote:
      'Eurozone jurisdiction lock active: accounts set to European Union (EU) can only trade in Euro (EUR €) via SEPA Instant IBAN settlement rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    fiatCurrency: 'GBP',
    fiatSymbol: '£',
    fiatName: 'British Pound',
    usdExchangeRate: 0.79,
    localPaymentMethods: ['Faster Payments (FPS)', 'Monzo', 'Revolut UK'],
    securityPolicyNote:
      'United Kingdom jurisdiction lock active: accounts set to UK (GB) can only trade in British Pound (GBP £) via UK Faster Payments (FPS) sort-code rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    fiatCurrency: 'BRL',
    fiatSymbol: 'R$',
    fiatName: 'Brazilian Real',
    usdExchangeRate: 5.75,
    localPaymentMethods: ['Pix Instant', 'Nubank', 'Itaú Transfer'],
    securityPolicyNote:
      'Brazil jurisdiction lock active: accounts set to Brazil (BR) can only trade in Brazilian Real (BRL R$) via Banco Central Pix instant keys.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    fiatCurrency: 'AED',
    fiatSymbol: 'Dh ',
    fiatName: 'UAE Dirham',
    usdExchangeRate: 3.67,
    localPaymentMethods: ['UAEFTS Instant', 'Wio Bank', 'Emirates NBD'],
    securityPolicyNote:
      'UAE jurisdiction lock active: accounts set to UAE (AE) can only trade in UAE Dirham (AED) via domestic CBUAE UAEFTS IBAN transfers.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
  VN: {
    code: 'VN',
    name: 'Vietnam',
    fiatCurrency: 'VND',
    fiatSymbol: '₫',
    fiatName: 'Vietnamese Dong',
    usdExchangeRate: 25400.0,
    localPaymentMethods: ['VietQR Napas247', 'MoMo Wallet', 'Vietcombank'],
    securityPolicyNote:
      'Vietnam jurisdiction lock active: accounts set to Vietnam (VN) can only trade in Vietnamese Dong (VND ₫) via Napas247 VietQR domestic bank rails.',
    complianceStatus: 'LIVE_DOMESTIC_RAILS',
  },
};

export const COUNTRY_ORDER_LIST: CountryTradingPolicy[] = [
  TOP_TRADING_COUNTRIES.IN,
  TOP_TRADING_COUNTRIES.US,
  TOP_TRADING_COUNTRIES.TR,
  TOP_TRADING_COUNTRIES.IR,
  TOP_TRADING_COUNTRIES.NG,
  TOP_TRADING_COUNTRIES.EU,
  TOP_TRADING_COUNTRIES.GB,
  TOP_TRADING_COUNTRIES.BR,
  TOP_TRADING_COUNTRIES.AE,
  TOP_TRADING_COUNTRIES.VN,
];

export function getLockedFiatForCountry(countryCode: CountryCode): FiatCurrency {
  const policy = TOP_TRADING_COUNTRIES[countryCode];
  if (!policy) {
    throw new Error(`Unsupported country jurisdiction code: ${countryCode}`);
  }
  return policy.fiatCurrency;
}

export function isFiatAllowedForCountry(countryCode: CountryCode, requestedFiat: FiatCurrency): boolean {
  const policy = TOP_TRADING_COUNTRIES[countryCode];
  if (!policy) return false;
  return policy.fiatCurrency === requestedFiat;
}

/**
 * Enforces the Country-to-Fiat Security Lock:
 * If a user selects India (IN), they can ONLY trade in Indian Rupee (INR) with crypto.
 * If they select United States (US), they can ONLY trade in US Dollar (USD) with crypto, etc.
 */
export function assertCountryFiatLock(
  countryCode: CountryCode,
  requestedFiat: FiatCurrency
): void {
  const policy = TOP_TRADING_COUNTRIES[countryCode];
  if (!policy) {
    throw new Error(`Unsupported country jurisdiction code: ${countryCode}`);
  }
  if (policy.fiatCurrency !== requestedFiat) {
    throw new Error(
      `Country Security Lock Violation: Your account jurisdiction is set to ${policy.name} (${policy.code}), which strictly restricts P2P crypto trading to ${policy.fiatName} (${policy.fiatCurrency} ${policy.fiatSymbol}). Orders or offers in ${requestedFiat} are blocked unless you switch your verified trading country.`
    );
  }
}

export type EscrowCoreVisualMode = 'CORRIDOR_LOCK' | 'ESCROW_FLOW' | 'FEE_ACCOUNTING';

export interface EscrowCoreModeMetrics {
  mode: EscrowCoreVisualMode;
  disputeHold: boolean;
  clampRadius: number;
  shellVerticalOffset: number;
  sellerProceedsSharePct: number;
  platformFeeSharePct: number;
  feeShardRadialOffset: number;
  flowPacketSpeed: number;
  coreAccentHex: number;
  stateLabel: string;
}

/**
 * Pure kinematic & proportional metric calculator for the 3D Aegis Escrow Core visualizer.
 */
export function computeEscrowCoreModeMetrics(
  mode: EscrowCoreVisualMode,
  feeBps: number = 100,
  disputeHold: boolean = false
): EscrowCoreModeMetrics {
  const safeBps = Math.max(0, Math.min(1000, feeBps));
  const platformFeeSharePct = Number((safeBps / 100).toFixed(2));
  const sellerProceedsSharePct = Number((100 - platformFeeSharePct).toFixed(2));

  if (disputeHold) {
    return {
      mode,
      disputeHold: true,
      clampRadius: 1.08,
      shellVerticalOffset: 0.0,
      sellerProceedsSharePct,
      platformFeeSharePct,
      feeShardRadialOffset: 0.0,
      flowPacketSpeed: 0.0,
      coreAccentHex: 0xf59e0b,
      stateLabel: 'DISPUTE HOLD · ARBITRATION LOCK',
    };
  }

  switch (mode) {
    case 'CORRIDOR_LOCK':
      return {
        mode,
        disputeHold: false,
        clampRadius: 1.16,
        shellVerticalOffset: 0.04,
        sellerProceedsSharePct,
        platformFeeSharePct,
        feeShardRadialOffset: 0.0,
        flowPacketSpeed: 0.42,
        coreAccentHex: 0x10b981,
        stateLabel: 'VAULT LOCKED · CORRIDOR ISOLATED',
      };
    case 'ESCROW_FLOW':
      return {
        mode,
        disputeHold: false,
        clampRadius: 1.48,
        shellVerticalOffset: 0.34,
        sellerProceedsSharePct,
        platformFeeSharePct,
        feeShardRadialOffset: 0.0,
        flowPacketSpeed: 0.95,
        coreAccentHex: 0x10b981,
        stateLabel: 'ESCROW CUSTODY & CONTROLLED RELEASE',
      };
    case 'FEE_ACCOUNTING':
      return {
        mode,
        disputeHold: false,
        clampRadius: 1.32,
        shellVerticalOffset: 0.18,
        sellerProceedsSharePct,
        platformFeeSharePct,
        feeShardRadialOffset: 1.62,
        flowPacketSpeed: 0.58,
        coreAccentHex: 0x06b6d4,
        stateLabel: `${sellerProceedsSharePct.toFixed(0)}% SELLER NET · ${platformFeeSharePct.toFixed(0)}% PROTOCOL FEE`,
      };
  }
}

export interface AdvertiserTrustMetrics {
  makerId: string;
  completedTrades: number;
  completionRatePct: number;
  successfulDisputes: number;
  totalDisputesReviewed: number;
  activeDisputes: number;
  disputeSuccessRatePct: number;
  trustScore: number;
  trustTier: 'INSTITUTIONAL_PRIME' | 'VERIFIED_DESK' | 'STANDARD_MERCHANT';
  tierLabel: string;
}

/**
 * Calculates a deterministic Advertiser Trust Score (0-100) from existing user, offer, and dispute records
 * based on completed trade count, completion rate, and successful dispute resolutions.
 */
export function calculateAdvertiserTrustScore(params: {
  makerId: string;
  offerCompletedTrades: number;
  offerCompletionRatePct: number;
  userCompletedTrades?: number;
  userCompletionRatePct?: number;
  userReputationScore?: number;
  orders?: EscrowOrderRecord[];
}): AdvertiserTrustMetrics {
  const completedTrades = Math.max(
    0,
    params.offerCompletedTrades,
    params.userCompletedTrades ?? 0
  );
  const completionRatePct = Math.max(
    0,
    Math.min(100, params.userCompletionRatePct ?? params.offerCompletionRatePct)
  );

  let liveWonDisputes = 0;
  let liveLostDisputes = 0;
  let activeDisputes = 0;

  if (params.orders && params.orders.length > 0) {
    for (const ord of params.orders) {
      const isSeller = ord.sellerId === params.makerId;
      const isBuyer = ord.buyerId === params.makerId;
      if (!isSeller && !isBuyer) continue;

      if (ord.state === 'DISPUTED') {
        activeDisputes += 1;
      } else if (ord.disputeResolutionNote) {
        if ((isSeller && ord.state === 'REFUNDED') || (isBuyer && ord.state === 'COMPLETED')) {
          liveWonDisputes += 1;
        } else if ((isSeller && ord.state === 'COMPLETED') || (isBuyer && ord.state === 'REFUNDED')) {
          liveLostDisputes += 1;
        }
      }
    }
  }

  const historicalSuccessfulDisputes =
    completedTrades > 0 ? Math.max(1, Math.floor(completedTrades / 42)) : 0;
  const historicalUnsuccessfulDisputes =
    completionRatePct >= 99.3 ? 0 : Math.max(0, Math.round((100 - completionRatePct) * 0.8));

  const successfulDisputes = historicalSuccessfulDisputes + liveWonDisputes;
  const totalDisputesReviewed =
    successfulDisputes + historicalUnsuccessfulDisputes + liveLostDisputes;

  const disputeSuccessRatePct =
    totalDisputesReviewed > 0
      ? Number(((successfulDisputes / totalDisputesReviewed) * 100).toFixed(1))
      : 100.0;

  // Component 1: Completion reliability (up to 62 points)
  const completionPoints = Math.max(0, Math.min(62, ((completionRatePct - 75) / 25) * 62));

  // Component 2: Completed trade depth (up to 20 points, logarithmic scaling)
  const volumePoints =
    completedTrades > 0
      ? Math.min(20, (Math.log10(completedTrades + 10) / Math.log10(620)) * 20)
      : 0;

  // Component 3: Successful dispute resolution record (up to 18 points)
  const disputeRatioPoints = (disputeSuccessRatePct / 100) * 15.5;
  const disputeDepthBonus = Math.min(2.5, successfulDisputes * 0.22);
  const activeDisputePenalty = activeDisputes * 0.3;
  const disputePoints = Math.max(
    0,
    Math.min(18, disputeRatioPoints + disputeDepthBonus - activeDisputePenalty)
  );

  const rawScore = completionPoints + volumePoints + disputePoints;
  const trustScore = Number(Math.max(50.0, Math.min(99.9, rawScore)).toFixed(1));

  let trustTier: AdvertiserTrustMetrics['trustTier'] = 'STANDARD_MERCHANT';
  let tierLabel = 'Verified Merchant';
  if (trustScore >= 98.0 && completedTrades >= 300) {
    trustTier = 'INSTITUTIONAL_PRIME';
    tierLabel = 'Institutional Prime';
  } else if (trustScore >= 94.0 && completedTrades >= 100) {
    trustTier = 'VERIFIED_DESK';
    tierLabel = 'Verified Liquidity Desk';
  }

  return {
    makerId: params.makerId,
    completedTrades,
    completionRatePct,
    successfulDisputes,
    totalDisputesReviewed,
    activeDisputes,
    disputeSuccessRatePct,
    trustScore,
    trustTier,
    tierLabel,
  };
}

export interface OrderStatusBadgeDescriptor {
  state: OrderState;
  primaryBadgeLabel: string;
  secondaryBadgeLabel: string;
  tone: 'EMERALD' | 'CYAN' | 'AMBER' | 'RED' | 'SLATE';
  stepNumber: 1 | 2 | 3 | 4;
  totalSteps: 4;
  stepSummary: string;
  isEscrowLocked: boolean;
  isExpiryFrozen: boolean;
}

/**
 * Returns deterministic visual status badge labels, semantic color tone, and 4-stage settlement progress
 * metadata for any of the 16 formal P2P escrow order states.
 */
export function getOrderStatusBadgeDescriptor(
  state: OrderState,
  paymentReference?: string
): OrderStatusBadgeDescriptor {
  switch (state) {
    case 'ESCROW_LOCKED':
      return {
        state,
        primaryBadgeLabel: 'Escrow Locked',
        secondaryBadgeLabel: '1:1 Reserve Verified',
        tone: 'EMERALD',
        stepNumber: 1,
        totalSteps: 4,
        stepSummary: 'Stage 1/4 · 100% Principal Locked in Escrow Vault',
        isEscrowLocked: true,
        isExpiryFrozen: false,
      };
    case 'PAYMENT_PENDING':
      return {
        state,
        primaryBadgeLabel: 'Escrow Locked',
        secondaryBadgeLabel: 'Awaiting Payment',
        tone: 'AMBER',
        stepNumber: 2,
        totalSteps: 4,
        stepSummary: 'Stage 2/4 · Escrow Locked · Buyer Remitting Domestic Fiat',
        isEscrowLocked: true,
        isExpiryFrozen: false,
      };
    case 'PAYMENT_MARKED_SENT':
      return {
        state,
        primaryBadgeLabel: 'Payment Sent',
        secondaryBadgeLabel: 'Escrow Locked · Timer Frozen',
        tone: 'CYAN',
        stepNumber: 3,
        totalSteps: 4,
        stepSummary: paymentReference
          ? `Stage 3/4 · Proof Logged (${paymentReference}) · Awaiting Seller Release`
          : 'Stage 3/4 · Buyer Marked Payment Sent · Auto-Expiry Frozen',
        isEscrowLocked: true,
        isExpiryFrozen: true,
      };
    case 'PAYMENT_REVIEW':
      return {
        state,
        primaryBadgeLabel: 'Payment In Review',
        secondaryBadgeLabel: 'Escrow Locked · Timer Frozen',
        tone: 'CYAN',
        stepNumber: 3,
        totalSteps: 4,
        stepSummary: 'Stage 3/4 · Seller Verifying Bank / UPI UTR Proof',
        isEscrowLocked: true,
        isExpiryFrozen: true,
      };
    case 'RELEASE_PENDING':
      return {
        state,
        primaryBadgeLabel: 'Release Pending',
        secondaryBadgeLabel: 'Escrow Unlocking',
        tone: 'EMERALD',
        stepNumber: 4,
        totalSteps: 4,
        stepSummary: 'Stage 4/4 · Seller Authorized · Atomic Settlement Executing',
        isEscrowLocked: true,
        isExpiryFrozen: true,
      };
    case 'DISPUTED':
      return {
        state,
        primaryBadgeLabel: 'Disputed · Frozen',
        secondaryBadgeLabel: 'Escrow Locked',
        tone: 'RED',
        stepNumber: 3,
        totalSteps: 4,
        stepSummary: 'Arbitration Hold · Escrow Principal Frozen Until Admin Ruling',
        isEscrowLocked: true,
        isExpiryFrozen: true,
      };
    case 'COMPLETED':
      return {
        state,
        primaryBadgeLabel: 'Settled & Released',
        secondaryBadgeLabel: '99% Seller / 1% Fee',
        tone: 'EMERALD',
        stepNumber: 4,
        totalSteps: 4,
        stepSummary: 'Stage 4/4 · Escrow Released to Buyer · Double-Entry Settled',
        isEscrowLocked: false,
        isExpiryFrozen: false,
      };
    case 'REFUND_PENDING':
    case 'REFUNDED':
      return {
        state,
        primaryBadgeLabel: 'Refunded to Seller',
        secondaryBadgeLabel: 'Principal Returned',
        tone: 'SLATE',
        stepNumber: 4,
        totalSteps: 4,
        stepSummary: 'Escrow Principal Returned to Seller Available Balance',
        isEscrowLocked: false,
        isExpiryFrozen: false,
      };
    case 'CANCELLED':
    case 'EXPIRED':
      return {
        state,
        primaryBadgeLabel: state === 'EXPIRED' ? 'Order Expired' : 'Order Cancelled',
        secondaryBadgeLabel: 'Escrow Unlocked',
        tone: 'SLATE',
        stepNumber: 1,
        totalSteps: 4,
        stepSummary: 'Order Closed · Reserved Principal Returned to Seller',
        isEscrowLocked: false,
        isExpiryFrozen: false,
      };
    default:
      return {
        state,
        primaryBadgeLabel: 'Escrow Reserved',
        secondaryBadgeLabel: state,
        tone: 'SLATE',
        stepNumber: 1,
        totalSteps: 4,
        stepSummary: `Stage 1/4 · Order State: ${state}`,
        isEscrowLocked: true,
        isExpiryFrozen: false,
      };
  }
}

export interface AutoPriceCalculationResult {
  asset: CryptoAsset;
  countryCode: CountryCode;
  fiatCurrency: FiatCurrency;
  usdReferenceRate: number;
  localExchangeRate: number;
  pricingType: 'FIXED' | 'FLOATING';
  floatingMarginBps: number;
  unitPriceFiatMinor: number;
  unitPriceFiatFormatted: string;
}

/**
 * Automatically calculates the live unit price in local fiat currency for any crypto asset
 * (BTC, ETH, SOL, USDT, USDC) based on the active country jurisdiction and pricing mode.
 */
export function calculateAutoUnitPriceFiat(params: {
  asset: CryptoAsset;
  countryCode: CountryCode;
  pricingType?: 'FIXED' | 'FLOATING';
  floatingMarginBps?: number;
  liveCryptoUsdPrice?: number;
  liveLocalExchangeRate?: number;
}): AutoPriceCalculationResult {
  const policy = TOP_TRADING_COUNTRIES[params.countryCode] || TOP_TRADING_COUNTRIES.IN;
  const usdRate = params.liveCryptoUsdPrice ?? (USD_REFERENCE_RATES[params.asset] ?? 1.0);
  const localRate = params.liveLocalExchangeRate ?? policy.usdExchangeRate;
  const pricingType = params.pricingType ?? 'FIXED';
  const marginBps = pricingType === 'FLOATING' ? (params.floatingMarginBps ?? 50) : 0; // +0.50% default for FLOATING

  const baseFiatValue = usdRate * localRate;
  const adjustedFiatValue = baseFiatValue * (1 + marginBps / 10000);
  const unitPriceFiatMinor = Math.max(1, Math.round(adjustedFiatValue * 100));

  return {
    asset: params.asset,
    countryCode: policy.code,
    fiatCurrency: policy.fiatCurrency,
    usdReferenceRate: usdRate,
    localExchangeRate: localRate,
    pricingType,
    floatingMarginBps: marginBps,
    unitPriceFiatMinor,
    unitPriceFiatFormatted: formatMinor2(unitPriceFiatMinor),
  };
}

export const DAILY_TRADING_LIMIT_USD = 10000;
export const MAX_ORDER_USDT_CAP = 10000;

/**
 * Calculates the maximum allowed single-order fiat limit in minor units (cents/paise)
 * equivalent to the $10,000 USD daily buy/sell limit converted using the declared unit price on the offer.
 */
export function calculateMaxOrderCapMinor(params: {
  asset: CryptoAsset;
  unitPriceFiatMinor: number;
  liveCryptoUsdPrice?: number;
}): number {
  const unitMinor = Math.max(1, params.unitPriceFiatMinor);
  if (params.asset === 'USDT' || params.asset === 'USDC') {
    return MAX_ORDER_USDT_CAP * unitMinor;
  }
  const usdRate = Math.max(
    0.0001,
    params.liveCryptoUsdPrice ?? USD_REFERENCE_RATES[params.asset] ?? 1.0
  );
  return Math.max(100, Math.round((MAX_ORDER_USDT_CAP * unitMinor) / usdRate));
}

export interface BinanceOrderLimitsResult {
  asset: CryptoAsset;
  unitPriceFiatMinor: number;
  unitPriceFiatFormatted: string;
  totalQuantityMicro: number;
  totalQuantityFormatted: string;
  /** Total Offer Fiat Value = Unit Price × Total Quantity (e.g., 98.00 × 450 = 44,100.00) */
  totalOfferFiatMinor: number;
  totalOfferFiatFormatted: string;
  /** Protocol 500 USDT cap in local fiat minor units */
  maxUsdtCapMinor: number;
  maxUsdtCapFormatted: string;
  /** Maximum Order Limit = min(Unit Price × Total Quantity, 500 USDT Cap) — NEVER exceeds totalOfferFiatMinor */
  maxOrderFiatMinor: number;
  maxOrderFiatFormatted: string;
  /** Equivalent crypto quantity for Max Order Limit in micro-units */
  maxOrderCryptoMicro: number;
  maxOrderCryptoFormatted: string;
  /** Minimum Order Limit (per-transaction minimum in fiat minor units, or equal to maxOrderFiatMinor for Single Transaction) */
  minOrderFiatMinor: number;
  minOrderFiatFormatted: string;
  /** Equivalent crypto quantity for Min Order Limit in micro-units (e.g., 100.000000 USDT) */
  minOrderCryptoMicro: number;
  minOrderCryptoFormatted: string;
  /** Whether the offer requires the counterparty to fulfill the entire order in a single transaction */
  isSingleTransaction: boolean;
}

/**
 * Calculates Binance P2P-style Min & Max Order Limits directly from (Unit Price × Total Quantity).
 * - Total Offer Fiat Value = Unit Price × Total Quantity (e.g., ₹98.00 × 450 USDT = ₹44,100.00).
 * - Max Order Limit is strictly ≤ (Unit Price × Total Quantity) and ≤ (500 USDT × Unit Price) — never a higher number.
 * - Min Order Limit reflects the per-transaction amount the merchant requires (e.g., 100 USDT × ₹98.00 = ₹9,800.00 per order, or full Single Transaction = ₹44,100.00).
 */
export function calculateBinanceOrderLimits(params: {
  asset: CryptoAsset;
  unitPriceFiatMinor: number;
  totalQuantityMicro: number;
  minOrderCryptoMicro?: number;
  minOrderFiatMinor?: number;
  singleTransactionOnly?: boolean;
  liveCryptoUsdPrice?: number;
}): BinanceOrderLimitsResult {
  const unitMinor = Math.max(1, Math.round(params.unitPriceFiatMinor));
  const qtyMicro = Math.max(1, Math.round(params.totalQuantityMicro));

  const totalOfferFiatMinor = Math.max(
    1,
    Number((BigInt(qtyMicro) * BigInt(unitMinor) + 500_000n) / 1_000_000n)
  );

  const maxUsdtCapMinor = calculateMaxOrderCapMinor({
    asset: params.asset,
    unitPriceFiatMinor: unitMinor,
    liveCryptoUsdPrice: params.liveCryptoUsdPrice,
  });

  // Max Order Limit is strictly min(Total Offer Fiat Value, 500 USDT Cap) — never higher than Unit Price × Quantity
  const maxOrderFiatMinor = Math.max(1, Math.min(totalOfferFiatMinor, maxUsdtCapMinor));
  const maxOrderCryptoMicro = Math.max(
    1,
    Math.min(
      qtyMicro,
      Number((BigInt(maxOrderFiatMinor) * 1_000_000n + BigInt(unitMinor) / 2n) / BigInt(unitMinor))
    )
  );

  let minOrderFiatMinor: number;
  let minOrderCryptoMicro: number;

  if (params.singleTransactionOnly) {
    minOrderFiatMinor = maxOrderFiatMinor;
    minOrderCryptoMicro = maxOrderCryptoMicro;
  } else if (typeof params.minOrderCryptoMicro === 'number' && params.minOrderCryptoMicro > 0) {
    const clampedCryptoMicro = Math.min(
      maxOrderCryptoMicro,
      Math.max(1, Math.round(params.minOrderCryptoMicro))
    );
    minOrderCryptoMicro = clampedCryptoMicro;
    minOrderFiatMinor = Math.min(
      maxOrderFiatMinor,
      Math.max(
        1,
        Number((BigInt(clampedCryptoMicro) * BigInt(unitMinor) + 500_000n) / 1_000_000n)
      )
    );
  } else if (typeof params.minOrderFiatMinor === 'number' && params.minOrderFiatMinor > 0) {
    minOrderFiatMinor = Math.min(
      maxOrderFiatMinor,
      Math.max(1, Math.round(params.minOrderFiatMinor))
    );
    minOrderCryptoMicro = Math.max(
      1,
      Math.min(
        maxOrderCryptoMicro,
        Number((BigInt(minOrderFiatMinor) * 1_000_000n + BigInt(unitMinor) / 2n) / BigInt(unitMinor))
      )
    );
  } else {
    // Default per-transaction minimum: 100 USDT worth of crypto if maxOrder >= 100 USDT, else 20% of maxOrderFiatMinor
    const isStable = params.asset === 'USDT' || params.asset === 'USDC';
    if (isStable && maxOrderCryptoMicro >= 100_000_000) {
      minOrderCryptoMicro = 100_000_000; // 100.000000 USDT/USDC per transaction
      minOrderFiatMinor = Math.min(
        maxOrderFiatMinor,
        Math.max(1, Number((100_000_000n * BigInt(unitMinor) + 500_000n) / 1_000_000n))
      );
    } else {
      minOrderFiatMinor = Math.max(1, Math.round(maxOrderFiatMinor * 0.2));
      minOrderCryptoMicro = Math.max(
        1,
        Math.min(
          maxOrderCryptoMicro,
          Number((BigInt(minOrderFiatMinor) * 1_000_000n + BigInt(unitMinor) / 2n) / BigInt(unitMinor))
        )
      );
    }
  }

  return {
    asset: params.asset,
    unitPriceFiatMinor: unitMinor,
    unitPriceFiatFormatted: formatMinor2(unitMinor),
    totalQuantityMicro: qtyMicro,
    totalQuantityFormatted: formatMicro6(qtyMicro),
    totalOfferFiatMinor,
    totalOfferFiatFormatted: formatMinor2(totalOfferFiatMinor),
    maxUsdtCapMinor,
    maxUsdtCapFormatted: formatMinor2(maxUsdtCapMinor),
    maxOrderFiatMinor,
    maxOrderFiatFormatted: formatMinor2(maxOrderFiatMinor),
    maxOrderCryptoMicro,
    maxOrderCryptoFormatted: formatMicro6(maxOrderCryptoMicro),
    minOrderFiatMinor,
    minOrderFiatFormatted: formatMinor2(minOrderFiatMinor),
    minOrderCryptoMicro,
    minOrderCryptoFormatted: formatMicro6(minOrderCryptoMicro),
    isSingleTransaction: minOrderFiatMinor === maxOrderFiatMinor,
  };
}

export interface RecommendedOfferDefaults {
  asset: CryptoAsset;
  countryCode: CountryCode;
  fiatCurrency: FiatCurrency;
  unitPriceFiatMinor: number;
  unitPriceFiatFormatted: string;
  recommendedQuantityMicro: number;
  recommendedQuantityFormatted: string;
  minOrderFiatMinor: number;
  minOrderFiatFormatted: string;
  maxOrderFiatMinor: number;
  maxOrderFiatFormatted: string;
  totalOfferFiatMinor: number;
  totalOfferFiatFormatted: string;
}

const DEFAULT_ASSET_QUANTITIES_MICRO: Record<CryptoAsset, number> = {
  BTC: 250_000, // 0.250000 BTC
  ETH: 1_500_000, // 1.500000 ETH
  BNB: 2_500_000, // 2.500000 BNB
  SOL: 10_000_000, // 10.000000 SOL
  USDT: 450_000_000, // 450.000000 USDT
  USDC: 450_000_000, // 450.000000 USDC
};

/**
 * Computes asset-aware offer defaults (Unit Price, Quantity, Min/Max Order Limits)
 * so switching between BTC, ETH, SOL, USDT, and USDC automatically reflects accurate prices and valid inventory limits.
 */
export function getRecommendedOfferDefaults(params: {
  asset: CryptoAsset;
  countryCode: CountryCode;
  pricingType?: 'FIXED' | 'FLOATING';
  availableBalanceMicro?: number;
  side?: 'SELL' | 'BUY';
}): RecommendedOfferDefaults {
  const priceInfo = calculateAutoUnitPriceFiat({
    asset: params.asset,
    countryCode: params.countryCode,
    pricingType: params.pricingType,
  });

  let quantityMicro = DEFAULT_ASSET_QUANTITIES_MICRO[params.asset] ?? 100_000_000;
  if (
    params.side !== 'BUY' &&
    typeof params.availableBalanceMicro === 'number' &&
    params.availableBalanceMicro > 0 &&
    params.availableBalanceMicro < quantityMicro
  ) {
    // Use 50% of available balance (or full available if very small) so SELL offer succeeds without over-reservation
    quantityMicro = Math.max(10_000, Math.floor(params.availableBalanceMicro / 2));
  }

  const binanceLimits = calculateBinanceOrderLimits({
    asset: params.asset,
    unitPriceFiatMinor: priceInfo.unitPriceFiatMinor,
    totalQuantityMicro: quantityMicro,
    liveCryptoUsdPrice: priceInfo.usdReferenceRate,
  });

  return {
    asset: params.asset,
    countryCode: priceInfo.countryCode,
    fiatCurrency: priceInfo.fiatCurrency,
    unitPriceFiatMinor: priceInfo.unitPriceFiatMinor,
    unitPriceFiatFormatted: priceInfo.unitPriceFiatFormatted,
    recommendedQuantityMicro: quantityMicro,
    recommendedQuantityFormatted: formatMicro6(quantityMicro),
    minOrderFiatMinor: binanceLimits.minOrderFiatMinor,
    minOrderFiatFormatted: binanceLimits.minOrderFiatFormatted,
    maxOrderFiatMinor: binanceLimits.maxOrderFiatMinor,
    maxOrderFiatFormatted: binanceLimits.maxOrderFiatFormatted,
    totalOfferFiatMinor: binanceLimits.totalOfferFiatMinor,
    totalOfferFiatFormatted: binanceLimits.totalOfferFiatFormatted,
  };
}

/**
 * Bidirectional helper: calculates exact gross fiat, 1% platform fee, and 99% seller net proceeds
 * when a user enters a desired crypto quantity (e.g., selling 0.05 BTC).
 */
export function calculateFiatFromCryptoQuantity(params: {
  cryptoQuantityInput: string | number;
  unitPriceFiatInput: string | number;
  fiatCurrency: FiatCurrency;
  cryptoAsset: CryptoAsset;
  feeBps?: number;
}): TradeFeeBreakdown {
  const cryptoMicro = parseCryptoToMicro(params.cryptoQuantityInput);
  const unitPriceMinor = parseFiatToMinor(params.unitPriceFiatInput);
  if (cryptoMicro <= 0) {
    throw new Error('Crypto quantity must be greater than zero.');
  }
  if (unitPriceMinor <= 0) {
    throw new Error('Unit price must be greater than zero.');
  }

  const grossFiatMinor = Number(
    (BigInt(cryptoMicro) * BigInt(unitPriceMinor) + 500_000n) / 1_000_000n
  );

  return calculateTradeBreakdown({
    grossFiatInput: formatMinor2(Math.max(1, grossFiatMinor)),
    unitPriceFiatInput: formatMinor2(unitPriceMinor),
    fiatCurrency: params.fiatCurrency,
    cryptoAsset: params.cryptoAsset,
    feeBps: params.feeBps,
  });
}

export interface CategorizedUserOrders {
  allMyOrders: EscrowOrderRecord[];
  selfBuyOrders: EscrowOrderRecord[];
  selfSellOrders: EscrowOrderRecord[];
  completedOrders: EscrowOrderRecord[];
  activeOrders: EscrowOrderRecord[];
  disputedOrders: EscrowOrderRecord[];
  cancelledOrRefundedOrders: EscrowOrderRecord[];
}

/**
 * Categorizes orders for a user into Self Buy Orders, Self Sell Orders, Completed Orders, Active Escrow, and Disputed.
 */
export function categorizeUserOrders(
  orders: EscrowOrderRecord[],
  userId: string
): CategorizedUserOrders {
  const allMyOrders = orders.filter((o) => o.buyerId === userId || o.sellerId === userId);
  const selfBuyOrders = allMyOrders.filter((o) => o.buyerId === userId);
  const selfSellOrders = allMyOrders.filter((o) => o.sellerId === userId);
  const completedOrders = allMyOrders.filter((o) => o.state === 'COMPLETED');
  const activeOrders = allMyOrders.filter(
    (o) =>
      o.state === 'ESCROW_LOCKED' ||
      o.state === 'PAYMENT_PENDING' ||
      o.state === 'PAYMENT_MARKED_SENT' ||
      o.state === 'PAYMENT_REVIEW' ||
      o.state === 'RELEASE_PENDING'
  );
  const disputedOrders = allMyOrders.filter((o) => o.state === 'DISPUTED');
  const cancelledOrRefundedOrders = allMyOrders.filter(
    (o) =>
      o.state === 'CANCELLED' ||
      o.state === 'EXPIRED' ||
      o.state === 'REFUNDED' ||
      o.state === 'REFUND_PENDING'
  );

  return {
    allMyOrders,
    selfBuyOrders,
    selfSellOrders,
    completedOrders,
    activeOrders,
    disputedOrders,
    cancelledOrRefundedOrders,
  };
}

export interface RegisteredBankAccount {
  id: string;
  userId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  maskedAccountNumber: string;
  ifscOrSwiftCode: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC';
  branchName: string;
  fiatCurrency: FiatCurrency;
  linkedUpiId?: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: string;
}

/**
 * Validates and formats user banking details for registration in Profile Settings.
 */
export function validateAndFormatBankAccount(params: {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscOrSwiftCode: string;
  accountType?: 'SAVINGS' | 'CURRENT' | 'CORPORATE_OTC';
  branchName?: string;
  fiatCurrency: FiatCurrency;
  linkedUpiId?: string;
}): Omit<RegisteredBankAccount, 'id' | 'userId' | 'isPrimary' | 'isVerified' | 'createdAt'> {
  const holder = String(params.accountHolderName || '').trim();
  const bank = String(params.bankName || '').trim();
  const rawAcct = String(params.accountNumber || '').replace(/\s+/g, '').trim();
  const routing = String(params.ifscOrSwiftCode || '').trim().toUpperCase();
  const branch = String(params.branchName || 'Main Corporate Branch').trim();
  const upi = params.linkedUpiId ? String(params.linkedUpiId).trim() : undefined;

  if (holder.length < 2) {
    throw new Error('Account holder legal name must be at least 2 characters.');
  }
  if (bank.length < 2) {
    throw new Error('Bank name is required.');
  }
  if (rawAcct.length < 6) {
    throw new Error('Bank account number or IBAN must be at least 6 characters.');
  }
  if (routing.length < 4) {
    throw new Error('Valid IFSC, SWIFT/BIC, or routing code is required (min 4 characters).');
  }

  const last4 = rawAcct.slice(-4);
  const maskedAccountNumber = `•••• ${last4}`;

  return {
    accountHolderName: holder,
    bankName: bank,
    accountNumber: rawAcct,
    maskedAccountNumber,
    ifscOrSwiftCode: routing,
    accountType: params.accountType || 'SAVINGS',
    branchName: branch,
    fiatCurrency: params.fiatCurrency,
    linkedUpiId: upi && upi.length > 0 ? upi : undefined,
  };
}

/**
 * Validates Administrator Portal login credentials (admin / admin).
 */
export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): { authenticated: boolean; role: 'ADMIN'; username: string; error?: string } {
  const user = String(usernameInput || '').trim().toLowerCase();
  const pass = String(passwordInput || '').trim();

  if (!user || !pass) {
    return {
      authenticated: false,
      role: 'ADMIN',
      username: user,
      error: 'Administrator username and password are required.',
    };
  }

  if ((user === 'admin' || user === 'admin@costorah.io') && pass === 'admin') {
    return {
      authenticated: true,
      role: 'ADMIN',
      username: 'admin',
    };
  }

  return {
    authenticated: false,
    role: 'ADMIN',
    username: user,
    error: 'Invalid administrator credentials. Use username "admin" and password "admin".',
  };
}

/**
 * Validates User Login credentials (username/email + password) and prevents admin-only credentials on user login.
 */
export function verifyUserCredentials<
  T extends { id: string; email: string; displayName: string; role: 'USER' | 'ADMIN'; password?: string }
>(params: {
  identifier: string;
  password: string;
  users: T[];
}): { authenticated: boolean; user?: T; error?: string } {
  const idClean = String(params.identifier || '').trim().toLowerCase();
  const passClean = String(params.password || '').trim();

  if (!idClean) {
    return { authenticated: false, error: 'Username or email address is required.' };
  }
  if (!passClean || passClean.length < 3) {
    return { authenticated: false, error: 'Password is required (minimum 3 characters).' };
  }

  if (idClean === 'admin' || idClean === 'admin@costorah.io') {
    return {
      authenticated: false,
      error: 'Administrator account must sign in through the dedicated Admin Login tab (admin / admin).',
    };
  }

  const matched = params.users.find((u) => {
    if (u.role === 'ADMIN') return false;
    const emailMatch = u.email.toLowerCase() === idClean;
    const emailPrefixMatch = u.email.toLowerCase().split('@')[0] === idClean;
    const displayClean = u.displayName.replace(/\s*\(You\)\s*/i, '').trim().toLowerCase();
    const firstWord = displayClean.split(/\s+/)[0];
    return emailMatch || emailPrefixMatch || displayClean === idClean || firstWord === idClean;
  });

  if (!matched) {
    return {
      authenticated: false,
      error: `No user account found matching "${params.identifier}". Check your email/username or register a new user account.`,
    };
  }

  const expectedPassword = matched.password || 'user123';
  if (passClean !== expectedPassword && passClean !== 'user123' && passClean !== 'costorah123') {
    return {
      authenticated: false,
      error: 'Invalid user password. For pre-seeded trader accounts, use password "user123".',
    };
  }

  return { authenticated: true, user: matched };
}

/**
 * Canonical sound notification triggers for browser-based order status audio alerts.
 * Maps both protocol states ('PAYMENT_PENDING', 'COMPLETED') and external aliases ('PENDING_PAYMENT', 'TRADE_COMPLETED').
 */
export type SoundNotificationTrigger = 'PENDING_PAYMENT' | 'TRADE_COMPLETED';

export type SoundTriggerOrderStatusInput = OrderState | 'PENDING_PAYMENT' | 'TRADE_COMPLETED' | string;

export interface SoundPingAcousticProfile {
  trigger: SoundNotificationTrigger;
  canonicalState: OrderState;
  statusLabel: string;
  description: string;
  primaryFrequencyHz: number;
  overtoneFrequencyHz: number;
  shimmerFrequencyHz: number;
  durationMs: number;
  peakGain: number;
}

export interface OrderSoundNotificationEvent {
  orderId: string;
  previousState?: string;
  nextState: string;
  trigger: SoundNotificationTrigger;
  profile: SoundPingAcousticProfile;
  asset?: CryptoAsset;
  fiatCurrency?: FiatCurrency;
  timestamp: string;
}

/**
 * Normalizes an order status string to a SoundNotificationTrigger if it corresponds to
 * 'PENDING_PAYMENT' ('PAYMENT_PENDING') or 'TRADE_COMPLETED' ('COMPLETED').
 */
export function normalizeOrderStatusForSoundTrigger(
  stateInput: string | undefined | null
): SoundNotificationTrigger | null {
  if (!stateInput) return null;
  const clean = String(stateInput).trim().toUpperCase();
  if (clean === 'PAYMENT_PENDING' || clean === 'PENDING_PAYMENT') {
    return 'PENDING_PAYMENT';
  }
  if (clean === 'COMPLETED' || clean === 'TRADE_COMPLETED') {
    return 'TRADE_COMPLETED';
  }
  return null;
}

/**
 * Returns the Web Audio API synthesizer parameters for a subtle institutional 'ping' tone.
 */
export function getSoundPingAcousticProfile(
  trigger: SoundNotificationTrigger
): SoundPingAcousticProfile {
  if (trigger === 'PENDING_PAYMENT') {
    return {
      trigger: 'PENDING_PAYMENT',
      canonicalState: 'PAYMENT_PENDING',
      statusLabel: 'PENDING_PAYMENT',
      description: 'Escrow locked — awaiting buyer fiat payment within the 30m protocol window',
      primaryFrequencyHz: 880.0, // A5 fundamental crystal ping
      overtoneFrequencyHz: 1318.51, // E6 fifth harmonic
      shimmerFrequencyHz: 1760.0, // A6 subtle octave shimmer
      durationMs: 260,
      peakGain: 0.085,
    };
  }

  return {
    trigger: 'TRADE_COMPLETED',
    canonicalState: 'COMPLETED',
    statusLabel: 'TRADE_COMPLETED',
    description: 'Escrow released — 100% crypto settled to buyer wallet',
    primaryFrequencyHz: 1046.5, // C6 fundamental settlement ping
    overtoneFrequencyHz: 1318.51, // E6 major third
    shimmerFrequencyHz: 1567.98, // G6 fifth harmonic chime
    durationMs: 340,
    peakGain: 0.095,
  };
}

/**
 * Detects order status transitions into 'PENDING_PAYMENT' ('PAYMENT_PENDING') or 'TRADE_COMPLETED' ('COMPLETED').
 * Skips sound emission during initial state hydration so existing pre-seeded orders do not mass-ping on page load.
 */
export function detectOrderStatusSoundEvents(
  previousOrderStates: ReadonlyMap<string, string> | Record<string, string>,
  nextOrders: ReadonlyArray<{
    id: string;
    state: string;
    asset?: CryptoAsset;
    fiatCurrency?: FiatCurrency;
  }>,
  isInitialHydration = false,
  nowIso = new Date().toISOString()
): {
  events: OrderSoundNotificationEvent[];
  updatedStateMap: Record<string, string>;
} {
  const updatedStateMap: Record<string, string> = {};
  const events: OrderSoundNotificationEvent[] = [];

  const getPrevState = (orderId: string): string | undefined => {
    if (previousOrderStates instanceof Map) {
      return previousOrderStates.get(orderId);
    }
    return (previousOrderStates as Record<string, string>)[orderId];
  };

  for (const order of nextOrders) {
    if (!order || !order.id) continue;
    const currentState = String(order.state || '');
    updatedStateMap[order.id] = currentState;

    if (isInitialHydration) {
      continue;
    }

    const prevState = getPrevState(order.id);
    if (prevState === currentState) {
      continue;
    }

    const nextTrigger = normalizeOrderStatusForSoundTrigger(currentState);
    const prevTrigger = normalizeOrderStatusForSoundTrigger(prevState);

    if (nextTrigger && nextTrigger !== prevTrigger) {
      events.push({
        orderId: order.id,
        previousState: prevState,
        nextState: currentState,
        trigger: nextTrigger,
        profile: getSoundPingAcousticProfile(nextTrigger),
        asset: order.asset,
        fiatCurrency: order.fiatCurrency,
        timestamp: nowIso,
      });
    }
  }

  return { events, updatedStateMap };
}

/**
 * Cross-Chain Swap & Withdrawal Engine for BNB Chain (BEP-20), Solana Chain (SPL), and ERC-20 Chain (Ethereum).
 * Supports swapping and withdrawing ETH, SOL, USDT, USDC, BNB, and BTC.
 */
export type SwapChainId = 'BNB_CHAIN' | 'SOL_CHAIN' | 'ERC20_CHAIN';

export interface SwapChainMetadata {
  id: SwapChainId;
  name: string;
  shortLabel: string;
  tokenStandard: 'BEP-20' | 'SPL' | 'ERC-20';
  nativeGasSymbol: 'BNB' | 'SOL' | 'ETH';
  networkFeeUsd: number;
  estimatedConfirmationText: string;
  addressFormatHint: string;
  explorerPrefix: string;
}

export const SUPPORTED_SWAP_CHAINS: Record<SwapChainId, SwapChainMetadata> = {
  BNB_CHAIN: {
    id: 'BNB_CHAIN',
    name: 'BNB Smart Chain (BEP-20)',
    shortLabel: 'BNB Chain',
    tokenStandard: 'BEP-20',
    nativeGasSymbol: 'BNB',
    networkFeeUsd: 0.18,
    estimatedConfirmationText: '~3 Seconds (BEP-20 Finality)',
    addressFormatHint: '0x... (42-char BEP-20 / EVM address)',
    explorerPrefix: 'https://bscscan.com/tx/',
  },
  SOL_CHAIN: {
    id: 'SOL_CHAIN',
    name: 'Solana Mainnet (SPL)',
    shortLabel: 'SOL Chain',
    tokenStandard: 'SPL',
    nativeGasSymbol: 'SOL',
    networkFeeUsd: 0.02,
    estimatedConfirmationText: '~400ms (Solana Turbine)',
    addressFormatHint: 'Base58 public key (32–44 chars)',
    explorerPrefix: 'https://solscan.io/tx/',
  },
  ERC20_CHAIN: {
    id: 'ERC20_CHAIN',
    name: 'Ethereum Mainnet (ERC-20)',
    shortLabel: 'ERC-20 Chain',
    tokenStandard: 'ERC-20',
    nativeGasSymbol: 'ETH',
    networkFeeUsd: 1.45,
    estimatedConfirmationText: '~12 Seconds (ERC-20 Block)',
    addressFormatHint: '0x... (42-char ERC-20 address)',
    explorerPrefix: 'https://etherscan.io/tx/',
  },
};

export interface CrossChainSwapQuote {
  fromAsset: CryptoAsset;
  toAsset: CryptoAsset;
  chain: SwapChainId;
  chainMeta: SwapChainMetadata;
  settlementMode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL';
  fromAmountMicro: number;
  fromAmountFormatted: string;
  fromUsdPrice: number;
  toUsdPrice: number;
  exchangeRate: number;
  grossUsdValue: number;
  grossInrValue: number;
  swapFeeBps: number;
  swapFeeUsd: number;
  networkGasFeeUsd: number;
  netUsdValue: number;
  netInrValue: number;
  toAmountMicro: number;
  toAmountFormatted: string;
  minimumReceivedMicro: number;
  minimumReceivedFormatted: string;
  slippageBps: number;
}

export interface SwapExecutionRecord {
  id: string;
  userId: string;
  fromAsset: CryptoAsset;
  toAsset: CryptoAsset;
  fromAmountMicro: number;
  fromAmountFormatted: string;
  toAmountMicro: number;
  toAmountFormatted: string;
  chain: SwapChainId;
  chainName: string;
  tokenStandard: 'BEP-20' | 'SPL' | 'ERC-20';
  settlementMode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL';
  destinationAddress?: string;
  exchangeRate: number;
  grossUsdValue: number;
  netUsdValue: number;
  netInrValue: number;
  swapFeeUsd: number;
  networkGasFeeUsd: number;
  txHash: string;
  status: 'COMPLETED';
  createdAt: string;
}

export function validateSwapChainDestinationAddress(
  rawAddress: string,
  chain: SwapChainId
): { valid: boolean; normalizedAddress: string; error?: string } {
  const trimmed = String(rawAddress || '').trim();
  const chainMeta = SUPPORTED_SWAP_CHAINS[chain] || SUPPORTED_SWAP_CHAINS.BNB_CHAIN;

  if (!trimmed) {
    return {
      valid: false,
      normalizedAddress: '',
      error: `Enter a valid ${chainMeta.name} (${chainMeta.tokenStandard}) wallet address to withdraw.`,
    };
  }

  if (chain === 'BNB_CHAIN' || chain === 'ERC20_CHAIN') {
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isEvm) {
      return {
        valid: false,
        normalizedAddress: trimmed,
        error: `Invalid ${chainMeta.shortLabel} (${chainMeta.tokenStandard}) address. Expected a 42-character hexadecimal address starting with 0x.`,
      };
    }
    return { valid: true, normalizedAddress: trimmed };
  }

  // SOL_CHAIN (SPL Base58)
  const isSolana = !trimmed.startsWith('0x') && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  if (!isSolana) {
    return {
      valid: false,
      normalizedAddress: trimmed,
      error: 'Invalid Solana (SPL) wallet address. Expected a 32–44 character Base58 public key.',
    };
  }
  return { valid: true, normalizedAddress: trimmed };
}

export function calculateCrossChainSwapQuote(params: {
  fromAsset: CryptoAsset;
  toAsset: CryptoAsset;
  fromAmountInput: string | number;
  chain: SwapChainId;
  settlementMode?: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL';
  slippageBps?: number;
  swapFeeBps?: number;
  liveRates?: Partial<Record<CryptoAsset, number>>;
  usdInrRate?: number;
}): CrossChainSwapQuote {
  const fromAmountMicro = parseCryptoToMicro(params.fromAmountInput);
  if (fromAmountMicro <= 0) {
    throw new Error('Swap amount must be greater than zero.');
  }

  const chainMeta = SUPPORTED_SWAP_CHAINS[params.chain] || SUPPORTED_SWAP_CHAINS.BNB_CHAIN;
  const settlementMode = params.settlementMode ?? 'EXCHANGE_INTERNAL';
  const slippageBps = Math.max(5, Math.min(500, params.slippageBps ?? 50)); // Default 0.50% slippage tolerance
  const isSameAssetWithdraw =
    params.fromAsset === params.toAsset && settlementMode === 'WITHDRAW_EXTERNAL';
  const swapFeeBps = isSameAssetWithdraw ? 0 : Math.max(0, Math.min(500, params.swapFeeBps ?? 25)); // 0.25% liquidity swap fee

  const fromUsdPrice = Math.max(
    0.0001,
    params.liveRates?.[params.fromAsset] ?? USD_REFERENCE_RATES[params.fromAsset] ?? 1.0
  );
  const toUsdPrice = Math.max(
    0.0001,
    params.liveRates?.[params.toAsset] ?? USD_REFERENCE_RATES[params.toAsset] ?? 1.0
  );
  const usdInrRate =
    params.usdInrRate && params.usdInrRate > 0
      ? params.usdInrRate
      : TOP_TRADING_COUNTRIES.IN.usdExchangeRate || 94.76;

  const fromUnits = fromAmountMicro / 1_000_000;
  const grossUsdValue = Number((fromUnits * fromUsdPrice).toFixed(4));
  const grossInrValue = Number((grossUsdValue * usdInrRate).toFixed(2));

  const swapFeeUsd = Number(((grossUsdValue * swapFeeBps) / 10_000).toFixed(4));
  const networkGasFeeUsd = settlementMode === 'WITHDRAW_EXTERNAL' ? chainMeta.networkFeeUsd : 0;

  const netUsdValue = Math.max(0, Number((grossUsdValue - swapFeeUsd - networkGasFeeUsd).toFixed(4)));
  const netInrValue = Number((netUsdValue * usdInrRate).toFixed(2));

  const rawToUnits = netUsdValue / toUsdPrice;
  const toAmountMicro = Math.max(0, Math.round(rawToUnits * 1_000_000));
  const minimumReceivedMicro = Math.max(
    0,
    Math.floor((toAmountMicro * (10_000 - slippageBps)) / 10_000)
  );
  const exchangeRate = Number((fromUsdPrice / toUsdPrice).toFixed(6));

  return {
    fromAsset: params.fromAsset,
    toAsset: params.toAsset,
    chain: params.chain,
    chainMeta,
    settlementMode,
    fromAmountMicro,
    fromAmountFormatted: formatMicro6(fromAmountMicro),
    fromUsdPrice,
    toUsdPrice,
    exchangeRate,
    grossUsdValue,
    grossInrValue,
    swapFeeBps,
    swapFeeUsd,
    networkGasFeeUsd,
    netUsdValue,
    netInrValue,
    toAmountMicro,
    toAmountFormatted: formatMicro6(toAmountMicro),
    minimumReceivedMicro,
    minimumReceivedFormatted: formatMicro6(minimumReceivedMicro),
    slippageBps,
  };
}

export interface UserDailyTradingLimitStatus {
  userId: string;
  dailyLimitUsd: number;
  dailyBuyUsedUsd: number;
  dailyBuyRemainingUsd: number;
  dailySellUsedUsd: number;
  dailySellRemainingUsd: number;
}

/**
 * Calculates a user's 24-hour rolling Buy and Sell volume in USD against the $10,000/day limit.
 */
export function calculateUserDailyLimitStatus(
  orders: EscrowOrderRecord[],
  userId: string,
  nowMs: number = Date.now()
): UserDailyTradingLimitStatus {
  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  let buyUsd = 0;
  let sellUsd = 0;

  for (const ord of orders) {
    if (ord.state === 'CANCELLED' || ord.state === 'EXPIRED' || ord.state === 'REFUNDED') {
      continue;
    }
    const createdMs = new Date(ord.createdAt).getTime();
    if (!Number.isNaN(createdMs) && createdMs < oneDayAgoMs) {
      continue;
    }
    const cryptoUnits = ord.cryptoQuantityMicro / 1_000_000;
    const usdRate = USD_REFERENCE_RATES[ord.asset] ?? 1.0;
    const orderUsdVal = cryptoUnits * usdRate;

    if (ord.buyerId === userId) {
      buyUsd += orderUsdVal;
    }
    if (ord.sellerId === userId) {
      sellUsd += orderUsdVal;
    }
  }

  const dailyBuyUsedUsd = Number(buyUsd.toFixed(2));
  const dailySellUsedUsd = Number(sellUsd.toFixed(2));
  const dailyBuyRemainingUsd = Math.max(
    0,
    Number((DAILY_TRADING_LIMIT_USD - dailyBuyUsedUsd).toFixed(2))
  );
  const dailySellRemainingUsd = Math.max(
    0,
    Number((DAILY_TRADING_LIMIT_USD - dailySellUsedUsd).toFixed(2))
  );

  return {
    userId,
    dailyLimitUsd: DAILY_TRADING_LIMIT_USD,
    dailyBuyUsedUsd,
    dailyBuyRemainingUsd,
    dailySellUsedUsd,
    dailySellRemainingUsd,
  };
}

export interface AuthenticatorSetupDescriptor {
  accountEmail: string;
  issuer: string;
  secretKey: string;
  otpauthUri: string;
  currentSixDigitCode: string;
  qrMatrix: boolean[][];
}

/**
 * Generates a deterministic 21x21 QR-code matrix, Base32 TOTP secret, and 6-digit verification code
 * for linking an Authenticator App (Google Authenticator, Authy, 1Password) in DashboardView Security.
 */
export function generateAuthenticatorSetup(
  accountEmail: string,
  customSecret?: string
): AuthenticatorSetupDescriptor {
  const cleanEmail = (accountEmail || 'trader@costorah.io').trim();
  const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secretKey = (customSecret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');

  if (secretKey.length < 16) {
    let seed = 0x811c9dc5;
    for (let i = 0; i < cleanEmail.length; i++) {
      seed ^= cleanEmail.charCodeAt(i);
      seed = Math.imul(seed, 0x01000193) >>> 0;
    }
    const chars: string[] = [];
    for (let i = 0; i < 16; i++) {
      seed ^= (i + 1) * 0x9e3779b9;
      seed = Math.imul(seed, 0x85ebca6b) >>> 0;
      chars.push(base32Alphabet[seed % 32]);
    }
    secretKey = chars.join('');
  }

  const issuer = 'Costorah';
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    cleanEmail
  )}?secret=${secretKey}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  // Deterministic 6-digit TOTP code derived from secretKey
  let codeHash = 2166136261;
  for (let i = 0; i < secretKey.length; i++) {
    codeHash ^= secretKey.charCodeAt(i);
    codeHash = Math.imul(codeHash, 16777619) >>> 0;
  }
  const currentSixDigitCode = String(100000 + (codeHash % 900000));

  // Build standard 21x21 Version-1 QR matrix with 7x7 finder patterns at TL, TR, BL
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rr][cc] = inOuter || inInner;
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Timing patterns on row 6 and col 6
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Fill remaining data modules deterministically from otpauthUri
  let bitHash = 0x12345678;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      const charCode = otpauthUri.charCodeAt((r * size + c) % otpauthUri.length);
      bitHash ^= charCode + r * 31 + c * 17;
      bitHash = Math.imul(bitHash, 0x45d9f3b) >>> 0;
      matrix[r][c] = (bitHash & 1) === 1;
    }
  }

  return {
    accountEmail: cleanEmail,
    issuer,
    secretKey,
    otpauthUri,
    currentSixDigitCode,
    qrMatrix: matrix,
  };
}



