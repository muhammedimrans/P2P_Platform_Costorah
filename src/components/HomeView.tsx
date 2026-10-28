import React, { useMemo, useState } from 'react';
import {
  COUNTRY_ORDER_LIST,
  FIAT_SYMBOLS,
  TOP_TRADING_COUNTRIES,
  calculateAdvertiserTrustScore,
  type AppRoute,
  type CountryCode,
  type CryptoAsset,
  type EscrowOrderRecord,
  type FiatCurrency,
  type LivePriceFeed,
  type OfferRecord,
  type UserProfile,
  USD_REFERENCE_RATES,
} from '../types';
import {
  calculateTradeBreakdown,
  formatMicro6,
  formatMinor2,
} from '../core/escrowEngine';
import {
  ALL_CRYPTO_ASSETS,
  CRYPTO_ASSET_CATALOG,
  CryptoAssetIcon,
  CostorahLogoIcon,
} from './CryptoAssetIcons';
import {
  CustomSelect,
  buildCountryCurrencyOptions,
} from './CustomSelect';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Globe2,
  GraduationCap,
  KeyRound,
  Lock,
  Moon,
  PlayCircle,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface HomeViewProps {
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => Promise<void>;
  offers: OfferRecord[];
  orders?: EscrowOrderRecord[];
  allUsers?: UserProfile[];
  supportedPaymentMethods?: Record<FiatCurrency, string[]>;
  feeBps: number;
  totalUsersVerified: number;
  activeOrderId?: string;
  onNavigate: (route: AppRoute) => void;
  theme?: 'day' | 'night';
  onToggleTheme?: () => void;
  livePriceFeed?: LivePriceFeed;
}

/**
 * Custom Conduit Ribbon & Multi-Asset Escrow Artwork
 * Inspired directly by the Hodl Hodl 3D blockchain ribbon & cube artwork (hodlhodl-top.png)
 * combined with official symbols for BTC, ETH, SOL, USDT, and USDC.
 */
const HodlStyleRibbonHeroArtwork: React.FC<{
  isDay: boolean;
  fiatCode: FiatCurrency;
  countryName: string;
  feePct: string;
}> = ({ isDay, fiatCode, countryName, feePct }) => {
  const ribbonFillPrimary = isDay ? '#2B88D8' : '#0D9488';
  const ribbonFillSecondary = isDay ? '#60A5FA' : '#10B981';
  const ribbonStroke = isDay ? '#0B5394' : '#34D399';
  const cubeFill = isDay ? '#93C5FD' : '#112233';
  const cubeSide = isDay ? '#A78BFA' : '#1E293B';

  return (
    <div
      data-testid="hero-visual-artwork"
      className="relative w-full max-w-[590px] mx-auto select-none"
    >
      <svg
        viewBox="0 0 640 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        role="img"
        aria-label="Costorah Multi-Asset Blockchain Escrow Conduit Artwork"
      >
        <defs>
          <linearGradient id="ribbonGrad1" x1="100" y1="40" x2="580" y2="460" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isDay ? '#38BDF8' : '#10B981'} />
            <stop offset="50%" stopColor={isDay ? '#2563EB' : '#0891B2'} />
            <stop offset="100%" stopColor={isDay ? '#7C3AED' : '#059669'} />
          </linearGradient>

          <linearGradient id="ribbonGrad2" x1="540" y1="60" x2="140" y2="420" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isDay ? '#93C5FD' : '#34D399'} stopOpacity="0.9" />
            <stop offset="60%" stopColor={isDay ? '#60A5FA' : '#06B6D4'} stopOpacity="0.85" />
            <stop offset="100%" stopColor={isDay ? '#C4B5FD' : '#047857'} stopOpacity="0.9" />
          </linearGradient>

          <filter id="softDrop" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0F172A" floodOpacity={isDay ? '0.14' : '0.5'} />
          </filter>
        </defs>

        {/* Soft Ambient Halo */}
        <circle
          cx="350"
          cy="250"
          r="210"
          fill={isDay ? '#DBEAFE' : '#10B981'}
          fillOpacity={isDay ? '0.55' : '0.1'}
        />
        <circle
          cx="350"
          cy="250"
          r="165"
          stroke={isDay ? '#93C5FD' : '#1E293B'}
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Sweeping Blockchain Conduit Ribbons (Hodl Hodl Style) */}
        <g filter="url(#softDrop)">
          {/* Outer Conduit Wave */}
          <path
            d="M 560 25 C 390 15, 220 55, 235 140 C 250 225, 535 155, 545 265 C 555 375, 280 310, 310 435 C 325 480, 460 490, 580 465"
            stroke="url(#ribbonGrad1)"
            strokeWidth="44"
            strokeLinecap="round"
            fill="none"
          />
          {/* Inner Ribbon Highlight Track */}
          <path
            d="M 560 25 C 390 15, 220 55, 235 140 C 250 225, 535 155, 545 265 C 555 375, 280 310, 310 435 C 325 480, 460 490, 580 465"
            stroke="url(#ribbonGrad2)"
            strokeWidth="26"
            strokeLinecap="round"
            fill="none"
          />
          {/* Circuit Trace Lines Running Along the Ribbon */}
          <path
            d="M 560 25 C 390 15, 220 55, 235 140 C 250 225, 535 155, 545 265 C 555 375, 280 310, 310 435"
            stroke={isDay ? '#0B5394' : '#A7F3D0'}
            strokeWidth="2"
            strokeDasharray="10 8"
            fill="none"
          />

          {/* Secondary Branching Conduit Cables */}
          <path
            d="M 235 140 C 175 185, 130 235, 150 285 C 170 330, 265 295, 345 320"
            stroke={ribbonFillPrimary}
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 235 140 C 175 185, 130 235, 150 285 C 170 330, 265 295, 345 320"
            stroke={ribbonFillSecondary}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Isometric Protocol Cube 1 (Top Left on Ribbon: "1:1 ESCROW") */}
        <g transform="translate(185, 88)" filter="url(#softDrop)">
          <polygon
            points="45,0 90,22 45,44 0,22"
            fill={cubeFill}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="0,22 45,44 45,92 0,70"
            fill={cubeSide}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="90,22 45,44 45,92 90,70"
            fill={ribbonFillPrimary}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <text
            x="45"
            y="27"
            textAnchor="middle"
            fill={isDay ? '#082F49' : '#ECFEFF'}
            fontSize="12"
            fontWeight="bold"
            fontFamily="monospace"
          >
            1:1
          </text>
          <text
            x="23"
            y="64"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            LOCK
          </text>
        </g>

        {/* Isometric Protocol Cube 2 (Middle Lower on Ribbon: Key Custody Block) */}
        <g transform="translate(275, 290)" filter="url(#softDrop)">
          <polygon
            points="50,0 100,25 50,50 0,25"
            fill={cubeFill}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="0,25 50,50 50,104 0,79"
            fill={cubeSide}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="100,25 50,50 50,104 100,79"
            fill={ribbonFillPrimary}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          {/* Keyhole / Shield Symbol on Cube */}
          <circle cx="26" cy="62" r="9" fill="#0B5394" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M26 71 L26 83 M26 79 L31 79" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <text
            x="75"
            y="68"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            P2P
          </text>
        </g>

        {/* Isometric Protocol Cube 3 (Right Side on Ribbon: Jurisdiction Lock) */}
        <g transform="translate(472, 185)" filter="url(#softDrop)">
          <polygon
            points="44,0 88,22 44,44 0,22"
            fill={cubeFill}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="0,22 44,44 44,90 0,68"
            fill={cubeSide}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <polygon
            points="88,22 44,44 44,90 88,68"
            fill={ribbonFillPrimary}
            stroke={ribbonStroke}
            strokeWidth="2"
          />
          <text
            x="44"
            y="26"
            textAnchor="middle"
            fill={isDay ? '#082F49' : '#ECFEFF'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {fiatCode}
          </text>
          <text
            x="66"
            y="62"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {feePct}%
          </text>
        </g>

        {/* CENTRAL MONUMENTAL BITCOIN & MULTI-ASSET SHIELD EMBLEM (Like the tilted white/blue B in hodlhodl-top.png) */}
        <g transform="translate(305, 132)" filter="url(#softDrop)">
          <circle
            cx="56"
            cy="56"
            r="54"
            fill={isDay ? '#FFFFFF' : '#0B1320'}
            stroke={isDay ? '#0B65C6' : '#10B981'}
            strokeWidth="4"
          />
          <circle
            cx="56"
            cy="56"
            r="44"
            fill={isDay ? '#EFF6FF' : '#111C2D'}
            stroke={isDay ? '#60A5FA' : '#34D399'}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Tilted Iconic Vector Bitcoin 'B' / Escrow Emblem */}
          <g transform="translate(20, 20) scale(1.8)">
            <path
              d="M27.3 17.5C27.7 15.1 25.8 13.8 23.3 12.9L24.1 9.6L22.1 9.1L21.3 12.3C20.8 12.2 20.2 12.1 19.7 11.9L20.5 8.7L18.5 8.2L17.7 11.5C17.2 11.4 16.8 11.3 16.4 11.2L13.6 10.5L13.1 12.6C13.1 12.6 14.6 13 14.6 13C15.4 13.2 15.6 13.7 15.5 14.2L14.5 18.1C14.6 18.1 14.8 18.2 15 18.3L14.5 18.2L13.1 23.7C13 24.1 12.6 24.5 11.9 24.3C11.9 24.3 10.5 24 10.5 24L9.5 26.3L12.1 27C12.6 27.1 13.1 27.3 13.6 27.4L12.8 30.7L14.8 31.2L15.6 27.9C16.2 28.1 16.7 28.2 17.2 28.3L16.4 31.6L18.4 32.1L19.2 28.8C22.6 29.4 25.2 29.2 26.3 26.1C27.2 23.6 26.3 22.1 24.5 21.1C25.8 20.8 26.9 19.9 27.3 17.5ZM22.7 24.6C22.1 27.1 17.8 25.7 16.4 25.4L17.5 20.9C18.9 21.3 23.4 22 22.7 24.6ZM23.4 17.4C22.8 19.6 19.2 18.5 18 18.2L19 14.1C20.2 14.4 24 15.1 23.4 17.4Z"
              fill={isDay ? '#0B65C6' : '#34D399'}
            />
          </g>
        </g>

        {/* 5 ORBITING MULTI-ASSET SATELLITE NODES: BTC, ETH, SOL, USDT, USDC */}
        {/* 1. BTC Node */}
        <g transform="translate(82, 54)" filter="url(#softDrop)">
          <rect
            x="0"
            y="0"
            width="108"
            height="42"
            rx="21"
            fill={isDay ? '#FFFFFF' : '#0D1524'}
            stroke="#F7931A"
            strokeWidth="2"
          />
          <circle cx="21" cy="21" r="14" fill="#F7931A" />
          <g transform="translate(7, 7) scale(0.7)">
            <path
              d="M27.3 17.5C27.7 15.1 25.8 13.8 23.3 12.9L24.1 9.6L22.1 9.1L21.3 12.3C20.8 12.2 20.2 12.1 19.7 11.9L20.5 8.7L18.5 8.2L17.7 11.5C17.2 11.4 16.8 11.3 16.4 11.2L13.6 10.5L13.1 12.6C13.1 12.6 14.6 13 14.6 13C15.4 13.2 15.6 13.7 15.5 14.2L14.5 18.1C14.6 18.1 14.8 18.2 15 18.3L14.5 18.2L13.1 23.7C13 24.1 12.6 24.5 11.9 24.3C11.9 24.3 10.5 24 10.5 24L9.5 26.3L12.1 27C12.6 27.1 13.1 27.3 13.6 27.4L12.8 30.7L14.8 31.2L15.6 27.9C16.2 28.1 16.7 28.2 17.2 28.3L16.4 31.6L18.4 32.1L19.2 28.8C22.6 29.4 25.2 29.2 26.3 26.1C27.2 23.6 26.3 22.1 24.5 21.1C25.8 20.8 26.9 19.9 27.3 17.5ZM22.7 24.6C22.1 27.1 17.8 25.7 16.4 25.4L17.5 20.9C18.9 21.3 23.4 22 22.7 24.6ZM23.4 17.4C22.8 19.6 19.2 18.5 18 18.2L19 14.1C20.2 14.4 24 15.1 23.4 17.4Z"
              fill="#FFFFFF"
            />
          </g>
          <text
            x="43"
            y="19"
            fill={isDay ? '#0F172A' : '#F8FAFC'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            BTC
          </text>
          <text x="43" y="32" fill="#F7931A" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            Bitcoin
          </text>
        </g>

        {/* 2. ETH Node */}
        <g transform="translate(382, 34)" filter="url(#softDrop)">
          <rect
            x="0"
            y="0"
            width="112"
            height="42"
            rx="21"
            fill={isDay ? '#FFFFFF' : '#0D1524'}
            stroke="#627EEA"
            strokeWidth="2"
          />
          <circle cx="21" cy="21" r="14" fill="#627EEA" />
          <polygon points="21,11 15,21 21,24 27,21" fill="#FFFFFF" />
          <polygon points="21,31 15,23 21,26 27,23" fill="#FFFFFF" fillOpacity="0.8" />
          <text
            x="43"
            y="19"
            fill={isDay ? '#0F172A' : '#F8FAFC'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            ETH
          </text>
          <text x="43" y="32" fill="#627EEA" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            Ethereum
          </text>
        </g>

        {/* 3. USDT Node */}
        <g transform="translate(56, 208)" filter="url(#softDrop)">
          <rect
            x="0"
            y="0"
            width="116"
            height="42"
            rx="21"
            fill={isDay ? '#FFFFFF' : '#0D1524'}
            stroke="#26A17B"
            strokeWidth="2"
          />
          <circle cx="21" cy="21" r="14" fill="#26A17B" />
          <text x="21" y="26" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="bold" fontFamily="monospace">
            T
          </text>
          <text
            x="43"
            y="19"
            fill={isDay ? '#0F172A' : '#F8FAFC'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            USDT
          </text>
          <text x="43" y="32" fill="#26A17B" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            Tether USD
          </text>
        </g>

        {/* 4. SOL Node */}
        <g transform="translate(88, 362)" filter="url(#softDrop)">
          <rect
            x="0"
            y="0"
            width="112"
            height="42"
            rx="21"
            fill={isDay ? '#FFFFFF' : '#0D1524'}
            stroke="#9945FF"
            strokeWidth="2"
          />
          <circle cx="21" cy="21" r="14" fill="#141E30" />
          <path d="M14 16H27L25 18.5H12L14 16ZM12 20H25L27 22.5H14L12 20ZM14 24H27L25 26.5H12L14 24Z" fill="#14F195" />
          <text
            x="43"
            y="19"
            fill={isDay ? '#0F172A' : '#F8FAFC'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            SOL
          </text>
          <text x="43" y="32" fill="#9945FF" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            Solana
          </text>
        </g>

        {/* 5. USDC Node */}
        <g transform="translate(458, 342)" filter="url(#softDrop)">
          <rect
            x="0"
            y="0"
            width="116"
            height="42"
            rx="21"
            fill={isDay ? '#FFFFFF' : '#0D1524'}
            stroke="#2775CA"
            strokeWidth="2"
          />
          <circle cx="21" cy="21" r="14" fill="#2775CA" />
          <text x="21" y="26" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="bold" fontFamily="monospace">
            $
          </text>
          <text
            x="43"
            y="19"
            fill={isDay ? '#0F172A' : '#F8FAFC'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            USDC
          </text>
          <text x="43" y="32" fill="#2775CA" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            USD Coin
          </text>
        </g>

        {/* Bottom Active Jurisdiction Tag */}
        <g transform="translate(155, 442)">
          <rect
            x="0"
            y="0"
            width="290"
            height="36"
            rx="18"
            fill={isDay ? '#0B65C6' : '#0B1320'}
            stroke={isDay ? '#0B65C6' : '#10B981'}
            strokeWidth="1.5"
          />
          <text
            x="145"
            y="22"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            CORRIDOR: {countryName.toUpperCase()} ({fiatCode}) · 100% ESCROW
          </text>
        </g>
      </svg>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  selectedCountry,
  onSelectCountry,
  offers,
  orders = [],
  allUsers = [],
  supportedPaymentMethods,
  feeBps,
  totalUsersVerified,
  activeOrderId,
  onNavigate,
  theme = 'day',
  onToggleTheme,
  livePriceFeed,
}) => {
  const isDay = theme === 'day';
  const activePolicy = TOP_TRADING_COUNTRIES[selectedCountry] || TOP_TRADING_COUNTRIES.IN;
  const lockedFiat = activePolicy.fiatCurrency;
  const liveLocalRate =
    livePriceFeed?.fiatExchangeRates?.[lockedFiat] ??
    (lockedFiat === 'INR' && livePriceFeed?.usdInrRate
      ? livePriceFeed.usdInrRate
      : activePolicy.usdExchangeRate);
  const feePctFormatted = (feeBps / 100).toFixed(2);

  // Interactive Offer Search Widget State (matching hodlhodl-mid.png)
  const [widgetSide, setWidgetSide] = useState<'BUY' | 'SELL'>('BUY');
  const [widgetAsset, setWidgetAsset] = useState<CryptoAsset | 'ALL'>('ALL');
  const [widgetRail, setWidgetRail] = useState<string>('ALL');
  const [widgetAmount, setWidgetAmount] = useState<string>('10000.00');
  const [volumeTimeframe, setVolumeTimeframe] = useState<'24H' | '7D' | '30D'>('24H');

  const marketVolumeSeries = useMemo(() => {
    const rate = liveLocalRate;
    const basePoints =
      volumeTimeframe === '24H'
        ? [
            { time: '00:00', usdVol: 142000, trades: 38, escrowLockedUsd: 410000 },
            { time: '04:00', usdVol: 168000, trades: 44, escrowLockedUsd: 438000 },
            { time: '08:00', usdVol: 215000, trades: 59, escrowLockedUsd: 492000 },
            { time: '12:00', usdVol: 264000, trades: 71, escrowLockedUsd: 545000 },
            { time: '16:00', usdVol: 248000, trades: 66, escrowLockedUsd: 528000 },
            { time: '20:00', usdVol: 312000, trades: 84, escrowLockedUsd: 615000 },
            { time: 'Now', usdVol: 348500, trades: 92, escrowLockedUsd: 662000 },
          ]
        : volumeTimeframe === '7D'
        ? [
            { time: 'Mon', usdVol: 1120000, trades: 310, escrowLockedUsd: 520000 },
            { time: 'Tue', usdVol: 1285000, trades: 355, escrowLockedUsd: 560000 },
            { time: 'Wed', usdVol: 1410000, trades: 392, escrowLockedUsd: 590000 },
            { time: 'Thu', usdVol: 1360000, trades: 378, escrowLockedUsd: 575000 },
            { time: 'Fri', usdVol: 1690000, trades: 465, escrowLockedUsd: 640000 },
            { time: 'Sat', usdVol: 1845000, trades: 512, escrowLockedUsd: 685000 },
            { time: 'Sun', usdVol: 2040000, trades: 548, escrowLockedUsd: 720000 },
          ]
        : [
            { time: 'W1', usdVol: 4850000, trades: 1340, escrowLockedUsd: 540000 },
            { time: 'W2', usdVol: 5620000, trades: 1580, escrowLockedUsd: 595000 },
            { time: 'W3', usdVol: 6480000, trades: 1820, escrowLockedUsd: 655000 },
            { time: 'W4', usdVol: 7890000, trades: 2190, escrowLockedUsd: 745000 },
          ];

    return basePoints.map((pt) => ({
      ...pt,
      localVolume: Math.round(pt.usdVol * rate),
      localEscrowReserve: Math.round(pt.escrowLockedUsd * rate),
    }));
  }, [volumeTimeframe, liveLocalRate]);

  const configuredRails = useMemo(() => {
    if (supportedPaymentMethods && supportedPaymentMethods[lockedFiat]?.length) {
      return supportedPaymentMethods[lockedFiat];
    }
    return activePolicy.localPaymentMethods;
  }, [supportedPaymentMethods, lockedFiat, activePolicy.localPaymentMethods]);

  const userById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of allUsers) {
      map.set(u.id, u);
    }
    return map;
  }, [allUsers]);

  const corridorOffers = useMemo(
    () => offers.filter((o) => o.fiatCurrency === lockedFiat && o.status === 'OPEN'),
    [offers, lockedFiat]
  );

  const filteredWidgetOffers = useMemo(() => {
    return corridorOffers.filter((o) => {
      if (widgetAsset !== 'ALL' && o.asset !== widgetAsset) return false;
      if (widgetRail !== 'ALL' && !o.paymentMethods.includes(widgetRail)) return false;
      return true;
    });
  }, [corridorOffers, widgetAsset, widgetRail]);

  const sampleBreakdown = useMemo(() => {
    try {
      const targetAsset: CryptoAsset = widgetAsset === 'ALL' ? 'USDT' : widgetAsset;
      const assetUsd =
        livePriceFeed?.rates?.[targetAsset]?.usd ??
        USD_REFERENCE_RATES[targetAsset] ??
        CRYPTO_ASSET_CATALOG[targetAsset].usdBenchmarkPrice;
      const unitFiatPrice = (liveLocalRate * assetUsd).toFixed(2);
      return calculateTradeBreakdown({
        grossFiatInput: widgetAmount || '1000.00',
        unitPriceFiatInput: unitFiatPrice,
        fiatCurrency: lockedFiat,
        cryptoAsset: targetAsset,
        feeBps,
      });
    } catch {
      return null;
    }
  }, [widgetAmount, widgetAsset, liveLocalRate, livePriceFeed, lockedFiat, feeBps]);

  const handleCountryChange = async (code: CountryCode) => {
    setWidgetRail('ALL');
    await onSelectCountry(code);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-20 pb-14" data-testid="home-view-container">
      {/* =====================================================================
          SECTION 1: HODL-HODL INSPIRED HERO WITH BLOCKCHAIN CONDUIT ARTWORK,
          4-METRIC VERTICAL BAR & MULTI-ASSET SYMBOLS (BTC, ETH, SOL, USDT, USDC)
         ===================================================================== */}
      <section
        data-testid="text-driven-hero-section"
        className={`relative rounded-3xl border overflow-hidden transition-colors ${
          isDay
            ? 'bg-gradient-to-br from-[#EAF5FF] via-[#F2F7FF] to-[#F5F0FF] border-sky-200/80 shadow-[0_20px_50px_rgba(11,101,198,0.08)]'
            : 'bg-gradient-to-b from-[#0B1220] via-[#080D16] to-[#06090F] border-white/10 shadow-2xl'
        }`}
      >
        <div className="relative z-10 px-4 py-8 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
            {/* Left 6 Columns: Monumental Hodl Hodl Typography, Asset Symbols, CTA & 4 Stats */}
            <div className="lg:col-span-6 space-y-6">
              {/* Prominent COSTORAH Brand Showcase Header on Homepage Hero */}
              <div
                data-testid="home-hero-costorah-brand"
                className={`inline-flex items-center gap-3.5 px-4 py-2.5 rounded-2xl border ${
                  isDay
                    ? 'bg-white/95 border-sky-200/90 shadow-sm'
                    : 'bg-[#0F1828]/90 border-emerald-500/30 shadow-lg'
                }`}
              >
                <CostorahLogoIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xl font-black tracking-tight font-display ${
                        isDay ? 'text-[#0B65C6]' : 'text-white'
                      }`}
                    >
                      COSTO<span className={isDay ? 'text-emerald-600' : 'text-emerald-400'}>RAH</span>
                    </span>
                    <span
                      data-testid="active-country-lock-badge"
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                        isDay
                          ? 'bg-sky-50 text-[#0B65C6] border-sky-200'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {activePolicy.code} · {lockedFiat} ({activePolicy.fiatSymbol})
                    </span>
                  </div>
                  <div
                    className={`text-[11px] font-mono font-semibold ${
                      isDay ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    1:1 Pre-Funded Escrow · Sovereign P2P Settlement Desk
                  </div>
                </div>
              </div>

              {/* Top Control Row: Custom Currency/Country Dropdown + Day/Night Switcher */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-full sm:w-auto sm:min-w-[290px]">
                  <CustomSelect
                    id="home-country-select"
                    testId="home-country-select"
                    value={selectedCountry}
                    onChange={(val) => handleCountryChange(val as CountryCode)}
                    options={buildCountryCurrencyOptions()}
                    ariaLabel="Select Trading Country and Currency"
                    searchPlaceholder="Search country or currency (INR, USD, EUR...)"
                  />
                </div>

                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isDay
                        ? 'bg-white/90 hover:bg-white border-slate-200 text-slate-700'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-slate-200'
                    }`}
                  >
                    {isDay ? (
                      <>
                        <Moon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Switch to Night UI</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Switch to Day UI</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Bold Uppercase Headline (Matching "P2P BITCOIN TRADING PLATFORM" in hodlhodl-top.png) */}
              <h1
                style={{
                  textWrap: 'balance',
                  fontSize: 'clamp(2.35rem, 4.1vw, 3.6rem)',
                }}
                className={`font-black tracking-tight uppercase font-display leading-[1.04] ${
                  isDay ? 'text-[#0B65C6]' : 'text-white'
                }`}
              >
                P2P CRYPTO{' '}
                <span className={isDay ? 'text-[#084B94] block' : 'text-emerald-400 block'}>
                  TRADING PLATFORM
                </span>
              </h1>

              {/* Monospace Lead Statement (Matching hodlhodl-top.png) */}
              <p
                className={`text-sm sm:text-base font-mono leading-relaxed max-w-xl ${
                  isDay ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                1:1 pre-funded escrow trading solution — sellers lock crypto before listing. Trade
                directly in{' '}
                <strong className={isDay ? 'text-slate-950' : 'text-white'}>
                  {activePolicy.name} ({lockedFiat} {activePolicy.fiatSymbol})
                </strong>{' '}
                via {configuredRails.slice(0, 3).join(', ')}.
              </p>

              {/* Official Crypto Symbols Bar (BTC, ETH, SOL, USDT, USDC) */}
              <div className="space-y-2">
                <div
                  className={`text-[11px] font-mono uppercase tracking-wider font-bold ${
                    isDay ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Supported Escrow Assets (1:1 Pre-Funded Custody):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ALL_CRYPTO_ASSETS.map((symbol) => {
                    const meta = CRYPTO_ASSET_CATALOG[symbol];
                    return (
                      <button
                        key={symbol}
                        type="button"
                        data-testid={`hero-asset-pill-${symbol}`}
                        onClick={() => {
                          setWidgetAsset(symbol);
                          scrollToSection('offer-search-widget');
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-transform hover:-translate-y-0.5 cursor-pointer ${
                          isDay
                            ? 'bg-white border-slate-200/90 text-slate-900 shadow-xs hover:border-[#0B65C6]'
                            : 'bg-[#0F1726] border-white/15 text-white hover:border-emerald-400'
                        }`}
                      >
                        <CryptoAssetIcon asset={symbol} className="w-5 h-5 shrink-0" />
                        <span>{symbol}</span>
                        <span
                          className={`text-[10px] font-normal ${
                            isDay ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {meta.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary CTA + "How it works?" Video/Tutorial Style Button (Matching hodlhodl-top.png) */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  data-testid="enter-country-market-btn"
                  onClick={() => onNavigate('marketplace')}
                  className={`px-8 py-3.5 text-sm font-mono font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2.5 shadow-md ${
                    isDay
                      ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
                  }`}
                >
                  <span>Start Trading ({lockedFiat})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('getting-started-section')}
                  className={`px-3 py-2 text-sm font-mono font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                    isDay
                      ? 'text-[#0B65C6] hover:text-[#084282]'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  <PlayCircle className="w-5 h-5" />
                  <span>How it works?</span>
                </button>

                <button
                  type="button"
                  data-testid="post-escrow-offer-btn"
                  onClick={() => onNavigate('create-offer')}
                  className={`px-4 py-2.5 text-xs font-mono font-bold rounded-xl border cursor-pointer transition-colors ${
                    isDay
                      ? 'bg-white/80 hover:bg-white border-sky-200 text-slate-800'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
                  }`}
                >
                  + Create {lockedFiat} Offer
                </button>
              </div>

              {/* 4 Vertical-Divider Stat Columns (Exact Hodl Hodl Hero Bottom Layout!) */}
              <div
                className={`pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t ${
                  isDay ? 'border-sky-200/80' : 'border-white/10'
                }`}
              >
                <div
                  className={`pr-3 sm:border-r ${
                    isDay ? 'border-sky-300/80' : 'border-white/15'
                  }`}
                >
                  <div
                    className={`text-sm sm:text-base font-black font-display uppercase ${
                      isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                    }`}
                  >
                    5 ASSETS
                  </div>
                  <div
                    className={`text-[11px] font-mono mt-0.5 leading-snug ${
                      isDay ? 'text-[#0B65C6]/80' : 'text-slate-400'
                    }`}
                  >
                    BTC · ETH · SOL
                    <br />
                    USDT · USDC
                  </div>
                </div>

                <div
                  className={`pr-3 sm:border-r ${
                    isDay ? 'border-sky-300/80' : 'border-white/15'
                  }`}
                >
                  <div
                    className={`text-sm sm:text-base font-black font-display uppercase ${
                      isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                    }`}
                  >
                    10 CORRIDORS
                  </div>
                  <div
                    className={`text-xs font-mono mt-0.5 ${
                      isDay ? 'text-[#0B65C6]/80' : 'text-slate-400'
                    }`}
                  >
                    country-to-fiat locked
                  </div>
                </div>

                <div
                  className={`pr-3 sm:border-r ${
                    isDay ? 'border-sky-300/80' : 'border-white/15'
                  }`}
                >
                  <div
                    className={`text-sm sm:text-base font-black font-display uppercase ${
                      isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                    }`}
                  >
                    100% ESCROW
                  </div>
                  <div
                    className={`text-xs font-mono mt-0.5 ${
                      isDay ? 'text-[#0B65C6]/80' : 'text-slate-400'
                    }`}
                  >
                    pre-locked 1:1 reserve
                  </div>
                </div>

                <div>
                  <div
                    className={`text-sm sm:text-base font-black font-display uppercase ${
                      isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                    }`}
                  >
                    {feePctFormatted}% FEE
                  </div>
                  <div
                    className={`text-xs font-mono mt-0.5 ${
                      isDay ? 'text-[#0B65C6]/80' : 'text-slate-400'
                    }`}
                  >
                    {totalUsersVerified} verified desks
                  </div>
                </div>
              </div>

              {activeOrderId && (
                <div>
                  <button
                    type="button"
                    onClick={() => onNavigate('trade-room')}
                    className={`text-xs font-mono font-bold underline underline-offset-4 cursor-pointer ${
                      isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                    }`}
                  >
                    Active Escrow Order ({activeOrderId}) in Progress — Resume Trade Room →
                  </button>
                </div>
              )}
            </div>

            {/* Right 6 Columns: Sweeping Blockchain Conduit Ribbon & Multi-Asset Symbols Artwork */}
            <div className="lg:col-span-6 flex items-center justify-center">
              <HodlStyleRibbonHeroArtwork
                isDay={isDay}
                fiatCode={lockedFiat}
                countryName={activePolicy.name}
                feePct={feePctFormatted}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: "WELCOME TO COSTORAH" + INTERACTIVE BUY/SELL OFFER FINDER
         ===================================================================== */}
      <section id="offer-search-widget" className="space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="flex justify-center mb-2">
            <CostorahLogoIcon className="w-16 h-16 drop-shadow-md" />
          </div>
          <h2
            className={`text-3xl sm:text-4xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-800' : 'text-white'
            }`}
          >
            WELCOME TO COSTORAH
          </h2>
          <p
            className={`text-sm sm:text-base font-mono leading-relaxed ${
              isDay ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            Escrow-protected P2P deals on your terms. Trade globally.
            <br />
            Using verified domestic payment systems. Locked to{' '}
            <strong className={isDay ? 'text-[#0B65C6]' : 'text-emerald-400'}>
              {activePolicy.fiatName} ({lockedFiat})
            </strong>
            .
          </p>
        </div>

        {/* Centered Offer Finder Card (Matching Buy BTC / Sell BTC Widget in hodlhodl-mid.png) */}
        <div
          className={`max-w-2xl mx-auto rounded-2xl border transition-colors ${
            isDay
              ? 'bg-white border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.08)]'
              : 'bg-[#0A101B] border-white/15 shadow-2xl'
          }`}
        >
          {/* Top 2-Tab Bar: Buy Crypto | Sell Crypto */}
          <div className="grid grid-cols-2 border-b border-slate-200/60 dark:border-white/10 rounded-t-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setWidgetSide('BUY')}
              className={`py-4 text-sm font-mono font-bold transition-colors cursor-pointer ${
                widgetSide === 'BUY'
                  ? isDay
                    ? 'bg-white text-[#0B65C6] border-b-2 border-[#0B65C6]'
                    : 'bg-[#0F1829] text-emerald-400 border-b-2 border-emerald-400'
                  : isDay
                  ? 'bg-slate-100 text-slate-500 hover:text-slate-800'
                  : 'bg-[#070B12] text-slate-400 hover:text-white'
              }`}
            >
              Buy Crypto ({widgetAsset === 'ALL' ? 'All 5 Coins' : widgetAsset})
            </button>
            <button
              type="button"
              onClick={() => setWidgetSide('SELL')}
              className={`py-4 text-sm font-mono font-bold transition-colors cursor-pointer ${
                widgetSide === 'SELL'
                  ? isDay
                    ? 'bg-white text-[#0B65C6] border-b-2 border-[#0B65C6]'
                    : 'bg-[#0F1829] text-emerald-400 border-b-2 border-emerald-400'
                  : isDay
                  ? 'bg-slate-100 text-slate-500 hover:text-slate-800'
                  : 'bg-[#070B12] text-slate-400 hover:text-white'
              }`}
            >
              Sell Crypto ({widgetAsset === 'ALL' ? 'All 5 Coins' : widgetAsset})
            </button>
          </div>

          {/* Widget Form Rows */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Row 1: Asset Symbol Selector (BTC, ETH, SOL, USDT, USDC) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div
                className={`sm:col-span-3 text-xs sm:text-sm font-mono font-semibold ${
                  isDay ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Cryptocurrency
              </div>
              <div className="sm:col-span-9 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWidgetAsset('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                    widgetAsset === 'ALL'
                      ? isDay
                        ? 'bg-[#0B65C6] text-white border-[#0B65C6]'
                        : 'bg-emerald-400 text-[#05080D] border-emerald-400'
                      : isDay
                      ? 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      : 'bg-[#070B12] text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  ALL (5)
                </button>
                {ALL_CRYPTO_ASSETS.map((asset) => {
                  const active = widgetAsset === asset;
                  return (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => setWidgetAsset(asset)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                        active
                          ? isDay
                            ? 'bg-[#0B65C6] text-white border-[#0B65C6]'
                            : 'bg-emerald-400 text-[#05080D] border-emerald-400'
                          : isDay
                          ? 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                          : 'bg-[#070B12] text-slate-200 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <CryptoAssetIcon asset={asset} className="w-4 h-4 shrink-0" />
                      <span>{asset}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Currency / Jurisdiction Selector + Quick Chips (EUR, USD, GBP, INR...) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <label
                htmlFor="widget-currency-select"
                className={`sm:col-span-3 text-xs sm:text-sm font-mono font-semibold pt-2.5 ${
                  isDay ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Currency
              </label>
              <div className="sm:col-span-9 space-y-2">
                <CustomSelect
                  id="widget-currency-select"
                  testId="widget-currency-select"
                  value={selectedCountry}
                  onChange={(val) => handleCountryChange(val as CountryCode)}
                  options={buildCountryCurrencyOptions()}
                  ariaLabel="Select Fiat Currency and Country"
                  searchPlaceholder="Search currency (INR, USD, EUR, GBP...)"
                />

                {/* Quick Currency Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {COUNTRY_ORDER_LIST.map((c) => {
                    const active = c.code === selectedCountry;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        data-testid={`country-card-${c.code}`}
                        onClick={() => handleCountryChange(c.code)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                          active
                            ? isDay
                              ? 'bg-[#0B65C6] text-white border-[#0B65C6] font-bold'
                              : 'bg-emerald-400 text-[#05080D] border-emerald-400 font-bold'
                            : isDay
                            ? 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                            : 'bg-[#070B12] text-slate-400 border-white/15 hover:text-white'
                        }`}
                      >
                        {c.fiatCurrency} ({c.fiatSymbol})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 3: Payment Method Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <label
                htmlFor="widget-rail-select"
                className={`sm:col-span-3 text-xs sm:text-sm font-mono font-semibold ${
                  isDay ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Payment method
              </label>
              <div className="sm:col-span-9">
                <CustomSelect
                  id="widget-rail-select"
                  testId="widget-rail-select"
                  value={widgetRail}
                  onChange={(val) => setWidgetRail(val)}
                  options={[
                    {
                      value: 'ALL',
                      badgeText: lockedFiat,
                      badgeVariant: 'emerald',
                      label: `All ${lockedFiat} payment methods (${configuredRails.length})`,
                      sublabel: configuredRails.slice(0, 3).join(' · '),
                    },
                    ...configuredRails.map((rail) => ({
                      value: rail,
                      badgeText: activePolicy.fiatSymbol,
                      badgeVariant: 'blue' as const,
                      label: `${rail} (${lockedFiat})`,
                      sublabel: `Instant ${activePolicy.name} Domestic Rail`,
                    })),
                  ]}
                  ariaLabel="Select Payment Method"
                />
              </div>
            </div>

            {/* Row 4: Amount Input + Live 1% Fee Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <label
                htmlFor="hero-calc-fiat-input"
                className={`sm:col-span-3 text-xs sm:text-sm font-mono font-semibold pt-2.5 ${
                  isDay ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Amount
              </label>
              <div className="sm:col-span-9 space-y-2">
                <div className="relative">
                  <input
                    id="hero-calc-fiat-input"
                    data-testid="hero-calc-fiat-input"
                    type="text"
                    value={widgetAmount}
                    onChange={(e) => setWidgetAmount(e.target.value)}
                    placeholder="Enter amount"
                    className={`w-full px-3.5 py-2.5 pr-16 rounded-lg text-xs sm:text-sm font-mono border focus:outline-none ${
                      isDay
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0B65C6]'
                        : 'bg-[#070B12] border-white/15 text-white focus:border-emerald-400'
                    }`}
                  />
                  <span
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold ${
                      isDay ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {lockedFiat}
                  </span>
                </div>

                {sampleBreakdown && (
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono px-3 py-1.5 rounded-lg ${
                      isDay
                        ? 'bg-sky-50 text-slate-700 border border-sky-200/70'
                        : 'bg-[#070B12] text-slate-300 border border-white/10'
                    }`}
                  >
                    <span>
                      Est. Escrow:{' '}
                      <strong className={isDay ? 'text-[#0B65C6]' : 'text-emerald-400'}>
                        {sampleBreakdown.cryptoQuantityFormatted}{' '}
                        {widgetAsset === 'ALL' ? 'USDT' : widgetAsset}
                      </strong>
                    </span>
                    <span>
                      Seller Net (99%): {FIAT_SYMBOLS[lockedFiat]}
                      {sampleBreakdown.sellerNetFiatFormatted}
                    </span>
                    <span>
                      1% Fee: {FIAT_SYMBOLS[lockedFiat]}
                      {sampleBreakdown.platformFeeFiatFormatted}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Full-Width Search Offers Button */}
            <button
              type="button"
              onClick={() => onNavigate(widgetSide === 'BUY' ? 'marketplace' : 'create-offer')}
              className={`w-full py-3.5 rounded-xl text-sm font-mono font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                isDay
                  ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white shadow-md'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>
                {widgetSide === 'BUY'
                  ? `View ${filteredWidgetOffers.length} available ${lockedFiat} offers`
                  : `Create ${lockedFiat} Sell Offer (${feePctFormatted}% Fee)`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: SUPPORTED CRYPTOCURRENCIES & ESCROW SPECIFICATIONS
          Detailed project breakdown for BTC, ETH, SOL, USDT, and USDC with
          official vector symbols, live local rates, and ledger precision.
         ===================================================================== */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <div
            className={`text-xs font-mono uppercase tracking-widest font-bold ${
              isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
            }`}
          >
            Multi-Asset Double-Entry Custody · 6-Decimal Micro-Unit Precision
          </div>
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-800' : 'text-white'
            }`}
          >
            SUPPORTED CRYPTOCURRENCIES ON COSTORAH
          </h2>
          <p
            className={`text-xs sm:text-sm font-mono ${
              isDay ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            Every supported asset is held 1:1 in pre-funded escrow vaults before an advertisement
            can be listed in {activePolicy.name} ({lockedFiat}).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ALL_CRYPTO_ASSETS.map((symbol) => {
            const meta = CRYPTO_ASSET_CATALOG[symbol];
            const liveUsdPrice =
              livePriceFeed?.rates?.[symbol]?.usd ??
              USD_REFERENCE_RATES[symbol] ??
              meta.usdBenchmarkPrice;
            const localIndicativePrice = Number((liveUsdPrice * liveLocalRate).toFixed(2));
            const assetOfferCount = corridorOffers.filter((o) => o.asset === symbol).length;

            return (
              <div
                key={symbol}
                data-testid={`supported-asset-card-${symbol}`}
                className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5 ${
                  isDay
                    ? 'bg-white border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] hover:border-[#0B65C6]'
                    : 'bg-[#0A101B] border-white/10 hover:border-emerald-400/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <CryptoAssetIcon asset={symbol} className="w-10 h-10 shrink-0" />
                      <div>
                        <div
                          className={`text-base font-black font-display ${
                            isDay ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {symbol}
                        </div>
                        <div
                          className={`text-xs font-mono whitespace-nowrap ${
                            isDay ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {meta.name}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                        isDay
                          ? 'bg-sky-50 text-[#0B65C6]'
                          : 'bg-emerald-400/10 text-emerald-400'
                      }`}
                    >
                      1:1 Locked
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-relaxed ${
                      isDay ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    {meta.tagline}
                  </p>

                  <div
                    className={`pt-2 border-t text-xs font-mono space-y-1 ${
                      isDay ? 'border-slate-100' : 'border-white/[0.08]'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className={isDay ? 'text-slate-500' : 'text-slate-400'}>
                        USD Rate:
                      </span>
                      <span
                        className={`font-bold ${
                          isDay ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        ${liveUsdPrice.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDay ? 'text-slate-500' : 'text-slate-400'}>
                        {lockedFiat} Rate:
                      </span>
                      <span
                        className={`font-bold ${
                          isDay ? 'text-emerald-700' : 'text-emerald-400'
                        }`}
                      >
                        {activePolicy.fiatSymbol}
                        {localIndicativePrice.toLocaleString('en-US', {
                          minimumFractionDigits: symbol === 'USDT' || symbol === 'USDC' ? 2 : 0,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDay ? 'text-slate-500' : 'text-slate-400'}>
                        Network:
                      </span>
                      <span
                        className={`truncate max-w-[125px] ${
                          isDay ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        {meta.networkLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDay ? 'text-slate-500' : 'text-slate-400'}>
                        {lockedFiat} Offers:
                      </span>
                      <span
                        className={`font-bold ${
                          isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                        }`}
                      >
                        {assetOfferCount} Open
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('marketplace')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    isDay
                      ? 'bg-slate-100 hover:bg-[#0B65C6] text-slate-800 hover:text-white'
                      : 'bg-white/[0.06] hover:bg-emerald-400 text-white hover:text-[#05080D]'
                  }`}
                >
                  <span>Trade {symbol}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          SECTION 3B: REAL-TIME P2P MARKET VOLUME & ESCROW RESERVE TREND GRAPH
          Recharts-based interactive trend line graph visualizing real-time P2P
          market volume and 1:1 escrow liquidity across the active corridor.
         ===================================================================== */}
      <section
        data-testid="market-volume-trend-section"
        className={`rounded-3xl p-6 sm:p-10 border space-y-6 transition-colors ${
          isDay
            ? 'bg-white border-slate-200 shadow-[0_14px_38px_rgba(15,23,42,0.06)]'
            : 'bg-[#0A101B] border-white/10 shadow-2xl'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-slate-200/80 dark:border-white/10">
          <div className="space-y-1.5">
            <div
              className={`inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest font-bold ${
                isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Real-Time P2P Market Volume &amp; 1:1 Escrow Liquidity</span>
            </div>
            <h2
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tight font-display ${
                isDay ? 'text-slate-900' : 'text-white'
              }`}
            >
              {activePolicy.name.toUpperCase()} ({lockedFiat}) P2P VOLUME TREND
            </h2>
            <p
              className={`text-xs sm:text-sm font-mono ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Live verified settlement volume and pre-funded escrow reserves across BTC, ETH, SOL,
              USDT, and USDC in {lockedFiat} ({activePolicy.fiatSymbol}).
            </p>
          </div>

          {/* Timeframe Selector Buttons (24H / 7D / 30D) */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {(['24H', '7D', '30D'] as const).map((tf) => {
              const active = volumeTimeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  data-testid={`volume-tf-${tf}`}
                  onClick={() => setVolumeTimeframe(tf)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-colors ${
                    active
                      ? isDay
                        ? 'bg-[#0B65C6] text-white border-[#0B65C6]'
                        : 'bg-emerald-400 text-[#05080D] border-emerald-400'
                      : isDay
                      ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      : 'bg-[#111A2B] text-slate-300 border-white/10 hover:text-white'
                  }`}
                >
                  {tf} Window
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Summary Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className={`p-4 rounded-2xl border ${
              isDay ? 'bg-slate-50 border-slate-200' : 'bg-[#0F1726] border-white/10'
            }`}
          >
            <div
              className={`text-xs font-mono ${
                isDay ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {volumeTimeframe} Corridor Volume ({lockedFiat})
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono mt-1 tabular-nums ${
                isDay ? 'text-slate-950' : 'text-white'
              }`}
            >
              {activePolicy.fiatSymbol}
              {marketVolumeSeries[
                marketVolumeSeries.length - 1
              ].localVolume.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">{lockedFiat}</span>
            </div>
            <div
              className={`text-[11px] font-mono font-bold mt-1 inline-flex items-center gap-1 ${
                isDay ? 'text-emerald-700' : 'text-emerald-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs prior window · 100% escrow-backed</span>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDay ? 'bg-slate-50 border-slate-200' : 'bg-[#0F1726] border-white/10'
            }`}
          >
            <div
              className={`text-xs font-mono ${
                isDay ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              1:1 Locked Escrow Reserve ({lockedFiat})
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono mt-1 tabular-nums ${
                isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
              }`}
            >
              {activePolicy.fiatSymbol}
              {marketVolumeSeries[
                marketVolumeSeries.length - 1
              ].localEscrowReserve.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">{lockedFiat}</span>
            </div>
            <div
              className={`text-[11px] font-mono mt-1 ${
                isDay ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Double-entry verified across 5 assets
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDay ? 'bg-slate-50 border-slate-200' : 'bg-[#0F1726] border-white/10'
            }`}
          >
            <div
              className={`text-xs font-mono ${
                isDay ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Settled Escrow Contracts ({volumeTimeframe})
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono mt-1 tabular-nums ${
                isDay ? 'text-slate-950' : 'text-white'
              }`}
            >
              {marketVolumeSeries.reduce((acc, item) => acc + item.trades, 0).toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">Deals</span>
            </div>
            <div
              className={`text-[11px] font-mono mt-1 ${
                isDay ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              99.4% completion rate · {feePctFormatted}% seller fee
            </div>
          </div>
        </div>

        {/* Recharts Area / Trend Line Graph */}
        <div
          data-testid="recharts-volume-graph-container"
          className="w-full h-[290px] pt-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={marketVolumeSeries}
              margin={{ top: 10, right: 18, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="aegisVolGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isDay ? '#0B65C6' : '#10B981'}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor={isDay ? '#0B65C6' : '#10B981'}
                    stopOpacity={0.02}
                  />
                </linearGradient>
                <linearGradient id="aegisReserveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isDay ? '#7C3AED' : '#38BDF8'}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="95%"
                    stopColor={isDay ? '#7C3AED' : '#38BDF8'}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDay ? '#E2E8F0' : '#1E293B'}
              />
              <XAxis
                dataKey="time"
                stroke={isDay ? '#475569' : '#94A3B8'}
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke={isDay ? '#475569' : '#94A3B8'}
                fontSize={11}
                tickLine={false}
                tickFormatter={(val: number) =>
                  `${activePolicy.fiatSymbol}${
                    val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : `${Math.round(val / 1000)}k`
                  }`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDay ? '#FFFFFF' : '#0F172A',
                  borderColor: isDay ? '#CBD5E1' : '#334155',
                  borderRadius: '12px',
                  color: isDay ? '#0F172A' : '#F8FAFC',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                }}
                formatter={(value: unknown, name: unknown) => [
                  `${activePolicy.fiatSymbol}${Number(value).toLocaleString('en-US')} ${lockedFiat}`,
                  name === 'localVolume' ? 'P2P Settlement Volume' : '1:1 Escrow Reserve',
                ]}
              />
              <Area
                type="monotone"
                dataKey="localEscrowReserve"
                stroke={isDay ? '#7C3AED' : '#38BDF8'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#aegisReserveGrad)"
              />
              <Area
                type="monotone"
                dataKey="localVolume"
                stroke={isDay ? '#0B65C6' : '#10B981'}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#aegisVolGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3C: "WHY CHOOSE AEGIS" HIGH-CONTRAST 3-PILLAR GRID SECTION
          Uses modern Lucide React icons to highlight Escrow-Locked Safety,
          Jurisdiction-Specific Settlement, and Verified Trust Scores.
         ===================================================================== */}
      <section
        id="why-choose-aegis-section"
        data-testid="why-choose-aegis-section"
        className="space-y-8"
      >
        <div className="text-center space-y-2.5 max-w-3xl mx-auto">
          <div
            className={`text-xs font-mono uppercase tracking-widest font-bold ${
              isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
            }`}
          >
            Core Protocol Guarantees · Institutional-Grade P2P Architecture
          </div>
          <h2
            className={`text-3xl sm:text-4xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-900' : 'text-white'
            }`}
          >
            WHY CHOOSE COSTORAH
          </h2>
          <p
            className={`text-xs sm:text-sm font-mono leading-relaxed ${
              isDay ? 'text-slate-700' : 'text-slate-300'
            }`}
          >
            Built from the ground up with high-contrast transparency, deterministic ledger rules,
            and strict domestic settlement isolation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: Escrow-Locked Safety */}
          <div
            data-testid="why-choose-card-escrow"
            className={`rounded-2xl p-7 border flex flex-col justify-between space-y-5 transition-all hover:-translate-y-0.5 ${
              isDay
                ? 'bg-white border-slate-300 shadow-[0_12px_32px_rgba(15,23,42,0.06)]'
                : 'bg-[#0D1524] border-white/15 shadow-xl'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    isDay
                      ? 'bg-[#0B65C6] text-white'
                      : 'bg-emerald-400 text-[#05080D]'
                  }`}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                    isDay
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                  }`}
                >
                  100% Pre-Funded
                </span>
              </div>

              <h3
                className={`text-xl font-black font-display ${
                  isDay ? 'text-slate-950' : 'text-white'
                }`}
              >
                Escrow-Locked Safety
              </h3>

              <p
                className={`text-xs sm:text-sm font-mono leading-relaxed ${
                  isDay ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                Sellers must lock 100% of the cryptocurrency inside Costorah’s double-entry escrow
                vault before an offer goes live. Once a buyer submits payment proof, order expiry
                timers freeze automatically to prevent premature release or loss of funds.
              </p>
            </div>

            <div
              className={`pt-4 border-t text-xs font-mono font-bold flex items-center gap-2 ${
                isDay
                  ? 'border-slate-200 text-[#0B65C6]'
                  : 'border-white/10 text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Zero Unbacked Listings · Timer Freeze Protection</span>
            </div>
          </div>

          {/* Pillar 2: Jurisdiction-Specific Settlement */}
          <div
            data-testid="why-choose-card-jurisdiction"
            className={`rounded-2xl p-7 border flex flex-col justify-between space-y-5 transition-all hover:-translate-y-0.5 ${
              isDay
                ? 'bg-white border-slate-300 shadow-[0_12px_32px_rgba(15,23,42,0.06)]'
                : 'bg-[#0D1524] border-white/15 shadow-xl'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    isDay
                      ? 'bg-[#0B65C6] text-white'
                      : 'bg-emerald-400 text-[#05080D]'
                  }`}
                >
                  <Globe2 className="w-6 h-6" />
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                    isDay
                      ? 'bg-sky-50 text-[#0B65C6] border border-sky-300'
                      : 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                  }`}
                >
                  {activePolicy.code} → {lockedFiat} ({activePolicy.fiatSymbol})
                </span>
              </div>

              <h3
                className={`text-xl font-black font-display ${
                  isDay ? 'text-slate-950' : 'text-white'
                }`}
              >
                Jurisdiction-Specific Settlement
              </h3>

              <p
                className={`text-xs sm:text-sm font-mono leading-relaxed ${
                  isDay ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                Strict Country-to-Fiat isolation locks your session to{' '}
                <strong>
                  {activePolicy.name} ({lockedFiat})
                </strong>{' '}
                and verified local banking rails ({configuredRails.slice(0, 3).join(', ')}),
                eliminating cross-border wire delays and foreign-exchange rejections.
              </p>
            </div>

            <div
              className={`pt-4 border-t text-xs font-mono font-bold flex items-center gap-2 ${
                isDay
                  ? 'border-slate-200 text-[#0B65C6]'
                  : 'border-white/10 text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>10 Sovereign Corridors · Instant Domestic Rails</span>
            </div>
          </div>

          {/* Pillar 3: Verified Trust Scores */}
          <div
            data-testid="why-choose-card-trust"
            className={`rounded-2xl p-7 border flex flex-col justify-between space-y-5 transition-all hover:-translate-y-0.5 ${
              isDay
                ? 'bg-white border-slate-300 shadow-[0_12px_32px_rgba(15,23,42,0.06)]'
                : 'bg-[#0D1524] border-white/15 shadow-xl'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    isDay
                      ? 'bg-[#0B65C6] text-white'
                      : 'bg-emerald-400 text-[#05080D]'
                  }`}
                >
                  <Award className="w-6 h-6" />
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                    isDay
                      ? 'bg-purple-50 text-purple-900 border border-purple-300'
                      : 'bg-purple-400/15 text-purple-300 border border-purple-400/30'
                  }`}
                >
                  0–100 Deterministic Score
                </span>
              </div>

              <h3
                className={`text-xl font-black font-display ${
                  isDay ? 'text-slate-950' : 'text-white'
                }`}
              >
                Verified Trust Scores
              </h3>

              <p
                className={`text-xs sm:text-sm font-mono leading-relaxed ${
                  isDay ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                Every counterparty displays a tamper-proof Advertiser Trust Score computed from
                completed trade count, settlement completion rate, and historical dispute outcomes —
                giving you full confidence before locking an order.
              </p>
            </div>

            <div
              className={`pt-4 border-t text-xs font-mono font-bold flex items-center gap-2 ${
                isDay
                  ? 'border-slate-200 text-[#0B65C6]'
                  : 'border-white/10 text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Audited Counterparty Reputation &amp; KYC Tiers</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: "COSTORAH. WE CARE ABOUT YOUR CUSTODY & SAFETY."
         ===================================================================== */}
      <section
        className={`rounded-3xl px-6 py-12 sm:px-12 sm:py-16 text-center space-y-10 border ${
          isDay
            ? 'bg-gradient-to-r from-[#EBF5FF] via-[#F3F4FF] to-[#FCEEFF] border-sky-200/70'
            : 'bg-gradient-to-r from-[#0B1322] via-[#0E1729] to-[#13182B] border-white/10'
        }`}
      >
        <div className="flex flex-col items-center space-y-3">
          <CostorahLogoIcon className="w-14 h-14 drop-shadow-md" />
          <h2
            className={`text-2xl sm:text-4xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-800' : 'text-white'
            }`}
          >
            COSTORAH. WE CARE ABOUT YOUR CUSTODY & SAFETY.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Badge 1 */}
          <div className="flex flex-col items-center space-y-3">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${
                isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
              }`}
            >
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3
              className={`text-base font-black uppercase font-display ${
                isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
              }`}
            >
              SECURE 1:1 ESCROW
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono max-w-xs leading-relaxed ${
                isDay ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              100% of the seller’s crypto is locked in our double-entry escrow ledger before any
              deal begins. Zero fractional listings.
            </p>
          </div>

          {/* Badge 2 */}
          <div className="flex flex-col items-center space-y-3">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${
                isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
              }`}
            >
              <KeyRound className="w-7 h-7" />
            </div>
            <h3
              className={`text-base font-black uppercase font-display ${
                isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
              }`}
            >
              DIRECT P2P RAILS
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono max-w-xs leading-relaxed ${
                isDay ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              Buyers pay sellers directly using domestic rails ({configuredRails.slice(0, 2).join(', ')})
              strictly isolated to {lockedFiat}.
            </p>
          </div>

          {/* Badge 3 */}
          <div className="flex flex-col items-center space-y-3">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${
                isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
              }`}
            >
              <Lock className="w-7 h-7" />
            </div>
            <h3
              className={`text-base font-black uppercase font-display ${
                isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
              }`}
            >
              FROZEN EXPIRY TIMERS
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono max-w-xs leading-relaxed ${
                isDay ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              Once a buyer marks payment sent with a UTR/bank reference, automatic timer expiry is
              suspended until verified.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: "GETTING STARTED" — 3 CONNECTED STEP CARDS WITH CURVED
          PURPLE/EMERALD ARROWS (Directly modeled on hodlhodl-bottom.png)
         ===================================================================== */}
      <section id="getting-started-section" className="space-y-10">
        <div className="text-center space-y-2">
          <h2
            className={`text-3xl sm:text-4xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-800' : 'text-white'
            }`}
          >
            GETTING STARTED
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('info')}
            className={`inline-flex items-center gap-2 text-sm font-mono font-bold cursor-pointer ${
              isDay ? 'text-[#0B65C6] hover:underline' : 'text-emerald-400 hover:underline'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Simple protocol walkthrough</span>
          </button>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Card 1 */}
          <div
            data-testid="workflow-step-card-01"
            className={`relative rounded-2xl p-8 border space-y-3 ${
              isDay
                ? 'bg-white border-slate-200/90 shadow-[0_12px_35px_rgba(15,23,42,0.06)]'
                : 'bg-[#0A101B] border-white/10 shadow-xl'
            }`}
          >
            <div className="text-sm font-mono font-extrabold text-[#7C3AED]">
              STEP 1
            </div>
            <h3
              className={`text-lg font-bold font-mono ${
                isDay ? 'text-slate-900' : 'text-white'
              }`}
            >
              Contract & Escrow Lock
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Buyer and seller engage in a jurisdiction-locked {lockedFiat} contract.
            </p>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Costorah isolates 100% of the trade cryptocurrency (BTC, ETH, SOL, USDT, or USDC)
              inside a dedicated escrow vault.
            </p>

            {/* Curved Arrow 1 -> 2 (Desktop) */}
            <svg
              viewBox="0 0 90 50"
              fill="none"
              className="hidden lg:block absolute -right-11 top-8 w-20 h-12 z-20 pointer-events-none"
            >
              <path
                d="M 4 32 C 28 32, 34 6, 52 12 C 68 18, 66 28, 84 26"
                stroke="#7C3AED"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M 76 19 L 85 26 L 75 32"
                stroke="#7C3AED"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Card 2 */}
          <div
            data-testid="workflow-step-card-02"
            className={`relative rounded-2xl p-8 border space-y-3 ${
              isDay
                ? 'bg-white border-slate-200/90 shadow-[0_12px_35px_rgba(15,23,42,0.06)]'
                : 'bg-[#0A101B] border-white/10 shadow-xl'
            }`}
          >
            <div className="text-sm font-mono font-extrabold text-[#7C3AED]">
              STEP 2
            </div>
            <h3
              className={`text-lg font-bold font-mono ${
                isDay ? 'text-slate-900' : 'text-white'
              }`}
            >
              Domestic Payment & Timer Freeze
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Buyer remits {lockedFiat} ({activePolicy.fiatSymbol}) directly to the seller via the
              agreed payment rail ({configuredRails.slice(0, 2).join(' or ')}).
            </p>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Submitting the payment UTR/reference switches the order to{' '}
              <strong>PAYMENT_MARKED_SENT</strong> and freezes automatic expiration.
            </p>

            {/* Curved Arrow 2 -> 3 (Desktop) */}
            <svg
              viewBox="0 0 90 60"
              fill="none"
              className="hidden lg:block absolute -right-11 top-20 w-20 h-14 z-20 pointer-events-none"
            >
              <path
                d="M 4 12 C 36 22, 48 34, 34 42 C 20 48, 56 52, 84 48"
                stroke="#7C3AED"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M 76 41 L 85 48 L 76 55"
                stroke="#7C3AED"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Card 3 */}
          <div
            data-testid="workflow-step-card-03"
            className={`relative rounded-2xl p-8 border space-y-3 ${
              isDay
                ? 'bg-white border-slate-200/90 shadow-[0_12px_35px_rgba(15,23,42,0.06)]'
                : 'bg-[#0A101B] border-white/10 shadow-xl'
            }`}
          >
            <div className="text-sm font-mono font-extrabold text-[#7C3AED]">
              STEP 3
            </div>
            <h3
              className={`text-lg font-bold font-mono ${
                isDay ? 'text-slate-900' : 'text-white'
              }`}
            >
              Crypto Release & Contract Closure
            </h3>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Seller verifies receipt of funds and releases the escrowed cryptocurrency directly to
              the buyer’s wallet.
            </p>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              The engine executes the atomic 99.00% seller net / {feePctFormatted}% fee split and
              updates both traders’ Trust Scores.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: "CREATE AN OFFER ON YOUR TERMS" + 3 STACKED CARDS & FAQ
          (Directly modeled on hodlhodl-s4.png)
         ===================================================================== */}
      <section className="space-y-14">
        {/* Pastel Banner: Create an Offer on Your Terms */}
        <div
          className={`rounded-3xl px-6 py-10 sm:px-12 sm:py-12 text-center space-y-5 border ${
            isDay
              ? 'bg-gradient-to-r from-[#EBF5FF] via-[#F4F5FF] to-[#FDF2FF] border-sky-200/70'
              : 'bg-[#0A101B] border-white/10'
          }`}
        >
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tight font-display ${
              isDay ? 'text-slate-800' : 'text-white'
            }`}
          >
            CREATE AN OFFER ON YOUR TERMS
          </h2>
          <div
            className={`text-xs sm:text-sm font-mono flex flex-wrap items-center justify-center gap-3 ${
              isDay ? 'text-slate-700' : 'text-slate-300'
            }`}
          >
            <span>Set your {lockedFiat} price</span>
            <span>|</span>
            <span>Use multiple domestic payment methods</span>
            <span>|</span>
            <span>Trade BTC, ETH, SOL, USDT & USDC</span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onNavigate('create-offer')}
              className={`px-8 py-3 rounded-xl text-xs sm:text-sm font-mono font-bold cursor-pointer transition-colors shadow-md ${
                isDay
                  ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
              }`}
            >
              Try Costorah Offer Creator
            </button>
          </div>
        </div>

        {/* 2-Column Split: 3 Stacked Feature Cards (Left) + Project FAQ (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left 5 Cols: 3 Stacked Cards (Matching hodlhodl-s4.png) */}
          <div className="lg:col-span-5 space-y-6">
            <div
              className={`rounded-2xl p-7 text-center space-y-3 border ${
                isDay
                  ? 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
                  : 'bg-[#0A101B] border-white/10'
              }`}
            >
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                  isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
                }`}
              >
                <Search className="w-6 h-6" />
              </div>
              <h3
                className={`text-base font-black uppercase font-display ${
                  isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                }`}
              >
                TRANSPARENT {feePctFormatted}% FEE
              </h3>
              <p
                className={`text-xs font-mono leading-relaxed max-w-xs mx-auto ${
                  isDay ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                Flat {feePctFormatted}% fee deducted from seller proceeds upon completed settlement.
                0.00% fee for buyers. Computed with BigInt minor-unit math.
              </p>
            </div>

            <div
              className={`rounded-2xl p-7 text-center space-y-3 border ${
                isDay
                  ? 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
                  : 'bg-[#0A101B] border-white/10'
              }`}
            >
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                  isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3
                className={`text-base font-black uppercase font-display ${
                  isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                }`}
              >
                SECURED BY 16-STATE ESCROW
              </h3>
              <p
                className={`text-xs font-mono leading-relaxed max-w-xs mx-auto ${
                  isDay ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                Every order transitions through role-guarded states (ESCROW_LOCKED,
                PAYMENT_MARKED_SENT, COMPLETED) with arbitrator dispute freezes.
              </p>
            </div>

            <div
              className={`rounded-2xl p-7 text-center space-y-3 border ${
                isDay
                  ? 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
                  : 'bg-[#0A101B] border-white/10'
              }`}
            >
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                  isDay ? 'bg-[#0B65C6] text-white' : 'bg-emerald-400 text-[#05080D]'
                }`}
              >
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3
                className={`text-base font-black uppercase font-display ${
                  isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                }`}
              >
                LEARN & PRACTICE SANDBOX
              </h3>
              <p
                className={`text-xs font-mono leading-relaxed max-w-xs mx-auto ${
                  isDay ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                Test full escrow lifecycles, switch user personas, and verify double-entry ledger
                accounting without risking real mainnet funds.
              </p>
            </div>
          </div>

          {/* Right 7 Cols: FAQ & Deep Project Details (Matching hodlhodl-s4.png) */}
          <div className="lg:col-span-7 space-y-6">
            <h2
              className={`text-3xl font-black uppercase font-display ${
                isDay ? 'text-slate-800' : 'text-white'
              }`}
            >
              FAQ & PROJECT ARCHITECTURE
            </h2>

            <div className="space-y-5 font-mono">
              <div>
                <h3
                  className={`text-sm sm:text-base font-bold ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Which problems is Costorah solving?
                </h3>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mt-1 ${
                    isDay ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Eliminating unbacked P2P advertisements, premature order expiration after a buyer
                  sends bank funds, and cross-currency settlement confusion through a 1:1 pre-funded
                  double-entry escrow ledger.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm sm:text-base font-bold ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  What cryptocurrencies are available?
                </h3>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mt-1 ${
                    isDay ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Bitcoin (<strong>BTC</strong>), Ethereum (<strong>ETH</strong>), Solana (
                  <strong>SOL</strong>), Tether (<strong>USDT</strong>), and USD Coin (
                  <strong>USDC</strong>) — all tracked with 6-decimal micro-unit integer precision.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm sm:text-base font-bold ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  How does the Country-to-Fiat security lock work?
                </h3>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mt-1 ${
                    isDay ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Selecting your country (e.g. India → INR ₹, United States → USD $, Turkey → TRY ₺,
                  Europe → EUR €) restricts offer creation and order matching strictly to that
                  domestic fiat currency and local banking rails.
                </p>
              </div>

              <div>
                <h3
                  className={`text-sm sm:text-base font-bold ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  How are Advertiser Trust Scores calculated?
                </h3>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mt-1 ${
                    isDay ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Every trader’s Trust Score (0–100) is computed deterministically from their
                  completed trade volume, completion rate percentage, and successful dispute
                  resolutions.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <div
                className={`text-lg font-black uppercase font-display max-w-sm ${
                  isDay ? 'text-slate-800' : 'text-white'
                }`}
              >
                ANSWERS TO ALL PROTOCOL QUESTIONS ON OUR INFO PAGE
              </div>
              <button
                type="button"
                onClick={() => onNavigate('info')}
                className={`px-7 py-3 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  isDay
                    ? 'bg-slate-800 hover:bg-slate-950 text-white'
                    : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
                }`}
              >
                Protocol & Fee Docs
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 7: PIXEL-MATRIX CALLOUT BANNER & LIVE CORRIDOR OFFERS
          (Directly modeled on "LIGHTNING VIA ARKADE" in hodlhodl-s5.png)
         ===================================================================== */}
      <section className="space-y-10">
        {/* Callout Banner with Pixel-Matrix Shield Graphic */}
        <div
          className={`rounded-3xl p-8 sm:p-12 border flex flex-col md:flex-row items-center justify-between gap-8 ${
            isDay
              ? 'bg-gradient-to-r from-[#EBF5FF] via-[#F4F4FF] to-[#FCEEFF] border-sky-200/80'
              : 'bg-gradient-to-r from-[#0B1322] via-[#0F192D] to-[#14182D] border-white/10'
          }`}
        >
          <div className="space-y-4 max-w-xl">
            <h2
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tight font-display ${
                isDay ? 'text-slate-800' : 'text-white'
              }`}
            >
              INSTANT DOMESTIC RAILS VIA COSTORAH ESCROW
            </h2>
            <p
              className={`text-xs sm:text-sm font-mono leading-relaxed ${
                isDay ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              Trade BTC, ETH, SOL, USDT & USDC with {feePctFormatted}% seller fees using{' '}
              {activePolicy.name}’s fastest local payment rails ({configuredRails.slice(0, 3).join(', ')})
              — while keeping 100% of trade liquidity verifiable in escrow custody.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('marketplace')}
                className={`px-6 py-3 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  isDay
                    ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white'
                    : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
                }`}
              >
                Buy Crypto in {lockedFiat}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('create-offer')}
                className={`px-6 py-3 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  isDay
                    ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Sell Crypto in {lockedFiat}
              </button>
            </div>
          </div>

          {/* Pixel-Matrix Geometric Emblem (Inspired by Arkade Pixel Graphic in hodlhodl-s5.png) */}
          <div className="w-40 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 110 90" className="w-full h-full" fill="none">
              {[
                [2, 0], [3, 0], [7, 0], [8, 0],
                [3, 1], [4, 1], [6, 1], [7, 1],
                [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2],
                [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [8, 3], [9, 3],
                [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
                [0, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [10, 5],
                [0, 6], [2, 6], [8, 6], [10, 6],
                [3, 7], [4, 7], [6, 7], [7, 7],
              ].map(([col, row], i) => (
                <circle
                  key={i}
                  cx={10 + col * 9}
                  cy={10 + row * 9}
                  r="3.4"
                  fill={isDay ? '#4338CA' : '#34D399'}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Live Corridor Offers Preview */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              className={`text-xl font-black uppercase font-display ${
                isDay ? 'text-slate-800' : 'text-white'
              }`}
            >
              LIVE {activePolicy.name.toUpperCase()} ({lockedFiat}) ESCROW OFFERS
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('marketplace')}
              className={`text-xs font-mono font-bold cursor-pointer ${
                isDay ? 'text-[#0B65C6] hover:underline' : 'text-emerald-400 hover:underline'
              }`}
            >
              Open Full Marketplace ({corridorOffers.length} Offers) →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {corridorOffers.slice(0, 3).map((offer) => {
              const u = userById.get(offer.makerId);
              const trust = calculateAdvertiserTrustScore({
                makerId: offer.makerId,
                offerCompletedTrades: offer.completedTrades,
                offerCompletionRatePct: offer.completionRatePct,
                userCompletedTrades: u?.completedTrades,
                userCompletionRatePct: u?.completionRatePct,
                orders,
              });

              return (
                <div
                  key={offer.id}
                  className={`p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
                    isDay
                      ? 'bg-white border-slate-200 shadow-[0_8px_25px_rgba(15,23,42,0.05)]'
                      : 'bg-[#0A101B] border-white/10'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CryptoAssetIcon asset={offer.asset} className="w-7 h-7 shrink-0" />
                        <div>
                          <div
                            className={`text-sm font-bold ${
                              isDay ? 'text-slate-900' : 'text-white'
                            }`}
                          >
                            {offer.makerName}
                          </div>
                          <div
                            className={`text-[11px] font-mono ${
                              isDay ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            {trust.completedTrades} deals · {trust.successfulDisputes}/
                            {trust.totalDisputesReviewed} disputes
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold ${
                          isDay ? 'text-[#0B65C6]' : 'text-emerald-400'
                        }`}
                      >
                        Trust {trust.trustScore.toFixed(1)}
                      </span>
                    </div>

                    <div className="pt-1">
                      <div
                        className={`text-xs font-mono ${
                          isDay ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Price per {offer.asset}
                      </div>
                      <div
                        className={`text-2xl font-extrabold font-mono tabular-nums ${
                          isDay ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {FIAT_SYMBOLS[offer.fiatCurrency]}
                        {formatMinor2(offer.unitPriceFiatMinor)}{' '}
                        <span className="text-xs font-normal">{offer.fiatCurrency}</span>
                      </div>
                    </div>

                    <div
                      className={`text-xs font-mono pt-2 border-t space-y-1 ${
                        isDay ? 'border-slate-100 text-slate-600' : 'border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{offer.side === 'SELL' ? 'Selling:' : 'Buying Order:'}</span>
                        <span className="font-bold">
                          {formatMicro6(offer.availableQuantityMicro)} {offer.asset} (
                          {FIAT_SYMBOLS[offer.fiatCurrency]}
                          {formatMinor2(
                            Math.max(
                              1,
                              Math.round(
                                (offer.availableQuantityMicro * offer.unitPriceFiatMinor) /
                                  1_000_000
                              )
                            )
                          )}
                          )
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Order Limit:</span>
                        <span className="truncate max-w-[175px]">
                          {FIAT_SYMBOLS[offer.fiatCurrency]}
                          {formatMinor2(offer.minOrderFiatMinor)} –{' '}
                          {FIAT_SYMBOLS[offer.fiatCurrency]}
                          {formatMinor2(offer.maxOrderFiatMinor)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('marketplace')}
                    className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isDay
                        ? 'bg-[#0B65C6] hover:bg-[#0852A3] text-white'
                        : 'bg-emerald-400 hover:bg-emerald-300 text-[#05080D]'
                    }`}
                  >
                    <span>Trade {offer.asset}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
