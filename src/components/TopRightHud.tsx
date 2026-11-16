import React from 'react';
import { Backpack, Coins, Crown, Map as MapIcon, Settings, Store } from 'lucide-react';

interface TopRightHudProps {
  gold: number;
  bagCount: number;
  nearDock: boolean;
  currentIslandName: string | null;
  kingdomFounded: boolean;
  soldierCount: number;
  onOpenSettings: () => void;
  onOpenMap: () => void;
  onOpenShop: () => void;
  onOpenKingdom: () => void;
}

export const TopRightHud: React.FC<TopRightHudProps> = ({
  gold,
  bagCount,
  nearDock,
  currentIslandName,
  kingdomFounded,
  soldierCount,
  onOpenSettings,
  onOpenMap,
  onOpenShop,
  onOpenKingdom,
}) => {
  return (
    <div className="pointer-events-none flex flex-col items-end gap-2">
      {/* Row 1: Settings Gear Button (top-right corner as sketched) */}
      <div className="pointer-events-auto flex items-center gap-2">
        {currentIslandName && (
          <div className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-[#0F2936]/80 border border-white/15 text-xs font-medium text-slate-100 whitespace-nowrap">
            {currentIslandName}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Ayarlar"
          title="Ayarlar"
          className="w-11 h-11 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-md transition-transform duration-100 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Row 2: Currency / Gold & Bag Bar directly below Settings */}
      <div className="pointer-events-auto flex items-center gap-2">
        {nearDock && (
          <button
            type="button"
            onClick={onOpenShop}
            className="h-10 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-200 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Tüccar</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenShop}
          title="Altın ve Çanta"
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
      </div>

      {/* Row 3: Kingdom & Map Buttons below Currency Bar */}
      <div className="pointer-events-auto flex items-center gap-2">
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
          <span>{kingdomFounded ? `Devlet (${soldierCount})` : 'Devlet Kur'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenMap}
          aria-label="Haritayı Aç (M)"
          className="h-10 px-4 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-white/20 text-slate-100 text-xs font-semibold flex items-center gap-2 shadow-md transition-transform duration-100 active:scale-95 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <MapIcon className="w-4 h-4 text-sky-300" />
          <span>Map</span>
        </button>
      </div>
    </div>
  );
};
