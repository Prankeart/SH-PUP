import React, { useRef, useState } from 'react';
import { Move } from 'lucide-react';
import { TouchButtonId, TouchButtonTransform, TouchLayoutConfig, Vec2 } from '../types/game';

interface VirtualJoystickProps {
  mode: 'FIXED' | 'DYNAMIC';
  compact?: boolean;
  touchLayout?: TouchLayoutConfig;
  isEditingLayout?: boolean;
  isSelected?: boolean;
  language?: 'tr' | 'en';
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
  onChange: (vec: Vec2) => void;
}

const MAX_RADIUS = 44;

function clampJoystickTransform(
  raw: TouchButtonTransform | undefined,
  size: number,
  pad: number
): { dx: number; dy: number; scale: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
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
  isEditingLayout = false,
  isSelected = false,
  language = 'tr',
  onSelectButton,
  onUpdateButtonTransform,
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

  const boxSize = compact ? 112 : 160;
  const pad = compact ? 8 : 20;
  const { dx, dy, scale } = clampJoystickTransform(touchLayout?.joystick, boxSize, pad);

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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingLayout) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
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
    e.currentTarget.setPointerCapture(e.pointerId);
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
      const clamped = clampJoystickTransform(
        { dx: nextDx, dy: nextDy, scale: dragStartRef.current.scale },
        boxSize,
        pad
      );
      onUpdateButtonTransform?.('joystick', clamped);
      return;
    }
    if (activePointerId.current !== e.pointerId) return;
    updateVector(e.clientX, e.clientY);
  };

  const releasePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    dragStartRef.current = null;
    setIsActive(false);
    setDynamicOrigin(null);
    setKnobOffset({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
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
      aria-label="Hareket Joystick"
      style={{
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
      }}
      className={`pointer-events-auto relative ${
        compact ? 'w-28 h-28' : 'w-28 h-28 sm:w-40 sm:h-40'
      } flex items-center justify-center touch-none shrink-0 ${
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
        style={basePositionStyle}
        className={`${
          !isEditingLayout && mode === 'DYNAMIC' && dynamicOrigin ? 'absolute' : 'relative'
        } ${
          compact ? 'w-24 h-24' : 'w-24 h-24 sm:w-28 sm:h-28'
        } rounded-full border transition-opacity duration-150 flex items-center justify-center ${
          isActive
            ? 'bg-slate-900/55 border-amber-300/60 shadow-lg'
            : 'bg-slate-900/40 border-white/25'
        }`}
      >
        {/* Crosshair guides */}
        <div
          className={`absolute ${
            compact ? 'inset-2.5' : 'inset-2.5 sm:inset-3'
          } rounded-full border border-white/10 pointer-events-none`}
        />
        {/* Inner thumb knob */}
        <div
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
          className={`${
            compact ? 'w-10 h-10' : 'w-10 h-10 sm:w-12 sm:h-12'
          } rounded-full border shadow-md transition-colors duration-100 pointer-events-none flex items-center justify-center ${
            isActive
              ? 'bg-amber-400 border-amber-200'
              : 'bg-slate-100/85 border-white'
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
