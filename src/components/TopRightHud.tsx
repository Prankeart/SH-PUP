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
  cycleLabel?: string;
  language?: 'tr' | 'en';
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
  cycleLabel,
  language = 'tr',
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
        {/* Mobile (Portrait & Landscape) / Narrow Window: 3-dot menu, Gold bar immediately left of Settings */}
        <div className="pointer-events-auto flex items-center justify-end gap-1.5" ref={mobileMenuRef}>
          {showHudButtons && (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="Oyun Menüsü (Tüccar, Devlet, Seyir Defteri)"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-md transition-transform duration-100 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    nearDock
                      ? 'bg-amber-500/90 border-amber-200 text-slate-950'
                      : menuOpen
                      ? 'bg-[#173D4F] border-amber-300/60 text-amber-200'
                      : 'bg-[#0F2936]/90 border-white/20 text-slate-100 hover:bg-[#173D4F]'
                  }`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-48 max-w-[calc(100vw-1rem)] p-1.5 rounded-xl bg-[#0F2936]/95 backdrop-blur-md border border-white/15 shadow-2xl flex flex-col gap-1 z-40"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenShop();
                      }}
                      className={`w-full h-10 px-3 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                        nearDock
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'text-slate-100 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Store
                          className={`w-4 h-4 shrink-0 ${nearDock ? 'text-slate-950' : 'text-amber-300'}`}
                        />
                        <span>{isEn ? 'Trader' : 'Tüccar'}</span>
                      </span>
                      {nearDock && <span className="text-[10px] font-bold">{isEn ? 'Open' : 'Açık'}</span>}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenKingdom();
                      }}
                      className="w-full h-10 px-3 rounded-lg text-xs font-semibold text-slate-100 hover:bg-white/10 flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-300 shrink-0" />
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
                        <span className="font-mono-num text-[11px] text-emerald-300">
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
                      className="w-full h-10 px-3 rounded-lg text-xs font-semibold text-slate-100 hover:bg-white/10 flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>{isEn ? 'Journal' : 'Seyir Defteri'}</span>
                      </span>
                      {journalBadgeCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold font-mono-num">
                          {journalBadgeCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenShop();
                }}
                title={isEn ? 'Gold & Bag' : 'Altın ve Çanta'}
                className="h-9 px-2.5 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-amber-400/35 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-w-0"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono-num text-xs font-bold text-amber-300 whitespace-nowrap">
                  {gold.toLocaleString('tr-TR')}
                </span>
                {bagCount > 0 && (
                  <>
                    <span className="text-white/25" aria-hidden="true">
                      ·
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 whitespace-nowrap font-mono-num">
                      <Backpack className="w-3 h-3" />
                      {bagCount}
                    </span>
                  </>
                )}
              </button>
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
              className="w-9 h-9 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-md transition-transform duration-100 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      className="pointer-events-none flex flex-col items-end gap-2 shrink-0"
    >
      {/* Row 1: Journal, Devlet Kur, Gold & Bag Bar + Settings Gear Button */}
      {(showHudButtons || showSettingsButton) && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          {showHudButtons && (
            <>
              <button
                type="button"
                onClick={onOpenJournal}
                aria-label={isEn ? 'Journal (J)' : 'Seyir Defteri (J)'}
                className="h-10 px-3 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-white/20 text-slate-100 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{isEn ? 'Journal' : 'Defter'}</span>
                {journalBadgeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold font-mono-num">
                    {journalBadgeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenKingdom}
                aria-label="Devlet ve Ordu Panelini Aç (K)"
                className={`h-10 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-md transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  kingdomFounded
                    ? 'bg-[#0F2936]/90 hover:bg-[#173D4F] border-emerald-400/45 text-emerald-200'
                    : 'bg-[#0F2936]/90 hover:bg-[#173D4F] border-amber-400/45 text-amber-200'
                }`}
              >
                <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  {kingdomFounded
                    ? `${isEn ? 'Nation' : 'Devlet'} (${soldierCount})`
                    : isEn
                    ? 'Found Nation'
                    : 'Devlet Kur'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenShop}
                title={isEn ? 'Gold & Bag' : 'Altın ve Çanta'}
                className="h-10 px-3.5 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-amber-400/35 flex items-center gap-2.5 shadow-md transition-colors cursor-pointer"
              >
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono-num text-sm font-bold text-amber-300 whitespace-nowrap">
                  {gold.toLocaleString('tr-TR')}
                </span>
                {bagCount > 0 && (
                  <>
                    <span className="text-white/25" aria-hidden="true">
                      ·
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-300 whitespace-nowrap font-mono-num">
                      <Backpack className="w-3.5 h-3.5" />
                      {bagCount}
                    </span>
                  </>
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
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-md transition-transform duration-100 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Row 2: Season/Day label + Contextual Tüccar button when docked */}
      {(cycleLabel || (nearDock && showHudButtons)) && (
        <div className="pointer-events-auto flex items-center gap-2">
          {cycleLabel && (
            <div className="h-8 px-3 rounded-lg bg-[#0F2936]/80 border border-white/10 text-[11px] font-medium text-slate-200 flex items-center shadow-sm whitespace-nowrap">
              {cycleLabel}
            </div>
          )}
          {nearDock && showHudButtons && (
            <button
              type="button"
              onClick={onOpenShop}
              className="h-10 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-200 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Trader' : 'Tüccar'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
