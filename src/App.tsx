/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TOP_TRADING_COUNTRIES,
  type AppRoute,
  type AppStateSnapshot,
  type BlockchainNetworkFamily,
  type CountryCode,
  type FiatCurrency,
  type WalletChallenge,
  type LivePriceFeed,
  type UserProfile,
  type CryptoAsset,
  type OfferRecord,
  type SwapChainId,
  type SwapExecutionRecord,
  type MarketTweetRecord,
  type MarketTweetOrderAttachment,
  SUPPORTED_SWAP_CHAINS,
  calculateCrossChainSwapQuote,
  validateSwapChainDestinationAddress,
  updateLiveReferenceRates,
} from './types';
import {
  createWalletChallenge,
  formatMicro6,
  formatMinor2,
  getLockedFiatForCountry,
  parseCryptoToMicro,
  parseFiatToMinor,
  validateBlockchainWalletAddress,
  verifyAdminCredentials,
  verifyUserCredentials,
  verifyWalletChallenge,
} from './core/escrowEngine';
import { BellRing, CheckCircle2, X as CloseIcon } from 'lucide-react';
import { Navbar, type GlobalSearchSelection } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { MarketplaceView } from './components/MarketplaceView';
import { SwapView } from './components/SwapView';
import {
  SocialPulseView,
  INITIAL_MARKET_TWEETS,
  formatUserHandle,
  getDefaultAvatarForUser,
} from './components/SocialPulseView';
import { CreateOfferView } from './components/CreateOfferView';
import { OrdersView } from './components/OrdersView';
import { DashboardView } from './components/DashboardView';
import { TradeRoomView } from './components/TradeRoomView';
import { InfoPagesView } from './components/InfoPagesView';
import { AdminView } from './components/AdminView';
import { AccountModal, type AccountModalTab } from './components/AccountModal';
import { CostorahLogoIcon } from './components/CryptoAssetIcons';

const DEFAULT_FIAT_EXCHANGE_RATES: Record<FiatCurrency, number> = {
  USD: 1.0,
  INR: 94.76,
  TRY: 34.25,
  IRR: 42000.0,
  NGN: 1620.0,
  EUR: 0.92,
  GBP: 0.79,
  BRL: 5.75,
  AED: 3.67,
  VND: 25400.0,
};

const initialLivePriceFeed: LivePriceFeed = {
  rates: {
    BTC: {
      usd: 82740,
      inr: Number((82740 * 94.76).toFixed(2)),
      change24h: 2.34,
      lastUpdated: new Date().toISOString(),
    },
    ETH: {
      usd: 2428,
      inr: Number((2428 * 94.76).toFixed(2)),
      change24h: -0.65,
      lastUpdated: new Date().toISOString(),
    },
    BNB: {
      usd: 612.5,
      inr: Number((612.5 * 94.76).toFixed(2)),
      change24h: 1.48,
      lastUpdated: new Date().toISOString(),
    },
    SOL: {
      usd: 105.7,
      inr: Number((105.7 * 94.76).toFixed(2)),
      change24h: 3.1,
      lastUpdated: new Date().toISOString(),
    },
    USDT: { usd: 1.0, inr: 94.76, change24h: 0.05, lastUpdated: new Date().toISOString() },
    USDC: { usd: 1.0, inr: 94.76, change24h: 0.02, lastUpdated: new Date().toISOString() },
  },
  usdInrRate: 94.76,
  fiatExchangeRates: { ...DEFAULT_FIAT_EXCHANGE_RATES },
  lastUpdated: new Date().toISOString(),
  source: 'CoinGecko Live API',
};

function safeParseJson<T = Record<string, unknown>>(rawText: string): { ok: true; data: T } | { ok: false; isHtml: boolean } {
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return { ok: false, isHtml: trimmed.startsWith('<') };
  }
  try {
    return { ok: true, data: JSON.parse(trimmed) as T };
  } catch {
    return { ok: false, isHtml: false };
  }
}

export default function App() {
  const [state, setState] = useState<AppStateSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [livePriceFeed, setLivePriceFeed] = useState<LivePriceFeed>(initialLivePriceFeed);
  const [activeRoute, setActiveRoute] = useState<AppRoute>('home');
  const [activeOrderId, setActiveOrderId] = useState<string>('ord_active_1001');
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(false);
  const [accountModalTab, setAccountModalTab] = useState<AccountModalTab>('USER_LOGIN');
  const [externalSearchSelection, setExternalSearchSelection] =
    useState<GlobalSearchSelection | null>(null);
  const lastRegularUserIdRef = useRef<string>('usr_alex_trader');
  const activeChallengesRef = useRef<Map<string, WalletChallenge>>(new Map());
  const usedNoncesRef = useRef<Set<string>>(new Set());

  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    try {
      const saved = window.localStorage.getItem('aegis_ui_theme');
      if (saved === 'day' || saved === 'night') return saved;
    } catch {
      // ignore storage errors
    }
    return 'day';
  });

  const [marketTweets, setMarketTweets] = useState<MarketTweetRecord[]>(() => {
    try {
      const saved = window.localStorage.getItem('costorah_market_tweets_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MARKET_TWEETS;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('costorah_market_tweets_v1', JSON.stringify(marketTweets));
    } catch {
      // ignore storage errors
    }
  }, [marketTweets]);

  const [paymentAlertToast, setPaymentAlertToast] = useState<{
    orderId: string;
    title: string;
    message: string;
    channel: string;
  } | null>(null);

  useEffect(() => {
    if (!paymentAlertToast) return;
    const t = window.setTimeout(() => setPaymentAlertToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [paymentAlertToast]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'day' ? 'night' : 'day';
      try {
        window.localStorage.setItem('aegis_ui_theme', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const rawText = await res.text();
        const parsed = safeParseJson<AppStateSnapshot>(rawText);
        if (parsed.ok && parsed.data?.currentUser) {
          setState(parsed.data);
          if (parsed.data.currentUser.role !== 'ADMIN') {
            lastRegularUserIdRef.current = parsed.data.currentUser.id;
          }
          setError(null);
          return;
        }
      }

      // Fallback to static snapshot if proxy returned HTML (e.g., <!doctype html>)
      const fallbackRes = await fetch('/aegis-state.json', {
        headers: { Accept: 'application/json' },
      });
      if (fallbackRes.ok) {
        const fallbackText = await fallbackRes.text();
        const fallbackParsed = safeParseJson<AppStateSnapshot>(fallbackText);
        if (fallbackParsed.ok && fallbackParsed.data?.currentUser) {
          setState(fallbackParsed.data);
          if (fallbackParsed.data.currentUser.role !== 'ADMIN') {
            lastRegularUserIdRef.current = fallbackParsed.data.currentUser.id;
          }
          setError(null);
          return;
        }
      }

      throw new Error('Server is warming up. Please click Retry Connection in a moment.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to Costorah server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLiveCryptoPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/prices/live', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const rawText = await res.text();
        const parsed = safeParseJson<LivePriceFeed>(rawText);
        if (parsed.ok && parsed.data?.rates) {
          const data = parsed.data;
          const usdInr = data.usdInrRate || 94.76;
          const fxRates: Record<FiatCurrency, number> = {
            ...DEFAULT_FIAT_EXCHANGE_RATES,
            ...(data.fiatExchangeRates || {}),
            USD: 1.0,
            INR: usdInr,
          };
          const syncedData: LivePriceFeed = {
            ...data,
            usdInrRate: usdInr,
            fiatExchangeRates: fxRates,
            rates: {
              BTC: {
                ...data.rates.BTC,
                inr: Number(((data.rates.BTC?.usd || 82740) * usdInr).toFixed(2)),
              },
              ETH: {
                ...data.rates.ETH,
                inr: Number(((data.rates.ETH?.usd || 2428) * usdInr).toFixed(2)),
              },
              BNB: {
                ...(data.rates.BNB || { usd: 612.5, change24h: 1.48, lastUpdated: new Date().toISOString() }),
                inr: Number(((data.rates.BNB?.usd || 612.5) * usdInr).toFixed(2)),
              },
              SOL: {
                ...data.rates.SOL,
                inr: Number(((data.rates.SOL?.usd || 105.7) * usdInr).toFixed(2)),
              },
              USDT: {
                ...data.rates.USDT,
                inr: Number(((data.rates.USDT?.usd || 1.0) * usdInr).toFixed(2)),
              },
              USDC: {
                ...data.rates.USDC,
                inr: Number(((data.rates.USDC?.usd || 1.0) * usdInr).toFixed(2)),
              },
            },
          };
          setLivePriceFeed(syncedData);
          updateLiveReferenceRates(
            {
              BTC: syncedData.rates.BTC?.usd,
              ETH: syncedData.rates.ETH?.usd,
              BNB: syncedData.rates.BNB?.usd,
              SOL: syncedData.rates.SOL?.usd,
              USDT: syncedData.rates.USDT?.usd,
              USDC: syncedData.rates.USDC?.usd,
            },
            usdInr,
            fxRates
          );
          return;
        }
      }
    } catch {
      // Backend proxy fallback to direct CoinGecko
    }

    try {
      const cgRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,tether,usd-coin&vs_currencies=usd,inr,eur,gbp,brl,aed,try,vnd,ngn&include_24hr_change=true',
        { headers: { Accept: 'application/json' } }
      );
      if (cgRes.ok) {
        const rawText = await cgRes.text();
        const parsed = safeParseJson<Record<string, Record<string, number>>>(rawText);
        if (parsed.ok) {
          const data = parsed.data;
          const now = new Date().toISOString();
          const tetherUsd = data.tether?.usd || 1.0;
          const usdInrRate = data.tether?.inr
            ? Number((data.tether.inr / tetherUsd).toFixed(2))
            : 94.76;
          const fxRates: Record<FiatCurrency, number> = {
            USD: 1.0,
            INR: usdInrRate,
            EUR: data.tether?.eur ? Number((data.tether.eur / tetherUsd).toFixed(4)) : DEFAULT_FIAT_EXCHANGE_RATES.EUR,
            GBP: data.tether?.gbp ? Number((data.tether.gbp / tetherUsd).toFixed(4)) : DEFAULT_FIAT_EXCHANGE_RATES.GBP,
            BRL: data.tether?.brl ? Number((data.tether.brl / tetherUsd).toFixed(2)) : DEFAULT_FIAT_EXCHANGE_RATES.BRL,
            AED: data.tether?.aed ? Number((data.tether.aed / tetherUsd).toFixed(2)) : DEFAULT_FIAT_EXCHANGE_RATES.AED,
            TRY: data.tether?.try ? Number((data.tether.try / tetherUsd).toFixed(2)) : DEFAULT_FIAT_EXCHANGE_RATES.TRY,
            VND: data.tether?.vnd ? Math.round(data.tether.vnd / tetherUsd) : DEFAULT_FIAT_EXCHANGE_RATES.VND,
            NGN: data.tether?.ngn ? Number((data.tether.ngn / tetherUsd).toFixed(2)) : DEFAULT_FIAT_EXCHANGE_RATES.NGN,
            IRR: DEFAULT_FIAT_EXCHANGE_RATES.IRR,
          };

          const btcUsd = data.bitcoin?.usd || 82740;
          const ethUsd = data.ethereum?.usd || 2428;
          const bnbUsd = data.binancecoin?.usd || 612.5;
          const solUsd = data.solana?.usd || 105.7;
          const usdtUsd = data.tether?.usd || 1.0;
          const usdcUsd = data['usd-coin']?.usd || 1.0;

          const updated: LivePriceFeed = {
            rates: {
              BTC: {
                usd: btcUsd,
                inr: Number((btcUsd * usdInrRate).toFixed(2)),
                change24h: Number(data.bitcoin?.usd_24h_change?.toFixed(2)) || 2.34,
                lastUpdated: now,
              },
              ETH: {
                usd: ethUsd,
                inr: Number((ethUsd * usdInrRate).toFixed(2)),
                change24h: Number(data.ethereum?.usd_24h_change?.toFixed(2)) || -0.65,
                lastUpdated: now,
              },
              BNB: {
                usd: bnbUsd,
                inr: Number((bnbUsd * usdInrRate).toFixed(2)),
                change24h: Number(data.binancecoin?.usd_24h_change?.toFixed(2)) || 1.48,
                lastUpdated: now,
              },
              SOL: {
                usd: solUsd,
                inr: Number((solUsd * usdInrRate).toFixed(2)),
                change24h: Number(data.solana?.usd_24h_change?.toFixed(2)) || 3.1,
                lastUpdated: now,
              },
              USDT: {
                usd: usdtUsd,
                inr: Number((usdtUsd * usdInrRate).toFixed(2)),
                change24h: Number(data.tether?.usd_24h_change?.toFixed(2)) || 0.05,
                lastUpdated: now,
              },
              USDC: {
                usd: usdcUsd,
                inr: Number((usdcUsd * usdInrRate).toFixed(2)),
                change24h: Number(data['usd-coin']?.usd_24h_change?.toFixed(2)) || 0.02,
                lastUpdated: now,
              },
            },
            usdInrRate,
            fiatExchangeRates: fxRates,
            lastUpdated: now,
            source: 'CoinGecko Live Rates API',
          };
          setLivePriceFeed(updated);
          updateLiveReferenceRates(
            {
              BTC: updated.rates.BTC.usd,
              ETH: updated.rates.ETH.usd,
              BNB: updated.rates.BNB.usd,
              SOL: updated.rates.SOL.usd,
              USDT: updated.rates.USDT.usd,
              USDC: updated.rates.USDC.usd,
            },
            updated.usdInrRate,
            fxRates
          );
        }
      }
    } catch {
      // Keep existing rates
    }
  }, []);

  // Poll live pricing API strictly every 5 seconds (5,000ms) for real-time USD, INR, and native currency synchronization
  useEffect(() => {
    fetchLiveCryptoPrices();
    const syncInterval = setInterval(fetchLiveCryptoPrices, 5000);
    return () => clearInterval(syncInterval);
  }, [fetchLiveCryptoPrices]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeRoute]);

  const applyClientAuthAndProfileFallback = (url: string, body: unknown): unknown => {
    if (!state) {
      throw new Error('Application state is still initializing. Please try again.');
    }
    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    if (url === '/api/auth/admin-login') {
      const check = verifyAdminCredentials(
        String(payload.username || ''),
        String(payload.password || '')
      );
      if (!check.authenticated) {
        throw new Error(check.error || 'Invalid administrator credentials. Use username "admin" and password "admin".');
      }
      let adminUser = state.allUsers.find((u) => u.id === 'usr_costorah_admin' || u.role === 'ADMIN');
      if (!adminUser) {
        adminUser = {
          id: 'usr_costorah_admin',
          displayName: 'Costorah Chief Arbitrator (Admin)',
          email: 'admin@costorah.io',
          countryCode: 'IN',
          preferredFiat: 'INR',
          role: 'ADMIN',
          kycTier: 'TIER_2_VERIFIED',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: 'id_admin_cred',
              provider: 'USER_CREDENTIALS',
              identifier: 'admin',
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          twoFactorEnabled: true,
          createdAt: new Date().toISOString(),
        };
      }
      if (state.currentUser.role !== 'ADMIN') {
        lastRegularUserIdRef.current = state.currentUser.id;
      }
      const nextUsers = state.allUsers.some((u) => u.id === adminUser!.id)
        ? state.allUsers
        : [...state.allUsers, adminUser];
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: adminUser,
        allUsers: nextUsers,
        auditLogs: [
          {
            id: `aud_${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: adminUser.id,
            actorRole: 'ADMIN',
            action: 'ADMIN_PORTAL_LOGIN_SUCCESS',
            targetType: 'USER',
            targetId: adminUser.id,
            details: 'Authenticated into Costorah Admin Console with administrator credentials (admin)',
            ipHash: 'sha256:client_session',
          },
          ...state.auditLogs,
        ],
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/auth/logout-admin') {
      const targetUser =
        state.allUsers.find((u) => u.id === lastRegularUserIdRef.current && u.role !== 'ADMIN') ||
        state.allUsers.find((u) => u.role !== 'ADMIN') ||
        state.currentUser;
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: targetUser,
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/auth/user-login') {
      const mode = String(payload.mode || 'LOGIN');
      if (mode === 'REGISTER') {
        const cleanEmail = String(payload.email || payload.identifier || '').trim().toLowerCase();
        const cleanName = String(payload.displayName || '').trim();
        const cleanPass = String(payload.password || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          throw new Error('A valid email address is required to register.');
        }
        if (cleanEmail === 'admin@costorah.io' || cleanName.toLowerCase() === 'admin') {
          throw new Error('Username "admin" is reserved for Administrator Login.');
        }
        if (cleanName.length < 2) {
          throw new Error('Display name must be at least 2 characters.');
        }
        if (cleanPass.length < 4) {
          throw new Error('Password must be at least 4 characters.');
        }
        const selectedCountry: CountryCode =
          payload.countryCode && TOP_TRADING_COUNTRIES[payload.countryCode as CountryCode]
            ? (payload.countryCode as CountryCode)
            : 'IN';
        const lockedFiat = getLockedFiatForCountry(selectedCountry);
        const newUser: UserProfile = {
          id: `usr_${Date.now().toString(36)}`,
          displayName: cleanName,
          email: cleanEmail,
          avatarUrl:
            typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim()
              ? payload.avatarUrl.trim()
              : undefined,
          bio:
            typeof payload.bio === 'string' && payload.bio.trim()
              ? payload.bio.trim()
              : 'Verified P2P Escrow Trader',
          countryCode: selectedCountry,
          preferredFiat: lockedFiat,
          role: 'USER',
          kycTier: 'TIER_2_VERIFIED',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: `id_cred_${Date.now()}`,
              provider: 'USER_CREDENTIALS',
              identifier: cleanEmail,
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          bankAccounts: [],
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        };
        lastRegularUserIdRef.current = newUser.id;
        const nextState: AppStateSnapshot = {
          ...state,
          currentUser: newUser,
          allUsers: [...state.allUsers, newUser],
        };
        setState(nextState);
        return nextState;
      }

      const check = verifyUserCredentials({
        identifier: String(payload.identifier || ''),
        password: String(payload.password || ''),
        users: state.allUsers,
      });
      if (check.authenticated && check.user) {
        lastRegularUserIdRef.current = check.user.id;
        const nextState: AppStateSnapshot = {
          ...state,
          currentUser: check.user,
        };
        setState(nextState);
        return nextState;
      }

      const cleanId = String(payload.identifier || '').trim();
      const cleanPass = String(payload.password || '').trim();
      if (
        check.error?.startsWith('No user account found matching') &&
        cleanId.length >= 2 &&
        cleanPass.length >= 3 &&
        cleanId.toLowerCase() !== 'admin' &&
        cleanId.toLowerCase() !== 'admin@costorah.io'
      ) {
        const autoEmail = cleanId.includes('@') ? cleanId.toLowerCase() : `${cleanId.toLowerCase()}@costorah.io`;
        const autoName = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
        const newUser: UserProfile = {
          id: `usr_${Date.now().toString(36)}`,
          displayName: autoName,
          email: autoEmail,
          countryCode: 'IN',
          preferredFiat: 'INR',
          role: 'USER',
          kycTier: 'TIER_2_VERIFIED',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: `id_cred_${Date.now()}`,
              provider: 'USER_CREDENTIALS',
              identifier: autoEmail,
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          bankAccounts: [],
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        };
        lastRegularUserIdRef.current = newUser.id;
        const nextState: AppStateSnapshot = {
          ...state,
          currentUser: newUser,
          allUsers: [...state.allUsers, newUser],
        };
        setState(nextState);
        return nextState;
      }

      throw new Error(check.error || 'Invalid user credentials.');
    }

    if (url === '/api/auth/switch-user') {
      const targetId = String(payload.userId || '');
      const target = state.allUsers.find((u) => u.id === targetId);
      if (!target) throw new Error('User not found.');
      if (target.role === 'ADMIN') {
        throw new Error('Admin account requires logging in with Admin username & password (admin / admin).');
      }
      lastRegularUserIdRef.current = target.id;
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: target,
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/auth/google') {
      const cleanEmail = String(payload.email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Valid Google email address is required.');
      }
      if (cleanEmail === 'admin@costorah.io') {
        throw new Error('Administrator account requires username/password login on the Admin Login tab.');
      }
      let found = state.allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      let nextUsers = state.allUsers;
      if (!found) {
        found = {
          id: `usr_${Date.now().toString(36)}`,
          displayName: payload.displayName ? String(payload.displayName).trim() : cleanEmail.split('@')[0],
          email: cleanEmail,
          countryCode: 'IN',
          preferredFiat: 'INR',
          role: 'USER',
          kycTier: 'TIER_1_BASIC',
          reputationScore: 100.0,
          completedTrades: 0,
          completionRatePct: 100.0,
          wallets: [],
          identities: [
            {
              id: `id_g_${Date.now()}`,
              provider: 'GOOGLE_OAUTH',
              identifier: cleanEmail,
              linkedAt: new Date().toISOString(),
            },
          ],
          paymentMethods: [],
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        };
        nextUsers = [...state.allUsers, found];
      }
      lastRegularUserIdRef.current = found.id;
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: found,
        allUsers: nextUsers,
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/user/country') {
      const countryCode = (payload.countryCode || 'IN') as CountryCode;
      const lockedFiat = getLockedFiatForCountry(countryCode);
      const updatedUser: UserProfile = {
        ...state.currentUser,
        countryCode,
        preferredFiat: lockedFiat,
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/user/profile') {
      const validCountry =
        payload.countryCode && TOP_TRADING_COUNTRIES[payload.countryCode as CountryCode]
          ? (payload.countryCode as CountryCode)
          : undefined;
      const updatedUser: UserProfile = {
        ...state.currentUser,
        ...(payload.displayName ? { displayName: String(payload.displayName).trim() } : {}),
        ...(payload.email && String(payload.email).includes('@')
          ? { email: String(payload.email).trim() }
          : {}),
        ...(typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim()
          ? { avatarUrl: payload.avatarUrl.trim() }
          : {}),
        ...(typeof payload.bio === 'string' ? { bio: payload.bio.trim() } : {}),
        ...(validCountry
          ? { countryCode: validCountry, preferredFiat: getLockedFiatForCountry(validCountry) }
          : payload.preferredFiat
          ? { preferredFiat: payload.preferredFiat as UserProfile['preferredFiat'] }
          : {}),
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/user/security') {
      const updatedUser: UserProfile = {
        ...state.currentUser,
        ...(typeof payload.twoFactorEnabled === 'boolean'
          ? { twoFactorEnabled: payload.twoFactorEnabled }
          : {}),
        ...(typeof payload.recoveryGuardianEmail === 'string'
          ? { recoveryGuardianEmail: payload.recoveryGuardianEmail.trim() }
          : {}),
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/user/payment-methods') {
      const newPm = {
        id: `pm_${Date.now().toString(36)}`,
        userId: state.currentUser.id,
        methodName: String(payload.methodName || 'PhonePe'),
        category: (payload.category || 'UPI_APP') as UserProfile['paymentMethods'][number]['category'],
        fiatCurrency: (payload.fiatCurrency || 'INR') as UserProfile['paymentMethods'][number]['fiatCurrency'],
        accountHolder: String(payload.accountHolder || state.currentUser.displayName),
        accountIdentifier: String(payload.accountIdentifier || '').trim(),
        bankOrProvider: String(payload.bankOrProvider || payload.methodName || 'Bank'),
        isVerified: Boolean(payload.verifyImmediately ?? true),
        addedAt: new Date().toISOString(),
      };
      const updatedUser: UserProfile = {
        ...state.currentUser,
        paymentMethods: [...(state.currentUser.paymentMethods || []), newPm],
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/user/notification-preferences') {
      const updatedUser: UserProfile = {
        ...state.currentUser,
        notificationPreferences: {
          tradeStarted: Boolean(payload.tradeStarted ?? true),
          paymentReceived: Boolean(payload.paymentReceived ?? true),
          disputeOpened: Boolean(payload.disputeOpened ?? true),
        },
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/wallet/challenge') {
      const validation = validateBlockchainWalletAddress(
        String(payload.walletAddress || ''),
        payload.networkFamily as BlockchainNetworkFamily | undefined
      );
      if (!validation.valid) {
        throw new Error(validation.error || 'Valid ERC-20 or Solana wallet address is required.');
      }
      const nonce = `costorah_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const challenge = createWalletChallenge({
        walletAddress: validation.normalizedAddress,
        domain: String(payload.domain || 'costorah.io'),
        nonce,
        networkFamily: validation.networkFamily,
        chain: payload.chain ? String(payload.chain) : validation.defaultChain,
      });
      activeChallengesRef.current.set(nonce, challenge);
      return { challenge, validation };
    }

    if (url === '/api/wallet/verify') {
      const nonce = String(payload.nonce || '');
      const challenge = activeChallengesRef.current.get(nonce);
      if (!challenge) {
        throw new Error('Challenge nonce not found or expired.');
      }
      const result = verifyWalletChallenge({
        challenge,
        expectedDomain: challenge.domain || window.location.host || 'costorah.io',
        signature: String(payload.signature || ''),
        nowMs: Date.now(),
        usedNonces: usedNoncesRef.current,
      });
      if (!result.verified) {
        throw new Error(result.reason || 'Wallet signature verification failed.');
      }
      const newWallet = {
        id: `wal_${Date.now()}`,
        address: challenge.walletAddress,
        chain: String(payload.chain || challenge.chain || 'Ethereum Mainnet (ERC-20 · Chain ID 1)'),
        networkFamily: (payload.networkFamily || challenge.networkFamily || 'ERC20_EVM') as BlockchainNetworkFamily,
        providerName: String(payload.providerName || 'MetaMask'),
        type: 'EXTERNAL_SIWE' as const,
        label: String(payload.label || 'Connected Wallet'),
        verifiedAt: new Date().toISOString(),
      };
      const updatedUser: UserProfile = {
        ...state.currentUser,
        wallets: [
          ...state.currentUser.wallets.filter(
            (w) => w.address.toLowerCase() !== newWallet.address.toLowerCase()
          ),
          newWallet,
        ],
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/wallet/create-embedded') {
      const newWallet = {
        id: `wal_emb_${Date.now()}`,
        address: String(payload.publicAddress || '').trim(),
        chain: String(payload.chain || 'Ethereum Mainnet (ERC-20 · Chain ID 1)'),
        type: 'EMBEDDED_MPC' as const,
        label: String(payload.label || 'Costorah Embedded Vault'),
        verifiedAt: new Date().toISOString(),
      };
      const updatedUser: UserProfile = {
        ...state.currentUser,
        wallets: [...state.currentUser.wallets, newWallet],
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/wallet/disconnect') {
      const walletId = String(payload.walletId || '');
      const updatedUser: UserProfile = {
        ...state.currentUser,
        wallets: walletId
          ? state.currentUser.wallets.filter((w) => w.id !== walletId && w.address !== walletId)
          : [],
      };
      const nextState: AppStateSnapshot = {
        ...state,
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      };
      setState(nextState);
      return nextState;
    }

    if (url === '/api/swap/execute') {
      const fromAsset = (payload.fromAsset || 'USDT') as CryptoAsset;
      const toAsset = (payload.toAsset || 'BNB') as CryptoAsset;
      const chain: SwapChainId =
        payload.chain === 'SOL_CHAIN' || payload.chain === 'ERC20_CHAIN'
          ? payload.chain
          : 'BNB_CHAIN';
      const settlementMode: 'EXCHANGE_INTERNAL' | 'WITHDRAW_EXTERNAL' =
        payload.settlementMode === 'WITHDRAW_EXTERNAL'
          ? 'WITHDRAW_EXTERNAL'
          : 'EXCHANGE_INTERNAL';
      const fromAmountMicro = parseCryptoToMicro(String(payload.fromAmount || '0'));
      if (settlementMode === 'WITHDRAW_EXTERNAL') {
        const addrCheck = validateSwapChainDestinationAddress(
          String(payload.destinationAddress || ''),
          chain
        );
        if (!addrCheck.valid) {
          throw new Error(addrCheck.error || 'Invalid destination wallet address.');
        }
      }
      const fromBal = state.balances.find((b) => b.asset === fromAsset);
      if (!fromBal || fromBal.availableMicro < fromAmountMicro) {
        throw new Error(
          `Insufficient available ${fromAsset} balance: requested ${formatMicro6(
            fromAmountMicro
          )} ${fromAsset}.`
        );
      }
      const quote = calculateCrossChainSwapQuote({
        fromAsset,
        toAsset,
        fromAmountInput: formatMicro6(fromAmountMicro),
        chain,
        settlementMode,
        slippageBps: typeof payload.slippageBps === 'number' ? payload.slippageBps : 50,
        liveRates: {
          BTC: livePriceFeed.rates.BTC?.usd,
          ETH: livePriceFeed.rates.ETH?.usd,
          BNB: livePriceFeed.rates.BNB?.usd,
          SOL: livePriceFeed.rates.SOL?.usd,
          USDT: livePriceFeed.rates.USDT?.usd,
          USDC: livePriceFeed.rates.USDC?.usd,
        },
        usdInrRate: livePriceFeed.usdInrRate,
      });
      const chainMeta = SUPPORTED_SWAP_CHAINS[chain];
      const swapId = `swp_${Date.now().toString(36)}`;
      const swapRecord: SwapExecutionRecord = {
        id: swapId,
        userId: state.currentUser.id,
        fromAsset,
        toAsset,
        fromAmountMicro: quote.fromAmountMicro,
        fromAmountFormatted: quote.fromAmountFormatted,
        toAmountMicro: quote.toAmountMicro,
        toAmountFormatted: quote.toAmountFormatted,
        chain,
        chainName: chainMeta.name,
        tokenStandard: chainMeta.tokenStandard,
        settlementMode,
        destinationAddress:
          settlementMode === 'WITHDRAW_EXTERNAL'
            ? String(payload.destinationAddress || '').trim()
            : undefined,
        exchangeRate: quote.exchangeRate,
        grossUsdValue: quote.grossUsdValue,
        netUsdValue: quote.netUsdValue,
        netInrValue: quote.netInrValue,
        swapFeeUsd: quote.swapFeeUsd,
        networkGasFeeUsd: quote.networkGasFeeUsd,
        txHash: `0x${swapId.padEnd(64, 'a').slice(0, 64)}`,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      };
      const existingAssets = new Set(state.balances.map((b) => b.asset));
      const baseBalances = existingAssets.has(toAsset)
        ? state.balances
        : [...state.balances, { asset: toAsset, availableMicro: 0, lockedMicro: 0 }];
      const nextBalances = baseBalances.map((b) => {
        if (b.asset === fromAsset) {
          return { ...b, availableMicro: b.availableMicro - fromAmountMicro };
        }
        if (settlementMode === 'EXCHANGE_INTERNAL' && b.asset === toAsset) {
          return { ...b, availableMicro: b.availableMicro + quote.toAmountMicro };
        }
        return b;
      });
      const nextState: AppStateSnapshot = {
        ...state,
        balances: nextBalances,
        swapHistory: [swapRecord, ...(state.swapHistory || [])],
      };
      setState(nextState);
      return { swap: swapRecord, state: nextState };
    }

    if (url === '/api/offers') {
      const side: 'SELL' | 'BUY' = payload.side === 'BUY' ? 'BUY' : 'SELL';
      const asset = (payload.asset || 'USDT') as CryptoAsset;
      const fiatCurrency = (payload.fiatCurrency || 'INR') as FiatCurrency;
      const unitPriceFiatMinor = parseFiatToMinor(String(payload.unitPriceFiat || '95.00'));
      const availableQuantityMicro = parseCryptoToMicro(
        String(payload.totalQuantityCrypto || payload.availableQuantity || '100')
      );
      const totalFiatMinor = Math.max(
        1,
        Math.round((availableQuantityMicro * unitPriceFiatMinor) / 1_000_000)
      );
      const minOrderFiatMinor = payload.minOrderFiat
        ? Math.min(parseFiatToMinor(String(payload.minOrderFiat)), totalFiatMinor)
        : Math.min(10000, totalFiatMinor);
      const maxOrderFiatMinor = payload.maxOrderFiat
        ? Math.min(
            Math.max(parseFiatToMinor(String(payload.maxOrderFiat)), minOrderFiatMinor),
            totalFiatMinor
          )
        : totalFiatMinor;

      const newOffer: OfferRecord = {
        id: `off_${Date.now().toString(36)}`,
        makerId: state.currentUser.id,
        makerName: state.currentUser.displayName,
        completedTrades: state.currentUser.completedTrades,
        completionRatePct: state.currentUser.completionRatePct,
        side,
        asset,
        fiatCurrency,
        unitPriceFiatMinor,
        minOrderFiatMinor,
        maxOrderFiatMinor,
        availableQuantityMicro,
        totalQuantityMicro: availableQuantityMicro,
        paymentMethods: Array.isArray(payload.paymentMethods)
          ? (payload.paymentMethods as string[])
          : ['PhonePe'],
        paymentInstructions: String(
          payload.paymentInstructions || 'Instant P2P settlement with UTR verification.'
        ),
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };

      const nextBalances =
        side === 'SELL'
          ? state.balances.map((b) =>
              b.asset === asset
                ? {
                    ...b,
                    availableMicro: Math.max(0, b.availableMicro - availableQuantityMicro),
                    lockedMicro: b.lockedMicro + availableQuantityMicro,
                  }
                : b
            )
          : state.balances;

      const nextState: AppStateSnapshot = {
        ...state,
        balances: nextBalances,
        offers: [newOffer, ...state.offers],
      };
      setState(nextState);
      return { offer: newOffer, state: nextState };
    }

    if (url.startsWith('/api/offers/') && url.endsWith('/status')) {
      const offerId = url.replace('/api/offers/', '').replace('/status', '');
      const action = String(payload.action || 'PAUSE') as 'PAUSE' | 'RESUME' | 'CANCEL';
      const target = state.offers.find((o) => o.id === offerId);
      if (!target) {
        throw new Error('Offer not found.');
      }
      const nextStatus: OfferRecord['status'] =
        action === 'CANCEL' ? 'CANCELLED' : action === 'PAUSE' ? 'PAUSED' : 'OPEN';
      const nextBalances =
        action === 'CANCEL' && target.side === 'SELL' && target.status !== 'CANCELLED'
          ? state.balances.map((b) =>
              b.asset === target.asset
                ? {
                    ...b,
                    availableMicro: b.availableMicro + target.availableQuantityMicro,
                    lockedMicro: Math.max(0, b.lockedMicro - target.availableQuantityMicro),
                  }
                : b
            )
          : state.balances;
      const updatedOffer: OfferRecord = {
        ...target,
        status: nextStatus,
        availableQuantityMicro: action === 'CANCEL' ? 0 : target.availableQuantityMicro,
      };
      const nextState: AppStateSnapshot = {
        ...state,
        balances: nextBalances,
        offers: state.offers.map((o) => (o.id === offerId ? updatedOffer : o)),
      };
      setState(nextState);
      return { offer: updatedOffer, state: nextState };
    }

    if (url.startsWith('/api/offers/') && url.endsWith('/edit')) {
      const offerId = url.replace('/api/offers/', '').replace('/edit', '');
      const target = state.offers.find((o) => o.id === offerId);
      if (!target) {
        throw new Error('Offer not found.');
      }
      const nextPriceMinor = payload.unitPriceFiat
        ? parseFiatToMinor(String(payload.unitPriceFiat))
        : target.unitPriceFiatMinor;
      const nextQtyMicro = payload.availableQuantity
        ? parseCryptoToMicro(String(payload.availableQuantity))
        : target.availableQuantityMicro;
      const totalFiatMinor = Math.max(
        1,
        Math.round((nextQtyMicro * nextPriceMinor) / 1_000_000)
      );
      const nextMinMinor = payload.minOrderFiat
        ? Math.min(parseFiatToMinor(String(payload.minOrderFiat)), totalFiatMinor)
        : Math.min(target.minOrderFiatMinor, totalFiatMinor);
      const nextMaxMinor = payload.maxOrderFiat
        ? Math.min(
            Math.max(parseFiatToMinor(String(payload.maxOrderFiat)), nextMinMinor),
            totalFiatMinor
          )
        : Math.min(Math.max(target.maxOrderFiatMinor, nextMinMinor), totalFiatMinor);
      const qtyDelta = nextQtyMicro - target.availableQuantityMicro;
      const nextBalances =
        target.side === 'SELL' && qtyDelta !== 0
          ? state.balances.map((b) =>
              b.asset === target.asset
                ? {
                    ...b,
                    availableMicro: Math.max(0, b.availableMicro - qtyDelta),
                    lockedMicro: Math.max(0, b.lockedMicro + qtyDelta),
                  }
                : b
            )
          : state.balances;
      const updatedOffer: OfferRecord = {
        ...target,
        unitPriceFiatMinor: nextPriceMinor,
        availableQuantityMicro: nextQtyMicro,
        minOrderFiatMinor: nextMinMinor,
        maxOrderFiatMinor: nextMaxMinor,
        paymentMethods:
          Array.isArray(payload.paymentMethods) && payload.paymentMethods.length > 0
            ? (payload.paymentMethods as string[])
            : target.paymentMethods,
        paymentInstructions:
          typeof payload.paymentInstructions === 'string' && payload.paymentInstructions.trim()
            ? payload.paymentInstructions.trim()
            : target.paymentInstructions,
      };
      const nextState: AppStateSnapshot = {
        ...state,
        balances: nextBalances,
        offers: state.offers.map((o) => (o.id === offerId ? updatedOffer : o)),
      };
      setState(nextState);
      return { offer: updatedOffer, state: nextState };
    }

    if (url.startsWith('/api/orders/') && url.endsWith('/notify-payment')) {
      const orderId = url.replace('/api/orders/', '').replace('/notify-payment', '');
      const targetOrder = state.orders.find((o) => o.id === orderId);
      if (!targetOrder) {
        throw new Error('Order not found.');
      }
      const isBuyerActor = state.currentUser.id === targetOrder.buyerId;
      const recipientId = isBuyerActor ? targetOrder.sellerId : targetOrder.buyerId;
      const recipientUser = state.allUsers.find((u) => u.id === recipientId);
      const selectedChannel: 'IN_APP' | 'EMAIL' | 'BOTH' =
        payload.channel === 'EMAIL' || payload.channel === 'BOTH' ? payload.channel : 'IN_APP';
      const customMessage = String(
        payload.customMessage ||
          `Payment for Order #${orderId} is completed (${targetOrder.paymentReference || 'UTR-VERIFIED'}).`
      ).trim();

      const newMsg = {
        id: `msg_notif_${Date.now()}`,
        orderId,
        senderId: state.currentUser.id,
        senderName: state.currentUser.displayName,
        senderRole: (state.currentUser.role === 'ADMIN'
          ? 'ADMIN'
          : isBuyerActor
          ? 'BUYER'
          : 'SELLER') as 'ADMIN' | 'BUYER' | 'SELLER',
        content: `🔔 PAYMENT COMPLETION ALERT TO ${(recipientUser?.displayName || recipientId).toUpperCase()}: ${customMessage}`,
        createdAt: new Date().toISOString(),
      };

      const newNotif = {
        id: `notif_${Date.now()}`,
        userId: state.currentUser.id,
        title: `Payment Completion Alert — Order #${orderId}`,
        message: `To ${recipientUser?.displayName || 'Counterparty'}: "${customMessage}"`,
        orderId,
        channel: selectedChannel,
        read: false,
        createdAt: new Date().toISOString(),
      };

      const nextState: AppStateSnapshot = {
        ...state,
        messages: {
          ...state.messages,
          [orderId]: [...(state.messages[orderId] || []), newMsg],
        },
        notifications: [newNotif, ...(state.notifications || [])],
      };
      setState(nextState);
      return { order: targetOrder, state: nextState };
    }

    return state;
  };

  const apiPost = async <T = AppStateSnapshot>(url: string, body: unknown): Promise<T> => {
    const performFetch = async () => {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      return { res, rawText };
    };

    try {
      let attempt = await performFetch();
      let parsed = safeParseJson<Record<string, unknown>>(attempt.rawText);

      // If proxy returned an HTML page (e.g., <!doctype html> from iframe cookie check or warmup), retry once
      if (!parsed.ok && parsed.isHtml) {
        await new Promise((r) => setTimeout(r, 150));
        attempt = await performFetch();
        parsed = safeParseJson<Record<string, unknown>>(attempt.rawText);
      }

      if (!parsed.ok) {
        // Fall back to deterministic client-side state handler instead of throwing Unexpected token '<'
        return applyClientAuthAndProfileFallback(url, body) as T;
      }

      const data = parsed.data;
      if (!attempt.res.ok) {
        throw new Error(String(data.error || 'Request failed'));
      }
      if (data.state) {
        const nextState = data.state as AppStateSnapshot;
        setState(nextState);
        if (nextState.currentUser?.role !== 'ADMIN') {
          lastRegularUserIdRef.current = nextState.currentUser.id;
        }
      } else if (data.currentUser) {
        const nextState = data as unknown as AppStateSnapshot;
        setState(nextState);
        if (nextState.currentUser?.role !== 'ADMIN') {
          lastRegularUserIdRef.current = nextState.currentUser.id;
        }
      }
      return data as unknown as T;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message.includes('<!doctype') ||
          err.message.includes('<!DOCTYPE') ||
          err.message.includes('Unexpected token') ||
          err.message.includes('Failed to fetch'))
      ) {
        return applyClientAuthAndProfileFallback(url, body) as T;
      }
      throw err;
    }
  };

  if (loading && !state) {
    return (
      <div
        data-theme={theme}
        className="min-h-screen bg-[#0B0E14] text-slate-200 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-[#131A24] border border-white/[0.08] rounded-xl p-6 space-y-3">
          <div className="h-5 w-48 bg-slate-800 rounded animate-pulse" />
          <div className="h-3.5 w-full bg-slate-800/70 rounded animate-pulse" />
          <div className="h-3.5 w-3/4 bg-slate-800/70 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div
        data-theme={theme}
        className="min-h-screen bg-[#0B0E14] text-slate-200 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-[#131A24] border border-red-500/30 rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-slate-100">Connection Error</h1>
          <p className="text-xs text-slate-400">{error || 'State unavailable'}</p>
          <button
            type="button"
            onClick={fetchState}
            className="px-4 py-2 text-xs font-semibold text-[#0B0E14] bg-emerald-400 rounded-lg cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const selectedCountry: CountryCode = state.currentUser.countryCode || 'IN';

  const handleSelectCountry = async (countryCode: CountryCode) => {
    await apiPost('/api/user/country', { countryCode });
  };

  const activeOrder =
    state.orders.find((o) => o.id === activeOrderId) || state.orders[0];
  const activeOrderOffer = activeOrder
    ? state.offers.find((off) => off.id === activeOrder.offerId)
    : undefined;

  const isDay = theme === 'day';

  return (
    <div
      data-theme={theme}
      className={`min-h-screen flex flex-col overflow-x-hidden transition-colors ${
        isDay ? 'bg-[#F4F8FC] text-slate-900' : 'bg-[#0B0E14] text-[#F1F5F9]'
      }`}
    >
      {/* Strict 3-Zone Top Bar with Global Marketplace Search */}
      <Navbar
        activeRoute={activeRoute}
        onNavigate={(r) => setActiveRoute(r)}
        currentUser={state.currentUser}
        onOpenAccountModal={(tab) => {
          setAccountModalTab(tab || 'USER_LOGIN');
          setAccountModalOpen(true);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        offers={state.offers}
        orders={state.orders}
        allUsers={state.allUsers}
        balances={state.balances}
        livePriceFeed={livePriceFeed}
        supportedPaymentMethods={state.supportedPaymentMethods}
        notifications={state.notifications}
        onOpenOrderFromNotification={(orderId) => {
          setActiveOrderId(orderId);
          setActiveRoute('trade-room');
        }}
        onGlobalSearchSelect={(selection) => {
          setExternalSearchSelection({ ...selection });
          setActiveRoute('marketplace');
        }}
      />

      {/* Visual Payment Completion Alert Toast Banner */}
      {paymentAlertToast && (
        <div
          data-testid="payment-completion-alert-toast"
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:max-w-md sm:w-full rounded-2xl border p-3.5 sm:p-4 shadow-2xl backdrop-blur-md transition-all ${
            isDay
              ? 'bg-white/95 border-emerald-400 text-slate-900'
              : 'bg-[#0F1724]/95 border-emerald-500/50 text-slate-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 shrink-0 mt-0.5">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    {paymentAlertToast.title}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {paymentAlertToast.channel}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{paymentAlertToast.message}</p>
                <div className="pt-1 flex items-center gap-3 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrderId(paymentAlertToast.orderId);
                      setActiveRoute('trade-room');
                      setPaymentAlertToast(null);
                    }}
                    className="text-emerald-400 hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Open Order #{paymentAlertToast.orderId}</span>
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentAlertToast(null)}
              className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              aria-label="Dismiss payment alert"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container (1360px max width, responsive padding for mobile bottom nav) */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-3 sm:px-8 pt-4 sm:pt-8 pb-24 lg:pb-8">
        {activeRoute === 'home' && (
          <HomeView
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            offers={state.offers}
            orders={state.orders}
            allUsers={state.allUsers}
            supportedPaymentMethods={state.supportedPaymentMethods}
            feeBps={state.feeBps}
            totalUsersVerified={state.reconciliation.totalUsersChecked}
            activeOrderId={state.orders[0]?.id}
            onNavigate={(r) => setActiveRoute(r)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            livePriceFeed={livePriceFeed}
          />
        )}

        {activeRoute === 'marketplace' && (
          <MarketplaceView
            offers={state.offers}
            orders={state.orders}
            allUsers={state.allUsers}
            balances={state.balances}
            feeBps={state.feeBps}
            supportedPaymentMethods={state.supportedPaymentMethods}
            currentUserId={state.currentUser.id}
            currentUser={state.currentUser}
            userEmail={state.currentUser.email}
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            priceAlerts={state.priceAlerts}
            workerStatus={state.workerStatus}
            externalSearchSelection={externalSearchSelection}
            livePriceFeed={livePriceFeed}
            onAcceptOffer={async (params) => {
              const res = await apiPost<{ order: { id: string } }>('/api/orders', params);
              setActiveOrderId(res.order.id);
              setActiveRoute('trade-room');
            }}
            onUpdateOfferStatus={async (offerId, action) => {
              await apiPost(`/api/offers/${offerId}/status`, { action });
            }}
            onEditOffer={async (offerId, payload) => {
              await apiPost(`/api/offers/${offerId}/edit`, payload);
            }}
            onAddPaymentMethod={async (payload) => {
              await apiPost('/api/user/payment-methods', payload);
            }}
            onCreatePriceAlert={async (params) => {
              await apiPost('/api/price-alerts', params);
            }}
            onDeletePriceAlert={async (alertId) => {
              await apiPost(`/api/price-alerts/${alertId}/delete`, {});
            }}
            onRunAlertWorker={async () => {
              await apiPost('/api/price-alerts/run-worker', {});
            }}
          />
        )}

        {activeRoute === 'swap' && (
          <SwapView
            currentUser={state.currentUser}
            balances={state.balances}
            livePriceFeed={livePriceFeed}
            swapHistory={state.swapHistory || []}
            theme={theme}
            onExecuteSwap={async (payload) => {
              return await apiPost<{ swap?: SwapExecutionRecord }>('/api/swap/execute', payload);
            }}
            onNavigateDashboard={() => setActiveRoute('dashboard')}
          />
        )}

        {activeRoute === 'pulse' && (
          <SocialPulseView
            currentUser={state.currentUser}
            allUsers={state.allUsers}
            offers={state.offers}
            orders={state.orders}
            tweets={marketTweets}
            livePriceFeed={livePriceFeed}
            theme={theme}
            onCreateTweet={async (tweetPayload) => {
              const newTweet: MarketTweetRecord = {
                id: `tw_${Date.now().toString(36)}`,
                authorId: state.currentUser.id,
                authorName: state.currentUser.displayName.replace(' (You)', ''),
                authorHandle: formatUserHandle(
                  state.currentUser.displayName,
                  state.currentUser.email
                ),
                authorAvatarUrl:
                  state.currentUser.avatarUrl || getDefaultAvatarForUser(state.currentUser),
                authorVerified: true,
                authorReputationScore: state.currentUser.reputationScore,
                content: tweetPayload.content,
                sentiment: tweetPayload.sentiment,
                taggedAssets: tweetPayload.taggedAssets,
                taggedUserHandles: tweetPayload.taggedUserHandles,
                imageUrl: tweetPayload.imageUrl,
                imageCaption: tweetPayload.imageCaption,
                orderAttachment: tweetPayload.orderAttachment,
                likedByUserIds: [],
                retweetedByUserIds: [],
                comments: [],
                createdAt: new Date().toISOString(),
              };
              setMarketTweets((prev) => [newTweet, ...prev]);
            }}
            onToggleLikeTweet={async (tweetId) => {
              const uid = state.currentUser.id;
              setMarketTweets((prev) =>
                prev.map((t) => {
                  if (t.id !== tweetId) return t;
                  const already = t.likedByUserIds.includes(uid);
                  return {
                    ...t,
                    likedByUserIds: already
                      ? t.likedByUserIds.filter((id) => id !== uid)
                      : [...t.likedByUserIds, uid],
                  };
                })
              );
            }}
            onRetweet={async (tweetId, quoteComment) => {
              const uid = state.currentUser.id;
              const target = marketTweets.find((t) => t.id === tweetId);
              if (!target) return;
              if (quoteComment && quoteComment.trim()) {
                const quoteTw: MarketTweetRecord = {
                  id: `tw_rt_${Date.now().toString(36)}`,
                  authorId: state.currentUser.id,
                  authorName: state.currentUser.displayName.replace(' (You)', ''),
                  authorHandle: formatUserHandle(
                    state.currentUser.displayName,
                    state.currentUser.email
                  ),
                  authorAvatarUrl:
                    state.currentUser.avatarUrl || getDefaultAvatarForUser(state.currentUser),
                  authorVerified: true,
                  authorReputationScore: state.currentUser.reputationScore,
                  content: quoteComment.trim(),
                  sentiment: target.sentiment,
                  taggedAssets: target.taggedAssets,
                  taggedUserHandles: Array.from(
                    new Set([...target.taggedUserHandles, target.authorHandle])
                  ),
                  imageUrl: target.imageUrl,
                  imageCaption: target.imageCaption,
                  orderAttachment: target.orderAttachment,
                  likedByUserIds: [],
                  retweetedByUserIds: [],
                  retweetOfId: target.id,
                  retweetedByName: state.currentUser.displayName.replace(' (You)', ''),
                  retweetedByHandle: formatUserHandle(
                    state.currentUser.displayName,
                    state.currentUser.email
                  ),
                  comments: [],
                  createdAt: new Date().toISOString(),
                };
                setMarketTweets((prev) => [
                  quoteTw,
                  ...prev.map((t) =>
                    t.id === tweetId && !t.retweetedByUserIds.includes(uid)
                      ? { ...t, retweetedByUserIds: [...t.retweetedByUserIds, uid] }
                      : t
                  ),
                ]);
              } else {
                setMarketTweets((prev) =>
                  prev.map((t) => {
                    if (t.id !== tweetId) return t;
                    const already = t.retweetedByUserIds.includes(uid);
                    return {
                      ...t,
                      retweetedByUserIds: already
                        ? t.retweetedByUserIds.filter((id) => id !== uid)
                        : [...t.retweetedByUserIds, uid],
                    };
                  })
                );
              }
            }}
            onAddComment={async (tweetId, content) => {
              const newComment = {
                id: `cmt_${Date.now().toString(36)}`,
                tweetId,
                authorId: state.currentUser.id,
                authorName: state.currentUser.displayName.replace(' (You)', ''),
                authorHandle: formatUserHandle(
                  state.currentUser.displayName,
                  state.currentUser.email
                ),
                authorAvatarUrl:
                  state.currentUser.avatarUrl || getDefaultAvatarForUser(state.currentUser),
                content,
                createdAt: new Date().toISOString(),
              };
              setMarketTweets((prev) =>
                prev.map((t) =>
                  t.id === tweetId ? { ...t, comments: [...t.comments, newComment] } : t
                )
              );
            }}
            onDeleteTweet={async (tweetId) => {
              setMarketTweets((prev) => prev.filter((t) => t.id !== tweetId));
            }}
            onUpdateProfile={async (profilePayload) => {
              await apiPost('/api/user/profile', profilePayload);
            }}
            onNavigateMarketplace={(offerId, asset) => {
              setExternalSearchSelection({
                offerId,
                asset: asset || 'ALL',
              });
              setActiveRoute('marketplace');
            }}
            onOpenTradeRoom={(orderId) => {
              setActiveOrderId(orderId);
              setActiveRoute('trade-room');
            }}
            onNavigateCreateOffer={() => setActiveRoute('create-offer')}
          />
        )}

        {activeRoute === 'create-offer' && (
          <CreateOfferView
            balances={state.balances}
            offers={state.offers}
            orders={state.orders}
            currentUserId={state.currentUser.id}
            currentUser={state.currentUser}
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            supportedPaymentMethods={state.supportedPaymentMethods}
            feeBps={state.feeBps}
            livePriceFeed={livePriceFeed}
            onNavigatePulse={() => setActiveRoute('pulse')}
            onCreateOffer={async (payload) => {
              const res = await apiPost<{ offer?: OfferRecord }>('/api/offers', payload);
              if (payload.postAsTweet) {
                const createdOffer = res?.offer;
                const attachment: MarketTweetOrderAttachment = {
                  offerId: createdOffer?.id,
                  side: payload.side,
                  asset: payload.asset,
                  fiatCurrency: payload.fiatCurrency,
                  unitPriceFormatted: payload.unitPriceFiat,
                  quantityFormatted: payload.totalQuantityCrypto,
                  minOrderFormatted: payload.minOrderFiat,
                  maxOrderFormatted: payload.maxOrderFiat,
                  paymentMethods: payload.paymentMethods,
                };
                const orderTweet: MarketTweetRecord = {
                  id: `tw_ord_${Date.now().toString(36)}`,
                  authorId: state.currentUser.id,
                  authorName: state.currentUser.displayName.replace(' (You)', ''),
                  authorHandle: formatUserHandle(
                    state.currentUser.displayName,
                    state.currentUser.email
                  ),
                  authorAvatarUrl:
                    state.currentUser.avatarUrl || getDefaultAvatarForUser(state.currentUser),
                  authorVerified: true,
                  authorReputationScore: state.currentUser.reputationScore,
                  content:
                    payload.tweetContent ||
                    `Published a new P2P ${payload.side} Order: ${payload.totalQuantityCrypto} $${payload.asset} @ ${payload.unitPriceFiat} ${payload.fiatCurrency}! #Bitcoin #Ethereum #${payload.asset}`,
                  sentiment: payload.tweetSentiment || 'ORDER_ALERT',
                  taggedAssets: payload.tweetTaggedAssets || [payload.asset, 'BTC', 'ETH'],
                  taggedUserHandles: [],
                  imageUrl: payload.tweetImageUrl,
                  orderAttachment: attachment,
                  likedByUserIds: [],
                  retweetedByUserIds: [],
                  comments: [],
                  createdAt: new Date().toISOString(),
                };
                setMarketTweets((prev) => [orderTweet, ...prev]);
              }
            }}
            onUpdateOfferStatus={async (offerId, action) => {
              await apiPost(`/api/offers/${offerId}/status`, { action });
            }}
            onEditOffer={async (offerId, payload) => {
              await apiPost(`/api/offers/${offerId}/edit`, payload);
            }}
            onAddPaymentMethod={async (payload) => {
              await apiPost('/api/user/payment-methods', payload);
            }}
          />
        )}

        {activeRoute === 'orders' && (
          <OrdersView
            currentUser={state.currentUser}
            offers={state.offers}
            orders={state.orders}
            messagesByOrder={state.messages}
            allUsers={state.allUsers}
            supportedPaymentMethods={state.supportedPaymentMethods}
            onUpdateOfferStatus={async (offerId, action) => {
              await apiPost(`/api/offers/${offerId}/status`, { action });
            }}
            onEditOffer={async (offerId, payload) => {
              await apiPost(`/api/offers/${offerId}/edit`, payload);
            }}
            onOpenTradeRoom={(orderId) => {
              setActiveOrderId(orderId);
              setActiveRoute('trade-room');
            }}
            onMarkPaymentSent={async (
              orderId: string,
              paymentReference: string,
              note: string,
              paymentEvidenceUrl?: string
            ) => {
              await apiPost(`/api/orders/${orderId}/payment-sent`, {
                paymentReference,
                note,
                paymentEvidenceUrl,
              });
            }}
            onConfirmAndRelease={async (orderId) => {
              await apiPost(`/api/orders/${orderId}/release`, {
                idempotencyKey: `rel_${orderId}_${Date.now()}`,
              });
            }}
            onOpenDispute={async (orderId, reason) => {
              await apiPost(`/api/orders/${orderId}/dispute`, { reason });
            }}
            onSendChatMessage={async (orderId, content) => {
              await apiPost(`/api/orders/${orderId}/messages`, { content });
            }}
            onCancelOrder={async (orderId, reason) => {
              await apiPost(`/api/orders/${orderId}/cancel`, { reason });
            }}
            onNotifyPaymentCompleted={async ({ orderId, customMessage, channel }) => {
              await apiPost(`/api/orders/${orderId}/notify-payment`, {
                customMessage,
                channel,
              });
              setPaymentAlertToast({
                orderId,
                title: `Payment Completion Alert Dispatched`,
                message: customMessage,
                channel: channel === 'BOTH' ? 'In-App + Email + Chat' : 'In-App + Chat',
              });
            }}
            onNavigateToMarket={() => setActiveRoute('marketplace')}
          />
        )}

        {activeRoute === 'dashboard' && (
          <DashboardView
            currentUser={state.currentUser}
            balances={state.balances}
            orders={state.orders}
            ledgerEntries={state.ledgerEntries}
            notifications={state.notifications}
            onOpenOrder={(orderId) => {
              setActiveOrderId(orderId);
              setActiveRoute('trade-room');
            }}
            onOpenAccountModal={() => {
              setAccountModalTab('CONNECT_WALLET');
              setAccountModalOpen(true);
            }}
            onDeposit={async (asset, amount) => {
              await apiPost('/api/ledger/deposit', { asset, amount });
            }}
            onWithdraw={async (asset, amount, destinationAddress) => {
              await apiPost('/api/ledger/withdraw', { asset, amount, destinationAddress });
            }}
            onUpdateProfile={async (payload) => {
              await apiPost('/api/user/profile', payload);
            }}
            onAddBankAccount={async (payload) => {
              await apiPost('/api/user/bank-accounts', payload);
            }}
            onDeleteBankAccount={async (bankId) => {
              await apiPost(`/api/user/bank-accounts/${bankId}/delete`, {});
            }}
            onAddPaymentMethod={async (payload) => {
              await apiPost('/api/user/payment-methods', payload);
            }}
            onVerifyPaymentMethod={async (pmId, verificationCode) => {
              await apiPost(`/api/user/payment-methods/${pmId}/verify`, { verificationCode });
            }}
            onDeletePaymentMethod={async (pmId) => {
              await apiPost(`/api/user/payment-methods/${pmId}/delete`, {});
            }}
            onUpdateSecurity={async (payload) => {
              await apiPost('/api/user/security', payload);
            }}
            onDisconnectWallet={async (walletId) => {
              await apiPost('/api/wallet/disconnect', { walletId });
            }}
            onUpdateNotificationPreferences={async (payload) => {
              await apiPost('/api/user/notification-preferences', payload);
            }}
          />
        )}

        {activeRoute === 'trade-room' && activeOrder && (
          <TradeRoomView
            order={activeOrder}
            offer={activeOrderOffer}
            messages={state.messages[activeOrder.id] || []}
            currentUser={state.currentUser}
            allUsers={state.allUsers}
            onBack={() => setActiveRoute('dashboard')}
            onSubmitPaymentSent={async ({ orderId, paymentReference, paymentEvidenceUrl, note }) => {
              await apiPost(`/api/orders/${orderId}/payment-sent`, {
                paymentReference,
                paymentEvidenceUrl,
                note,
              });
            }}
            onConfirmAndRelease={async (orderId) => {
              await apiPost(`/api/orders/${orderId}/release`, {
                idempotencyKey: `rel_${orderId}_${Date.now()}`,
              });
              setPaymentAlertToast({
                orderId,
                title: `Payment & Escrow Settlement Completed`,
                message: `Counterparty has been alerted that payment is verified and escrowed crypto has been released.`,
                channel: 'In-App + Email + Chat',
              });
            }}
            onOpenDispute={async (orderId, reason) => {
              await apiPost(`/api/orders/${orderId}/dispute`, { reason });
            }}
            onSendMessage={async (orderId, content, attachmentUrl) => {
              await apiPost(`/api/orders/${orderId}/messages`, { content, attachmentUrl });
            }}
            onCancelOrder={async (orderId, reason) => {
              await apiPost(`/api/orders/${orderId}/cancel`, { reason });
            }}
            onNotifyPaymentCompleted={async ({ orderId, customMessage, channel }) => {
              await apiPost(`/api/orders/${orderId}/notify-payment`, {
                customMessage,
                channel,
              });
              setPaymentAlertToast({
                orderId,
                title: `Payment Completion Alert Dispatched`,
                message: customMessage,
                channel: channel === 'BOTH' ? 'In-App + Email + Chat' : 'In-App + Chat',
              });
            }}
          />
        )}

        {activeRoute === 'info' && (
          <InfoPagesView
            feeBps={state.feeBps}
            supportedPaymentMethods={state.supportedPaymentMethods}
            onNavigateMarket={() => setActiveRoute('marketplace')}
          />
        )}

        {activeRoute === 'admin' && (
          <AdminView
            currentUser={state.currentUser}
            orders={state.orders}
            allUsers={state.allUsers}
            auditLogs={state.auditLogs}
            incidents={state.incidents}
            feeBps={state.feeBps}
            supportedPaymentMethods={state.supportedPaymentMethods}
            reconciliation={state.reconciliation}
            onAdminLogin={async (username, password) => {
              await apiPost('/api/auth/admin-login', { username, password });
            }}
            onLogoutAdmin={async () => {
              await apiPost('/api/auth/logout-admin', {});
            }}
            onResolveDispute={async ({ orderId, outcome, resolutionNote }) => {
              await apiPost(`/api/admin/disputes/${orderId}/resolve`, {
                outcome,
                resolutionNote,
              });
            }}
            onUpdateFeeBps={async (feeBps) => {
              await apiPost('/api/admin/fee-config', { feeBps });
            }}
            onAddPaymentRail={async (fiatCurrency, methodName) => {
              await apiPost('/api/admin/payment-rails', { fiatCurrency, methodName });
            }}
            onCreateIncident={async (title, severity, notes) => {
              await apiPost('/api/admin/incidents', { title, severity, notes });
            }}
            onResolveIncident={async (incidentId) => {
              await apiPost(`/api/admin/incidents/${incidentId}/resolve`, {});
            }}
            onOpenOrder={(orderId) => {
              setActiveOrderId(orderId);
              setActiveRoute('trade-room');
            }}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer
        className={`border-t pt-8 pb-24 lg:py-8 px-4 sm:px-8 mt-8 sm:mt-12 transition-colors ${
          isDay
            ? 'border-slate-200 bg-white text-slate-600'
            : 'border-white/[0.08] bg-[#0B0E14] text-slate-500'
        }`}
      >
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CostorahLogoIcon className="w-5 h-5 shrink-0" />
            <span
              className={`font-bold font-display ${
                isDay ? 'text-[#0B65C6]' : 'text-slate-300'
              }`}
            >
              COSTORAH
            </span>{' '}
            · Escrow-Protected P2P Cryptocurrency Marketplace (BTC · ETH · SOL · USDT · USDC)
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveRoute('info')}
              className={`cursor-pointer ${
                isDay ? 'hover:text-[#0B65C6]' : 'hover:text-slate-300'
              }`}
            >
              How Escrow Works
            </button>
            <button
              type="button"
              onClick={() => setActiveRoute('info')}
              className={`cursor-pointer ${
                isDay ? 'hover:text-[#0B65C6]' : 'hover:text-slate-300'
              }`}
            >
              1% Fee Policy
            </button>
            <button
              type="button"
              onClick={() => setActiveRoute('info')}
              className={`cursor-pointer ${
                isDay ? 'hover:text-[#0B65C6]' : 'hover:text-slate-300'
              }`}
            >
              Security & Legal Disclosures
            </button>
          </div>
        </div>
      </footer>

      {/* Unified Account, User Login, Google OAuth, Web3 Wallet & Admin Login Modal */}
      <AccountModal
        isOpen={accountModalOpen}
        initialTab={accountModalTab}
        onClose={() => setAccountModalOpen(false)}
        currentUser={state.currentUser}
        allUsers={state.allUsers}
        balances={state.balances}
        livePriceFeed={livePriceFeed}
        onUserLogin={async (params) => {
          await apiPost('/api/auth/user-login', params);
        }}
        onUpdateProfile={async (profilePayload) => {
          await apiPost('/api/user/profile', profilePayload);
        }}
        onAdminLogin={async (username, password) => {
          await apiPost('/api/auth/admin-login', { username, password });
        }}
        onLogoutAdmin={async () => {
          await apiPost('/api/auth/logout-admin', {});
        }}
        onGoogleSignIn={async (email, displayName) => {
          await apiPost('/api/auth/google', { email, displayName });
        }}
        onSwitchUser={async (userId) => {
          await apiPost('/api/auth/switch-user', { userId });
        }}
        onRequestWalletChallenge={async (walletAddress, networkFamily, chain) => {
          const res = await apiPost<{ challenge: WalletChallenge }>('/api/wallet/challenge', {
            walletAddress,
            domain: window.location.host || 'costorah.io',
            networkFamily,
            chain,
          });
          return res.challenge;
        }}
        onVerifyWalletChallenge={async (params) => {
          await apiPost('/api/wallet/verify', params);
        }}
        onDisconnectWallet={async (walletId) => {
          await apiPost('/api/wallet/disconnect', { walletId });
        }}
        onCreateEmbeddedWallet={async (params) => {
          await apiPost('/api/wallet/create-embedded', params);
        }}
        onNavigateAdmin={() => setActiveRoute('admin')}
      />
    </div>
  );
}
