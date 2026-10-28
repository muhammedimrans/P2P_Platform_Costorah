import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import {
  COUNTRY_ORDER_LIST,
  FIAT_SYMBOLS,
  type CountryCode,
  type CryptoAsset,
  type FiatCurrency,
} from '../types';
import { CryptoAssetIcon, CRYPTO_ASSET_CATALOG } from './CryptoAssetIcons';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badgeText?: string;
  badgeVariant?: 'emerald' | 'blue' | 'amber' | 'slate';
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  id?: string;
  testId?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  testId,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  ariaLabel,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  searchable,
  searchPlaceholder = 'Filter options...',
  size = 'md',
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || options[0],
    [options, value]
  );

  const enableSearch = searchable ?? options.length >= 6;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badgeText && opt.badgeText.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && enableSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open, enableSearch]);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs min-h-[34px]'
      : size === 'lg'
      ? 'px-4 py-2.5 text-sm min-h-[44px]'
      : 'px-3 py-2 text-xs min-h-[38px]';

  const getBadgeStyle = (variant?: 'emerald' | 'blue' | 'amber' | 'slate') => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'blue':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'amber':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-white/[0.06] text-slate-300 border-white/15';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel || placeholder}
        data-testid={testId}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-[#0B0E14] hover:bg-[#131A24] border transition-all cursor-pointer text-left ${
          open
            ? 'border-emerald-400 ring-2 ring-emerald-500/20'
            : 'border-white/15 hover:border-emerald-500/40'
        } ${sizeClasses} ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center">{selectedOption.icon}</span>
          )}
          {selectedOption?.badgeText && (
            <span
              className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${getBadgeStyle(
                selectedOption.badgeVariant
              )}`}
            >
              {selectedOption.badgeText}
            </span>
          )}
          <span className="font-semibold text-slate-100 truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          data-testid={testId ? `${testId}-listbox` : undefined}
          className={`absolute z-50 mt-1.5 min-w-full w-max max-w-[360px] sm:max-w-[420px] rounded-xl bg-[#131A24] border border-emerald-500/35 shadow-2xl overflow-hidden backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {enableSearch && (
            <div className="p-2 border-b border-white/[0.08] bg-[#0B0E14]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#131A24] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-semibold'
                        : 'text-slate-200 hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.icon && (
                        <span className="shrink-0 flex items-center">{opt.icon}</span>
                      )}
                      {opt.badgeText && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${getBadgeStyle(
                            isSelected ? 'emerald' : opt.badgeVariant
                          )}`}
                        >
                          {opt.badgeText}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-100">
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="block text-[10px] font-mono text-slate-400 truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </span>
                    </span>

                    {isSelected && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Helper to build rich Country + Fiat Currency options for Costorah selectors
 */
export function buildCountryCurrencyOptions(includeGlobalAll?: boolean): CustomSelectOption[] {
  const items: CustomSelectOption[] = COUNTRY_ORDER_LIST.map((c) => {
    const rails = Array.isArray(c.localPaymentMethods) ? c.localPaymentMethods.slice(0, 2).join(', ') : '';
    return {
      value: c.code,
      badgeText: `${c.code} · ${c.fiatSymbol.trim()}`,
      badgeVariant: 'emerald',
      label: `${c.name} — ${c.fiatCurrency} (${c.fiatSymbol.trim()})`,
      sublabel: rails ? `${c.fiatName} · ${rails}` : c.fiatName,
    };
  });

  if (includeGlobalAll) {
    return [
      {
        value: 'ALL',
        badgeText: 'GLOBAL',
        badgeVariant: 'blue',
        label: 'All Global Corridors (All Currencies)',
        sublabel: 'View all 10 fiat settlement corridors',
      },
      ...items,
    ];
  }

  return items;
}

/**
 * Helper to build rich Fiat Currency options with currency symbols and country names
 */
export function buildFiatCurrencyOptions(
  currencies: FiatCurrency[],
  includeAllLabel?: string
): CustomSelectOption[] {
  const items: CustomSelectOption[] = currencies.map((fiat) => {
    const country = COUNTRY_ORDER_LIST.find((c) => c.fiatCurrency === fiat);
    const sym = FIAT_SYMBOLS[fiat];
    return {
      value: fiat,
      badgeText: `${sym} ${fiat}`,
      badgeVariant: 'emerald',
      label: `${fiat} (${sym}) — ${country ? country.fiatName : fiat}`,
      sublabel: country ? `${country.name} (${country.code})` : undefined,
    };
  });

  if (includeAllLabel) {
    return [
      {
        value: 'ALL',
        badgeText: 'ALL FIAT',
        badgeVariant: 'blue',
        label: includeAllLabel,
        sublabel: 'INR, USD, EUR, GBP, TRY, NGN, BRL, AED, VND, IRR',
      },
      ...items,
    ];
  }

  return items;
}

/**
 * Helper to build rich Cryptocurrency options with official SVG icons
 */
export function buildCryptoAssetOptions(
  assets: CryptoAsset[],
  options?: {
    includeAllLabel?: string;
    balancesMap?: Record<string, string>;
  }
): CustomSelectOption[] {
  const items: CustomSelectOption[] = assets.map((asset) => {
    const meta = CRYPTO_ASSET_CATALOG[asset];
    const avail = options?.balancesMap?.[asset];
    return {
      value: asset,
      icon: <CryptoAssetIcon asset={asset} className="w-4 h-4" />,
      label: `${asset} — ${meta.name}`,
      sublabel: avail ? `Avail: ${avail} ${asset}` : meta.tagline,
    };
  });

  if (options?.includeAllLabel) {
    return [
      {
        value: 'ALL',
        badgeText: '5 ASSETS',
        badgeVariant: 'emerald',
        label: options.includeAllLabel,
        sublabel: 'BTC · ETH · SOL · USDT · USDC',
      },
      ...items,
    ];
  }

  return items;
}
