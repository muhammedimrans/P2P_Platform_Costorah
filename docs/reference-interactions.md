# Reference Interactions & User Flows (`docs/reference-interactions.md`)

## 1. Market Discovery & Order Book Filtering

1. **Buy / Sell Mode Switching**:
   - **Buy Tab**: Displays offers created by sellers (`OFFER_TYPE = SELL`) where the user pays local fiat and receives escrowed crypto.
   - **Sell Tab**: Displays offers created by buyers (`OFFER_TYPE = BUY`) where the user locks crypto into escrow and receives local fiat.
2. **Multi-Dimensional Filtering**:
   - Filter by **Cryptocurrency** (`USDT`, `USDC`, `BTC`, `ETH`, `SOL`).
   - Filter by **Fiat Currency** (`INR`, `USD`, `EUR`, `GBP`, `NGN`).
   - Filter by **Fiat Amount** (validates against each offer's `minOrderFiat` and `maxOrderFiat` and available crypto inventory).
   - Filter by **Payment Method** (`UPI`, `IMPS`, `SEPA Instant`, `Faster Payments`, `ACH / FedNow`, `Bank Transfer`).
   - Filter by **Advertiser Name / Verification** and **Availability**.
   - Sort by **Best Price** (lowest ask for Buy, highest bid for Sell), **Completed Trades**, or **Completion Rate**.

---

## 2. Formal 16-State Order & Escrow Lifecycle

Every trade order is governed by a strict backend state machine that rejects unauthorized or out-of-order transitions:

```
DRAFT
  └──> OFFER_OPEN
         └──> ORDER_RESERVED
                └──> ESCROW_FUNDING
                       └──> ESCROW_LOCKED
                              └──> PAYMENT_PENDING
                                     ├──> PAYMENT_MARKED_SENT
                                     │      ├──> PAYMENT_REVIEW
                                     │      │      ├──> RELEASE_PENDING ──> COMPLETED
                                     │      │      └──> DISPUTED
                                     │      ├──> RELEASE_PENDING ──> COMPLETED
                                     │      └──> DISPUTED
                                     ├──> CANCELLED (only before fiat payment is sent)
                                     ├──> EXPIRED (only if payment not marked sent)
                                     └──> DISPUTED
```

### Dispute & Recovery States
- `DISPUTED` -> Freezes all normal release or expiry timers. Only an authorized administrator/arbitrator can transition `DISPUTED` to:
  - `RELEASE_PENDING` -> `COMPLETED` (if buyer proved valid fiat settlement)
  - `REFUND_PENDING` -> `REFUNDED` (if seller proved non-receipt / buyer default)
  - `ESCROW_RECOVERY_REQUIRED` (if on-chain settlement requires manual multi-sig recovery)

---

## 3. Crucial Safety Invariants

1. **No Automatic Release on Buyer Click**: Clicking `"Submit Payment Reference & Mark Paid"` transitions the order to `PAYMENT_MARKED_SENT`, never `COMPLETED`. Only explicit seller verification (or an audited dispute ruling) triggers `RELEASE_PENDING` -> `COMPLETED`.
2. **No Automatic Expiry Refund After Payment Marked Sent**: Once a buyer submits a payment reference (`PAYMENT_MARKED_SENT`), the countdown timer cannot auto-cancel or refund the seller's crypto, preventing seller front-running after fiat has left the buyer's bank.
3. **Real Double-Entry Inventory Locking**: Creating a sell offer or accepting a trade immediately moves the seller's `available` balance into `locked` balance inside an atomic ledger transaction. Locked funds cannot be withdrawn or used to back concurrent offers.
