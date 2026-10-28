import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Flame,
  Hash,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Repeat2,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  FIAT_SYMBOLS,
  type CryptoAsset,
  type EscrowOrderRecord,
  type FiatCurrency,
  type LivePriceFeed,
  type MarketTweetComment,
  type MarketTweetOrderAttachment,
  type MarketTweetRecord,
  type OfferRecord,
  type UserProfile,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import { ALL_CRYPTO_ASSETS, CryptoAssetIcon } from './CryptoAssetIcons';

function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export const TRADER_AVATAR_PRESETS: { id: string; label: string; url: string }[] = [
  {
    id: 'avatar_emerald_bull',
    label: 'Emerald Bull Trader',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#059669"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g1)"/>
        <circle cx="60" cy="46" r="20" fill="#A7F3D0"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#34D399"/>
        <circle cx="92" cy="28" r="12" fill="#10B981" stroke="#0F172A" stroke-width="4"/>
      </svg>
    `),
  },
  {
    id: 'avatar_btc_whale',
    label: 'Satoshi Sovereign',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="100%" stop-color="#78350F"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g2)"/>
        <circle cx="60" cy="46" r="20" fill="#FDE68A"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#FBBF24"/>
      </svg>
    `),
  },
  {
    id: 'avatar_eth_architect',
    label: 'Vitalik Node Desk',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#6366F1"/>
            <stop offset="100%" stop-color="#1E1B4B"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g3)"/>
        <circle cx="60" cy="46" r="20" fill="#C7D2FE"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#818CF8"/>
      </svg>
    `),
  },
  {
    id: 'avatar_sol_speed',
    label: 'Solana Liquidity Maker',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#14F195"/>
            <stop offset="100%" stop-color="#9945FF"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g4)"/>
        <circle cx="60" cy="46" r="20" fill="#F8FAFC"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#E2E8F0"/>
      </svg>
    `),
  },
  {
    id: 'avatar_cyber_cyan',
    label: 'Cyan OTC Arbitrage',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g5" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#06B6D4"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g5)"/>
        <circle cx="60" cy="46" r="20" fill="#A5F3FC"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#22D3EE"/>
      </svg>
    `),
  },
  {
    id: 'avatar_rose_quant',
    label: 'Alpha Quant Desk',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g6" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F43F5E"/>
            <stop offset="100%" stop-color="#4C0519"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="60" fill="url(#g6)"/>
        <circle cx="60" cy="46" r="20" fill="#FECDD3"/>
        <path d="M26 104c4-22 20-34 34-34s30 12 34 34" fill="#FB7185"/>
      </svg>
    `),
  },
];

export const MARKET_CHART_PRESETS: { id: string; label: string; url: string; caption: string }[] = [
  {
    id: 'chart_btc_breakout',
    label: 'BTC/INR Orderbook Breakout Chart',
    caption: 'BTC/INR P2P Order Book Depth & Bullish Breakout Structure',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380">
        <rect width="800" height="380" rx="16" fill="#0B0E14"/>
        <g stroke="#1E293B" stroke-width="1">
          <line x1="40" y1="70" x2="760" y2="70"/>
          <line x1="40" y1="150" x2="760" y2="150"/>
          <line x1="40" y1="230" x2="760" y2="230"/>
          <line x1="40" y1="310" x2="760" y2="310"/>
        </g>
        <defs>
          <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <path d="M50 290 L140 270 L220 280 L310 215 L390 230 L480 160 L570 175 L660 105 L750 68 L750 330 L50 330 Z" fill="url(#btcGrad)"/>
        <path d="M50 290 L140 270 L220 280 L310 215 L390 230 L480 160 L570 175 L660 105 L750 68" fill="none" stroke="#10B981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="750" cy="68" r="7" fill="#10B981"/>
        <text x="50" y="42" fill="#F8FAFC" font-family="monospace" font-size="18" font-weight="bold">$BTC / INR · P2P ESCROW LIQUIDITY BREAKOUT (+3.84%)</text>
        <text x="560" y="42" fill="#34D399" font-family="monospace" font-size="16" font-weight="bold">BULLISH ACCUMULATION</text>
      </svg>
    `),
  },
  {
    id: 'chart_eth_solana_flow',
    label: 'ETH & SOL Cross-Chain Swap Flow',
    caption: 'Ethereum (ERC-20) & Solana (SPL) P2P Settlement Volume',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380">
        <rect width="800" height="380" rx="16" fill="#0B0E14"/>
        <g stroke="#1E293B" stroke-width="1">
          <line x1="40" y1="80" x2="760" y2="80"/>
          <line x1="40" y1="180" x2="760" y2="180"/>
          <line x1="40" y1="280" x2="760" y2="280"/>
        </g>
        <path d="M50 260 Q180 240 280 190 T520 130 T750 85" fill="none" stroke="#6366F1" stroke-width="4"/>
        <path d="M50 300 Q200 260 320 220 T560 160 T750 110" fill="none" stroke="#14F195" stroke-width="4"/>
        <text x="50" y="44" fill="#F8FAFC" font-family="monospace" font-size="18" font-weight="bold">$ETH &amp; $SOL · ON-CHAIN ESCROW SETTLEMENT VELOCITY</text>
        <text x="50" y="348" fill="#818CF8" font-family="monospace" font-size="14">■ #Ethereum ERC-20 Vaults</text>
        <text x="320" y="348" fill="#14F195" font-family="monospace" font-size="14">■ #Solana SPL Instant Rails</text>
      </svg>
    `),
  },
  {
    id: 'chart_usdt_inr_spread',
    label: 'USDT/INR P2P Spread & UPI Depth',
    caption: 'Tightest USDT/INR P2P Spreads across PhonePe, GPay & IMPS',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380">
        <rect width="800" height="380" rx="16" fill="#0B0E14"/>
        <text x="50" y="45" fill="#F8FAFC" font-family="monospace" font-size="18" font-weight="bold">$USDT / INR · LIVE P2P ORDER BOOK DEPTH (UPI &amp; IMPS)</text>
        <rect x="60" y="90" width="310" height="42" rx="6" fill="#064E3B"/>
        <rect x="60" y="145" width="260" height="42" rx="6" fill="#065F46"/>
        <rect x="60" y="200" width="340" height="42" rx="6" fill="#047857"/>
        <rect x="430" y="90" width="290" height="42" rx="6" fill="#7F1D1D"/>
        <rect x="430" y="145" width="240" height="42" rx="6" fill="#991B1B"/>
        <rect x="430" y="200" width="310" height="42" rx="6" fill="#B91C1C"/>
        <text x="75" y="116" fill="#A7F3D0" font-family="monospace" font-size="15">BID · ₹94.72 INR · 12,500 USDT</text>
        <text x="75" y="171" fill="#A7F3D0" font-family="monospace" font-size="15">BID · ₹94.68 INR · 8,400 USDT</text>
        <text x="75" y="226" fill="#A7F3D0" font-family="monospace" font-size="15">BID · ₹94.60 INR · 19,000 USDT</text>
        <text x="445" y="116" fill="#FECACA" font-family="monospace" font-size="15">ASK · ₹94.80 INR · 9,200 USDT</text>
        <text x="445" y="171" fill="#FECACA" font-family="monospace" font-size="15">ASK · ₹94.88 INR · 6,500 USDT</text>
        <text x="445" y="226" fill="#FECACA" font-family="monospace" font-size="15">ASK · ₹94.95 INR · 15,000 USDT</text>
      </svg>
    `),
  },
];

export function formatUserHandle(displayName: string, email?: string): string {
  const base = displayName
    .replace(' (You)', '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (base) return `@${base}`;
  if (email) return `@${email.split('@')[0].toLowerCase()}`;
  return '@trader';
}

export function getDefaultAvatarForUser(user?: Partial<UserProfile> | null): string {
  if (user?.avatarUrl && user.avatarUrl.trim()) {
    return user.avatarUrl;
  }
  const seed = (user?.id || user?.displayName || 'trader').length;
  return TRADER_AVATAR_PRESETS[seed % TRADER_AVATAR_PRESETS.length].url;
}

export const INITIAL_MARKET_TWEETS: MarketTweetRecord[] = [
  {
    id: 'tw_seed_101',
    authorId: 'usr_priya_maker',
    authorName: 'Priya Sharma (Verified Maker)',
    authorHandle: '@priya_sharma_otc',
    authorAvatarUrl: TRADER_AVATAR_PRESETS[0].url,
    authorVerified: true,
    authorReputationScore: 99.4,
    content:
      'Just locked fresh #USDT liquidity in the P2P escrow vault! Tightest INR spread today via PhonePe & UPI Instant. Tagging @alex_rivera and @vikram_patel — instant release within 3 mins of UTR confirmation. #Bitcoin #Ethereum',
    sentiment: 'ORDER_ALERT',
    taggedAssets: ['USDT', 'BTC', 'ETH'],
    taggedUserHandles: ['@alex_rivera', '@vikram_patel'],
    imageUrl: MARKET_CHART_PRESETS[2].url,
    imageCaption: MARKET_CHART_PRESETS[2].caption,
    orderAttachment: {
      offerId: 'off_inr_usdt_1',
      side: 'SELL',
      asset: 'USDT',
      fiatCurrency: 'INR',
      unitPriceFormatted: '94.76',
      quantityFormatted: '2,500.00',
      minOrderFormatted: '1,000.00',
      maxOrderFormatted: '236,900.00',
      paymentMethods: ['PhonePe', 'Google Pay (GPay)', 'UPI Instant'],
    },
    likedByUserIds: ['usr_alex_trader', 'usr_vikram_maker'],
    retweetedByUserIds: ['usr_alex_trader'],
    comments: [
      {
        id: 'cmt_seed_1',
        tweetId: 'tw_seed_101',
        authorId: 'usr_alex_trader',
        authorName: 'Alex Rivera',
        authorHandle: '@alex_rivera',
        authorAvatarUrl: TRADER_AVATAR_PRESETS[1].url,
        content: 'Great spread @priya_sharma_otc! Taking 500 #USDT on UPI right now.',
        createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 32 * 60_000).toISOString(),
  },
  {
    id: 'tw_seed_102',
    authorId: 'usr_vikram_maker',
    authorName: 'Vikram Patel Institutional',
    authorHandle: '@vikram_patel_desk',
    authorAvatarUrl: TRADER_AVATAR_PRESETS[2].url,
    authorVerified: true,
    authorReputationScore: 99.8,
    content:
      'Strong institutional accumulation on #Bitcoin ($BTC) and #Ethereum ($ETH) across Asian P2P desks this morning. Buy-side order book depth is up +28% with zero escrow disputes. Who else is accumulating $BTC and $SOL today? @alex_rivera',
    sentiment: 'BULLISH',
    taggedAssets: ['BTC', 'ETH', 'SOL'],
    taggedUserHandles: ['@alex_rivera'],
    imageUrl: MARKET_CHART_PRESETS[0].url,
    imageCaption: MARKET_CHART_PRESETS[0].caption,
    orderAttachment: {
      offerId: 'off_inr_btc_1',
      side: 'SELL',
      asset: 'BTC',
      fiatCurrency: 'INR',
      unitPriceFormatted: '7,840,442.00',
      quantityFormatted: '0.120000',
      minOrderFormatted: '5,000.00',
      maxOrderFormatted: '450,000.00',
      paymentMethods: ['IMPS Bank Transfer', 'NEFT', 'RTGS'],
    },
    likedByUserIds: ['usr_priya_maker'],
    retweetedByUserIds: [],
    comments: [],
    createdAt: new Date(Date.now() - 85 * 60_000).toISOString(),
  },
  {
    id: 'tw_seed_103',
    authorId: 'usr_alex_trader',
    authorName: 'Alex Rivera',
    authorHandle: '@alex_rivera',
    authorAvatarUrl: TRADER_AVATAR_PRESETS[1].url,
    authorVerified: true,
    authorReputationScore: 99.2,
    content:
      'Looking to buy #Ethereum ($ETH) and #Solana ($SOL) with instant INR / USD settlement! Posted my live BUY order on the market — verified sellers @priya_sharma_otc @vikram_patel_desk feel free to fill.',
    sentiment: 'BULLISH',
    taggedAssets: ['ETH', 'SOL', 'USDC'],
    taggedUserHandles: ['@priya_sharma_otc', '@vikram_patel_desk'],
    imageUrl: MARKET_CHART_PRESETS[1].url,
    imageCaption: MARKET_CHART_PRESETS[1].caption,
    orderAttachment: {
      side: 'BUY',
      asset: 'ETH',
      fiatCurrency: 'INR',
      unitPriceFormatted: '230,080.00',
      quantityFormatted: '1.500000',
      minOrderFormatted: '10,000.00',
      maxOrderFormatted: '345,120.00',
      paymentMethods: ['PhonePe', 'IMPS Bank Transfer'],
    },
    likedByUserIds: ['usr_priya_maker', 'usr_vikram_maker'],
    retweetedByUserIds: ['usr_priya_maker'],
    comments: [],
    createdAt: new Date(Date.now() - 160 * 60_000).toISOString(),
  },
];

interface SocialPulseViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  offers: OfferRecord[];
  orders: EscrowOrderRecord[];
  tweets: MarketTweetRecord[];
  livePriceFeed?: LivePriceFeed;
  theme?: 'day' | 'night';
  onCreateTweet: (payload: {
    content: string;
    sentiment: MarketTweetRecord['sentiment'];
    taggedAssets: CryptoAsset[];
    taggedUserHandles: string[];
    imageUrl?: string;
    imageCaption?: string;
    orderAttachment?: MarketTweetOrderAttachment;
  }) => Promise<void>;
  onToggleLikeTweet: (tweetId: string) => Promise<void>;
  onRetweet: (tweetId: string, quoteComment?: string) => Promise<void>;
  onAddComment: (tweetId: string, content: string) => Promise<void>;
  onDeleteTweet?: (tweetId: string) => Promise<void>;
  onUpdateProfile: (payload: {
    displayName: string;
    email?: string;
    avatarUrl?: string;
    bio?: string;
  }) => Promise<void>;
  onNavigateMarketplace: (offerId?: string, asset?: CryptoAsset) => void;
  onOpenTradeRoom?: (orderId: string) => void;
  onNavigateCreateOffer: () => void;
}

const ASSET_HASHTAG_LABELS: Record<CryptoAsset, { tag: string; name: string }> = {
  BTC: { tag: '#Bitcoin', name: 'Bitcoin ($BTC)' },
  ETH: { tag: '#Ethereum', name: 'Ethereum ($ETH)' },
  SOL: { tag: '#Solana', name: 'Solana ($SOL)' },
  BNB: { tag: '#BNB', name: 'BNB Chain ($BNB)' },
  USDT: { tag: '#USDT', name: 'Tether ($USDT)' },
  USDC: { tag: '#USDC', name: 'USD Coin ($USDC)' },
};

export const SocialPulseView: React.FC<SocialPulseViewProps> = ({
  currentUser,
  allUsers,
  offers,
  orders,
  tweets,
  livePriceFeed,
  onCreateTweet,
  onToggleLikeTweet,
  onRetweet,
  onAddComment,
  onDeleteTweet,
  onUpdateProfile,
  onNavigateMarketplace,
  onOpenTradeRoom,
  onNavigateCreateOffer,
}) => {
  // Composer state
  const [content, setContent] = useState('');
  const [sentiment, setSentiment] = useState<MarketTweetRecord['sentiment']>('BULLISH');
  const [selectedAssets, setSelectedAssets] = useState<CryptoAsset[]>(['BTC', 'ETH']);
  const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('NONE');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageCaption, setImageCaption] = useState<string>('');
  const [showImagePicker, setShowImagePicker] = useState<boolean>(false);
  const [posting, setPosting] = useState<boolean>(false);
  const [composerFeedback, setComposerFeedback] = useState<string | null>(null);

  // Profile Picture / Bio Quick-Editor Drawer on the Tweet Page
  const [editingProfilePic, setEditingProfilePic] = useState<boolean>(false);
  const [draftName, setDraftName] = useState<string>(currentUser.displayName.replace(' (You)', ''));
  const [draftBio, setDraftBio] = useState<string>(
    currentUser.bio || 'Verified P2P Escrow Trader · Active on BTC, ETH, SOL & USDT rails.'
  );
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string>(
    currentUser.avatarUrl || getDefaultAvatarForUser(currentUser)
  );
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Feed Filter State
  const [feedFilter, setFeedFilter] = useState<'ALL' | 'ORDERS_ONLY' | 'BULLISH' | 'BEARISH' | 'MY_POSTS'>('ALL');
  const [assetFilter, setAssetFilter] = useState<CryptoAsset | 'ALL'>('ALL');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({
    tw_seed_101: true,
  });
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [quoteModalTweet, setQuoteModalTweet] = useState<MarketTweetRecord | null>(null);
  const [quoteText, setQuoteText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserAvatar = useMemo(
    () => getDefaultAvatarForUser(currentUser),
    [currentUser]
  );
  const currentUserHandle = useMemo(
    () => formatUserHandle(currentUser.displayName, currentUser.email),
    [currentUser.displayName, currentUser.email]
  );

  const openOffers = useMemo(
    () => offers.filter((o) => o.status === 'OPEN'),
    [offers]
  );

  // Upload image for tweet via FileReader
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setImageCaption(file.name.replace(/\.[^/.]+$/, ''));
        setShowImagePicker(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload profile picture via FileReader
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfilePicture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      await onUpdateProfile({
        displayName: draftName.trim() || currentUser.displayName,
        email: currentUser.email,
        avatarUrl: draftAvatarUrl,
        bio: draftBio,
      });
      setProfileSavedMsg('Profile picture & trader bio updated across Market Feed!');
      setTimeout(() => {
        setEditingProfilePic(false);
        setProfileSavedMsg(null);
      }, 1500);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleAssetTag = (asset: CryptoAsset) => {
    const hashLabel = ASSET_HASHTAG_LABELS[asset].tag;
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
    if (!content.includes(hashLabel)) {
      setContent((prev) => `${prev.trim()} ${hashLabel} $${asset}`.trim());
    }
  };

  const toggleUserMention = (handle: string) => {
    setSelectedHandles((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]
    );
    if (!content.includes(handle)) {
      setContent((prev) => `${prev.trim()} ${handle}`.trim());
    }
  };

  const selectedOfferObj = useMemo(
    () => openOffers.find((o) => o.id === selectedOfferId),
    [openOffers, selectedOfferId]
  );

  const handleSelectOfferAttachment = (offerId: string) => {
    setSelectedOfferId(offerId);
    if (offerId !== 'NONE') {
      const found = openOffers.find((o) => o.id === offerId);
      if (found) {
        setSentiment('ORDER_ALERT');
        if (!selectedAssets.includes(found.asset)) {
          setSelectedAssets((prev) => [...prev, found.asset]);
        }
        const sym = FIAT_SYMBOLS[found.fiatCurrency] || '';
        const priceStr = formatMinor2(found.unitPriceFiatMinor);
        const qtyStr = formatMicro6(found.availableQuantityMicro);
        if (!content.trim()) {
          setContent(
            `Live P2P ${found.side} Order on Market: ${qtyStr} $${found.asset} @ ${sym}${priceStr} ${found.fiatCurrency} via ${found.paymentMethods.join(', ')}. Instant escrow settlement! ${ASSET_HASHTAG_LABELS[found.asset].tag}`
          );
        }
      }
    }
  };

  const handlePublishTweet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedOfferObj && !imageUrl) return;
    setPosting(true);
    setComposerFeedback(null);
    try {
      const orderAttachment: MarketTweetOrderAttachment | undefined = selectedOfferObj
        ? {
            offerId: selectedOfferObj.id,
            side: selectedOfferObj.side,
            asset: selectedOfferObj.asset,
            fiatCurrency: selectedOfferObj.fiatCurrency,
            unitPriceFormatted: formatMinor2(selectedOfferObj.unitPriceFiatMinor),
            quantityFormatted: formatMicro6(selectedOfferObj.availableQuantityMicro),
            minOrderFormatted: formatMinor2(selectedOfferObj.minOrderFiatMinor),
            maxOrderFormatted: formatMinor2(selectedOfferObj.maxOrderFiatMinor),
            paymentMethods: selectedOfferObj.paymentMethods,
          }
        : undefined;

      // Also extract any #tags or @handles typed directly in content
      const autoAssets = new Set<CryptoAsset>(selectedAssets);
      const upper = content.toUpperCase();
      if (upper.includes('#BITCOIN') || upper.includes('$BTC')) autoAssets.add('BTC');
      if (upper.includes('#ETHEREUM') || upper.includes('$ETH')) autoAssets.add('ETH');
      if (upper.includes('#SOLANA') || upper.includes('$SOL')) autoAssets.add('SOL');
      if (upper.includes('#BNB') || upper.includes('$BNB')) autoAssets.add('BNB');
      if (upper.includes('#USDT') || upper.includes('$USDT')) autoAssets.add('USDT');
      if (upper.includes('#USDC') || upper.includes('$USDC')) autoAssets.add('USDC');

      const mentionMatches = content.match(/@[a-zA-Z0-9_]+/g) || [];
      const mergedHandles = Array.from(new Set([...selectedHandles, ...mentionMatches]));

      await onCreateTweet({
        content:
          content.trim() ||
          `Published a live ${orderAttachment?.side || 'P2P'} order for $${orderAttachment?.asset || 'USDT'}!`,
        sentiment,
        taggedAssets: Array.from(autoAssets),
        taggedUserHandles: mergedHandles,
        imageUrl: imageUrl.trim() || undefined,
        imageCaption: imageCaption.trim() || undefined,
        orderAttachment,
      });

      setContent('');
      setImageUrl('');
      setImageCaption('');
      setSelectedOfferId('NONE');
      setSelectedHandles([]);
      setComposerFeedback('Your Market Tweet is now live on the feed!');
      setTimeout(() => setComposerFeedback(null), 3500);
    } finally {
      setPosting(false);
    }
  };

  const handleCommentSubmit = async (tweetId: string) => {
    const text = (commentInputs[tweetId] || '').trim();
    if (!text) return;
    await onAddComment(tweetId, text);
    setCommentInputs((prev) => ({ ...prev, [tweetId]: '' }));
    setExpandedComments((prev) => ({ ...prev, [tweetId]: true }));
  };

  const filteredTweets = useMemo(() => {
    return tweets.filter((tw) => {
      if (feedFilter === 'ORDERS_ONLY' && !tw.orderAttachment) return false;
      if (feedFilter === 'BULLISH' && tw.sentiment !== 'BULLISH') return false;
      if (feedFilter === 'BEARISH' && tw.sentiment !== 'BEARISH') return false;
      if (
        feedFilter === 'MY_POSTS' &&
        tw.authorId !== currentUser.id &&
        !tw.retweetedByUserIds.includes(currentUser.id)
      ) {
        return false;
      }
      if (assetFilter !== 'ALL' && !tw.taggedAssets.includes(assetFilter)) {
        return false;
      }
      return true;
    });
  }, [tweets, feedFilter, assetFilter, currentUser.id]);

  // Sentiment stats
  const sentimentStats = useMemo(() => {
    const total = Math.max(1, tweets.length);
    const bullishCount = tweets.filter(
      (t) => t.sentiment === 'BULLISH' || t.sentiment === 'ORDER_ALERT'
    ).length;
    const bearishCount = tweets.filter((t) => t.sentiment === 'BEARISH').length;
    const bullishPct = Math.round((bullishCount / total) * 100);
    const bearishPct = Math.round((bearishCount / total) * 100);
    return { bullishPct, bearishPct, orderTweetsCount: tweets.filter((t) => Boolean(t.orderAttachment)).length };
  }, [tweets]);

  // Format rich tweet text with highlighted #hashtags, $cashtags, and @mentions
  const renderFormattedTweetText = (rawText: string) => {
    const tokens = rawText.split(/(\s+)/);
    return tokens.map((token, idx) => {
      if (token.startsWith('#') || token.startsWith('$')) {
        return (
          <span
            key={idx}
            className="text-emerald-400 font-semibold hover:underline cursor-pointer"
            onClick={() => {
              const up = token.toUpperCase();
              if (up.includes('BTC') || up.includes('BITCOIN')) setAssetFilter('BTC');
              else if (up.includes('ETH') || up.includes('ETHEREUM')) setAssetFilter('ETH');
              else if (up.includes('SOL') || up.includes('SOLANA')) setAssetFilter('SOL');
              else if (up.includes('BNB')) setAssetFilter('BNB');
              else if (up.includes('USDT')) setAssetFilter('USDT');
              else if (up.includes('USDC')) setAssetFilter('USDC');
            }}
          >
            {token}
          </span>
        );
      }
      if (token.startsWith('@')) {
        return (
          <span key={idx} className="text-sky-400 font-mono font-semibold">
            {token}
          </span>
        );
      }
      return <React.Fragment key={idx}>{token}</React.Fragment>;
    });
  };

  return (
    <div className="max-w-[1320px] mx-auto space-y-6" data-testid="social-pulse-view">
      {/* Top Header Banner */}
      <div className="pb-5 border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-3.5 h-3.5" />
            <span>P2P Market Pulse · Live Order Broadcasts &amp; Trader Sentiment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display mt-1">
            Market Tweet &amp; Order Feed
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Broadcast your live P2P Buy/Sell orders, share market sentiment charts, tag{' '}
            <span className="text-emerald-400 font-mono">#Bitcoin</span>,{' '}
            <span className="text-emerald-400 font-mono">#Ethereum</span>, and other verified traders, and interact via Likes, Retweets, and Replies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="pulse-edit-profile-pic-btn"
            onClick={() => {
              setDraftName(currentUser.displayName.replace(' (You)', ''));
              setDraftAvatarUrl(currentUser.avatarUrl || getDefaultAvatarForUser(currentUser));
              setDraftBio(
                currentUser.bio || 'Verified P2P Escrow Trader · Active on BTC, ETH, SOL & USDT rails.'
              );
              setEditingProfilePic((prev) => !prev);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-100 inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <img
              src={currentUserAvatar}
              alt={currentUser.displayName}
              className="w-5 h-5 rounded-full object-cover border border-emerald-400/60"
            />
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Update Profile Picture</span>
          </button>

          <button
            type="button"
            onClick={onNavigateCreateOffer}
            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Post Order &amp; Auto-Tweet</span>
          </button>
        </div>
      </div>

      {/* Collapsible Profile Picture & Trader Identity Customizer */}
      {editingProfilePic && (
        <form
          onSubmit={handleSaveProfilePicture}
          data-testid="pulse-profile-picture-editor"
          className="p-5 bg-[#131A24] border border-emerald-500/40 rounded-2xl space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <img
                src={draftAvatarUrl}
                alt="Avatar preview"
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400 shadow-md"
              />
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  Customize Your Trader Profile Picture &amp; Handle
                </h2>
                <p className="text-xs text-slate-400">
                  Your profile photo and name appear on all your Tweets, Order Broadcasts, Likes, Retweets, and Replies.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfilePic(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Trader Display Name
                </label>
                <input
                  type="text"
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Trader Bio / Market Focus
                </label>
                <input
                  type="text"
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  placeholder="e.g. BTC & USDT OTC Desk · Instant UPI / IMPS"
                  className="w-full px-3.5 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Upload Custom Profile Picture or Paste Image URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                  <input
                    type="text"
                    value={draftAvatarUrl.startsWith('data:') ? '' : draftAvatarUrl}
                    onChange={(e) => setDraftAvatarUrl(e.target.value)}
                    placeholder="Or paste https:// image URL..."
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Or Choose a Verified Trader Avatar Preset:
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {TRADER_AVATAR_PRESETS.map((preset) => {
                  const selected = draftAvatarUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraftAvatarUrl(preset.url)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                        selected
                          ? 'bg-emerald-500/20 border-emerald-400 scale-105'
                          : 'bg-[#0B0E14] border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="text-[10px] text-slate-300 truncate w-full text-center">
                        {preset.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {profileSavedMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{profileSavedMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingProfilePic(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              data-testid="save-profile-picture-btn"
              className="px-5 py-2 text-xs font-bold text-[#0B0E14] bg-emerald-400 hover:bg-emerald-300 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{savingProfile ? 'Saving Profile...' : 'Save Profile Picture & Identity'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main 12-Column Social Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols): Tweet Composer + Interactive Feed */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tweet Composer Card */}
          <form
            onSubmit={handlePublishTweet}
            data-testid="market-tweet-composer"
            className="bg-[#131A24] border border-white/[0.08] rounded-2xl p-3.5 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3.5">
              <div className="flex items-center gap-3 sm:block">
                <button
                  type="button"
                  onClick={() => setEditingProfilePic(true)}
                  title="Click to update your profile picture"
                  className="relative group shrink-0 cursor-pointer"
                >
                  <img
                    src={currentUserAvatar}
                    alt={currentUser.displayName}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-emerald-400/70"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-[#0B0E14] flex items-center justify-center shadow">
                    <Camera className="w-3 h-3" />
                  </span>
                </button>
                <div className="sm:hidden flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-bold text-slate-100">
                    {currentUser.displayName.replace(' (You)', '')}
                  </span>
                  <span className="font-mono text-slate-400">{currentUserHandle}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-100">
                      {currentUser.displayName.replace(' (You)', '')}
                    </span>
                    <span className="font-mono text-slate-400">{currentUserHandle}</span>
                    <span className="text-emerald-400 inline-flex items-center gap-0.5 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Trader
                    </span>
                  </div>

                  {/* Market Sentiment Selector */}
                  <div className="flex flex-wrap sm:inline-flex w-full sm:w-auto p-0.5 bg-[#0B0E14] border border-white/10 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSentiment('BULLISH')}
                      className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md font-semibold cursor-pointer inline-flex items-center gap-1 ${
                        sentiment === 'BULLISH'
                          ? 'bg-emerald-500 text-[#0B0E14]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Bullish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentiment('BEARISH')}
                      className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md font-semibold cursor-pointer inline-flex items-center gap-1 ${
                        sentiment === 'BEARISH'
                          ? 'bg-red-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TrendingDown className="w-3 h-3" />
                      <span>Bearish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentiment('ORDER_ALERT')}
                      className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md font-semibold cursor-pointer inline-flex items-center gap-1 ${
                        sentiment === 'ORDER_ALERT'
                          ? 'bg-amber-400 text-[#0B0E14]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Order Broadcast</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  data-testid="tweet-composer-textarea"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your P2P order details, market sentiment, or chart analysis... Tag #Bitcoin, #Ethereum, $SOL, or @traders!"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />

                {/* 1-Click Crypto Asset Tagging Bar (#Bitcoin, #Ethereum, etc.) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-emerald-400" />
                    <span>Tag Crypto Assets in Tweet:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ALL_CRYPTO_ASSETS.map((asset) => {
                      const active = selectedAssets.includes(asset);
                      const info = ASSET_HASHTAG_LABELS[asset];
                      return (
                        <button
                          key={asset}
                          type="button"
                          data-testid={`tag-asset-btn-${asset}`}
                          onClick={() => toggleAssetTag(asset)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            active
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                              : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <CryptoAssetIcon asset={asset} className="w-3.5 h-3.5" />
                          <span>{info.tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1-Click Tag Other Traders (@mentions) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-sky-400" />
                    <span>Tag Other Traders (@mention):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {allUsers
                      .filter((u) => u.id !== currentUser.id && u.role !== 'ADMIN')
                      .map((u) => {
                        const handle = formatUserHandle(u.displayName, u.email);
                        const active = selectedHandles.includes(handle);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleUserMention(handle)}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                              active
                                ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                                : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <img
                              src={getDefaultAvatarForUser(u)}
                              alt={u.displayName}
                              className="w-3.5 h-3.5 rounded-full object-cover"
                            />
                            <span>{handle}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Attach a Live P2P Order / Offer to Broadcast as a Tweet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Attach P2P Market Order Card (Optional)
                    </label>
                    <select
                      aria-label="Attach P2P Market Order Card"
                      data-testid="tweet-attach-offer-select"
                      value={selectedOfferId}
                      onChange={(e) => handleSelectOfferAttachment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                    >
                      <option value="NONE">— No Order Attached (Sentiment / Update Tweet) —</option>
                      {openOffers.map((off) => (
                        <option key={off.id} value={off.id}>
                          [{off.side}] {formatMicro6(off.availableQuantityMicro)} {off.asset} @{' '}
                          {FIAT_SYMBOLS[off.fiatCurrency]}
                          {formatMinor2(off.unitPriceFiatMinor)} ({off.makerName.replace(' (You)', '')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 rounded-xl bg-[#0B0E14] hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Upload Image</span>
                      </button>
                      <button
                        type="button"
                        data-testid="toggle-chart-presets-btn"
                        onClick={() => setShowImagePicker((v) => !v)}
                        className="px-3 py-2 rounded-xl bg-[#0B0E14] hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                        <span>Attach Market Chart</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Chart / Image Picker Drawer */}
                {showImagePicker && (
                  <div className="p-3.5 bg-[#0B0E14] border border-white/15 rounded-xl space-y-3">
                    <div className="text-xs font-semibold text-slate-200">
                      Select a Market Sentiment Chart or Paste Custom Image URL:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {MARKET_CHART_PRESETS.map((chart) => (
                        <button
                          key={chart.id}
                          type="button"
                          onClick={() => {
                            setImageUrl(chart.url);
                            setImageCaption(chart.caption);
                            setShowImagePicker(false);
                          }}
                          className="p-2 rounded-xl bg-[#131A24] border border-white/10 hover:border-emerald-400 text-left space-y-1.5 cursor-pointer transition-colors"
                        >
                          <img
                            src={chart.url}
                            alt={chart.label}
                            className="w-full h-20 object-cover rounded-lg"
                          />
                          <div className="text-[11px] font-semibold text-slate-200 line-clamp-1">
                            {chart.label}
                          </div>
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={imageUrl.startsWith('data:') ? '' : imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Or paste custom image URL (https://...)"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                    />
                  </div>
                )}

                {/* Attached Image Preview */}
                {imageUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-white/15 bg-[#0B0E14]">
                    <img
                      src={imageUrl}
                      alt={imageCaption || 'Attached market visual'}
                      className="w-full max-h-60 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setImageCaption('');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 text-white hover:bg-red-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {composerFeedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{composerFeedback}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-white/[0.08]">
                  <div className="text-[11px] font-mono text-slate-400">
                    Posting as <strong className="text-slate-200">{currentUserHandle}</strong>
                  </div>
                  <button
                    type="submit"
                    disabled={posting}
                    data-testid="publish-tweet-submit-btn"
                    className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{posting ? 'Posting Tweet...' : 'Post Tweet to Market Feed'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Feed Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131A24] border border-white/[0.08] rounded-xl p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'ALL', label: 'All Tweets' },
                  { id: 'ORDERS_ONLY', label: 'P2P Order Broadcasts' },
                  { id: 'BULLISH', label: 'Bullish' },
                  { id: 'BEARISH', label: 'Bearish' },
                  { id: 'MY_POSTS', label: 'My Tweets & Retweets' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    feedFilter === tab.id
                      ? 'bg-emerald-500 text-[#0B0E14]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {assetFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setAssetFilter('ALL')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-xs font-mono text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Filter: #{assetFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Tweet Stream */}
          <div className="space-y-4" data-testid="market-tweet-feed-list">
            {filteredTweets.map((tweet) => {
              const isLiked = tweet.likedByUserIds.includes(currentUser.id);
              const isRetweeted = tweet.retweetedByUserIds.includes(currentUser.id);
              const commentsOpen = Boolean(expandedComments[tweet.id]);
              // Sync author avatar if the tweet belongs to a known user who updated their avatar
              const matchedAuthor = allUsers.find((u) => u.id === tweet.authorId);
              const displayAvatar =
                matchedAuthor?.avatarUrl ||
                tweet.authorAvatarUrl ||
                getDefaultAvatarForUser(matchedAuthor);
              const displayAuthorName =
                matchedAuthor?.displayName.replace(' (You)', '') || tweet.authorName;

              return (
                <article
                  key={tweet.id}
                  data-testid={`market-tweet-card-${tweet.id}`}
                  className="bg-[#131A24] border border-white/[0.08] rounded-2xl p-5 space-y-4 transition-colors hover:border-white/15"
                >
                  {/* Retweet Header if applicable */}
                  {(tweet.retweetedByName || isRetweeted) && (
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 pb-1 border-b border-white/[0.06]">
                      <Repeat2 className="w-3.5 h-3.5" />
                      <span>
                        Retweeted by{' '}
                        {tweet.retweetedByName ||
                          (isRetweeted ? currentUser.displayName.replace(' (You)', '') : 'Trader')}
                      </span>
                    </div>
                  )}

                  {/* Tweet Author Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={displayAvatar}
                        alt={displayAuthorName}
                        className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-100 truncate">
                            {displayAuthorName}
                          </span>
                          {tweet.authorVerified && (
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span className="text-xs font-mono text-slate-400 truncate">
                            {tweet.authorHandle}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-mono text-slate-400">
                            {new Date(tweet.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Trust Score: {tweet.authorReputationScore.toFixed(1)}% · Verified P2P Trader
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border ${
                          tweet.sentiment === 'BULLISH'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : tweet.sentiment === 'BEARISH'
                            ? 'bg-red-500/15 border-red-500/40 text-red-300'
                            : tweet.sentiment === 'ORDER_ALERT'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-slate-800 border-white/10 text-slate-300'
                        }`}
                      >
                        {tweet.sentiment === 'ORDER_ALERT' ? 'LIVE ORDER' : tweet.sentiment}
                      </span>

                      {tweet.authorId === currentUser.id && onDeleteTweet && (
                        <button
                          type="button"
                          onClick={() => onDeleteTweet(tweet.id)}
                          title="Delete your tweet"
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tweet Body Prose */}
                  <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">
                    {renderFormattedTweetText(tweet.content)}
                  </p>

                  {/* Tagged Assets & Tagged Users Row */}
                  {(tweet.taggedAssets.length > 0 || tweet.taggedUserHandles.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                      {tweet.taggedAssets.map((sym) => {
                        const liveUsd = livePriceFeed?.rates?.[sym]?.usd;
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => setAssetFilter(sym)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B0E14] border border-white/10 text-slate-200 hover:border-emerald-400 cursor-pointer"
                          >
                            <CryptoAssetIcon asset={sym} className="w-3.5 h-3.5" />
                            <span className="font-bold">{ASSET_HASHTAG_LABELS[sym].tag}</span>
                            {liveUsd && (
                              <span className="text-emerald-400">${liveUsd.toLocaleString()}</span>
                            )}
                          </button>
                        );
                      })}
                      {tweet.taggedUserHandles.map((handle) => (
                        <span
                          key={handle}
                          className="px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300"
                        >
                          {handle}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Embedded Live P2P Order Broadcast Card */}
                  {tweet.orderAttachment && (
                    <div
                      data-testid={`tweet-order-card-${tweet.id}`}
                      className="p-4 rounded-xl bg-[#0B0E14] border border-emerald-500/35 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                        <div className="flex items-center gap-2">
                          <CryptoAssetIcon asset={tweet.orderAttachment.asset} className="w-5 h-5" />
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              tweet.orderAttachment.side === 'SELL'
                                ? 'bg-emerald-500 text-[#0B0E14]'
                                : 'bg-sky-400 text-[#0B0E14]'
                            }`}
                          >
                            P2P {tweet.orderAttachment.side} ORDER
                          </span>
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {tweet.orderAttachment.quantityFormatted} {tweet.orderAttachment.asset}
                          </span>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-xs text-slate-400">Unit Price: </span>
                          <span className="text-sm font-bold text-emerald-400">
                            {FIAT_SYMBOLS[tweet.orderAttachment.fiatCurrency]}
                            {tweet.orderAttachment.unitPriceFormatted}{' '}
                            {tweet.orderAttachment.fiatCurrency}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                        <div className="space-y-1 text-slate-300">
                          <div>
                            Order Limits:{' '}
                            <strong className="text-slate-100">
                              {FIAT_SYMBOLS[tweet.orderAttachment.fiatCurrency]}
                              {tweet.orderAttachment.minOrderFormatted} –{' '}
                              {FIAT_SYMBOLS[tweet.orderAttachment.fiatCurrency]}
                              {tweet.orderAttachment.maxOrderFormatted}
                            </strong>
                          </div>
                          <div className="text-slate-400">
                            Payment Rails: {tweet.orderAttachment.paymentMethods.join(' · ')}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (tweet.orderAttachment?.orderId && onOpenTradeRoom) {
                              onOpenTradeRoom(tweet.orderAttachment.orderId);
                            } else {
                              onNavigateMarketplace(
                                tweet.orderAttachment?.offerId,
                                tweet.orderAttachment?.asset
                              );
                            }
                          }}
                          className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] font-sans font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
                        >
                          <span>Trade This Order on Market</span>
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Shared Image / Chart */}
                  {tweet.imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0B0E14]">
                      <img
                        src={tweet.imageUrl}
                        alt={tweet.imageCaption || 'Market sentiment image'}
                        className="w-full max-h-80 object-cover"
                      />
                      {tweet.imageCaption && (
                        <div className="px-3.5 py-2 text-xs font-mono text-slate-400 border-t border-white/[0.06]">
                          {tweet.imageCaption}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Social Action Bar: Like, Retweet, Comment */}
                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-4 text-xs font-mono">
                    <div className="flex items-center gap-6">
                      {/* Like Button */}
                      <button
                        type="button"
                        data-testid={`like-tweet-btn-${tweet.id}`}
                        onClick={() => onToggleLikeTweet(tweet.id)}
                        className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isLiked
                            ? 'text-rose-400 font-bold'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-400' : ''}`} />
                        <span>{tweet.likedByUserIds.length}</span>
                        <span className="hidden sm:inline">Likes</span>
                      </button>

                      {/* Retweet Button */}
                      <button
                        type="button"
                        data-testid={`retweet-btn-${tweet.id}`}
                        onClick={() => onRetweet(tweet.id)}
                        className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isRetweeted
                            ? 'text-emerald-400 font-bold'
                            : 'text-slate-400 hover:text-emerald-400'
                        }`}
                      >
                        <Repeat2 className="w-4 h-4" />
                        <span>{tweet.retweetedByUserIds.length}</span>
                        <span className="hidden sm:inline">
                          {isRetweeted ? 'Retweeted' : 'Retweet'}
                        </span>
                      </button>

                      {/* Quote Retweet Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setQuoteModalTweet(tweet);
                          setQuoteText('');
                        }}
                        className="text-slate-400 hover:text-sky-400 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Quote</span>
                      </button>

                      {/* Comment / Reply Toggle */}
                      <button
                        type="button"
                        data-testid={`toggle-comments-btn-${tweet.id}`}
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [tweet.id]: !prev[tweet.id],
                          }))
                        }
                        className="text-slate-400 hover:text-sky-400 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{tweet.comments.length}</span>
                        <span className="hidden sm:inline">Comments</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      Escrow Verified Post
                    </span>
                  </div>

                  {/* Expandable Comments & Reply Thread */}
                  {commentsOpen && (
                    <div
                      data-testid={`tweet-comments-section-${tweet.id}`}
                      className="pt-3 border-t border-white/[0.06] space-y-3"
                    >
                      {tweet.comments.map((cmt) => {
                        const cmtUser = allUsers.find((u) => u.id === cmt.authorId);
                        const cmtAvatar =
                          cmtUser?.avatarUrl ||
                          cmt.authorAvatarUrl ||
                          getDefaultAvatarForUser(cmtUser);
                        return (
                          <div
                            key={cmt.id}
                            className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0B0E14] border border-white/[0.06]"
                          >
                            <img
                              src={cmtAvatar}
                              alt={cmt.authorName}
                              className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-slate-200">{cmt.authorName}</span>
                                <span className="font-mono text-slate-400">{cmt.authorHandle}</span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1">
                                {renderFormattedTweetText(cmt.content)}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Comment Input using current user's profile picture */}
                      <div className="flex items-center gap-2.5 pt-1">
                        <img
                          src={currentUserAvatar}
                          alt={currentUser.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-emerald-400/50 shrink-0"
                        />
                        <input
                          type="text"
                          data-testid={`comment-input-${tweet.id}`}
                          value={commentInputs[tweet.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [tweet.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommentSubmit(tweet.id);
                            }
                          }}
                          placeholder={`Reply as ${currentUserHandle} (tag #Bitcoin, #Ethereum or @users)...`}
                          className="flex-1 px-3.5 py-2 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                        />
                        <button
                          type="button"
                          data-testid={`comment-submit-btn-${tweet.id}`}
                          onClick={() => handleCommentSubmit(tweet.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B0E14] text-xs font-bold cursor-pointer shrink-0"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): Trader Profile Card, Sentiment Gauge & Trending Tags */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Active Trader Social Profile Card */}
          <div className="bg-[#131A24] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <img
                src={currentUserAvatar}
                alt={currentUser.displayName}
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400"
              />
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-100 truncate">
                  {currentUser.displayName.replace(' (You)', '')}
                </div>
                <div className="text-xs font-mono text-emerald-400 truncate">
                  {currentUserHandle}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Reputation: {currentUser.reputationScore.toFixed(1)}% · {currentUser.completedTrades} Trades
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {currentUser.bio ||
                'Verified P2P Escrow Trader · Broadcasting live BTC, ETH, SOL & USDT liquidity.'}
            </p>

            <button
              type="button"
              onClick={() => setEditingProfilePic(true)}
              className="w-full py-2 px-3 rounded-xl bg-[#0B0E14] hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Change Profile Picture &amp; Bio</span>
            </button>
          </div>

          {/* Real-Time Market Sentiment Meter */}
          <div className="bg-[#131A24] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Community Order Sentiment
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {sentimentStats.bullishPct}% Bullish
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-red-500/30 overflow-hidden flex">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${sentimentStats.bullishPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Bullish / Order Broadcasts: {sentimentStats.bullishPct}%</span>
              <span>Bearish: {sentimentStats.bearishPct}%</span>
            </div>
          </div>

          {/* Trending Crypto Tags (#Bitcoin, #Ethereum, #Solana, etc.) */}
          <div className="bg-[#131A24] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Trending Crypto Tags
            </div>
            <div className="space-y-2">
              {ALL_CRYPTO_ASSETS.map((sym) => {
                const rate = livePriceFeed?.rates?.[sym];
                const count = tweets.filter((t) => t.taggedAssets.includes(sym)).length;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setAssetFilter(assetFilter === sym ? 'ALL' : sym)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-colors ${
                      assetFilter === sym
                        ? 'bg-emerald-500/15 border-emerald-400 text-slate-100'
                        : 'bg-[#0B0E14] border-white/[0.06] hover:border-white/20 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CryptoAssetIcon asset={sym} className="w-5 h-5" />
                      <div>
                        <div className="text-xs font-bold">{ASSET_HASHTAG_LABELS[sym].tag}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {count} market tweets
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-slate-100">
                        ${rate?.usd?.toLocaleString() || '1.00'}
                      </div>
                      <div
                        className={`text-[10px] ${
                          (rate?.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {(rate?.change24h ?? 0) >= 0 ? '+' : ''}
                        {(rate?.change24h ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Quote Retweet Modal */}
      {quoteModalTweet && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-[#131A24] border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Repeat2 className="w-4 h-4 text-emerald-400" />
                <span>Quote Retweet to Market Feed</span>
              </h3>
              <button
                type="button"
                onClick={() => setQuoteModalTweet(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder="Add your market commentary, #Bitcoin #Ethereum tags, or @mentions..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
            />

            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-slate-200">
                {quoteModalTweet.authorName} ({quoteModalTweet.authorHandle})
              </div>
              <p className="line-clamp-2 text-slate-400">{quoteModalTweet.content}</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteModalTweet(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRetweet(
                    quoteModalTweet.id,
                    quoteText.trim() || `Retweeted ${quoteModalTweet.authorHandle}'s market order update!`
                  );
                  setQuoteModalTweet(null);
                  setQuoteText('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-400 text-[#0B0E14] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Repeat2 className="w-3.5 h-3.5" />
                <span>Post Quote Retweet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
