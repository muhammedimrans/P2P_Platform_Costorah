# Reference Research Limitations & Legal/Security Disclosures (`docs/reference-research-limitations.md`)

## 1. Verification Boundaries on `https://pearswap.net/`

1. **Cloudflare Bot Protection Gate (`HTTP 403`)**:
   - Direct automated browser inspection from the container environment encountered Cloudflare's managed bot challenge (`Ray ID: a4bde562ce7b0f9a`).
   - **Verified Directly**: HTTP status code (`403`), Cloudflare Turnstile challenge DOM, security headers, and challenge behavior.
   - **Corroborated via Public Index**: Core P2P buy/sell offer workflows, escrow claims, and whitelabel P2P template structure.
   - **Unverified / Gated**: Authenticated internal API payloads, private smart-contract bytecode on `pearswap.net`, and live WebSocket message schemas behind the login wall.
2. **Independent Clean-Room Implementation**:
   - All code, design tokens, 3D visualizers, state machines, and ledger accounting in **AegisP2P** are 100% original and independently engineered to strict financial invariants.

---

## 2. Regulatory, KYC/AML & Jurisdictional Compliance Requirements

> **IMPORTANT LEGAL DISCLOSURE**: Low-friction onboarding does **not** exempt a P2P cryptocurrency marketplace from financial regulations. A "no-KYC" business model is **not** legally permitted in every jurisdiction.

Before enabling live fiat-to-crypto trading or deploying smart contracts to mainnet, operators must satisfy:

1. **VASP / MSB Licensing**:
   - **United States**: FinCEN Money Services Business (MSB) registration and state-by-state Money Transmitter Licenses (MTLs) depending on custody and execution model.
   - **European Union**: MiCA (Markets in Crypto-Assets Regulation) Crypto-Asset Service Provider (CASP) authorization.
   - **India**: FIU-IND registration as a Virtual Digital Asset (VDA) Service Provider under PMLA, plus 1% TDS (Tax Deducted at Source) compliance under Section 194S of the Income Tax Act where applicable.
   - **United Kingdom**: FCA cryptoasset registration under the Money Laundering, Terrorist Financing and Transfer of Funds Regulations.
2. **AML, Sanctions & Travel Rule**:
   - Mandatory OFAC / UN / EU / HMT sanctions screening on connected wallet addresses and counterparties.
   - FATF Travel Rule compliance for qualifying virtual asset transfers.
   - Risk-based tiered KYC/CDD triggers before permitting fiat settlement above regulatory thresholds.
3. **Smart Contract & Custody Audits**:
   - Independent third-party security audits of all escrow smart contracts and multi-sig key management procedures before handling real user funds.
