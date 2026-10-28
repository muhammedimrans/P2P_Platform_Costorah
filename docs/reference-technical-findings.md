# Reference Technical Findings (`docs/reference-technical-findings.md`)

## 1. Live Inspection Telemetry (`https://pearswap.net/`)

- **Edge Protection**: Cloudflare Bot Management / Turnstile (`HTTP 403` on automated headless Chromium requests from cloud datacenter IPs; Ray ID `a4bde562ce7b0f9a`).
- **Challenge DOM**: Uses Cloudflare's standard challenge script (`/cdn-cgi/challenge-platform/...`) before serving the underlying web application.
- **Publicly Indexed Application Stack**:
  - Whitelabel P2P/OTC trading template architecture with server-rendered or SPA market tables, relational order-book persistence, and smart-contract/custodial ledger escrow claims.
  - External reputation and consumer-protection monitors highlight the critical importance of verifiable on-chain/ledger escrow proofs, auditable fee deductions, and transparent withdrawal rules in P2P crypto marketplaces.

---

## 2. Production Stack Implemented in This Workspace (`AegisP2P`)

To surpass the reference platform in security, transparency, and verifiability, **AegisP2P** implements:

1. **Full-Stack TypeScript Architecture**:
   - **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Three.js (`three`) interactive 3D Escrow Vault & Cryptographic Node Visualizer in the User Dashboard.
   - **Backend (`server.ts`)**: Express REST API mounted alongside Vite on port `3000`, backed by a persistent transactional ledger store (`data/ledger-db.json` with atomic write-through and in-memory concurrency locks).
2. **Pure Financial & State-Machine Core (`src/core/escrowEngine.ts`)**:
   - Integer minor-unit accounting (`BigInt` / integer basis-point math) for the configurable **1% (100 bps) platform trading fee** so floating-point rounding errors (`0.1 + 0.2 !== 0.3`) can never occur.
   - Formal 16-state transition validator enforcing every invariant (inventory reservation, idempotent release/refund by `idempotencyKey`, dispute freeze, and double-entry balance reconciliation).
3. **Cryptographic Wallet & Account Architecture**:
   - Unified profile supporting Google OAuth sign-in, External Wallet challenge-response signing (EIP-4361 / SIWE format with cryptographic nonce, domain binding, and expiration), and Embedded Wallet creation with client-side recovery phrase verification (private keys/mnemonics never leave the client or touch the backend).
