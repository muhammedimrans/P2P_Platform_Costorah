import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTradeBreakdown,
  isValidOrderTransition,
  assertValidTransition,
  EscrowLedgerEngine,
  createWalletChallenge,
  verifyWalletChallenge,
  parseCryptoToMicro,
  parseFiatToMinor,
  evaluatePriceAlertsAgainstOffers,
  sanitizeAndMaskCardIdentifier,
  computeVaultGeometryMetrics,
  COUNTRY_ORDER_LIST,
  getLockedFiatForCountry,
  assertCountryFiatLock,
  computeEscrowCoreModeMetrics,
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
  calculateBinanceOrderLimits,
  normalizeOrderStatusForSoundTrigger,
  getSoundPingAcousticProfile,
  detectOrderStatusSoundEvents,
  SUPPORTED_SWAP_CHAINS,
  calculateCrossChainSwapQuote,
  validateSwapChainDestinationAddress,
  DAILY_TRADING_LIMIT_USD,
  calculateUserDailyLimitStatus,
  generateAuthenticatorSetup,
  type PriceAlertRecord,
  type OfferRecord,
  type EscrowOrderRecord,
} from './escrowEngine.ts';

test('1% Platform Fee Calculation: ₹10,000 trade value produces ₹100 fee and ₹9,900 net seller proceeds', () => {
  const breakdown = calculateTradeBreakdown({
    grossFiatInput: '10000.00',
    unitPriceFiatInput: '85.00',
    fiatCurrency: 'INR',
    cryptoAsset: 'USDT',
    feeBps: 100, // 1.00%
  });

  assert.equal(breakdown.grossFiatMinor, 1_000_000);
  assert.equal(breakdown.grossFiatFormatted, '10000.00');
  assert.equal(breakdown.platformFeeFiatMinor, 10_000);
  assert.equal(breakdown.platformFeeFiatFormatted, '100.00');
  assert.equal(breakdown.sellerNetFiatMinor, 990_000);
  assert.equal(breakdown.sellerNetFiatFormatted, '9900.00');
  assert.equal(breakdown.cryptoQuantityFormatted, '117.647059');
});

test('Order State Machine: rejects auto-release from PAYMENT_MARKED_SENT to COMPLETED and rejects expiry after payment sent', () => {
  assert.equal(isValidOrderTransition('PAYMENT_PENDING', 'PAYMENT_MARKED_SENT'), true);
  assert.equal(isValidOrderTransition('PAYMENT_MARKED_SENT', 'COMPLETED'), false);
  assert.equal(isValidOrderTransition('PAYMENT_MARKED_SENT', 'EXPIRED'), false);
  assert.equal(isValidOrderTransition('PAYMENT_MARKED_SENT', 'CANCELLED'), false);

  assert.throws(() => {
    assertValidTransition('PAYMENT_MARKED_SENT', 'RELEASE_PENDING', 'BUYER');
  }, /Only SELLER or ADMIN may authorize release/);

  assert.doesNotThrow(() => {
    assertValidTransition('PAYMENT_MARKED_SENT', 'RELEASE_PENDING', 'SELLER');
  });
});

test('Inventory Reservation & Locked Balance Protection: prevents over-reserving and blocks withdrawing locked escrow funds', () => {
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('seller_1', 'USDT', parseCryptoToMicro('500'), 'dep_1');

  assert.throws(() => {
    engine.createOffer({
      id: 'offer_over',
      makerId: 'seller_1',
      makerName: 'ApexLiquidity',
      side: 'SELL',
      asset: 'USDT',
      fiatCurrency: 'INR',
      unitPriceFiatMinor: parseFiatToMinor('85.00'),
      totalQuantityMicro: parseCryptoToMicro('600'),
      minOrderFiatMinor: parseFiatToMinor('1000'),
      maxOrderFiatMinor: parseFiatToMinor('50000'),
      paymentMethods: ['UPI'],
      paymentInstructions: 'UPI ID: apex@okaxis',
    });
  }, /Insufficient available inventory/);

  engine.createOffer({
    id: 'offer_1',
    makerId: 'seller_1',
    makerName: 'ApexLiquidity',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('100.00'),
    totalQuantityMicro: parseCryptoToMicro('400'),
    minOrderFiatMinor: parseFiatToMinor('1000'),
    maxOrderFiatMinor: parseFiatToMinor('40000'),
    paymentMethods: ['UPI'],
    paymentInstructions: 'UPI ID: apex@okaxis',
  });

  const balAfterOffer = engine.getBalance('seller_1', 'USDT');
  assert.equal(balAfterOffer.availableMicro, parseCryptoToMicro('100'));
  assert.equal(balAfterOffer.lockedMicro, parseCryptoToMicro('400'));

  assert.throws(() => {
    engine.withdraw('seller_1', 'USDT', parseCryptoToMicro('150'), 'wd_fail');
  }, /Insufficient available balance for withdrawal/);

  const order = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_1',
    offerId: 'offer_1',
    takerId: 'buyer_1',
    grossFiatMinor: parseFiatToMinor('10000'),
    paymentMethod: 'UPI',
    idempotencyKey: 'idem_accept_1',
  });

  assert.equal(order.state, 'PAYMENT_PENDING');
  assert.equal(order.cryptoQuantityMicro, parseCryptoToMicro('100'));
  assert.equal(order.platformFeeFiatMinor, parseFiatToMinor('100'));
  assert.equal(order.sellerNetFiatMinor, parseFiatToMinor('9900'));

  const paidOrder = engine.submitPaymentEvidence({
    orderId: 'ord_1',
    buyerId: 'buyer_1',
    paymentReference: 'UTR4290184912',
  });
  assert.equal(paidOrder.state, 'PAYMENT_MARKED_SENT');

  const completed1 = engine.confirmFiatAndReleaseEscrow({
    orderId: 'ord_1',
    actorId: 'seller_1',
    actorRole: 'SELLER',
    idempotencyKey: 'idem_release_1',
  });
  const completed2 = engine.confirmFiatAndReleaseEscrow({
    orderId: 'ord_1',
    actorId: 'seller_1',
    actorRole: 'SELLER',
    idempotencyKey: 'idem_release_1',
  });

  assert.equal(completed1.state, 'COMPLETED');
  assert.equal(completed2.state, 'COMPLETED');

  const buyerBal = engine.getBalance('buyer_1', 'USDT');
  // Buyer receives 100% of the escrowed crypto (100 USDT net)
  assert.equal(buyerBal.availableMicro, parseCryptoToMicro('100'));
  assert.equal(completed1.buyerNetCryptoMicro, 100_000_000);

  const sellerBal = engine.getBalance('seller_1', 'USDT');
  assert.equal(sellerBal.availableMicro, parseCryptoToMicro('100'));
  assert.equal(sellerBal.lockedMicro, parseCryptoToMicro('300'));

  const rec = engine.reconcileAllBalances();
  assert.equal(rec.isValid, true);
  assert.equal(rec.discrepancies.length, 0);
});

test('Order Cancellation: 100% of escrowed crypto locked in order is refunded to seller if cancelled before payment', () => {
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('seller_in', 'USDT', parseCryptoToMicro('500'), 'dep_1');
  engine.deposit('buyer_in', 'USDT', parseCryptoToMicro('10'), 'dep_2');

  const offer = engine.createOffer({
    id: 'off_cancel_1',
    makerId: 'seller_in',
    makerName: 'Vikas Gupta (Seller)',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: 9476, // ₹94.76 / USDT
    totalQuantityMicro: parseCryptoToMicro('200'),
    minOrderFiatMinor: 100000,
    maxOrderFiatMinor: 5000000,
    paymentMethods: ['UPI Instant', 'IMPS'],
    paymentInstructions: 'Pay via UPI',
  });

  // Buyer accepts offer for ₹18,952 (200 USDT)
  const order = engine.acceptOfferAndLockEscrow({
    orderId: 'ord_cancel_test',
    offerId: offer.id,
    takerId: 'buyer_in',
    grossFiatMinor: 1895200,
    paymentMethod: 'UPI Instant',
    idempotencyKey: 'idem_cancel_order',
  });

  assert.equal(order.buyerNetCryptoMicro, parseCryptoToMicro('200'));

  // Cancel order: 100% of the escrowed crypto must be released back to the seller
  const cancelled = engine.cancelOrder({
    orderId: order.id,
    actorId: 'buyer_in',
    actorRole: 'BUYER',
    reason: 'Buyer cancelled prior to bank transfer',
  });

  assert.equal(cancelled.state, 'CANCELLED');

  // Verify seller received their full 200 USDT back into offer inventory
  const updatedOffer = engine.getOffer(offer.id);
  assert.equal(updatedOffer?.availableQuantityMicro, parseCryptoToMicro('200'));
});

test('Dispute Flow: freezes order until authorized ADMIN resolution and supports idempotent refund', () => {
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('seller_2', 'USDC', parseCryptoToMicro('200'), 'dep_s2');

  engine.createOffer({
    id: 'offer_2',
    makerId: 'seller_2',
    makerName: 'NordicDesk',
    side: 'SELL',
    asset: 'USDC',
    fiatCurrency: 'EUR',
    unitPriceFiatMinor: parseFiatToMinor('1.00'),
    totalQuantityMicro: parseCryptoToMicro('200'),
    minOrderFiatMinor: parseFiatToMinor('50'),
    maxOrderFiatMinor: parseFiatToMinor('200'),
    paymentMethods: ['SEPA Instant'],
    paymentInstructions: 'IBAN: DE89370400440532013000',
  });

  engine.acceptOfferAndLockEscrow({
    orderId: 'ord_dispute',
    offerId: 'offer_2',
    takerId: 'buyer_2',
    grossFiatMinor: parseFiatToMinor('100'),
    paymentMethod: 'SEPA Instant',
    idempotencyKey: 'idem_ord_d',
  });

  engine.submitPaymentEvidence({
    orderId: 'ord_dispute',
    buyerId: 'buyer_2',
    paymentReference: 'SEPA-REF-99112',
  });

  const disputed = engine.openDispute({
    orderId: 'ord_dispute',
    actorId: 'seller_2',
    reason: 'Fiat transfer not received in bank account after 2 hours',
  });
  assert.equal(disputed.state, 'DISPUTED');

  assert.throws(() => {
    engine.resolveDispute({
      orderId: 'ord_dispute',
      adminId: 'seller_2',
      actorRole: 'SELLER',
      outcome: 'REFUND_TO_SELLER',
      resolutionNote: 'Self refund attempt',
      idempotencyKey: 'bad_res',
    });
  }, /Only an ADMIN reviewer can resolve/);

  const resolved = engine.resolveDispute({
    orderId: 'ord_dispute',
    adminId: 'admin_1',
    actorRole: 'ADMIN',
    outcome: 'REFUND_TO_SELLER',
    resolutionNote: 'Verified bank statement; SEPA reference was invalid.',
    idempotencyKey: 'admin_res_1',
  });
  assert.equal(resolved.state, 'REFUNDED');
  assert.equal(engine.reconcileAllBalances().isValid, true);
});

test('Wallet Challenge Verification: enforces domain binding, expiration, and replay protection', () => {
  const usedNonces = new Set<string>();
  const challenge = createWalletChallenge({
    walletAddress: '0x71C...89A',
    domain: 'costorah.io',
    nonce: 'nonce_9918273',
    nowMs: 1_700_000_000_000,
    ttlMs: 300_000,
  });

  const wrongDomain = verifyWalletChallenge({
    challenge,
    expectedDomain: 'phishing-site.com',
    signature: '0x99887766554433221100aabbccddeeff',
    usedNonces,
    nowMs: 1_700_000_050_000,
  });
  assert.equal(wrongDomain.verified, false);

  const valid = verifyWalletChallenge({
    challenge,
    expectedDomain: 'costorah.io',
    signature: '0x99887766554433221100aabbccddeeff',
    usedNonces,
    nowMs: 1_700_000_050_000,
  });
  assert.equal(valid.verified, true);

  const replay = verifyWalletChallenge({
    challenge,
    expectedDomain: 'costorah.io',
    signature: '0x99887766554433221100aabbccddeeff',
    usedNonces,
    nowMs: 1_700_000_060_000,
  });
  assert.equal(replay.verified, false);
  assert.match(replay.reason || '', /replay attack prevented/);
});

test('Background Price Alert Worker & Card Masking: triggers matching asset/fiat alerts and masks PANs', () => {
  const alerts: PriceAlertRecord[] = [
    {
      id: 'al_1',
      userId: 'usr_1',
      userEmail: 'alex@costorah.io',
      asset: 'USDT',
      fiatCurrency: 'INR',
      direction: 'AT_OR_BELOW',
      targetPriceFiatMinor: parseFiatToMinor('87.00'),
      channel: 'BOTH',
      status: 'ACTIVE',
      createdAt: '2026-10-17T00:00:00Z',
    },
    {
      id: 'al_2',
      userId: 'usr_1',
      userEmail: 'alex@costorah.io',
      asset: 'BTC',
      fiatCurrency: 'USD',
      direction: 'AT_OR_ABOVE',
      targetPriceFiatMinor: parseFiatToMinor('95000.00'),
      channel: 'EMAIL',
      status: 'ACTIVE',
      createdAt: '2026-10-17T00:00:00Z',
    },
  ];

  const offers: OfferRecord[] = [
    {
      id: 'off_usdt_inr',
      makerId: 'maker_1',
      makerName: 'Vikram OTC',
      side: 'SELL',
      asset: 'USDT',
      fiatCurrency: 'INR',
      unitPriceFiatMinor: parseFiatToMinor('86.50'),
      totalQuantityMicro: parseCryptoToMicro('1000'),
      availableQuantityMicro: parseCryptoToMicro('1000'),
      minOrderFiatMinor: parseFiatToMinor('1000'),
      maxOrderFiatMinor: parseFiatToMinor('50000'),
      paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'Paytm'],
      paymentInstructions: 'Send via PhonePe or GPay',
      status: 'OPEN',
      completedTrades: 100,
      completionRatePct: 99.5,
      createdAt: '2026-10-17T00:00:00Z',
    },
  ];

  const triggered = evaluatePriceAlertsAgainstOffers(alerts, offers, '2026-10-17T02:00:00Z');
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].id, 'al_1');
  assert.equal(triggered[0].status, 'TRIGGERED');
  assert.equal(triggered[0].triggeredOfferId, 'off_usdt_inr');
  assert.equal(triggered[0].emailDispatched, true);
  assert.equal(alerts[1].status, 'ACTIVE');

  // Card masking check
  const masked = sanitizeAndMaskCardIdentifier('4111 2222 3333 8842', 'Visa Credit');
  assert.equal(masked, 'Visa Credit •••• 8842');
});

test('3D Escrow Vault Geometry Scaling: scales 3D crypto objects and central vault core based on USD value in escrow', () => {
  const zeroLocked = computeVaultGeometryMetrics([
    { asset: 'USDT', availableMicro: parseCryptoToMicro('5000'), lockedMicro: 0 },
    { asset: 'BTC', availableMicro: parseCryptoToMicro('0.5'), lockedMicro: 0 },
  ]);

  assert.equal(zeroLocked.totalLockedUsdValue, 0);
  assert.equal(zeroLocked.vaultCoreScale, 0.85);
  const usdtZero = zeroLocked.assets.find((a) => a.asset === 'USDT')!;
  assert.equal(usdtZero.nodeScale, 0.55);
  assert.equal(usdtZero.isLockedInEscrow, false);

  const activeVault = computeVaultGeometryMetrics([
    { asset: 'USDT', availableMicro: parseCryptoToMicro('4000'), lockedMicro: parseCryptoToMicro('1200') },
    { asset: 'ETH', availableMicro: parseCryptoToMicro('2.0'), lockedMicro: parseCryptoToMicro('1.5') },
    { asset: 'BTC', availableMicro: parseCryptoToMicro('0.25'), lockedMicro: parseCryptoToMicro('0.10') },
  ]);

  // 1200 USDT ($1,200) + 1.5 ETH ($3,930) + 0.10 BTC ($6,780) = $11,910 total locked in escrow
  assert.equal(activeVault.totalLockedUsdValue, 11910);
  assert.ok(activeVault.vaultCoreScale > zeroLocked.vaultCoreScale);

  const usdtActive = activeVault.assets.find((a) => a.asset === 'USDT')!;
  const ethActive = activeVault.assets.find((a) => a.asset === 'ETH')!;
  const btcActive = activeVault.assets.find((a) => a.asset === 'BTC')!;

  assert.ok(usdtActive.nodeScale > usdtZero.nodeScale);
  assert.ok(ethActive.nodeScale > usdtActive.nodeScale);
  assert.ok(btcActive.nodeScale > ethActive.nodeScale);

  // Stress-test multiplier (2.5x escrow value) must scale objects even larger
  const scaledVault = computeVaultGeometryMetrics(
    [
      { asset: 'USDT', availableMicro: parseCryptoToMicro('4000'), lockedMicro: parseCryptoToMicro('1200') },
      { asset: 'ETH', availableMicro: parseCryptoToMicro('2.0'), lockedMicro: parseCryptoToMicro('1.5') },
      { asset: 'BTC', availableMicro: parseCryptoToMicro('0.25'), lockedMicro: parseCryptoToMicro('0.10') },
    ],
    2.5
  );
  assert.ok(scaledVault.totalLockedUsdValue > activeVault.totalLockedUsdValue);
  assert.ok(scaledVault.vaultCoreScale > activeVault.vaultCoreScale);
});

test('Country-to-Fiat Security Lock: restricts users in India to INR, US to USD, Turkey to TRY, Iran to IRR, and covers Top 10 countries', () => {
  assert.equal(COUNTRY_ORDER_LIST.length, 10);
  assert.equal(getLockedFiatForCountry('IN'), 'INR');
  assert.equal(getLockedFiatForCountry('US'), 'USD');
  assert.equal(getLockedFiatForCountry('TR'), 'TRY');
  assert.equal(getLockedFiatForCountry('IR'), 'IRR');
  assert.equal(getLockedFiatForCountry('NG'), 'NGN');

  // Matching country + domestic fiat succeeds
  assert.doesNotThrow(() => assertCountryFiatLock('IN', 'INR'));
  assert.doesNotThrow(() => assertCountryFiatLock('US', 'USD'));
  assert.doesNotThrow(() => assertCountryFiatLock('TR', 'TRY'));
  assert.doesNotThrow(() => assertCountryFiatLock('IR', 'IRR'));

  // Cross-currency attempts are strictly blocked
  assert.throws(
    () => assertCountryFiatLock('IN', 'USD'),
    /Country Security Lock Violation: Your account jurisdiction is set to India \(IN\), which strictly restricts P2P crypto trading to Indian Rupee \(INR ₹\)/
  );
  assert.throws(
    () => assertCountryFiatLock('US', 'INR'),
    /Country Security Lock Violation: Your account jurisdiction is set to United States \(US\), which strictly restricts P2P crypto trading to US Dollar \(USD \$\)/
  );
});

test('3D Escrow Core Mode Kinematics: computes distinct vault clamp, shell separation, and 99%/1% fee split states', () => {
  const lockedMode = computeEscrowCoreModeMetrics('CORRIDOR_LOCK', 100, false);
  const flowMode = computeEscrowCoreModeMetrics('ESCROW_FLOW', 100, false);
  const feeMode = computeEscrowCoreModeMetrics('FEE_ACCOUNTING', 100, false);
  const disputeMode = computeEscrowCoreModeMetrics('ESCROW_FLOW', 100, true);

  assert.ok(flowMode.clampRadius > lockedMode.clampRadius);
  assert.ok(flowMode.shellVerticalOffset > lockedMode.shellVerticalOffset);
  assert.equal(feeMode.sellerProceedsSharePct, 99);
  assert.equal(feeMode.platformFeeSharePct, 1);
  assert.ok(feeMode.feeShardRadialOffset > 1.0);
  assert.equal(disputeMode.flowPacketSpeed, 0);
  assert.equal(disputeMode.coreAccentHex, 0xf59e0b);
});

test('Advertiser Trust Score: calculates deterministic trust score from completed trades and successful dispute resolutions', () => {
  const vikramTrust = calculateAdvertiserTrustScore({
    makerId: 'usr_vikram_desk',
    offerCompletedTrades: 612,
    offerCompletionRatePct: 99.8,
    userCompletedTrades: 612,
    userCompletionRatePct: 99.8,
    orders: [
      {
        id: 'ord_resolved_win',
        offerId: 'off_inr_usdt_1',
        buyerId: 'usr_buyer_1',
        sellerId: 'usr_vikram_desk',
        asset: 'USDT',
        fiatCurrency: 'INR',
        cryptoQuantityMicro: 100_000_000,
        grossFiatMinor: 8650_00,
        platformFeeFiatMinor: 86_50,
        sellerNetFiatMinor: 8563_50,
        platformFeeCryptoMicro: 1_000_000,
        unitPriceFiatMinor: 86_50,
        state: 'REFUNDED',
        paymentMethod: 'UPI Instant',
        disputeResolutionNote: 'Admin verified no UPI credit received; refunded seller.',
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
    ],
  });

  assert.equal(vikramTrust.completedTrades, 612);
  assert.ok(vikramTrust.successfulDisputes >= 15);
  assert.equal(vikramTrust.disputeSuccessRatePct, 100);
  assert.ok(vikramTrust.trustScore >= 98.0);
  assert.equal(vikramTrust.trustTier, 'INSTITUTIONAL_PRIME');

  const lowerMerchant = calculateAdvertiserTrustScore({
    makerId: 'usr_new_desk',
    offerCompletedTrades: 45,
    offerCompletionRatePct: 92.5,
  });
  assert.ok(vikramTrust.trustScore > lowerMerchant.trustScore);
});

test('Order Status Badge Descriptors: maps active order states to Escrow Locked, Payment Sent, and Disputed visual badges', () => {
  const lockedPending = getOrderStatusBadgeDescriptor('PAYMENT_PENDING');
  assert.equal(lockedPending.primaryBadgeLabel, 'Escrow Locked');
  assert.equal(lockedPending.secondaryBadgeLabel, 'Awaiting Payment');
  assert.equal(lockedPending.isEscrowLocked, true);
  assert.equal(lockedPending.stepNumber, 2);

  const paymentSent = getOrderStatusBadgeDescriptor('PAYMENT_MARKED_SENT', 'PhonePe-UTR-418920331902');
  assert.equal(paymentSent.primaryBadgeLabel, 'Payment Sent');
  assert.equal(paymentSent.secondaryBadgeLabel, 'Escrow Locked · Timer Frozen');
  assert.equal(paymentSent.isEscrowLocked, true);
  assert.equal(paymentSent.isExpiryFrozen, true);
  assert.equal(paymentSent.stepNumber, 3);
  assert.match(paymentSent.stepSummary, /PhonePe-UTR-418920331902/);

  const disputed = getOrderStatusBadgeDescriptor('DISPUTED');
  assert.equal(disputed.primaryBadgeLabel, 'Disputed · Frozen');
  assert.equal(disputed.isEscrowLocked, true);
  assert.equal(disputed.isExpiryFrozen, true);
});

test('Auto-Price Reflection for BTC, ETH, SOL, USDT & USDC: dynamically computes live fiat prices & valid offer defaults', () => {
  // BTC in India (INR, 86.50 * 67800 = 5,864,700.00 INR)
  const btcInrFixed = calculateAutoUnitPriceFiat({
    asset: 'BTC',
    countryCode: 'IN',
    pricingType: 'FIXED',
  });
  assert.equal(btcInrFixed.fiatCurrency, 'INR');
  assert.equal(btcInrFixed.unitPriceFiatFormatted, '5864700.00');

  // BTC in India with FLOATING (+0.5% = +50 bps -> 5,864,700 * 1.005 = 5,894,023.50 INR)
  const btcInrFloating = calculateAutoUnitPriceFiat({
    asset: 'BTC',
    countryCode: 'IN',
    pricingType: 'FLOATING',
  });
  assert.equal(btcInrFloating.unitPriceFiatFormatted, '5894023.50');

  // BTC in United States (USD, 1.00 * 67800 = 67800.00 USD)
  const btcUsd = calculateAutoUnitPriceFiat({
    asset: 'BTC',
    countryCode: 'US',
    pricingType: 'FIXED',
  });
  assert.equal(btcUsd.fiatCurrency, 'USD');
  assert.equal(btcUsd.unitPriceFiatFormatted, '67800.00');

  // ETH in India (INR, 86.50 * 2620 = 226,630.00 INR)
  const ethInr = calculateAutoUnitPriceFiat({
    asset: 'ETH',
    countryCode: 'IN',
  });
  assert.equal(ethInr.unitPriceFiatFormatted, '226630.00');

  // SOL in India (INR, 86.50 * 156 = 13,494.00 INR)
  const solInr = calculateAutoUnitPriceFiat({
    asset: 'SOL',
    countryCode: 'IN',
  });
  assert.equal(solInr.unitPriceFiatFormatted, '13494.00');

  // Recommended SELL offer defaults for BTC when user has 0.77 BTC available
  const btcDefaults = getRecommendedOfferDefaults({
    asset: 'BTC',
    countryCode: 'IN',
    availableBalanceMicro: parseCryptoToMicro('0.770000'),
    side: 'SELL',
  });
  assert.equal(btcDefaults.unitPriceFiatFormatted, '5864700.00');
  assert.equal(btcDefaults.recommendedQuantityFormatted, '0.250000');
  assert.ok(btcDefaults.recommendedQuantityMicro <= parseCryptoToMicro('0.770000'));
  assert.ok(btcDefaults.minOrderFiatMinor <= btcDefaults.maxOrderFiatMinor);

  // Bidirectional Crypto-to-Fiat calculation when selling 0.10 BTC in INR
  const btcSellBreakdown = calculateFiatFromCryptoQuantity({
    cryptoQuantityInput: '0.100000',
    unitPriceFiatInput: '5864700.00',
    fiatCurrency: 'INR',
    cryptoAsset: 'BTC',
    feeBps: 100,
  });
  assert.equal(btcSellBreakdown.grossFiatFormatted, '586470.00');
  assert.equal(btcSellBreakdown.platformFeeFiatFormatted, '5864.70');
  assert.equal(btcSellBreakdown.sellerNetFiatFormatted, '580605.30');
});

test('Order Categorization & Banking Details Validation: separates Self Buy, Self Sell, and Completed Orders and validates bank accounts', () => {
  const sampleOrders: EscrowOrderRecord[] = [
    {
      id: 'ord_buy_active',
      offerId: 'off_1',
      buyerId: 'usr_alex_trader',
      sellerId: 'usr_vikram_desk',
      asset: 'USDT',
      fiatCurrency: 'INR',
      cryptoQuantityMicro: 100_000_000,
      grossFiatMinor: 8650_00,
      platformFeeFiatMinor: 86_50,
      sellerNetFiatMinor: 8563_50,
      platformFeeCryptoMicro: 1_000_000,
      unitPriceFiatMinor: 86_50,
      state: 'PAYMENT_PENDING',
      paymentMethod: 'PhonePe',
      createdAt: '2026-10-18T01:00:00Z',
      updatedAt: '2026-10-18T01:00:00Z',
    },
    {
      id: 'ord_sell_completed',
      offerId: 'off_2',
      buyerId: 'usr_vikram_desk',
      sellerId: 'usr_alex_trader',
      asset: 'BTC',
      fiatCurrency: 'INR',
      cryptoQuantityMicro: 50_000,
      grossFiatMinor: 293235_00,
      platformFeeFiatMinor: 2932_35,
      sellerNetFiatMinor: 290302_65,
      platformFeeCryptoMicro: 500,
      unitPriceFiatMinor: 5864700_00,
      state: 'COMPLETED',
      paymentMethod: 'IMPS Bank Transfer',
      createdAt: '2026-10-18T02:00:00Z',
      updatedAt: '2026-10-18T02:10:00Z',
    },
  ];

  const cat = categorizeUserOrders(sampleOrders, 'usr_alex_trader');
  assert.equal(cat.allMyOrders.length, 2);
  assert.equal(cat.selfBuyOrders.length, 1);
  assert.equal(cat.selfBuyOrders[0].id, 'ord_buy_active');
  assert.equal(cat.selfSellOrders.length, 1);
  assert.equal(cat.selfSellOrders[0].id, 'ord_sell_completed');
  assert.equal(cat.completedOrders.length, 1);
  assert.equal(cat.completedOrders[0].id, 'ord_sell_completed');
  assert.equal(cat.activeOrders.length, 1);

  const bank = validateAndFormatBankAccount({
    accountHolderName: 'Alex Rivera',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50100293849920',
    ifscOrSwiftCode: 'hdfc0000124',
    accountType: 'SAVINGS',
    branchName: 'Nariman Point, Mumbai',
    fiatCurrency: 'INR',
    linkedUpiId: 'alex.rivera@okhdfcbank',
  });
  assert.equal(bank.accountHolderName, 'Alex Rivera');
  assert.equal(bank.maskedAccountNumber, '•••• 9920');
  assert.equal(bank.ifscOrSwiftCode, 'HDFC0000124');
  assert.equal(bank.linkedUpiId, 'alex.rivera@okhdfcbank');
});

test('ERC-20 & Solana SPL Blockchain Wallet Validation and SIWE/SIWS Challenge Verification', () => {
  const erc20Check = validateBlockchainWalletAddress(
    '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
    'ERC20_EVM'
  );
  assert.equal(erc20Check.valid, true);
  assert.equal(erc20Check.networkFamily, 'ERC20_EVM');
  assert.equal(erc20Check.tokenStandard, 'ERC-20');

  const solanaCheck = validateBlockchainWalletAddress(
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    'SOLANA_SPL'
  );
  assert.equal(solanaCheck.valid, true);
  assert.equal(solanaCheck.networkFamily, 'SOLANA_SPL');
  assert.equal(solanaCheck.tokenStandard, 'SPL (Solana)');

  // Reject Solana address when ERC-20 is expected
  const wrongFamily = validateBlockchainWalletAddress(
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    'ERC20_EVM'
  );
  assert.equal(wrongFamily.valid, false);

  // Create Solana SIWS Challenge and verify signature
  const solChallenge = createWalletChallenge({
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    domain: 'costorah.io',
    nonce: 'sol_nonce_991',
    networkFamily: 'SOLANA_SPL',
    chain: 'Solana Mainnet-Beta (SPL)',
  });
  assert.equal(solChallenge.networkFamily, 'SOLANA_SPL');
  assert.match(solChallenge.message, /SIWS \(Sign-In With Solana SPL\)/);
  assert.match(solChallenge.message, /Costorah/);

  const usedNonces = new Set<string>();
  const verifiedSol = verifyWalletChallenge({
    challenge: solChallenge,
    expectedDomain: 'costorah.io',
    signature: 'sol_siws_ed25519_sig_sol_nonce_991_phantom',
    usedNonces,
  });
  assert.equal(verifiedSol.verified, true);
});

test('User Login & Admin Login (admin / admin) Role-Based Authentication Validation', () => {
  // 1. Admin Login: strictly requires admin / admin
  const validAdmin = verifyAdminCredentials('admin', 'admin');
  assert.equal(validAdmin.authenticated, true);
  assert.equal(validAdmin.role, 'ADMIN');

  const invalidAdmin = verifyAdminCredentials('admin', 'wrongpass');
  assert.equal(invalidAdmin.authenticated, false);
  assert.match(invalidAdmin.error || '', /Invalid administrator credentials/);

  // 2. User Login: authenticates regular USER accounts and blocks admin username on user login
  const sampleUsers = [
    {
      id: 'usr_alex_trader',
      email: 'alex.rivera@costorah.io',
      displayName: 'Alex Rivera (You)',
      role: 'USER' as const,
    },
    {
      id: 'usr_vikram_desk',
      email: 'vikram@mumbai-otc.in',
      displayName: 'Vikram Malhotra OTC',
      role: 'USER' as const,
    },
    {
      id: 'usr_costorah_admin',
      email: 'admin@costorah.io',
      displayName: 'Costorah Chief Arbitrator (Admin)',
      role: 'ADMIN' as const,
    },
  ];

  const userOk = verifyUserCredentials({
    identifier: 'vikram@mumbai-otc.in',
    password: 'user123',
    users: sampleUsers,
  });
  assert.equal(userOk.authenticated, true);
  assert.equal(userOk.user?.id, 'usr_vikram_desk');

  const adminOnUserTab = verifyUserCredentials({
    identifier: 'admin',
    password: 'admin',
    users: sampleUsers,
  });
  assert.equal(adminOnUserTab.authenticated, false);
  assert.match(adminOnUserTab.error || '', /Admin Login/);
});

test('Order Status Sound Notification System: detects transitions to PENDING_PAYMENT and TRADE_COMPLETED with subtle ping profiles', () => {
  // 1. Normalization supports both protocol states ('PAYMENT_PENDING', 'COMPLETED') and aliases ('PENDING_PAYMENT', 'TRADE_COMPLETED')
  assert.equal(normalizeOrderStatusForSoundTrigger('PAYMENT_PENDING'), 'PENDING_PAYMENT');
  assert.equal(normalizeOrderStatusForSoundTrigger('PENDING_PAYMENT'), 'PENDING_PAYMENT');
  assert.equal(normalizeOrderStatusForSoundTrigger('COMPLETED'), 'TRADE_COMPLETED');
  assert.equal(normalizeOrderStatusForSoundTrigger('TRADE_COMPLETED'), 'TRADE_COMPLETED');
  assert.equal(normalizeOrderStatusForSoundTrigger('PAYMENT_MARKED_SENT'), null);
  assert.equal(normalizeOrderStatusForSoundTrigger('DISPUTED'), null);
  assert.equal(normalizeOrderStatusForSoundTrigger('CANCELLED'), null);

  // 2. Acoustic profiles define subtle gain and distinct harmonic frequencies
  const pendingProfile = getSoundPingAcousticProfile('PENDING_PAYMENT');
  const completedProfile = getSoundPingAcousticProfile('TRADE_COMPLETED');
  assert.equal(pendingProfile.statusLabel, 'PENDING_PAYMENT');
  assert.equal(completedProfile.statusLabel, 'TRADE_COMPLETED');
  assert.ok(pendingProfile.peakGain > 0 && pendingProfile.peakGain <= 0.15);
  assert.ok(completedProfile.peakGain > 0 && completedProfile.peakGain <= 0.15);
  assert.notEqual(pendingProfile.primaryFrequencyHz, completedProfile.primaryFrequencyHz);

  // 3. Initial hydration does not mass-ping existing orders, but populates state map
  const initialOrders = [
    { id: 'ord_1', state: 'PAYMENT_PENDING', asset: 'USDT' as const, fiatCurrency: 'INR' as const },
    { id: 'ord_2', state: 'COMPLETED', asset: 'BTC' as const, fiatCurrency: 'INR' as const },
  ];
  const hydrated = detectOrderStatusSoundEvents({}, initialOrders, true, '2026-10-25T07:00:00Z');
  assert.equal(hydrated.events.length, 0);
  assert.equal(hydrated.updatedStateMap['ord_1'], 'PAYMENT_PENDING');
  assert.equal(hydrated.updatedStateMap['ord_2'], 'COMPLETED');

  // 4. Subsequent order creation in PAYMENT_PENDING ('PENDING_PAYMENT') or transition to COMPLETED ('TRADE_COMPLETED') fires ping events
  const updatedOrders = [
    { id: 'ord_1', state: 'COMPLETED', asset: 'USDT' as const, fiatCurrency: 'INR' as const },
    { id: 'ord_2', state: 'COMPLETED', asset: 'BTC' as const, fiatCurrency: 'INR' as const },
    { id: 'ord_3', state: 'PAYMENT_PENDING', asset: 'ETH' as const, fiatCurrency: 'INR' as const },
  ];
  const transitionResult = detectOrderStatusSoundEvents(
    hydrated.updatedStateMap,
    updatedOrders,
    false,
    '2026-10-25T07:05:00Z'
  );
  assert.equal(transitionResult.events.length, 2);

  const ord1Event = transitionResult.events.find((e) => e.orderId === 'ord_1')!;
  assert.equal(ord1Event.trigger, 'TRADE_COMPLETED');
  assert.equal(ord1Event.previousState, 'PAYMENT_PENDING');
  assert.equal(ord1Event.nextState, 'COMPLETED');

  const ord3Event = transitionResult.events.find((e) => e.orderId === 'ord_3')!;
  assert.equal(ord3Event.trigger, 'PENDING_PAYMENT');
  assert.equal(ord3Event.previousState, undefined);
  assert.equal(ord3Event.nextState, 'PAYMENT_PENDING');
});

test('Binance P2P Order Limit Calculator: computes Max Order Limit as Unit Price × Quantity (e.g. 98.00 × 450 = ₹44,100.00) and supports 100 USDT per-transaction split or Single Transaction', () => {
  // 1. User selling 450 USDT at ₹98.00 with 100 USDT per-transaction minimum:
  //    Total & Max Order Limit = 98.00 × 450 = ₹44,100.00
  //    Min Order Limit = 98.00 × 100 = ₹9,800.00
  const splitOrder = calculateBinanceOrderLimits({
    asset: 'USDT',
    unitPriceFiatMinor: parseFiatToMinor('98.00'),
    totalQuantityMicro: parseCryptoToMicro('450.000000'),
    minOrderCryptoMicro: parseCryptoToMicro('100.000000'),
    singleTransactionOnly: false,
  });

  assert.equal(splitOrder.totalOfferFiatFormatted, '44100.00');
  assert.equal(splitOrder.maxOrderFiatFormatted, '44100.00');
  assert.equal(splitOrder.maxOrderCryptoFormatted, '450.000000');
  assert.equal(splitOrder.minOrderFiatFormatted, '9800.00');
  assert.equal(splitOrder.minOrderCryptoFormatted, '100.000000');
  assert.equal(splitOrder.isSingleTransaction, false);

  // 2. Single Transaction mode on 450 USDT @ ₹98.00 locks Min = Max = ₹44,100.00
  const singleTx = calculateBinanceOrderLimits({
    asset: 'USDT',
    unitPriceFiatMinor: parseFiatToMinor('98.00'),
    totalQuantityMicro: parseCryptoToMicro('450.000000'),
    singleTransactionOnly: true,
  });

  assert.equal(singleTx.minOrderFiatFormatted, '44100.00');
  assert.equal(singleTx.maxOrderFiatFormatted, '44100.00');
  assert.equal(singleTx.isSingleTransaction, true);

  // 3. Engine createOffer clamps maxOrderFiatMinor so it never exceeds Unit Price × Quantity
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('usr_seller_98', 'USDT', parseCryptoToMicro('500.000000'), 'dep_98');
  const createdOffer = engine.createOffer({
    id: 'off_binance_450',
    makerId: 'usr_seller_98',
    makerName: 'Binance Style Trader',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('98.00'),
    totalQuantityMicro: parseCryptoToMicro('450.000000'),
    minOrderFiatMinor: parseFiatToMinor('9800.00'),
    maxOrderFiatMinor: parseFiatToMinor('49000.00'), // Higher number passed in must be clamped to 98 * 450 = 44,100.00
    paymentMethods: ['UPI Instant'],
    paymentInstructions: 'UPI only',
  });

  assert.equal(createdOffer.maxOrderFiatMinor, parseFiatToMinor('44100.00'));
  assert.equal(createdOffer.minOrderFiatMinor, parseFiatToMinor('9800.00'));
});

test('Cross-Chain Swap & Withdrawal Engine: swaps ETH, SOL, USDT, USDC, and BNB across BNB Chain (BEP-20), Solana Chain (SPL), and ERC-20 Chain', () => {
  // 1. Validate chain definitions
  assert.equal(SUPPORTED_SWAP_CHAINS.BNB_CHAIN.tokenStandard, 'BEP-20');
  assert.equal(SUPPORTED_SWAP_CHAINS.SOL_CHAIN.tokenStandard, 'SPL');
  assert.equal(SUPPORTED_SWAP_CHAINS.ERC20_CHAIN.tokenStandard, 'ERC-20');

  // 2. Validate destination address rules per chain
  const validBep20 = validateSwapChainDestinationAddress(
    '0x71C95911E9a5D330f4D621842EC243EE1343292e',
    'BNB_CHAIN'
  );
  assert.equal(validBep20.valid, true);

  const validSpl = validateSwapChainDestinationAddress(
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    'SOL_CHAIN'
  );
  assert.equal(validSpl.valid, true);

  const invalidSplOnBnb = validateSwapChainDestinationAddress(
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    'BNB_CHAIN'
  );
  assert.equal(invalidSplOnBnb.valid, false);

  // 3. Execute internal swap (USDT -> BNB on BNB_CHAIN) and external chain withdrawal (ETH -> USDC on ERC20_CHAIN)
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('usr_swapper', 'USDT', parseCryptoToMicro('1000.000000'), 'dep_swap_usdt');
  engine.deposit('usr_swapper', 'ETH', parseCryptoToMicro('2.000000'), 'dep_swap_eth');

  const internalSwap = engine.executeAssetSwap({
    userId: 'usr_swapper',
    fromAsset: 'USDT',
    toAsset: 'BNB',
    fromAmountMicro: parseCryptoToMicro('612.500000'),
    chain: 'BNB_CHAIN',
    settlementMode: 'EXCHANGE_INTERNAL',
    liveRates: { USDT: 1.0, BNB: 612.5 },
    usdInrRate: 94.76,
    idempotencyKey: 'swap_test_1',
  });

  assert.equal(internalSwap.fromAsset, 'USDT');
  assert.equal(internalSwap.toAsset, 'BNB');
  assert.equal(internalSwap.chain, 'BNB_CHAIN');
  assert.ok(internalSwap.toAmountMicro > 990_000); // ~0.9975 BNB after 0.25% swap fee

  const bnbBal = engine.getBalance('usr_swapper', 'BNB');
  assert.equal(bnbBal.availableMicro, internalSwap.toAmountMicro);

  const externalWithdrawSwap = engine.executeAssetSwap({
    userId: 'usr_swapper',
    fromAsset: 'ETH',
    toAsset: 'USDC',
    fromAmountMicro: parseCryptoToMicro('0.500000'),
    chain: 'ERC20_CHAIN',
    settlementMode: 'WITHDRAW_EXTERNAL',
    destinationAddress: '0x94A3B88C9129E001A4421B77E89C001122334455',
    liveRates: { ETH: 2400.0, USDC: 1.0 },
    usdInrRate: 94.76,
    idempotencyKey: 'swap_test_2',
  });

  assert.equal(externalWithdrawSwap.settlementMode, 'WITHDRAW_EXTERNAL');
  assert.equal(externalWithdrawSwap.destinationAddress, '0x94A3B88C9129E001A4421B77E89C001122334455');
  assert.ok(externalWithdrawSwap.toAmountMicro > 1190_000_000);

  // Double-entry reconciliation must remain 100% valid
  const reconciliation = engine.reconcileAllBalances();
  assert.equal(reconciliation.isValid, true);
});

test('$10,000/Day Buy & Sell Limit and Authenticator App TOTP QR Generator: allows >$500 orders up to $10,000/day and generates valid 21x21 QR matrix', () => {
  assert.equal(DAILY_TRADING_LIMIT_USD, 10000);

  // 1. User can create and take an order > $500 (e.g., 2,500 USDT) up to $10,000/day
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('usr_whale_seller', 'USDT', parseCryptoToMicro('5000.000000'), 'dep_whale');
  const largeOffer = engine.createOffer({
    id: 'off_2500_usdt',
    makerId: 'usr_whale_seller',
    makerName: 'Whale Desk',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('90.00'),
    totalQuantityMicro: parseCryptoToMicro('2500.000000'),
    minOrderFiatMinor: parseFiatToMinor('9000.00'),
    maxOrderFiatMinor: parseFiatToMinor('225000.00'), // 2,500 USDT * 90 = ₹225,000
    paymentMethods: ['IMPS Bank Transfer'],
    paymentInstructions: 'Bank transfer',
  });
  assert.equal(largeOffer.maxOrderFiatMinor, parseFiatToMinor('225000.00'));

  const nowIso = new Date().toISOString();
  const sampleOrders: EscrowOrderRecord[] = [
    {
      id: 'ord_buy_2500',
      offerId: 'off_2500_usdt',
      buyerId: 'usr_alex_trader',
      sellerId: 'usr_whale_seller',
      asset: 'USDT',
      fiatCurrency: 'INR',
      cryptoQuantityMicro: parseCryptoToMicro('2500.000000'),
      grossFiatMinor: parseFiatToMinor('225000.00'),
      platformFeeFiatMinor: parseFiatToMinor('2250.00'),
      sellerNetFiatMinor: parseFiatToMinor('222750.00'),
      platformFeeCryptoMicro: parseCryptoToMicro('25.000000'),
      unitPriceFiatMinor: parseFiatToMinor('90.00'),
      state: 'COMPLETED',
      paymentMethod: 'IMPS Bank Transfer',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const buyerStatus = calculateUserDailyLimitStatus(sampleOrders, 'usr_alex_trader');
  assert.equal(buyerStatus.dailyLimitUsd, 10000);
  assert.equal(buyerStatus.dailyBuyUsedUsd, 2500);
  assert.equal(buyerStatus.dailyBuyRemainingUsd, 7500);
  assert.equal(buyerStatus.dailySellUsedUsd, 0);
  assert.equal(buyerStatus.dailySellRemainingUsd, 10000);

  const sellerStatus = calculateUserDailyLimitStatus(sampleOrders, 'usr_whale_seller');
  assert.equal(sellerStatus.dailySellUsedUsd, 2500);
  assert.equal(sellerStatus.dailySellRemainingUsd, 7500);

  // 2. Authenticator App TOTP QR generator produces a deterministic 21x21 QR matrix with finder patterns and 6-digit code
  const totpSetup = generateAuthenticatorSetup('alex.rivera@costorah.io');
  assert.equal(totpSetup.issuer, 'Costorah');
  assert.equal(totpSetup.qrMatrix.length, 21);
  assert.equal(totpSetup.qrMatrix[0].length, 21);
  assert.match(totpSetup.currentSixDigitCode, /^\d{6}$/);
  assert.match(totpSetup.otpauthUri, /^otpauth:\/\/totp\//);
});

test('Published Offer Lifecycle: supports Edit (updateOffer with inventory reserve adjustment), Pause, Resume, and Cancel with removal from active published offers', () => {
  const engine = new EscrowLedgerEngine(100);
  engine.deposit('usr_alex_trader', 'USDT', parseCryptoToMicro('2000.000000'), 'dep_alex_edit');

  const offer = engine.createOffer({
    id: 'off_alex_manage_1',
    makerId: 'usr_alex_trader',
    makerName: 'Alex Rivera (You)',
    side: 'SELL',
    asset: 'USDT',
    fiatCurrency: 'INR',
    unitPriceFiatMinor: parseFiatToMinor('95.00'),
    totalQuantityMicro: parseCryptoToMicro('500.000000'),
    minOrderFiatMinor: parseFiatToMinor('5000.00'),
    maxOrderFiatMinor: parseFiatToMinor('47500.00'),
    paymentMethods: ['PhonePe'],
    paymentInstructions: 'Send via PhonePe',
  });
  assert.equal(offer.status, 'OPEN');

  // Verify initial locked balance is 500 USDT and available is 1500 USDT
  let usdtBal = engine.getBalance('usr_alex_trader', 'USDT');
  assert.equal(usdtBal.availableMicro, parseCryptoToMicro('1500.000000'));
  assert.equal(usdtBal.lockedMicro, parseCryptoToMicro('500.000000'));

  // 1. Edit Offer: increase quantity to 800 USDT and update unit price to 96.50 INR
  const edited = engine.updateOffer({
    offerId: 'off_alex_manage_1',
    actorUserId: 'usr_alex_trader',
    unitPriceFiatMinor: parseFiatToMinor('96.50'),
    availableQuantityMicro: parseCryptoToMicro('800.000000'),
    minOrderFiatMinor: parseFiatToMinor('10000.00'),
    maxOrderFiatMinor: parseFiatToMinor('77200.00'),
    paymentMethods: ['PhonePe', 'Google Pay (GPay)'],
    paymentInstructions: 'Updated instructions',
  });
  assert.equal(edited.unitPriceFiatMinor, parseFiatToMinor('96.50'));
  assert.equal(edited.availableQuantityMicro, parseCryptoToMicro('800.000000'));
  assert.deepEqual(edited.paymentMethods, ['PhonePe', 'Google Pay (GPay)']);

  // Verify additional 300 USDT was locked from available into locked
  usdtBal = engine.getBalance('usr_alex_trader', 'USDT');
  assert.equal(usdtBal.availableMicro, parseCryptoToMicro('1200.000000'));
  assert.equal(usdtBal.lockedMicro, parseCryptoToMicro('800.000000'));

  // 2. Cancel Offer: releases all 800 USDT back to available and marks status as CANCELLED
  const cancelled = engine.cancelOffer('off_alex_manage_1', 'usr_alex_trader');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.availableQuantityMicro, 0);

  usdtBal = engine.getBalance('usr_alex_trader', 'USDT');
  assert.equal(usdtBal.availableMicro, parseCryptoToMicro('2000.000000'));
  assert.equal(usdtBal.lockedMicro, 0);
});

