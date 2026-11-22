import React, { useState } from 'react';
import {
  Backpack,
  Bird,
  Check,
  Coins,
  Compass,
  Crosshair,
  Fish,
  Gem,
  Hammer,
  HeartPulse,
  Lock,
  Pickaxe,
  Shield,
  Ship,
  Store,
  Swords,
  Trees,
  Users,
  Wrench,
} from 'lucide-react';
import { BagItem, PetId, Upgrades, WeaponId } from '../types/game';
import { getUpgradeCost, UPGRADE_DEFS, UpgradeKey } from '../engine/upgrades';
import { PET_DEFS } from '../engine/progression';
import { MAX_CARRIED_WEAPONS, WEAPON_LIST, WEAPONS } from '../engine/weapons';
import { WeaponSilhouette } from './WeaponHudPanel';
import { ModalTabItem, ResponsiveModalShell } from './ResponsiveModalShell';

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
  shovelLevel: <Pickaxe className="w-4 h-4 text-amber-300" />,
  boatLevel: <Ship className="w-4 h-4 text-sky-300" />,
  cannonLevel: <Crosshair className="w-4 h-4 text-rose-400" />,
  radarLevel: <Compass className="w-4 h-4 text-emerald-300" />,
  luckLevel: <Gem className="w-4 h-4 text-amber-300" />,
  hullPlatingLevel: <Shield className="w-4 h-4 text-cyan-300" />,
  crewSkillLevel: <Users className="w-4 h-4 text-indigo-300" />,
  repairShellsLevel: <HeartPulse className="w-4 h-4 text-emerald-400" />,
};

const RARITY_LABELS: Record<BagItem['rarity'], { tr: string; en: string }> = {
  COMMON: { tr: 'Sıradan', en: 'Common' },
  RARE: { tr: 'Nadir', en: 'Rare' },
  EPIC: { tr: 'Destansı', en: 'Epic' },
  LEGENDARY: { tr: 'Efsanevi', en: 'Legendary' },
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

  const tabs: ModalTabItem[] = [
    {
      id: 'TRADE',
      label: isEn ? 'Trade' : 'Tüccar',
      icon: <Store className="w-4 h-4" />,
      badge: bag.length > 0 ? bag.length : undefined,
      alert: bag.length > 0 && nearDock,
    },
    {
      id: 'ARSENAL',
      label: isEn ? 'Arsenal' : 'Cephanelik',
      icon: <Swords className="w-4 h-4" />,
      badge: `${weaponSlots.length}/${MAX_CARRIED_WEAPONS}`,
    },
    {
      id: 'WORKSHOP',
      label: isEn ? 'Workshop' : 'Atölye',
      icon: <Hammer className="w-4 h-4" />,
      badge: repairKits > 0 ? repairKits : undefined,
    },
    {
      id: 'PETS',
      label: isEn ? 'Pets & Sea' : 'Evcil & Balık',
      icon: <Bird className="w-4 h-4" />,
    },
  ];

  const headerGold = (
    <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300 px-2.5 py-1 rounded-lg bg-[#061017] border border-white/[0.08]">
      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{gold.toLocaleString('tr-TR')}</span>
    </div>
  );

  const railSummary = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span>{isEn ? 'Dock Status' : 'İskele'}</span>
        <span className={nearDock ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
          {nearDock ? (isEn ? 'Docked' : 'Bağlı') : isEn ? 'At Sea' : 'Açıkta'}
        </span>
      </div>
      <div className="flex items-center justify-between font-mono-num">
        <span>{isEn ? 'Bag Loot' : 'Çanta'}</span>
        <span className="text-slate-200">{bag.length}</span>
      </div>
    </div>
  );

  return (
    <ResponsiveModalShell
      onClose={onClose}
      title={isEn ? 'Harbor Merchant' : 'Liman Tüccarı'}
      subtitle={isEn ? 'Trade & Outfitting' : 'Ticaret ve Donatım'}
      icon={<Store className="w-5 h-5" />}
      headerRight={headerGold}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => setTab(id as ShopTab)}
      railFooter={railSummary}
      maxWidthClass="max-w-5xl"
    >
      {!nearDock && tab === 'TRADE' && (
        <div className="px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-400/25 text-xs text-amber-200 leading-relaxed">
          {isEn
            ? 'Approach a gold Trader Dock on the map to sell treasures or purchase equipment upgrades.'
            : "Satış ve ekipman yükseltmesi için haritada altın işaretle gösterilen Tüccar İskelesi'ne yanaşın."}
        </div>
      )}

      {tab === 'TRADE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Treasure Bag */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Backpack className="w-4 h-4 text-emerald-300 shrink-0" />
                <h3 className="font-display text-sm font-bold text-slate-100 tracking-wide">
                  {isEn ? `Treasure Bag (${bag.length})` : `Hazine Çantası (${bag.length})`}
                </h3>
              </div>
              {bag.length > 0 && (
                <button
                  type="button"
                  onClick={onSellAll}
                  disabled={!nearDock}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap shrink-0 ${
                    nearDock
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                      : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isEn ? `Sell All (+${totalBagValue})` : `Tümünü Sat (+${totalBagValue})`}
                </button>
              )}
            </div>

            {bag.length === 0 ? (
              <div className="py-10 px-4 rounded-xl border border-white/[0.08] bg-[#0F212C]/50 text-center text-xs text-slate-400">
                {isEn
                  ? 'Your bag is empty. Dig on islands to uncover treasure chests.'
                  : 'Çantanız şu an boş. Adalarda kazı yaparak hazine sandıkları bulun.'}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06] max-h-80 overflow-y-auto">
                {bag.map((item) => (
                  <div
                    key={item.uid}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span style={{ color: item.color }}>
                          {isEn ? RARITY_LABELS[item.rarity].en : RARITY_LABELS[item.rarity].tr}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.islandName}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSellItem(item.uid)}
                      disabled={!nearDock}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold shrink-0 whitespace-nowrap transition-colors ${
                        nearDock
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      +{item.value} {isEn ? 'G' : 'Altın'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Equipment & Ship Upgrades */}
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-bold text-slate-100 tracking-wide">
              {isEn ? 'Equipment & Ship Upgrades' : 'Ekipman & Gemi Geliştirmeleri'}
            </h3>
            <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
              {UPGRADE_DEFS.map((def) => {
                const level = upgrades[def.key] ?? 1;
                const isMax = level >= def.maxLevel;
                const cost = getUpgradeCost(def, level);
                const canAfford = gold >= cost;

                return (
                  <div
                    key={def.key}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#08131B] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
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
                      className={`min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-bold font-mono-num shrink-0 transition-colors whitespace-nowrap ${
                        isMax
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 cursor-default'
                          : nearDock && canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isMax ? (isEn ? 'Max' : 'Maksimum') : `${cost} ${isEn ? 'Gold' : 'Altın'}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'ARSENAL' && (
        <div className="flex flex-col gap-4">
          {/* Active 2-Slot Carried Loadout */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
                  {isEn
                    ? `Active Loadout (${weaponSlots.length}/${MAX_CARRIED_WEAPONS})`
                    : `Taşınan Silahlar (${weaponSlots.length}/${MAX_CARRIED_WEAPONS})`}
                </span>
              </div>
              {carriedFull && (
                <span className="text-[11px] font-medium text-amber-300 whitespace-nowrap">
                  {isEn
                    ? `Replacing Slot ${targetReplaceSlot + 1}`
                    : `Değişim hedefi: Slot ${targetReplaceSlot + 1}`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
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
                    className={`min-h-[68px] p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-400/50'
                        : isReplaceTarget
                        ? 'bg-amber-400/10 border-amber-400/45'
                        : 'bg-[#0F212C]/70 border-white/[0.08] hover:border-white/20'
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
                      <div className="flex items-center gap-2.5 min-w-0 w-full">
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
          <div className="grid grid-cols-4 sm:inline-flex sm:self-start gap-1 p-1 rounded-lg bg-[#061017] border border-white/[0.08]">
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
                className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  arsenalFilter === cat.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Weapon Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                    equipped
                      ? 'bg-emerald-500/[0.08] border-emerald-400/45'
                      : carried
                      ? 'bg-sky-500/[0.06] border-sky-400/35'
                      : 'bg-[#0F212C]/65 border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-11 rounded-lg bg-[#08131B] border border-white/[0.08] flex items-center justify-center shrink-0 px-1.5">
                      <WeaponSilhouette
                        weaponId={w.id}
                        className="w-full h-6"
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

                  {/* Clean Hairline 3-Stat Row */}
                  <div className="grid grid-cols-3 text-center py-1.5 border-y border-white/[0.06] divide-x divide-white/[0.08]">
                    <div>
                      <div className="text-[10px] text-slate-400">
                        {isEn ? 'Damage' : 'Hasar'}
                      </div>
                      <div className="text-xs font-mono-num font-bold text-slate-100">
                        {damageText}
                      </div>
                    </div>
                    <div>
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
                    <div className="text-[11px] font-medium text-emerald-300/90 -mt-1">
                      {specialPerk}
                    </div>
                  )}

                  {unlocked ? (
                    <button
                      type="button"
                      disabled={equipped}
                      onClick={() => onEquipWeapon?.(w.id, carried ? undefined : effectiveReplaceSlot)}
                      className={`w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        equipped
                          ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-200 cursor-default'
                          : carried
                          ? 'bg-sky-400 hover:bg-sky-300 text-slate-950 cursor-pointer'
                          : 'bg-white/10 hover:bg-white/15 text-slate-100 cursor-pointer'
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
                      className={`w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        canBuy
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>
                        {isEn ? `Buy · ${w.shopCost} Gold` : `Satın Al · ${w.shopCost} Altın`}
                      </span>
                    </button>
                  ) : (
                    <div className="w-full min-h-[40px] py-2 px-3 rounded-lg bg-[#08131B] border border-white/[0.08] text-xs text-slate-400 flex items-center justify-center gap-1.5">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          <div className="p-4 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Trees className="w-4 h-4 text-emerald-300 shrink-0" />
              <h3 className="font-display text-sm font-bold text-slate-100">
                {isEn ? 'Island Resources' : 'Ada Kaynakları'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isEn
                ? 'Harvest timber piles and iron ore veins on islands using Dig or Weapon Attack. Sell them for gold or craft Repair Kits and Fort Turrets.'
                : 'Adalardaki kütük yığınlarını ve demir damarlarını Kazı veya Silah saldırısıyla topla. Altına çevir ya da Tamir Kiti ve Kale Kulesi üret.'}
            </p>

            <div className="grid grid-cols-2 py-2.5 border-y border-white/[0.08] divide-x divide-white/[0.08]">
              <div className="pr-3">
                <div className="text-xs text-amber-200 font-medium">
                  {isEn ? 'Timber (Wood)' : 'Kereste (Odun)'}
                </div>
                <div className="text-2xl font-mono-num font-bold text-slate-50 mt-0.5">{wood}</div>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  12 {isEn ? 'Gold / ea' : 'Altın / adet'}
                </div>
              </div>
              <div className="pl-3">
                <div className="text-xs text-sky-200 font-medium">
                  {isEn ? 'Iron Ore' : 'Demir Cevheri'}
                </div>
                <div className="text-2xl font-mono-num font-bold text-slate-50 mt-0.5">{iron}</div>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  18 {isEn ? 'Gold / ea' : 'Altın / adet'}
                </div>
              </div>
            </div>

            {onSellResources && (
              <button
                type="button"
                disabled={!nearDock || resourceSellValue <= 0}
                onClick={onSellResources}
                className={`w-full min-h-[42px] py-2.5 px-4 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  nearDock && resourceSellValue > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                    : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
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

          <div className="p-4 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
                <h3 className="font-display text-sm font-bold text-slate-100">
                  {isEn ? 'Ship Repair Kits' : 'Gemi Tamir Kiti'}
                </h3>
              </div>
              <span className="font-mono-num text-xs font-bold text-emerald-300">
                {repairKits} {isEn ? 'In Stock' : 'Stokta'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isEn
                ? 'Instantly restores +75 Boat HP and +40 Captain HP anywhere at sea or on land.'
                : 'Açık denizde veya karada tek dokunuşla gemine +75 Can ve kaptana +40 Can kazandırır.'}
            </p>

            <div className="flex flex-col gap-2 pt-1">
              {onCraftRepairKit && (
                <button
                  type="button"
                  disabled={!canCraftWithRes && !canCraftWithGold}
                  onClick={onCraftRepairKit}
                  className={`w-full min-h-[42px] py-2.5 px-4 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    canCraftWithRes || canCraftWithGold
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                      : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
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
                  className={`w-full min-h-[42px] py-2.5 px-4 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    repairKits > 0
                      ? 'bg-sky-400 hover:bg-sky-300 text-slate-950 cursor-pointer'
                      : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isEn
                    ? 'Use Repair Kit Now (+75 Boat / +40 HP)'
                    : 'Tamir Kitini Şimdi Kullan (+75 Gemi / +40 Can)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'PETS' && (
        <div className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Fish className="w-5 h-5 text-sky-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Deep Sea Fishing Log' : 'Balıkçılık & İnci Avı'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn
                    ? 'Press [G] near water or while stopped at sea to cast your line and reel in fish or rare Golden Pearls.'
                    : 'Kıyıda veya teknede dururken [G] tuşuyla olta at; balık ve Altın İnci yakalayıp anında altın kazan.'}
                </div>
              </div>
            </div>
            <div className="font-mono-num text-sm font-bold text-sky-300 shrink-0">
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
                      ? 'bg-emerald-500/[0.08] border-emerald-400/45'
                      : 'bg-[#0F212C]/65 border-white/[0.08]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-100">
                        {isEn ? pet.nameEn : pet.name}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
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
                      className={`w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : 'bg-white/10 text-slate-100 hover:bg-white/15'
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
                      className={`w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                        canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
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
    </ResponsiveModalShell>
  );
};
