import React, { useRef, useState } from 'react';
import { Vec2 } from '../types/game';

interface VirtualJoystickProps {
  mode: 'FIXED' | 'DYNAMIC';
  onChange: (vec: Vec2) => void;
}

const MAX_RADIUS = 44;

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ mode, onChange }) => {
  const activePointerId = useRef<number | null>(null);
  const originRef = useRef<Vec2>({ x: 0, y: 0 });
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const maxRadiusRef = useRef<number>(MAX_RADIUS);
  const [knobOffset, setKnobOffset] = useState<Vec2>({ x: 0, y: 0 });
  const [dynamicOrigin, setDynamicOrigin] = useState<Vec2 | null>(null);
  const [isActive, setIsActive] = useState(false);

  const updateVector = (clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 4) {
      setKnobOffset({ x: 0, y: 0 });
      onChange({ x: 0, y: 0 });
      return;
    }

    const radiusLimit = maxRadiusRef.current;
    const clampedDist = Math.min(distance, radiusLimit);
    const nx = (dx / distance) * clampedDist;
    const ny = (dy / distance) * clampedDist;
    setKnobOffset({ x: nx, y: ny });

    const normMag = clampedDist / radiusLimit;
    onChange({
      x: (dx / distance) * normMag,
      y: (dy / distance) * normMag,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    setIsActive(true);

    const rect = e.currentTarget.getBoundingClientRect();
    maxRadiusRef.current = rect.width < 136 ? 34 : MAX_RADIUS;
    if (mode === 'DYNAMIC') {
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
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
    if (activePointerId.current !== e.pointerId) return;
    updateVector(e.clientX, e.clientY);
  };

  const releasePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setIsActive(false);
    setDynamicOrigin(null);
    setKnobOffset({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  const basePositionStyle =
    mode === 'DYNAMIC' && dynamicOrigin
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
      className="pointer-events-auto relative w-28 h-28 sm:w-40 sm:h-40 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shrink-0"
    >
      <div
        style={basePositionStyle}
        className={`${
          mode === 'DYNAMIC' && dynamicOrigin ? 'absolute' : 'relative'
        } w-24 h-24 sm:w-28 sm:h-28 rounded-full border transition-opacity duration-150 flex items-center justify-center ${
          isActive
            ? 'bg-slate-900/55 border-amber-300/60 shadow-lg'
            : 'bg-slate-900/40 border-white/25'
        }`}
      >
        {/* Crosshair guides */}
        <div className="absolute inset-2.5 sm:inset-3 rounded-full border border-white/10 pointer-events-none" />
        {/* Inner thumb knob */}
        <div
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border shadow-md transition-colors duration-100 pointer-events-none ${
            isActive
              ? 'bg-amber-400 border-amber-200'
              : 'bg-slate-100/85 border-white'
          }`}
        />
      </div>
    </div>
  );
};
