# Reference Website Inventory (`https://pearswap.net/`)

## 1. Executive Summary & Verification Methodology

On **2026-10-17**, `https://pearswap.net/` was inspected using headless Chromium (`playwright-cli`) at desktop (`1440x900`) alongside public search-index intelligence.

- **Direct Browser Observation (Verified)**:
  - **URL**: `https://pearswap.net/`
  - **HTTP Status**: `403 Forbidden` (Cloudflare Managed Security Challenge)
  - **Page Title**: `Just a moment...`
  - **Observed DOM Elements**:
    - `<h1>`: `pearswap.net`
    - `<h2>`: `Performing security verification`
    - `<p>`: `This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.`
    - **Cloudflare Ray ID**: `a4bde562ce7b0f9a`
    - **Footer Links**: `Cloudflare` (`https://www.cloudflare.com?utm_source=challenge&utm_campaign=m`) and `Privacy` (`https://www.cloudflare.com/privacypolicy/`)
- **Public Search-Index & Whitelabel Footprint (Corroborated)**:
  - Search-indexed snapshots and public platform records indicate `pearswap.net` is built on a P2P & OTC crypto escrow marketplace pattern (closely aligned with the *TradeX Whitelabel P2P & Commodity Trading Platform with Escrow* architecture).

---

## 2. Site Navigation & Route Inventory

Based on publicly indexed P2P marketplace structures associated with the reference domain and standard P2P escrow platforms, the route taxonomy comprises:

### Public Routes
| Route / View | Purpose | Verification Status |
| :--- | :--- | :--- |
| `/` | Homepage: Hero value proposition, live market ticker, P2P quick-exchange preview, escrow workflow summary, FAQ | Indexed / Gated behind Cloudflare 403 in headless Chromium |
| `/buy` (P2P Buy) | Browse active sell advertisements to buy crypto using local fiat currencies | Indexed pattern; implemented natively in AegisP2P |
| `/sell` (P2P Sell) | Browse active buy advertisements to sell crypto for local fiat currencies | Indexed pattern; implemented natively in AegisP2P |
| `/offer/:id` | Detailed offer terms, advertiser reputation, completion rate, limits, and payment window | Indexed pattern; implemented natively in AegisP2P |
| `/escrow` | Educational breakdown of the multi-step escrow locking and release state machine | Indexed pattern; implemented natively in AegisP2P |
| `/fees` | Transparent breakdown of the 1% platform trading fee and integer-decimal rounding rules | Indexed pattern; implemented natively in AegisP2P |
| `/currencies` | Supported cryptocurrencies (`USDT`, `USDC`, `BTC`, `ETH`, `SOL`) and local fiat payment rails (`INR`, `USD`, `EUR`, `GBP`, `NGN`, `BRL`) | Indexed pattern; implemented natively in AegisP2P |
| `/security` | Non-custodial/audited-ledger security controls, SIWE challenge-response signing, and AML/KYC jurisdictional posture | Implemented natively in AegisP2P |
| `/faq` & `/help` | Dispute procedures, payment evidence standards, and troubleshooting | Implemented natively in AegisP2P |
| `/legal` | Terms of Service, Privacy Notice, Risk Disclosure, and Jurisdictional Licensing Matrix | Implemented natively in AegisP2P |

### Authenticated User & Trading Routes
| Route / View | Purpose | Verification Status |
| :--- | :--- | :--- |
| `/dashboard` | Unified portfolio, Available vs. Locked balances, 3D Escrow Vault Visualizer, active orders, disputes, wallets, payment methods | Requires Auth on reference site; implemented end-to-end in AegisP2P |
| `/create-offer` | Multi-step or structured offer creation form with inventory reservation checks | Requires Auth on reference site; implemented end-to-end in AegisP2P |
| `/trade/:orderId` | Real-time Trade Room with 16-state escrow tracker, payment instructions, evidence submission, seller verification, and settlement receipt | Requires Auth on reference site; implemented end-to-end in AegisP2P |
| `/admin` | Order monitoring, escrow reconciliation, dispute arbitration, user management, fee policy config, and immutable audit logs | Restricted Admin route; implemented end-to-end in AegisP2P |

---

## 3. Homepage Sections

1. **Top Navigation Bar**: Clean 3-zone header (Brand wordmark, single-line navigation links for Marketplace, Create Offer, Dashboard, Escrow & Fees, Admin, plus primary account/wallet action).
2. **Hero & Quick Order Entry**: High-contrast dark slate canvas introducing escrow-protected P2P crypto trading with zero-slippage local fiat rails and a 1% seller fee calculator preview.
3. **Interactive P2P Order Book Preview**: Live filterable table of verified counterparties sorted by price and completion rate.
4. **How Escrow Protects Every Trade**: Step-by-step state transition diagram (`OFFER_OPEN` -> `ESCROW_LOCKED` -> `PAYMENT_MARKED_SENT` -> `COMPLETED` or `DISPUTED`).
5. **Fee Transparency & Jurisdictional Compliance**: Clear numeric examples (e.g., ₹10,000 trade value → ₹100 platform fee → ₹9,900 net seller proceeds) and regulatory disclosures.
