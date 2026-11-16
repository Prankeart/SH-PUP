import {
  AllyShip,
  AllySoldier,
  Cannonball,
  DigCrater,
  EnemyShip,
  FloatingLoot,
  FloatingText,
  HeatTier,
  Island,
  IslandEnemy,
  KingdomState,
  LandProjectile,
  Landmark,
  Particle,
  RadarPulseEffect,
  Vec2,
  WaterRipple,
  WeaponId,
  WeaponPickup,
} from '../types/game';
import { WEAPONS } from './weapons';
import { getShipClass } from './upgrades';
import { ENEMY_FACTIONS, getEffectiveIslandFaction, getFactionDisplay } from './factions';
import { clamp } from '../utils/prng';

export interface RenderState {
  timeSec: number;
  camera: Vec2;
  zoom: number;
  screenShake: number;
  islands: Island[];
  craters: DigCrater[];
  openedTreasureIds: Set<string>;
  collectedPickupIds: Set<string>;
  player: {
    x: number;
    y: number;
    angle: number;
    isSailing: boolean;
    walkPhase: number;
    digAnimProgress: number;
    attackAnimProgress: number;
    equippedWeapon: WeaponId | null;
    hitFlash: boolean;
    canDig: boolean;
    digTarget: Vec2 | null;
  };
  boat: {
    x: number;
    y: number;
    angle: number;
    speedRatio: number;
    boatLevel: number;
    cannonCountPerSide: number;
    hitFlash: boolean;
  };
  enemies: EnemyShip[];
  allyShips: AllyShip[];
  islandEnemies: IslandEnemy[];
  allySoldiers: AllySoldier[];
  landProjectiles: LandProjectile[];
  cannonballs: Cannonball[];
  floatingLoot: FloatingLoot[];
  waterRipples: WaterRipple[];
  radarPulses: RadarPulseEffect[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  kingdom: KingdomState;
  fortCapture: { islandId: string; progress: number; defendersLeft: number } | null;
  showWaves: boolean;
  nearBoat: boolean;
  nearDock: boolean;
}

const HEAT_COLORS: Record<HeatTier, string> = {
  HOT: '#EF4444',
  WARM: '#F59E0B',
  COOL: '#38BDF8',
  COLD: '#93C5FD',
  NONE: '#94A3B8',
};

function drawSmoothClosedPolygon(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  if (pts.length < 3) return;
  ctx.beginPath();
  const len = pts.length;
  const firstMidX = (pts[len - 1].x + pts[0].x) / 2;
  const firstMidY = (pts[len - 1].y + pts[0].y) / 2;
  ctx.moveTo(firstMidX, firstMidY);
  for (let i = 0; i < len; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % len];
    const midX = (p.x + next.x) / 2;
    const midY = (p.y + next.y) / 2;
    ctx.quadraticCurveTo(p.x, p.y, midX, midY);
  }
  ctx.closePath();
}

interface CachedIslandCanvas {
  islandRef: Island;
  canvas: HTMLCanvasElement;
  halfSize: number;
}

const islandTerrainCache = new Map<string, CachedIslandCanvas>();
const MAX_CACHED_ISLANDS = 8;

const BIOME_PALETTES = {
  TROPICAL: {
    sand: '#F2D399',
    sandStroke: '#DFBA73',
    grass: '#5CA44E',
    grassStroke: '#4B8E3F',
    highland: '#6BB45A',
  },
  JUNGLE: {
    sand: '#E8C589',
    sandStroke: '#CFA45E',
    grass: '#458B42',
    grassStroke: '#356E33',
    highland: '#529C4E',
  },
  OASIS: {
    sand: '#F7DAA0',
    sandStroke: '#E4C076',
    grass: '#68B454',
    grassStroke: '#50963E',
    highland: '#7AC466',
  },
  VOLCANIC: {
    sand: '#D4B684',
    sandStroke: '#9E8560',
    grass: '#4E7A45',
    grassStroke: '#3A5E34',
    highland: '#5C6B57',
  },
  RUINS: {
    sand: '#EAD09C',
    sandStroke: '#D0B074',
    grass: '#639C52',
    grassStroke: '#4D7E3F',
    highland: '#74AC62',
  },
} as const;

function getIslandTerrainCanvas(island: Island): CachedIslandCanvas {
  const existing = islandTerrainCache.get(island.id);
  if (existing && existing.islandRef === island) {
    islandTerrainCache.delete(island.id);
    islandTerrainCache.set(island.id, existing);
    return existing;
  }

  const palette = BIOME_PALETTES[island.biome ?? 'TROPICAL'];
  const halfSize = Math.ceil(island.maxRadius * 1.26) + 16;
  const canvas = document.createElement('canvas');
  canvas.width = halfSize * 2;
  canvas.height = halfSize * 2;
  const octx = canvas.getContext('2d');
  if (octx) {
    octx.translate(halfSize - island.centerX, halfSize - island.centerY);

    octx.save();
    octx.translate(island.centerX, island.centerY);
    octx.scale(1.22, 1.22);
    octx.translate(-island.centerX, -island.centerY);
    octx.fillStyle = '#158FA6';
    drawSmoothClosedPolygon(octx, island.coastPoints);
    octx.fill();
    octx.restore();

    octx.save();
    octx.translate(island.centerX, island.centerY);
    octx.scale(1.1, 1.1);
    octx.translate(-island.centerX, -island.centerY);
    octx.fillStyle = '#24B4C9';
    drawSmoothClosedPolygon(octx, island.coastPoints);
    octx.fill();
    octx.restore();

    octx.save();
    octx.translate(island.centerX, island.centerY);
    octx.scale(1.03, 1.03);
    octx.translate(-island.centerX, -island.centerY);
    octx.strokeStyle = 'rgba(240, 253, 255, 0.62)';
    octx.lineWidth = 7;
    drawSmoothClosedPolygon(octx, island.coastPoints);
    octx.stroke();
    octx.restore();

    octx.fillStyle = palette.sand;
    octx.strokeStyle = palette.sandStroke;
    octx.lineWidth = 4;
    drawSmoothClosedPolygon(octx, island.coastPoints);
    octx.fill();
    octx.stroke();

    octx.fillStyle = palette.grass;
    octx.strokeStyle = palette.grassStroke;
    octx.lineWidth = 3;
    drawSmoothClosedPolygon(octx, island.grassPoints);
    octx.fill();
    octx.stroke();

    // Subtle inner highland plateau on large islands
    if (island.isLarge) {
      octx.save();
      octx.translate(island.centerX, island.centerY);
      octx.scale(0.56, 0.56);
      octx.translate(-island.centerX, -island.centerY);
      octx.fillStyle = palette.highland;
      octx.globalAlpha = 0.55;
      drawSmoothClosedPolygon(octx, island.grassPoints);
      octx.fill();
      octx.restore();
    }

    // Worn sandy/cobble footpaths connecting fort, landmarks & docks
    if (island.roads && island.roads.length > 0) {
      octx.save();
      octx.lineCap = 'round';
      octx.strokeStyle = 'rgba(218, 180, 114, 0.72)';
      octx.lineWidth = 14;
      octx.beginPath();
      for (const rd of island.roads) {
        octx.moveTo(rd.from.x, rd.from.y);
        octx.quadraticCurveTo(rd.ctrl.x, rd.ctrl.y, rd.to.x, rd.to.y);
      }
      octx.stroke();

      octx.strokeStyle = 'rgba(182, 140, 82, 0.38)';
      octx.lineWidth = 7;
      octx.setLineDash([6, 8]);
      octx.beginPath();
      for (const rd of island.roads) {
        octx.moveTo(rd.from.x, rd.from.y);
        octx.quadraticCurveTo(rd.ctrl.x, rd.ctrl.y, rd.to.x, rd.to.y);
      }
      octx.stroke();
      octx.restore();
    }

    // Inland lakes / oasis lagoons / volcanic crater pools
    for (const lake of island.lakes ?? []) {
      // Bank rim
      octx.save();
      octx.translate(lake.x, lake.y);
      octx.scale(1.16, 1.16);
      octx.translate(-lake.x, -lake.y);
      octx.fillStyle = lake.isVolcanicCrater ? '#57534E' : '#E7C88B';
      drawSmoothClosedPolygon(octx, lake.points);
      octx.fill();
      octx.restore();

      // Water body
      octx.fillStyle = lake.isVolcanicCrater ? '#0E7490' : '#22B8CF';
      octx.strokeStyle = lake.isVolcanicCrater ? '#292524' : '#0E8DA3';
      octx.lineWidth = 2.4;
      drawSmoothClosedPolygon(octx, lake.points);
      octx.fill();
      octx.stroke();

      // Inner shimmer highlight
      octx.save();
      octx.translate(lake.x, lake.y);
      octx.scale(0.68, 0.68);
      octx.translate(-lake.x, -lake.y);
      octx.fillStyle = 'rgba(186, 230, 253, 0.42)';
      drawSmoothClosedPolygon(octx, lake.points);
      octx.fill();
      octx.restore();
    }

    // Pre-bake tropical foliage (ferns, hibiscus flowers, beach crate supplies)
    for (const fol of island.foliage ?? []) {
      octx.save();
      octx.translate(fol.x, fol.y);
      octx.rotate(fol.rotation);
      if (fol.kind === 'CRATE_PILE') {
        octx.fillStyle = 'rgba(15, 23, 42, 0.2)';
        octx.fillRect(-7, -5, 16, 13);
        octx.fillStyle = '#92400E';
        octx.strokeStyle = '#451A03';
        octx.lineWidth = 1.4;
        octx.fillRect(-8, -7, 10, 10);
        octx.strokeRect(-8, -7, 10, 10);
        octx.fillStyle = '#B45309';
        octx.fillRect(0, -3, 8, 8);
        octx.strokeRect(0, -3, 8, 8);
      } else if (fol.kind === 'FLOWERS') {
        octx.fillStyle = '#3F8A3A';
        octx.beginPath();
        octx.arc(0, 0, fol.radius * 0.75, 0, Math.PI * 2);
        octx.fill();
        octx.fillStyle = fol.color;
        for (let k = 0; k < 4; k++) {
          const fa = (k / 4) * Math.PI * 2;
          octx.beginPath();
          octx.arc(Math.cos(fa) * 4, Math.sin(fa) * 4, 2.5, 0, Math.PI * 2);
          octx.fill();
        }
      } else {
        octx.fillStyle = fol.color;
        for (let f = 0; f < 5; f++) {
          const fa = (f / 5) * Math.PI * 2;
          octx.save();
          octx.rotate(fa);
          octx.beginPath();
          octx.ellipse(fol.radius * 0.48, 0, fol.radius * 0.52, 2.7, 0, 0, Math.PI * 2);
          octx.fill();
          octx.restore();
        }
      }
      octx.restore();
    }

    // Pre-bake static coastal rocks into island canvas
    for (const rock of island.rocks) {
      octx.save();
      octx.translate(rock.x, rock.y);
      octx.rotate(rock.rotation);
      octx.fillStyle = 'rgba(15, 23, 42, 0.16)';
      octx.beginPath();
      octx.arc(3, 4, rock.radius, 0, Math.PI * 2);
      octx.fill();

      octx.fillStyle = island.biome === 'VOLCANIC' ? '#57534E' : '#788496';
      octx.strokeStyle = island.biome === 'VOLCANIC' ? '#292524' : '#525E70';
      octx.lineWidth = 1.5;
      drawSmoothClosedPolygon(octx, rock.points);
      octx.fill();
      octx.stroke();
      octx.restore();
    }
  }

  const entry: CachedIslandCanvas = { islandRef: island, canvas, halfSize };
  islandTerrainCache.set(island.id, entry);
  if (islandTerrainCache.size > MAX_CACHED_ISLANDS) {
    const oldestKey = islandTerrainCache.keys().next().value;
    if (oldestKey !== undefined) islandTerrainCache.delete(oldestKey);
  }
  return entry;
}

const palmCanopyCache = new Map<string, HTMLCanvasElement>();
const palmShadowCache = new Map<number, HTMLCanvasElement>();
const PALM_SPRITE_HALF = 56;
const PALM_SPRITE_SCALE = 1.5;

function getPalmShadowSprite(frondCount: number): HTMLCanvasElement {
  const existing = palmShadowCache.get(frondCount);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = PALM_SPRITE_HALF * 2;
  canvas.height = PALM_SPRITE_HALF * 2;
  const sctx = canvas.getContext('2d');
  if (sctx) {
    sctx.translate(PALM_SPRITE_HALF, PALM_SPRITE_HALF);
    sctx.fillStyle = 'rgba(7, 36, 48, 0.24)';
    for (let i = 0; i < frondCount; i++) {
      const a = (i / frondCount) * Math.PI * 2;
      sctx.save();
      sctx.rotate(a);
      sctx.beginPath();
      sctx.ellipse(22, 0, 22, 7.5, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
    }
  }
  palmShadowCache.set(frondCount, canvas);
  return canvas;
}

function getPalmCanopySprite(frondCount: number, hasCoconuts: boolean): HTMLCanvasElement {
  const key = `${frondCount}_${hasCoconuts ? 1 : 0}`;
  const existing = palmCanopyCache.get(key);
  if (existing) return existing;

  const size = Math.round(PALM_SPRITE_HALF * 2 * PALM_SPRITE_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pctx = canvas.getContext('2d');
  if (pctx) {
    pctx.scale(PALM_SPRITE_SCALE, PALM_SPRITE_SCALE);
    pctx.translate(PALM_SPRITE_HALF, PALM_SPRITE_HALF);

    for (let i = 0; i < frondCount; i++) {
      const a = (i / frondCount) * Math.PI * 2;
      pctx.save();
      pctx.rotate(a);

      pctx.fillStyle = i % 2 === 0 ? '#1E7E45' : '#269452';
      pctx.beginPath();
      pctx.moveTo(2, 0);
      pctx.quadraticCurveTo(22, -13, 44, -2);
      pctx.quadraticCurveTo(22, 12, 2, 0);
      pctx.fill();

      pctx.strokeStyle = '#4ADE80';
      pctx.lineWidth = 1.2;
      pctx.globalAlpha = 0.45;
      pctx.beginPath();
      pctx.moveTo(4, 0);
      pctx.quadraticCurveTo(22, -2, 39, -1);
      pctx.stroke();
      pctx.globalAlpha = 1;
      pctx.restore();
    }

    if (hasCoconuts) {
      pctx.fillStyle = '#5C3A1E';
      [
        { cx: -3, cy: 3 },
        { cx: 3.5, cy: 2 },
        { cx: 0, cy: -3.5 },
      ].forEach((c) => {
        pctx.beginPath();
        pctx.arc(c.cx, c.cy, 3.6, 0, Math.PI * 2);
        pctx.fill();
      });
    }

    pctx.fillStyle = '#34B267';
    pctx.beginPath();
    pctx.arc(0, 0, 5.2, 0, Math.PI * 2);
    pctx.fill();
  }
  palmCanopyCache.set(key, canvas);
  return canvas;
}

function drawLandmark(ctx: CanvasRenderingContext2D, lm: Landmark, timeSec: number) {
  ctx.save();
  ctx.translate(lm.x, lm.y);

  if (lm.type === 'TEMPLE') {
    ctx.rotate(lm.rotation);
    // Ground shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.fillRect(-40, -38, 86, 84);

    // Outer stepped stone terrace
    ctx.fillStyle = '#64748B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-42, -42, 84, 84, 4);
    ctx.fill();
    ctx.stroke();

    // Moss patches
    ctx.fillStyle = 'rgba(77, 124, 15, 0.55)';
    ctx.beginPath();
    ctx.arc(-28, -28, 11, 0, Math.PI * 2);
    ctx.arc(26, 24, 12, 0, Math.PI * 2);
    ctx.fill();

    // Second stepped tier
    ctx.fillStyle = '#94A3B8';
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-28, -28, 56, 56, 3);
    ctx.fill();
    ctx.stroke();

    // Inner sanctum altar
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 2);
    ctx.fill();

    // 4 Corner stone pillars
    ctx.fillStyle = '#CBD5E1';
    [
      [-32, -32],
      [32, -32],
      [-32, 32],
      [32, 32],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Flickering altar brazier flame
    const flicker = 5.5 + Math.sin(timeSec * 8 + lm.x) * 1.4;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, flicker + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, 0, flicker, 0, Math.PI * 2);
    ctx.fill();
  } else if (lm.type === 'TOWER') {
    // Watchtower shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    ctx.beginPath();
    ctx.arc(6, 7, lm.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    // Stone base
    ctx.fillStyle = '#64748B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, lm.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crenellations around tower rim
    ctx.fillStyle = '#94A3B8';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + lm.rotation;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(lm.radius - 6, -4, 7, 8);
      ctx.restore();
    }

    // Wooden lookout deck
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, lm.radius * 0.68, 0, Math.PI * 2);
    ctx.fill();

    // Hatch & lookout lantern
    ctx.fillStyle = '#451A03';
    ctx.fillRect(-5, -5, 10, 10);
    const glow = 0.75 + Math.sin(timeSec * 5 + lm.y) * 0.2;
    ctx.fillStyle = `rgba(251, 191, 36, ${glow})`;
    ctx.beginPath();
    ctx.arc(9, -8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (lm.type === 'VILLAGE') {
    // Central cobblestone campfire ring
    ctx.fillStyle = 'rgba(120, 53, 15, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    const fireR = 5 + Math.sin(timeSec * 9) * 1.2;
    ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, fireR + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, 0, fireR, 0, Math.PI * 2);
    ctx.fill();

    // Thatched village huts around the campfire
    for (const hut of lm.subOffsets ?? []) {
      ctx.save();
      ctx.translate(hut.dx, hut.dy);
      ctx.rotate(hut.rot);
      ctx.scale(hut.scale, hut.scale);

      // Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      ctx.beginPath();
      ctx.roundRect(-15, -11, 34, 26, 4);
      ctx.fill();

      // Timber walls edge
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.roundRect(-16, -13, 32, 26, 3);
      ctx.fill();

      // Thatched straw roof
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-15, -12, 30, 24, 3);
      ctx.fill();
      ctx.stroke();

      // Roof ridge pole
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();

      ctx.restore();
    }
  } else if (lm.type === 'BASTION') {
    ctx.rotate(lm.rotation);
    // Stone Citadel Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    ctx.beginPath();
    ctx.roundRect(-34, -32, 74, 72, 6);
    ctx.fill();

    // Outer Battlement Walls
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-34, -34, 68, 68, 5);
    ctx.fill();
    ctx.stroke();

    // Inner Wooden Courtyard Deck
    ctx.fillStyle = '#7C4821';
    ctx.beginPath();
    ctx.roundRect(-22, -22, 44, 44, 3);
    ctx.fill();

    // 4 Corner Turrets + Brass Cannons
    const corners: Array<[number, number, number]> = [
      [-32, -32, -Math.PI * 0.75],
      [32, -32, -Math.PI * 0.25],
      [-32, 32, Math.PI * 0.75],
      [32, 32, Math.PI * 0.25],
    ];
    for (const [cx, cy, ca] of corners) {
      ctx.fillStyle = '#94A3B8';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ca) * 14, cy + Math.sin(ca) * 14);
      ctx.stroke();
    }
  } else if (lm.type === 'CAMP') {
    // War Camp Bonfire
    const fireR = 5.5 + Math.sin(timeSec * 8 + lm.x) * 1.3;
    ctx.fillStyle = 'rgba(120, 53, 15, 0.42)';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, fireR + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, 0, fireR, 0, Math.PI * 2);
    ctx.fill();

    // Canvas Military Tents around bonfire
    const tentColors = ['#DC2626', '#D97706', '#2563EB', '#059669'];
    (lm.subOffsets ?? []).forEach((tent, idx) => {
      ctx.save();
      ctx.translate(tent.dx, tent.dy);
      ctx.rotate(tent.rot);
      ctx.scale(tent.scale, tent.scale);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      ctx.beginPath();
      ctx.roundRect(-12, -9, 28, 22, 3);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-13, -10, 26, 20, 2);
      ctx.fill();
      ctx.stroke();

      // Colored canvas stripe & ridge
      ctx.fillStyle = tentColors[idx % tentColors.length];
      ctx.fillRect(-13, -3, 26, 6);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
      ctx.restore();
    });
  } else if (lm.type === 'OBELISK') {
    // Stone Dais
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.arc(4, 5, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tapered Monolith Shadow + Body
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, 12);
    ctx.lineTo(14, 18);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-9, -9, 18, 18, 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Mystic Rune Crystal
    const pulse = 0.65 + Math.sin(timeSec * 3.5 + lm.x) * 0.28;
    ctx.fillStyle = `rgba(34, 211, 238, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (lm.type === 'RUINS') {
    ctx.rotate(lm.rotation);
    // Cracked Ancient Flagstones
    ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.beginPath();
    ctx.roundRect(-30, -24, 60, 48, 4);
    ctx.fill();

    // Mossy Broken Columns
    const cols: Array<[number, number, number]> = [
      [-20, -14, 6],
      [20, -14, 6],
      [-20, 14, 5.5],
      [18, 16, 6],
    ];
    for (const [cx, cy, cr] of cols) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 4, cr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#CBD5E1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Fallen Pillar
    ctx.fillStyle = '#94A3B8';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-10, -4, 22, 8, 2);
    ctx.fill();
    ctx.stroke();
  } else if (lm.type === 'SHIPWRECK') {
    ctx.rotate(lm.rotation);
    // Sand bank & hull shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 32, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Broken Weathered Hull
    ctx.fillStyle = '#6B3F1D';
    ctx.strokeStyle = '#3E220D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.quadraticCurveTo(6, -16, -24, -10);
    ctx.lineTo(-16, 10);
    ctx.quadraticCurveTo(8, 16, 30, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Exposed Wooden Deck Ribs
    ctx.strokeStyle = '#A1622B';
    ctx.lineWidth = 2.2;
    for (let rx = -14; rx <= 14; rx += 7) {
      ctx.beginPath();
      ctx.moveTo(rx, -9);
      ctx.lineTo(rx, 9);
      ctx.stroke();
    }

    // Snapped Fallen Mast
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(18, -18);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWeaponPickup(ctx: CanvasRenderingContext2D, wp: WeaponPickup, timeSec: number) {
  const def = WEAPONS[wp.weaponId];
  const bob = Math.sin(timeSec * 3.4 + wp.x) * 2.5;
  const pulse = 20 + Math.sin(timeSec * 4) * 3.5;

  ctx.save();
  ctx.translate(wp.x, wp.y + bob);

  // Glowing ring on sand
  ctx.strokeStyle = def.color;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -bob, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Wooden weapon crate
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-12, -10, 24, 20, 3);
  ctx.fill();
  ctx.stroke();

  // Miniature weapon icon inside crate
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (def.kind === 'MELEE') {
    ctx.moveTo(-6, 5);
    ctx.lineTo(7, -6);
  } else {
    ctx.moveTo(-6, 2);
    ctx.lineTo(6, -2);
    ctx.moveTo(-6, 2);
    ctx.lineTo(-4, 6);
  }
  ctx.stroke();

  ctx.restore();
}

function drawIslandEnemy(ctx: CanvasRenderingContext2D, enemy: IslandEnemy, timeSec: number) {
  const isFlashing = timeSec * 1000 - enemy.hitFlashTime < 120;
  const swingProg =
    enemy.attackSwingTime > 0 ? clamp((timeSec * 1000 - enemy.attackSwingTime) / 220, 0, 1) : 0;

  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  // Subtle squad halo under feet
  if (enemy.squadId) {
    ctx.strokeStyle = enemy.squadColor;
    ctx.globalAlpha = enemy.alerted ? 0.65 : 0.3;
    ctx.lineWidth = enemy.role === 'LEADER' ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const tierScale = enemy.tier === 3 ? 1.16 : enemy.tier === 2 ? 1.06 : 0.96;

  ctx.save();
  ctx.rotate(enemy.angle);
  ctx.scale(tierScale, tierScale);

  // Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  const stride = Math.sin(enemy.walkPhase) * 4;
  ctx.fillStyle = '#291206';
  ctx.beginPath();
  ctx.ellipse(stride, -5.5, 4, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride, 5.5, 4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tunic / Armor
  ctx.fillStyle = isFlashing
    ? '#FCA5A5'
    : enemy.tier === 3
    ? '#1E293B'
    : enemy.tier === 2
    ? '#334155'
    : '#475569';
  ctx.strokeStyle = enemy.tier === 3 ? '#FBBF24' : enemy.tier === 2 ? '#94A3B8' : '#0F172A';
  ctx.lineWidth = enemy.tier === 3 ? 2 : 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tier 3 shield on left arm
  if (enemy.tier === 3 && enemy.combatStyle === 'MELEE') {
    ctx.fillStyle = enemy.squadColor;
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(6, -8, 3, 6.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Enemy weapon in hand
  if (enemy.combatStyle === 'MELEE') {
    ctx.save();
    ctx.rotate(swingProg > 0 ? Math.sin(swingProg * Math.PI) * 1.1 : -0.2);
    ctx.strokeStyle = enemy.tier === 3 ? '#FDE68A' : '#E2E8F0';
    ctx.lineWidth = enemy.tier === 3 ? 3.2 : 2.6;
    ctx.beginPath();
    ctx.moveTo(6, 5);
    ctx.lineTo(enemy.tier === 3 ? 21 : 19, 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(enemy.tier >= 2 ? 20 : 18, 4);
    ctx.stroke();
  }

  // Head + Squad Bandana / Helm
  ctx.fillStyle = isFlashing ? '#FECACA' : '#FDBA74';
  ctx.beginPath();
  ctx.arc(1, 0, 6.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.squadColor;
  ctx.beginPath();
  ctx.arc(0, 0, 6.8, Math.PI * 0.45, Math.PI * 1.55);
  ctx.fill();

  // Leader or Tier 3 golden crest dot
  if (enemy.role === 'LEADER' || enemy.tier === 3) {
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(-1, 0, enemy.tier === 3 ? 3.2 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Overhead HP bar when alerted or damaged
  if (enemy.alerted || enemy.hp < enemy.maxHp) {
    const bw = 28;
    const bh = 4;
    ctx.fillStyle = 'rgba(7, 25, 36, 0.85)';
    ctx.fillRect(-bw / 2 - 1, -22, bw + 2, bh + 2);
    ctx.fillStyle = enemy.squadId ? enemy.squadColor : '#EF4444';
    ctx.fillRect(-bw / 2, -21, bw * clamp(enemy.hp / enemy.maxHp, 0, 1), bh);
  }

  ctx.restore();
}

function drawFortFlag(
  ctx: CanvasRenderingContext2D,
  island: Island,
  kingdom: KingdomState,
  fortCapture: RenderState['fortCapture'],
  timeSec: number
) {
  if (!island.fortPos) return;
  const effectiveFaction = getEffectiveIslandFaction(
    island.factionId,
    island.id,
    island.isStarter,
    kingdom
  );
  if (effectiveFaction === 'NEUTRAL') return;

  const display = getFactionDisplay(effectiveFaction, kingdom);
  const { x, y } = island.fortPos;
  const isEnemyFort = effectiveFaction !== 'PLAYER';
  const captureInfo = fortCapture && fortCapture.islandId === island.id ? fortCapture : null;

  ctx.save();
  ctx.translate(x, y);

  // Capture perimeter ring on enemy forts
  if (isEnemyFort) {
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = display.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (captureInfo && captureInfo.progress > 0) {
      ctx.strokeStyle = kingdom.bannerColor || '#10B981';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        68,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * clamp(captureInfo.progress, 0, 1)
      );
      ctx.stroke();
    }
  } else {
    // Subtle friendly territory aura
    ctx.strokeStyle = display.color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Stone bastion plinth shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.arc(4, 5, 22, 0, Math.PI * 2);
  ctx.fill();

  // Octagonal / circular stone fort base
  ctx.fillStyle = '#64748B';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  // Flagpole mast
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -34);
  ctx.stroke();

  // Waving Faction Pennant
  const wave = Math.sin(timeSec * 5 + x * 0.05) * 3.5;
  ctx.fillStyle = display.color;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(14, -36 + wave, 28, -28 + wave * 0.7);
  ctx.lineTo(22, -23 + wave * 0.5);
  ctx.lineTo(28, -18 + wave * 0.7);
  ctx.quadraticCurveTo(14, -19 + wave, 0, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold finial on top of flagpole
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(0, -35, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Label under fort
  ctx.font = '700 12px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(7, 25, 36, 0.85)';
  const labelText =
    isEnemyFort && captureInfo && captureInfo.defendersLeft > 0
      ? `${display.shortName} (${captureInfo.defendersLeft} Asker)`
      : isEnemyFort
      ? 'Bayrağı Çek!'
      : display.shortName;
  ctx.strokeText(labelText, 0, 34);
  ctx.fillStyle = isEnemyFort ? '#FDE68A' : '#A7F3D0';
  ctx.fillText(labelText, 0, 34);

  ctx.restore();
}

function drawAllySoldier(
  ctx: CanvasRenderingContext2D,
  soldier: AllySoldier,
  bannerColor: string,
  timeSec: number
) {
  const isFlashing = timeSec * 1000 - soldier.hitFlashTime < 120;
  const swingProg =
    soldier.attackSwingTime > 0
      ? clamp((timeSec * 1000 - soldier.attackSwingTime) / 220, 0, 1)
      : 0;

  ctx.save();
  ctx.translate(soldier.x, soldier.y);

  // Allied subtle floor ring
  ctx.strokeStyle = bannerColor;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.rotate(soldier.angle);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const stride = Math.sin(soldier.walkPhase) * 3.8;
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.ellipse(stride, -5, 3.8, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride, 5, 3.8, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Uniform coat in Player's Banner Color
  const isHeavy = soldier.type === 'HEAVY_GUARD';
  const isGrenadier = soldier.type === 'GRENADIER';
  ctx.fillStyle = isFlashing ? '#FCA5A5' : bannerColor;
  ctx.strokeStyle = isHeavy ? '#FBBF24' : isGrenadier ? '#FB923C' : '#0F172A';
  ctx.lineWidth = isHeavy || isGrenadier ? 2.0 : 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, isHeavy ? 9.5 : 8.4, isHeavy ? 11 : 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isGrenadier) {
    // Grenade satchel / ammo backpack
    ctx.fillStyle = '#7C2D12';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-10, -6.5, 5.5, 13, 2);
    ctx.fill();
    ctx.stroke();
  }

  // Weapon
  if (soldier.type === 'SWORDSMAN') {
    ctx.save();
    ctx.rotate(swingProg > 0 ? Math.sin(swingProg * Math.PI) * 1.2 : -0.25);
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(6, 5);
    ctx.lineTo(20, 2);
    ctx.stroke();
    ctx.restore();
  } else if (soldier.type === 'HEAVY_GUARD') {
    // Left arm shield
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(7, -8, 3.2, 7.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heavy Battleaxe
    ctx.save();
    ctx.rotate(swingProg > 0 ? Math.sin(swingProg * Math.PI) * 1.35 : -0.35);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(5, 6);
    ctx.lineTo(21, 3);
    ctx.stroke();
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(19, 1, 5.2, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.restore();
  } else if (soldier.type === 'GRENADIER') {
    // Brass hand-mortar / blunderbuss
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(18, 4);
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(19, 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(20, 4);
    ctx.stroke();
  }

  // Helmet / Tri-corner hat
  ctx.fillStyle = isFlashing ? '#FECACA' : '#FDE68A';
  ctx.beginPath();
  ctx.arc(1, 0, isHeavy ? 7 : 6.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHeavy
    ? '#F59E0B'
    : soldier.type === 'SWORDSMAN'
    ? '#CBD5E1'
    : isGrenadier
    ? '#7F1D1D'
    : '#1E293B';
  ctx.beginPath();
  ctx.arc(0, 0, isHeavy ? 7 : 6.4, Math.PI * 0.45, Math.PI * 1.55);
  ctx.fill();

  if (isGrenadier) {
    // Crimson shako plume
    ctx.fillStyle = '#FB923C';
    ctx.beginPath();
    ctx.arc(-2, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if (soldier.hp < soldier.maxHp) {
    const bw = 24;
    const bh = 3.5;
    ctx.fillStyle = 'rgba(7, 25, 36, 0.85)';
    ctx.fillRect(-bw / 2 - 1, -20, bw + 2, bh + 2);
    ctx.fillStyle = '#34D399';
    ctx.fillRect(-bw / 2, -19, bw * clamp(soldier.hp / soldier.maxHp, 0, 1), bh);
  }

  ctx.restore();
}

function drawPalmTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  frondCount: number,
  swayOffset: number,
  hasCoconuts: boolean,
  timeSec: number
) {
  const sway = Math.sin(timeSec * 1.4 + swayOffset) * 0.06;
  const shadowSprite = getPalmShadowSprite(frondCount);
  const canopySprite = getPalmCanopySprite(frondCount, hasCoconuts);
  const drawSize = PALM_SPRITE_HALF * 2;

  ctx.save();
  ctx.translate(x + 12 * scale, y + 14 * scale);
  ctx.rotate(rotation + sway * 0.7);
  ctx.scale(scale, scale);
  ctx.drawImage(shadowSprite, -PALM_SPRITE_HALF, -PALM_SPRITE_HALF, drawSize, drawSize);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#6B4423';
  ctx.lineWidth = 7 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const leanX = Math.cos(rotation) * 10 * scale;
  const leanY = Math.sin(rotation) * 10 * scale;
  ctx.quadraticCurveTo(leanX * 0.4, leanY * 0.4 - 4 * scale, leanX, leanY);
  ctx.stroke();

  ctx.translate(leanX, leanY);
  ctx.rotate(rotation + sway);
  ctx.scale(scale, scale);
  ctx.drawImage(canopySprite, -PALM_SPRITE_HALF, -PALM_SPRITE_HALF, drawSize, drawSize);
  ctx.restore();
}

function drawDugCrater(ctx: CanvasRenderingContext2D, crater: DigCrater) {
  ctx.save();
  ctx.translate(crater.x, crater.y);
  ctx.rotate(crater.rotation);

  const depth = crater.depth || 1;
  const r = crater.radius * (1 + (depth - 1) * 0.14);

  ctx.fillStyle = depth >= 2 ? '#CFA45E' : '#DFBC7E';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = depth === 1 ? '#9E7346' : '#855832';
  ctx.beginPath();
  ctx.ellipse(0, 0.8, r * 0.96, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  if (depth >= 2) {
    ctx.fillStyle = '#5A381D';
    ctx.beginPath();
    ctx.ellipse(-1, 2, r * 0.68, r * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (depth >= 3) {
    ctx.fillStyle = '#38210F';
    ctx.beginPath();
    ctx.ellipse(-1.5, 3, r * 0.44, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255, 241, 210, 0.38)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.96, r * 0.78, 0, Math.PI * 0.95, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = depth >= 2 ? '#6E4726' : '#8F643B';
  const clodCount = 4 + depth * 2;
  for (let i = 0; i < clodCount; i++) {
    const a = (i / clodCount) * Math.PI * 2 + 0.4;
    const distR = r * (1.02 + (i % 2) * 0.16);
    const sz = 2.4 + (i % 3) * 0.85;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * distR, Math.sin(a) * distR * 0.88, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crater.foundTreasure) {
    ctx.fillStyle = '#92400E';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 12, 2.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTraderDock(
  ctx: CanvasRenderingContext2D,
  dockX: number,
  dockY: number,
  angle: number,
  nearDock: boolean,
  timeSec: number
) {
  ctx.save();
  ctx.translate(dockX, dockY);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(7, 36, 48, 0.25)';
  ctx.fillRect(-6, -15, 62, 34);

  ctx.fillStyle = '#4A2C16';
  [
    [4, -14],
    [4, 14],
    [28, -14],
    [28, 14],
    [48, -14],
    [48, 14],
  ].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#9C6635';
  ctx.strokeStyle = '#5C3818';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-8, -14, 58, 28, 3);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(74, 44, 22, 0.45)';
  ctx.lineWidth = 1;
  for (let px = -2; px <= 44; px += 7) {
    ctx.beginPath();
    ctx.moveTo(px, -13);
    ctx.lineTo(px, 13);
    ctx.stroke();
  }

  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.roundRect(-24, -17, 20, 34, 4);
  ctx.fill();
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(-20, -17, 6, 34);

  const glow = 0.65 + Math.sin(timeSec * 3.5) * 0.2;
  ctx.fillStyle = `rgba(251, 191, 36, ${nearDock ? 0.95 : glow * 0.6})`;
  ctx.beginPath();
  ctx.arc(46, -11, nearDock ? 5.5 : 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSideCannons(
  ctx: CanvasRenderingContext2D,
  countPerSide: number,
  halfBeam: number,
  barrelColor: string,
  portColor: string
) {
  const offsets =
    countPerSide === 1 ? [0] : countPerSide === 2 ? [-9, 9] : [-13, 0, 13];

  offsets.forEach((ox) => {
    [-1, 1].forEach((side) => {
      const yBase = side * (halfBeam - 2);
      const yTip = side * (halfBeam + 5.5);

      ctx.fillStyle = portColor;
      ctx.fillRect(ox - 2.6, yBase - 2, 5.2, 4);

      ctx.strokeStyle = barrelColor;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ox, yBase);
      ctx.lineTo(ox, yTip);
      ctx.stroke();
    });
  });
}

function drawMastAndSail(
  ctx: CanvasRenderingContext2D,
  mx: number,
  sailHalfSpan: number,
  isSailing: boolean,
  speedRatio: number,
  timeSec: number,
  hasGoldTrim: boolean
) {
  if (isSailing) {
    const billow = 6.5 + speedRatio * 7.5 + Math.sin(timeSec * 4 + mx * 0.2) * 1.4;
    ctx.fillStyle = hasGoldTrim ? '#FFFBEB' : '#FFFDF7';
    ctx.strokeStyle = hasGoldTrim ? '#F59E0B' : '#CBD5E1';
    ctx.lineWidth = hasGoldTrim ? 1.7 : 1.4;
    ctx.beginPath();
    ctx.moveTo(mx, -sailHalfSpan);
    ctx.quadraticCurveTo(mx + billow, 0, mx, sailHalfSpan);
    ctx.quadraticCurveTo(mx + billow * 0.42, 0, mx, -sailHalfSpan);
    ctx.fill();
    ctx.stroke();

    // Yardarm wooden spar
    ctx.strokeStyle = '#5C3818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, -sailHalfSpan - 1);
    ctx.lineTo(mx, sailHalfSpan + 1);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - 2.2, -sailHalfSpan * 0.82, 4.4, sailHalfSpan * 1.64, 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.arc(mx, 0, 2.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  isSailing: boolean,
  speedRatio: number,
  boatLevel: number,
  cannonCountPerSide: number,
  hitFlash: boolean,
  nearBoat: boolean,
  timeSec: number
) {
  const spec = getShipClass(boatLevel);

  ctx.save();
  ctx.translate(x, y);

  if (!isSailing && nearBoat) {
    const pulse = 1 + Math.sin(timeSec * 5) * 0.08;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.78)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, (spec.hullRadius + 14) * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.rotate(angle);
  ctx.scale(spec.scale, spec.scale);

  // Water ripple outline around hull
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + speedRatio * 0.25})`;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(31, 0);
  ctx.quadraticCurveTo(10, -21, -24, -14);
  ctx.lineTo(-24, 14);
  ctx.quadraticCurveTo(10, 21, 31, 0);
  ctx.stroke();

  // Hull shadow
  ctx.fillStyle = 'rgba(5, 28, 40, 0.34)';
  ctx.beginPath();
  ctx.moveTo(30, 4);
  ctx.quadraticCurveTo(8, -16, -22, -10);
  ctx.lineTo(-22, 18);
  ctx.quadraticCurveTo(8, 22, 30, 4);
  ctx.fill();

  // Bowsprit spar & triangular jib sail on Cutter+ classes
  if (spec.hasBowsprit) {
    ctx.strokeStyle = spec.hasGoldTrim ? '#D97706' : '#6B4423';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(39, 0);
    ctx.stroke();

    if (isSailing) {
      const jibBillow = 3.5 + speedRatio * 3;
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath();
      ctx.moveTo(37, 0);
      ctx.quadraticCurveTo(28, jibBillow, 21, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Side cannon ports & barrels
  drawSideCannons(ctx, cannonCountPerSide, 14, '#334155', '#78350F');

  // Outer hull
  ctx.fillStyle = hitFlash ? '#FCA5A5' : spec.hasGoldTrim ? '#6B3E1B' : '#8B5A2B';
  ctx.strokeStyle = spec.hasGoldTrim ? '#F59E0B' : '#4A2C11';
  ctx.lineWidth = spec.hasGoldTrim ? 2.2 : 2;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.quadraticCurveTo(8, -18, -22, -13);
  ctx.lineTo(-22, 13);
  ctx.quadraticCurveTo(8, 18, 28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner deck planks
  ctx.fillStyle = hitFlash ? '#FECACA' : '#C48A52';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.quadraticCurveTo(6, -13, -18, -9);
  ctx.lineTo(-18, 9);
  ctx.quadraticCurveTo(6, 13, 22, 0);
  ctx.closePath();
  ctx.fill();

  // Plank seams
  ctx.strokeStyle = 'rgba(115, 69, 32, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.lineTo(15, -4);
  ctx.moveTo(-16, 4);
  ctx.lineTo(15, 4);
  ctx.stroke();

  // Raised Quarterdeck / Stern Cabin on Sloop+ classes
  if (spec.hasQuarterdeck) {
    ctx.fillStyle = '#7C4821';
    ctx.strokeStyle = spec.hasGoldTrim ? '#FBBF24' : '#4A2C11';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-20, -10.5, 11, 21, 2.5);
    ctx.fill();
    ctx.stroke();

    // Stern brass/gold lanterns
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(-20.5, -7, 2.2, 0, Math.PI * 2);
    ctx.arc(-20.5, 7, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#734520';
    ctx.fillRect(-13, -9, 5, 18);
    ctx.fillRect(4, -9, 5, 18);
  }

  // 1, 2, or 3 Masts & Sails depending on Ship Class!
  if (spec.masts === 1) {
    drawMastAndSail(ctx, 2, 16, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
  } else if (spec.masts === 2) {
    drawMastAndSail(ctx, -6, 15, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
    drawMastAndSail(ctx, 11, 13.5, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
  } else {
    drawMastAndSail(ctx, -11, 14, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
    drawMastAndSail(ctx, 2, 17, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
    drawMastAndSail(ctx, 14, 12.5, isSailing, speedRatio, timeSec, spec.hasGoldTrim);
  }

  ctx.restore();
}

function drawEnemyShip(ctx: CanvasRenderingContext2D, enemy: EnemyShip, timeSec: number) {
  const isFlashing = timeSec * 1000 - enemy.hitFlashTime < 120;
  const scale = enemy.tier === 3 ? 1.44 : enemy.tier === 2 ? 1.22 : 1.04;
  const cannonCount = enemy.tier === 3 ? 4 : enemy.tier === 2 ? 3 : 2;
  const faction = ENEMY_FACTIONS[enemy.factionId] ?? ENEMY_FACTIONS.CORSAIR;

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(5, 20, 32, 0.36)';
  ctx.beginPath();
  ctx.moveTo(34, 5);
  ctx.quadraticCurveTo(10, -18, -26, -12);
  ctx.lineTo(-26, 20);
  ctx.quadraticCurveTo(10, 24, 34, 5);
  ctx.fill();

  drawSideCannons(ctx, cannonCount, 15, '#1E293B', '#450A0A');

  ctx.fillStyle = isFlashing ? '#FCA5A5' : faction.hullColor;
  ctx.strokeStyle = enemy.tier === 3 ? '#FBBF24' : '#1E293B';
  ctx.lineWidth = enemy.tier === 3 ? 2.6 : 2.2;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.quadraticCurveTo(9, -20, -25, -14);
  ctx.lineTo(-25, 14);
  ctx.quadraticCurveTo(9, 20, 32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isFlashing ? '#FECACA' : '#6D3B1E';
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.quadraticCurveTo(7, -14, -20, -9.5);
  ctx.lineTo(-20, 9.5);
  ctx.quadraticCurveTo(7, 14, 25, 0);
  ctx.closePath();
  ctx.fill();

  const billow = 10 + Math.sin(timeSec * 4.2 + enemy.patrolAngle) * 1.8;
  ctx.fillStyle = faction.sailColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, -19);
  ctx.quadraticCurveTo(3 + billow, 0, 3, 19);
  ctx.quadraticCurveTo(3 + billow * 0.4, 0, 3, -19);
  ctx.fill();
  ctx.stroke();

  if (enemy.tier === 3) {
    // Fore-mast sail on Tier 3 Flagships
    ctx.beginPath();
    ctx.moveTo(15, -13);
    ctx.quadraticCurveTo(15 + billow * 0.75, 0, 15, 13);
    ctx.quadraticCurveTo(15 + billow * 0.3, 0, 15, -13);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(5 + billow * 0.35, -4);
  ctx.lineTo(5 + billow * 0.35, 4);
  ctx.moveTo(2 + billow * 0.35, 0);
  ctx.lineTo(8 + billow * 0.35, 0);
  ctx.stroke();

  ctx.restore();

  const barW = enemy.tier === 3 ? 60 : 48;
  const barH = 5;
  const bx = enemy.x - barW / 2;
  const by = enemy.y - (enemy.tier === 3 ? 42 : 36);
  const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);

  ctx.fillStyle = 'rgba(7, 25, 36, 0.8)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = faction.color;
  ctx.fillRect(bx, by, barW * hpPct, barH);
}

function drawAllyShip(
  ctx: CanvasRenderingContext2D,
  ship: AllyShip,
  bannerColor: string,
  sailColor: string,
  timeSec: number
) {
  const isFlashing = timeSec * 1000 - ship.hitFlashTime < 120;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.scale(1.06, 1.06);

  ctx.fillStyle = 'rgba(5, 20, 32, 0.3)';
  ctx.beginPath();
  ctx.moveTo(30, 4);
  ctx.quadraticCurveTo(8, -16, -22, -10);
  ctx.lineTo(-22, 18);
  ctx.quadraticCurveTo(8, 22, 30, 4);
  ctx.fill();

  drawSideCannons(ctx, 2, 14, '#334155', '#78350F');

  ctx.fillStyle = isFlashing ? '#FCA5A5' : '#7C4821';
  ctx.strokeStyle = bannerColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.quadraticCurveTo(8, -18, -22, -13);
  ctx.lineTo(-22, 13);
  ctx.quadraticCurveTo(8, 18, 28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isFlashing ? '#FECACA' : '#C48A52';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.quadraticCurveTo(6, -13, -18, -9);
  ctx.lineTo(-18, 9);
  ctx.quadraticCurveTo(6, 13, 22, 0);
  ctx.closePath();
  ctx.fill();

  const billow = 9 + Math.sin(timeSec * 4 + ship.slotIndex) * 1.6;
  ctx.fillStyle = '#FFFDF7';
  ctx.strokeStyle = bannerColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(2, -16);
  ctx.quadraticCurveTo(2 + billow, 0, 2, 16);
  ctx.quadraticCurveTo(2 + billow * 0.4, 0, 2, -16);
  ctx.fill();
  ctx.stroke();

  // Pennant stripe on sail
  ctx.fillStyle = sailColor;
  ctx.fillRect(2 + billow * 0.25, -4, 4, 8);

  ctx.restore();

  if (ship.hp < ship.maxHp) {
    const barW = 40;
    const barH = 4;
    const bx = ship.x - barW / 2;
    const by = ship.y - 32;
    ctx.fillStyle = 'rgba(7, 25, 36, 0.8)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = bannerColor;
    ctx.fillRect(bx, by, barW * clamp(ship.hp / ship.maxHp, 0, 1), barH);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  walkPhase: number,
  digAnimProgress: number,
  attackAnimProgress: number,
  equippedWeapon: WeaponId | null,
  hitFlash: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (digAnimProgress > 0) {
    const lunge = Math.sin(digAnimProgress * Math.PI) * 5.5;
    ctx.translate(lunge, 0);
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const stride = Math.sin(walkPhase) * 4.5;
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.ellipse(stride, -6, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride, 6, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#92400E';
  ctx.beginPath();
  ctx.roundRect(-12, -7, 7, 14, 3);
  ctx.fill();

  ctx.fillStyle = hitFlash ? '#FCA5A5' : '#0F766E';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Equipped weapon rendering
  if (equippedWeapon && digAnimProgress === 0) {
    const def = WEAPONS[equippedWeapon];
    if (def.kind === 'MELEE') {
      const swingAngle =
        attackAnimProgress > 0 ? -1.1 + attackAnimProgress * 2.2 : -0.35;
      ctx.save();
      ctx.rotate(swingAngle);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, 7);
      ctx.lineTo(24, 3);
      ctx.stroke();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(10, 9);
      ctx.stroke();
      ctx.restore();

      // Crescent slash trail during attack
      if (attackAnimProgress > 0 && attackAnimProgress < 0.85) {
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
        ctx.lineWidth = 5 * (1 - attackAnimProgress);
        ctx.beginPath();
        ctx.arc(4, 0, 36, -0.95, 0.95);
        ctx.stroke();
      }
    } else {
      // Pistol / Musket / Dual Pistols
      ctx.strokeStyle = equippedWeapon === 'DUAL_PISTOL' ? '#FDE047' : '#334155';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(equippedWeapon === 'MUSKET' ? 24 : 18, 5);
      ctx.stroke();
      if (equippedWeapon === 'DUAL_PISTOL') {
        ctx.beginPath();
        ctx.moveTo(6, -6);
        ctx.lineTo(18, -5);
        ctx.stroke();
      }
    }
  }

  // Shovel animation during dig
  if (digAnimProgress > 0) {
    const thrust = Math.sin(digAnimProgress * Math.PI);
    const angleSwing = -0.5 + digAnimProgress * 1.1;
    ctx.save();
    ctx.rotate(angleSwing);
    ctx.translate(thrust * 7, 0);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.lineTo(22, 1);
    ctx.stroke();

    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(21, -3);
    ctx.lineTo(30, 1);
    ctx.lineTo(21, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = hitFlash ? '#FEE2E2' : '#FDE68A';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(1, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.arc(1, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.arc(1, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
) {
  const { timeSec, camera, zoom, screenShake, islands, craters, player, boat, showWaves } = state;

  ctx.fillStyle = '#0B4F6C';
  ctx.fillRect(0, 0, width, height);

  const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake * 2 : 0;
  const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake * 2 : 0;

  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  const halfViewW = (width / zoom) * 0.5 + 90;
  const halfViewH = (height / zoom) * 0.5 + 90;
  const viewLeft = camera.x - halfViewW;
  const viewRight = camera.x + halfViewW;
  const viewTop = camera.y - halfViewH;
  const viewBottom = camera.y + halfViewH;

  if (showWaves) {
    const step = 130;
    const startX = Math.floor((viewLeft - step) / step) * step;
    const endX = viewRight + step;
    const startY = Math.floor((viewTop - step) / step) * step;
    const endY = viewBottom + step;

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.12)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let gx = startX; gx <= endX; gx += step) {
      for (let gy = startY; gy <= endY; gy += step) {
        const offset = Math.sin((gx + gy) * 0.01 + timeSec * 1.3) * 10;
        const wx = gx + ((gy / step) % 2 === 0 ? 25 : -25);
        const wy = gy + offset;
        ctx.moveTo(wx - 16, wy);
        ctx.quadraticCurveTo(wx, wy - 5, wx + 16, wy);
      }
    }
    ctx.stroke();
  }

  for (const r of state.waterRipples) {
    if (r.x < viewLeft || r.x > viewRight || r.y < viewTop || r.y > viewBottom) continue;
    ctx.strokeStyle = `rgba(224, 247, 250, ${clamp(r.alpha, 0, 1)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Filter strictly to islands intersecting the camera viewport
  const onScreenIslands: Island[] = [];
  const visibleIslandIds = new Set<string>();
  for (const island of islands) {
    const rPad = island.maxRadius * 1.28;
    if (
      island.centerX + rPad < viewLeft ||
      island.centerX - rPad > viewRight ||
      island.centerY + rPad < viewTop ||
      island.centerY - rPad > viewBottom
    ) {
      continue;
    }
    onScreenIslands.push(island);
    visibleIslandIds.add(island.id);

    const cached = getIslandTerrainCanvas(island);
    ctx.drawImage(
      cached.canvas,
      island.centerX - cached.halfSize,
      island.centerY - cached.halfSize
    );

    if (island.traderDock) {
      drawTraderDock(
        ctx,
        island.traderDock.x,
        island.traderDock.y,
        island.traderDock.angle,
        state.nearDock,
        timeSec
      );
    }
  }

  for (const crater of craters) {
    if (
      visibleIslandIds.has(crater.islandId) &&
      crater.x >= viewLeft &&
      crater.x <= viewRight &&
      crater.y >= viewTop &&
      crater.y <= viewBottom
    ) {
      drawDugCrater(ctx, crater);
    }
  }

  if (!player.isSailing && player.canDig && player.digTarget) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(124, 84, 48, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(player.digTarget.x, player.digTarget.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of state.particles) {
    if (p.type !== 'WAKE') continue;
    if (p.x < viewLeft || p.x > viewRight || p.y < viewTop || p.y > viewBottom) continue;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Landmarks: Temples, Watchtowers, Small Villages & Command Forts
  for (const island of onScreenIslands) {
    for (const lm of island.landmarks) {
      if (
        lm.x + 80 < viewLeft ||
        lm.x - 80 > viewRight ||
        lm.y + 80 < viewTop ||
        lm.y - 80 > viewBottom
      ) {
        continue;
      }
      drawLandmark(ctx, lm, timeSec);
    }
    drawFortFlag(ctx, island, state.kingdom, state.fortCapture, timeSec);
  }

  // Uncollected Weapon Pickups
  for (const island of onScreenIslands) {
    for (const wp of island.weaponPickups) {
      if (
        !state.collectedPickupIds.has(wp.id) &&
        wp.x >= viewLeft &&
        wp.x <= viewRight &&
        wp.y >= viewTop &&
        wp.y <= viewBottom
      ) {
        drawWeaponPickup(ctx, wp, timeSec);
      }
    }
  }

  // Floating ocean loot & land drops
  for (const loot of state.floatingLoot) {
    if (loot.x < viewLeft || loot.x > viewRight || loot.y < viewTop || loot.y > viewBottom) {
      continue;
    }
    const bob = Math.sin(timeSec * 3.5 + loot.bobOffset) * 2.5;
    ctx.save();
    ctx.translate(loot.x, loot.y + bob);

    const shimmer = 16 + Math.sin(timeSec * 4) * 2.5;
    ctx.strokeStyle = loot.healHp ? 'rgba(52, 211, 153, 0.6)' : 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, shimmer, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = loot.healHp ? '#065F46' : '#92400E';
    ctx.strokeStyle = loot.healHp ? '#34D399' : '#FBBF24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-9, -7, 18, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = loot.healHp ? '#A7F3D0' : '#FDE047';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Island Enemies & Coordinated Squads (viewport culled)
  for (const ie of state.islandEnemies) {
    if (ie.x < viewLeft || ie.x > viewRight || ie.y < viewTop || ie.y > viewBottom) continue;
    drawIslandEnemy(ctx, ie, timeSec);
  }

  // Allied Recruited Soldiers (when on land, viewport culled)
  const playerFactionDisplay = getFactionDisplay('PLAYER', state.kingdom);
  if (!player.isSailing) {
    for (const soldier of state.allySoldiers) {
      if (
        soldier.x < viewLeft ||
        soldier.x > viewRight ||
        soldier.y < viewTop ||
        soldier.y > viewBottom
      ) {
        continue;
      }
      drawAllySoldier(ctx, soldier, playerFactionDisplay.color, timeSec);
    }
  }

  // Enemy Pirate/Nation Ships
  for (const enemy of state.enemies) {
    if (enemy.x < viewLeft || enemy.x > viewRight || enemy.y < viewTop || enemy.y > viewBottom) {
      continue;
    }
    drawEnemyShip(ctx, enemy, timeSec);
  }

  // Allied Escort Warships
  for (const allyShip of state.allyShips) {
    if (
      allyShip.x < viewLeft ||
      allyShip.x > viewRight ||
      allyShip.y < viewTop ||
      allyShip.y > viewBottom
    ) {
      continue;
    }
    drawAllyShip(
      ctx,
      allyShip,
      playerFactionDisplay.color,
      playerFactionDisplay.sailColor,
      timeSec
    );
  }

  // Player Boat
  drawBoat(
    ctx,
    boat.x,
    boat.y,
    boat.angle,
    player.isSailing,
    boat.speedRatio,
    boat.boatLevel,
    boat.cannonCountPerSide,
    boat.hitFlash,
    state.nearBoat,
    timeSec
  );

  // Player
  if (!player.isSailing) {
    drawPlayer(
      ctx,
      player.x,
      player.y,
      player.angle,
      player.walkPhase,
      player.digAnimProgress,
      player.attackAnimProgress,
      player.equippedWeapon,
      player.hitFlash
    );
  } else {
    ctx.save();
    ctx.translate(boat.x - Math.cos(boat.angle) * 8, boat.y - Math.sin(boat.angle) * 8);
    ctx.fillStyle = '#FDE68A';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Palm trees (cached sprites + viewport culled)
  for (const island of onScreenIslands) {
    for (const palm of island.palms) {
      if (palm.x < viewLeft || palm.x > viewRight || palm.y < viewTop || palm.y > viewBottom) {
        continue;
      }
      drawPalmTree(
        ctx,
        palm.x,
        palm.y,
        palm.scale,
        palm.rotation,
        palm.frondCount,
        palm.swayOffset,
        palm.hasCoconuts,
        timeSec
      );
    }
  }

  // 2.5D Particles
  for (const p of state.particles) {
    if (p.type === 'WAKE') continue;
    if (p.x < viewLeft || p.x > viewRight || p.y < viewTop || p.y > viewBottom) continue;
    const z = p.z ?? 0;
    if (z > 1) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.globalAlpha = clamp(p.alpha * 0.6, 0, 1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y - z, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Land Projectiles (Player & Enemy bullets/darts & Grenadier shells)
  for (const lp of state.landProjectiles) {
    if (lp.x < viewLeft || lp.x > viewRight || lp.y < viewTop || lp.y > viewBottom) continue;
    if (lp.splashRadius) {
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(lp.x - 1.5, lp.y - 1.5, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = lp.color;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Cannonballs
  for (const cb of state.cannonballs) {
    if (cb.x < viewLeft || cb.x > viewRight || cb.y < viewTop || cb.y > viewBottom) continue;
    ctx.fillStyle = 'rgba(7, 25, 36, 0.32)';
    ctx.beginPath();
    ctx.ellipse(cb.x, cb.y, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const factionColor =
      cb.owner === 'PLAYER' ? '#F59E0B' : ENEMY_FACTIONS[cb.owner]?.color ?? '#FCA5A5';
    ctx.fillStyle = cb.owner === 'PLAYER' ? '#1E293B' : '#7F1D1D';
    ctx.strokeStyle = factionColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cb.x, cb.y - Math.max(0, cb.z), 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Radar Pulses
  const nowMs = performance.now();
  for (const pulse of state.radarPulses) {
    const progress = (nowMs - pulse.startTime) / 900;
    if (progress < 0 || progress > 1) continue;
    const radius = 24 + progress * pulse.maxRadius;
    const alpha = (1 - progress) * 0.85;
    const color = HEAT_COLORS[pulse.heat];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4 - progress * 2;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (pulse.showDirection && pulse.targetAngle !== null) {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, Math.min(radius, 95), pulse.targetAngle - 0.32, pulse.targetAngle + 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Floating Texts
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px "Outfit", system-ui, sans-serif';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(7, 30, 42, 0.85)';
  for (const ft of state.floatingTexts) {
    if (ft.x < viewLeft || ft.x > viewRight || ft.y < viewTop || ft.y > viewBottom) continue;
    ctx.globalAlpha = clamp(ft.life / ft.maxLife, 0, 1);
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
