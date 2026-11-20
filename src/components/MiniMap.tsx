import React, { useEffect, useRef } from 'react';
import { Maximize2, Move } from 'lucide-react';
import {
  ActiveCaveState,
  Island,
  KingdomState,
  MapWaypoint,
  TouchButtonId,
  TouchButtonTransform,
  TouchLayoutConfig,
} from '../types/game';
import { RemotePlayerSnapshot } from '../types/online';
import { WorldManager } from '../engine/worldGen';
import { getEffectiveIslandFaction, getFactionDisplay } from '../engine/factions';
import { ResolvedMiniMapGeom } from '../utils/hudLayout';

export interface MiniMapLiveSnapshot {
  playerX: number;
  playerY: number;
  playerAngle: number;
  boatX: number;
  boatY: number;
  boatAngle: number;
  isSailing: boolean;
  activeCave: ActiveCaveState | null;
}

interface MiniMapProps {
  size: number;
  worldManager: WorldManager;
  discoveredIslandIds: string[];
  kingdom: KingdomState;
  mapPin: MapWaypoint | null;
  onlineMode?: boolean;
  onlinePlayers?: RemotePlayerSnapshot[];
  onlineIslandOwners?: Record<string, { shortName: string; color: string }>;
  colorblindMode?: boolean;
  language?: 'tr' | 'en';
  touchLayout?: TouchLayoutConfig;
  resolvedGeom?: ResolvedMiniMapGeom;
  isEditingLayout?: boolean;
  isSelected?: boolean;
  onSelectButton?: (id: TouchButtonId) => void;
  onUpdateButtonTransform?: (id: TouchButtonId, next: TouchButtonTransform) => void;
  onDragResolve?: (id: TouchButtonId, candidate: TouchButtonTransform) => TouchButtonTransform;
  getLiveSnapshot: () => MiniMapLiveSnapshot;
  onOpenMap: () => void;
}

const CAVE_FLOOR_COLORS: Record<string, string> = {
  VOLCANIC: '#451A14',
  CORAL: '#134E4A',
  ANCIENT: '#2E1065',
  SMUGGLER: '#3B2514',
};

function clampMiniMapTransform(
  raw: TouchButtonTransform | undefined,
  baseSize: number,
  pad: number
): { dx: number; dy: number; scale: number; effectiveSize: number } {
  const vw =
    typeof window !== 'undefined' ? window.visualViewport?.width ?? window.innerWidth : 800;
  const vh =
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 600;
  const scale = Math.max(0.65, Math.min(1.6, raw?.scale ?? 1));
  const effectiveSize = Math.round(baseSize * scale);
  const minDx = Math.min(0, 8 - pad);
  const maxDx = Math.max(minDx, vw - pad - effectiveSize - 8);
  const minDy = Math.min(0, 8 - pad);
  const maxDy = Math.max(minDy, vh - pad - effectiveSize - 8);
  return {
    dx: Math.max(minDx, Math.min(maxDx, raw?.dx ?? 0)),
    dy: Math.max(minDy, Math.min(maxDy, raw?.dy ?? 0)),
    scale,
    effectiveSize,
  };
}

export const MiniMap: React.FC<MiniMapProps> = ({
  size,
  worldManager,
  discoveredIslandIds,
  kingdom,
  mapPin,
  onlineMode = false,
  onlinePlayers = [],
  onlineIslandOwners = {},
  colorblindMode = false,
  language = 'tr',
  touchLayout,
  resolvedGeom,
  isEditingLayout = false,
  isSelected = false,
  onSelectButton,
  onUpdateButtonTransform,
  onDragResolve,
  getLiveSnapshot,
  onOpenMap,
}) => {
  const isEn = language === 'en';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startDx: number;
    startDy: number;
    scale: number;
  } | null>(null);
  const baseSize = resolvedGeom?.baseSize ?? size;
  const pad = resolvedGeom?.pad ?? (baseSize < 100 ? 8 : 20);
  const fallback = clampMiniMapTransform(touchLayout?.minimap, baseSize, pad);
  const dx = resolvedGeom?.dx ?? fallback.dx;
  const dy = resolvedGeom?.dy ?? fallback.dy;
  const scale = resolvedGeom?.scale ?? fallback.scale;
  const effectiveSize = resolvedGeom?.effectiveSize ?? fallback.effectiveSize;
  const opacity = resolvedGeom?.opacity ?? touchLayout?.minimap?.opacity ?? 1;
  const displayOpacity = isEditingLayout ? Math.max(0.35, opacity) : opacity;
  const latestPropsRef = useRef({
    worldManager,
    discoveredIslandIds,
    kingdom,
    mapPin,
    onlineMode,
    onlinePlayers,
    onlineIslandOwners,
    colorblindMode,
    getLiveSnapshot,
  });

  latestPropsRef.current = {
    worldManager,
    discoveredIslandIds,
    kingdom,
    mapPin,
    onlineMode,
    onlinePlayers,
    onlineIslandOwners,
    colorblindMode,
    getLiveSnapshot,
  };

  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null;
    };
    window.addEventListener('blur', clearDrag);
    return () => window.removeEventListener('blur', clearDrag);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderMiniMap = () => {
      const {
        worldManager: wm,
        discoveredIslandIds: discoveredIds,
        kingdom: kd,
        mapPin: pin,
        onlineMode: isOnline,
        onlinePlayers: remotes,
        onlineIslandOwners: onlineOwners,
        colorblindMode: cbMode,
        getLiveSnapshot: readLive,
      } = latestPropsRef.current;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetPx = Math.max(1, Math.round(effectiveSize * dpr));
      if (canvas.width !== targetPx || canvas.height !== targetPx) {
        canvas.width = targetPx;
        canvas.height = targetPx;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const live = readLive();
      const half = effectiveSize * 0.5;

      // Background
      ctx.clearRect(0, 0, effectiveSize, effectiveSize);
      ctx.fillStyle = live.activeCave ? '#070F1C' : '#062B3D';
      ctx.fillRect(0, 0, effectiveSize, effectiveSize);

      if (live.activeCave) {
        const cave = live.activeCave.cave;
        const cavePad = 10;
        const avail = Math.max(20, effectiveSize - cavePad * 2);
        const cScale = Math.min(avail / cave.width, avail / cave.height);
        const offsetX = (effectiveSize - cave.width * cScale) * 0.5;
        const offsetY = (effectiveSize - cave.height * cScale) * 0.5;
        const floorColor = CAVE_FLOOR_COLORS[cave.theme] ?? '#1E293B';

        ctx.save();
        ctx.translate(offsetX, offsetY);

        ctx.strokeStyle = floorColor;
        ctx.lineCap = 'round';
        for (const cor of cave.corridors) {
          ctx.lineWidth = Math.max(2.5, cor.width * cScale);
          ctx.beginPath();
          ctx.moveTo(cor.x1 * cScale, cor.y1 * cScale);
          ctx.lineTo(cor.x2 * cScale, cor.y2 * cScale);
          ctx.stroke();
        }

        ctx.fillStyle = floorColor;
        for (const ch of cave.chambers) {
          ctx.beginPath();
          ctx.ellipse(
            ch.cx * cScale,
            ch.cy * cScale,
            Math.max(2, ch.rx * cScale),
            Math.max(2, ch.ry * cScale),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // Cave exit dot
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(cave.exitPos.x * cScale, cave.exitPos.y * cScale, 3, 0, Math.PI * 2);
        ctx.fill();

        // Unopened chests
        ctx.fillStyle = '#FBBF24';
        for (const chest of cave.chests) {
          if (chest.opened) continue;
          ctx.beginPath();
          ctx.arc(chest.x * cScale, chest.y * cScale, chest.tier === 'BOSS' ? 2.8 : 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cave allies
        for (const rp of remotes) {
          if (!rp.connected || rp.inCaveId !== cave.caveId) continue;
          if (rp.caveX === undefined || rp.caveY === undefined) continue;
          ctx.fillStyle = rp.bannerColor || '#38BDF8';
          ctx.beginPath();
          ctx.arc(rp.caveX * cScale, rp.caveY * cScale, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Player arrow inside cave
        const px = live.activeCave.playerX * cScale;
        const py = live.activeCave.playerY * cScale;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(live.playerAngle);
        ctx.fillStyle = cbMode ? '#22D3EE' : '#10B981';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(4.2, 0);
        ctx.lineTo(-3, -2.8);
        ctx.lineTo(-1.8, 0);
        ctx.lineTo(-3, 2.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.restore();
        return;
      }

      // Overworld Minimap
      const rawCx = live.isSailing ? live.boatX : live.playerX;
      const rawCy = live.isSailing ? live.boatY : live.playerY;
      const cx = Number.isFinite(rawCx) ? rawCx : 0;
      const cy = Number.isFinite(rawCy) ? rawCy : 0;
      const worldRadius = 2650;
      const zoom = half / worldRadius;

      // Subtle radar rings + crosshairs
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(half, half, half * 0.45, 0, Math.PI * 2);
      ctx.arc(half, half, half * 0.85, 0, Math.PI * 2);
      ctx.moveTo(half, 4);
      ctx.lineTo(half, effectiveSize - 4);
      ctx.moveTo(4, half);
      ctx.lineTo(effectiveSize - 4, half);
      ctx.stroke();

      const discoveredSet = new Set(discoveredIds);
      const nearbyIslands: Array<{ island: Island; discovered: boolean }> = [];
      const seenIds = new Set<string>();

      for (const isl of wm.getVisibleIslands(cx, cy, 2)) {
        seenIds.add(isl.id);
        nearbyIslands.push({ island: isl, discovered: discoveredSet.has(isl.id) });
      }
      if (isOnline) {
        for (const isl of wm.getStarterIslands()) {
          if (!seenIds.has(isl.id)) {
            seenIds.add(isl.id);
            nearbyIslands.push({ island: isl, discovered: true });
          } else {
            const match = nearbyIslands.find((it) => it.island.id === isl.id);
            if (match) match.discovered = true;
          }
        }
      }

      ctx.save();
      ctx.translate(half, half);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      const maxCheckDist = worldRadius + 900;
      for (const { island, discovered } of nearbyIslands) {
        if (!discovered && island.isSecret) continue;
        if (Math.hypot(island.centerX - cx, island.centerY - cy) > maxCheckDist) continue;

        const effFaction = getEffectiveIslandFaction(
          island.factionId,
          island.id,
          island.isStarter,
          kd
        );
        const onlineOwner = isOnline ? onlineOwners[island.id] : undefined;
        const factionInfo = onlineOwner
          ? { color: onlineOwner.color }
          : getFactionDisplay(effFaction, kd);
        const isOwned = Boolean(onlineOwner) || effFaction !== 'NEUTRAL';

        if (discovered) {
          // Shallow ring
          ctx.fillStyle =
            island.specialZone === 'CITY'
              ? 'rgba(56, 189, 248, 0.28)'
              : island.specialZone === 'ARENA'
              ? 'rgba(249, 115, 22, 0.28)'
              : island.specialZone === 'SECRET'
              ? 'rgba(232, 121, 249, 0.28)'
              : isOwned
              ? `${factionInfo.color}38`
              : 'rgba(36, 180, 201, 0.28)';
          ctx.beginPath();
          island.coastPoints.forEach((p, idx) => {
            const sx = island.centerX + (p.x - island.centerX) * 1.2;
            const sy = island.centerY + (p.y - island.centerY) * 1.2;
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          ctx.closePath();
          ctx.fill();

          // Sand
          ctx.fillStyle = '#E8C587';
          ctx.beginPath();
          island.coastPoints.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();

          // Grass
          ctx.fillStyle =
            island.specialZone === 'ARENA'
              ? '#78716C'
              : island.specialZone === 'SECRET'
              ? '#4C1D95'
              : '#5CA44E';
          ctx.beginPath();
          island.grassPoints.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();

          if (isOwned || island.specialZone) {
            ctx.strokeStyle =
              island.specialZone === 'CITY'
                ? '#38BDF8'
                : island.specialZone === 'ARENA'
                ? '#F97316'
                : island.specialZone === 'SECRET'
                ? '#E879F9'
                : factionInfo.color;
            ctx.lineWidth = 1.6 / zoom;
            ctx.stroke();
          }

          if (island.traderDock) {
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.arc(island.traderDock.x, island.traderDock.y, 2.4 / zoom, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Fogged uncharted silhouette
          ctx.fillStyle = 'rgba(15, 45, 62, 0.72)';
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.arc(island.centerX, island.centerY, island.baseRadius * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Parked boat marker when walking on foot
      if (!live.isSailing) {
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(live.boatX, live.boatY, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Remote players
      if (isOnline && remotes.length > 0) {
        for (const rp of remotes) {
          if (!rp.connected || rp.inCaveId) continue;
          const rx = rp.isSailing ? rp.boatX : rp.x;
          const ry = rp.isSailing ? rp.boatY : rp.y;
          ctx.fillStyle = rp.bannerColor || '#F59E0B';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.1 / zoom;
          ctx.beginPath();
          ctx.arc(rx, ry, 2.9 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Waypoint line + in-range dot
      if (pin) {
        const dx = pin.x - cx;
        const dy = pin.y - cy;
        const d = Math.hypot(dx, dy);

        ctx.save();
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pin.x, pin.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (d <= worldRadius * 0.92) {
          ctx.fillStyle = '#F43F5E';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.4 / zoom;
          ctx.beginPath();
          ctx.arc(pin.x, pin.y, 3.6 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();

      // Out-of-range waypoint edge indicator in screen coordinates
      if (pin) {
        const dx = pin.x - cx;
        const dy = pin.y - cy;
        const d = Math.hypot(dx, dy);
        if (d > worldRadius * 0.92 && d > 1) {
          const angle = Math.atan2(dy, dx);
          const edgeR = half - 8;
          const ex = half + Math.cos(angle) * edgeR;
          const ey = half + Math.sin(angle) * edgeR;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(angle);
          ctx.fillStyle = '#F43F5E';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.lineTo(-3.5, -3.5);
          ctx.lineTo(-3.5, 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Center player / boat heading arrow
      const heading = live.isSailing ? live.boatAngle : live.playerAngle;
      ctx.save();
      ctx.translate(half, half);
      ctx.rotate(heading);
      ctx.fillStyle = live.isSailing
        ? '#38BDF8'
        : cbMode
        ? '#22D3EE'
        : '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(5.5, 0);
      ctx.lineTo(-4, -3.6);
      ctx.lineTo(-2.2, 0);
      ctx.lineTo(-4, 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    renderMiniMap();
    const timer = window.setInterval(renderMiniMap, 80);
    return () => window.clearInterval(timer);
  }, [effectiveSize]);

  const liveNow = getLiveSnapshot();
  const activePosX = liveNow.isSailing ? liveNow.boatX : liveNow.playerX;
  const activePosY = liveNow.isSailing ? liveNow.boatY : liveNow.playerY;
  const pinDistM = mapPin
    ? Math.round(Math.hypot(mapPin.x - activePosX, mapPin.y - activePosY) / 10)
    : null;

  return (
    <div
      style={{
        width: effectiveSize,
        height: effectiveSize,
        transform: `translate(${dx}px, ${dy}px)`,
        opacity: displayOpacity,
      }}
      className="relative shrink-0"
    >
      <button
        type="button"
        onClick={() => {
          if (isEditingLayout) {
            onSelectButton?.('minimap');
            return;
          }
          onOpenMap();
        }}
        onPointerDown={(e) => {
          if (!isEditingLayout) return;
          e.preventDefault();
          e.stopPropagation();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture failure
          }
          onSelectButton?.('minimap');
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startDx: dx,
            startDy: dy,
            scale,
          };
        }}
        onPointerMove={(e) => {
          if (!isEditingLayout || !dragRef.current || dragRef.current.pointerId !== e.pointerId) {
            return;
          }
          const nextDx = dragRef.current.startDx + (e.clientX - dragRef.current.startX);
          const nextDy = dragRef.current.startDy + (e.clientY - dragRef.current.startY);
          const candidate: TouchButtonTransform = {
            dx: nextDx,
            dy: nextDy,
            scale: dragRef.current.scale,
            opacity,
          };
          const resolved = onDragResolve
            ? onDragResolve('minimap', candidate)
            : { ...clampMiniMapTransform(candidate, baseSize, pad), opacity };
          onUpdateButtonTransform?.('minimap', resolved);
        }}
        onPointerUp={(e) => {
          if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
            dragRef.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
            dragRef.current = null;
          }
        }}
        onLostPointerCapture={(e) => {
          if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
            dragRef.current = null;
          }
        }}
        aria-label={isEn ? 'Open Fullscreen Map (M)' : 'Tam Ekran Haritayı Aç (M)'}
        title={isEn ? 'Open Fullscreen Map (M)' : 'Tam Ekran Haritayı Aç (M)'}
        className={`group relative w-full h-full rounded-2xl overflow-hidden bg-[#062B3D]/95 shadow-xl transition-transform duration-100 touch-none focus-visible:outline-2 focus-visible:outline-amber-400 ${
          isEditingLayout
            ? `cursor-move border-2 border-dashed ${
                isSelected
                  ? 'border-amber-300 ring-2 ring-amber-400/75'
                  : 'border-sky-300/75 hover:border-amber-300/80'
              }`
            : 'border-2 border-sky-300/35 hover:border-amber-300/75 active:scale-95 cursor-pointer'
        }`}
      >
        <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

        {/* North compass tick */}
        <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 px-1 rounded bg-slate-950/75 text-[9px] font-bold text-sky-200/90 leading-tight">
          {isEn ? 'N' : 'K'}
        </span>

        {/* Active waypoint distance badge */}
        {pinDistM !== null && (
          <span className="pointer-events-none absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-rose-950/90 border border-rose-400/50 text-[9px] font-bold font-mono-num text-rose-100 leading-none flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            {pinDistM >= 1000 ? `${(pinDistM / 1000).toFixed(1)}km` : `${pinDistM}m`}
          </span>
        )}

        {/* Expand or Move icon hint */}
        <span className="pointer-events-none absolute bottom-1 right-1 w-5 h-5 rounded-md bg-slate-950/75 border border-white/15 text-slate-200 group-hover:text-amber-300 flex items-center justify-center transition-colors">
          {isEditingLayout ? (
            <Move className="w-2.5 h-2.5 text-amber-300" />
          ) : (
            <Maximize2 className="w-2.5 h-2.5" />
          )}
        </span>
      </button>

      {isEditingLayout && (
        <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/20 text-[9px] font-bold text-amber-200 whitespace-nowrap">
          {isEn ? 'Mini Map' : 'Mini Harita'} · %{Math.round(scale * 100)}
        </span>
      )}
    </div>
  );
};
