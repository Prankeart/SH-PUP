import React, { useRef, useState } from 'react';
import {
  Anchor,
  ArrowUpCircle,
  Coins,
  Crown,
  Flag,
  HeartPulse,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import { ArmyStance, EnemyFactionId, KingdomState, SoldierType } from '../types/game';
import { OnlineModeRule, RemotePlayerSnapshot } from '../types/online';
import {
  ENEMY_FACTION_LIST,
  getArmyUpgradeCost,
  getSoldierPowerMultiplier,
  KINGDOM_COSTS,
  MAX_ARMY_LEVEL,
  PLAYER_BANNER_OPTIONS,
  SOLDIER_SPECS,
} from '../engine/factions';
import { ModalTabItem, ResponsiveModalShell } from './ResponsiveModalShell';

type KingdomTab = 'ARMY' | 'DIPLOMACY';

interface KingdomModalProps {
  gold: number;
  kingdom: KingdomState;
  nationIslandCounts: Record<EnemyFactionId, number>;
  onlineMode?: boolean;
  onlineRule?: OnlineModeRule;
  onlineSelfId?: string;
  onlinePlayers?: RemotePlayerSnapshot[];
  onlineWarDeclarations?: Record<string, string[]>;
  armyStance?: ArmyStance;
  wood?: number;
  iron?: number;
  fortTurretIslandIds?: string[];
  ownedIslands?: Array<{ id: string; name: string }>;
  language?: 'tr' | 'en';
  onFoundKingdom: (name: string, bannerColor: string) => void;
  onRecruitSoldier: (type: SoldierType, count?: number) => void;
  onUpgradeArmy: () => void;
  onRecruitShip: (count?: number) => void;
  onHealArmy: () => void;
  onDeclareWar: (factionId: EnemyFactionId) => void;
  onDeclareOnlineWar?: (targetPlayerId: string, cancel?: boolean) => void;
  onSetArmyStance?: (stance: ArmyStance) => void;
  onBuildFortTurret?: (islandId: string) => void;
  onClose: () => void;
}

export const KingdomModal: React.FC<KingdomModalProps> = ({
  gold,
  kingdom,
  nationIslandCounts,
  onlineMode = false,
  onlineRule = 'PVP',
  onlineSelfId = '',
  onlinePlayers = [],
  onlineWarDeclarations = {},
  armyStance = 'CHARGE',
  wood = 0,
  iron = 0,
  fortTurretIslandIds = [],
  ownedIslands = [],
  language = 'tr',
  onFoundKingdom,
  onRecruitSoldier,
  onUpgradeArmy,
  onRecruitShip,
  onHealArmy,
  onDeclareWar,
  onDeclareOnlineWar,
  onSetArmyStance,
  onBuildFortTurret,
  onClose,
}) => {
  const isEn = language === 'en';
  const [tab, setTab] = useState<KingdomTab>('ARMY');
  const [draftName, setDraftName] = useState(kingdom.name || 'Turkuaz Cumhuriyeti');
  const [draftColor, setDraftColor] = useState(kingdom.bannerColor || '#10B981');
  const lastPurchaseClickRef = useRef<number>(0);

  const runGuardedPurchase = (fn: () => void) => {
    const now = performance.now();
    if (now - lastPurchaseClickRef.current < 120) return;
    lastPurchaseClickRef.current = now;
    fn();
  };

  const incomingWarNames =
    onlineMode && onlineRule === 'PVP' && onlineSelfId
      ? onlinePlayers
          .filter((rp) => rp.id !== onlineSelfId && onlineWarDeclarations[rp.id]?.includes(onlineSelfId))
          .map((rp) => rp.name)
      : [];

  const armyLevel = Math.max(1, kingdom.armyLevel || 1);
  const conqueredCount = kingdom.conqueredIslandIds.length;
  const armyUpgradeCost = getArmyUpgradeCost(armyLevel);
  const { hpMult, dmgMult } = getSoldierPowerMultiplier(armyLevel);

  const unitCounts: Record<SoldierType, number> = {
    SWORDSMAN: kingdom.soldiers.filter((s) => s.type === 'SWORDSMAN').length,
    MUSKETEER: kingdom.soldiers.filter((s) => s.type === 'MUSKETEER').length,
    HEAVY_GUARD: kingdom.soldiers.filter((s) => s.type === 'HEAVY_GUARD').length,
    GRENADIER: kingdom.soldiers.filter((s) => s.type === 'GRENADIER').length,
  };
  const hasInjuredSoldiers = kingdom.soldiers.some((s) => s.hp < s.maxHp);
  const tributeAmount = kingdom.founded ? 10 + conqueredCount * 15 : 0;

  const tabs: ModalTabItem[] | undefined = kingdom.founded
    ? [
        {
          id: 'ARMY',
          label: isEn ? 'Army & Fleet' : 'Ordu & Donanma',
          icon: <Users className="w-4 h-4" />,
          badge: kingdom.soldiers.length + kingdom.escortShipCount,
        },
        {
          id: 'DIPLOMACY',
          label: onlineMode
            ? isEn
              ? 'Diplomacy'
              : 'Kaptanlar'
            : isEn
            ? 'Nations & Forts'
            : 'Devletler & Kaleler',
          icon: <Swords className="w-4 h-4" />,
          badge: incomingWarNames.length > 0 ? incomingWarNames.length : undefined,
          alert: incomingWarNames.length > 0,
        },
      ]
    : undefined;

  const headerGold = (
    <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300 px-2.5 py-1 rounded-lg bg-[#061017] border border-white/[0.08]">
      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{gold.toLocaleString('tr-TR')}</span>
    </div>
  );

  const railSummary = kingdom.founded ? (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono-num">
        <span>{isEn ? 'Barracks' : 'Kışla'}</span>
        <span className="text-emerald-300 font-semibold">Sv. {armyLevel}</span>
      </div>
      <div className="flex items-center justify-between font-mono-num">
        <span>{isEn ? 'Islands' : 'Fetih'}</span>
        <span className="text-slate-100">{conqueredCount}</span>
      </div>
      <div className="flex items-center justify-between font-mono-num">
        <span>{isEn ? 'Tribute' : 'Vergi'}</span>
        <span className="text-amber-300">+{tributeAmount}/20s</span>
      </div>
    </div>
  ) : undefined;

  return (
    <ResponsiveModalShell
      onClose={onClose}
      title={kingdom.founded ? kingdom.name : isEn ? 'Found Kingdom & Army' : 'Devlet Kur & Ordu Yönetimi'}
      subtitle={
        kingdom.founded
          ? isEn
            ? `Barracks Lv.${armyLevel} · +${tributeAmount} Gold / 20s`
            : `Kışla Sv.${armyLevel} · +${tributeAmount} Altın / 20sn`
          : isEn
          ? 'Charter your sovereign fleet'
          : 'Egemen filonu ilan et'
      }
      icon={
        <Crown
          className="w-5 h-5"
          style={{ color: kingdom.founded ? kingdom.bannerColor : '#FBBF24' }}
        />
      }
      headerRight={headerGold}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => setTab(id as KingdomTab)}
      railFooter={railSummary}
      maxWidthClass="max-w-5xl"
    >
      {!kingdom.founded ? (
        <div className="py-2 flex flex-col justify-center items-center">
          <div className="w-full max-w-lg rounded-xl bg-[#0F212C]/70 border border-white/[0.08] p-5 sm:p-6 flex flex-col gap-5">
            {incomingWarNames.length > 0 && (
              <div className="px-3.5 py-2.5 rounded-lg bg-rose-500/12 border border-rose-400/35 text-xs text-rose-100 flex items-center gap-2">
                <Swords className="w-4 h-4 text-rose-300 shrink-0" />
                <span>
                  <strong>{incomingWarNames.join(', ')}</strong>{' '}
                  {isEn
                    ? 'declared war on you! Found your kingdom to retaliate.'
                    : 'sana savaş ilan etti! Devletini kurup karşılık verebilirsin.'}
                </span>
              </div>
            )}

            <div>
              <h3 className="font-display text-lg font-bold text-slate-50">
                {isEn ? 'Proclaim Your Sovereign State' : 'Kendi Devletini İlan Et'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                {isEn
                  ? 'Starter Harbor becomes your capital. Raise unlimited regiments and warships to conquer islands.'
                  : 'Başlangıç Limanı başkentin olur. Piyade, tüfekçi, ağır muhafız ve humbaracı topçularla sınırsız ordular kurup adaları fethet.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="kingdom-name-input"
                className="text-xs font-semibold text-slate-300"
              >
                {isEn ? 'Kingdom Name' : 'Devlet Adı'}
              </label>
              <input
                id="kingdom-name-input"
                type="text"
                maxLength={28}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Örn. Turkuaz Cumhuriyeti"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-[#061017] border border-white/12 text-[16px] sm:text-sm text-slate-50 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300">
                {isEn ? 'Banner Color' : 'Sancak Rengi'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLAYER_BANNER_OPTIONS.map((opt) => {
                  const active = draftColor === opt.color;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDraftColor(opt.color)}
                      className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-white/12 border-amber-400/60 text-slate-50'
                          : 'bg-[#08131B] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="truncate">{opt.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.08] pt-3">
              <span>{isEn ? 'Army & Fleet Cap: Unlimited' : 'Ordu & Donanma Kotası: Sınırsız'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? '4 Soldier Classes' : '4 Asker Sınıfı'}</span>
            </div>

            <button
              type="button"
              disabled={gold < KINGDOM_COSTS.FOUND_KINGDOM || !draftName.trim()}
              onClick={() => onFoundKingdom(draftName.trim(), draftColor)}
              className={`w-full min-h-[46px] py-3 px-4 rounded-lg font-display text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                gold >= KINGDOM_COSTS.FOUND_KINGDOM && draftName.trim()
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                  : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
              }`}
            >
              <Flag className="w-4 h-4" />
              <span>
                {isEn
                  ? `Found Kingdom (${KINGDOM_COSTS.FOUND_KINGDOM} Gold)`
                  : `Devleti Kur (${KINGDOM_COSTS.FOUND_KINGDOM} Altın)`}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Compact Kingdom Summary Strip */}
          <div className="px-4 py-2.5 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-50 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: kingdom.bannerColor }}
                />
                {isEn ? `Barracks Lv. ${armyLevel}` : `Kışla Sv. ${armyLevel}`}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono-num">
                {isEn ? 'Conquered:' : 'Fethedilen Ada:'}{' '}
                <strong className="text-emerald-300">{conqueredCount}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono-num">
                {isEn ? 'Tax:' : 'Vergi:'}{' '}
                <strong className="text-amber-300">+{tributeAmount} / 20sn</strong>
              </span>
            </div>
            <div className="font-mono-num text-slate-300">
              {isEn ? 'Army:' : 'Ordu:'}{' '}
              <strong className="text-emerald-300">{kingdom.soldiers.length}</strong> ·{' '}
              {isEn ? 'Fleet:' : 'Donanma:'}{' '}
              <strong className="text-sky-300">{kingdom.escortShipCount}</strong>
            </div>
          </div>

          {tab === 'ARMY' && (
            <div className="flex flex-col gap-3.5">
              {/* Top Command Controls: Heal + Stance + Barracks Upgrade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0F212C]/65 border border-emerald-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>{isEn ? 'Barracks Training' : 'Kışla & Ordu Eğitimi'}</span>
                      <span className="font-mono-num text-xs text-emerald-300">
                        Sv. {armyLevel}/{MAX_ARMY_LEVEL}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {armyLevel >= MAX_ARMY_LEVEL
                        ? isEn
                          ? 'Maximum combat training reached.'
                          : 'Tüm birlikler maksimum eğitim seviyesinde.'
                        : isEn
                        ? '+12% Soldier HP and +10% Damage.'
                        : '+%12 Asker Canı ve +%10 Asker Hasarı.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={armyLevel >= MAX_ARMY_LEVEL || gold < armyUpgradeCost}
                    onClick={() => runGuardedPurchase(onUpgradeArmy)}
                    className={`min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-bold font-mono-num shrink-0 transition-colors whitespace-nowrap ${
                      armyLevel < MAX_ARMY_LEVEL && gold >= armyUpgradeCost
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                        : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {armyLevel >= MAX_ARMY_LEVEL
                      ? isEn
                        ? 'Max'
                        : 'Maksimum'
                      : `${isEn ? 'Upgrade' : 'Yükselt'} (${armyUpgradeCost})`}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5">
                  {!onlineMode && onSetArmyStance && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">
                        {isEn ? 'Stance [V]' : 'Düzen [V]'}
                      </span>
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#061017] border border-white/[0.08]">
                        {(
                          [
                            { id: 'CHARGE', label: isEn ? 'Charge' : 'Saldır' },
                            { id: 'FOLLOW', label: isEn ? 'Follow' : 'Takip Et' },
                            { id: 'DEFEND', label: isEn ? 'Hold Fort' : 'Kaleyi Savun' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSetArmyStance(opt.id)}
                            className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              armyStance === opt.id
                                ? 'bg-amber-400 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {kingdom.soldiers.length > 0 && (
                    <button
                      type="button"
                      disabled={!hasInjuredSoldiers || gold < KINGDOM_COSTS.HEAL_ARMY}
                      onClick={() => runGuardedPurchase(onHealArmy)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ml-auto ${
                        hasInjuredSoldiers && gold >= KINGDOM_COSTS.HEAL_ARMY
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>
                        {isEn
                          ? `Heal Army (${KINGDOM_COSTS.HEAL_ARMY})`
                          : `Orduyu İyileştir (${KINGDOM_COSTS.HEAL_ARMY})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Unified Regiment & Fleet Recruitment List */}
              <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
                {(['SWORDSMAN', 'MUSKETEER', 'HEAVY_GUARD', 'GRENADIER'] as SoldierType[]).map(
                  (type) => {
                    const spec = SOLDIER_SPECS[type];
                    const scaledHp = Math.round(spec.maxHp * hpMult);
                    const scaledDmg = Math.round(spec.damage * dmgMult);
                    const activeCount = unitCounts[type];

                    return (
                      <div
                        key={type}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                            <span>{spec.name}</span>
                            <span className="font-mono-num text-xs text-emerald-300">
                              {activeCount} {isEn ? 'active' : 'aktif'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{spec.description}</p>
                          <div className="text-[11px] text-sky-300 mt-1 font-mono-num">
                            {scaledHp} Can · {scaledDmg} Hasar
                            {type === 'GRENADIER' ? ' · Alan Patlaması' : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {[1, 5, 10].map((qty) => {
                            const cost = spec.cost * qty;
                            const canBuy = gold >= cost;
                            return (
                              <button
                                key={qty}
                                type="button"
                                disabled={!canBuy}
                                onClick={() => runGuardedPurchase(() => onRecruitSoldier(type, qty))}
                                title={`${qty} ${spec.name} al (${cost} Altın)`}
                                className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                                  canBuy
                                    ? qty === 1
                                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                      : 'bg-amber-400/85 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                    : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                +{qty} ({cost})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}

                <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-sky-300 shrink-0" />
                      <span>{isEn ? 'Escort Warship' : 'Refakatçi Savaş Gemisi'}</span>
                      <span className="font-mono-num text-xs text-sky-300">
                        {kingdom.escortShipCount} {isEn ? 'active' : 'aktif'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isEn
                        ? 'Sails alongside your flagship and fires broadsides at hostile vessels.'
                        : 'Denizde filonuza eşlik eder ve düşman devlet gemilerine borda topu ateşler.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[1, 3].map((qty) => {
                      const cost = KINGDOM_COSTS.ESCORT_SHIP * qty;
                      const canBuy = gold >= cost;
                      return (
                        <button
                          key={qty}
                          type="button"
                          disabled={!canBuy}
                          onClick={() => runGuardedPurchase(() => onRecruitShip(qty))}
                          className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                            canBuy
                              ? qty === 1
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                : 'bg-amber-400/85 hover:bg-amber-300 text-slate-950 cursor-pointer'
                              : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          +{qty} ({cost})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'DIPLOMACY' && (
            <div className="flex flex-col gap-4">
              {onlineMode ? (
                <div className="flex flex-col gap-3">
                  {onlinePlayers.filter((rp) => rp.id !== onlineSelfId).length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] text-xs text-slate-400">
                      {isEn
                        ? 'No other captains in this room yet. Share your room code to invite allies or rivals.'
                        : 'Odada henüz başka kaptan yok. Oda kodunu paylaşarak arkadaşlarını davet edebilirsin.'}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
                      {onlinePlayers
                        .filter((rp) => rp.id !== onlineSelfId)
                        .map((rp) => {
                          const myDecl = Boolean(
                            onlineSelfId && onlineWarDeclarations[onlineSelfId]?.includes(rp.id)
                          );
                          const theirDecl = Boolean(
                            onlineSelfId && onlineWarDeclarations[rp.id]?.includes(onlineSelfId)
                          );
                          const isAtWar = onlineRule === 'PVP' && myDecl && theirDecl;
                          const isIncoming = onlineRule === 'PVP' && !myDecl && theirDecl;
                          const isPending = onlineRule === 'PVP' && myDecl && !theirDecl;

                          return (
                            <div
                              key={rp.id}
                              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isAtWar
                                  ? 'bg-rose-500/[0.06]'
                                  : isIncoming
                                  ? 'bg-amber-500/[0.06]'
                                  : ''
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: rp.bannerColor }}
                                  />
                                  <span className="truncate">
                                    {rp.kingdomFounded ? rp.kingdomName : rp.name}
                                  </span>
                                  <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                                    {rp.conqueredCount} {isEn ? 'Isl' : 'Ada'}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold shrink-0 ${
                                      rp.connected ? 'text-emerald-300' : 'text-slate-500'
                                    }`}
                                  >
                                    · {rp.connected ? (isEn ? 'Online' : 'Aktif') : isEn ? 'Offline' : 'Çevrimdışı'}
                                  </span>
                                </div>
                                <div className="text-[11px] mt-1 font-medium text-slate-400 flex items-center gap-1.5">
                                  <Shield className="w-3 h-3 shrink-0" style={{ color: rp.bannerColor }} />
                                  <span>
                                    {isEn ? 'Captain' : 'Kaptan'}: {rp.name} ·{' '}
                                    {onlineRule === 'COOP' ? (
                                      <strong className="text-emerald-300">
                                        {isEn ? 'Co-op Ally' : 'Co-op Müttefik'}
                                      </strong>
                                    ) : isAtWar ? (
                                      <strong className="text-rose-300">
                                        {isEn ? 'At War' : 'Savaş Halinde'}
                                      </strong>
                                    ) : isIncoming ? (
                                      <strong className="text-amber-300">
                                        {isEn ? 'Challenged You!' : 'Sana Savaş Açtı!'}
                                      </strong>
                                    ) : isPending ? (
                                      <strong className="text-amber-200">
                                        {isEn ? 'Awaiting Response' : 'Onayı Bekleniyor'}
                                      </strong>
                                    ) : (
                                      <strong className="text-slate-200">
                                        {isEn ? 'At Peace' : 'Barış Halinde'}
                                      </strong>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {onlineRule === 'PVP' && onDeclareOnlineWar && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isAtWar ? (
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-400/35 whitespace-nowrap">
                                      {isEn ? 'At War' : 'Savaşta'}
                                    </span>
                                  ) : isIncoming ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, false)}
                                      className="min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      {isEn ? 'Accept War' : 'Savaş Aç (Kabul Et)'}
                                    </button>
                                  ) : isPending ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, true)}
                                      className="min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 border border-amber-400/35 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      {isEn ? 'Cancel' : 'İlanı İptal Et'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, false)}
                                      className="min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      {isEn ? 'Declare War' : 'Savaş Aç'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="px-3.5 py-2.5 rounded-lg bg-[#08131B] border border-white/[0.06] text-xs text-slate-400 leading-relaxed">
                    {onlineRule === 'PVP'
                      ? isEn
                        ? 'PvP Mutual Rule: Fleets are visible, and mutual war declarations are required before weapons engage.'
                        : 'PvP Savaş Kuralı: Ordular ve gemiler görünür ancak saldırmadan önce iki oyuncunun da birbirine "Savaş Aç" demesi gerekir.'
                      : isEn
                      ? 'Co-op Team active: Friendly fire is disabled. Explore and conquer uncharted islands together.'
                      : 'Co-op Takım aktif: Dost ateşi kapalıdır. Tarafsız adaları birlikte keşfedebilirsiniz.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
                    {ENEMY_FACTION_LIST.map((faction) => {
                      const atWar = kingdom.atWarWith.includes(faction.id);
                      const heldIslands = nationIslandCounts[faction.id] ?? 0;
                      return (
                        <div
                          key={faction.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: faction.color }}
                              />
                              <span className="truncate">{faction.name}</span>
                              <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                                {heldIslands} {isEn ? 'Islands' : 'Ada'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{faction.description}</p>
                            <div className="text-[11px] mt-1 font-medium text-slate-400 flex items-center gap-1.5">
                              <Shield className="w-3 h-3 shrink-0" style={{ color: faction.color }} />
                              <span>
                                {isEn ? 'Status:' : 'Durum:'}{' '}
                                <strong className={atWar ? 'text-rose-300' : 'text-slate-200'}>
                                  {atWar
                                    ? isEn
                                      ? 'At War'
                                      : 'Savaş Halinde'
                                    : isEn
                                    ? 'Neutral'
                                    : 'Tarafsız'}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={atWar}
                            onClick={() => onDeclareWar(faction.id)}
                            className={`min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors whitespace-nowrap ${
                              atWar
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-400/30 cursor-default'
                                : 'bg-rose-500 hover:bg-rose-400 text-slate-950 cursor-pointer'
                            }`}
                          >
                            {atWar ? (isEn ? 'At War' : 'Savaşta') : isEn ? 'Declare War' : 'Savaş Aç'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fort Defense Turrets */}
                  {onBuildFortTurret && ownedIslands.length > 0 && (
                    <div className="rounded-xl bg-[#0F212C]/65 border border-white/[0.08] overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-sky-200">
                          {isEn ? 'Fort Defense Turrets' : 'Kale Savunma Kuleleri'}
                        </span>
                        <span className="font-mono-num text-slate-400">
                          80 Altın · 2 Odun · 1 Demir
                        </span>
                      </div>
                      <div className="divide-y divide-white/[0.06] max-h-48 overflow-y-auto">
                        {ownedIslands.map((isl) => {
                          const built = fortTurretIslandIds.includes(isl.id);
                          const canBuild = gold >= 80 && wood >= 2 && iron >= 1;
                          return (
                            <div
                              key={isl.id}
                              className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                            >
                              <span className="text-slate-200 truncate">{isl.name}</span>
                              {built ? (
                                <span className="text-emerald-300 font-semibold shrink-0">
                                  {isEn ? 'Turret Active' : 'Kule Aktif'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canBuild}
                                  onClick={() => onBuildFortTurret(isl.id)}
                                  className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 whitespace-nowrap ${
                                    canBuild
                                      ? 'bg-sky-400 hover:bg-sky-300 text-slate-950 cursor-pointer'
                                      : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {isEn ? 'Build Turret' : 'Kule İnşa Et'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </ResponsiveModalShell>
  );
};
