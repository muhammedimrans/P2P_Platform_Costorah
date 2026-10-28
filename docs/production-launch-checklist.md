# Production Deployment & Legal/Security Launch Checklist (`docs/production-launch-checklist.md`)

## 1. Architecture & Escrow Custody Model

**AegisP2P** implements a **Hybrid Audited-Ledger + Smart-Contract Escrow Architecture**:
- **Development / Testnet Mode (Active in Workspace)**:
  - Runs against an atomic, double-entry transactional ledger (`src/core/escrowEngine.ts` + `server.ts` persistent store) with simulated EVM Sepolia / Arbitrum Sepolia escrow contract call receipts and verifiable state-machine invariants.
  - All balances are tracked in integer minor units (e.g., `10^6` micro-units for `USDT`/`USDC`, `10^8` satoshis for `BTC`, `10^2` paise/cents for fiat) to eliminate IEEE-754 floating-point drift.
- **Production Mainnet Cutover Requirements**:
  1. Deploy audited `AegisEscrowVault.sol` smart contracts (using OpenZeppelin `ReentrancyGuard`, `Pausable`, `SafeERC20`, and EIP-712 typed signatures) to target chains (Arbitrum One, Polygon POS, Base, Ethereum Mainnet).
  2. Configure dedicated archival RPC nodes with webhook/log indexers requiring finality confirmations (`>= 12` blocks on Ethereum L1, finalized L1 batch on L2s) before transitioning `ESCROW_FUNDING` -> `ESCROW_LOCKED`.
  3. Store arbitrator multi-sig keys in hardware security modules (AWS KMS / Fireblocks / Safe 3-of-5 multi-sig).

---

## 2. Security Verification Checklist

- [x] **Formal 16-State Order State Machine**: Invalid transitions rejected on backend (`assertValidTransition`).
- [x] **No Auto-Release on Buyer Declaration**: Clicking "Mark Paid" only sets `PAYMENT_MARKED_SENT`; crypto remains locked until Seller confirmation or Arbitrator ruling.
- [x] **No Timer Auto-Refund After Fiat Sent**: Orders in `PAYMENT_MARKED_SENT`, `PAYMENT_REVIEW`, or `DISPUTED` cannot expire or auto-cancel.
- [x] **Idempotent Settlements & Fee Deductions**: Every release and refund operation tracks `idempotencyKey` to prevent duplicate payouts or double 1% fee charges.
- [x] **Locked Funds Protection**: Withdrawals and new offers check strictly against `available` balance; `locked` escrow balances cannot be withdrawn or double-pledged.
- [x] **Wallet Challenge Security**: External wallet linking enforces domain binding, single-use cryptographic nonces, and 5-minute TTL expiration.
- [x] **Zero Secret Exposure**: No Google passwords, bank PINs, private keys, or seed phrases are ever transmitted to or logged by the backend.

---

## 3. Legal, Regulatory & Compliance Launch Gate

Before enabling live fiat settlement in any jurisdiction:

1. **Jurisdictional Licensing**:
   - Confirm VASP/MSB/CASP registration in each supported fiat corridor (`INR`, `USD`, `EUR`, `GBP`, `NGN`).
2. **Sanctions & AML Controls**:
   - Integrate real-time wallet screening (Chainalysis / TRM Labs) and OFAC/EU/UN sanctions list checks prior to `ORDER_RESERVED`.
   - Enforce tiered KYC/Identity Verification thresholds per local AML statutes (do not operate an unlicensed no-KYC fiat ramp where prohibited).
3. **Consumer Protection & Tax Reporting**:
   - Provide downloadable settlement receipts with exact 1% fee breakdowns and applicable tax withholding disclosures (e.g. Section 194S 1% TDS in India).
