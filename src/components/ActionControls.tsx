import React, { useRef } from 'react';
import {
  Anchor,
  Compass,
  Crosshair,
  DoorOpen,
  Fish,
  Pickaxe,
  Shield,
  Ship,
  Sword,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  ArmyStance,
  RadarReading,
  TouchButtonId,
  TouchButtonTransform,
  TouchLayoutConfig,
  WeaponId,
} from '../types/game';
import { WEAPONS } from '../engine/weapons';

export type ActionControlsDisplayMode = 'TOUCH' | 'DESKTOP' | 'HIDDEN';

type ActionButtonKey = Exclude<TouchButtonId, 'joystick'>;

interface ButtonRectSpec {
  left: number;
  top: number;
  w: number;
  h: number;
}

const COMPACT_CONTAINER = { w: 176, h: 160, pad: 8 };
const FULL_CONTAINER = { w: 224, h: 192, pad: 20 };

const COMPACT_RECTS: Record<ActionButtonKey, ButtonRectSpec> = {
  fish: { left: 124, top: -48, w: 44, h: 44 },
  ability: { left: 48, top: 0, w: 44, h: 44 },
  attack: { left: 0, top: 48, w: 48, h: 48 },
  radar: { left: 122, top: 0, w: 48, h: 48 },
  boatOrInteract: { left: 8, top: 108, w: 48, h: 48 },
  digOrFire: { left: 104, top: 88, w: 72, h: 72 },
};

const FULL_RECTS: Record<ActionButtonKey, ButtonRectSpec> = {
  fish: { left: 172, top: -48, w: 44, h: 44 },
  ability: { left: 64, top: 0, w: 56, h: 56 },
  attack: { left: 4, top: 56, w: 60, h: 60 },
  radar: { left: 152, top: 0, w: 64, h: 64 },
  boatOrInteract: { left: 12, top: 120, w: 64, h: 64 },
  digOrFire: { left: 136, top: 104, w: 88, h: 88 },
};

export function clampActionButtonTransform(
  id: ActionButtonKey,
  raw: TouchButtonTransform | undefined,
  compact: boolean
): { dx: number; dy: number; scale: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const container = compact ? COMPACT_CONTAINER : FULL_CONTAINER;
  const rect = compact ? COMPACT_RECTS[id] : FULL_RECTS[id];
  const scale = Math.max(0.75, Math.min(1.35, raw?.scale ?? 1));
  const halfExtraW = ((rect.w * scale) - rect.w) / 2;
  const halfExtraH = ((rect.h * scale) - rect.h) / 2;

  const baseScreenLeft = vw - container.pad - container.w + rect.left;
  const baseScreenTop = vh - container.pad - container.h + rect.top;

  const minDx = 8 + halfExtraW - baseScreenLeft;
  const maxDx = vw - 8 - rect.w - halfExtraW - baseScreenLeft;
  const minDy = 8 + halfExtraH - baseScreenTop;
  const maxDy = vh - 8 - rect.h - halfExtraH - baseScreenTop;

  const safeMaxDx = Math.max(minDx, maxDx);
  const safeMaxDy = Math.max(minDy, maxDy);

  return {
    dx: Math.max(minDx, Math.min(safeMaxDx, raw?.dx ?? 0)),
    dy: Math.max(minDy, Math.min(safeMaxDy, raw?.dy ?? 0)),
    scale,
  };
}

interface ActionControlsProps {
  displayMode: ActionControlsDisplayMode;
  compact?: boolean;
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
  touchLayout?: TouchLayoutConfig;
  isEditingLayout?: boolean;
  selectedButtonId?: TouchButtonId | null;
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
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
  compact = false,
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
  touchLayout,
  isEditingLayout = false,
  selectedButtonId = null,
  onSelectButton,
  onUpdateButtonTransform,
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
  const showRadarStatus = !isEditingLayout && lastRadar && Date.now() - lastRadar.timestamp < 5000;
  const primaryCooldown = isSailing ? cannonCooldownPct : digCooldownPct;
  const primaryEnabled = isSailing ? cannonCooldownPct === 0 : canDig && digCooldownPct === 0;
  const weaponDef = equippedWeapon ? WEAPONS[equippedWeapon] : null;
  const heatStyles = colorblindMode ? HEAT_STYLES_CB : HEAT_STYLES;

  const dragStateRef = useRef<{
    id: ActionButtonKey;
    pointerId: number;
    pointerX: number;
    pointerY: number;
    startDx: number;
    startDy: number;
    scale: number;
  } | null>(null);

  const radarToastContent = showRadarStatus && lastRadar && (
    <div
      className={`px-3 py-1.5 rounded-xl bg-[#0F2936]/95 border text-xs font-medium flex items-center gap-2 shadow-xl transition-opacity duration-150 max-w-[calc(100vw-1.5rem)] ${
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

  if (displayMode === 'HIDDEN' && !isEditingLayout) {
    return (
      <div className="pointer-events-none relative flex flex-col items-end select-none">
        {radarToastContent}
      </div>
    );
  }

  if (displayMode === 'DESKTOP' && !isEditingLayout) {
    return (
      <div className="pointer-events-none relative flex flex-col items-end select-none shrink-0">
        {radarToastContent && (
          <div className="absolute bottom-full right-0 mb-2 z-30">{radarToastContent}</div>
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

  // TOUCH mode (or LAYOUT_EDIT preview)
  const container = compact ? COMPACT_CONTAINER : FULL_CONTAINER;
  const rects = compact ? COMPACT_RECTS : FULL_RECTS;

  const getBtnGeom = (id: ActionButtonKey) => {
    const r = rects[id];
    const t = clampActionButtonTransform(id, touchLayout?.[id], compact);
    return { r, t };
  };

  const makeDragHandlers = (id: ActionButtonKey) => {
    if (!isEditingLayout) return {};
    const { t } = getBtnGeom(id);
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onSelectButton?.(id);
        dragStateRef.current = {
          id,
          pointerId: e.pointerId,
          pointerX: e.clientX,
          pointerY: e.clientY,
          startDx: t.dx,
          startDy: t.dy,
          scale: t.scale,
        };
      },
      onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
        const nextDx = drag.startDx + (e.clientX - drag.pointerX);
        const nextDy = drag.startDy + (e.clientY - drag.pointerY);
        const clamped = clampActionButtonTransform(
          id,
          { dx: nextDx, dy: nextDy, scale: drag.scale },
          compact
        );
        onUpdateButtonTransform?.(id, clamped);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (dragStateRef.current?.pointerId === e.pointerId) {
          dragStateRef.current = null;
        }
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (dragStateRef.current?.pointerId === e.pointerId) {
          dragStateRef.current = null;
        }
      },
    };
  };

  const editRingClass = (id: ActionButtonKey) =>
    isEditingLayout
      ? selectedButtonId === id
        ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950/60 cursor-move'
        : 'outline-dashed outline-2 outline-sky-300/75 cursor-move'
      : '';

  const showFishBtn = isEditingLayout || Boolean(onFish && (canFish || isFishing));
  const showAttackBtn = isEditingLayout || (!isSailing && Boolean(weaponDef));

  // Dynamically compute the top edge of all currently visible touch buttons so the Radar toast
  // always appears cleanly ABOVE Olta / Radar / any customized button without overlapping!
  const visibleKeys: ActionButtonKey[] = ['ability', 'radar', 'boatOrInteract', 'digOrFire'];
  if (showFishBtn) visibleKeys.push('fish');
  if (showAttackBtn) visibleKeys.push('attack');

  let minVisibleTop = 0;
  for (const key of visibleKeys) {
    const { r, t } = getBtnGeom(key);
    const halfExtraH = ((r.h * t.scale) - r.h) / 2;
    const btnTop = r.top + t.dy - halfExtraH;
    if (btnTop < minVisibleTop) minVisibleTop = btnTop;
  }

  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const containerScreenTop = vh - container.pad - container.h;
  const toastTopCandidate = minVisibleTop - 40;
  const toastFitsAbove = containerScreenTop + toastTopCandidate >= 48;

  const fishGeom = getBtnGeom('fish');
  const abilityGeom = getBtnGeom('ability');
  const attackGeom = getBtnGeom('attack');
  const radarGeom = getBtnGeom('radar');
  const boatGeom = getBtnGeom('boatOrInteract');
  const digGeom = getBtnGeom('digOrFire');

  return (
    <div className="pointer-events-none relative flex flex-col items-end select-none shrink-0 touch-none">
      {radarToastContent && (
        <div
          style={
            toastFitsAbove
              ? { top: `${toastTopCandidate}px`, right: 0 }
              : { top: '4px', right: `${container.w + 10}px` }
          }
          className="absolute z-30 pointer-events-none"
        >
          {radarToastContent}
        </div>
      )}

      <div
        style={{ width: `${container.w}px`, height: `${container.h}px` }}
        className="pointer-events-none relative touch-none"
      >
        {/* Contextual Fishing button on Touch HUD */}
        {showFishBtn && (
          <button
            type="button"
            onPointerDown={
              isEditingLayout
                ? makeDragHandlers('fish').onPointerDown
                : (e) => {
                    e.preventDefault();
                    onFish?.();
                  }
            }
            onPointerMove={makeDragHandlers('fish').onPointerMove}
            onPointerUp={makeDragHandlers('fish').onPointerUp}
            onPointerCancel={makeDragHandlers('fish').onPointerCancel}
            aria-label={isEn ? 'Fish (G)' : 'Balık Tut (G)'}
            style={{
              left: `${fishGeom.r.left}px`,
              top: `${fishGeom.r.top}px`,
              width: `${fishGeom.r.w}px`,
              height: `${fishGeom.r.h}px`,
              transform: `translate(${fishGeom.t.dx}px, ${fishGeom.t.dy}px) scale(${fishGeom.t.scale})`,
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center shadow-lg transition-shadow duration-100 active:scale-95 cursor-pointer ${
              fishingBite
                ? 'bg-amber-400 border-amber-100 text-slate-950 animate-pulse'
                : isFishing
                ? 'bg-cyan-500 border-cyan-200 text-slate-950'
                : 'bg-cyan-700/90 border-cyan-300/60 text-white'
            } ${editRingClass('fish')}`}
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
          onPointerDown={
            isEditingLayout
              ? makeDragHandlers('ability').onPointerDown
              : (e) => {
                  e.preventDefault();
                  if (abilityCooldownPct === 0) onTriggerAbility();
                }
          }
          onPointerMove={makeDragHandlers('ability').onPointerMove}
          onPointerUp={makeDragHandlers('ability').onPointerUp}
          onPointerCancel={makeDragHandlers('ability').onPointerCancel}
          disabled={!isEditingLayout && abilityCooldownPct > 0}
          aria-label={isEn ? 'Tactical War Cry' : 'Savaş Emri'}
          title={isEn ? 'Tactical War Cry (Q)' : 'Savaş Emri (Q)'}
          style={{
            left: `${abilityGeom.r.left}px`,
            top: `${abilityGeom.r.top}px`,
            width: `${abilityGeom.r.w}px`,
            height: `${abilityGeom.r.h}px`,
            transform: `translate(${abilityGeom.t.dx}px, ${abilityGeom.t.dy}px) scale(${abilityGeom.t.scale})`,
          }}
          className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-shadow duration-100 active:scale-95 cursor-pointer ${
            !isEditingLayout && abilityCooldownPct > 0
              ? 'bg-slate-900/60 border-indigo-400/20 text-slate-400'
              : 'bg-indigo-600/90 border-indigo-300/60 text-white hover:bg-indigo-500'
          } ${editRingClass('ability')}`}
        >
          <Zap className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span
            className={`${
              compact ? 'text-[8px]' : 'text-[9px]'
            } font-semibold tracking-tight whitespace-nowrap`}
          >
            {isEn ? 'Order' : 'Emir'}
          </span>
        </button>

        {/* Contextual Land Attack button when player has found a weapon */}
        {showAttackBtn && (
          <button
            type="button"
            onPointerDown={
              isEditingLayout
                ? makeDragHandlers('attack').onPointerDown
                : (e) => {
                    e.preventDefault();
                    if (attackCooldownPct === 0) onAttackLand();
                  }
            }
            onPointerMove={makeDragHandlers('attack').onPointerMove}
            onPointerUp={makeDragHandlers('attack').onPointerUp}
            onPointerCancel={makeDragHandlers('attack').onPointerCancel}
            disabled={!isEditingLayout && attackCooldownPct > 0}
            aria-label={weaponDef ? `${weaponDef.name} (F)` : isEn ? 'Attack (F)' : 'Saldır (F)'}
            title={weaponDef ? `${weaponDef.name} (F)` : isEn ? 'Attack (F)' : 'Saldır (F)'}
            style={{
              left: `${attackGeom.r.left}px`,
              top: `${attackGeom.r.top}px`,
              width: `${attackGeom.r.w}px`,
              height: `${attackGeom.r.h}px`,
              transform: `translate(${attackGeom.t.dx}px, ${attackGeom.t.dy}px) scale(${attackGeom.t.scale})`,
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-shadow duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-red-400 cursor-pointer ${
              !isEditingLayout && attackCooldownPct > 0
                ? 'bg-slate-900/65 border-red-400/25 text-slate-400'
                : 'bg-red-600/90 border-red-300/60 text-white hover:bg-red-500'
            } ${editRingClass('attack')}`}
          >
            {!weaponDef || weaponDef.kind === 'MELEE' ? (
              <Sword className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            ) : (
              <Crosshair className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            )}
            <span
              className={`${
                compact ? 'text-[9px]' : 'text-[10px]'
              } font-semibold tracking-tight whitespace-nowrap`}
            >
              {isEn ? 'Attack' : 'Saldır'}
            </span>
          </button>
        )}

        {/* Top-right secondary button: Hazine Radarı */}
        <button
          type="button"
          onPointerDown={
            isEditingLayout
              ? makeDragHandlers('radar').onPointerDown
              : (e) => {
                  e.preventDefault();
                  onRadar();
                }
          }
          onPointerMove={makeDragHandlers('radar').onPointerMove}
          onPointerUp={makeDragHandlers('radar').onPointerUp}
          onPointerCancel={makeDragHandlers('radar').onPointerCancel}
          disabled={!isEditingLayout && radarCooldownPct > 0}
          aria-label={isEn ? 'Treasure Radar (R)' : 'Hazine Radarı (R)'}
          title={isEn ? 'Treasure Radar (R)' : 'Hazine Radarı (R)'}
          style={{
            left: `${radarGeom.r.left}px`,
            top: `${radarGeom.r.top}px`,
            width: `${radarGeom.r.w}px`,
            height: `${radarGeom.r.h}px`,
            transform: `translate(${radarGeom.t.dx}px, ${radarGeom.t.dy}px) scale(${radarGeom.t.scale})`,
          }}
          className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-shadow duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
            !isEditingLayout && radarCooldownPct > 0
              ? 'bg-slate-900/60 border-white/15 text-slate-400'
              : 'bg-[#0F2936]/90 border-sky-300/45 text-sky-200 hover:bg-[#153849]'
          } ${editRingClass('radar')}`}
        >
          <Compass className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          <span
            className={`${
              compact ? 'text-[9px]' : 'text-[10px]'
            } font-semibold tracking-tight whitespace-nowrap`}
          >
            Radar
          </span>
        </button>

        {/* Contextual Cave / Arena / Altar Interact button OR Tekneye Bin / İn */}
        {!isEditingLayout && interactLabel && onInteract ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onInteract();
            }}
            aria-label={`${interactLabel} (E)`}
            title={`${interactLabel} (E)`}
            style={{
              left: `${boatGeom.r.left}px`,
              top: `${boatGeom.r.top}px`,
              width: `${boatGeom.r.w}px`,
              height: `${boatGeom.r.h}px`,
              transform: `translate(${boatGeom.t.dx}px, ${boatGeom.t.dy}px) scale(${boatGeom.t.scale})`,
            }}
            className="pointer-events-auto absolute rounded-full border bg-purple-600/95 border-purple-200/70 text-white hover:bg-purple-500 flex flex-col items-center justify-center gap-0.5 shadow-lg transition-shadow duration-100 active:scale-95 cursor-pointer"
          >
            <DoorOpen className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            <span
              className={`${
                compact ? 'text-[8px]' : 'text-[9px]'
              } font-semibold tracking-tight whitespace-nowrap max-w-[3.4rem] truncate`}
            >
              {interactLabel}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={
              isEditingLayout
                ? makeDragHandlers('boatOrInteract').onPointerDown
                : (e) => {
                    e.preventDefault();
                    if (boatActionEnabled) onToggleBoat();
                  }
            }
            onPointerMove={makeDragHandlers('boatOrInteract').onPointerMove}
            onPointerUp={makeDragHandlers('boatOrInteract').onPointerUp}
            onPointerCancel={makeDragHandlers('boatOrInteract').onPointerCancel}
            disabled={!isEditingLayout && !boatActionEnabled}
            aria-label={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
            title={isSailing ? 'Kıyıya İn (E)' : 'Tekneye Bin (E)'}
            style={{
              left: `${boatGeom.r.left}px`,
              top: `${boatGeom.r.top}px`,
              width: `${boatGeom.r.w}px`,
              height: `${boatGeom.r.h}px`,
              transform: `translate(${boatGeom.t.dx}px, ${boatGeom.t.dy}px) scale(${boatGeom.t.scale})`,
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-lg transition-shadow duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 ${
              isEditingLayout || boatActionEnabled
                ? 'bg-emerald-600/90 border-emerald-300/60 text-white hover:bg-emerald-500 cursor-pointer'
                : 'bg-slate-900/55 border-white/15 text-slate-400 cursor-not-allowed'
            } ${editRingClass('boatOrInteract')}`}
          >
            {isSailing ? (
              <Anchor className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            ) : (
              <Ship className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            )}
            <span
              className={`${
                compact ? 'text-[9px]' : 'text-[10px]'
              } font-semibold tracking-tight whitespace-nowrap`}
            >
              {isEditingLayout
                ? isEn
                  ? 'Ship/Act'
                  : 'Tekne/E'
                : isSailing
                ? isEn
                  ? 'Land'
                  : 'İn'
                : isEn
                ? 'Ship'
                : 'Tekne'}
            </span>
          </button>
        )}

        {/* Bottom-right primary large button */}
        <button
          type="button"
          onPointerDown={
            isEditingLayout
              ? makeDragHandlers('digOrFire').onPointerDown
              : (e) => {
                  e.preventDefault();
                  if (!primaryEnabled) return;
                  if (isSailing) onFireCannons();
                  else onDig();
                }
          }
          onPointerMove={makeDragHandlers('digOrFire').onPointerMove}
          onPointerUp={makeDragHandlers('digOrFire').onPointerUp}
          onPointerCancel={makeDragHandlers('digOrFire').onPointerCancel}
          disabled={!isEditingLayout && !primaryEnabled}
          aria-label={isSailing ? 'Yan Topları Ateşle (Boşluk)' : 'Kazı Yap (Boşluk)'}
          title={isSailing ? 'Yan Topları Ateşle (Boşluk)' : 'Kazı Yap (Boşluk)'}
          style={{
            left: `${digGeom.r.left}px`,
            top: `${digGeom.r.top}px`,
            width: `${digGeom.r.w}px`,
            height: `${digGeom.r.h}px`,
            transform: `translate(${digGeom.t.dx}px, ${digGeom.t.dy}px) scale(${digGeom.t.scale})`,
          }}
          className={`pointer-events-auto absolute rounded-full border-2 flex flex-col items-center justify-center shadow-xl transition-shadow duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-300 ${
            compact ? 'gap-0.5' : 'gap-1'
          } ${
            isEditingLayout
              ? 'bg-amber-500 border-amber-200 text-slate-950'
              : isSailing
              ? primaryCooldown === 0
                ? 'bg-red-500 border-amber-200 text-white hover:bg-red-400 cursor-pointer'
                : 'bg-slate-900/65 border-red-400/30 text-slate-300 cursor-not-allowed'
              : canDig
              ? 'bg-amber-500 border-amber-200 text-slate-950 hover:bg-amber-400 cursor-pointer'
              : 'bg-slate-900/60 border-white/15 text-slate-400 cursor-not-allowed'
          } ${editRingClass('digOrFire')}`}
        >
          {isSailing ? (
            <Crosshair className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
          ) : (
            <Pickaxe className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
          )}
          <span
            className={`${
              compact ? 'text-[11px]' : 'text-xs'
            } font-bold tracking-tight whitespace-nowrap`}
          >
            {isSailing ? (isEn ? 'Fire' : 'Top At') : isEn ? 'Dig' : 'Kazı Yap'}
          </span>
        </button>
      </div>
    </div>
  );
};
