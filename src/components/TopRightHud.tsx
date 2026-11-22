import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  BookOpen,
  Coins,
  Crown,
  MoreVertical,
  Settings,
  Store,
} from 'lucide-react';

interface TopRightHudProps {
  isCompactMode: boolean;
  maxWidth?: number;
  gold: number;
  bagCount: number;
  nearDock: boolean;
  kingdomFounded: boolean;
  soldierCount: number;
  journalBadgeCount?: number;
  weaponOffsetRight?: number;
  language?: 'tr' | 'en';
  shopKeyLabel?: string;
  showSettingsButton?: boolean;
  showHudButtons?: boolean;
  onOpenSettings: () => void;
  onOpenShop: () => void;
  onOpenKingdom: () => void;
  onOpenJournal: () => void;
}

export const TopRightHud: React.FC<TopRightHudProps> = ({
  isCompactMode,
  maxWidth,
  gold,
  bagCount,
  nearDock,
  kingdomFounded,
  soldierCount,
  journalBadgeCount = 0,
  weaponOffsetRight = 0,
  language = 'tr',
  shopKeyLabel,
  showSettingsButton = true,
  showHudButtons = true,
  onOpenSettings,
  onOpenShop,
  onOpenKingdom,
  onOpenJournal,
}) => {
  const isEn = language === 'en';
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isCompactMode) {
      setMenuOpen(false);
    }
  }, [isCompactMode]);

  if (!showHudButtons && !showSettingsButton) {
    return null;
  }

  if (isCompactMode) {
    return (
      <div
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
        className="pointer-events-none flex flex-col items-end gap-1.5 shrink-0"
      >
        {(showHudButtons || showSettingsButton) && (
          <div
            ref={mobileMenuRef}
            className="pointer-events-auto relative flex items-center rounded-xl bg-[#061017]/86 backdrop-blur-md border border-white/10 divide-x divide-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            {showHudButtons && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenShop();
                  }}
                  title={isEn ? 'Gold & Bag' : 'Altın ve Çanta'}
                  className="h-10 px-2.5 flex items-center gap-1.5 hover:bg-white/[0.06] active:bg-white/10 transition-colors cursor-pointer min-w-0 rounded-l-xl"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-mono-num text-xs font-bold text-slate-100 whitespace-nowrap">
                    {gold.toLocaleString('tr-TR')}
                  </span>
                  {bagCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-400 whitespace-nowrap font-mono-num pl-1 border-l border-white/10">
                      <Backpack className="w-3 h-3" />
                      {bagCount}
                    </span>
                  )}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label={isEn ? 'Game Menu (Trader, Nation, Journal)' : 'Oyun Menüsü (Tüccar, Devlet, Seyir Defteri)'}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className={`relative w-10 h-10 flex items-center justify-center transition-colors cursor-pointer ${
                      nearDock
                        ? 'bg-amber-400 text-slate-950'
                        : menuOpen
                        ? 'bg-white/12 text-amber-300'
                        : 'text-slate-200 hover:bg-white/[0.06]'
                    } ${!showSettingsButton ? 'rounded-r-xl' : ''}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                    {journalBadgeCount > 0 && !nearDock && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400"
                      />
                    )}
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-xl bg-[#0A1720]/96 backdrop-blur-xl border border-white/12 shadow-[0_18px_48px_rgba(0,0,0,0.7)] divide-y divide-white/[0.06] z-50"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenShop();
                        }}
                        className={`w-full min-h-[44px] px-3.5 text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                          nearDock
                            ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
                            : 'text-slate-100 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Store className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{isEn ? 'Trader' : 'Tüccar'}</span>
                        </span>
                        {nearDock && (
                          <span className="text-[10px] font-bold text-amber-300">
                            {isEn ? 'Open' : 'Açık'}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenKingdom();
                        }}
                        className="w-full min-h-[44px] px-3.5 text-xs font-semibold text-slate-100 hover:bg-white/[0.06] flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {kingdomFounded
                              ? isEn
                                ? 'Nation'
                                : 'Devlet'
                              : isEn
                              ? 'Found Nation'
                              : 'Devlet Kur'}
                          </span>
                        </span>
                        {kingdomFounded && (
                          <span className="font-mono-num text-[11px] font-semibold text-emerald-400">
                            {soldierCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenJournal();
                        }}
                        className="w-full min-h-[44px] px-3.5 text-xs font-semibold text-slate-100 hover:bg-white/[0.06] flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                          <span>{isEn ? 'Journal' : 'Seyir Defteri'}</span>
                        </span>
                        {journalBadgeCount > 0 && (
                          <span className="font-mono-num text-[11px] font-bold text-emerald-400">
                            {journalBadgeCount}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {showSettingsButton && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                }}
                aria-label={isEn ? 'Settings' : 'Ayarlar'}
                title={isEn ? 'Settings' : 'Ayarlar'}
                className={`w-10 h-10 text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  !showHudButtons ? 'rounded-xl' : 'rounded-r-xl'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      className="pointer-events-none flex flex-col items-end gap-2 shrink-0"
    >
      {/* Unified Single-Row Hairline Command Bar */}
      {(showHudButtons || showSettingsButton) && (
        <div className="pointer-events-auto flex items-center rounded-xl bg-[#061017]/84 backdrop-blur-md border border-white/10 divide-x divide-white/[0.08] shadow-[0_10px_28px_rgba(0,0,0,0.45)] overflow-hidden">
          {showHudButtons && (
            <>
              <button
                type="button"
                onClick={onOpenJournal}
                aria-label={isEn ? 'Journal (J)' : 'Seyir Defteri (J)'}
                className="h-10 px-3 hover:bg-white/[0.06] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{isEn ? 'Journal' : 'Defter'}</span>
                {journalBadgeCount > 0 && (
                  <span className="font-mono-num text-[11px] font-bold text-emerald-400">
                    ({journalBadgeCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenKingdom}
                aria-label={isEn ? 'Nation & Army (K)' : 'Devlet ve Ordu Panelini Aç (K)'}
                className="h-10 px-3 hover:bg-white/[0.06] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Crown
                  className={`w-3.5 h-3.5 shrink-0 ${
                    kingdomFounded ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <span>
                  {kingdomFounded
                    ? `${isEn ? 'Nation' : 'Devlet'} · ${soldierCount}`
                    : isEn
                    ? 'Found Nation'
                    : 'Devlet Kur'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenShop}
                title={isEn ? 'Gold & Bag (T)' : 'Altın ve Çanta (T)'}
                className="h-10 px-3.5 hover:bg-white/[0.06] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono-num text-xs font-bold text-amber-300 whitespace-nowrap">
                  {gold.toLocaleString('tr-TR')}
                </span>
                {bagCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 whitespace-nowrap font-mono-num pl-2 border-l border-white/10">
                    <Backpack className="w-3.5 h-3.5" />
                    {bagCount}
                  </span>
                )}
              </button>
            </>
          )}

          {showSettingsButton && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={isEn ? 'Settings' : 'Ayarlar'}
              title={isEn ? 'Settings' : 'Ayarlar'}
              className="w-10 h-10 text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Contextual Trader Action when near dock */}
      {nearDock && showHudButtons && (
        <div
          style={weaponOffsetRight > 0 ? { marginRight: `${weaponOffsetRight}px` } : undefined}
          className="pointer-events-auto flex items-center justify-end"
        >
          <button
            type="button"
            onClick={onOpenShop}
            className="h-9 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Open Trader' : 'Tüccarı Aç'}</span>
            {shopKeyLabel && (
              <kbd className="font-mono-num text-[10px] px-1 py-0.5 rounded bg-black/15">
                {shopKeyLabel}
              </kbd>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
