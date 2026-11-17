import React from 'react';
import { Backpack, Coins, Compass, Crosshair, Pickaxe, Ship, Sparkles, Store, X } from 'lucide-react';
import { BagItem, Upgrades } from '../types/game';
import { getUpgradeCost, UPGRADE_DEFS, UpgradeKey } from '../engine/upgrades';

interface ShopModalProps {
  gold: number;
  bag: BagItem[];
  upgrades: Upgrades;
  nearDock: boolean;
  onSellAll: () => void;
  onSellItem: (uid: string) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onClose: () => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, React.ReactNode> = {
  shovelLevel: <Pickaxe className="w-5 h-5 text-amber-300" />,
  boatLevel: <Ship className="w-5 h-5 text-sky-300" />,
  cannonLevel: <Crosshair className="w-5 h-5 text-red-400" />,
  radarLevel: <Compass className="w-5 h-5 text-emerald-300" />,
  luckLevel: <Sparkles className="w-5 h-5 text-yellow-300" />,
};

const RARITY_LABELS: Record<BagItem['rarity'], string> = {
  COMMON: 'Sıradan',
  RARE: 'Nadir',
  EPIC: 'Destansı',
  LEGENDARY: 'Efsanevi',
};

export const ShopModal: React.FC<ShopModalProps> = ({
  gold,
  bag,
  upgrades,
  nearDock,
  onSellAll,
  onSellItem,
  onBuyUpgrade,
  onClose,
}) => {
  const totalBagValue = bag.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Liman Tüccarı ve Geliştirmeler"
    >
      <div className="w-full max-w-4xl max-h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              Liman Tüccarı
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{gold.toLocaleString('tr-TR')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Dükkanı Kapat"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!nearDock && (
          <div className="px-5 py-2.5 bg-amber-500/15 border-b border-amber-400/25 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>
              Satış ve geliştirme yapmak için haritada altın işaretle gösterilen Tüccar İskelesi&apos;ne yaklaşın.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Backpack className="w-4 h-4 text-emerald-300" />
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Hazine Çantası ({bag.length})
                </h3>
              </div>
              {bag.length > 0 && (
                <button
                  type="button"
                  onClick={onSellAll}
                  disabled={!nearDock}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    nearDock
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                      : 'bg-white/10 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Tümünü Sat (+{totalBagValue})
                </button>
              )}
            </div>

            {bag.length === 0 ? (
              <div className="py-10 px-4 rounded-xl border border-white/10 bg-slate-950/25 text-center text-xs text-slate-300">
                Çantanız şu an boş. Adalarda kazı yaparak hazine sandıkları bulun.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {bag.map((item) => (
                  <div
                    key={item.uid}
                    className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span style={{ color: item.color }}>{RARITY_LABELS[item.rarity]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.islandName}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSellItem(item.uid)}
                      disabled={!nearDock}
                      className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold shrink-0 transition-colors ${
                        nearDock
                          ? 'bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      +{item.value} Altın
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Ekipman Geliştirmeleri
            </h3>
            <div className="flex flex-col gap-2.5">
              {UPGRADE_DEFS.map((def) => {
                const level = upgrades[def.key];
                const isMax = level >= def.maxLevel;
                const cost = getUpgradeCost(def, level);
                const canAfford = gold >= cost;

                return (
                  <div
                    key={def.key}
                    className="p-3 sm:p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        {UPGRADE_ICONS[def.key]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                          <span>{def.title}</span>
                          <span className="font-mono-num text-xs text-amber-300">
                            Sv. {level}/{def.maxLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{def.subtitle}</p>
                        <div className="text-[11px] text-sky-300 mt-1 font-mono-num">
                          {def.statLabel(level)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isMax || !canAfford || !nearDock}
                      onClick={() => onBuyUpgrade(def.key)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono-num shrink-0 transition-colors whitespace-nowrap ${
                        isMax
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default'
                          : nearDock && canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isMax ? 'Maksimum' : `${cost} Altın`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
