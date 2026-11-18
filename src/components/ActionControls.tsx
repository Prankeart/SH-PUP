import React from 'react';
import { Anchor, Compass, Crosshair, DoorOpen, Fish, Pickaxe, Shield, Ship, Sword, Wrench, Zap } from 'lucide-react';
import { ArmyStance, RadarReading, WeaponId } from '../types/game';
import { WEAPONS } from '../engine/weapons';

export type ActionControlsDisplayMode = 'TOUCH' | 'DESKTOP' | 'HIDDEN';

interface ActionControlsProps {
  displayMode: ActionControlsDisplayMode;
  isSailing: boolean;
  canBoard: boolean;
  canDisembark: boolean;
  canDig: boolean;
  equippedWeapon: WeaponId | null;
  digCooldownPct: number;
  cannonCooldownPct: number;
  attackCooldownPct: number;
  radarCooldownPct: number;
  abilityCooldownPct: number;
  lastRadar: RadarReading | null;
  colorblindMode?: boolean;
  language?: 'tr' | 'en';
  abilityKeyLabel?: string;
  canFish?: boolean;
  isFishing?: boolean;
  fishingBite?: boolean;
  repairKits?: number;
  armyStance?: ArmyStance;
  hasSoldiers?: boolean;
  interactLabel?: string | null;
  onDig: () => void;
  onFireCannons: () => void;
  onAttackLand: () => void;
  onToggleBoat: () => void;
  onInteract?: () => void;
  onRadar: () => void;
  onTriggerAbility: () => void;
  onFish?: () => void;
  onUseRepairKit?: () => void;
  onCycleStance?: () => void;
}

const HEAT_STYLES: Record<string, string> = {
  HOT: 'text-red-400 border-red-400/50',
  WARM: 'text-amber-300 border-amber-400/50',
  COOL: 'text-sky-300 border-sky-400/40',
  COLD: 'text-blue-200 border-blue-300/35',
  NONE: 'text-slate-300 border-white/20',
};

const HEAT_STYLES_CB: Record<string, string> = {
  HOT: 'text-pink-300 border-pink-400/75',
  WARM: 'text-amber-200 border-amber-400/75',
  COOL: 'text-cyan-200 border-cyan-400/75',
  COLD: 'text-slate-100 border-slate-300/60',
  NONE: 'text-slate-300 border-white/20',
};

const HEAT_PREFIX_CB: Record<string, string> = {
  HOT: '[!!!]',
  WARM: '[!!]',
  COOL: '[~]',
  COLD: '[.]',
  NONE: '[–]',
};

export const ActionControls: React.FC<ActionControlsProps> = ({
  displayMode,
  isSailing,
  canBoard,
  canDisembark,
  canDig,
  equippedWeapon,
  digCooldownPct,
  cannonCooldownPct,
  attackCooldownPct,
  radarCooldownPct,
  abilityCooldownPct,
  lastRadar,
  colorblindMode = false,
  language = 'tr',
  abilityKeyLabel = 'Q',
  canFish = false,
  isFishing = false,
  fishingBite = false,
  repairKits = 0,
  armyStance = 'CHARGE',
  hasSoldiers = false,
  interactLabel = null,
  onDig,
  onFireCannons,
  onAttackLand,
  onToggleBoat,
  onInteract,
  onRadar,
  onTriggerAbility,
  onFish,
  onUseRepairKit,
  onCycleStance,
}) => {
  const isEn = language === 'en';
  const boatActionEnabled = isSailing ? canDisembark : canBoard;
  const showRadarStatus = lastRadar && Date.now() - lastRadar.timestamp < 5000;
  const primaryCooldown = isSailing ? cannonCooldownPct : digCooldownPct;
  const primaryEnabled = isSailing ? cannonCooldownPct === 0 : canDig && digCooldownPct === 0;
  const weaponDef = equippedWeapon ? WEAPONS[equippedWeapon] : null;
  const heatStyles = colorblindMode ? HEAT_STYLES_CB : HEAT_STYLES;

  const radarToastContent = showRadarStatus && lastRadar && (
    <div
      className={`px-3 py-1.5 rounded-xl bg-[#0F2936]/90 border text-xs font-medium flex items-center gap-2 shadow-lg transition-opacity duration-150 max-w-[calc(100vw-1.5rem)] ${
        heatStyles[lastRadar.heat] || heatStyles.NONE
      }`}
    >
      <Compass className="w-3.5 h-3.5 shrink-0" />
      <span className="whitespace-nowrap truncate">
        {colorblindMode ? `${HEAT_PREFIX_CB[lastRadar.heat] ?? ''} ` : ''}
        {lastRadar.label}
        {lastRadar.distance !== null ? ` · ${Math.round(lastRadar.distance)}m` : ''}
      </span>
    </div>
  );

  if (displayMode === 'HIDDEN') {
    return (
      <div className="pointer-events-none relative flex flex-col items-end select-none">
        {radarToastContent}
      </div>
    );
  }

  if (displayMode === 'DESKTOP') {
    return (
      <div className="pointer-events-none relative flex flex-col items-end select-none shrink-0">
        {radarToastContent && (
          <div className="absolute bottom-full right-0 mb-2">{radarToastContent}</div>
        )}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl bg-[#0F2936]/85 border border-white/15 shadow-lg">
          {onCycleStance && hasSoldiers && !isSailing && (
            <button
              type="button"
              onClick={onCycleStance}
              title={isEn ? 'Cycle Army Stance (V)' : 'Ordu Düzenini Değiştir (V)'}
              className="h-9 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                {armyStance === 'FOLLOW'
                  ? isEn
                    ? 'Follow'
                    : 'Takip'
                  : armyStance === 'DEFEND'
                  ? isEn
                    ? 'Defend'
                    : 'Savun'
                  : isEn
                  ? 'Charge'
                  : 'Saldır'}
              </span>
              <kbd className="text-[10px] opacity-75 font-mono-num">[V]</kbd>
            </button>
          )}

          {onUseRepairKit && repairKits > 0 && (
            <button
              type="button"
              onClick={onUseRepairKit}
              title={isEn ? 'Use Repair Kit' : 'Tamir Kiti Kullan'}
              className="h-9 px-2.5 rounded-lg bg-emerald-600/85 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="font-mono-num">{repairKits}</span>
            </button>
          )}

          {onFish && (canFish || isFishing) && (
            <button
              type="button"
              onClick={onFish}
              title={isEn ? 'Cast / Reel Fishing Line (G)' : 'Olta At / Çek (G)'}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                fishingBite
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 animate-pulse'
                  : isFishing
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  : 'bg-cyan-600/90 hover:bg-cyan-500 text-white'
              }`}
            >
              <Fish className="w-3.5 h-3.5" />
              <span>
                {fishingBite
                  ? isEn
                    ? 'Reel!'
                    : 'Çek!'
                  : isFishing
                  ? isEn
                    ? 'Waiting...'
                    : 'Bekle...'
                  : isEn
                  ? 'Fish'
                  : 'Balık'}
              </span>
              <kbd className="text-[10px] opacity-80 font-mono-num">[G]</kbd>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (abilityCooldownPct === 0) onTriggerAbility();
            }}
            disabled={abilityCooldownPct > 0}
            title={
              isEn
                ? `Tactical War Cry (${abilityKeyLabel})`
                : `Savaş Emri / Kalkan (${abilityKeyLabel})`
            }
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              abilityCooldownPct > 0
                ? 'bg-white/5 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600/90 hover:bg-indigo-500 text-white cursor-pointer'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isEn ? 'Order' : 'Emir'}</span>
            <kbd className="text-[10px] opacity-80 font-mono-num">[{abilityKeyLabel}]</kbd>
          </button>

          {!isSailing && weaponDef && (
            <button
              type="button"
              onClick={() => {
                if (attackCooldownPct === 0) onAttackLand();
              }}
              disabled={attackCooldownPct > 0}
              title={`${weaponDef.name} (F)`}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                attackCooldownPct > 0
                  ? 'bg-white/5 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600/90 hover:bg-red-500 text-white cursor-pointer'
              }`}
            >
              {weaponDef.kind === 'MELEE' ? (
                <Sword className="w-3.5 h-3.5" />
              ) : (
                <Crosshair className="w-3.5 h-3.5" />
              )}
              <span>{isEn ? 'Attack' : 'Saldır'}</span>
              <kbd className="text-[10px] opacity-75 font-mono-num">[F]</kbd>
            </button>
          )}

          <button
            type="button"
            onClick={onRadar}
            disabled={radarCooldownPct > 0}
            title={isEn ? 'Treasure Radar (R)' : 'Hazine Radarı (R)'}
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              radarCooldownPct > 0
                ? 'bg-white/5 text-slate-400 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/15 text-sky-200 cursor-pointer'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isEn ? 'Radar' : 'Radar'}</span>
            <kbd className="text-[10px] opacity-75 font-mono-num">[R]</kbd>
          </button>

          {interactLabel && onInteract ? (
            <button
              type="button"
              onClick={onInteract}
              title={`${interactLabel} (E)`}
              className="h-9 px-3 rounded-lg bg-purple-600/95 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shadow-md"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{interactLabel}</span>
              <kbd className="text-[10px] opacity-85 font-mono-num">[E]</kbd>
            </button>
          ) : (
            boatActionEnabled && (
              <button
                type="button"
                onClick={onToggleBoat}
                title={
                  isSailing
                    ? isEn
                      ? 'Disembark (E)'
                      : 'Kıyıya İn (E)'
                    : isEn
                    ? 'Board Ship (E)'
                    : 'Tekneye Bin (E)'
                }
                className="h-9 px-3 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {isSailing ? <Anchor className="w-3.5 h-3.5" /> : <Ship className="w-3.5 h-3.5" />}
                <span>
                  {isSailing
                    ? isEn
                      ? 'Disembark'
                      : 'Kıyıya İn'
                    : isEn
                    ? 'Board'
                    : 'Tekneye Bin'}
                </span>
                <kbd className="text-[10px] opacity-85 font-mono-num">[E]</kbd>
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => {
              if (!primaryEnabled) return;
              if (isSailing) onFireCannons();
              else onDig();
            }}
            disabled={!primaryEnabled}
            title={
              isSailing
                ? isEn
                  ? 'Fire Broadsides (Space)'
                  : 'Yan Topları Ateşle (Boşluk)'
                : isEn
                ? 'Dig Sand (Space)'
                : 'Kazı Yap (Boşluk)'
            }
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isSailing
                ? primaryCooldown === 0
                  ? 'bg-red-500 hover:bg-red-400 text-white cursor-pointer'
                  : 'bg-white/5 text-slate-400 cursor-not-allowed'
                : canDig && digCooldownPct === 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                : 'bg-white/5 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSailing ? <Crosshair className="w-3.5 h-3.5" /> : <Pickaxe className="w-3.5 h-3.5" />}
            <span>
              {isSailing ? (isEn ? 'Fire' : 'Top At') : isEn ? 'Dig' : 'Kazı Yap'}
            </span>
            <kbd className="text-[10px] opacity-80 font-mono-num">
              [{isEn ? 'Space' : 'Boşluk'}]
            </kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none relative flex flex-col items-end select-none shrink-0">
      {radarToastContent && (
        <div className="absolute bottom-full right-0 mb-2">{radarToastContent}</div>
      )}

      <div className="pointer-events-auto relative w-44 h-40 sm:w-56 sm:h-48">
        {/* Contextual Fishing button on Touch HUD */}
        {onFish && (canFish || isFishing) && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onFish();
            }}
            aria-label={isEn ? 'Fish (G)' : 'Balık Tut (G)'}
            className={`absolute -top-12 right-2 w-11 h-11 rounded-full border flex flex-col items-center justify-center shadow-lg active:scale-95 cursor-pointer ${
              fishingBite
                ? 'bg-amber-400 border-amber-100 text-slate-950 animate-pulse'
                : isFishing
                ? 'bg-cyan-500 border-cyan-200 text-slate-950'
                : 'bg-cyan-700/90 border-cyan-300/60 text-white'
            }`}
          >
            <Fish className="w-4 h-4" />
            <span className="text-[8px] font-bold whitespace-nowrap">
              {fishingBite ? (isEn ? 'Reel!' : 'Çek!') : isEn ? 'Fish' : 'Olta'}
            </span>
          </button>
        )}

        {/* Tactical Ability button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (abilityCooldownPct === 0) onTriggerAbility();
          }}
          disabled={abilityCooldownPct > 0}
          aria-label={isEn ? 'Tactical War Cry' : 'Savaş Emri'}
          title={isEn ? 'Tactical War Cry (Q)' : 'Savaş Emri (Q)'}
          className={`absolute top-0 left-12 sm:left-16 w-11 h-11 sm:w-14 sm:h-14 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer ${
            abilityCooldownPct > 0
              ? 'bg-slate-900/60 border-indigo-400/20 text-slate-400'
              : 'bg-indigo-600/90 border-indigo-300/60 text-white hover:bg-indigo-500'
          }`}
        >
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="text-[8px] sm:text-[9px] font-semibold tracking-tight whitespace-nowrap">
            {isEn ? 'Order' : 'Emir'}
          </span>
        </button>

        {/* Contextual Land Attack button when player has found a weapon */}
        {!isSailing && weaponDef && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (attackCooldownPct === 0) onAttackLand();
            }}
            disabled={attackCooldownPct > 0}
            aria-label={`${weaponDef.name} (F)`}
            title={`${weaponDef.name} (F)`}
            className={`absolute top-12 left-0 sm:top-14 sm:left-1 w-12 h-12 sm:w-15 sm:h-15 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-red-400 cursor-pointer ${
              attackCooldownPct > 0
                ? 'bg-slate-900/65 border-red-400/25 text-slate-400'
                : 'bg-red-600/90 border-red-300/60 text-white hover:bg-red-500'
            }`}
          >
            {weaponDef.kind === 'MELEE' ? (
              <Sword className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap">
              {isEn ? 'Attack' : 'Saldır'}
            </span>
          </button>
        )}

        {/* Top-right secondary button: Hazine Radarı */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onRadar();
          }}
          disabled={radarCooldownPct > 0}
          aria-label={isEn ? 'Treasure Radar (R)' : 'Hazine Radarı (R)'}
          title={isEn ? 'Treasure Radar (R)' : 'Hazine Radarı (R)'}
          className={`absolute top-0 right-1.5 sm:right-2 w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
            radarCooldownPct > 0
              ? 'bg-slate-900/60 border-white/15 text-slate-400'
              : 'bg-[#0F2936]/90 border-sky-300/45 text-sky-200 hover:bg-[#153849]'
          }`}
        >
          <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap">
            Radar
          </span>
        </button>

        {/* Contextual Cave / Arena / Altar Interact button on Touch HUD */}
        {interactLabel && onInteract ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onInteract();
            }}
            aria-label={`${interactLabel} (E)`}
            title={`${interactLabel} (E)`}
            className="absolute bottom-1 left-2 sm:bottom-2 sm:left-3 w-12 h-12 sm:w-16 sm:h-16 rounded-full border bg-purple-600/95 border-purple-200/70 text-white hover:bg-purple-500 flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer"
          >
            <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[8px] sm:text-[9px] font-semibold tracking-tight whitespace-nowrap max-w-[3.4rem] truncate">
              {interactLabel}
            </span>
          </button>
        ) : (
          /* Bottom-left secondary button: Tekneye Bin / İn */
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (boatActionEnabled) onToggleBoat();
            }}
            disabled={!boatActionEnabled}
            aria-label={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
            title={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
            className={`absolute bottom-1 left-2 sm:bottom-2 sm:left-3 w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 ${
              boatActionEnabled
                ? 'bg-emerald-600/90 border-emerald-300/60 text-white hover:bg-emerald-500 cursor-pointer'
                : 'bg-slate-900/55 border-white/15 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSailing ? (
              <Anchor className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Ship className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap">
              {isSailing ? (isEn ? 'Land' : 'İn') : isEn ? 'Ship' : 'Tekne'}
            </span>
          </button>
        )}

        {/* Bottom-right primary large button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (!primaryEnabled) return;
            if (isSailing) onFireCannons();
            else onDig();
          }}
          disabled={!primaryEnabled}
          aria-label={isSailing ? 'Yan Topları Ateşle (Boşluk)' : 'Kazı Yap (Boşluk)'}
          title={isSailing ? 'Yan Topları Ateşle (Boşluk)' : 'Kazı Yap (Boşluk)'}
          className={`absolute bottom-0 right-0 w-[4.5rem] h-[4.5rem] sm:w-22 sm:h-22 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 sm:gap-1 shadow-xl transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-300 ${
            isSailing
              ? primaryCooldown === 0
                ? 'bg-red-500 border-amber-200 text-white hover:bg-red-400 cursor-pointer'
                : 'bg-slate-900/65 border-red-400/30 text-slate-300 cursor-not-allowed'
              : canDig
              ? 'bg-amber-500 border-amber-200 text-slate-950 hover:bg-amber-400 cursor-pointer'
              : 'bg-slate-900/60 border-white/15 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSailing ? (
            <Crosshair className="w-6 h-6 sm:w-7 sm:h-7" />
          ) : (
            <Pickaxe className="w-6 h-6 sm:w-7 sm:h-7" />
          )}
          <span className="text-[11px] sm:text-xs font-bold tracking-tight whitespace-nowrap">
            {isSailing ? (isEn ? 'Fire' : 'Top At') : isEn ? 'Dig' : 'Kazı Yap'}
          </span>
        </button>
      </div>
    </div>
  );
};

