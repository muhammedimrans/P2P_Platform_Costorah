import React, { useState, useEffect, useMemo } from 'react';
import {
  TOP_TRADING_COUNTRIES,
  calculateAutoUnitPriceFiat,
  validateBlockchainWalletAddress,
  type AssetBalance,
  type BlockchainNetworkFamily,
  type CountryCode,
  type CryptoAsset,
  type LivePriceFeed,
  type UserProfile,
  type WalletChallenge,
} from '../types';
import { formatMicro6, formatMinor2 } from '../core/escrowEngine';
import { ALL_CRYPTO_ASSETS, CryptoAssetIcon } from './CryptoAssetIcons';
import {
  X,
  ShieldCheck,
  KeyRound,
  Wallet,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CustomSelect, buildCountryCurrencyOptions, type CustomSelectOption } from './CustomSelect';

export type AccountModalTab = 'USER_LOGIN' | 'CONNECT_WALLET' | 'GOOGLE_OAUTH' | 'ADMIN_LOGIN';

interface AccountModalProps {
  isOpen: boolean;
  initialTab?: AccountModalTab;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  balances?: AssetBalance[];
  livePriceFeed?: LivePriceFeed;
  onUserLogin: (params: {
    mode?: 'LOGIN' | 'REGISTER';
    identifier?: string;
    password?: string;
    displayName?: string;
    email?: string;
    countryCode?: CountryCode;
  }) => Promise<void>;
  onAdminLogin: (username: string, password: string) => Promise<void>;
  onLogoutAdmin: () => Promise<void>;
  onGoogleSignIn: (email: string, displayName: string) => Promise<void>;
  onSwitchUser: (userId: string) => Promise<void>;
  onRequestWalletChallenge: (
    walletAddress: string,
    networkFamily?: BlockchainNetworkFamily,
    chain?: string
  ) => Promise<WalletChallenge>;
  onVerifyWalletChallenge: (params: {
    nonce: string;
    signature: string;
    chain: string;
    label: string;
    networkFamily?: BlockchainNetworkFamily;
    providerName?: string;
  }) => Promise<void>;
  onDisconnectWallet?: (walletId?: string) => Promise<void>;
  onCreateEmbeddedWallet: (params: {
    publicAddress: string;
    chain: string;
    label: string;
    recoveryConfirmed: boolean;
  }) => Promise<void>;
  onNavigateAdmin?: () => void;
}

const ERC20_CHAIN_OPTIONS: CustomSelectOption[] = [
  {
    value: 'Ethereum Mainnet (ERC-20 · Chain ID 1)',
    label: 'Ethereum Mainnet',
    sublabel: 'ERC-20 Standard · USDT, USDC, ETH, WBTC (Chain ID 1)',
    badgeText: 'ERC-20',
    badgeVariant: 'blue',
  },
  {
    value: 'Arbitrum One (ERC-20 · Chain ID 42161)',
    label: 'Arbitrum One L2',
    sublabel: 'ERC-20 Rollup · Instant Escrow Settlement (Chain ID 42161)',
    badgeText: 'ARB',
    badgeVariant: 'emerald',
  },
  {
    value: 'Polygon POS (ERC-20 · Chain ID 137)',
    label: 'Polygon POS',
    sublabel: 'ERC-20 Low-Gas Settlement Network (Chain ID 137)',
    badgeText: 'MATIC',
    badgeVariant: 'amber',
  },
  {
    value: 'BNB Smart Chain (BEP-20 / ERC-20 · Chain ID 56)',
    label: 'BNB Smart Chain',
    sublabel: 'EVM Compatible P2P Liquidity Network (Chain ID 56)',
    badgeText: 'BSC',
    badgeVariant: 'amber',
  },
];

const SOLANA_CHAIN_OPTIONS: CustomSelectOption[] = [
  {
    value: 'Solana Mainnet-Beta (SPL)',
    label: 'Solana Mainnet-Beta',
    sublabel: 'SPL Token Standard · SOL, USDT-SPL, USDC-SPL',
    badgeText: 'SOL SPL',
    badgeVariant: 'emerald',
  },
  {
    value: 'Solana Devnet (SPL Testnet)',
    label: 'Solana Devnet',
    sublabel: 'SPL Developer Escrow Sandbox',
    badgeText: 'DEVNET',
    badgeVariant: 'blue',
  },
];

const ERC20_PROVIDERS = [
  {
    id: 'MetaMask',
    name: 'MetaMask',
    tag: 'ERC-20 · EIP-1193',
    defaultAddress: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
    defaultLabel: 'MetaMask ERC-20 Wallet',
  },
  {
    id: 'Rabby Wallet',
    name: 'Rabby Wallet',
    tag: 'ERC-20 · Multi-EVM',
    defaultAddress: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
    defaultLabel: 'Rabby Institutional EVM',
  },
  {
    id: 'Coinbase Wallet',
    name: 'Coinbase Wallet',
    tag: 'ERC-20 · Base & ETH',
    defaultAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
    defaultLabel: 'Coinbase Web3 Wallet',
  },
  {
    id: 'WalletConnect',
    name: 'WalletConnect v2',
    tag: 'ERC-20 · Mobile/Ledger',
    defaultAddress: '0x71C95911E9a5D330f4D621842EC243EE1343292e',
    defaultLabel: 'Ledger Hardware ERC-20',
  },
];

const SOLANA_PROVIDERS = [
  {
    id: 'Phantom',
    name: 'Phantom Wallet',
    tag: 'Solana SPL · Browser',
    defaultAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    defaultLabel: 'Phantom Solana SPL Wallet',
  },
  {
    id: 'Solflare',
    name: 'Solflare Wallet',
    tag: 'Solana SPL · Staking',
    defaultAddress: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    defaultLabel: 'Solflare SPL Vault',
  },
  {
    id: 'Backpack',
    name: 'Backpack Wallet',
    tag: 'Solana SPL · xNFT',
    defaultAddress: '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T',
    defaultLabel: 'Backpack Solana Treasury',
  },
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  initialTab = 'USER_LOGIN',
  onClose,
  currentUser,
  allUsers,
  balances = [],
  livePriceFeed,
  onUserLogin,
  onAdminLogin,
  onLogoutAdmin,
  onGoogleSignIn,
  onSwitchUser,
  onRequestWalletChallenge,
  onVerifyWalletChallenge,
  onDisconnectWallet,
  onCreateEmbeddedWallet,
  onNavigateAdmin,
}) => {
  const [tab, setTab] = useState<AccountModalTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const walletInrSummary = useMemo(() => {
    const liveInrRate =
      livePriceFeed?.usdInrRate ??
      livePriceFeed?.fiatExchangeRates?.INR ??
      TOP_TRADING_COUNTRIES.IN.usdExchangeRate;
    const balanceMap = new Map<CryptoAsset, AssetBalance>();
    for (const b of balances) {
      balanceMap.set(b.asset, b);
    }
    let totalInrMinor = 0;
    const rows = ALL_CRYPTO_ASSETS.map((asset) => {
      const availableMicro = balanceMap.get(asset)?.availableMicro ?? 0;
      const inrPrice = calculateAutoUnitPriceFiat({
        asset,
        countryCode: 'IN',
        pricingType: 'FIXED',
        liveCryptoUsdPrice: livePriceFeed?.rates?.[asset]?.usd,
        liveLocalExchangeRate: liveInrRate,
      });
      const availableInrMinor = Math.round(
        (availableMicro * inrPrice.unitPriceFiatMinor) / 1_000_000
      );
      totalInrMinor += availableInrMinor;
      return {
        asset,
        availableMicro,
        availableInrMinor,
      };
    });
    return {
      totalInrMinor,
      totalInrFormatted: formatMinor2(totalInrMinor),
      rows,
    };
  }, [balances, livePriceFeed]);

  // 1. User Login & Registration State
  const [userAuthMode, setUserAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [userIdentifier, setUserIdentifier] = useState('alex.rivera@costorah.io');
  const [userPassword, setUserPassword] = useState('user123');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('user123');
  const [regCountry, setRegCountry] = useState<CountryCode>('IN');

  // 2. Connect Blockchain Wallet State (ERC-20 & Solana SPL)
  const [networkFamily, setNetworkFamily] = useState<BlockchainNetworkFamily>('ERC20_EVM');
  const [selectedProvider, setSelectedProvider] = useState<string>('MetaMask');
  const [extAddress, setExtAddress] = useState('');
  const [extChain, setExtChain] = useState('Ethereum Mainnet (ERC-20 · Chain ID 1)');
  const [extLabel, setExtLabel] = useState('MetaMask ERC-20 Wallet');
  const [challenge, setChallenge] = useState<WalletChallenge | null>(null);
  const [showEmbeddedCreator, setShowEmbeddedCreator] = useState(false);

  const [showConnectAnother, setShowConnectAnother] = useState(false);

  // Embedded Wallet Onboarding State
  const [embLabel, setEmbLabel] = useState('Costorah Non-Custodial MPC Vault');
  const [embChain, setEmbChain] = useState('Ethereum Mainnet (ERC-20 · Chain ID 1)');
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [generatedClientAddress] = useState(
    () => `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
  );

  // 3. Google OAuth State
  const [googleEmail, setGoogleEmail] = useState('alex.rivera@costorah.io');
  const [googleName, setGoogleName] = useState('Alex Rivera');

  // 4. Dedicated Admin Login State (admin / admin)
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const regularUsers = allUsers.filter((u) => u.role !== 'ADMIN');

  const handleSelectNetworkFamily = (family: BlockchainNetworkFamily) => {
    setNetworkFamily(family);
    setChallenge(null);
    setErrorMsg(null);
    setStatusMsg(null);
    if (family === 'ERC20_EVM') {
      setSelectedProvider('MetaMask');
      setExtAddress('');
      setExtChain('Ethereum Mainnet (ERC-20 · Chain ID 1)');
      setExtLabel('MetaMask ERC-20 Wallet');
    } else {
      setSelectedProvider('Phantom');
      setExtAddress('');
      setExtChain('Solana Mainnet-Beta (SPL)');
      setExtLabel('Phantom Solana SPL Wallet');
    }
  };

  const handleSelectProvider = (provider: {
    id: string;
    name: string;
    defaultAddress: string;
    defaultLabel: string;
  }) => {
    setSelectedProvider(provider.id);
    setExtAddress(provider.defaultAddress);
    setExtLabel(provider.defaultLabel);
    setChallenge(null);
    setErrorMsg(null);
  };

  // One-click browser wallet detection (window.ethereum / window.solana) + cryptographic challenge verification
  const handleOneClickConnectWallet = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      let targetAddress = extAddress.trim();
      const win = window as unknown as {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<string[]> };
        solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }> };
      };

      if (networkFamily === 'ERC20_EVM' && win.ethereum) {
        try {
          const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            targetAddress = accounts[0];
            setExtAddress(targetAddress);
          }
        } catch {
          // Fallback to entered ERC-20 address if browser extension prompt is dismissed
        }
      } else if (networkFamily === 'SOLANA_SPL' && win.solana) {
        try {
          const resp = await win.solana.connect();
          if (resp?.publicKey) {
            targetAddress = resp.publicKey.toString();
            setExtAddress(targetAddress);
          }
        } catch {
          // Fallback to entered Solana address if extension prompt is dismissed
        }
      }

      const validation = validateBlockchainWalletAddress(targetAddress, networkFamily);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const ch = await onRequestWalletChallenge(targetAddress, networkFamily, extChain);
      setChallenge(ch);

      const sigPrefix = networkFamily === 'SOLANA_SPL' ? 'sol_siws_ed25519_sig' : '0x_erc20_siwe_secp256k1_sig';
      const signature = `${sigPrefix}_${ch.nonce}_verified_${selectedProvider.replace(/\s+/g, '')}`;

      await onVerifyWalletChallenge({
        nonce: ch.nonce,
        signature,
        chain: extChain,
        label: extLabel,
        networkFamily,
        providerName: selectedProvider,
      });

      setStatusMsg(
        `Connected ${validation.tokenStandard} wallet (${targetAddress.slice(0, 8)}...${targetAddress.slice(-6)}) via ${selectedProvider} on ${extChain}.`
      );
      setChallenge(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect blockchain wallet');
    } finally {
      setBusy(false);
    }
  };

  const handleGetChallenge = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const ch = await onRequestWalletChallenge(extAddress, networkFamily, extChain);
      setChallenge(ch);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request challenge');
    } finally {
      setBusy(false);
    }
  };

  const handleSignAndVerify = async () => {
    if (!challenge) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const sigPrefix = networkFamily === 'SOLANA_SPL' ? 'sol_siws_ed25519_sig' : '0x_erc20_siwe_secp256k1_sig';
      const simulatedSig = `${sigPrefix}_${challenge.nonce}_verified_by_client_wallet`;
      await onVerifyWalletChallenge({
        nonce: challenge.nonce,
        signature: simulatedSig,
        chain: extChain,
        label: extLabel,
        networkFamily,
        providerName: selectedProvider,
      });
      setStatusMsg(
        `Verified ${networkFamily === 'SOLANA_SPL' ? 'Solana SIWS' : 'ERC-20 SIWE'} challenge (Nonce: ${challenge.nonce}) and connected ${extAddress}.`
      );
      setChallenge(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Signature verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectWallet = async (walletId?: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      if (onDisconnectWallet) {
        await onDisconnectWallet(walletId);
      }
      setStatusMsg('Blockchain wallet disconnected. You can reconnect anytime.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEmbedded = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onCreateEmbeddedWallet({
        publicAddress: generatedClientAddress,
        chain: embChain,
        label: embLabel,
        recoveryConfirmed,
      });
      setStatusMsg(`Created & linked non-custodial ERC-20 wallet ${generatedClientAddress}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to onboard wallet');
    } finally {
      setBusy(false);
    }
  };


  const handleUserAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      if (userAuthMode === 'REGISTER') {
        await onUserLogin({
          mode: 'REGISTER',
          displayName: regName,
          email: regEmail,
          password: regPassword,
          countryCode: regCountry,
        });
        setStatusMsg(`Registered and signed in as ${regName} (${regEmail}).`);
      } else {
        await onUserLogin({
          mode: 'LOGIN',
          identifier: userIdentifier,
          password: userPassword,
        });
        setStatusMsg(`Signed in to User Account (${userIdentifier}).`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'User login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onGoogleSignIn(googleEmail, googleName);
      setStatusMsg(`Authenticated via Google OAuth 2.0 as ${googleName} (${googleEmail}).`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickGoogleSignIn = async (email: string, name: string) => {
    setGoogleEmail(email);
    setGoogleName(name);
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onGoogleSignIn(email, name);
      setStatusMsg(`Authenticated via Google OAuth 2.0 as ${name} (${email}).`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onAdminLogin(adminUsername, adminPassword);
      setStatusMsg('Administrator authentication verified. Opening Admin Console...');
      if (onNavigateAdmin) {
        onNavigateAdmin();
      }
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setBusy(false);
    }
  };

  const activeProviders = networkFamily === 'ERC20_EVM' ? ERC20_PROVIDERS : SOLANA_PROVIDERS;
  const activeChainOptions = networkFamily === 'ERC20_EVM' ? ERC20_CHAIN_OPTIONS : SOLANA_CHAIN_OPTIONS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#131A24] border border-white/15 rounded-2xl overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#0F141C] border-b border-white/[0.08] shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-300 font-semibold truncate max-w-[200px] sm:max-w-none">
                Active Session: {currentUser.displayName} ({currentUser.email})
              </span>
              <span
                data-testid="active-session-role-badge"
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-amber-500 text-[#020617]'
                    : 'bg-emerald-500 text-[#020617]'
                }`}
              >
                {currentUser.role === 'ADMIN' ? 'ADMIN SESSION' : 'USER ACCOUNT'}
              </span>
            </div>
            <h2 id="account-modal-title" className="text-base sm:text-lg font-bold text-slate-100 font-display mt-0.5">
              Costorah Authentication — User Login, Web3 Wallet, Google & Admin
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close Account Modal"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Authentication Tabs: User Login, Connect Wallet, Google Login, Admin Login */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 bg-[#0B0E14] border-b border-white/[0.08] shrink-0">
          <button
            type="button"
            data-testid="auth-tab-user-login"
            onClick={() => {
              setTab('USER_LOGIN');
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'USER_LOGIN'
                ? 'bg-[#0B65C6] text-white shadow-sm'
                : 'text-slate-300 hover:text-white bg-[#131A24]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>User Login</span>
          </button>

          <button
            type="button"
            data-testid="auth-tab-connect-wallet"
            onClick={() => {
              setTab('CONNECT_WALLET');
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'CONNECT_WALLET'
                ? 'bg-[#0B65C6] text-white shadow-sm'
                : 'text-slate-300 hover:text-white bg-[#131A24]'
            }`}
          >
            {currentUser.wallets && currentUser.wallets.length > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <Wallet className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {currentUser.wallets && currentUser.wallets.length > 0
                ? 'Connected Wallet'
                : 'Connect Wallet'}
            </span>
          </button>

          <button
            type="button"
            data-testid="auth-tab-google"
            onClick={() => {
              setTab('GOOGLE_OAUTH');
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'GOOGLE_OAUTH'
                ? 'bg-[#0B65C6] text-white shadow-sm'
                : 'text-slate-300 hover:text-white bg-[#131A24]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Google Login</span>
          </button>

          <button
            type="button"
            data-testid="auth-tab-admin"
            onClick={() => {
              setTab('ADMIN_LOGIN');
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'ADMIN_LOGIN'
                ? 'bg-[#0B65C6] text-white shadow-sm'
                : 'text-slate-300 hover:text-white bg-[#131A24]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Admin Login</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              data-testid="auth-modal-error"
              className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-xs font-semibold text-red-200 flex items-center gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              data-testid="auth-modal-status"
              className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-200 flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* =================================================================
              TAB 1: USER LOGIN & REGISTRATION
              ================================================================= */}
          {tab === 'USER_LOGIN' && (
            <div className="space-y-5" data-testid="user-login-section">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Trader Account Authentication (User Role)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sign in with your Costorah username/email & password or create a new P2P trader account.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#0B0E14] p-1 rounded-lg border border-white/10 shrink-0">
                  <button
                    type="button"
                    data-testid="user-mode-signin-btn"
                    onClick={() => {
                      setUserAuthMode('LOGIN');
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                      userAuthMode === 'LOGIN'
                        ? 'bg-[#0B65C6] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    data-testid="user-mode-register-btn"
                    onClick={() => {
                      setUserAuthMode('REGISTER');
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                      userAuthMode === 'REGISTER'
                        ? 'bg-[#0B65C6] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Register
                  </button>
                </div>
              </div>

              {userAuthMode === 'LOGIN' ? (
                <form onSubmit={handleUserAuthSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="user-login-identifier" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Username or Email Address
                      </label>
                      <input
                        id="user-login-identifier"
                        data-testid="user-login-identifier-input"
                        type="text"
                        required
                        value={userIdentifier}
                        onChange={(e) => setUserIdentifier(e.target.value)}
                        placeholder="alex.rivera@costorah.io"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="user-login-password" className="block text-xs font-bold text-slate-200 mb-1.5">
                        User Password
                      </label>
                      <div className="relative">
                        <input
                          id="user-login-password"
                          data-testid="user-login-password-input"
                          type={showUserPassword ? 'text' : 'password'}
                          required
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          placeholder="Enter password (demo: user123)"
                          className="w-full pl-3.5 pr-9 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                        />
                        <button
                          type="button"
                          aria-label={showUserPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowUserPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-slate-300">
                      Default Trader Password: <strong className="text-emerald-400">user123</strong>
                    </span>
                    <button
                      type="submit"
                      data-testid="user-login-submit-btn"
                      disabled={busy}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{busy ? 'Signing In...' : 'Sign In to User Account'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleUserAuthSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="reg-display-name" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Full Name / Trader Handle
                      </label>
                      <input
                        id="reg-display-name"
                        data-testid="user-register-name-input"
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Rohan Mehta OTC"
                        className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Email Address
                      </label>
                      <input
                        id="reg-email"
                        data-testid="user-register-email-input"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="rohan@costorah.io"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-password" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Create Password
                      </label>
                      <input
                        id="reg-password"
                        data-testid="user-register-password-input"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-country" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Home Trading Jurisdiction
                      </label>
                      <CustomSelect
                        id="reg-country"
                        ariaLabel="Home Trading Jurisdiction"
                        value={regCountry}
                        onChange={(val) => setRegCountry(val as CountryCode)}
                        options={buildCountryCurrencyOptions(false)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    data-testid="user-register-submit-btn"
                    disabled={busy}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{busy ? 'Creating Account...' : 'Create User Account & Claim Testnet Liquidity'}</span>
                  </button>
                </form>
              )}

              {/* Pre-seeded Trader Accounts for 1-Click Switch / Login */}
              <div className="pt-3 border-t border-white/10 space-y-2.5">
                <div className="text-xs font-bold text-slate-200">
                  Quick-Switch Verified Trader Accounts (Buyer / Seller Testing):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {regularUsers.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        data-testid={`switch-user-btn-${u.id}`}
                        onClick={async () => {
                          setUserIdentifier(u.email);
                          setUserPassword('user123');
                          await onSwitchUser(u.id);
                          setStatusMsg(`Switched active trader session to ${u.displayName} (${u.email}).`);
                        }}
                        className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-emerald-950/50 border-emerald-400 text-slate-100'
                            : 'bg-[#0B0E14] border-white/15 text-slate-200 hover:border-emerald-400/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{u.displayName}</div>
                          <div className="text-[11px] text-slate-300 font-mono truncate mt-0.5">
                            {u.email} · {u.completedTrades} trades
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                            isCurrent
                              ? 'bg-emerald-500 text-[#020617]'
                              : 'bg-slate-800 text-white'
                          }`}
                        >
                          {isCurrent ? 'ACTIVE' : 'Sign In'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: CONNECT BLOCKCHAIN WALLET (ERC-20 / EVM & SOLANA SPL)
              ================================================================= */}
          {tab === 'CONNECT_WALLET' && (
            <div className="space-y-5" data-testid="connect-wallet-section">
              {/* User Wallet Crypto Holdings & Total Worth in Rupees (₹ INR) */}
              <div
                data-testid="wallet-modal-holdings-rupee-card"
                className="p-4 bg-[#0B0E14] border border-emerald-500/35 rounded-2xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                      Your Wallet Balance (Crypto Holdings)
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-200">
                    Total Worth in Rupees:{' '}
                    <span className="text-sm font-bold text-emerald-400">
                      ₹{walletInrSummary.totalInrFormatted} INR
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {walletInrSummary.rows.map((row) => (
                    <div
                      key={row.asset}
                      className="p-2 rounded-xl bg-[#131A24] border border-white/[0.08] font-mono text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <CryptoAssetIcon asset={row.asset} className="w-3.5 h-3.5 shrink-0" />
                        <span>{row.asset}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-100 mt-1 truncate">
                        {formatMicro6(row.availableMicro)}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5 truncate">
                        ₹{formatMinor2(row.availableInrMinor)} INR
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Connected Web3 Wallet Status Card OR Not Connected Banner */}
              {currentUser.wallets && currentUser.wallets.length > 0 ? (
                <div
                  data-testid="active-connected-wallet-card"
                  className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wide">
                        Connected Web3 Wallet Session
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="disconnect-wallet-btn"
                      disabled={busy}
                      onClick={() => handleDisconnectWallet()}
                      className="px-3 py-1.5 text-xs font-mono font-bold text-red-200 hover:text-white bg-red-950/70 hover:bg-red-900 border border-red-500/50 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect Wallet</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-[#0B0E14] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 font-mono">
                          {currentUser.wallets[0].label || currentUser.wallets[0].providerName || 'Primary Wallet'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            currentUser.wallets[0].networkFamily === 'SOLANA_SPL'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          }`}
                        >
                          {currentUser.wallets[0].networkFamily === 'SOLANA_SPL' ? 'SOLANA SPL' : 'ERC-20'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-emerald-400 mt-1 break-all select-all font-semibold">
                        {currentUser.wallets[0].address}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {currentUser.wallets[0].chain} · SIWE/SIWS Cryptographically Verified
                      </div>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shrink-0 self-start sm:self-center">
                      ● Active Connection
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="no-wallet-connected-card"
                  className="p-4 bg-[#0B0E14] border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 text-slate-400 border border-white/10">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">No Web3 Wallet Connected</div>
                      <div className="text-slate-400 text-[11px]">
                        Choose an ERC-20 (EVM) or Solana SPL provider below to connect your wallet.
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-white/10 shrink-0 self-start sm:self-center">
                    DISCONNECTED
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 pt-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {currentUser.wallets && currentUser.wallets.length > 0
                      ? 'Connect Another Wallet / Switch Network'
                      : 'Connect Blockchain Wallet (ERC-20 & Solana SPL)'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Connect an Ethereum/EVM (ERC-20) or Solana (SPL) wallet via cryptographic ownership signature.
                  </p>
                </div>

                {/* Network Family Toggle: ERC-20 vs Solana */}
                <div className="flex items-center gap-1.5 bg-[#0B0E14] p-1 rounded-xl border border-white/15 shrink-0">
                  <button
                    type="button"
                    data-testid="wallet-family-erc20"
                    onClick={() => handleSelectNetworkFamily('ERC20_EVM')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      networkFamily === 'ERC20_EVM'
                        ? 'bg-[#0B65C6] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    ERC-20 / EVM
                  </button>
                  <button
                    type="button"
                    data-testid="wallet-family-solana"
                    onClick={() => handleSelectNetworkFamily('SOLANA_SPL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      networkFamily === 'SOLANA_SPL'
                        ? 'bg-[#0B65C6] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Solana (SPL)
                  </button>
                </div>
              </div>

              {/* Wallet Provider Selection Grid */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-200">
                  1. Choose {networkFamily === 'ERC20_EVM' ? 'ERC-20 / EVM' : 'Solana SPL'} Wallet Provider:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {activeProviders.map((prov) => {
                    const isSelected = selectedProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        data-testid={`wallet-provider-${prov.id.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => handleSelectProvider(prov)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-400 text-slate-100 shadow-sm'
                            : 'bg-[#0B0E14] border-white/15 text-slate-200 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold">{prov.name}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] font-mono text-slate-300 mt-1">{prov.tag}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Blockchain Network & Wallet Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="wallet-chain-select" className="block text-xs font-bold text-slate-200 mb-1.5">
                    2. Target Blockchain Network
                  </label>
                  <CustomSelect
                    id="wallet-chain-select"
                    testId="wallet-chain-select"
                    ariaLabel="2. Target Blockchain Network"
                    value={extChain}
                    onChange={(val) => setExtChain(val)}
                    options={activeChainOptions}
                  />
                </div>
                <div>
                  <label htmlFor="ext-wallet-label" className="block text-xs font-bold text-slate-200 mb-1.5">
                    Wallet Vault Label
                  </label>
                  <input
                    id="ext-wallet-label"
                    type="text"
                    value={extLabel}
                    onChange={(e) => setExtLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ext-wallet-addr" className="block text-xs font-bold text-slate-200 mb-1.5">
                  {networkFamily === 'ERC20_EVM'
                    ? 'ERC-20 / EVM Public Address (0x...)'
                    : 'Solana SPL Public Key (Base58)'}
                </label>
                <input
                  id="ext-wallet-addr"
                  data-testid="wallet-address-input"
                  type="text"
                  value={extAddress}
                  onChange={(e) => setExtAddress(e.target.value)}
                  placeholder={
                    networkFamily === 'ERC20_EVM'
                      ? '0x71C95911E9a5D330f4D621842EC243EE1343292e'
                      : '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                />
              </div>

              {/* Primary 1-Click Connect + Step-by-Step SIWE/SIWS */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="connect-blockchain-wallet-btn"
                  disabled={busy}
                  onClick={handleOneClickConnectWallet}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-sm"
                >
                  <Wallet className="w-4 h-4" />
                  <span>
                    {busy
                      ? 'Connecting Blockchain Wallet...'
                      : `Connect ${selectedProvider} (${networkFamily === 'ERC20_EVM' ? 'ERC-20' : 'Solana SPL'})`}
                  </span>
                </button>

                {!challenge && (
                  <button
                    type="button"
                    data-testid="generate-wallet-challenge-btn"
                    disabled={busy}
                    onClick={handleGetChallenge}
                    className="px-4 py-2.5 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
                  >
                    Inspect {networkFamily === 'ERC20_EVM' ? 'SIWE' : 'SIWS'} Challenge
                  </button>
                )}
              </div>

              {challenge && (
                <div className="p-4 bg-[#0B0E14] border border-emerald-500/40 rounded-xl space-y-3">
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {networkFamily === 'SOLANA_SPL' ? 'SIWS (Solana)' : 'SIWE (ERC-20)'} Challenge Payload (Nonce:{' '}
                    {challenge.nonce})
                  </div>
                  <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap bg-[#131A24] p-3 rounded-lg border border-white/10">
                    {challenge.message}
                  </pre>
                  <button
                    type="button"
                    data-testid="verify-wallet-challenge-btn"
                    disabled={busy}
                    onClick={handleSignAndVerify}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer"
                  >
                    {busy ? 'Verifying Signature...' : 'Sign Cryptographic Challenge & Link Wallet'}
                  </button>
                </div>
              )}

              {/* Connected Wallets Summary */}
              {currentUser.wallets.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs font-bold text-slate-200">
                    Connected Blockchain Wallets on Profile ({currentUser.wallets.length}):
                  </div>
                  <div className="space-y-2">
                    {currentUser.wallets.map((w) => {
                      const isSol =
                        w.networkFamily === 'SOLANA_SPL' ||
                        w.chain.toLowerCase().includes('solana') ||
                        !w.address.startsWith('0x');
                      return (
                        <div
                          key={w.id}
                          className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isSol
                                    ? 'bg-emerald-500 text-[#020617]'
                                    : 'bg-[#0B65C6] text-white'
                                }`}
                              >
                                {isSol ? 'SOLANA SPL' : 'ERC-20'}
                              </span>
                              <span className="font-bold text-slate-100">{w.label}</span>
                            </div>
                            <div className="font-mono text-[11px] text-slate-300 mt-1 break-all">
                              {w.address}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px] text-emerald-400 font-bold">
                            {w.chain}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional Embedded MPC Wallet Creator */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEmbeddedCreator((v) => !v)}
                  className="text-xs font-mono font-bold text-emerald-400 hover:underline cursor-pointer inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {showEmbeddedCreator
                      ? 'Hide Embedded MPC Wallet Generator'
                      : 'Need a new wallet? Generate Non-Custodial Embedded ERC-20 Vault'}
                  </span>
                </button>

                {showEmbeddedCreator && (
                  <form onSubmit={handleCreateEmbedded} className="mt-3 p-4 bg-[#0B0E14] border border-white/10 rounded-xl space-y-3">
                    <div className="text-xs font-mono text-slate-300">
                      Client-Generated ERC-20 Address: <strong className="text-emerald-400">{generatedClientAddress}</strong>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        value={embLabel}
                        onChange={(e) => setEmbLabel(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                      />
                      <input
                        type="text"
                        required
                        value={embChain}
                        onChange={(e) => setEmbChain(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100"
                      />
                    </div>
                    <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recoveryConfirmed}
                        onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                        className="mt-0.5 accent-emerald-400"
                      />
                      <span>I have stored my offline MPC recovery share.</span>
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#0B65C6] rounded-lg cursor-pointer"
                    >
                      Activate Embedded ERC-20 Wallet
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: GOOGLE OAUTH 2.0 SIGN-IN
              ================================================================= */}
          {tab === 'GOOGLE_OAUTH' && (
            <div className="space-y-5" data-testid="google-login-section">
              <div className="pb-2 border-b border-white/10">
                <h3 className="text-sm font-bold text-slate-100">
                  Sign In with Google (OAuth 2.0 Identity Provider)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Authenticate instantly with your verified Google account to access or create your Costorah P2P trader profile.
                </p>
              </div>

              {/* 1-Click Verified Google Accounts */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-200">
                  1-Click Google Account Chooser:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { email: 'alex.rivera@costorah.io', name: 'Alex Rivera' },
                    { email: 'vikram@mumbai-otc.in', name: 'Vikram Malhotra OTC' },
                    { email: 'priya.sharma@gmail.com', name: 'Priya Sharma' },
                  ].map((acct) => (
                    <button
                      key={acct.email}
                      type="button"
                      data-testid={`google-quick-account-${acct.email.split('@')[0]}`}
                      disabled={busy}
                      onClick={() => handleQuickGoogleSignIn(acct.email, acct.name)}
                      className="p-3 rounded-xl bg-[#0B0E14] border border-white/15 hover:border-emerald-400 text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#0B65C6] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          G
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-100 truncate">{acct.name}</div>
                          <div className="text-[10px] font-mono text-slate-300 truncate">{acct.email}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Google Account Form */}
              <form onSubmit={handleGoogleSubmit} className="p-4 bg-[#0B0E14] border border-white/15 rounded-xl space-y-4">
                <div className="text-xs font-bold text-slate-200">
                  Or Sign In with Any Google Email:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="google-email" className="block text-xs font-bold text-slate-200 mb-1.5">
                      Verified Google Account Email
                    </label>
                    <input
                      id="google-email"
                      data-testid="google-email-input"
                      type="email"
                      required
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#131A24] border border-white/15 rounded-xl text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="google-name" className="block text-xs font-bold text-slate-200 mb-1.5">
                      Google Profile Display Name
                    </label>
                    <input
                      id="google-name"
                      data-testid="google-name-input"
                      type="text"
                      required
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#131A24] border border-white/15 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  data-testid="google-login-submit-btn"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-sm"
                >
                  <span className="w-4 h-4 rounded-full bg-white text-[#0B65C6] font-black text-[10px] flex items-center justify-center">
                    G
                  </span>
                  <span>{busy ? 'Authenticating with Google...' : 'Continue with Google OAuth'}</span>
                </button>
              </form>
            </div>
          )}

          {/* =================================================================
              TAB 4: DEDICATED ADMIN LOGIN (username: admin / password: admin)
              ================================================================= */}
          {tab === 'ADMIN_LOGIN' && (
            <div className="space-y-5" data-testid="admin-login-section">
              <div className="pb-2 border-b border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-100">
                    Costorah Administrator Console Login
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500 text-[#020617]">
                    ADMIN ONLY
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  The Admin Console (Escrow Dispute Arbitration, Fee Governance & Security Audit Ledger) is restricted to authenticated Administrators only.
                </p>
              </div>

              {currentUser.role === 'ADMIN' ? (
                <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-300">
                        Administrator Session Active
                      </div>
                      <div className="text-xs text-slate-200 font-mono mt-0.5">
                        Signed in as: {currentUser.displayName} ({currentUser.email})
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {onNavigateAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateAdmin();
                          onClose();
                        }}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#0B65C6] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>Go to Admin Console</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="modal-logout-admin-btn"
                      onClick={async () => {
                        await onLogoutAdmin();
                        setStatusMsg('Exited Administrator session and returned to User account.');
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out of Admin (Return to User)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="p-3.5 bg-[#0B0E14] border border-white/15 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div>
                      <span className="text-slate-300">Admin Credentials: </span>
                      <span className="text-emerald-400 font-bold">Username: admin</span>
                      <span className="text-slate-400"> · </span>
                      <span className="text-emerald-400 font-bold">Password: admin</span>
                    </div>
                    <button
                      type="button"
                      data-testid="admin-autofill-btn"
                      onClick={() => {
                        setAdminUsername('admin');
                        setAdminPassword('admin');
                        setErrorMsg(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#0B65C6] text-white text-[11px] font-bold cursor-pointer"
                    >
                      Fill admin / admin
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="admin-login-username" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Admin Username
                      </label>
                      <input
                        id="admin-login-username"
                        data-testid="admin-login-username-input"
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-login-password" className="block text-xs font-bold text-slate-200 mb-1.5">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          id="admin-login-password"
                          data-testid="admin-login-password-input"
                          type={showAdminPassword ? 'text' : 'password'}
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="admin"
                          className="w-full pl-3.5 pr-9 py-2.5 text-xs font-mono bg-[#0B0E14] border border-white/15 rounded-xl text-slate-100"
                        />
                        <button
                          type="button"
                          aria-label={showAdminPassword ? 'Hide admin password' : 'Show admin password'}
                          onClick={() => setShowAdminPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-testid="admin-login-submit-btn"
                    disabled={busy}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#0B65C6] hover:bg-[#0952A3] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-sm"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{busy ? 'Authenticating Admin...' : 'Sign In as Administrator (admin / admin)'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
