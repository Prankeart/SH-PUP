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
  X,
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center pt-[max(0.625rem,env(safe-area-inset-top))] pb-[max(0.625rem,env(safe-area-inset-bottom))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:p-6 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label="Devlet ve Ordu Yönetimi"
    >
      <div className="w-full max-w-5xl max-h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Crown
              className="w-5 h-5 shrink-0"
              style={{ color: kingdom.founded ? kingdom.bannerColor : '#FBBF24' }}
            />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {kingdom.founded ? kingdom.name : 'Devlet Kur & Ordu Yönetimi'}
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
              aria-label="Devlet Panelini Kapat"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!kingdom.founded ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col justify-center items-center">
            <div className="w-full max-w-lg rounded-2xl bg-slate-950/35 border border-white/10 p-6 flex flex-col gap-5">
              {incomingWarNames.length > 0 && (
                <div className="px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-400/45 text-xs text-red-100 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-300 shrink-0" />
                  <span>
                    <strong>{incomingWarNames.join(', ')}</strong> sana savaş ilan etti! Devletini kurup karşılık verebilirsin.
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-display text-xl font-bold text-slate-50">
                  Kendi Devletini İlan Et
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Başlangıç Limanı başkentin olur. Piyade, tüfekçi, ağır muhafız ve humbaracı topçularla sınırsız ordular kurup donanmanla adaları fethedebilirsin.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="kingdom-name-input"
                  className="text-xs font-semibold text-slate-200"
                >
                  Devlet Adı
                </label>
                <input
                  id="kingdom-name-input"
                  type="text"
                  maxLength={28}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Örn. Turkuaz Cumhuriyeti"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-slate-50 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-200">Sancak Rengi</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLAYER_BANNER_OPTIONS.map((opt) => {
                    const active = draftColor === opt.color;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftColor(opt.color)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-white/15 border-white/50 text-slate-50'
                            : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span className="truncate">{opt.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3">
                <span>Ordu &amp; Donanma Kotası: Sınırsız</span>
                <span aria-hidden="true">·</span>
                <span>4 Asker Sınıfı</span>
              </div>

              <button
                type="button"
                disabled={gold < KINGDOM_COSTS.FOUND_KINGDOM || !draftName.trim()}
                onClick={() => onFoundKingdom(draftName.trim(), draftColor)}
                className={`w-full py-3 px-4 rounded-xl font-display text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  gold >= KINGDOM_COSTS.FOUND_KINGDOM && draftName.trim()
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>Devleti Kur ({KINGDOM_COSTS.FOUND_KINGDOM} Altın)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 flex flex-col gap-4 sm:gap-5">
            {/* Summary Strip */}
            <div className="px-4 py-3 rounded-xl bg-slate-950/35 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-slate-50 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: kingdom.bannerColor }}
                  />
                  Kışla Sv. {armyLevel}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  Fethedilen Ada: <strong className="text-emerald-300">{conqueredCount}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  Vergi: <strong className="text-amber-300">+{tributeAmount} Altın / 20sn</strong>
                </span>
              </div>
              <div className="font-mono-num text-slate-300">
                Ordu: <strong className="text-emerald-300">{kingdom.soldiers.length}</strong> (Sınırsız) · Donanma: <strong className="text-sky-300">{kingdom.escortShipCount}</strong> (Sınırsız)
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Army & Navy Recruitment */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-300" />
                    <h3 className="font-display text-base font-semibold text-slate-100">
                      Ordu &amp; Kışla Yönetimi
                    </h3>
                  </div>
                  {kingdom.soldiers.length > 0 && (
                    <button
                      type="button"
                      disabled={!hasInjuredSoldiers || gold < KINGDOM_COSTS.HEAL_ARMY}
                      onClick={() => runGuardedPurchase(onHealArmy)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        hasInjuredSoldiers && gold >= KINGDOM_COSTS.HEAL_ARMY
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Orduyu İyileştir ({KINGDOM_COSTS.HEAL_ARMY})</span>
                    </button>
                  )}
                </div>

                {/* Army Stance Selector (Offline) */}
                {!onlineMode && onSetArmyStance && (
                  <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {isEn ? 'Army Stance [V]' : 'Ordu Düzeni [V]'}
                    </span>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/70 border border-white/10">
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
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            armyStance === opt.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Barracks / Army Training Upgrade */}
                <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>Kışla &amp; Ordu Eğitimi</span>
                      <span className="font-mono-num text-xs text-emerald-300">
                        Sv. {armyLevel}/{MAX_ARMY_LEVEL}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {armyLevel >= MAX_ARMY_LEVEL
                        ? 'Tüm birlikler maksimum eğitim ve güç seviyesine ulaştı.'
                        : '+%12 Asker Canı ve +%10 Asker Hasarı sağlar (Sınırsız Ordu).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={armyLevel >= MAX_ARMY_LEVEL || gold < armyUpgradeCost}
                    onClick={() => runGuardedPurchase(onUpgradeArmy)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono-num shrink-0 transition-colors whitespace-nowrap ${
                      armyLevel < MAX_ARMY_LEVEL && gold >= armyUpgradeCost
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                        : 'bg-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {armyLevel >= MAX_ARMY_LEVEL ? 'Maksimum' : `Yükselt (${armyUpgradeCost})`}
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {(['SWORDSMAN', 'MUSKETEER', 'HEAVY_GUARD', 'GRENADIER'] as SoldierType[]).map((type) => {
                    const spec = SOLDIER_SPECS[type];
                    const scaledHp = Math.round(spec.maxHp * hpMult);
                    const scaledDmg = Math.round(spec.damage * dmgMult);
                    const activeCount = unitCounts[type];

                    return (
                      <div
                        key={type}
                        className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                            <span>{spec.name}</span>
                            <span className="font-mono-num text-xs text-emerald-300">
                              {activeCount} aktif
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{spec.description}</p>
                          <div className="text-[11px] text-sky-300 mt-1 font-mono-num">
                            {scaledHp} Can · {scaledDmg} Hasar{type === 'GRENADIER' ? ' · Alan Patlaması' : ''}
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
                                className={`px-2.5 py-2 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                                  canBuy
                                    ? qty === 1
                                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                      : 'bg-amber-400/90 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                +{qty} ({cost})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <Anchor className="w-4 h-4 text-sky-300 shrink-0" />
                        <span>Refakatçi Savaş Gemisi</span>
                        <span className="font-mono-num text-xs text-sky-300">
                          {kingdom.escortShipCount} aktif
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Denizde filonuza eşlik eder ve düşman devlet gemilerine borda topu ateşler.
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
                            className={`px-3 py-2 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap ${
                              canBuy
                                ? qty === 1
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                  : 'bg-amber-400/90 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                : 'bg-white/10 text-slate-400 cursor-not-allowed'
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

              {/* Enemy Nations & Diplomacy (Offline) OR Online Player Kingdoms */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" />
                  <h3 className="font-display text-base font-semibold text-slate-100">
                    {onlineMode ? 'Odadaki Kaptanlar & Devletler' : 'Rakip Devletler & Fetih'}
                  </h3>
                </div>

                {onlineMode ? (
                  <div className="flex flex-col gap-2.5">
                    {onlinePlayers.filter((rp) => rp.id !== onlineSelfId).length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 text-xs text-slate-300">
                        Odada henüz başka kaptan yok. Oda kodunu paylaşarak arkadaşlarını davet edebilirsin.
                      </div>
                    ) : (
                      onlinePlayers
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
                              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                                isAtWar
                                  ? 'bg-red-950/25 border-red-400/35'
                                  : isIncoming
                                  ? 'bg-amber-950/25 border-amber-400/40'
                                  : 'bg-slate-950/35 border-white/10'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: rp.bannerColor }}
                                  />
                                  <span className="truncate">
                                    {rp.kingdomFounded ? rp.kingdomName : rp.name}
                                  </span>
                                  <span className="font-mono-num text-[11px] text-slate-300 shrink-0">
                                    {rp.conqueredCount} Ada
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold shrink-0 ${
                                      rp.connected ? 'text-emerald-300' : 'text-slate-500'
                                    }`}
                                  >
                                    · {rp.connected ? 'Aktif' : 'Çevrimdışı'}
                                  </span>
                                </div>
                                <div className="text-[11px] mt-1 font-medium text-slate-300 flex items-center gap-1.5">
                                  <Shield className="w-3 h-3 shrink-0" style={{ color: rp.bannerColor }} />
                                  <span>
                                    Kaptan: {rp.name} ·{' '}
                                    {onlineRule === 'COOP' ? (
                                      <strong className="text-emerald-300">Co-op Müttefik</strong>
                                    ) : isAtWar ? (
                                      <strong className="text-red-300">Savaş Halinde</strong>
                                    ) : isIncoming ? (
                                      <strong className="text-amber-300">Sana Savaş Açtı!</strong>
                                    ) : isPending ? (
                                      <strong className="text-amber-200">Onayı Bekleniyor</strong>
                                    ) : (
                                      <strong className="text-slate-200">Barış Halinde</strong>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {onlineRule === 'PVP' && onDeclareOnlineWar && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isAtWar ? (
                                    <span className="px-3.5 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 border border-red-400/40 whitespace-nowrap">
                                      Savaşta
                                    </span>
                                  ) : isIncoming ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, false)}
                                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      Savaş Aç (Kabul Et)
                                    </button>
                                  ) : isPending ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, true)}
                                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      İlanı İptal Et
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onDeclareOnlineWar(rp.id, false)}
                                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      Savaş Aç
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}

                    <div className="p-3 rounded-xl bg-slate-950/25 border border-white/10 text-xs text-slate-300 leading-relaxed">
                      {onlineRule === 'PVP'
                        ? 'PvP Savaş Kuralı: Ordular ve gemiler görünür ancak birbirlerine saldırmadan önce iki oyuncunun da birbirine "Savaş Aç" demesi gerekir.'
                        : 'Co-op Takım aktif: Ordularınız birbirini görür, dost ateşi kapalıdır. Tarafsız adaları birlikte keşfedebilirsiniz.'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5">
                      {ENEMY_FACTION_LIST.map((faction) => {
                        const atWar = kingdom.atWarWith.includes(faction.id);
                        const heldIslands = nationIslandCounts[faction.id] ?? 0;
                        return (
                          <div
                            key={faction.id}
                            className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: faction.color }}
                                />
                                <span className="truncate">{faction.name}</span>
                                <span className="font-mono-num text-[11px] text-slate-300 shrink-0">
                                  {heldIslands} Ada
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{faction.description}</p>
                              <div className="text-[11px] mt-1 font-medium text-slate-300 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" style={{ color: faction.color }} />
                                <span>
                                  Durum:{' '}
                                  <strong className={atWar ? 'text-red-300' : 'text-slate-200'}>
                                    {atWar ? 'Savaş Halinde' : 'Tarafsız'}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={atWar}
                              onClick={() => onDeclareWar(faction.id)}
                              className={`px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors whitespace-nowrap ${
                                atWar
                                  ? 'bg-red-500/20 text-red-300 border border-red-400/35 cursor-default'
                                  : 'bg-red-500 hover:bg-red-400 text-slate-950 cursor-pointer'
                              }`}
                            >
                              {atWar ? 'Savaşta' : 'Savaş Aç'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/25 border border-white/10 text-xs text-slate-300 leading-relaxed">
                      Ordu ve donanma sınırı yok: +5 ve +10 alımlarla yüzlerce asker topla! Rakip devletler de adalarında devasa taburlar bulundurur; Humbaracı Topçularla kalabalık düşman saflarını patlatıp kaleyi ele geçirebilirsin.
                    </div>

                    {/* Fort Defense Turrets */}
                    {onBuildFortTurret && ownedIslands.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-sky-200">
                            {isEn ? 'Fort Defense Turrets' : 'Kale Savunma Kuleleri'}
                          </span>
                          <span className="font-mono-num text-slate-400">
                            80 Altın · 2 Odun · 1 Demir
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {ownedIslands.map((isl) => {
                            const built = fortTurretIslandIds.includes(isl.id);
                            const canBuild = gold >= 80 && wood >= 2 && iron >= 1;
                            return (
                              <div
                                key={isl.id}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/10 text-xs"
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
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold shrink-0 whitespace-nowrap ${
                                      canBuild
                                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                                        : 'bg-white/10 text-slate-400 cursor-not-allowed'
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
