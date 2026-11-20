import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import { TouchButtonId, TouchButtonTransform, TouchLayoutConfig, Vec2 } from '../types/game';
import { ResolvedJoystickGeom } from '../utils/hudLayout';

interface VirtualJoystickProps {
  mode: 'FIXED' | 'DYNAMIC';
  compact?: boolean;
  touchLayout?: TouchLayoutConfig;
  resolvedGeom?: ResolvedJoystickGeom;
  isEditingLayout?: boolean;
  isSelected?: boolean;
  language?: 'tr' | 'en';
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
  onDragResolve?: (id: TouchButtonId, candidate: TouchButtonTransform) => TouchButtonTransform;
  onChange: (vec: Vec2) => void;
}

const MAX_RADIUS = 44;

function clampJoystickTransform(
  raw: TouchButtonTransform | undefined,
  size: number,
  pad: number
): { dx: number; dy: number; scale: number } {
  const vw =
    typeof window !== 'undefined' ? window.visualViewport?.width ?? window.innerWidth : 800;
  const vh =
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 600;
  const scale = Math.max(0.75, Math.min(1.35, raw?.scale ?? 1));
  const scaledSize = size * scale;
  const halfExtra = (scaledSize - size) / 2;
  const minDx = 8 - pad + halfExtra;
  const maxDx = Math.max(minDx, vw - pad - size - 8 - halfExtra);
  const maxDy = Math.max(-(vh - pad - size - 8), -(8 - pad + halfExtra));
  const minDy = Math.min(maxDy, -(vh - pad - size - 8 - halfExtra));
  return {
    dx: Math.max(minDx, Math.min(maxDx, raw?.dx ?? 0)),
    dy: Math.max(minDy, Math.min(maxDy, raw?.dy ?? 0)),
    scale,
  };
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  mode,
  compact = false,
  touchLayout,
  resolvedGeom,
  isEditingLayout = false,
  isSelected = false,
  language = 'tr',
  onSelectButton,
  onUpdateButtonTransform,
  onDragResolve,
  onChange,
}) => {
  const activePointerId = useRef<number | null>(null);
  const originRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startDx: number;
    startDy: number;
    scale: number;
  } | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const maxRadiusRef = useRef<number>(MAX_RADIUS);
  const [knobOffset, setKnobOffset] = useState<Vec2>({ x: 0, y: 0 });
  const [dynamicOrigin, setDynamicOrigin] = useState<Vec2 | null>(null);
  const [isActive, setIsActive] = useState(false);

  const boxSize = resolvedGeom?.boxSize ?? (compact ? 112 : 160);
  const pad = resolvedGeom?.pad ?? (compact ? 8 : 20);
  const fallback = clampJoystickTransform(touchLayout?.joystick, boxSize, pad);
  const dx = resolvedGeom?.dx ?? fallback.dx;
  const dy = resolvedGeom?.dy ?? fallback.dy;
  const scale = resolvedGeom?.scale ?? fallback.scale;
  const opacity = resolvedGeom?.opacity ?? touchLayout?.joystick?.opacity ?? 1;
  const displayOpacity = isEditingLayout ? Math.max(0.35, opacity) : opacity;
  const innerSize = Math.round(boxSize * (compact ? 0.85 : 0.72));
  const knobSize = Math.round(boxSize * (compact ? 0.36 : 0.3));

  const updateVector = (clientX: number, clientY: number) => {
    const rawDx = (clientX - originRef.current.x) / scale;
    const rawDy = (clientY - originRef.current.y) / scale;
    const distance = Math.hypot(rawDx, rawDy);

    if (distance < 4) {
      setKnobOffset({ x: 0, y: 0 });
      onChange({ x: 0, y: 0 });
      return;
    }

    const radiusLimit = maxRadiusRef.current;
    const clampedDist = Math.min(distance, radiusLimit);
    const nx = (rawDx / distance) * clampedDist;
    const ny = (rawDy / distance) * clampedDist;
    setKnobOffset({ x: nx, y: ny });

    const normMag = clampedDist / radiusLimit;
    onChange({
      x: (rawDx / distance) * normMag,
      y: (rawDy / distance) * normMag,
    });
  };

  const resetJoystickState = useCallback(() => {
    activePointerId.current = null;
    dragStartRef.current = null;
    setIsActive(false);
    setDynamicOrigin(null);
    setKnobOffset({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  }, [onChange]);

  useEffect(() => {
    const onBlur = () => resetJoystickState();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [resetJoystickState]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingLayout) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure
      }
      activePointerId.current = e.pointerId;
      onSelectButton?.('joystick');
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startDx: dx,
        startDy: dy,
        scale,
      };
      return;
    }
    if (activePointerId.current !== null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture failure
    }
    activePointerId.current = e.pointerId;
    setIsActive(true);

    const rect = e.currentTarget.getBoundingClientRect();
    const unscaledWidth = rect.width / scale;
    maxRadiusRef.current = unscaledWidth < 136 ? 34 : MAX_RADIUS;
    if (mode === 'DYNAMIC') {
      const localX = (e.clientX - rect.left) / scale;
      const localY = (e.clientY - rect.top) / scale;
      originRef.current = { x: e.clientX, y: e.clientY };
      setDynamicOrigin({ x: localX, y: localY });
      setKnobOffset({ x: 0, y: 0 });
      onChange({ x: 0, y: 0 });
    } else {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      originRef.current = { x: centerX, y: centerY };
      updateVector(e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingLayout) {
      if (activePointerId.current !== e.pointerId || !dragStartRef.current) return;
      const nextDx = dragStartRef.current.startDx + (e.clientX - dragStartRef.current.pointerX);
      const nextDy = dragStartRef.current.startDy + (e.clientY - dragStartRef.current.pointerY);
      const candidate: TouchButtonTransform = {
        dx: nextDx,
        dy: nextDy,
        scale: dragStartRef.current.scale,
        opacity,
      };
      const resolved = onDragResolve
        ? onDragResolve('joystick', candidate)
        : { ...clampJoystickTransform(candidate, boxSize, pad), opacity };
      onUpdateButtonTransform?.('joystick', resolved);
      return;
    }
    if (activePointerId.current !== e.pointerId) return;
    updateVector(e.clientX, e.clientY);
  };

  const releasePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    resetJoystickState();
  };

  const basePositionStyle =
    !isEditingLayout && mode === 'DYNAMIC' && dynamicOrigin
      ? {
          left: `${dynamicOrigin.x}px`,
          top: `${dynamicOrigin.y}px`,
          transform: 'translate(-50%, -50%)',
        }
      : undefined;

  return (
    <div
      ref={zoneRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onLostPointerCapture={releasePointer}
      aria-label="Hareket Joystick"
      style={{
        width: `${boxSize}px`,
        height: `${boxSize}px`,
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        opacity: displayOpacity,
      }}
      className={`pointer-events-auto relative flex items-center justify-center touch-none shrink-0 ${
        isEditingLayout
          ? `cursor-move rounded-full border-2 border-dashed ${
              isSelected
                ? 'border-amber-300 bg-amber-400/15 ring-2 ring-amber-400/70'
                : 'border-sky-300/60 bg-slate-900/35'
            }`
          : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <div
        style={{
          ...basePositionStyle,
          width: `${innerSize}px`,
          height: `${innerSize}px`,
        }}
        className={`${
          !isEditingLayout && mode === 'DYNAMIC' && dynamicOrigin ? 'absolute' : 'relative'
        } rounded-full border backdrop-blur-md ring-1 ring-inset ring-white/[0.06] transition-colors duration-150 flex items-center justify-center ${
          isActive
            ? 'bg-[#081A24]/78 border-amber-300/70 shadow-[0_0_26px_rgba(251,191,36,0.22)]'
            : 'bg-[#081A24]/56 border-white/20 shadow-[0_10px_28px_rgba(2,10,18,0.45)]'
        }`}
      >
        {/* Crosshair guides & cardinal ticks */}
        <div
          className={`absolute ${
            compact ? 'inset-2.5' : 'inset-2.5 sm:inset-3'
          } rounded-full border border-white/10 pointer-events-none`}
        />
        <span className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 rounded-full bg-white/30" />
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 rounded-full bg-white/30" />
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 h-[1.5px] w-1.5 rounded-full bg-white/30" />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-[1.5px] w-1.5 rounded-full bg-white/30" />

        {/* Inner thumb knob */}
        <div
          style={{
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
          className={`rounded-full border ring-1 ring-inset ring-white/35 shadow-[0_6px_16px_rgba(2,10,18,0.55)] transition-colors duration-100 pointer-events-none flex items-center justify-center ${
            isActive
              ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100'
              : 'bg-gradient-to-b from-slate-50 to-slate-200/90 border-white/80'
          }`}
        >
          {isEditingLayout && <Move className="w-4 h-4 text-slate-800" />}
        </div>
      </div>

      {isEditingLayout && (
        <span className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/20 text-[9px] font-bold text-amber-200 whitespace-nowrap">
          {language === 'en' ? 'Move Stick' : 'Hareket'}
        </span>
      )}
    </div>
  );
};
