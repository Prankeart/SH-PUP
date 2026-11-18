import React, { useState } from 'react';
import {
  Backpack,
  Bird,
  Coins,
  Compass,
  Crosshair,
  Fish,
  Hammer,
  HeartPulse,
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
import { WEAPON_LIST } from '../engine/weapons';

type ShopTab = 'TRADE' | 'ARSENAL' | 'WORKSHOP' | 'PETS';

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
  language?: 'tr' | 'en';
  onlineMode?: boolean;
  onSellAll: () => void;
  onSellItem: (uid: string) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onEquipWeapon?: (weaponId: WeaponId) => void;
  onBuyWeapon?: (weaponId: WeaponId) => void;
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
  const isEn = language === 'en';
  const totalBagValue = bag.reduce((sum, item) => sum + item.value, 0);
  const resourceSellValue = wood * 12 + iron * 18;
  const canCraftWithRes = wood >= 2 && iron >= 1;
  const canCraftWithGold = gold >= 60;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Harbor Merchant & Upgrades' : 'Liman Tüccarı ve Geliştirmeler'}
    >
      <div className="w-full max-w-4xl max-h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {isEn ? 'Harbor Merchant' : 'Liman Tüccarı'}
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
              aria-label={isEn ? 'Close Shop' : 'Dükkanı Kapat'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-2 border-b border-white/10 flex flex-wrap items-center gap-1.5 bg-slate-950/25 shrink-0">
          <button
            type="button"
            onClick={() => setTab('TRADE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'TRADE'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>{isEn ? 'Trade & Upgrades' : 'Tüccar & Yükseltme'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ARSENAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'ARSENAL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>{isEn ? 'Weapons & Arsenal' : 'Silahlar & Cephanelik'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('WORKSHOP')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'WORKSHOP'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>{isEn ? 'Workshop & Resources' : 'Atölye & Kaynaklar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('PETS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'PETS'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Bird className="w-3.5 h-3.5" />
            <span>{isEn ? 'Pets & Fishing' : 'Evcil Hayvan & Balık'}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WEAPON_LIST.map((w) => {
                const unlocked = unlockedWeapons.includes(w.id);
                const equipped = equippedWeapon === w.id;
                const canBuy = Boolean(w.shopCost && gold >= w.shopCost);
                return (
                  <div
                    key={w.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                      equipped
                        ? 'bg-emerald-950/35 border-emerald-400/55'
                        : 'bg-slate-950/35 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: w.color }}
                          />
                          <span className="text-sm font-bold text-slate-100 truncate">
                            {isEn ? w.nameEn : w.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono-num text-amber-300 shrink-0">
                          {isEn ? `Tier ${w.tier}` : `Sv.${w.tier}`} · {w.kind === 'MELEE' ? (isEn ? 'Melee' : 'Yakın') : (isEn ? 'Ranged' : 'Menzilli')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {isEn ? w.descriptionEn : w.description}
                      </p>
                      <div className="text-[11px] text-sky-300 font-mono-num mt-1.5">
                        {isEn ? 'Dmg' : 'Hasar'}: {w.damage}
                        {w.pellets > 1 ? `×${w.pellets}` : ''} · {isEn ? 'Range' : 'Menzil'}: {w.range}
                        {w.splashRadius ? (isEn ? ' · AoE Blast' : ' · Alan Patlaması') : ''}
                        {w.lifesteal ? ` · +${w.lifesteal} HP` : ''}
                      </div>
                    </div>

                    {unlocked ? (
                      <button
                        type="button"
                        disabled={equipped}
                        onClick={() => onEquipWeapon?.(w.id)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          equipped
                            ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 cursor-default'
                            : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                        }`}
                      >
                        {equipped
                          ? isEn
                            ? 'Equipped'
                            : 'Kuşanıldı'
                          : isEn
                          ? 'Equip Weapon'
                          : 'Kuşan'}
                      </button>
                    ) : w.shopCost ? (
                      <button
                        type="button"
                        disabled={!canBuy}
                        onClick={() => onBuyWeapon?.(w.id)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors ${
                          canBuy
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                            : 'bg-white/10 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isEn ? `Buy (${w.shopCost} Gold)` : `Satın Al (${w.shopCost} Altın)`}
                      </button>
                    ) : (
                      <div className="w-full py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-400 text-center">
                        {w.id === 'ANCIENT_HARPOON'
                          ? isEn
                            ? 'Reward: Win Battle Arena'
                            : 'Ödül: Savaş Arenasını Kazan'
                          : isEn
                          ? 'Found in Cave Altars / Islands'
                          : 'Mağara Sunaklarından / Adalardan Bulunur'}
                      </div>
                    )}
                  </div>
                );
              })}
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

