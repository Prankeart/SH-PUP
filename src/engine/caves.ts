import {
  CaveChamber,
  CaveChest,
  CaveEnemy,
  CaveEntrance,
  CaveInterior,
  CaveWallPillar,
} from '../types/game';
import { mulberry32, dist, clamp } from '../utils/prng';

function hashStr(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h || 1234567;
}

export function generateCaveInterior(
  entrance: CaveEntrance,
  worldSeed: number,
  openedChestIds: Set<string>,
  unlockedWeapons: Set<string>
): CaveInterior {
  const rng = mulberry32(hashStr(entrance.id, worldSeed));
  const width = 1320;
  const height = 960;

  // Three connected cavernous chambers (West Entry -> Central Grotto -> East Boss Vault)
  const chambers: CaveChamber[] = [
    { cx: 245, cy: 480, rx: 165, ry: 175 },
    { cx: 660, cy: 470 + (rng() - 0.5) * 80, rx: 220, ry: 235 },
    { cx: 1075, cy: 480 + (rng() - 0.5) * 60, rx: 175, ry: 190 },
  ];

  const corridors = [
    {
      x1: chambers[0].cx + 95,
      y1: chambers[0].cy,
      x2: chambers[1].cx - 125,
      y2: chambers[1].cy,
      width: 96,
    },
    {
      x1: chambers[1].cx + 125,
      y1: chambers[1].cy,
      x2: chambers[2].cx - 105,
      y2: chambers[2].cy,
      width: 96,
    },
  ];

  const entryPos = { x: chambers[0].cx - 72, y: chambers[0].cy };
  const exitPos = { x: chambers[0].cx - 102, y: chambers[0].cy };

  // Decorative underground pools in central chamber
  const pools = [
    {
      x: chambers[1].cx + (rng() - 0.5) * 60,
      y: chambers[1].cy - 105,
      rx: 64 + rng() * 24,
      ry: 38 + rng() * 14,
    },
  ];

  // Rock pillars for tactical cover & exploration atmosphere
  const pillars: CaveWallPillar[] = [];
  const pillarCandidates = [
    { x: chambers[0].cx + 42, y: chambers[0].cy - 78, radius: 24 },
    { x: chambers[0].cx + 38, y: chambers[0].cy + 78, radius: 22 },
    { x: chambers[1].cx - 88, y: chambers[1].cy - 74, radius: 28 },
    { x: chambers[1].cx + 88, y: chambers[1].cy + 78, radius: 28 },
    { x: chambers[1].cx - 72, y: chambers[1].cy + 98, radius: 24 },
    { x: chambers[2].cx - 48, y: chambers[2].cy - 86, radius: 24 },
    { x: chambers[2].cx - 48, y: chambers[2].cy + 86, radius: 24 },
  ];
  for (const cand of pillarCandidates) {
    if (dist(cand.x, cand.y, entryPos.x, entryPos.y) > 78) {
      pillars.push({
        x: cand.x + (rng() - 0.5) * 14,
        y: cand.y + (rng() - 0.5) * 14,
        radius: cand.radius,
      });
    }
  }

  // Glowing cavern crystals
  const crystalPalette = ['#A855F7', '#22D3EE', '#E879F9', '#38BDF8'];
  const crystals: CaveInterior['crystals'] = [];
  for (let i = 0; i < 18; i++) {
    const ch = chambers[i % chambers.length];
    const ang = rng() * Math.PI * 2;
    const radFrac = 0.62 + rng() * 0.28;
    const cx = ch.cx + Math.cos(ang) * ch.rx * radFrac;
    const cy = ch.cy + Math.sin(ang) * ch.ry * radFrac;
    if (dist(cx, cy, entryPos.x, entryPos.y) < 55) continue;
    crystals.push({
      x: cx,
      y: cy,
      size: 7 + rng() * 8,
      color: crystalPalette[Math.floor(rng() * crystalPalette.length)],
      angle: rng() * Math.PI * 2,
    });
  }

  // Wall torches along chambers & corridors
  const torches: CaveInterior['torches'] = [
    { x: chambers[0].cx - 110, y: chambers[0].cy - 92, phase: rng() * 6 },
    { x: chambers[0].cx + 80, y: chambers[0].cy - 102, phase: rng() * 6 },
    { x: (chambers[0].cx + chambers[1].cx) * 0.5, y: chambers[0].cy - 44, phase: rng() * 6 },
    { x: chambers[1].cx - 135, y: chambers[1].cy - 120, phase: rng() * 6 },
    { x: chambers[1].cx + 125, y: chambers[1].cy - 120, phase: rng() * 6 },
    { x: chambers[1].cx, y: chambers[1].cy + 145, phase: rng() * 6 },
    { x: (chambers[1].cx + chambers[2].cx) * 0.5, y: chambers[2].cy - 44, phase: rng() * 6 },
    { x: chambers[2].cx + 75, y: chambers[2].cy - 112, phase: rng() * 6 },
    { x: chambers[2].cx + 75, y: chambers[2].cy + 112, phase: rng() * 6 },
  ];

  // Treasure chests inside cave (persisted via openedChestIds)
  const tierMult = entrance.tier === 3 ? 1.65 : entrance.tier === 2 ? 1.25 : 1;
  const chests: CaveChest[] = [
    {
      id: `${entrance.id}_chest_0`,
      x: chambers[0].cx + 74,
      y: chambers[0].cy + 108,
      goldValue: Math.round((55 + rng() * 35) * tierMult),
      tier: 'NORMAL',
      opened: openedChestIds.has(`${entrance.id}_chest_0`),
    },
    {
      id: `${entrance.id}_chest_1`,
      x: chambers[1].cx - 120,
      y: chambers[1].cy + 148,
      goldValue: Math.round((75 + rng() * 45) * tierMult),
      tier: 'NORMAL',
      opened: openedChestIds.has(`${entrance.id}_chest_1`),
    },
    {
      id: `${entrance.id}_chest_2`,
      x: chambers[1].cx + 135,
      y: chambers[1].cy - 125,
      goldValue: Math.round((85 + rng() * 45) * tierMult),
      tier: 'NORMAL',
      opened: openedChestIds.has(`${entrance.id}_chest_2`),
    },
    {
      id: `${entrance.id}_chest_boss`,
      x: chambers[2].cx + 98,
      y: chambers[2].cy,
      goldValue: Math.round((160 + rng() * 70) * tierMult),
      tier: 'BOSS',
      opened: openedChestIds.has(`${entrance.id}_chest_boss`),
    },
  ];

  // Secret cave weapon altar (Obsidian Blade on tier 1/2, Crystal Blunderbuss on tier 2/3)
  const altarWeapon =
    entrance.tier >= 2 && (entrance.tier === 3 || !unlockedWeapons.has('CRYSTAL_BLUNDERBUSS'))
      ? 'CRYSTAL_BLUNDERBUSS'
      : 'OBSIDIAN_BLADE';
  const altarId = `${entrance.id}_altar`;
  const weaponAltar = {
    id: altarId,
    x: chambers[2].cx + 35,
    y: chambers[2].cy - 102,
    weaponId: altarWeapon as CaveInterior['chests'] extends never ? never : typeof altarWeapon,
    claimed: openedChestIds.has(altarId) || unlockedWeapons.has(altarWeapon),
  };

  // Subterranean creatures + Crystal Golem Boss in east chamber
  const hpScale = entrance.tier === 3 ? 1.45 : entrance.tier === 2 ? 1.2 : 1;
  const enemies: CaveEnemy[] = [];
  const addCreature = (
    idx: number,
    kind: CaveEnemy['kind'],
    x: number,
    y: number
  ) => {
    const isBoss = kind === 'CRYSTAL_GOLEM';
    const baseHp = kind === 'BAT' ? 42 : kind === 'CRAB' ? 68 : kind === 'SCORPION' ? 85 : 290;
    const baseDmg = kind === 'BAT' ? 9 : kind === 'CRAB' ? 12 : kind === 'SCORPION' ? 16 : 26;
    const speed = kind === 'BAT' ? 124 : kind === 'CRAB' ? 84 : kind === 'SCORPION' ? 102 : 76;
    const radius = isBoss ? 24 : kind === 'SCORPION' ? 14 : 12;
    const name =
      kind === 'BAT'
        ? 'Mağara Yarasası'
        : kind === 'CRAB'
        ? 'Kaya Yengeci'
        : kind === 'SCORPION'
        ? 'Gölge Akrebi'
        : 'Kristal Golem (Patron)';
    const maxHp = Math.round(baseHp * hpScale);
    enemies.push({
      id: `${entrance.id}_mob_${idx}`,
      kind,
      name,
      x,
      y,
      angle: rng() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      damage: Math.round(baseDmg * (entrance.tier === 3 ? 1.25 : 1)),
      speed,
      radius,
      isBoss,
      lastAttackTime: 0,
      hitFlashTime: -1000,
      walkPhase: rng() * Math.PI * 2,
      homePos: { x, y },
      goldBounty: isBoss ? Math.round(95 * tierMult) : kind === 'SCORPION' ? 28 : 18,
    });
  };

  addCreature(0, 'BAT', chambers[0].cx + 95, chambers[0].cy - 30);
  addCreature(1, 'CRAB', chambers[1].cx - 70, chambers[1].cy - 20);
  addCreature(2, 'BAT', chambers[1].cx + 20, chambers[1].cy + 68);
  addCreature(3, 'SCORPION', chambers[1].cx + 92, chambers[1].cy - 40);
  addCreature(4, 'CRAB', chambers[2].cx - 50, chambers[2].cy + 40);
  addCreature(5, 'SCORPION', chambers[2].cx - 30, chambers[2].cy - 48);
  addCreature(6, 'CRYSTAL_GOLEM', chambers[2].cx + 35, chambers[2].cy);

  return {
    caveId: entrance.id,
    islandId: entrance.islandId,
    name: entrance.name,
    tier: entrance.tier,
    width,
    height,
    chambers,
    corridors,
    pillars,
    pools,
    crystals,
    torches,
    entryPos,
    exitPos,
    chests,
    weaponAltar,
    enemies,
  };
}

export function isPointInsideCaveWalkable(cave: CaveInterior, x: number, y: number, margin = 12): boolean {
  for (const ch of cave.chambers) {
    const nx = (x - ch.cx) / Math.max(1, ch.rx - margin);
    const ny = (y - ch.cy) / Math.max(1, ch.ry - margin);
    if (nx * nx + ny * ny <= 1) return true;
  }
  for (const cor of cave.corridors) {
    const minX = Math.min(cor.x1, cor.x2) - 24;
    const maxX = Math.max(cor.x1, cor.x2) + 24;
    const midY = (cor.y1 + cor.y2) * 0.5;
    const halfH = cor.width * 0.5 - margin * 0.5;
    if (x >= minX && x <= maxX && Math.abs(y - midY) <= halfH) {
      return true;
    }
  }
  return false;
}

export function resolveCaveCollision(
  cave: CaveInterior,
  x: number,
  y: number,
  entityRadius = 11
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  // Push outside rock pillars
  for (const p of cave.pillars) {
    const d = dist(nx, ny, p.x, p.y);
    const minD = p.radius + entityRadius;
    if (d < minD && d > 0.001) {
      const ang = Math.atan2(ny - p.y, nx - p.x);
      nx = p.x + Math.cos(ang) * minD;
      ny = p.y + Math.sin(ang) * minD;
    }
  }

  // Push outside chests
  for (const ch of cave.chests) {
    const d = dist(nx, ny, ch.x, ch.y);
    const minD = 15 + entityRadius * 0.7;
    if (d < minD && d > 0.001) {
      const ang = Math.atan2(ny - ch.y, nx - ch.x);
      nx = ch.x + Math.cos(ang) * minD;
      ny = ch.y + Math.sin(ang) * minD;
    }
  }

  if (isPointInsideCaveWalkable(cave, nx, ny, entityRadius)) {
    return { x: nx, y: ny };
  }

  // Clamp gently toward nearest chamber or corridor centerline
  let bestDist = Infinity;
  let clampedX = nx;
  let clampedY = ny;

  for (const ch of cave.chambers) {
    const rx = Math.max(10, ch.rx - entityRadius);
    const ry = Math.max(10, ch.ry - entityRadius);
    const dx = nx - ch.cx;
    const dy = ny - ch.cy;
    const len = Math.hypot(dx / rx, dy / ry);
    if (len > 0.0001) {
      const cx = ch.cx + (dx / len);
      const cy = ch.cy + (dy / len);
      const d = dist(nx, ny, cx, cy);
      if (d < bestDist) {
        bestDist = d;
        clampedX = cx;
        clampedY = cy;
      }
    }
  }

  for (const cor of cave.corridors) {
    const minX = Math.min(cor.x1, cor.x2) - 18;
    const maxX = Math.max(cor.x1, cor.x2) + 18;
    const midY = (cor.y1 + cor.y2) * 0.5;
    const halfH = cor.width * 0.5 - entityRadius * 0.6;
    const cx = clamp(nx, minX, maxX);
    const cy = clamp(ny, midY - halfH, midY + halfH);
    const d = dist(nx, ny, cx, cy);
    if (d < bestDist) {
      bestDist = d;
      clampedX = cx;
      clampedY = cy;
    }
  }

  return { x: clampedX, y: clampedY };
}
