import React from 'react';
import { Anchor, Compass, Crosshair, Pickaxe, Ship, Sword } from 'lucide-react';
import { RadarReading, WeaponId } from '../types/game';
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
  lastRadar: RadarReading | null;
  onDig: () => void;
  onFireCannons: () => void;
  onAttackLand: () => void;
  onToggleBoat: () => void;
  onRadar: () => void;
}

const HEAT_STYLES: Record<string, string> = {
  HOT: 'text-red-400 border-red-400/50',
  WARM: 'text-amber-300 border-amber-400/50',
  COOL: 'text-sky-300 border-sky-400/40',
  COLD: 'text-blue-200 border-blue-300/35',
  NONE: 'text-slate-300 border-white/20',
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
  lastRadar,
  onDig,
  onFireCannons,
  onAttackLand,
  onToggleBoat,
  onRadar,
}) => {
  const boatActionEnabled = isSailing ? canDisembark : canBoard;
  const showRadarStatus = lastRadar && Date.now() - lastRadar.timestamp < 5000;
  const primaryCooldown = isSailing ? cannonCooldownPct : digCooldownPct;
  const primaryEnabled = isSailing ? cannonCooldownPct === 0 : canDig && digCooldownPct === 0;
  const weaponDef = equippedWeapon ? WEAPONS[equippedWeapon] : null;

  const radarToastContent = showRadarStatus && lastRadar && (
    <div
      className={`px-3 py-1.5 rounded-xl bg-[#0F2936]/90 border text-xs font-medium flex items-center gap-2 shadow-lg transition-opacity duration-150 max-w-[calc(100vw-1.5rem)] ${
        HEAT_STYLES[lastRadar.heat] || HEAT_STYLES.NONE
      }`}
    >
      <Compass className="w-3.5 h-3.5 shrink-0" />
      <span className="whitespace-nowrap truncate">
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
              <span>Saldır</span>
              <kbd className="text-[10px] opacity-75 font-mono-num">[F]</kbd>
            </button>
          )}

          <button
            type="button"
            onClick={onRadar}
            disabled={radarCooldownPct > 0}
            title="Hazine Radarı (R)"
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              radarCooldownPct > 0
                ? 'bg-white/5 text-slate-400 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/15 text-sky-200 cursor-pointer'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Radar</span>
            <kbd className="text-[10px] opacity-75 font-mono-num">[R]</kbd>
          </button>

          {boatActionEnabled && (
            <button
              type="button"
              onClick={onToggleBoat}
              title={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
              className="h-9 px-3 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isSailing ? <Anchor className="w-3.5 h-3.5" /> : <Ship className="w-3.5 h-3.5" />}
              <span>{isSailing ? 'Kıyıya İn' : 'Tekneye Bin'}</span>
              <kbd className="text-[10px] opacity-85 font-mono-num">[E]</kbd>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!primaryEnabled) return;
              if (isSailing) onFireCannons();
              else onDig();
            }}
            disabled={!primaryEnabled}
            title={isSailing ? 'Yan Topları Ateşle (Boşluk)' : 'Kazı Yap (Boşluk)'}
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
            <span>{isSailing ? 'Top At' : 'Kazı Yap'}</span>
            <kbd className="text-[10px] opacity-80 font-mono-num">[Boşluk]</kbd>
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

      <div className="pointer-events-auto relative w-40 h-36 sm:w-52 sm:h-46">
        {/* Contextual Land Attack button when player has found a weapon */}
        {!isSailing && weaponDef && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (attackCooldownPct === 0) onAttackLand();
            }}
            disabled={attackCooldownPct > 0}
            aria-label={`${weaponDef.name} ile Saldır (F)`}
            title={`${weaponDef.name} (F)`}
            className={`absolute top-1.5 left-1 sm:top-2 sm:left-2 w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-red-400 cursor-pointer ${
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
              Saldır
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
          aria-label="Hazine Radarı (R)"
          title="Hazine Radarı (R)"
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

        {/* Bottom-left secondary button: Tekneye Bin / İn */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (boatActionEnabled) onToggleBoat();
          }}
          disabled={!boatActionEnabled}
          aria-label={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
          title={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
          className={`absolute bottom-1 left-0 sm:bottom-2 w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 ${
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
            {isSailing ? 'İn' : 'Tekne'}
          </span>
        </button>

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
            {isSailing ? 'Top At' : 'Kazı Yap'}
          </span>
        </button>
      </div>
    </div>
  );
};
