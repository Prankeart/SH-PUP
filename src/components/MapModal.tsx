import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Flag,
  Layers,
  MapPin,
  Ship,
  SlidersHorizontal,
  Store,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
  useMobileLayout?: boolean;
  onSetMapPin?: (pin: MapWaypoint | null) => void;
  onClose: () => void;
}

const MIN_MAP_ZOOM = 0.025;
const MAX_MAP_ZOOM = 0.28;

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
  useMobileLayout = false,
  onSetMapPin,
  onClose,
}) => {
  const isEn = language === 'en';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(0.085);
  const [filter, setFilter] = useState<MapFilter>('ALL');
  const [showRings, setShowRings] = useState(true);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [legendMenuOpen, setLegendMenuOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.innerHeight < 540;
  });
  const [offset, setOffset] = useState<Vec2>({ x: playerPos.x, y: playerPos.y });
  const [canvasTick, setCanvasTick] = useState(0);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const legendMenuRef = useRef<HTMLDivElement | null>(null);
  const dismissedMenuRef = useRef(false);
  const zoomRef = useRef(0.085);
  const offsetRef = useRef<Vec2>({ x: playerPos.x, y: playerPos.y });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number } | null>(null);
  const wasPinchRef = useRef(false);
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

  const applyZoom = (nextZoom: number) => {
    const clamped = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, nextZoom));
    zoomRef.current = clamped;
    setZoom(clamped);
    return clamped;
  };

  const applyOffset = (nextOffset: Vec2) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  useEffect(() => {
    const updateViewport = () => {
      setIsCompactViewport(window.innerWidth < 768 || window.innerHeight < 540);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setCanvasTick((t) => t + 1);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      let dismissed = false;
      if (filterMenuOpen && filterMenuRef.current && target && !filterMenuRef.current.contains(target)) {
        setFilterMenuOpen(false);
        dismissed = true;
      }
      if (legendMenuOpen && legendMenuRef.current && target && !legendMenuRef.current.contains(target)) {
        setLegendMenuOpen(false);
        dismissed = true;
      }
      if (dismissed) {
        dismissedMenuRef.current = true;
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filterMenuOpen || legendMenuOpen) {
        e.stopPropagation();
        setFilterMenuOpen(false);
        setLegendMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [filterMenuOpen, legendMenuOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
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
    canvasTick,
  ]);

  const discoveredCount = discoveredIslandIds.length;
  const totalOpened = openedTreasureIds.length;
  const activeCenter = isSailing ? boatPos : playerPos;
  const pinDistM = mapPin
    ? Math.round(Math.hypot(mapPin.x - activeCenter.x, mapPin.y - activeCenter.y) / 10)
    : null;

  const filterOptions: ReadonlyArray<{ id: MapFilter; label: string }> = [
    { id: 'ALL', label: isEn ? 'All' : 'Tümü' },
    { id: 'TREASURES', label: isEn ? 'Treasures' : 'Hazine' },
    { id: 'FACTIONS', label: isEn ? 'Nations' : 'Devletler' },
    { id: 'TRADERS', label: isEn ? 'Traders' : 'Tüccar' },
  ];
  const isMobileView = useMobileLayout || isCompactViewport;
  const activeFilterLabel = filterOptions.find((f) => f.id === filter)?.label ?? filterOptions[0].label;
  const connectedOnlinePlayers = onlineMode ? onlinePlayers.filter((p) => p.connected) : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#083A52] flex flex-col overflow-hidden overscroll-none select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Open World Map' : 'Açık Dünya Haritası'}
    >
      <div className="w-full h-full bg-[#0F2936] flex flex-col overflow-hidden">
        {/* Header - strictly single row without horizontal or vertical scroll */}
        <div
          className={`relative z-30 border-b border-white/10 flex flex-nowrap items-center justify-between gap-2 shrink-0 bg-[#0F2936] ${
            isMobileView ? 'px-3 h-12' : 'px-5 h-14'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-5 h-5 text-sky-300 shrink-0" />
            <h2
              className={`font-display font-bold text-slate-50 truncate ${
                isMobileView ? 'text-sm' : 'text-lg'
              }`}
            >
              {isEn ? 'World Map' : 'Dünya Haritası'}
            </h2>
            {!isMobileView && (
              <span className="hidden lg:inline text-xs text-slate-300 font-mono-num whitespace-nowrap">
                {discoveredCount} {isEn ? 'Islands' : 'Ada'} · {totalOpened}{' '}
                {isEn ? 'Treasures' : 'Hazine'} · {kingdom.conqueredIslandIds.length}{' '}
                {isEn ? 'Conquered' : 'Fetih'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isMobileView ? (
              /* Desktop Inline Filter Tabs & Rings Toggle */
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/50 border border-white/10">
                  {filterOptions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    showRings
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isEn ? 'Rings' : 'Mesafe'}
                </button>
              </div>
            ) : (
              /* Mobile Collapsible Filter Dropdown */
              <div ref={filterMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMenuOpen((o) => !o);
                    setLegendMenuOpen(false);
                  }}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="menu"
                  className={`h-9 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    filter !== 'ALL' || filterMenuOpen
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-slate-950/60 border-white/15 text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>{filter === 'ALL' ? (isEn ? 'Filters' : 'Filtreler') : activeFilterLabel}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      filterMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {filterMenuOpen && (
                  <div
                    role="menu"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#0B222E]/96 backdrop-blur-md border border-white/15 shadow-2xl p-3 z-50"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[11px] text-slate-300 font-mono-num">
                      <span>
                        {discoveredCount} {isEn ? 'Islands' : 'Ada'}
                      </span>
                      <span>
                        {totalOpened} {isEn ? 'Treasures' : 'Hazine'}
                      </span>
                      <span>
                        {kingdom.conqueredIslandIds.length} {isEn ? 'Conquered' : 'Fetih'}
                      </span>
                    </div>

                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 px-1">
                      {isEn ? 'Map Filter' : 'Harita Filtresi'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                      {filterOptions.map((f) => {
                        const active = filter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setFilter(f.id);
                              setFilterMenuOpen(false);
                            }}
                            className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-amber-500 border-amber-300 text-slate-950'
                                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <span>{f.label}</span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRings((r) => !r)}
                      className={`w-full h-9 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-colors cursor-pointer ${
                        showRings
                          ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{isEn ? 'Distance Rings' : 'Mesafe Halkaları'}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          showRings ? 'bg-sky-400/25 text-sky-100' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {showRings ? (isEn ? 'ON' : 'AÇIK') : isEn ? 'OFF' : 'KAPALI'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Map' : 'Haritayı Kapat'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Map Canvas */}
        <div className="relative flex-1 min-h-0 bg-[#083A52]">
          <canvas
            ref={canvasRef}
            onWheel={(e) => {
              e.preventDefault();
              const factor = e.deltaY < 0 ? 1.16 : 0.86;
              const oldZoom = zoomRef.current;
              const newZoom = applyZoom(oldZoom * factor);
              if (canvasRef.current && newZoom !== oldZoom) {
                const rect = canvasRef.current.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const wx = offsetRef.current.x + (sx - rect.width / 2) / oldZoom;
                const wy = offsetRef.current.y + (sy - rect.height / 2) / oldZoom;
                applyOffset({
                  x: wx - (sx - rect.width / 2) / newZoom,
                  y: wy - (sy - rect.height / 2) / newZoom,
                });
              }
            }}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Ignore if pointer capture is unavailable
              }
              activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

              if (activePointersRef.current.size >= 2) {
                const pts = Array.from(activePointersRef.current.values());
                const p1 = pts[0];
                const p2 = pts[1];
                pinchRef.current = {
                  lastDist: Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
                  lastMidX: (p1.x + p2.x) / 2,
                  lastMidY: (p1.y + p2.y) / 2,
                };
                wasPinchRef.current = true;
                dragRef.current.moved = true;
                dragRef.current.active = false;
              } else {
                wasPinchRef.current = false;
                pinchRef.current = null;
                const dismissedMenu = dismissedMenuRef.current;
                dismissedMenuRef.current = false;
                dragRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  lastX: e.clientX,
                  lastY: e.clientY,
                  moved: dismissedMenu,
                };
              }
            }}
            onPointerMove={(e) => {
              if (!activePointersRef.current.has(e.pointerId)) return;
              activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

              if (activePointersRef.current.size >= 2) {
                const pts = Array.from(activePointersRef.current.values());
                const p1 = pts[0];
                const p2 = pts[1];
                const newDist = Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y));
                const newMidX = (p1.x + p2.x) / 2;
                const newMidY = (p1.y + p2.y) / 2;

                if (!pinchRef.current) {
                  pinchRef.current = { lastDist: newDist, lastMidX: newMidX, lastMidY: newMidY };
                  return;
                }

                const scaleFactor = newDist / Math.max(8, pinchRef.current.lastDist);
                const oldZoom = zoomRef.current;
                const newZoom = applyZoom(oldZoom * scaleFactor);

                if (canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const sx0 = pinchRef.current.lastMidX - rect.left;
                  const sy0 = pinchRef.current.lastMidY - rect.top;
                  const sx1 = newMidX - rect.left;
                  const sy1 = newMidY - rect.top;
                  const wx = offsetRef.current.x + (sx0 - rect.width / 2) / oldZoom;
                  const wy = offsetRef.current.y + (sy0 - rect.height / 2) / oldZoom;
                  applyOffset({
                    x: wx - (sx1 - rect.width / 2) / newZoom,
                    y: wy - (sy1 - rect.height / 2) / newZoom,
                  });
                }

                pinchRef.current = { lastDist: newDist, lastMidX: newMidX, lastMidY: newMidY };
                wasPinchRef.current = true;
                dragRef.current.moved = true;
                return;
              }

              if (!dragRef.current.active) return;
              if (
                Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) >
                12
              ) {
                dragRef.current.moved = true;
              }
              const curZoom = zoomRef.current;
              const dx = (e.clientX - dragRef.current.lastX) / curZoom;
              const dy = (e.clientY - dragRef.current.lastY) / curZoom;
              dragRef.current.lastX = e.clientX;
              dragRef.current.lastY = e.clientY;
              applyOffset({
                x: offsetRef.current.x - dx,
                y: offsetRef.current.y - dy,
              });
            }}
            onPointerUp={(e) => {
              activePointersRef.current.delete(e.pointerId);

              if (activePointersRef.current.size >= 2) {
                const pts = Array.from(activePointersRef.current.values());
                pinchRef.current = {
                  lastDist: Math.max(8, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
                  lastMidX: (pts[0].x + pts[1].x) / 2,
                  lastMidY: (pts[0].y + pts[1].y) / 2,
                };
                return;
              }

              pinchRef.current = null;
              if (activePointersRef.current.size === 1) {
                const rem = Array.from(activePointersRef.current.values())[0];
                dragRef.current = {
                  active: true,
                  startX: rem.x,
                  startY: rem.y,
                  lastX: rem.x,
                  lastY: rem.y,
                  moved: true,
                };
                return;
              }

              const wasClick =
                dragRef.current.active && !dragRef.current.moved && !wasPinchRef.current;
              dragRef.current.active = false;
              wasPinchRef.current = false;

              if (wasClick && onSetMapPin && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const curZoom = zoomRef.current;
                const wx = offsetRef.current.x + (sx - rect.width / 2) / curZoom;
                const wy = offsetRef.current.y + (sy - rect.height / 2) / curZoom;

                // Clicking existing pin toggles/removes it
                if (mapPin && Math.hypot(wx - mapPin.x, wy - mapPin.y) <= Math.max(150, 26 / curZoom)) {
                  onSetMapPin(null);
                  return;
                }

                // Auto-label with discovered nearby island (or online starter island) name if close
                let label = isEn ? 'Waypoint' : 'İşaret';
                const discoveredSet = new Set(discoveredIslandIds);
                const candidateIslands = [
                  ...worldManager.getVisibleIslands(wx, wy, 1),
                  ...(onlineMode ? worldManager.getStarterIslands() : []),
                ];
                const nearIsl = candidateIslands.find(
                  (isl) =>
                    (discoveredSet.has(isl.id) || (onlineMode && isl.isStarter)) &&
                    Math.hypot(wx - isl.centerX, wy - isl.centerY) <= isl.maxRadius + 180
                );
                if (nearIsl) {
                  label = nearIsl.name;
                }
                onSetMapPin({ x: Math.round(wx), y: Math.round(wy), label });
              }
            }}
            onPointerCancel={(e) => {
              activePointersRef.current.delete(e.pointerId);
              if (activePointersRef.current.size < 2) {
                pinchRef.current = null;
              }
              if (activePointersRef.current.size === 1) {
                const rem = Array.from(activePointersRef.current.values())[0];
                dragRef.current = {
                  active: true,
                  startX: rem.x,
                  startY: rem.y,
                  lastX: rem.x,
                  lastY: rem.y,
                  moved: true,
                };
              } else if (activePointersRef.current.size === 0) {
                dragRef.current.active = false;
                wasPinchRef.current = false;
              }
            }}
            className="w-full h-full cursor-crosshair active:cursor-grabbing touch-none"
          />

          {/* Active Waypoint Quick Bar / Placement Hint */}
          {mapPin ? (
            <div className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F2936]/95 border border-rose-400/50 shadow-lg text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
              <button
                type="button"
                onClick={() => applyOffset({ x: mapPin.x, y: mapPin.y })}
                className="font-semibold text-rose-100 hover:text-white truncate max-w-[160px] cursor-pointer text-left"
                title={isEn ? 'Center on Waypoint' : 'İşarete Odaklan'}
              >
                {mapPin.label}
                {pinDistM !== null && (
                  <span className="ml-1.5 font-mono-num text-rose-300">
                    ({pinDistM >= 1000 ? `${(pinDistM / 1000).toFixed(1)}km` : `${pinDistM}m`})
                  </span>
                )}
              </button>
              {onSetMapPin && (
                <button
                  type="button"
                  onClick={() => onSetMapPin(null)}
                  className="ml-1 p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 cursor-pointer"
                  title={isEn ? 'Remove Waypoint' : 'İşareti Kaldır'}
                  aria-label={isEn ? 'Remove Waypoint' : 'İşareti Kaldır'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F2936]/80 border border-white/15 shadow-md text-[11px] text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">
                {isEn
                  ? 'Tap to mark · Pinch to zoom'
                  : 'Dokun: işaretle · İki parmak: yakınlaştır'}
              </span>
            </div>
          )}

          {/* Mobile Collapsible Legend & Players Drawer */}
          {isMobileView && (
            <div ref={legendMenuRef} className="absolute bottom-3 left-3 z-30">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setLegendMenuOpen((o) => !o);
                  setFilterMenuOpen(false);
                }}
                aria-expanded={legendMenuOpen}
                aria-haspopup="dialog"
                className={`min-h-[40px] px-3 py-2 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap backdrop-blur-md ${
                  legendMenuOpen
                    ? 'bg-sky-500/25 border-sky-300/60 text-sky-100'
                    : 'bg-[#0F2936]/92 border-white/20 text-slate-100 hover:bg-[#173D4F]'
                }`}
              >
                <Layers className="w-4 h-4 text-sky-300 shrink-0" />
                <span>{isEn ? 'Legend' : 'Belirteçler'}</span>
                {onlineMode && connectedOnlinePlayers.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-200 text-[10px] font-mono-num">
                    {connectedOnlinePlayers.length}
                  </span>
                )}
                <ChevronUp
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    legendMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {legendMenuOpen && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-0 mb-2 w-[min(19.5rem,calc(100vw-1.5rem))] max-h-[52vh] overflow-y-auto overscroll-contain rounded-2xl bg-[#0B222E]/96 backdrop-blur-md border border-white/15 shadow-2xl p-3.5 text-xs text-slate-200 z-50"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
                    <span className="font-display font-bold text-slate-50">
                      {isEn ? 'Markers & Players' : 'Belirteçler & Oyuncular'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLegendMenuOpen(false)}
                      aria-label={isEn ? 'Close Legend' : 'Belirteçleri Kapat'}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${
                          colorblindMode ? 'bg-cyan-400' : 'bg-emerald-400'
                        }`}
                      />
                      {isEn ? 'Player' : 'Oyuncu'}
                    </span>
                    <span className="flex items-center gap-2">
                      <Ship className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      {isEn ? 'Ship' : 'Tekne'}
                    </span>
                    <span className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {isEn ? 'Trader' : 'Tüccar'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block bg-sky-400 shrink-0" />
                      {isEn ? 'City' : 'Kent'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block bg-orange-500 shrink-0" />
                      {isEn ? 'Arena' : 'Arena'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block bg-purple-400 shrink-0" />
                      {isEn ? 'Cave / Secret' : 'Mağara / Gizli'}
                    </span>
                    {kingdom.founded && (
                      <span className="col-span-2 flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: kingdom.bannerColor }} />
                        <span className="truncate">{kingdom.name}</span>
                      </span>
                    )}
                  </div>

                  {!onlineMode && (
                    <div className="pt-2.5 border-t border-white/10 mb-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                        {isEn ? 'Nations' : 'Devletler'}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {ENEMY_FACTION_LIST.map((f) => {
                          const atWar = kingdom.atWarWith.includes(f.id);
                          return (
                            <span key={f.id} className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: f.color }}
                              />
                              <span className="truncate">{f.shortName}</span>
                              {atWar && (
                                <span className="text-[9px] font-bold text-rose-300 shrink-0">
                                  {isEn ? 'War' : 'Savaş'}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {onlineMode && (
                    <div className="pt-2.5 border-t border-white/10 mb-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                        {isEn ? 'Online Players' : 'Çevrimiçi Oyuncular'}
                      </p>
                      {connectedOnlinePlayers.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {connectedOnlinePlayers.map((p) => (
                            <span key={p.id} className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: p.bannerColor }}
                              />
                              <span className="truncate">{p.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          {isEn ? 'No other players connected' : 'Bağlı başka oyuncu yok'}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="pt-2 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
                    {isEn
                      ? 'Tap to place/remove waypoint · Drag to pan · Pinch to zoom.'
                      : 'Dokunarak işaret koyabilir, sürükleyerek gezebilir ve iki parmakla yakınlaştırabilirsiniz.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Zoom & Center Controls */}
          <div
            className={`absolute z-20 flex flex-col gap-2 ${
              isMobileView ? 'bottom-3 right-3' : 'bottom-4 right-4'
            }`}
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => applyZoom(zoomRef.current * 1.25)}
              aria-label={isEn ? 'Zoom In' : 'Yakınlaştır'}
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => applyZoom(zoomRef.current * 0.8)}
              aria-label={isEn ? 'Zoom Out' : 'Uzaklaştır'}
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => applyOffset({ x: playerPos.x, y: playerPos.y })}
              aria-label={isEn ? 'Center on Player' : 'Konumuma Odaklan'}
              title={isEn ? 'Center on Player' : 'Konumuma Odaklan'}
              className="w-10 h-10 rounded-xl bg-amber-500 border border-amber-200 text-slate-950 hover:bg-amber-400 flex items-center justify-center shadow-lg cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Legend Footer */}
        {!isMobileView && (
          <div className="flex px-5 py-2.5 border-t border-white/10 items-center justify-between gap-x-4 gap-y-1.5 text-xs text-slate-300 shrink-0">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
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
                connectedOnlinePlayers.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: p.bannerColor }}
                    />
                    {p.name}
                  </span>
                ))}
            </div>
            <span className="text-slate-400 whitespace-nowrap">
              {isEn
                ? 'Click to place/remove waypoint · Drag to pan'
                : 'Tıklayarak konum işareti koyabilir · Sürükleyerek gezebilirsiniz'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

