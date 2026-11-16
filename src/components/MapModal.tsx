import React, { useEffect, useRef, useState } from 'react';
import { Compass, Flag, MapPin, Ship, Store, X, ZoomIn, ZoomOut } from 'lucide-react';
import { DigCrater, Island, KingdomState, Vec2 } from '../types/game';
import { SECTOR_SIZE, WorldManager } from '../engine/worldGen';
import { ENEMY_FACTION_LIST, getEffectiveIslandFaction, getFactionDisplay } from '../engine/factions';

interface MapModalProps {
  worldManager: WorldManager;
  discoveredIslandIds: string[];
  openedTreasureIds: string[];
  dugCraters: DigCrater[];
  kingdom: KingdomState;
  playerPos: Vec2;
  boatPos: Vec2;
  isSailing: boolean;
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
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(0.085);
  const [offset, setOffset] = useState<Vec2>({ x: playerPos.x, y: playerPos.y });
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
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

    // Ensure every discovered island is included even if outside current grid
    for (const id of discoveredIslandIds) {
      if (!islandsToDraw.some((item) => item.island.id === id)) {
        const isl = worldManager.getIslandById(id);
        if (isl) islandsToDraw.push({ island: isl, discovered: true });
      }
    }

    for (const { island, discovered } of islandsToDraw) {
      const effFaction = getEffectiveIslandFaction(
        island.factionId,
        island.id,
        island.isStarter,
        kingdom
      );
      const factionInfo = getFactionDisplay(effFaction, kingdom);
      const isAtWar =
        effFaction !== 'NEUTRAL' &&
        effFaction !== 'PLAYER' &&
        kingdom.atWarWith.includes(effFaction);

      if (discovered) {
        // Shallow ring (tinted subtly by faction territory if claimed)
        ctx.fillStyle =
          effFaction === 'NEUTRAL'
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

        if (effFaction !== 'NEUTRAL') {
          ctx.strokeStyle = factionInfo.color;
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
        ctx.fillStyle = '#5CA44E';
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

        // Landmarks (Temples, Bastions, Towers, Villages, Camps, Obelisks, Ruins, Shipwrecks)
        for (const lm of island.landmarks) {
          ctx.fillStyle =
            lm.type === 'TEMPLE' || lm.type === 'RUINS'
              ? '#CBD5E1'
              : lm.type === 'TOWER' || lm.type === 'BASTION'
              ? '#94A3B8'
              : lm.type === 'OBELISK'
              ? '#22D3EE'
              : lm.type === 'SHIPWRECK'
              ? '#92400E'
              : '#D97706';
          ctx.beginPath();
          ctx.arc(lm.x, lm.y, 4.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fort / Faction Flag marker
        if (island.fortPos && effFaction !== 'NEUTRAL') {
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
        }

        // Island label
        const remainingTreasures = island.treasures.filter((t) => !openedSet.has(t.id)).length;
        ctx.fillStyle = effFaction === 'PLAYER' ? '#A7F3D0' : isAtWar ? '#FCA5A5' : '#F8FAFC';
        ctx.font = `600 ${Math.round(11 / zoom)}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        const ownerSuffix =
          effFaction === 'NEUTRAL' ? '' : ` · ${factionInfo.shortName}${isAtWar ? ' [Savaş]' : ''}`;
        ctx.fillText(
          `${island.name}${remainingTreasures === 0 ? ' (Temiz)' : ` (${remainingTreasures})`}${ownerSuffix}`,
          island.centerX,
          island.centerY - island.maxRadius - 14 / zoom
        );
      } else {
        // Uncharted fogged silhouette (shows faint nation border if belonging to a major state!)
        ctx.fillStyle = 'rgba(15, 41, 54, 0.55)';
        ctx.strokeStyle =
          effFaction !== 'NEUTRAL'
            ? `${factionInfo.color}66`
            : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = (effFaction !== 'NEUTRAL' ? 2.2 : 1.5) / zoom;
        ctx.beginPath();
        ctx.arc(island.centerX, island.centerY, island.baseRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Dug craters
    ctx.fillStyle = '#7C5430';
    for (const c of dugCraters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2.5 / zoom, 10), 0, Math.PI * 2);
      ctx.fill();
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
      ctx.fillStyle = '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(playerPos.x, playerPos.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }, [worldManager, discoveredIslandIds, openedTreasureIds, dugCraters, kingdom, playerPos, boatPos, isSailing, zoom, offset]);

  const discoveredCount = discoveredIslandIds.length;
  const totalOpened = openedTreasureIds.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Açık Dünya Haritası"
    >
      <div className="w-full max-w-4xl h-[88vh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Compass className="w-5 h-5 text-sky-300 shrink-0" />
            <h2 className="font-display text-lg font-bold text-slate-50 truncate">
              Açık Dünya & Devletler Haritası
            </h2>
            <span className="hidden sm:inline text-xs text-slate-300 font-mono-num">
              {discoveredCount} Ada · {totalOpened} Hazine · {kingdom.conqueredIslandIds.length} Fetih
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Haritayı Kapat"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Map Canvas */}
        <div className="relative flex-1 bg-[#083A52]">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return;
              const dx = (e.clientX - dragRef.current.lastX) / zoom;
              const dy = (e.clientY - dragRef.current.lastY) / zoom;
              dragRef.current.lastX = e.clientX;
              dragRef.current.lastY = e.clientY;
              setOffset((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
            }}
            onPointerUp={() => {
              dragRef.current.active = false;
            }}
            onPointerCancel={() => {
              dragRef.current.active = false;
            }}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
          />

          {/* Zoom & Center Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(0.24, z * 1.25))}
              aria-label="Yakınlaştır"
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.03, z * 0.8))}
              aria-label="Uzaklaştır"
              className="w-10 h-10 rounded-xl bg-[#0F2936]/90 border border-white/20 text-slate-100 hover:bg-[#173D4F] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setOffset({ x: playerPos.x, y: playerPos.y })}
              aria-label="Konumuma Odaklan"
              title="Konumuma Odaklan"
              className="w-10 h-10 rounded-xl bg-amber-500 border border-amber-200 text-slate-950 hover:bg-amber-400 flex items-center justify-center shadow-lg cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Unboxed Legend Footer */}
        <div className="px-5 py-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Oyuncu
            </span>
            <span className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-sky-400" />
              Tekne
            </span>
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              Tüccar
            </span>
            {kingdom.founded && (
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" style={{ color: kingdom.bannerColor }} />
                {kingdom.name}
              </span>
            )}
            {ENEMY_FACTION_LIST.map((f) => (
              <span key={f.id} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: f.color }}
                />
                {f.shortName}
              </span>
            ))}
          </div>
          <span className="text-slate-400">Haritayı sürükleyerek gezebilirsiniz</span>
        </div>
      </div>
    </div>
  );
};
