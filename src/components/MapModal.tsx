import React, { useEffect, useRef, useState } from 'react';
import { Compass, Flag, MapPin, Ship, Store, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { DigCrater, Island, KingdomState, MapWaypoint, Vec2 } from '../types/game';
import { RemotePlayerSnapshot } from '../types/online';
import { SECTOR_SIZE, WorldManager } from '../engine/worldGen';
import { ENEMY_FACTION_LIST, getEffectiveIslandFaction, getFactionDisplay } from '../engine/factions';

type MapFilter = 'ALL' | 'TREASURES' | 'FACTIONS' | 'TRADERS';

interface MapModalProps {
  worldManager: WorldManager;
  discoveredIslandIds: string[];
  openedTreasureIds: string[];
  dugCraters: DigCrater[];
  kingdom: KingdomState;
  playerPos: Vec2;
  boatPos: Vec2;
  isSailing: boolean;
  mapPin?: MapWaypoint | null;
  onlineMode?: boolean;
  onlinePlayers?: RemotePlayerSnapshot[];
  onlineIslandOwners?: Record<string, { shortName: string; color: string }>;
  colorblindMode?: boolean;
  language?: 'tr' | 'en';
  onSetMapPin?: (pin: MapWaypoint | null) => void;
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = ({
  worldManager,
  discoveredIslandIds,
  openedTreasureIds,
  dugCraters,
  kingdom,
  playerPos,
  boatPos,
  isSailing,
  mapPin = null,
  onlineMode = false,
  onlinePlayers = [],
  onlineIslandOwners = {},
  colorblindMode = false,
  language = 'tr',
  onSetMapPin,
  onClose,
}) => {
  const isEn = language === 'en';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(0.085);
  const [filter, setFilter] = useState<MapFilter>('ALL');
  const [showRings, setShowRings] = useState(true);
  const [offset, setOffset] = useState<Vec2>({ x: playerPos.x, y: playerPos.y });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // Deep chart ocean
    ctx.fillStyle = '#083A52';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-offset.x, -offset.y);

    // Subtle nautical grid lines
    const gridStep = SECTOR_SIZE;
    const halfW = w / (2 * zoom) + gridStep;
    const halfH = h / (2 * zoom) + gridStep;
    const startX = Math.floor((offset.x - halfW) / gridStep) * gridStep;
    const endX = offset.x + halfW;
    const startY = Math.floor((offset.y - halfH) / gridStep) * gridStep;
    const endY = offset.y + halfH;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1 / zoom;
    for (let gx = startX; gx <= endX; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, startY);
      ctx.lineTo(gx, endY);
      ctx.stroke();
    }
    for (let gy = startY; gy <= endY; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(startX, gy);
      ctx.lineTo(endX, gy);
      ctx.stroke();
    }

    const openedSet = new Set(openedTreasureIds);
    const discoveredSet = new Set(discoveredIslandIds);

    // Render all discovered islands + faint uncharted silhouettes in nearby sectors
    const islandsToDraw: Array<{ island: Island; discovered: boolean }> = [];
    const minSx = Math.floor((offset.x - halfW) / gridStep);
    const maxSx = Math.ceil((offset.x + halfW) / gridStep);
    const minSy = Math.floor((offset.y - halfH) / gridStep);
    const maxSy = Math.ceil((offset.y + halfH) / gridStep);

    for (let sx = minSx; sx <= maxSx; sx++) {
      for (let sy = minSy; sy <= maxSy; sy++) {
        const isl = worldManager.getIslandAtSector(sx, sy);
        if (isl) {
          islandsToDraw.push({ island: isl, discovered: discoveredSet.has(isl.id) });
        }
      }
    }

    // Ensure all dynamic starter islands & discovered islands are included
    if (onlineMode) {
      for (const isl of worldManager.getStarterIslands()) {
        if (!islandsToDraw.some((item) => item.island.id === isl.id)) {
          islandsToDraw.push({ island: isl, discovered: true });
        } else {
          const found = islandsToDraw.find((item) => item.island.id === isl.id);
          if (found) found.discovered = true;
        }
      }
    }
    for (const id of discoveredIslandIds) {
      if (!islandsToDraw.some((item) => item.island.id === id)) {
        const isl = worldManager.getIslandById(id);
        if (isl) islandsToDraw.push({ island: isl, discovered: true });
      }
    }

    for (const { island, discovered } of islandsToDraw) {
      // Secret islands stay completely hidden until physically discovered
      if (!discovered && island.isSecret) {
        continue;
      }

      const effFaction = getEffectiveIslandFaction(
        island.factionId,
        island.id,
        island.isStarter,
        kingdom
      );
      const onlineOwner = onlineMode ? onlineIslandOwners[island.id] : undefined;
      const factionInfo = onlineOwner
        ? {
            name: onlineOwner.shortName,
            shortName: onlineOwner.shortName,
            color: onlineOwner.color,
            sailColor: onlineOwner.color,
          }
        : getFactionDisplay(effFaction, kingdom);
      const isOwned = Boolean(onlineOwner) || effFaction !== 'NEUTRAL';
      const isAtWar =
        !onlineMode &&
        effFaction !== 'NEUTRAL' &&
        effFaction !== 'PLAYER' &&
        kingdom.atWarWith.includes(effFaction);

      const remainingTreasures = island.treasures.filter((t) => !openedSet.has(t.id)).length;
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'TREASURES' && discovered && remainingTreasures > 0) ||
        (filter === 'FACTIONS' && isOwned) ||
        (filter === 'TRADERS' && discovered && Boolean(island.traderDock));

      ctx.save();
      if (!matchesFilter) {
        ctx.globalAlpha = 0.28;
      }

      if (discovered) {
        // Shallow ring (tinted subtly by faction territory or special zone)
        ctx.fillStyle =
          island.specialZone === 'CITY'
            ? 'rgba(56, 189, 248, 0.28)'
            : island.specialZone === 'ARENA'
            ? 'rgba(249, 115, 22, 0.28)'
            : island.specialZone === 'SECRET'
            ? 'rgba(232, 121, 249, 0.28)'
            : !isOwned
            ? 'rgba(36, 180, 201, 0.35)'
            : `${factionInfo.color}38`;
        ctx.beginPath();
        island.coastPoints.forEach((p, idx) => {
          const sx = island.centerX + (p.x - island.centerX) * 1.24;
          const sy = island.centerY + (p.y - island.centerY) * 1.24;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
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
          ctx.lineWidth = (isAtWar ? 3 : 2) / zoom;
          ctx.stroke();
        }

        // Sand
        ctx.fillStyle = '#F2D399';
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

        // Inland Lakes
        for (const lake of island.lakes ?? []) {
          ctx.fillStyle = lake.isVolcanicCrater ? '#0E7490' : '#22B8CF';
          ctx.beginPath();
          lake.points.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        }

        // Landmarks
        for (const lm of island.landmarks) {
          ctx.fillStyle =
            lm.type === 'CITY_PLAZA' || lm.type === 'FOUNTAIN'
              ? '#38BDF8'
              : lm.type === 'TAVERN'
              ? '#F59E0B'
              : lm.type === 'ARENA_RING'
              ? '#F97316'
              : lm.type === 'CAVE_ENTRANCE'
              ? '#A855F7'
              : lm.type === 'SECRET_SHRINE'
              ? '#E879F9'
              : lm.type === 'TEMPLE' || lm.type === 'RUINS'
              ? '#CBD5E1'
              : lm.type === 'TOWER' || lm.type === 'BASTION'
              ? '#94A3B8'
              : lm.type === 'OBELISK'
              ? '#22D3EE'
              : lm.type === 'LIGHTHOUSE'
              ? '#FDE047'
              : lm.type === 'TRADING_POST'
              ? '#FB923C'
              : lm.type === 'SEA_ARCH'
              ? '#2DD4BF'
              : lm.type === 'SHIPWRECK'
              ? '#92400E'
              : '#D97706';
          ctx.beginPath();
          ctx.arc(lm.x, lm.y, (lm.type === 'CAVE_ENTRANCE' ? 5.5 : 4.5) / zoom, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fort / Faction Flag marker
        if (island.fortPos && isOwned) {
          ctx.fillStyle = factionInfo.color;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.arc(island.fortPos.x, island.fortPos.y, 6 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Trader dock marker
        if (island.traderDock) {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(island.traderDock.x, island.traderDock.y, 6 / zoom, 0, Math.PI * 2);
          ctx.fill();
          if (filter === 'TRADERS') {
            ctx.strokeStyle = '#FDE047';
            ctx.lineWidth = 2.2 / zoom;
            ctx.beginPath();
            ctx.arc(island.traderDock.x, island.traderDock.y, 12 / zoom, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Treasure filter highlight ring
        if (filter === 'TREASURES' && remainingTreasures > 0) {
          ctx.strokeStyle = colorblindMode ? '#22D3EE' : '#FBBF24';
          ctx.lineWidth = 2.5 / zoom;
          ctx.beginPath();
          ctx.arc(island.centerX, island.centerY, island.maxRadius + 30, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Island label
        ctx.fillStyle =
          island.specialZone === 'CITY'
            ? '#7DD3FC'
            : island.specialZone === 'ARENA'
            ? '#FDBA74'
            : island.specialZone === 'SECRET'
            ? '#F5D0FE'
            : effFaction === 'PLAYER' && !onlineOwner
            ? '#A7F3D0'
            : isAtWar
            ? colorblindMode
              ? '#F472B6'
              : '#FCA5A5'
            : '#F8FAFC';
        ctx.font = `600 ${Math.round(11 / zoom)}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        const warTag = isAtWar ? (isEn ? ' [War]' : ' [Savaş]') : '';
        const cleanTag = isEn ? ' (Clear)' : ' (Temiz)';
        const ownerSuffix = !isOwned ? '' : ` · ${factionInfo.shortName}${warTag}`;
        ctx.fillText(
          `${island.name}${remainingTreasures === 0 ? cleanTag : ` (${remainingTreasures})`}${ownerSuffix}`,
          island.centerX,
          island.centerY - island.maxRadius - 14 / zoom
        );
      } else {
        // Uncharted fogged silhouette
        ctx.fillStyle = 'rgba(15, 41, 54, 0.55)';
        ctx.strokeStyle =
          island.specialZone === 'CITY'
            ? 'rgba(56, 189, 248, 0.5)'
            : island.specialZone === 'ARENA'
            ? 'rgba(249, 115, 22, 0.5)'
            : isOwned
            ? `${factionInfo.color}66`
            : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = (isOwned || island.specialZone ? 2.2 : 1.5) / zoom;
        ctx.beginPath();
        ctx.arc(island.centerX, island.centerY, island.baseRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dug craters
    ctx.fillStyle = '#7C5430';
    for (const c of dugCraters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2.5 / zoom, 10), 0, Math.PI * 2);
      ctx.fill();
    }

    // Distance Rings around active player position (100m, 250m, 500m)
    const centerPos = isSailing ? boatPos : playerPos;
    if (showRings) {
      ctx.save();
      ctx.setLineDash([7 / zoom, 6 / zoom]);
      ctx.lineWidth = 1.1 / zoom;
      ctx.font = `600 ${Math.round(10 / zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      for (const distMeters of [100, 250, 500]) {
        const r = distMeters * 10;
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
        ctx.beginPath();
        ctx.arc(centerPos.x, centerPos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.fillText(`${distMeters}m`, centerPos.x, centerPos.y - r - 4 / zoom);
      }
      ctx.restore();
    }

    // Boat marker
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(boatPos.x, boatPos.y, 7 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Player marker
    if (!isSailing) {
      ctx.fillStyle = colorblindMode ? '#22D3EE' : '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(playerPos.x, playerPos.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Remote Online Players on map
    if (onlineMode && onlinePlayers.length > 0) {
      for (const rp of onlinePlayers) {
        if (!rp.connected) continue;
        const rpx = rp.isSailing ? rp.boatX : rp.x;
        const rpy = rp.isSailing ? rp.boatY : rp.y;
        ctx.fillStyle = rp.bannerColor || '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(rpx, rpy, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.round(11 / zoom)}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = rp.bannerColor || '#FDE68A';
        ctx.fillText(rp.name, rpx, rpy - 12 / zoom);
      }
    }

    // Custom User Waypoint Pin + dashed route line
    if (mapPin) {
      ctx.save();
      ctx.setLineDash([8 / zoom, 7 / zoom]);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(centerPos.x, centerPos.y);
      ctx.lineTo(mapPin.x, mapPin.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target rings
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(mapPin.x, mapPin.y, 16 / zoom, 0, Math.PI * 2);
      ctx.stroke();

      // Pin marker
      ctx.fillStyle = '#F43F5E';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(mapPin.x, mapPin.y, 8 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const distM = Math.round(Math.hypot(mapPin.x - centerPos.x, mapPin.y - centerPos.y) / 10);
      ctx.font = `700 ${Math.round(12 / zoom)}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFE4E6';
      ctx.fillText(`${mapPin.label} (${distM}m)`, mapPin.x, mapPin.y - 18 / zoom);
      ctx.restore();
    }

    ctx.restore();
  }, [
    worldManager,
    discoveredIslandIds,
    openedTreasureIds,
    dugCraters,
    kingdom,
    playerPos,
    boatPos,
    isSailing,
    mapPin,
    onlineMode,
    onlinePlayers,
    onlineIslandOwners,
    colorblindMode,
    isEn,
    filter,
    showRings,
    zoom,
    offset,
  ]);

  const discoveredCount = discoveredIslandIds.length;
  const totalOpened = openedTreasureIds.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Open World Map' : 'Açık Dünya Haritası'}
    >
      <div className="w-full max-w-4xl h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Compass className="w-5 h-5 text-sky-300 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {isEn ? 'World & Nations Chart' : 'Açık Dünya & Devletler Haritası'}
            </h2>
            <span className="hidden md:inline text-xs text-slate-300 font-mono-num whitespace-nowrap">
              {discoveredCount} {isEn ? 'Islands' : 'Ada'} · {totalOpened}{' '}
              {isEn ? 'Treasures' : 'Hazine'} · {kingdom.conqueredIslandIds.length}{' '}
              {isEn ? 'Conquered' : 'Fetih'}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/50 border border-white/10">
              {(
                [
                  { id: 'ALL', label: isEn ? 'All' : 'Tümü' },
                  { id: 'TREASURES', label: isEn ? 'Treasures' : 'Hazine' },
                  { id: 'FACTIONS', label: isEn ? 'Nations' : 'Devletler' },
                  { id: 'TRADERS', label: isEn ? 'Traders' : 'Tüccar' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    filter === f.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowRings((r) => !r)}
              className={`hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                showRings
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {isEn ? 'Rings' : 'Mesafe'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Map' : 'Haritayı Kapat'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Map Canvas */}
        <div className="relative flex-1 bg-[#083A52]">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              dragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                lastX: e.clientX,
                lastY: e.clientY,
                moved: false,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return;
              if (
                Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) >
                6
              ) {
                dragRef.current.moved = true;
              }
              const dx = (e.clientX - dragRef.current.lastX) / zoom;
              const dy = (e.clientY - dragRef.current.lastY) / zoom;
              dragRef.current.lastX = e.clientX;
              dragRef.current.lastY = e.clientY;
              setOffset((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
            }}
            onPointerUp={(e) => {
              const wasClick = dragRef.current.active && !dragRef.current.moved;
              dragRef.current.active = false;
              if (wasClick && onSetMapPin && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const wx = offset.x + (sx - rect.width / 2) / zoom;
                const wy = offset.y + (sy - rect.height / 2) / zoom;

                // Clicking existing pin toggles/removes it
                if (mapPin && Math.hypot(wx - mapPin.x, wy - mapPin.y) <= 22 / zoom) {
                  onSetMapPin(null);
                  return;
                }

                // Auto-label with discovered nearby island name if close
                let label = isEn ? 'Waypoint' : 'İşaret';
                const discoveredSet = new Set(discoveredIslandIds);
                const nearIsl = worldManager
                  .getVisibleIslands(wx, wy, 1)
                  .find(
                    (isl) =>
                      discoveredSet.has(isl.id) &&
                      Math.hypot(wx - isl.centerX, wy - isl.centerY) <= isl.maxRadius + 160
                  );
                if (nearIsl) {
                  label = nearIsl.name;
                }
                onSetMapPin({ x: Math.round(wx), y: Math.round(wy), label });
              }
            }}
            onPointerCancel={() => {
              dragRef.current.active = false;
            }}
            className="w-full h-full cursor-crosshair active:cursor-grabbing touch-none"
          />

          {/* Active Waypoint Quick Bar */}
          {mapPin && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F2936]/92 border border-rose-400/45 shadow-lg text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="font-semibold text-rose-100 truncate max-w-[160px]">
                {mapPin.label}
              </span>
              {onSetMapPin && (
                <button
                  type="button"
                  onClick={() => onSetMapPin(null)}
                  className="ml-1 p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 cursor-pointer"
                  title={isEn ? 'Remove Waypoint' : 'İşareti Kaldır'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Zoom & Center Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(0.24, z * 1.25))}
              aria-label={isEn ? 'Zoom In' : 'Yakınlaştır'}
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.03, z * 0.8))}
              aria-label={isEn ? 'Zoom Out' : 'Uzaklaştır'}
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setOffset({ x: playerPos.x, y: playerPos.y })}
              aria-label={isEn ? 'Center on Player' : 'Konumuma Odaklan'}
              title={isEn ? 'Center on Player' : 'Konumuma Odaklan'}
              className="w-10 h-10 rounded-xl bg-amber-500 border border-amber-200 text-slate-950 hover:bg-amber-400 flex items-center justify-center shadow-lg cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Unboxed Legend Footer */}
        <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-slate-300 max-h-24 overflow-y-auto shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  colorblindMode ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}
              />
              {isEn ? 'Player' : 'Oyuncu'}
            </span>
            <span className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-sky-400" />
              {isEn ? 'Ship' : 'Tekne'}
            </span>
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              {isEn ? 'Trader' : 'Tüccar'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-sky-400" />
              {isEn ? 'City' : 'Kent'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-orange-500" />
              {isEn ? 'Arena' : 'Arena'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-purple-400" />
              {isEn ? 'Cave / Secret' : 'Mağara / Gizli'}
            </span>
            {kingdom.founded && (
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" style={{ color: kingdom.bannerColor }} />
                {kingdom.name}
              </span>
            )}
            {!onlineMode &&
              ENEMY_FACTION_LIST.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: f.color }}
                  />
                  {f.shortName}
                </span>
              ))}
            {onlineMode &&
              onlinePlayers
                .filter((p) => p.connected)
                .map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: p.bannerColor }}
                    />
                    {p.name}
                  </span>
                ))}
          </div>
          <span className="text-slate-400">
            {isEn
              ? 'Click to place/remove waypoint · Drag to pan'
              : 'Tıklayarak konum işareti koyabilir · Sürükleyerek gezebilirsiniz'}
          </span>
        </div>
      </div>
    </div>
  );
};

