import React, { useEffect, useRef } from 'react';
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
import {
  ActionButtonKey,
  COMPACT_ACTION_CONTAINER,
  COMPACT_ACTION_RECTS,
  FULL_ACTION_CONTAINER,
  FULL_ACTION_RECTS,
  ResolvedButtonGeom,
} from '../utils/hudLayout';

export type ActionControlsDisplayMode = 'TOUCH' | 'DESKTOP' | 'HIDDEN';

const COMPACT_CONTAINER = COMPACT_ACTION_CONTAINER;
const FULL_CONTAINER = FULL_ACTION_CONTAINER;
const COMPACT_RECTS = COMPACT_ACTION_RECTS;
const FULL_RECTS = FULL_ACTION_RECTS;

export function clampActionButtonTransform(
  id: ActionButtonKey,
  raw: TouchButtonTransform | undefined,
  compact: boolean
): { dx: number; dy: number; scale: number } {
  const vw =
    typeof window !== 'undefined' ? window.visualViewport?.width ?? window.innerWidth : 800;
  const vh =
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 600;
  const container = compact ? COMPACT_CONTAINER : FULL_CONTAINER;
  const rect = compact ? COMPACT_RECTS[id] : FULL_RECTS[id];
  const scale = Math.max(0.75, Math.min(1.35, raw?.scale ?? 1));
  const halfExtraW = (rect.w * scale - rect.w) / 2;
  const halfExtraH = (rect.h * scale - rect.h) / 2;

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
  keyLabels?: {
    digOrFire?: string;
    attack?: string;
    boat?: string;
    radar?: string;
    ability?: string;
    fish?: string;
    stance?: string;
    repair?: string;
  };
  canFish?: boolean;
  isFishing?: boolean;
  fishingBite?: boolean;
  repairKits?: number;
  armyStance?: ArmyStance;
  hasSoldiers?: boolean;
  interactLabel?: string | null;
  touchLayout?: TouchLayoutConfig;
  resolvedContainer?: { w: number; h: number; pad: number };
  resolvedButtons?: Record<ActionButtonKey, ResolvedButtonGeom>;
  radarToastPlacement?: {
    mode: 'ABOVE' | 'LEFT';
    top: number;
    right: number;
    maxWidth: number;
  };
  desktopMaxWidth?: number;
  isEditingLayout?: boolean;
  selectedButtonId?: TouchButtonId | null;
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
  onDragResolve?: (id: TouchButtonId, candidate: TouchButtonTransform) => TouchButtonTransform;
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

const COOLDOWN_CIRCUMFERENCE = 2 * Math.PI * 44;

const CooldownRing: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
  if (pct <= 0.01) return null;
  const clamped = Math.max(0, Math.min(1, pct));
  const offset = COOLDOWN_CIRCUMFERENCE * (1 - clamped);
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full -rotate-90"
    >
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={COOLDOWN_CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
    </svg>
  );
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
  keyLabels,
  canFish = false,
  isFishing = false,
  fishingBite = false,
  repairKits = 0,
  armyStance = 'CHARGE',
  hasSoldiers = false,
  interactLabel = null,
  touchLayout,
  resolvedContainer,
  resolvedButtons,
  radarToastPlacement,
  desktopMaxWidth,
  isEditingLayout = false,
  selectedButtonId = null,
  onSelectButton,
  onUpdateButtonTransform,
  onDragResolve,
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
    opacity: number;
  } | null>(null);

  useEffect(() => {
    const clearDrag = () => {
      dragStateRef.current = null;
    };
    window.addEventListener('blur', clearDrag);
    return () => window.removeEventListener('blur', clearDrag);
  }, []);

  const radarToastContent = showRadarStatus && lastRadar && (
    <div
      className={`px-3 py-1.5 rounded-xl bg-[#061017]/90 border text-xs font-medium flex items-center gap-2 shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-opacity duration-150 max-w-[calc(100vw-1.5rem)] ${
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
    const kStance = keyLabels?.stance ?? 'V';
    const kRepair = keyLabels?.repair ?? 'H';
    const kFish = keyLabels?.fish ?? 'G';
    const kAbility = keyLabels?.ability ?? abilityKeyLabel;
    const kAttack = keyLabels?.attack ?? 'F';
    const kRadar = keyLabels?.radar ?? 'R';
    const kBoat = keyLabels?.boat ?? 'E';
    const kDig = keyLabels?.digOrFire ?? (isEn ? 'Space' : 'Boşluk');
    return (
      <div
        style={desktopMaxWidth ? { maxWidth: `${desktopMaxWidth}px` } : undefined}
        className="pointer-events-none relative flex flex-col items-end select-none shrink-0"
      >
        {radarToastContent && (
          <div className="absolute bottom-full right-0 mb-2 z-30">{radarToastContent}</div>
        )}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end rounded-xl bg-[#061017]/84 border border-white/10 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-white/[0.07] shadow-[0_12px_30px_rgba(0,0,0,0.5)] overflow-hidden">
          {onCycleStance && hasSoldiers && !isSailing && (
            <button
              type="button"
              onClick={onCycleStance}
              title={isEn ? `Cycle Army Stance (${kStance})` : `Ordu Düzenini Değiştir (${kStance})`}
              className="h-9 px-2.5 hover:bg-white/[0.06] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
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
              <kbd className="ui-keycap">{kStance}</kbd>
            </button>
          )}

          {onUseRepairKit && repairKits > 0 && (
            <button
              type="button"
              onClick={onUseRepairKit}
              title={isEn ? `Use Repair Kit (${kRepair})` : `Tamir Kiti Kullan (${kRepair})`}
              className="h-9 px-2.5 hover:bg-white/[0.06] text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="font-mono-num">{repairKits}</span>
              <kbd className="ui-keycap">{kRepair}</kbd>
            </button>
          )}

          {onFish && (canFish || isFishing) && (
            <button
              type="button"
              onClick={onFish}
              title={isEn ? `Cast / Reel Fishing Line (${kFish})` : `Olta At / Çek (${kFish})`}
              className={`h-9 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                fishingBite
                  ? 'bg-amber-400 text-slate-950'
                  : isFishing
                  ? 'bg-sky-400/20 text-sky-200'
                  : 'hover:bg-white/[0.06] text-sky-300'
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
                    ? 'Waiting'
                    : 'Bekle'
                  : isEn
                  ? 'Fish'
                  : 'Balık'}
              </span>
              <kbd className="ui-keycap">{kFish}</kbd>
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
                ? `Tactical War Cry (${kAbility})`
                : `Savaş Emri / Kalkan (${kAbility})`
            }
            className={`relative overflow-hidden h-9 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              abilityCooldownPct > 0
                ? 'text-slate-500 cursor-not-allowed'
                : 'hover:bg-white/[0.06] text-slate-200 cursor-pointer'
            }`}
          >
            <Zap
              className={`w-3.5 h-3.5 ${
                abilityCooldownPct > 0 ? 'text-slate-500' : 'text-indigo-400'
              }`}
            />
            <span>{isEn ? 'Order' : 'Emir'}</span>
            <kbd className="ui-keycap">{kAbility}</kbd>
            {abilityCooldownPct > 0 && (
              <span
                className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-indigo-400"
                style={{ width: `${Math.round((1 - abilityCooldownPct) * 100)}%` }}
              />
            )}
          </button>

          {!isSailing && weaponDef && (
            <button
              type="button"
              onClick={() => {
                if (attackCooldownPct === 0) onAttackLand();
              }}
              disabled={attackCooldownPct > 0}
              title={`${weaponDef.name} (${kAttack})`}
              className={`relative overflow-hidden h-9 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                attackCooldownPct > 0
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'hover:bg-red-500/15 text-red-300 cursor-pointer'
              }`}
            >
              {weaponDef.kind === 'MELEE' ? (
                <Sword className="w-3.5 h-3.5" />
              ) : (
                <Crosshair className="w-3.5 h-3.5" />
              )}
              <span>{isEn ? 'Attack' : 'Saldır'}</span>
              <kbd className="ui-keycap">{kAttack}</kbd>
              {attackCooldownPct > 0 && (
                <span
                  className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-red-400"
                  style={{ width: `${Math.round((1 - attackCooldownPct) * 100)}%` }}
                />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onRadar}
            disabled={radarCooldownPct > 0}
            title={isEn ? `Treasure Radar (${kRadar})` : `Hazine Radarı (${kRadar})`}
            className={`relative overflow-hidden h-9 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              radarCooldownPct > 0
                ? 'text-slate-500 cursor-not-allowed'
                : 'hover:bg-white/[0.06] text-sky-300 cursor-pointer'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isEn ? 'Radar' : 'Radar'}</span>
            <kbd className="ui-keycap">{kRadar}</kbd>
            {radarCooldownPct > 0 && (
              <span
                className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-sky-400"
                style={{ width: `${Math.round((1 - radarCooldownPct) * 100)}%` }}
              />
            )}
          </button>

          {interactLabel && onInteract ? (
            <button
              type="button"
              onClick={onInteract}
              title={`${interactLabel} (${kBoat})`}
              className="h-9 px-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{interactLabel}</span>
              <kbd className="ui-keycap">{kBoat}</kbd>
            </button>
          ) : (
            boatActionEnabled && (
              <button
                type="button"
                onClick={onToggleBoat}
                title={
                  isSailing
                    ? isEn
                      ? `Disembark (${kBoat})`
                      : `Kıyıya İn (${kBoat})`
                    : isEn
                    ? `Board Ship (${kBoat})`
                    : `Tekneye Bin (${kBoat})`
                }
                className="h-9 px-2.5 hover:bg-emerald-500/15 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
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
                <kbd className="ui-keycap">{kBoat}</kbd>
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
                  ? `Fire Broadsides (${kDig})`
                  : `Yan Topları Ateşle (${kDig})`
                : isEn
                ? `Dig Sand (${kDig})`
                : `Kazı Yap (${kDig})`
            }
            className={`relative overflow-hidden h-9 px-3.5 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isSailing
                ? primaryCooldown === 0
                  ? 'bg-red-500 hover:bg-red-400 text-white cursor-pointer'
                  : 'text-slate-500 cursor-not-allowed'
                : canDig && digCooldownPct === 0
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                : 'text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSailing ? <Crosshair className="w-3.5 h-3.5" /> : <Pickaxe className="w-3.5 h-3.5" />}
            <span>
              {isSailing ? (isEn ? 'Fire' : 'Top At') : isEn ? 'Dig' : 'Kazı Yap'}
            </span>
            <kbd
              className={
                primaryEnabled
                  ? 'font-mono-num text-[10px] px-1 py-0.5 rounded bg-black/20'
                  : 'ui-keycap'
              }
            >
              {kDig}
            </kbd>
            {primaryCooldown > 0 && (
              <span
                className={`pointer-events-none absolute bottom-0 left-0 h-[2px] ${
                  isSailing ? 'bg-red-400' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.round((1 - primaryCooldown) * 100)}%` }}
              />
            )}
          </button>
        </div>
      </div>
    );
  }

  // TOUCH mode (or LAYOUT_EDIT preview)
  const container = resolvedContainer ?? (compact ? COMPACT_CONTAINER : FULL_CONTAINER);
  const rects = compact ? COMPACT_RECTS : FULL_RECTS;

  const getBtnGeom = (id: ActionButtonKey) => {
    const resolved = resolvedButtons?.[id];
    const fallbackOpacity = Math.max(0.25, Math.min(1, touchLayout?.[id]?.opacity ?? 1));
    if (resolved) {
      return {
        r: resolved.rect,
        t: { dx: resolved.dx, dy: resolved.dy, scale: resolved.scale, opacity: resolved.opacity },
      };
    }
    const r = rects[id];
    const t = clampActionButtonTransform(id, touchLayout?.[id], compact);
    return { r, t: { ...t, opacity: fallbackOpacity } };
  };

  const btnDisplayOpacity = (rawOpacity: number) =>
    isEditingLayout ? Math.max(0.35, rawOpacity) : rawOpacity;

  const makeDragHandlers = (id: ActionButtonKey) => {
    if (!isEditingLayout) return {};
    const { t } = getBtnGeom(id);
    const clearIfMatch = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (dragStateRef.current?.pointerId === e.pointerId) {
        dragStateRef.current = null;
      }
    };
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture failure
        }
        onSelectButton?.(id);
        dragStateRef.current = {
          id,
          pointerId: e.pointerId,
          pointerX: e.clientX,
          pointerY: e.clientY,
          startDx: t.dx,
          startDy: t.dy,
          scale: t.scale,
          opacity: t.opacity,
        };
      },
      onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
        const nextDx = drag.startDx + (e.clientX - drag.pointerX);
        const nextDy = drag.startDy + (e.clientY - drag.pointerY);
        const candidate: TouchButtonTransform = {
          dx: nextDx,
          dy: nextDy,
          scale: drag.scale,
          opacity: drag.opacity,
        };
        const resolved = onDragResolve
          ? onDragResolve(id, candidate)
          : { ...clampActionButtonTransform(id, candidate, compact), opacity: drag.opacity };
        onUpdateButtonTransform?.(id, resolved);
      },
      onPointerUp: clearIfMatch,
      onPointerCancel: clearIfMatch,
      onLostPointerCapture: clearIfMatch,
    };
  };

  const editRingClass = (id: ActionButtonKey) =>
    isEditingLayout
      ? selectedButtonId === id
        ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950/60 cursor-move'
        : 'outline-dashed outline-2 outline-sky-300/75 cursor-move'
      : '';

  const showRepairBtn = isEditingLayout || Boolean(onUseRepairKit && repairKits > 0);
  const showStanceBtn = isEditingLayout || Boolean(onCycleStance && hasSoldiers && !isSailing);
  const showFishBtn = isEditingLayout || Boolean(onFish && (canFish || isFishing));
  const showAttackBtn = isEditingLayout || (!isSailing && Boolean(weaponDef));

  // Compute Radar toast placement cleanly above all resolved buttons (or to their left near TopRightHud)
  const visibleKeys: ActionButtonKey[] = ['ability', 'radar', 'boatOrInteract', 'digOrFire'];
  if (showRepairBtn) visibleKeys.push('repair');
  if (showStanceBtn) visibleKeys.push('stance');
  if (showFishBtn) visibleKeys.push('fish');
  if (showAttackBtn) visibleKeys.push('attack');

  let minVisibleTop = 0;
  for (const key of visibleKeys) {
    const { r, t } = getBtnGeom(key);
    const halfExtraH = (r.h * t.scale - r.h) / 2;
    const btnTop = r.top + t.dy - halfExtraH;
    if (btnTop < minVisibleTop) minVisibleTop = btnTop;
  }

  const vh =
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 600;
  const containerScreenTop = vh - container.pad - container.h;
  const fallbackToastTop = minVisibleTop - 40;
  const fallbackFitsAbove = containerScreenTop + fallbackToastTop >= 52;
  const toastTopStyle = radarToastPlacement
    ? {
        top: `${radarToastPlacement.top}px`,
        right: `${radarToastPlacement.right}px`,
        maxWidth: `${radarToastPlacement.maxWidth}px`,
      }
    : fallbackFitsAbove
    ? { top: `${fallbackToastTop}px`, right: 0 }
    : { top: '4px', right: `${container.w + 10}px` };

  const repairGeom = getBtnGeom('repair');
  const stanceGeom = getBtnGeom('stance');
  const fishGeom = getBtnGeom('fish');
  const abilityGeom = getBtnGeom('ability');
  const attackGeom = getBtnGeom('attack');
  const radarGeom = getBtnGeom('radar');
  const boatGeom = getBtnGeom('boatOrInteract');
  const digGeom = getBtnGeom('digOrFire');

  return (
    <div className="pointer-events-none relative flex flex-col items-end select-none shrink-0 touch-none">
      {radarToastContent && (
        <div style={toastTopStyle} className="absolute z-30 pointer-events-none">
          {radarToastContent}
        </div>
      )}

      <div
        style={{ width: `${container.w}px`, height: `${container.h}px` }}
        className="pointer-events-none relative touch-none"
      >
        {/* Contextual Repair Kit button */}
        {showRepairBtn && (
          <button
            type="button"
            onPointerDown={
              isEditingLayout
                ? makeDragHandlers('repair').onPointerDown
                : (e) => {
                    e.preventDefault();
                    if (repairKits > 0) onUseRepairKit?.();
                  }
            }
            onPointerMove={makeDragHandlers('repair').onPointerMove}
            onPointerUp={makeDragHandlers('repair').onPointerUp}
            onPointerCancel={makeDragHandlers('repair').onPointerCancel}
            aria-label={isEn ? 'Use Repair Kit (H)' : 'Tamir Kiti Kullan (H)'}
            title={isEn ? 'Use Repair Kit (H)' : 'Tamir Kiti Kullan (H)'}
            style={{
              left: `${repairGeom.r.left}px`,
              top: `${repairGeom.r.top}px`,
              width: `${repairGeom.r.w}px`,
              height: `${repairGeom.r.h}px`,
              transform: `translate(${repairGeom.t.dx}px, ${repairGeom.t.dy}px) scale(${repairGeom.t.scale})`,
              opacity: btnDisplayOpacity(repairGeom.t.opacity),
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition-transform duration-100 active:scale-[0.92] cursor-pointer ${
              repairKits > 0
                ? 'bg-[#061017]/86 border-emerald-400/50 text-emerald-300 hover:bg-[#0D212C]'
                : 'bg-[#061017]/78 border-white/12 text-slate-500'
            } ${editRingClass('repair')}`}
          >
            <Wrench className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className="text-[8px] font-bold font-mono-num whitespace-nowrap">
              {isEn ? `Kit ${repairKits}` : `Tamir ${repairKits}`}
            </span>
          </button>
        )}

        {/* Contextual Army Stance button */}
        {showStanceBtn && (
          <button
            type="button"
            onPointerDown={
              isEditingLayout
                ? makeDragHandlers('stance').onPointerDown
                : (e) => {
                    e.preventDefault();
                    onCycleStance?.();
                  }
            }
            onPointerMove={makeDragHandlers('stance').onPointerMove}
            onPointerUp={makeDragHandlers('stance').onPointerUp}
            onPointerCancel={makeDragHandlers('stance').onPointerCancel}
            aria-label={isEn ? 'Cycle Army Stance (V)' : 'Ordu Düzenini Değiştir (V)'}
            title={isEn ? 'Cycle Army Stance (V)' : 'Ordu Düzenini Değiştir (V)'}
            style={{
              left: `${stanceGeom.r.left}px`,
              top: `${stanceGeom.r.top}px`,
              width: `${stanceGeom.r.w}px`,
              height: `${stanceGeom.r.h}px`,
              transform: `translate(${stanceGeom.t.dx}px, ${stanceGeom.t.dy}px) scale(${stanceGeom.t.scale})`,
              opacity: btnDisplayOpacity(stanceGeom.t.opacity),
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition-transform duration-100 active:scale-[0.92] cursor-pointer bg-[#061017]/86 hover:bg-[#0D212C] ${
              armyStance === 'FOLLOW'
                ? 'border-sky-400/55 text-sky-300'
                : armyStance === 'DEFEND'
                ? 'border-emerald-400/55 text-emerald-300'
                : 'border-rose-400/55 text-rose-300'
            } ${editRingClass('stance')}`}
          >
            <Shield className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className="text-[8px] font-semibold whitespace-nowrap">
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
          </button>
        )}

        {/* Contextual Fishing button */}
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
              opacity: btnDisplayOpacity(fishGeom.t.opacity),
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition-transform duration-100 active:scale-[0.92] cursor-pointer ${
              fishingBite
                ? 'bg-amber-400 border-amber-200 text-slate-950'
                : isFishing
                ? 'bg-sky-400/25 border-sky-300 text-sky-100'
                : 'bg-[#061017]/86 border-sky-400/45 text-sky-300 hover:bg-[#0D212C]'
            } ${editRingClass('fish')}`}
          >
            <Fish className="w-4 h-4" />
            <span className="text-[8px] font-semibold whitespace-nowrap">
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
            opacity: btnDisplayOpacity(abilityGeom.t.opacity),
          }}
          className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition-transform duration-100 active:scale-[0.92] cursor-pointer ${
            !isEditingLayout && abilityCooldownPct > 0
              ? 'bg-[#061017]/75 border-white/10 text-slate-500'
              : 'bg-[#061017]/86 border-indigo-400/50 text-indigo-300 hover:bg-[#0D212C]'
          } ${editRingClass('ability')}`}
        >
          {!isEditingLayout && <CooldownRing pct={abilityCooldownPct} color="#818CF8" />}
          <Zap className={compact ? 'w-3.5 h-3.5 relative z-10' : 'w-4 h-4 relative z-10'} />
          <span
            className={`relative z-10 ${
              compact ? 'text-[8px]' : 'text-[9px]'
            } font-semibold tracking-tight whitespace-nowrap`}
          >
            {isEn ? 'Order' : 'Emir'}
          </span>
        </button>

        {/* Contextual Land Attack button */}
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
              opacity: btnDisplayOpacity(attackGeom.t.opacity),
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.48)] transition-transform duration-100 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-red-400 cursor-pointer ${
              !isEditingLayout && attackCooldownPct > 0
                ? 'bg-[#061017]/78 border-red-400/20 text-slate-500'
                : 'bg-[#1D0B10]/90 border-red-400/60 text-red-200 hover:bg-[#2B1018]'
            } ${editRingClass('attack')}`}
          >
            {!isEditingLayout && <CooldownRing pct={attackCooldownPct} color="#F87171" />}
            {!weaponDef || weaponDef.kind === 'MELEE' ? (
              <Sword className={compact ? 'w-4 h-4 relative z-10' : 'w-5 h-5 relative z-10'} />
            ) : (
              <Crosshair className={compact ? 'w-4 h-4 relative z-10' : 'w-5 h-5 relative z-10'} />
            )}
            <span
              className={`relative z-10 ${
                compact ? 'text-[9px]' : 'text-[10px]'
              } font-semibold tracking-tight whitespace-nowrap`}
            >
              {isEn ? 'Attack' : 'Saldır'}
            </span>
          </button>
        )}

        {/* Secondary button: Treasure Radar */}
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
            opacity: btnDisplayOpacity(radarGeom.t.opacity),
          }}
          className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.48)] transition-transform duration-100 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
            !isEditingLayout && radarCooldownPct > 0
              ? 'bg-[#061017]/78 border-white/10 text-slate-500'
              : 'bg-[#061017]/86 border-sky-400/45 text-sky-300 hover:bg-[#0D212C]'
          } ${editRingClass('radar')}`}
        >
          {!isEditingLayout && <CooldownRing pct={radarCooldownPct} color="#38BDF8" />}
          <Compass className={compact ? 'w-4 h-4 relative z-10' : 'w-5 h-5 relative z-10'} />
          <span
            className={`relative z-10 ${
              compact ? 'text-[9px]' : 'text-[10px]'
            } font-semibold tracking-tight whitespace-nowrap`}
          >
            Radar
          </span>
        </button>

        {/* Contextual Interact or Board/Disembark */}
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
              opacity: btnDisplayOpacity(boatGeom.t.opacity),
            }}
            className="pointer-events-auto absolute rounded-full border bg-[#16102A]/92 border-violet-400/65 text-violet-200 hover:bg-[#221740] flex flex-col items-center justify-center gap-0.5 shadow-[0_10px_26px_rgba(0,0,0,0.52)] transition-transform duration-100 active:scale-[0.92] cursor-pointer"
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
              opacity: btnDisplayOpacity(boatGeom.t.opacity),
            }}
            className={`pointer-events-auto absolute rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.48)] transition-transform duration-100 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-emerald-400 ${
              isEditingLayout || boatActionEnabled
                ? 'bg-[#061017]/86 border-emerald-400/55 text-emerald-300 hover:bg-[#0D212C] cursor-pointer'
                : 'bg-[#061017]/74 border-white/10 text-slate-500 cursor-not-allowed'
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

        {/* Primary Thumb Action Button (Exclusive solid fill emphasis) */}
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
            opacity: btnDisplayOpacity(digGeom.t.opacity),
          }}
          className={`pointer-events-auto absolute rounded-full border-2 flex flex-col items-center justify-center shadow-[0_14px_32px_rgba(0,0,0,0.58)] transition-transform duration-100 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-amber-300 ${
            compact ? 'gap-0.5' : 'gap-1'
          } ${
            isEditingLayout
              ? 'bg-amber-400 border-amber-200 text-slate-950'
              : isSailing
              ? primaryCooldown === 0
                ? 'bg-red-500 border-red-300 text-white hover:bg-red-400 cursor-pointer'
                : 'bg-[#061017]/86 border-red-400/25 text-slate-400 cursor-not-allowed'
              : canDig && digCooldownPct === 0
              ? 'bg-amber-400 border-amber-200 text-slate-950 hover:bg-amber-300 cursor-pointer'
              : 'bg-[#061017]/84 border-white/12 text-slate-500 cursor-not-allowed'
          } ${editRingClass('digOrFire')}`}
        >
          {!isEditingLayout && (
            <CooldownRing pct={primaryCooldown} color={isSailing ? '#F87171' : '#FBBF24'} />
          )}
          {isSailing ? (
            <Crosshair className={compact ? 'w-6 h-6 relative z-10' : 'w-7 h-7 relative z-10'} />
          ) : (
            <Pickaxe className={compact ? 'w-6 h-6 relative z-10' : 'w-7 h-7 relative z-10'} />
          )}
          <span
            className={`relative z-10 ${
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
