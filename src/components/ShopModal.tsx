import React, { useState } from 'react';
import {
  Backpack,
  Bird,
  Check,
  Coins,
  Compass,
  Crosshair,
  Fish,
  Hammer,
  HeartPulse,
  Lock,
  Pickaxe,
  Shield,
  Ship,
  Sparkles,
  Store,
  Swords,
  Trees,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { BagItem, PetId, Upgrades, WeaponId } from '../types/game';
import { getUpgradeCost, UPGRADE_DEFS, UpgradeKey } from '../engine/upgrades';
import { PET_DEFS } from '../engine/progression';
import { MAX_CARRIED_WEAPONS, WEAPON_LIST, WEAPONS } from '../engine/weapons';
import { WeaponSilhouette } from './WeaponHudPanel';

type ShopTab = 'TRADE' | 'ARSENAL' | 'WORKSHOP' | 'PETS';
type ArsenalFilter = 'ALL' | 'MELEE' | 'RANGED' | 'OWNED';

interface ShopModalProps {
  gold: number;
  bag: BagItem[];
  upgrades: Upgrades;
  nearDock: boolean;
  wood?: number;
  iron?: number;
  repairKits?: number;
  caughtFishCount?: number;
  ownedPets?: PetId[];
  activePet?: PetId | null;
  unlockedWeapons?: WeaponId[];
  equippedWeapon?: WeaponId | null;
  weaponSlots?: WeaponId[];
  language?: 'tr' | 'en';
  onlineMode?: boolean;
  onSellAll: () => void;
  onSellItem: (uid: string) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onEquipWeapon?: (weaponId: WeaponId, replaceSlotIndex?: number) => void;
  onBuyWeapon?: (weaponId: WeaponId, replaceSlotIndex?: number) => void;
  onSellResources?: () => void;
  onCraftRepairKit?: () => void;
  onUseRepairKit?: () => void;
  onAdoptPet?: (petId: PetId) => void;
  onEquipPet?: (petId: PetId | null) => void;
  onClose: () => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, React.ReactNode> = {
  shovelLevel: <Pickaxe className="w-5 h-5 text-amber-300" />,
  boatLevel: <Ship className="w-5 h-5 text-sky-300" />,
  cannonLevel: <Crosshair className="w-5 h-5 text-red-400" />,
  radarLevel: <Compass className="w-5 h-5 text-emerald-300" />,
  luckLevel: <Sparkles className="w-5 h-5 text-yellow-300" />,
  hullPlatingLevel: <Shield className="w-5 h-5 text-cyan-300" />,
  crewSkillLevel: <Users className="w-5 h-5 text-purple-300" />,
  repairShellsLevel: <HeartPulse className="w-5 h-5 text-emerald-400" />,
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
  wood = 0,
  iron = 0,
  repairKits = 0,
  caughtFishCount = 0,
  ownedPets = [],
  activePet = null,
  unlockedWeapons = [],
  equippedWeapon = null,
  weaponSlots = [],
  language = 'tr',
  onSellAll,
  onSellItem,
  onBuyUpgrade,
  onEquipWeapon,
  onBuyWeapon,
  onSellResources,
  onCraftRepairKit,
  onUseRepairKit,
  onAdoptPet,
  onEquipPet,
  onClose,
}) => {
  const [tab, setTab] = useState<ShopTab>('TRADE');
  const [arsenalFilter, setArsenalFilter] = useState<ArsenalFilter>('ALL');
  const [targetReplaceSlot, setTargetReplaceSlot] = useState<number>(0);
  const isEn = language === 'en';
  const carriedFull = weaponSlots.length >= MAX_CARRIED_WEAPONS;
  const effectiveReplaceSlot = carriedFull ? targetReplaceSlot : undefined;
  const totalBagValue = bag.reduce((sum, item) => sum + item.value, 0);
  const resourceSellValue = wood * 12 + iron * 18;
  const canCraftWithRes = wood >= 2 && iron >= 1;
  const canCraftWithGold = gold >= 60;

  const filteredWeapons = WEAPON_LIST.filter((w) => {
    if (arsenalFilter === 'MELEE') return w.kind === 'MELEE';
    if (arsenalFilter === 'RANGED') return w.kind === 'RANGED';
    if (arsenalFilter === 'OWNED') return unlockedWeapons.includes(w.id);
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:p-6 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Harbor Merchant & Upgrades' : 'Liman Tüccarı ve Geliştirmeler'}
    >
      <div className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-3.5 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {isEn ? 'Harbor Merchant' : 'Liman Tüccarı'}
            </h2>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{gold.toLocaleString('tr-TR')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Shop' : 'Dükkanı Kapat'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Single-row horizontal tab navigation on mobile */}
        <div className="px-3 sm:px-5 py-2 border-b border-white/10 flex flex-nowrap items-center gap-1.5 overflow-x-auto bg-slate-950/25 shrink-0">
          <button
            type="button"
            onClick={() => setTab('TRADE')}
            className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'TRADE'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? 'Trade' : 'Tüccar'}</span>
            <span className="hidden sm:inline">{isEn ? 'Trade & Upgrades' : 'Tüccar & Yükseltme'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ARSENAL')}
            className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'ARSENAL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? 'Weapons' : 'Silahlar'}</span>
            <span className="hidden sm:inline">{isEn ? 'Weapons & Arsenal' : 'Silahlar & Cephanelik'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('WORKSHOP')}
            className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'WORKSHOP'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? 'Workshop' : 'Atölye'}</span>
            <span className="hidden sm:inline">{isEn ? 'Workshop & Resources' : 'Atölye & Kaynaklar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('PETS')}
            className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'PETS'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Bird className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? 'Pets' : 'Evcil'}</span>
            <span className="hidden sm:inline">{isEn ? 'Pets & Fishing' : 'Evcil Hayvan & Balık'}</span>
          </button>
        </div>

        {!nearDock && tab === 'TRADE' && (
          <div className="px-5 py-2.5 bg-amber-500/15 border-b border-amber-400/25 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>
              {isEn
                ? 'Approach a gold Trader Dock on the map to sell treasures or purchase upgrades.'
                : "Satış ve geliştirme yapmak için haritada altın işaretle gösterilen Tüccar İskelesi'ne yaklaşın."}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {tab === 'TRADE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Backpack className="w-4 h-4 text-emerald-300" />
                    <h3 className="font-display text-base font-semibold text-slate-100">
                      {isEn ? `Treasure Bag (${bag.length})` : `Hazine Çantası (${bag.length})`}
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
                      {isEn ? `Sell All (+${totalBagValue})` : `Tümünü Sat (+${totalBagValue})`}
                    </button>
                  )}
                </div>

                {bag.length === 0 ? (
                  <div className="py-10 px-4 rounded-xl border border-white/10 bg-slate-950/25 text-center text-xs text-slate-300">
                    {isEn
                      ? 'Your bag is empty. Dig on islands to uncover treasure chests.'
                      : 'Çantanız şu an boş. Adalarda kazı yaparak hazine sandıkları bulun.'}
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
                          +{item.value} {isEn ? 'Gold' : 'Altın'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="font-display text-base font-semibold text-slate-100">
                  {isEn ? 'Equipment & Ship Upgrades' : 'Ekipman Geliştirmeleri'}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {UPGRADE_DEFS.map((def) => {
                    const level = upgrades[def.key] ?? 1;
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
                          {isMax ? (isEn ? 'Max' : 'Maksimum') : `${cost} ${isEn ? 'Gold' : 'Altın'}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'ARSENAL' && (
            <div className="flex flex-col gap-3.5">
              {/* Compact 2-Slot Carried Loadout Strip */}
              <div className="rounded-xl bg-slate-950/45 border border-white/12 p-3">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                      {isEn
                        ? `Active Loadout (${weaponSlots.length}/${MAX_CARRIED_WEAPONS})`
                        : `Taşınan Silahlar (${weaponSlots.length}/${MAX_CARRIED_WEAPONS})`}
                    </span>
                  </div>
                  {carriedFull && (
                    <span className="text-[11px] font-medium text-amber-300 whitespace-nowrap">
                      {isEn
                        ? `Replacing Slot ${targetReplaceSlot + 1}`
                        : `Yeni seçim: Slot ${targetReplaceSlot + 1}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((slotIdx) => {
                    const slotId = weaponSlots[slotIdx];
                    const slotDef = slotId ? WEAPONS[slotId] : null;
                    const isActive = Boolean(slotId && equippedWeapon === slotId);
                    const isReplaceTarget = carriedFull && targetReplaceSlot === slotIdx;

                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() => {
                          if (slotId) {
                            onEquipWeapon?.(slotId);
                          }
                          if (carriedFull) {
                            setTargetReplaceSlot(slotIdx);
                          }
                        }}
                        className={`min-h-[68px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-emerald-950/50 border-emerald-400/65 shadow-sm'
                            : isReplaceTarget
                            ? 'bg-amber-950/35 border-amber-400/55'
                            : 'bg-slate-900/60 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono-num font-bold uppercase tracking-wider text-slate-400">
                            Slot {slotIdx + 1}
                          </span>
                          {isActive ? (
                            <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                              {isEn ? 'Active' : 'Aktif'}
                            </span>
                          ) : isReplaceTarget ? (
                            <span className="text-[10px] font-bold text-amber-300">
                              {isEn ? 'Target' : 'Hedef'}
                            </span>
                          ) : null}
                        </div>

                        {slotDef ? (
                          <div className="flex items-center gap-2 min-w-0 w-full">
                            <WeaponSilhouette
                              weaponId={slotDef.id}
                              className="w-10 h-4 shrink-0"
                              style={{ color: slotDef.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-100 truncate">
                                {isEn ? slotDef.nameEn : slotDef.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono-num">
                                {slotDef.kind === 'MELEE'
                                  ? isEn
                                    ? 'Melee · ∞'
                                    : 'Yakın · ∞'
                                  : `${slotDef.magSize ?? 0} ${isEn ? 'Ammo' : 'Mermi'}`}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            {isEn ? 'Empty Slot' : 'Boş Slot'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Filter Strip */}
              <div className="grid grid-cols-4 sm:inline-flex sm:self-start gap-1 p-1 rounded-xl bg-slate-950/45 border border-white/10">
                {(
                  [
                    { id: 'ALL', label: isEn ? 'All' : 'Tümü' },
                    { id: 'MELEE', label: isEn ? 'Melee' : 'Yakın' },
                    { id: 'RANGED', label: isEn ? 'Ranged' : 'Menzilli' },
                    { id: 'OWNED', label: isEn ? 'Owned' : 'Bende' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setArsenalFilter(cat.id)}
                    className={`h-8 px-2 sm:px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      arsenalFilter === cat.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Clean Mobile-Optimized Weapon Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {filteredWeapons.map((w) => {
                  const unlocked = unlockedWeapons.includes(w.id);
                  const slotIdx = weaponSlots.indexOf(w.id);
                  const carried = slotIdx >= 0;
                  const equipped = equippedWeapon === w.id;
                  const canBuy = Boolean(w.shopCost && gold >= w.shopCost);
                  const damageText = w.pellets > 1 ? `${w.damage}×${w.pellets}` : `${w.damage}`;
                  const specialPerk = w.splashRadius
                    ? isEn
                      ? 'AoE Blast'
                      : 'Alan Hasarı'
                    : w.lifesteal
                    ? `+${w.lifesteal} HP`
                    : null;

                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-colors ${
                        equipped
                          ? 'bg-emerald-950/30 border-emerald-400/55'
                          : carried
                          ? 'bg-sky-950/25 border-sky-400/40'
                          : 'bg-slate-950/35 border-white/10'
                      }`}
                    >
                      {/* Top Header with Silhouette Bay */}
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-11 rounded-lg bg-slate-950/70 border border-white/10 flex items-center justify-center shrink-0 px-1.5">
                          <WeaponSilhouette
                            weaponId={w.id}
                            className="w-full h-6 drop-shadow-sm"
                            style={{ color: w.color }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-50 truncate">
                              {isEn ? w.nameEn : w.name}
                            </span>
                            <span className="text-[11px] font-mono-num text-amber-300 shrink-0">
                              Sv.{w.tier}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {isEn ? w.descriptionEn : w.description}
                          </p>
                        </div>
                      </div>

                      {/* Clean 3-Stat Row */}
                      <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-950/35 rounded-lg py-1.5 px-2 border border-white/5">
                        <div>
                          <div className="text-[10px] text-slate-400">
                            {isEn ? 'Damage' : 'Hasar'}
                          </div>
                          <div className="text-xs font-mono-num font-bold text-slate-100">
                            {damageText}
                          </div>
                        </div>
                        <div className="border-x border-white/10">
                          <div className="text-[10px] text-slate-400">
                            {isEn ? 'Range' : 'Menzil'}
                          </div>
                          <div className="text-xs font-mono-num font-bold text-sky-300">
                            {w.range}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">
                            {w.magSize ? (isEn ? 'Mag' : 'Şarjör') : isEn ? 'Type' : 'Tür'}
                          </div>
                          <div className="text-xs font-mono-num font-bold text-amber-300">
                            {w.magSize ? w.magSize : isEn ? 'Melee' : 'Yakın'}
                          </div>
                        </div>
                      </div>

                      {specialPerk && (
                        <div className="text-[11px] font-medium text-emerald-300/90 -mt-1 px-0.5">
                          {specialPerk}
                        </div>
                      )}

                      {/* Action Button */}
                      {unlocked ? (
                        <button
                          type="button"
                          disabled={equipped}
                          onClick={() => onEquipWeapon?.(w.id, carried ? undefined : effectiveReplaceSlot)}
                          className={`w-full min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            equipped
                              ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 cursor-default'
                              : carried
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                              : 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 cursor-pointer'
                          }`}
                        >
                          {equipped ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {isEn
                                  ? `Equipped (Slot ${slotIdx + 1})`
                                  : `Aktif · Slot ${slotIdx + 1}`}
                              </span>
                            </>
                          ) : carried ? (
                            <span>
                              {isEn ? `Use Slot ${slotIdx + 1}` : `Eline Al (Slot ${slotIdx + 1})`}
                            </span>
                          ) : carriedFull ? (
                            <span>
                              {isEn
                                ? `Equip to Slot ${targetReplaceSlot + 1}`
                                : `Slot ${targetReplaceSlot + 1} Yerine Kuşan`}
                            </span>
                          ) : (
                            <span>{isEn ? 'Equip Weapon' : 'Kuşan'}</span>
                          )}
                        </button>
                      ) : w.shopCost ? (
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuyWeapon?.(w.id, effectiveReplaceSlot)}
                          className={`w-full min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 transition-colors ${
                            canBuy
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-white/10 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>
                            {isEn ? `Buy · ${w.shopCost} Gold` : `Satın Al · ${w.shopCost} Altın`}
                          </span>
                        </button>
                      ) : (
                        <div className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {w.id === 'ANCIENT_HARPOON'
                              ? isEn
                                ? 'Win Battle Arena'
                                : 'Savaş Arenası Ödülü'
                              : isEn
                              ? 'Cave Altar / Island Loot'
                              : 'Mağara Sunağı / Ada Ganimeti'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'WORKSHOP' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Trees className="w-4 h-4 text-emerald-300" />
                  <h3 className="font-display text-base font-semibold text-slate-100">
                    {isEn ? 'Island Resources' : 'Ada Kaynakları'}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEn
                    ? 'Harvest timber piles and iron ore veins on islands using Dig (Space) or Weapon Attack (F). Sell them for gold or craft Repair Kits and Fort Turrets!'
                    : 'Adalardaki kütük yığınlarını ve demir damarlarını Kazı (Boşluk) veya Silah (F) ile topla. Altına çevir veya Tamir Kiti & Kale Kulesi üret!'}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10">
                    <div className="text-xs text-amber-200 font-semibold">
                      {isEn ? 'Timber (Wood)' : 'Kereste (Odun)'}
                    </div>
                    <div className="text-2xl font-mono-num font-bold text-slate-50 mt-1">
                      {wood}
                    </div>
                    <div className="text-[11px] text-slate-400">12 {isEn ? 'Gold / ea' : 'Altın / adet'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10">
                    <div className="text-xs text-sky-200 font-semibold">
                      {isEn ? 'Iron Ore' : 'Demir Cevheri'}
                    </div>
                    <div className="text-2xl font-mono-num font-bold text-slate-50 mt-1">
                      {iron}
                    </div>
                    <div className="text-[11px] text-slate-400">18 {isEn ? 'Gold / ea' : 'Altın / adet'}</div>
                  </div>
                </div>

                {onSellResources && (
                  <button
                    type="button"
                    disabled={!nearDock || resourceSellValue <= 0}
                    onClick={onSellResources}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      nearDock && resourceSellValue > 0
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                        : 'bg-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {nearDock
                      ? isEn
                        ? `Sell All Resources (+${resourceSellValue} Gold)`
                        : `Tüm Kaynakları Sat (+${resourceSellValue} Altın)`
                      : isEn
                      ? 'Dock required to sell'
                      : 'Satış için Tüccar İskelesine yanaş'}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-300" />
                    <h3 className="font-display text-base font-semibold text-slate-100">
                      {isEn ? 'Ship Repair Kits' : 'Gemi Tamir Kiti'}
                    </h3>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-emerald-300">
                    {repairKits} {isEn ? 'In Stock' : 'Stokta'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEn
                    ? 'Instantly restores +75 Boat HP and +40 Captain HP anywhere at sea or on land.'
                    : 'Açık denizde veya karada tek tıkla gemine +75 Can ve kaptana +40 Can kazandırır.'}
                </p>

                <div className="flex flex-col gap-2">
                  {onCraftRepairKit && (
                    <button
                      type="button"
                      disabled={!canCraftWithRes && !canCraftWithGold}
                      onClick={onCraftRepairKit}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        canCraftWithRes || canCraftWithGold
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {canCraftWithRes
                        ? isEn
                          ? 'Craft Repair Kit (2 Wood + 1 Iron)'
                          : 'Tamir Kiti Üret (2 Odun + 1 Demir)'
                        : isEn
                        ? 'Buy Repair Kit (60 Gold)'
                        : 'Tamir Kiti Al (60 Altın)'}
                    </button>
                  )}

                  {onUseRepairKit && (
                    <button
                      type="button"
                      disabled={repairKits <= 0}
                      onClick={onUseRepairKit}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        repairKits > 0
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                          : 'bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isEn
                        ? `Use Repair Kit Now (+75 Boat / +40 HP)`
                        : `Tamir Kitini Şimdi Kullan (+75 Gemi / +40 Can)`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'PETS' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-sky-950/35 border border-sky-400/25 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Fish className="w-5 h-5 text-sky-300 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {isEn ? 'Deep Sea Fishing Log' : 'Balıkçılık & İnci Avı'}
                    </div>
                    <div className="text-xs text-slate-300">
                      {isEn
                        ? 'Press [G] near water or while stopped at sea to cast your line and reel in fish or rare Golden Pearls!'
                        : 'Kıyıda veya teknede dururken [G] tuşuyla olta at; balık ve nadir Altın İnci yakalayıp anında altın kazan!'}
                    </div>
                  </div>
                </div>
                <div className="font-mono-num text-sm font-bold text-sky-300">
                  {caughtFishCount} {isEn ? 'Caught' : 'Yakalandı'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PET_DEFS.map((pet) => {
                  const owned = ownedPets.includes(pet.id);
                  const active = activePet === pet.id;
                  const canAfford = gold >= pet.cost;
                  return (
                    <div
                      key={pet.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        active
                          ? 'bg-emerald-950/35 border-emerald-400/50'
                          : 'bg-slate-950/35 border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">
                            {isEn ? pet.nameEn : pet.name}
                          </span>
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: pet.color }}
                          />
                        </div>
                        <div className="text-xs font-semibold text-amber-300 mt-1">
                          {isEn ? pet.bonusLabelEn : pet.bonusLabel}
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          {isEn ? pet.descriptionEn : pet.description}
                        </p>
                      </div>

                      {owned ? (
                        <button
                          type="button"
                          onClick={() => onEquipPet?.(active ? null : pet.id)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                              : 'bg-white/10 text-slate-100 hover:bg-white/20'
                          }`}
                        >
                          {active
                            ? isEn
                              ? 'Active (Click to Rest)'
                              : 'Aktif (Dinlendir)'
                            : isEn
                            ? 'Set Active'
                            : 'Yanına Al'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onAdoptPet?.(pet.id)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-white/10 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isEn ? `Adopt (${pet.cost} Gold)` : `Sahiplen (${pet.cost} Altın)`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

