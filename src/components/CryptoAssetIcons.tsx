import React from 'react';
import type { CryptoAsset } from '../types';

export interface CryptoAssetMeta {
  symbol: CryptoAsset;
  name: string;
  tagline: string;
  networkLabel: string;
  brandColor: string;
  badgeBg: string;
  usdBenchmarkPrice: number;
  settlementSpeed: string;
}

export const CRYPTO_ASSET_CATALOG: Record<CryptoAsset, CryptoAssetMeta> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    tagline: 'Peer-to-Peer Sound Money Reserve',
    networkLabel: 'Bitcoin L1 / Escrow Custody',
    brandColor: '#F7931A',
    badgeBg: 'rgba(247, 147, 26, 0.14)',
    usdBenchmarkPrice: 67800,
    settlementSpeed: 'Instant Internal Escrow',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    tagline: 'Programmable Smart Settlement Asset',
    networkLabel: 'Ethereum Mainnet / L2',
    brandColor: '#627EEA',
    badgeBg: 'rgba(98, 126, 234, 0.14)',
    usdBenchmarkPrice: 2620,
    settlementSpeed: 'Instant Internal Escrow',
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    tagline: 'High-Throughput Low-Latency Asset',
    networkLabel: 'Solana Mainnet-Beta',
    brandColor: '#14F195',
    badgeBg: 'rgba(20, 241, 149, 0.14)',
    usdBenchmarkPrice: 156,
    settlementSpeed: 'Sub-Second Escrow Lock',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    tagline: 'Global P2P Fiat Corridor Stablecoin',
    networkLabel: 'Multi-Chain (ERC-20 / TRC-20 / SPL)',
    brandColor: '#26A17B',
    badgeBg: 'rgba(38, 161, 123, 0.14)',
    usdBenchmarkPrice: 1.0,
    settlementSpeed: '1:1 USD Peg · Instant',
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB',
    tagline: 'BNB Smart Chain Native Settlement Asset',
    networkLabel: 'BNB Smart Chain (BEP-20)',
    brandColor: '#F3BA2F',
    badgeBg: 'rgba(243, 186, 47, 0.14)',
    usdBenchmarkPrice: 612.5,
    settlementSpeed: '~3s BEP-20 Finality',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    tagline: 'Audited Institutional Digital Dollar',
    networkLabel: 'Multi-Chain (ERC-20 / Solana / Base)',
    brandColor: '#2775CA',
    badgeBg: 'rgba(39, 117, 202, 0.14)',
    usdBenchmarkPrice: 1.0,
    settlementSpeed: '1:1 USD Peg · Instant',
  },
};

export const ALL_CRYPTO_ASSETS: CryptoAsset[] = ['BTC', 'ETH', 'BNB', 'SOL', 'USDT', 'USDC'];

/**
 * Official COSTORAH SVG Brand Emblem (High-Contrast Hexagonal Vault Shield + Bold 'C' Monogram + P2P Settlement Nodes)
 */
export const CostorahLogoIcon: React.FC<{
  className?: string;
}> = ({ className = 'w-11 h-11' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="COSTORAH Official SVG Brand Logo"
    data-testid="costorah-brand-svg-logo"
  >
    <defs>
      <linearGradient id="costorahShieldGrad" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0B65C6" />
        <stop offset="50%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
      <linearGradient id="costorahInnerRim" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
      <linearGradient id="costorahAccentGrad" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#D1FAE5" />
      </linearGradient>
    </defs>
    {/* Outer Hexagonal Vault Shield */}
    <path
      d="M32 3L58 16V42C58 51.8 46.8 58.8 32 61.5C17.2 58.8 6 51.8 6 42V16L32 3Z"
      fill="url(#costorahShieldGrad)"
    />
    {/* Precision Inner Vault Bezel */}
    <path
      d="M32 7.5L53.5 18.2V41.2C53.5 49.2 44.2 55 32 57.2C19.8 55 10.5 49.2 10.5 41.2V18.2L32 7.5Z"
      fill="#061326"
      fillOpacity="0.32"
      stroke="url(#costorahInnerRim)"
      strokeOpacity="0.55"
      strokeWidth="1.8"
    />
    {/* Bold Geometric 'C' Monogram */}
    <path
      d="M42.5 22C39.8 19.1 35.9 17.4 31.5 17.4C23.2 17.4 16.5 23.9 16.5 32C16.5 40.1 23.2 46.6 31.5 46.6C35.9 46.6 39.8 44.9 42.5 42"
      stroke="url(#costorahAccentGrad)"
      strokeWidth="6.4"
      strokeLinecap="round"
    />
    {/* Central Diamond Escrow Lock Core */}
    <polygon
      points="32,24.5 39.5,32 32,39.5 24.5,32"
      fill="#10B981"
      stroke="#FFFFFF"
      strokeWidth="2.2"
    />
    {/* Bidirectional P2P Settlement Nodes */}
    <circle cx="45" cy="23.5" r="3" fill="#34D399" stroke="#FFFFFF" strokeWidth="1.4" />
    <circle cx="45" cy="40.5" r="3" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.4" />
  </svg>
);

export const PRESET_TRADER_AVATARS: { id: string; label: string; url: string }[] = [
  {
    id: 'avatar_costorah_prime',
    label: 'Costorah Prime Vault',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g1" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#0B65C6"/><stop offset="100%" stop-color="#10B981"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g1)"/><circle cx="40" cy="31" r="13" fill="#FFFFFF"/><path d="M18 66C21 53 30 47 40 47C50 47 59 53 62 66" fill="#FFFFFF"/></svg>`
    )}`,
  },
  {
    id: 'avatar_emerald_desk',
    label: 'Emerald OTC Desk',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#059669"/><polygon points="40,14 62,27 62,53 40,66 18,53 18,27" fill="#A7F3D0" fill-opacity="0.25" stroke="#FFFFFF" stroke-width="3"/><circle cx="40" cy="34" r="10" fill="#FFFFFF"/><path d="M24 58C27 48 33 45 40 45C47 45 53 48 56 58" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`
    )}`,
  },
  {
    id: 'avatar_bitcoin_sovereign',
    label: 'Bitcoin Sovereign',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#F7931A"/><circle cx="40" cy="31" r="12" fill="#FFFFFF"/><path d="M20 65C23 52 31 46 40 46C49 46 57 52 60 65" fill="#FFFFFF"/></svg>`
    )}`,
  },
  {
    id: 'avatar_cyber_institutional',
    label: 'Institutional Node',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#1E293B"/><circle cx="40" cy="40" r="32" stroke="#38BDF8" stroke-width="3" fill="none"/><circle cx="40" cy="31" r="11" fill="#38BDF8"/><path d="M22 63C25 51 32 46 40 46C48 46 55 51 58 63" fill="#38BDF8"/></svg>`
    )}`,
  },
];

export const CryptoAssetIcon: React.FC<{
  asset: CryptoAsset;
  className?: string;
}> = ({ asset, className = 'w-8 h-8' }) => {
  switch (asset) {
    case 'BTC':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="Bitcoin BTC Symbol"
        >
          <circle cx="20" cy="20" r="20" fill="#F7931A" />
          <path
            d="M27.3 17.5C27.7 15.1 25.8 13.8 23.3 12.9L24.1 9.6L22.1 9.1L21.3 12.3C20.8 12.2 20.2 12.1 19.7 11.9L20.5 8.7L18.5 8.2L17.7 11.5C17.2 11.4 16.8 11.3 16.4 11.2L13.6 10.5L13.1 12.6C13.1 12.6 14.6 13 14.6 13C15.4 13.2 15.6 13.7 15.5 14.2L14.5 18.1C14.6 18.1 14.8 18.2 15 18.3L14.5 18.2L13.1 23.7C13 24.1 12.6 24.5 11.9 24.3C11.9 24.3 10.5 24 10.5 24L9.5 26.3L12.1 27C12.6 27.1 13.1 27.3 13.6 27.4L12.8 30.7L14.8 31.2L15.6 27.9C16.2 28.1 16.7 28.2 17.2 28.3L16.4 31.6L18.4 32.1L19.2 28.8C22.6 29.4 25.2 29.2 26.3 26.1C27.2 23.6 26.3 22.1 24.5 21.1C25.8 20.8 26.9 19.9 27.3 17.5ZM22.7 24.6C22.1 27.1 17.8 25.7 16.4 25.4L17.5 20.9C18.9 21.3 23.4 22 22.7 24.6ZM23.4 17.4C22.8 19.6 19.2 18.5 18 18.2L19 14.1C20.2 14.4 24 15.1 23.4 17.4Z"
            fill="white"
          />
        </svg>
      );

    case 'ETH':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="Ethereum ETH Symbol"
        >
          <circle cx="20" cy="20" r="20" fill="#627EEA" />
          <polygon points="20,7 20,16.6 28,20.2" fill="white" fillOpacity="0.65" />
          <polygon points="20,7 12,20.2 20,16.6" fill="white" />
          <polygon points="20,26.3 20,33 28,21.8" fill="white" fillOpacity="0.65" />
          <polygon points="20,33 20,26.3 12,21.8" fill="white" />
          <polygon points="20,24.7 28,20.2 20,16.6" fill="white" fillOpacity="0.35" />
          <polygon points="12,20.2 20,24.7 20,16.6" fill="white" fillOpacity="0.8" />
        </svg>
      );

    case 'SOL':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="Solana SOL Symbol"
        >
          <defs>
            <linearGradient id="solGrad" x1="8" y1="32" x2="32" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9945FF" />
              <stop offset="50%" stopColor="#14F195" />
              <stop offset="100%" stopColor="#00C2FF" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="20" fill="#0E1524" />
          <circle cx="20" cy="20" r="19" stroke="url(#solGrad)" strokeWidth="1.5" />
          <path
            d="M12.5 25.5L15 23H28.5L26 25.5H12.5Z"
            fill="url(#solGrad)"
          />
          <path
            d="M12.5 14.5L15 12H28.5L26 14.5H12.5Z"
            fill="url(#solGrad)"
          />
          <path
            d="M28.5 20L26 17.5H12.5L15 20H28.5Z"
            fill="url(#solGrad)"
          />
        </svg>
      );

    case 'USDT':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="Tether USDT Symbol"
        >
          <circle cx="20" cy="20" r="20" fill="#26A17B" />
          <path
            d="M22.2 17.4V14.6H28.5V10.5H11.5V14.6H17.8V17.4C12.4 17.7 8.4 18.6 8.4 19.8C8.4 21 12.4 21.9 17.8 22.2V30.5H22.2V22.2C27.6 21.9 31.6 21 31.6 19.8C31.6 18.6 27.6 17.7 22.2 17.4ZM20 21.1C14.8 21.1 10.6 20.4 10.6 19.5C10.6 18.7 13.9 18.1 17.8 17.9V20.3C18.5 20.3 19.2 20.4 20 20.4C20.8 20.4 21.5 20.3 22.2 20.3V17.9C26.1 18.1 29.4 18.7 29.4 19.5C29.4 20.4 25.2 21.1 20 21.1Z"
            fill="white"
          />
        </svg>
      );

    case 'USDC':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="USD Coin USDC Symbol"
        >
          <circle cx="20" cy="20" r="20" fill="#2775CA" />
          <path
            d="M14.2 11.2C9.8 14.1 8.4 19.9 11 24.5C12 26.2 13.4 27.6 15.1 28.6L16.4 26.5C13.1 24.5 11.9 20.2 13.9 16.9C14.5 15.8 15.4 14.9 16.5 14.3L14.2 11.2Z"
            fill="white"
          />
          <path
            d="M25.8 11.2L23.5 14.3C26.8 16.3 28 20.6 26 23.9C25.4 25 24.5 25.9 23.4 26.5L24.7 28.6C29.1 25.9 30.5 20.1 27.9 15.5C27.3 13.8 26.7 12.4 25.8 11.2Z"
            fill="white"
          />
          <path
            d="M21.2 13V11H18.8V13C16.7 13.3 15.4 14.6 15.4 16.5C15.4 18.6 17 19.6 19.4 20.2C21.3 20.7 22.1 21.2 22.1 22.3C22.1 23.4 21.1 24.1 19.7 24.1C18.2 24.1 17.2 23.4 16.8 22.2L14.8 23.1C15.4 24.8 16.8 25.8 18.8 26.1V28.2H21.2V26.1C23.4 25.8 24.8 24.3 24.8 22.2C24.8 20 23.2 19 20.6 18.4C18.8 17.9 17.9 17.4 17.9 16.4C17.9 15.4 18.8 14.8 20 14.8C21.2 14.8 22.1 15.4 22.5 16.3L24.4 15.3C23.8 13.9 22.7 13.2 21.2 13Z"
            fill="white"
          />
        </svg>
      );

    case 'BNB':
      return (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label="BNB Chain Symbol"
        >
          <circle cx="20" cy="20" r="20" fill="#F3BA2F" />
          <polygon points="20,9.5 24.8,14.3 22.1,17 20,14.9 17.9,17 15.2,14.3" fill="white" />
          <polygon points="27.8,17.3 30.5,20 27.8,22.7 25.1,20" fill="white" />
          <polygon points="12.2,17.3 14.9,20 12.2,22.7 9.5,20" fill="white" />
          <polygon points="20,17.3 22.7,20 20,22.7 17.3,20" fill="white" />
          <polygon points="20,25.1 22.1,23 24.8,25.7 20,30.5 15.2,25.7 17.9,23" fill="white" />
        </svg>
      );
  }
};

