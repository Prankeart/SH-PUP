import React, { useEffect, useRef } from 'react';
import { ArrowLeftRight, Move, RotateCw } from 'lucide-react';
import { TouchButtonId, TouchButtonTransform, TouchLayoutConfig, WeaponId } from '../types/game';
import { WEAPONS } from '../engine/weapons';
import { ResolvedWeaponPanelGeom } from '../utils/hudLayout';

interface WeaponHudPanelProps {
  weaponSlots: WeaponId[];
  equippedWeapon: WeaponId | null;
  activeAmmo: number | null;
  activeMaxAmmo: number | null;
  isReloading: boolean;
  reloadProgress: number;
  isTouchMode: boolean;
  switchKeyLabel: string;
  reloadKeyLabel: string;
  language?: 'tr' | 'en';
  touchLayout?: TouchLayoutConfig;
  resolvedGeom?: ResolvedWeaponPanelGeom;
  isEditingLayout?: boolean;
  isSelected?: boolean;
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
  onDragResolve?: (id: TouchButtonId, candidate: TouchButtonTransform) => TouchButtonTransform;
  onSwitchWeapon: (dir: 1 | -1) => void;
  onSelectSlot: (index: number) => void;
  onReload: () => void;
}

export const WeaponSilhouette: React.FC<{
  weaponId: WeaponId;
  className?: string;
  style?: React.CSSProperties;
}> = ({ weaponId, className = 'w-12 h-5', style }) => {
  switch (weaponId) {
    case 'CUTLASS':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M8 14.5h7l2.5 3.5-2.5 2c-3-.4-5.2-1.8-7-3.5v-2zM17 11.5h4.5l1.5 5.5-4.5 1-1.5-6.5z" />
          <path d="M21 11.5C34 11 47 7.5 58 3c-2.5 5.5-9.5 10.5-20 12.2L22.5 16l-1.5-4.5z" />
          <rect x="6" y="12.5" width="4" height="3" rx="1" />
        </svg>
      );
    case 'OBSIDIAN_BLADE':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <rect x="5" y="10.5" width="9" height="3" rx="1" />
          <path d="M14 5.5h3v13h-3z" />
          <path d="M17 8.5l33-2 9 5.5-9 5.5-33-2v-7zm9 2.5l4 1-4 1v-2z" />
        </svg>
      );
    case 'SHADOW_SCYTHE':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M5 17.5L47 6l1 2.6L6 20.2z" />
          <path d="M44 5.5c8.5-3 15.5.2 17 8.5-4.5-4-9.5-4.8-16.5-2.5L44 5.5z" />
          <path d="M41 4.5l4.5-1.5 2 5.2-4.5 1.5z" />
        </svg>
      );
    case 'PISTOL':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M14 13.5l5 8.5h6l-3.5-8.5H49v-4H25l-2-2.5-5 1.5v5z" />
          <rect x="28" y="6.5" width="23" height="3.2" rx="1" />
          <path d="M22 13.5c0 2.5 2 3.8 4.2 3.8h2v-1.8h-2c-1.1 0-2-.7-2-2h-2.2z" />
        </svg>
      );
    case 'DUAL_PISTOL':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <g opacity="0.58" transform="translate(6,-3)">
            <path d="M15 11.5l3.5 6.5h4.5l-2.5-6.5H46v-3.2H22l-1.5-2-4 1.2v4z" />
            <rect x="24" y="6" width="23" height="2.6" rx="0.8" />
          </g>
          <path d="M11 14l4.5 7.5h5.5l-3-7.5H47v-3.6H21l-1.8-2.2-4.5 1.4v4.4z" />
          <rect x="23" y="7.5" width="25" height="3" rx="1" />
        </svg>
      );
    case 'MUSKET':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M3 13l9-1.5 6-2.5h24v3.8H21l-4 3-11 3.5-3-6.3z" />
          <rect x="22" y="6.2" width="38" height="2.8" rx="0.8" />
          <path d="M22 12.8c0 2 1.6 3.2 3.6 3.2h1.6v-1.5h-1.6c-1 0-1.8-.6-1.8-1.7H22z" />
        </svg>
      );
    case 'CRYSTAL_BLUNDERBUSS':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M4 14l9-1.8 6-3h20v4.4H22l-4 3-11 3.4L4 14z" />
          <path d="M22 6.5h28l8-2.2v7.4l-8-2.2H22V6.5z" />
          <polygon points="27,7 32,4.5 37,7 32,9.5" opacity="0.7" />
        </svg>
      );
    case 'ANCIENT_HARPOON':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M4 13.5l8-1.5 6-2.5h23v3.5H22l-4 2.5-11 3.2-3-5.2z" />
          <rect x="20" y="6.8" width="28" height="2.6" rx="0.8" />
          <path d="M48 8.1h9l-4-3.6 9 3.6-9 3.6 4-3.6z" />
          <rect x="29" y="4.2" width="10" height="2" rx="0.8" />
        </svg>
      );
    case 'MAGMA_CANNON':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M9 14l4.5 7.5h5.8l-3-7.5h15v-3.5H14l-5 3.5z" />
          <rect x="17" y="4.5" width="37" height="7.5" rx="2" />
          <rect x="52" y="3.5" width="5" height="9.5" rx="1" />
          <rect x="36" y="12" width="4" height="5" rx="1" />
        </svg>
      );
    case 'STORM_TRIDENT':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <rect x="3" y="10.8" width="42" height="2.4" rx="1" />
          <path d="M43 6h12l-3-2.5 9 2.5-9 2.5 3-2.5H45v12h10l-3-2.5 9 2.5-9 2.5 3-2.5H43V6z" />
          <path d="M45 10.8h12l-3-2.2 8 3.4-8 3.4 3-2.2H45v-2.4z" />
        </svg>
      );
    case 'PHANTOM_REPEATER':
      return (
        <svg viewBox="0 0 64 24" fill="currentColor" className={className} style={style} aria-hidden="true">
          <path d="M5 13.5l9-1.5 6-2.5h28v3H22l-4 2.5-10 3-3-4.5z" />
          <rect x="22" y="6.8" width="34" height="2.4" rx="0.8" />
          <path d="M46 2c-5 2.5-7 5.5-7 8.5s2 6 7 8.5l2-1.5c-4-2-5.5-4.5-5.5-7s1.5-5 5.5-7L46 2z" />
          <rect x="28" y="4.2" width="11" height="2" rx="0.8" />
        </svg>
      );
    default:
      return null;
  }
};

export const WeaponHudPanel: React.FC<WeaponHudPanelProps> = ({
  weaponSlots,
  equippedWeapon,
  activeAmmo,
  activeMaxAmmo,
  isReloading,
  reloadProgress,
  isTouchMode,
  switchKeyLabel,
  reloadKeyLabel,
  language = 'tr',
  touchLayout,
  resolvedGeom,
  isEditingLayout = false,
  isSelected = false,
  onSelectButton,
  onUpdateButtonTransform,
  onDragResolve,
  onSwitchWeapon,
  onSelectSlot,
  onReload,
}) => {
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedOnSwapBar: boolean;
  } | null>(null);
  const editDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startDx: number;
    startDy: number;
    scale: number;
    opacity: number;
  } | null>(null);

  useEffect(() => {
    const clearGestures = () => {
      gestureRef.current = null;
      editDragRef.current = null;
    };
    window.addEventListener('blur', clearGestures);
    return () => window.removeEventListener('blur', clearGestures);
  }, []);

  if (!equippedWeapon || !WEAPONS[equippedWeapon] || weaponSlots.length === 0) {
    return null;
  }

  const isEn = language === 'en';
  const def = WEAPONS[equippedWeapon];
  const isRanged = def.kind === 'RANGED' && Boolean(activeMaxAmmo && activeMaxAmmo > 0);
  const currentAmmo = activeAmmo ?? activeMaxAmmo ?? 0;
  const maxAmmo = activeMaxAmmo ?? def.magSize ?? 0;
  const isEmpty = isRanged && currentAmmo <= 0 && !isReloading;
  const needsReload = isRanged && currentAmmo < maxAmmo && !isReloading;
  const hasMultiple = weaponSlots.length > 1;
  const activeIdx = Math.max(0, weaponSlots.indexOf(equippedWeapon));
  const otherIdx = hasMultiple ? (activeIdx + 1) % weaponSlots.length : -1;
  const otherWeaponId = otherIdx >= 0 ? weaponSlots[otherIdx] : null;
  const otherDef = otherWeaponId ? WEAPONS[otherWeaponId] : null;
  const ammoRatio = isRanged && maxAmmo > 0 ? Math.max(0, Math.min(1, currentAmmo / maxAmmo)) : 1;

  const fallbackTransform = touchLayout?.weaponPanel;
  const dx = resolvedGeom?.dx ?? fallbackTransform?.dx ?? 0;
  const dy = resolvedGeom?.dy ?? fallbackTransform?.dy ?? 0;
  const scale = resolvedGeom?.scale ?? fallbackTransform?.scale ?? 1;
  const opacity = resolvedGeom?.opacity ?? fallbackTransform?.opacity ?? 1;
  const displayOpacity = isEditingLayout ? Math.max(0.35, opacity) : opacity;
  const baseW = resolvedGeom?.baseW ?? (isTouchMode ? 212 : 256);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingLayout) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure
      }
      onSelectButton?.('weaponPanel');
      editDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startDx: dx,
        startDy: dy,
        scale,
        opacity,
      };
      return;
    }
    const target = e.target as HTMLElement | null;
    const startedOnSwapBar = Boolean(target?.closest('[data-slot-control="true"]'));
    if (!startedOnSwapBar) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure
      }
    }
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startedOnSwapBar,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditingLayout || !editDragRef.current || editDragRef.current.pointerId !== e.pointerId) {
      return;
    }
    const nextDx = editDragRef.current.startDx + (e.clientX - editDragRef.current.startX);
    const nextDy = editDragRef.current.startDy + (e.clientY - editDragRef.current.startY);
    const candidate: TouchButtonTransform = {
      dx: nextDx,
      dy: nextDy,
      scale: editDragRef.current.scale,
      opacity: editDragRef.current.opacity,
    };
    const resolved = onDragResolve
      ? onDragResolve('weaponPanel', candidate)
      : candidate;
    onUpdateButtonTransform?.('weaponPanel', resolved);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingLayout) {
      if (editDragRef.current && editDragRef.current.pointerId === e.pointerId) {
        editDragRef.current = null;
      }
      return;
    }
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.pointerId !== e.pointerId) return;

    const moveDx = e.clientX - g.startX;
    const moveDy = e.clientY - g.startY;
    if (Math.abs(moveDx) >= 20 && Math.abs(moveDx) > Math.abs(moveDy) * 1.1) {
      if (hasMultiple) {
        onSwitchWeapon(moveDx > 0 ? 1 : -1);
      }
      return;
    }

    if (isTouchMode && isRanged && !g.startedOnSwapBar && Math.hypot(moveDx, moveDy) < 14) {
      onReload();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gestureRef.current && gestureRef.current.pointerId === e.pointerId) {
      gestureRef.current = null;
    }
    if (editDragRef.current && editDragRef.current.pointerId === e.pointerId) {
      editDragRef.current = null;
    }
  };

  const editFrameClass = isEditingLayout
    ? isSelected
      ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950/60 cursor-move'
      : 'outline-dashed outline-2 outline-sky-300/75 cursor-move'
    : '';

  const wrapperStyle: React.CSSProperties = {
    width: `${baseW}px`,
    transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
    transformOrigin: 'center center',
    opacity: displayOpacity,
  };

  // =========================================================================
  // MOBILE / TOUCH LAYOUT — Clean thumb-swipe & tap weapon strip
  // =========================================================================
  if (isTouchMode) {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        role="region"
        aria-label={isEn ? 'Equipped Weapon & Ammo' : 'Aktif Silah ve Mermi'}
        style={wrapperStyle}
        className={`relative pointer-events-auto touch-none select-none max-w-full rounded-xl backdrop-blur-md border transition-colors duration-100 shadow-[0_10px_28px_rgba(0,0,0,0.45)] ${
          isEmpty
            ? 'bg-[#1D0B10]/90 border-red-400/55'
            : isReloading
            ? 'bg-[#161308]/90 border-amber-400/45'
            : 'bg-[#061017]/84 border-white/10'
        } ${editFrameClass}`}
      >
        <div className="rounded-xl overflow-hidden">
          {hasMultiple && (
            <div className="flex items-center gap-1 px-2 pt-1.5">
              {weaponSlots.map((slotId, idx) => {
                const isAct = idx === activeIdx;
                return (
                  <span
                    key={slotId}
                    className="h-[2px] flex-1 rounded-full transition-opacity duration-150"
                    style={{
                      backgroundColor: isAct ? def.color : 'rgba(255,255,255,0.16)',
                      opacity: isAct ? 1 : 0.6,
                    }}
                  />
                );
              })}
            </div>
          )}

          <div
            className={`px-2.5 flex items-center justify-between gap-2 cursor-pointer active:opacity-80 ${
              hasMultiple ? 'pt-1 pb-1.5' : 'py-1.5'
            }`}
          >
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <WeaponSilhouette
                  weaponId={equippedWeapon}
                  className="w-11 h-[18px] shrink-0"
                  style={{ color: def.color }}
                />
                {isRanged && needsReload && (
                  <RotateCw
                    className={`w-3 h-3 shrink-0 ${
                      isEmpty ? 'text-red-400' : 'text-amber-300'
                    }`}
                  />
                )}
              </div>
              <span className="text-[11px] font-semibold text-slate-100 truncate leading-tight mt-0.5">
                {isEn ? def.nameEn : def.name}
              </span>
            </div>

            <div className="h-7 w-px bg-white/10 shrink-0" />

            <div className="shrink-0 flex flex-col items-end justify-center min-w-[48px]">
              {isRanged ? (
                isReloading ? (
                  <div className="flex items-center gap-1 text-amber-300">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    <span className="font-mono-num text-[11px] font-bold">
                      {Math.min(99, Math.max(1, Math.round(reloadProgress * 100)))}%
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-0.5 font-mono-num leading-none">
                    <span
                      className={`text-lg font-extrabold tracking-tight ${
                        isEmpty
                          ? 'text-red-400'
                          : currentAmmo <= Math.ceil(maxAmmo * 0.3)
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {currentAmmo}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      /{maxAmmo}
                    </span>
                  </div>
                )
              ) : (
                <span className="font-mono-num text-lg font-extrabold text-slate-100 leading-none">
                  ∞
                </span>
              )}
            </div>
          </div>

          <div className="h-[2px] w-full bg-white/[0.06] overflow-hidden">
            {isReloading ? (
              <div
                className="h-full bg-amber-400 transition-[width] duration-75"
                style={{ width: `${Math.max(8, Math.min(100, Math.round(reloadProgress * 100)))}%` }}
              />
            ) : (
              <div
                className="h-full transition-[width] duration-150"
                style={{
                  width: `${Math.round(ammoRatio * 100)}%`,
                  backgroundColor: isEmpty ? '#F87171' : def.color,
                }}
              />
            )}
          </div>

          {hasMultiple && otherDef && (
            <button
              type="button"
              data-slot-control="true"
              onClick={(e) => {
                if (isEditingLayout) return;
                e.stopPropagation();
                onSelectSlot(otherIdx);
              }}
              className="w-full h-6 px-2.5 bg-[#040B11]/60 hover:bg-white/[0.06] border-t border-white/[0.08] flex items-center justify-between gap-2 text-[10px] text-slate-300 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <ArrowLeftRight className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate font-medium text-slate-200">
                  {isEn ? otherDef.nameEn : otherDef.name}
                </span>
              </span>
              <span className="font-mono-num text-[10px] text-slate-400 shrink-0">
                {activeIdx + 1}/2
              </span>
            </button>
          )}
        </div>

        {isEditingLayout && (
          <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#061017]/95 border border-white/15 text-[9px] font-bold text-amber-300 whitespace-nowrap flex items-center gap-1">
            <Move className="w-2.5 h-2.5 text-amber-300" />
            {isEn ? 'Weapon Panel' : 'Silah Paneli'} · %{Math.round(scale * 100)}
          </span>
        )}
      </div>
    );
  }

  // =========================================================================
  // DESKTOP / TABLET WIDE LAYOUT — Minimalist Tactical Readout
  // =========================================================================
  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      role="region"
      aria-label={isEn ? 'Equipped Weapon & Ammo' : 'Aktif Silah ve Mermi'}
      style={wrapperStyle}
      className={`relative pointer-events-auto touch-none select-none rounded-xl backdrop-blur-md border transition-colors shadow-[0_12px_30px_rgba(0,0,0,0.48)] ${
        isEmpty
          ? 'bg-[#1D0B10]/90 border-red-400/55'
          : isReloading
          ? 'bg-[#161308]/90 border-amber-400/45'
          : 'bg-[#061017]/84 border-white/10'
      } ${editFrameClass}`}
    >
      <div className="rounded-xl overflow-hidden">
        <div
          onClick={(e) => {
            if (isEditingLayout || !isRanged) return;
            e.stopPropagation();
            onReload();
          }}
          title={
            isRanged && !isEditingLayout
              ? `${isEn ? 'Click or press' : 'Yenilemek için tıkla veya bas:'} [${reloadKeyLabel}]`
              : undefined
          }
          className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex flex-col items-start justify-center min-w-[70px]">
            {isRanged ? (
              isReloading ? (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="font-mono-num text-xs font-bold leading-none">
                    {Math.min(99, Math.max(1, Math.round(reloadProgress * 100)))}%
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 font-mono-num leading-none">
                    <span
                      className={`text-xl font-extrabold tracking-tight ${
                        isEmpty
                          ? 'text-red-400'
                          : currentAmmo <= Math.ceil(maxAmmo * 0.3)
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {currentAmmo}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      /{maxAmmo}
                    </span>
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-medium leading-none flex items-center gap-1 ${
                      isEmpty
                        ? 'text-red-300'
                        : needsReload
                        ? 'text-amber-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {needsReload ? `[${reloadKeyLabel}] ${isEn ? 'Reload' : 'Yenile'}` : `[${reloadKeyLabel}]`}
                  </span>
                </>
              )
            ) : (
              <>
                <span className="font-mono-num text-xl font-extrabold text-slate-100 leading-none">
                  ∞
                </span>
                <span className="mt-1 text-[10px] font-medium text-slate-400 leading-none">
                  {isEn ? 'Melee' : 'Yakın'}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col items-end justify-center min-w-0 flex-1">
            <WeaponSilhouette
              weaponId={equippedWeapon}
              className="w-14 h-[20px] shrink-0"
              style={{ color: def.color }}
            />
            <span className="text-[11px] font-semibold text-slate-100 truncate max-w-full mt-0.5 leading-tight">
              {isEn ? def.nameEn : def.name}
            </span>
          </div>
        </div>

        <div className="h-[2px] w-full bg-white/[0.06] overflow-hidden">
          {isReloading ? (
            <div
              className="h-full bg-amber-400 transition-[width] duration-75"
              style={{ width: `${Math.max(8, Math.min(100, Math.round(reloadProgress * 100)))}%` }}
            />
          ) : (
            <div
              className="h-full transition-[width] duration-150"
              style={{
                width: `${Math.round(ammoRatio * 100)}%`,
                backgroundColor: isEmpty ? '#F87171' : def.color,
              }}
            />
          )}
        </div>

        {hasMultiple && (
          <div className="bg-[#040B11]/60 border-t border-white/[0.08] divide-y divide-white/[0.05]">
            {weaponSlots.map((slotId, idx) => {
              const slotDef = WEAPONS[slotId];
              if (!slotDef) return null;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={slotId}
                  type="button"
                  data-slot-control="true"
                  onClick={(e) => {
                    if (isEditingLayout) return;
                    e.stopPropagation();
                    onSelectSlot(idx);
                  }}
                  className={`w-full px-2.5 py-1 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.07] text-white'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-mono-num text-[10px] font-bold w-3 text-center shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-medium truncate">
                      {isEn ? slotDef.nameEn : slotDef.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <WeaponSilhouette
                      weaponId={slotId}
                      className="w-7 h-[12px]"
                      style={{
                        color: isActive ? slotDef.color : 'currentColor',
                        opacity: isActive ? 0.95 : 0.4,
                      }}
                    />
                    {!isActive && (
                      <span className="font-mono-num text-[9px] text-slate-500">
                        [{switchKeyLabel}]
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isEditingLayout && (
        <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#061017]/95 border border-white/15 text-[9px] font-bold text-amber-300 whitespace-nowrap flex items-center gap-1">
          <Move className="w-2.5 h-2.5 text-amber-300" />
          {isEn ? 'Weapon Panel' : 'Silah Paneli'} · %{Math.round(scale * 100)}
        </span>
      )}
    </div>
  );
};

