# Reference Design System & Tokens (`docs/reference-design-system.md`)

## 1. Visual Direction & Philosophy

- **Aesthetic Archetype**: Dark-first institutional fintech & P2P order-book terminal.
- **60-30-10 Color Discipline**:
  - **60% Dominant Neutral Canvas**: Deep charcoal obsidian (`#0B0E14`) and slate (`#0F141C`) backgrounds that reduce eye strain during order-book scanning.
  - **30% Structural Surfaces**: Layered slate panels (`#131A24`, `#18212F`), subtle `1px` hairline borders (`rgba(255, 255, 255, 0.08)`), and high-legibility slate typography (`#F1F5F9` primary, `#94A3B8` secondary, `#64748B` muted).
  - **10% High-Intent Accent Budget**: Restrained emerald (`#10B981` / `#059669`) for primary buy/release actions and verified escrow states; semantic amber (`#F59E0B`) for pending payment windows; semantic crimson (`#EF4444`) for sell actions, disputes, and invalid transitions.

---

## 2. Typography & Tabular Hierarchy

Following the **2+1 Font Rule**:
- **Display & Structural Headings**: `Plus Jakarta Sans` (`600` SemiBold / `700` Bold), tight tracking (`-0.02em`), `text-wrap: balance` on headlines.
- **Dense Interface & Body Copy**: `Public Sans` (`400` Regular / `500` Medium / `600` SemiBold), optimized for scannability at `13px–15px`.
- **Financial Figures, Prices, Nonces & Hashes**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` (`tabular-nums`) so all prices, quantities, fees, and timestamps align vertically down to the decimal point.

### Type Scale
| Token | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `display-hero` | `clamp(2.25rem, 3.8vw, 3.5rem)` | `1.12` | Homepage hero headline |
| `heading-section` | `1.5rem–2rem` (`24px–32px`) | `1.25` | Page and section headers |
| `heading-card` | `1.0625rem` (`17px`) | `1.35` | Panel and modal headers |
| `body-default` | `0.9375rem` (`15px`) | `1.6` | Primary prose and instructions |
| `table-cell` | `0.8125rem` (`13px`) | `1.4` | High-density P2P order book rows |
| `meta-caption` | `0.75rem` (`12px`) | `1.35` | Unboxed metadata with `·` separators |

---

## 3. Spacing, Borders & Elevation

- **Single-Elevation Depth**: Flat dark slate surfaces bounded by `1px solid rgba(255, 255, 255, 0.08)` hairline borders. No nested card-in-card drop shadows or thick left borders (`border-l-4` banned).
- **Zero-Pill Metadata Discipline**: Static metadata (trade counts, completion percentages, payment window durations, timestamps, asset symbols) is rendered as clean, unboxed text separated by middle dots (`·`) or slashes (`/`). Interactive filter tabs and action buttons use crisp `rounded-lg` (`8px`) geometry.
- **Touch & Click Targets**: Minimum `40px` height on desktop, `44px` on mobile viewports (`390x844`).
