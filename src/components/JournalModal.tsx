import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Gem,
  Lock,
  ScrollText,
  Ship,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { SaveData } from '../types/game';
import {
  ACHIEVEMENTS,
  CAMPAIGN_MILESTONES,
  CampaignStatsInput,
  CAPTAIN_LOGS,
  getCaptainLogBonuses,
  getRelicSetBonuses,
  RELIC_DEFS,
  RELIC_SETS,
} from '../engine/progression';
import { getShipClass, SHIP_CLASSES } from '../engine/upgrades';

type JournalTab = 'STATS' | 'CAMPAIGN' | 'LOGS' | 'RELICS' | 'ACHIEVEMENTS';

interface JournalModalProps {
  save: SaveData;
  language: 'tr' | 'en';
  onClaimMilestone: (milestoneId: string) => void;
  onClose: () => void;
}

function formatDuration(sec: number, lang: 'tr' | 'en'): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) {
    return lang === 'en' ? `${h}h ${rm}m` : `${h}sa ${rm}dk`;
  }
  return lang === 'en' ? `${m}m ${s}s` : `${m}dk ${s}sn`;
}

export const JournalModal: React.FC<JournalModalProps> = ({
  save,
  language,
  onClaimMilestone,
  onClose,
}) => {
  const [tab, setTab] = useState<JournalTab>('CAMPAIGN');
  const isEn = language === 'en';

  const collectedRelicIds = save.collectedRelicIds ?? [];
  const claimedMilestoneIds = save.claimedMilestoneIds ?? [];
  const unlockedAchievementIds = save.unlockedAchievementIds ?? [];
  const discoveredLogIds = save.discoveredLogIds ?? [];
  const relicBonuses = getRelicSetBonuses(collectedRelicIds);
  const logBonuses = getCaptainLogBonuses(discoveredLogIds);
  const conquestHistory = save.conquestHistory ?? [];

  const statsInput: CampaignStatsInput = {
    treasuresFoundCount: save.treasuresFoundCount,
    enemiesSunkCount: save.enemiesSunkCount,
    landEnemiesDefeated: save.landEnemiesDefeated,
    discoveredIslandsCount: save.discoveredIslandIds.length,
    conqueredIslandsCount: save.kingdom.conqueredIslandIds.length,
    kingdomFounded: save.kingdom.founded,
    boatLevel: save.upgrades.boatLevel,
    collectedRelicsCount: collectedRelicIds.length,
    totalGoldEarned: save.totalGoldEarned,
    stormsSurvivedCount: save.stormsSurvivedCount ?? 0,
    soldiersCount: save.kingdom.soldiers.length,
    escortShipCount: save.kingdom.escortShipCount,
  };

  const currentShip = getShipClass(save.upgrades.boatLevel);
  const nextShip = SHIP_CLASSES[save.upgrades.boatLevel] ?? null;

  const claimableCount = CAMPAIGN_MILESTONES.filter(
    (m) => m.isComplete(statsInput) && !claimedMilestoneIds.includes(m.id)
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-6 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? "Captain's Journal" : 'Kaptanın Seyir Defteri'}
    >
      <div className="w-full max-w-4xl max-h-[94dvh] sm:max-h-[90dvh] bg-[#0A1F2B]/96 backdrop-blur-xl border-t sm:border border-white/12 ring-1 ring-inset ring-white/[0.05] rounded-t-3xl sm:rounded-2xl shadow-[0_24px_64px_rgba(2,10,18,0.78)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-[#081A24]/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-amber-300 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {isEn ? "Captain's Journal & Progress" : 'Seyir Defteri & İlerleme'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'Kapat'}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Single-row horizontally scrollable tabs on mobile */}
        <div className="px-3.5 sm:px-5 py-2 border-b border-white/10 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#06141D]/90 shrink-0">
          <button
            type="button"
            onClick={() => setTab('CAMPAIGN')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'CAMPAIGN'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Campaign' : 'Hikaye'}</span>
            {claimableCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold font-mono-num">
                {claimableCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('LOGS')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'LOGS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">
              {isEn ? 'Logs' : 'Günlük'} ({discoveredLogIds.length}/{CAPTAIN_LOGS.length})
            </span>
            <span className="hidden sm:inline">
              {isEn ? "Karloff's Book" : 'Karloff Kitabı'} ({discoveredLogIds.length}/{CAPTAIN_LOGS.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('RELICS')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'RELICS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Gem className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">
              {isEn ? 'Relics' : 'Kalıntı'} ({collectedRelicIds.length}/{RELIC_DEFS.length})
            </span>
            <span className="hidden sm:inline">
              {isEn ? 'Relic Sets' : 'Kalıntılar'} ({collectedRelicIds.length}/{RELIC_DEFS.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('ACHIEVEMENTS')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'ACHIEVEMENTS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">
              {isEn ? 'Awards' : 'Başarım'} ({unlockedAchievementIds.length}/{ACHIEVEMENTS.length})
            </span>
            <span className="hidden sm:inline">
              {isEn ? 'Achievements' : 'Başarımlar'} ({unlockedAchievementIds.length}/
              {ACHIEVEMENTS.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('STATS')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'STATS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? 'Stats' : 'İstatistik'}</span>
            <span className="hidden sm:inline">{isEn ? 'Statistics' : 'İstatistikler'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {tab === 'CAMPAIGN' && (
            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/25 text-xs text-amber-100">
                {isEn
                  ? 'Complete story milestones to unlock captain chronicles and claim bonus gold rewards. Final goal: Sultan of the Isles!'
                  : 'Kaptan günlüklerini açmak ve bonus altın ödülleri toplamak için hikaye dönüm noktalarını tamamla. Son hedef: Ada Sultanı!'}
              </div>

              {CAMPAIGN_MILESTONES.map((ms) => {
                const done = ms.isComplete(statsInput);
                const claimed = claimedMilestoneIds.includes(ms.id);
                return (
                  <div
                    key={ms.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      claimed
                        ? 'bg-emerald-950/25 border-emerald-400/25'
                        : done
                        ? 'bg-amber-950/30 border-amber-400/45'
                        : 'bg-slate-950/35 border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-mono-num text-amber-300">
                          {isEn ? `Ch. ${ms.chapter}` : `Bölüm ${ms.chapter}`}
                        </span>
                        <span>{isEn ? ms.titleEn : ms.title}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {isEn ? ms.storyEn : ms.story}
                      </p>
                      <div className="text-[11px] text-sky-300 font-mono-num mt-1.5">
                        {isEn ? 'Progress: ' : 'İlerleme: '}
                        {ms.progressText(statsInput)} · +{ms.rewardGold} {isEn ? 'Gold' : 'Altın'}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {claimed ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isEn ? 'Claimed' : 'Alındı'}</span>
                        </span>
                      ) : done ? (
                        <button
                          type="button"
                          onClick={() => onClaimMilestone(ms.id)}
                          className="min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>
                            {isEn ? 'Claim' : 'Ödülü Al'} (+{ms.rewardGold})
                          </span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs font-medium flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{isEn ? 'In Progress' : 'Devam Ediyor'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'LOGS' && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-100">
                <div>
                  <div className="font-bold text-amber-200">
                    {isEn ? "Captain Karloff's Lost Chronicles" : 'Kaptan Karloff’un Kayıp Günlükleri'}
                  </div>
                  <div className="text-slate-300 mt-0.5">
                    {isEn
                      ? 'Found in treasure chests, castaway map rafts, rare catches, and conquered forts.'
                      : 'Hazine sandıklarından, kazazede haritalarından, nadir balıklardan ve fethedilen kalelerden sayfa topla.'}
                  </div>
                </div>
                <div className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-950/45 border border-amber-400/25 font-mono-num text-[11px] text-emerald-300 font-semibold">
                  +{Math.round((logBonuses.treasureValueMult - 1) * 100)}% {isEn ? 'Value' : 'Hazine'} · +
                  {(logBonuses.rareLuckBonus * 100).toFixed(1)}% {isEn ? 'Luck' : 'Şans'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAPTAIN_LOGS.map((log) => {
                  const unlocked = discoveredLogIds.includes(log.id);
                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                        unlocked
                          ? 'bg-emerald-950/25 border-emerald-400/35'
                          : 'bg-slate-950/35 border-white/10 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-mono-num text-amber-300 shrink-0">
                            #{log.chapter}
                          </span>
                          <span className="text-sm font-semibold text-slate-100 truncate">
                            {unlocked ? (isEn ? log.titleEn : log.title) : '???'}
                          </span>
                        </div>
                        {unlocked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </div>

                      {unlocked ? (
                        <>
                          <div className="text-[11px] text-amber-200/80 font-medium">
                            {isEn ? 'Author:' : 'Yazar:'} {log.author} · +{log.rewardGold}{' '}
                            {isEn ? 'Gold' : 'Altın'}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            “{isEn ? log.excerptEn : log.excerpt}”
                          </p>
                          <div className="mt-auto pt-1.5 border-t border-white/10 text-[11px] text-sky-300 font-medium">
                            {isEn ? 'Tactical Clue: ' : 'Gizli İpucu: '}
                            {isEn ? log.secretClueEn : log.secretClue}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {isEn
                            ? 'Lost journal page. Dig chests, rescue castaways, or conquer forts to recover it.'
                            : 'Kayıp seyir sayfası. Sandık kazarak, kazazede haritası bularak veya kale fethederek aç.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'RELICS' && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/25 text-xs text-sky-100">
                {isEn
                  ? 'Rare relics can be discovered while digging treasures or sinking event ships. Complete a 3-piece set for permanent passive buffs!'
                  : 'Hazine kazarken veya özel olay gemilerini batırırken nadir kalıntılar keşfedebilirsin. 3 parçalı seti tamamlayarak kalıcı güçlendirmeler kazan!'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RELIC_SETS.map((set) => {
                  const setComplete = relicBonuses.completedSets.includes(set.id);
                  const setRelics = RELIC_DEFS.filter((r) => set.relicIds.includes(r.id));
                  const ownedCount = setRelics.filter((r) =>
                    collectedRelicIds.includes(r.id)
                  ).length;
                  return (
                    <div
                      key={set.id}
                      className={`p-4 rounded-xl border flex flex-col gap-3 ${
                        setComplete
                          ? 'bg-emerald-950/30 border-emerald-400/45'
                          : 'bg-slate-950/35 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            <Sparkles
                              className={`w-4 h-4 ${
                                setComplete ? 'text-emerald-300' : 'text-amber-300'
                              }`}
                            />
                            <span>{isEn ? set.nameEn : set.name}</span>
                          </div>
                          <div
                            className={`text-xs mt-1 font-medium ${
                              setComplete ? 'text-emerald-300' : 'text-amber-200/80'
                            }`}
                          >
                            {isEn ? 'Set Bonus: ' : 'Set Bonusu: '}
                            {isEn ? set.bonusLabelEn : set.bonusLabel}
                          </div>
                        </div>
                        <span className="font-mono-num text-xs font-bold text-slate-300 shrink-0">
                          {ownedCount}/3
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {setRelics.map((r) => {
                          const found = collectedRelicIds.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${
                                found
                                  ? 'bg-white/10 border-white/20'
                                  : 'bg-slate-950/40 border-white/5 opacity-60'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: found ? r.color : '#475569' }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-100 truncate">
                                  {found ? (isEn ? r.nameEn : r.name) : '???'}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {found
                                    ? isEn
                                      ? r.descriptionEn
                                      : r.description
                                    : isEn
                                    ? 'Undiscovered relic'
                                    : 'Henüz keşfedilmedi'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'ACHIEVEMENTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = unlockedAchievementIds.includes(ach.id);
                const tierColor =
                  ach.tier === 'GOLD'
                    ? 'text-amber-300 border-amber-400/40'
                    : ach.tier === 'SILVER'
                    ? 'text-sky-200 border-sky-400/35'
                    : 'text-orange-300 border-orange-400/35';
                return (
                  <div
                    key={ach.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      unlocked
                        ? 'bg-emerald-950/25 border-emerald-400/35'
                        : 'bg-slate-950/35 border-white/10 opacity-80'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Award
                          className={`w-4 h-4 shrink-0 ${
                            unlocked ? 'text-amber-300' : 'text-slate-500'
                          }`}
                        />
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {isEn ? ach.titleEn : ach.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isEn ? ach.descriptionEn : ach.description}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono-num">
                        <span className={`px-1.5 py-0.5 rounded border ${tierColor}`}>
                          {ach.tier}
                        </span>
                        <span className="text-amber-300">+{ach.rewardGold} Altın</span>
                      </div>
                    </div>
                    {unlocked ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'STATS' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: <Coins className="w-4 h-4 text-amber-300" />,
                    label: isEn ? 'Total Gold Earned' : 'Toplam Kazanılan Altın',
                    value: save.totalGoldEarned.toLocaleString('tr-TR'),
                  },
                  {
                    icon: <Gem className="w-4 h-4 text-emerald-300" />,
                    label: isEn ? 'Treasures Dug' : 'Bulunan Hazine',
                    value: String(save.treasuresFoundCount),
                  },
                  {
                    icon: <Ship className="w-4 h-4 text-sky-300" />,
                    label: isEn ? 'Ships Sunk' : 'Batırılan Gemi',
                    value: String(save.enemiesSunkCount),
                  },
                  {
                    icon: <Swords className="w-4 h-4 text-red-400" />,
                    label: isEn ? 'Land Enemies' : 'Kara Düşmanı',
                    value: String(save.landEnemiesDefeated),
                  },
                  {
                    icon: <Compass className="w-4 h-4 text-cyan-300" />,
                    label: isEn ? 'Islands Discovered' : 'Keşfedilen Ada',
                    value: String(save.discoveredIslandIds.length),
                  },
                  {
                    icon: <Crown className="w-4 h-4 text-amber-400" />,
                    label: isEn ? 'Islands Conquered' : 'Fethedilen Ada',
                    value: String(save.kingdom.conqueredIslandIds.length),
                  },
                  {
                    icon: <Sparkles className="w-4 h-4 text-purple-300" />,
                    label: isEn ? 'Relics Found' : 'Toplanan Kalıntı',
                    value: `${collectedRelicIds.length}/${RELIC_DEFS.length}`,
                  },
                  {
                    icon: <Swords className="w-4 h-4 text-orange-300" />,
                    label: isEn ? 'Arena Wins' : 'Arena Zaferi',
                    value: String(save.arenaWinsCount ?? 0),
                  },
                  {
                    icon: <Compass className="w-4 h-4 text-purple-300" />,
                    label: isEn ? 'Caves Explored' : 'Keşfedilen Mağara',
                    value: String(save.cavesExploredCount ?? 0),
                  },
                  {
                    icon: <BookOpen className="w-4 h-4 text-slate-300" />,
                    label: isEn ? 'Playtime' : 'Oynama Süresi',
                    value: formatDuration(save.playTimeSec ?? 0, language),
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      {stat.icon}
                      <span className="truncate">{stat.label}</span>
                    </div>
                    <div className="font-mono-num text-lg font-bold text-slate-100">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Next Ship Class Progress */}
              <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-100">
                  <span className="flex items-center gap-2">
                    <Ship className="w-4 h-4 text-sky-300" />
                    {isEn ? 'Ship Class Progression' : 'Gemi Sınıfı İlerlemesi'}
                  </span>
                  <span className="font-mono-num text-xs text-amber-300">
                    Sv. {save.upgrades.boatLevel}/8 · {currentShip.name}
                  </span>
                </div>
                <div className="mt-2.5 w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${(save.upgrades.boatLevel / 8) * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {nextShip
                    ? `${isEn ? 'Next Class:' : 'Sonraki Sınıf:'} ${nextShip.name} (${nextShip.masts} ${
                        isEn ? 'Masts' : 'Direk'
                      }, ${Math.round(nextShip.maxSpeed)} ${isEn ? 'Speed' : 'Hız'})`
                    : isEn
                    ? 'Maximum ship class reached: Admiral Flagship!'
                    : 'En üst gemi sınıfına ulaştınız: Amiral Armadası!'}
                </div>
              </div>

              {/* Casualties & Conquest History */}
              <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-rose-400" />
                    {isEn ? 'Fleet Casualties & Conquest History' : 'Donanma Kayıpları & Fetih Geçmişi'}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-mono-num">
                    <span className="text-rose-300">
                      {isEn ? 'Soldiers Lost:' : 'Düşen Asker:'} <strong>{save.soldiersLostCount ?? 0}</strong>
                    </span>
                    <span className="text-amber-300">
                      {isEn ? 'Ships Lost:' : 'Batan Gemi:'} <strong>{save.shipsLostCount ?? 0}</strong>
                    </span>
                  </div>
                </div>

                {conquestHistory.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {conquestHistory.slice(-10).reverse().map((entry, idx) => (
                      <div
                        key={`${entry.islandName}_${idx}`}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/35 border border-emerald-400/25 text-[11px] text-slate-200 flex items-center gap-1.5"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="font-mono-num text-amber-200">
                          {isEn ? `Day ${entry.dayNumber}` : `Gün ${entry.dayNumber}`}
                        </span>
                        <span className="font-semibold text-emerald-200">{entry.islandName}</span>
                        <span className="text-slate-400">({entry.factionName})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    {isEn
                      ? 'No fort conquests recorded yet. Capture an enemy island fort to etch history!'
                      : 'Henüz kale fethi kaydedilmedi. Bir düşman adası fethederek tarih yaz!'}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {isEn ? 'World Seed:' : 'Dünya Tohumu (Seed):'}{' '}
                  <strong className="font-mono-num text-amber-300">{save.worldSeed}</strong>
                </span>
                <span>
                  {isEn ? 'Fish Caught:' : 'Tutulan Balık:'}{' '}
                  <strong className="font-mono-num text-cyan-300">
                    {save.caughtFishCount ?? 0}
                  </strong>
                </span>
                <span>
                  {isEn ? 'Resources:' : 'Kaynaklar:'}{' '}
                  <strong className="font-mono-num text-emerald-300">
                    {save.wood ?? 0} {isEn ? 'Wood' : 'Odun'} · {save.iron ?? 0}{' '}
                    {isEn ? 'Iron' : 'Demir'}
                  </strong>
                </span>
                <span>
                  {isEn ? 'Storms Survived:' : 'Atlatılan Fırtına:'}{' '}
                  <strong className="font-mono-num text-sky-300">
                    {save.stormsSurvivedCount ?? 0}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
