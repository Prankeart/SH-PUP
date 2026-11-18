import {
  CaveBridge,
  CaveChamber,
  CaveChest,
  CaveCorridor,
  CaveEnemy,
  CaveEnemyKind,
  CaveEntrance,
  CaveInterior,
  CavePool,
  CaveProp,
  CaveTheme,
  CaveWallPillar,
  Vec2,
  WeaponId,
} from '../types/game';
import { clamp, dist, mulberry32 } from '../utils/prng';

function hashStr(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h || 1234567;
}

const THEMES: CaveTheme[] = [
  'CRYSTAL_GROTTO',
  'VOLCANIC_CALDERA',
  'SMUGGLER_COVE',
  'ANCIENT_TOMB',
  'FUNGAL_ABYSS',
];

function resolveTheme(entrance: CaveEntrance, rng: () => number): CaveTheme {
  if (entrance.theme) return entrance.theme;
  if (entrance.biome === 'VOLCANIC') return 'VOLCANIC_CALDERA';
  if (entrance.biome === 'RUINS' || entrance.biome === 'OASIS') return 'ANCIENT_TOMB';
  if (entrance.biome === 'JUNGLE' || entrance.biome === 'DARK_LAGOON') return 'FUNGAL_ABYSS';
  if (entrance.biome === 'CORAL_REEF') return 'SMUGGLER_COVE';
  return THEMES[Math.floor(rng() * THEMES.length)];
}

function makeRockPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: () => number,
  slices = 24
): Vec2[] {
  const pts: Vec2[] = [];
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2;
    const wave =
      Math.sin(a * 3 + p1) * 0.08 +
      Math.cos(a * 5 + p2) * 0.06 +
      (rng() - 0.5) * 0.07;
    const scale = 1 + wave;
    pts.push({
      x: cx + Math.cos(a) * rx * scale,
      y: cy + Math.sin(a) * ry * scale,
    });
  }
  return pts;
}

function makeJaggedPillar(x: number, y: number, r: number, rng: () => number): Vec2[] {
  const pts: Vec2[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.86 + rng() * 0.24);
    pts.push({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad });
  }
  return pts;
}

function pointInPoly(x: number, y: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-7) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Vec2 {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-5) return { x: x1, y: y1 };
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return { x: x1 + dx * t, y: y1 + dy * t };
}

function pickCaveWeapon(theme: CaveTheme, tier: 1 | 2 | 3, rng: () => number): WeaponId {
  if (theme === 'VOLCANIC_CALDERA') {
    return tier >= 2 ? 'MAGMA_CANNON' : 'OBSIDIAN_BLADE';
  }
  if (theme === 'ANCIENT_TOMB') {
    return tier >= 2 ? 'SHADOW_SCYTHE' : 'OBSIDIAN_BLADE';
  }
  if (theme === 'SMUGGLER_COVE') {
    return tier >= 2 ? 'STORM_TRIDENT' : 'CRYSTAL_BLUNDERBUSS';
  }
  if (theme === 'FUNGAL_ABYSS') {
    return tier >= 2 ? 'PHANTOM_REPEATER' : 'SHADOW_SCYTHE';
  }
  // CRYSTAL_GROTTO
  if (tier === 3) return rng() < 0.5 ? 'CRYSTAL_BLUNDERBUSS' : 'STORM_TRIDENT';
  return tier === 2 ? 'CRYSTAL_BLUNDERBUSS' : 'OBSIDIAN_BLADE';
}

export function generateCaveInterior(
  entrance: CaveEntrance,
  worldSeed: number,
  openedChestIds: Set<string>,
  unlockedWeapons: Set<string>
): CaveInterior {
  const rng = mulberry32(hashStr(entrance.id, worldSeed));
  const theme = resolveTheme(entrance, rng);
  const archetype = Math.floor(rng() * 3); // 0: Twin-Wing, 1: Winding Serpent, 2: Catacomb Loop

  const width = 2320;
  const height = 1680;
  const midY = height * 0.5;

  const chambers: CaveChamber[] = [];
  const corridors: CaveCorridor[] = [];

  if (archetype === 0) {
    // Twin-Wing Grand Cavern: Entry -> Grand Hub -> North Alcove & South Alcove -> Boss Vault
    const cEntry: CaveChamber = {
      cx: 320,
      cy: midY + (rng() - 0.5) * 90,
      rx: 185,
      ry: 175,
      rockPoly: [],
      kind: 'ENTRY',
    };
    const cHub: CaveChamber = {
      cx: 920 + (rng() - 0.5) * 70,
      cy: midY + (rng() - 0.5) * 60,
      rx: 280,
      ry: 265,
      rockPoly: [],
      kind: 'HUB',
    };
    const cNorth: CaveChamber = {
      cx: 1220 + (rng() - 0.5) * 90,
      cy: midY - 430 + (rng() - 0.5) * 50,
      rx: 205,
      ry: 175,
      rockPoly: [],
      kind: 'ALCOVE',
    };
    const cSouth: CaveChamber = {
      cx: 1180 + (rng() - 0.5) * 90,
      cy: midY + 430 + (rng() - 0.5) * 50,
      rx: 215,
      ry: 180,
      rockPoly: [],
      kind: 'ALCOVE',
    };
    const cBoss: CaveChamber = {
      cx: 1860 + (rng() - 0.5) * 80,
      cy: midY + (rng() - 0.5) * 110,
      rx: 265,
      ry: 250,
      rockPoly: [],
      kind: 'BOSS',
    };
    chambers.push(cEntry, cHub, cNorth, cSouth, cBoss);
    corridors.push(
      { x1: cEntry.cx, y1: cEntry.cy, x2: cHub.cx, y2: cHub.cy, width: 118 },
      { x1: cHub.cx, y1: cHub.cy, x2: cNorth.cx, y2: cNorth.cy, width: 108 },
      { x1: cHub.cx, y1: cHub.cy, x2: cSouth.cx, y2: cSouth.cy, width: 108 },
      { x1: cHub.cx, y1: cHub.cy, x2: cBoss.cx, y2: cBoss.cy, width: 124 },
      { x1: cNorth.cx + 40, y1: cNorth.cy + 20, x2: cBoss.cx - 40, y2: cBoss.cy - 40, width: 96 }
    );
  } else if (archetype === 1) {
    // Winding Serpent Gorge: 5 cascading chambers snaking up and down
    const c0: CaveChamber = {
      cx: 300,
      cy: midY + 210,
      rx: 180,
      ry: 175,
      rockPoly: [],
      kind: 'ENTRY',
    };
    const c1: CaveChamber = {
      cx: 740,
      cy: midY - 220 + (rng() - 0.5) * 60,
      rx: 225,
      ry: 205,
      rockPoly: [],
      kind: 'HUB',
    };
    const c2: CaveChamber = {
      cx: 1180,
      cy: midY + 260 + (rng() - 0.5) * 60,
      rx: 245,
      ry: 215,
      rockPoly: [],
      kind: 'HUB',
    };
    const c3: CaveChamber = {
      cx: 1520,
      cy: midY - 250 + (rng() - 0.5) * 60,
      rx: 210,
      ry: 195,
      rockPoly: [],
      kind: 'ALCOVE',
    };
    const c4: CaveChamber = {
      cx: 1920,
      cy: midY + 70 + (rng() - 0.5) * 80,
      rx: 270,
      ry: 255,
      rockPoly: [],
      kind: 'BOSS',
    };
    chambers.push(c0, c1, c2, c3, c4);
    corridors.push(
      { x1: c0.cx, y1: c0.cy, x2: c1.cx, y2: c1.cy, width: 114 },
      { x1: c1.cx, y1: c1.cy, x2: c2.cx, y2: c2.cy, width: 118 },
      { x1: c2.cx, y1: c2.cy, x2: c3.cx, y2: c3.cy, width: 112 },
      { x1: c3.cx, y1: c3.cy, x2: c4.cx, y2: c4.cy, width: 120 },
      // Shortcut secret passage between c2 and c4
      { x1: c2.cx + 60, y1: c2.cy, x2: c4.cx - 40, y2: c4.cy, width: 96 }
    );
  } else {
    // Catacomb Loop: Entry -> West Hall -> North Gallery + South Crypt -> Central Sanctum -> East Boss
    const cEntry: CaveChamber = {
      cx: 290,
      cy: midY,
      rx: 185,
      ry: 185,
      rockPoly: [],
      kind: 'ENTRY',
    };
    const cWest: CaveChamber = {
      cx: 740,
      cy: midY,
      rx: 220,
      ry: 215,
      rockPoly: [],
      kind: 'HUB',
    };
    const cNorth: CaveChamber = {
      cx: 1150,
      cy: midY - 390,
      rx: 210,
      ry: 185,
      rockPoly: [],
      kind: 'ALCOVE',
    };
    const cSouth: CaveChamber = {
      cx: 1150,
      cy: midY + 390,
      rx: 210,
      ry: 185,
      rockPoly: [],
      kind: 'ALCOVE',
    };
    const cMid: CaveChamber = {
      cx: 1420,
      cy: midY,
      rx: 230,
      ry: 215,
      rockPoly: [],
      kind: 'HUB',
    };
    const cBoss: CaveChamber = {
      cx: 1940,
      cy: midY,
      rx: 275,
      ry: 260,
      rockPoly: [],
      kind: 'BOSS',
    };
    chambers.push(cEntry, cWest, cNorth, cSouth, cMid, cBoss);
    corridors.push(
      { x1: cEntry.cx, y1: cEntry.cy, x2: cWest.cx, y2: cWest.cy, width: 118 },
      { x1: cWest.cx, y1: cWest.cy, x2: cNorth.cx, y2: cNorth.cy, width: 108 },
      { x1: cWest.cx, y1: cWest.cy, x2: cSouth.cx, y2: cSouth.cy, width: 108 },
      { x1: cNorth.cx, y1: cNorth.cy, x2: cMid.cx, y2: cMid.cy, width: 106 },
      { x1: cSouth.cx, y1: cSouth.cy, x2: cMid.cx, y2: cMid.cy, width: 106 },
      { x1: cMid.cx, y1: cMid.cy, x2: cBoss.cx, y2: cBoss.cy, width: 126 }
    );
  }

  for (const ch of chambers) {
    ch.rockPoly = makeRockPolygon(ch.cx, ch.cy, ch.rx, ch.ry, rng, 26);
  }

  const entryChamber = chambers[0];
  const bossChamber = chambers[chambers.length - 1];
  const entryPos = { x: entryChamber.cx - 48, y: entryChamber.cy };
  const exitPos = { x: entryChamber.cx - 96, y: entryChamber.cy };

  // Pools & Bridges matching cave theme
  const pools: CavePool[] = [];
  const bridges: CaveBridge[] = [];
  const poolKind: CavePool['kind'] =
    theme === 'VOLCANIC_CALDERA' ? 'LAVA' : theme === 'FUNGAL_ABYSS' ? 'SPORE' : 'WATER';

  for (let i = 1; i < chambers.length - 1; i++) {
    const ch = chambers[i];
    if (i === 1 || rng() < 0.72) {
      const px = ch.cx + (rng() - 0.5) * 55;
      const py = ch.cy + (rng() > 0.5 ? -1 : 1) * (ch.ry * 0.42);
      const rx = 58 + rng() * 34;
      const ry = 36 + rng() * 20;
      pools.push({
        x: px,
        y: py,
        rx,
        ry,
        kind: poolKind,
        points: makeRockPolygon(px, py, rx, ry, rng, 16),
      });
      if (i === 1 || theme === 'SMUGGLER_COVE' || theme === 'ANCIENT_TOMB') {
        bridges.push({
          x1: px - rx * 0.9,
          y1: py,
          x2: px + rx * 0.9,
          y2: py,
          width: 44,
          material: theme === 'ANCIENT_TOMB' ? 'STONE' : 'WOOD',
        });
      }
    }
  }

  // Rock Pillars placed cleanly inside chambers without blocking entry or corridor centers
  const pillars: CaveWallPillar[] = [];
  for (let ci = 0; ci < chambers.length; ci++) {
    const ch = chambers[ci];
    const pCount = ch.kind === 'BOSS' ? 4 : ch.kind === 'HUB' ? 3 : 2;
    for (let k = 0; k < pCount; k++) {
      const ang = (k / pCount) * Math.PI * 2 + rng() * 0.8;
      const distFrac = ch.kind === 'BOSS' ? 0.56 : 0.48 + rng() * 0.14;
      const px = ch.cx + Math.cos(ang) * ch.rx * distFrac;
      const py = ch.cy + Math.sin(ang) * ch.ry * distFrac;
      const rad = 22 + rng() * 11;
      if (dist(px, py, entryPos.x, entryPos.y) < 92) continue;
      if (dist(px, py, exitPos.x, exitPos.y) < 92) continue;
      if (ch.kind === 'BOSS' && dist(px, py, ch.cx, ch.cy) < 75) continue;
      if (pillars.some((op) => dist(op.x, op.y, px, py) < op.radius + rad + 26)) continue;
      pillars.push({
        x: px,
        y: py,
        radius: rad,
        jaggedPoly: makeJaggedPillar(px, py, rad, rng),
      });
    }
  }

  // Crystals (color palette tailored by theme)
  const crystalPalette =
    theme === 'VOLCANIC_CALDERA'
      ? ['#F97316', '#EF4444', '#FBBF24', '#FB7185']
      : theme === 'FUNGAL_ABYSS'
      ? ['#10B981', '#2DD4BF', '#34D399', '#22D3EE']
      : theme === 'ANCIENT_TOMB'
      ? ['#FBBF24', '#2DD4BF', '#A3E635', '#FDE047']
      : theme === 'SMUGGLER_COVE'
      ? ['#38BDF8', '#22D3EE', '#FBBF24', '#94A3B8']
      : ['#A855F7', '#22D3EE', '#E879F9', '#38BDF8'];

  const crystals: CaveInterior['crystals'] = [];
  const crystalCount = theme === 'CRYSTAL_GROTTO' ? 42 : 24;
  for (let i = 0; i < crystalCount; i++) {
    const ch = chambers[i % chambers.length];
    const ang = rng() * Math.PI * 2;
    const radFrac = 0.65 + rng() * 0.25;
    const cx = ch.cx + Math.cos(ang) * ch.rx * radFrac;
    const cy = ch.cy + Math.sin(ang) * ch.ry * radFrac;
    if (dist(cx, cy, entryPos.x, entryPos.y) < 62) continue;
    crystals.push({
      x: cx,
      y: cy,
      size: 7 + rng() * 10,
      color: crystalPalette[Math.floor(rng() * crystalPalette.length)],
      angle: rng() * Math.PI * 2,
    });
  }

  // Rich Environmental Props
  const props: CaveProp[] = [];
  for (const ch of chambers) {
    if (theme === 'FUNGAL_ABYSS') {
      for (let m = 0; m < 6; m++) {
        const a = rng() * Math.PI * 2;
        const rf = 0.5 + rng() * 0.35;
        props.push({
          x: ch.cx + Math.cos(a) * ch.rx * rf,
          y: ch.cy + Math.sin(a) * ch.ry * rf,
          kind: 'MUSHROOM',
          size: 9 + rng() * 10,
          angle: rng() * Math.PI * 2,
          color: rng() < 0.5 ? '#2DD4BF' : '#34D399',
        });
      }
    } else if (theme === 'SMUGGLER_COVE') {
      for (let m = 0; m < 4; m++) {
        const a = rng() * Math.PI * 2;
        const rf = 0.45 + rng() * 0.35;
        props.push({
          x: ch.cx + Math.cos(a) * ch.rx * rf,
          y: ch.cy + Math.sin(a) * ch.ry * rf,
          kind: m === 0 ? 'SHIP_RIB' : 'CRATE',
          size: m === 0 ? 18 + rng() * 8 : 10 + rng() * 4,
          angle: rng() * Math.PI * 2,
          color: '#92400E',
        });
      }
    } else if (theme === 'ANCIENT_TOMB') {
      props.push({
        x: ch.cx,
        y: ch.cy,
        kind: 'RUNE_CIRCLE',
        size: Math.min(ch.rx, ch.ry) * 0.48,
        angle: rng() * Math.PI,
        color: '#2DD4BF',
      });
      for (let b = 0; b < 3; b++) {
        const a = rng() * Math.PI * 2;
        props.push({
          x: ch.cx + Math.cos(a) * ch.rx * 0.58,
          y: ch.cy + Math.sin(a) * ch.ry * 0.58,
          kind: 'BONES',
          size: 9 + rng() * 5,
          angle: rng() * Math.PI * 2,
          color: '#CBD5E1',
        });
      }
    } else {
      for (let s = 0; s < 4; s++) {
        const a = rng() * Math.PI * 2;
        props.push({
          x: ch.cx + Math.cos(a) * ch.rx * (0.55 + rng() * 0.25),
          y: ch.cy + Math.sin(a) * ch.ry * (0.55 + rng() * 0.25),
          kind: rng() < 0.3 ? 'BONES' : 'STALAGMITE',
          size: 8 + rng() * 7,
          angle: rng() * Math.PI * 2,
          color: theme === 'VOLCANIC_CALDERA' ? '#44403C' : '#64748B',
        });
      }
    }
  }

  // Torches / Braziers along every chamber perimeter & corridor midpoints
  const torchColor =
    theme === 'FUNGAL_ABYSS'
      ? '#2DD4BF'
      : theme === 'CRYSTAL_GROTTO'
      ? '#38BDF8'
      : theme === 'ANCIENT_TOMB'
      ? '#34D399'
      : '#FB923C';
  const torches: CaveInterior['torches'] = [];
  for (const ch of chambers) {
    const tCount = ch.kind === 'BOSS' || ch.kind === 'HUB' ? 4 : 3;
    for (let t = 0; t < tCount; t++) {
      const a = (t / tCount) * Math.PI * 2 + 0.35;
      torches.push({
        x: ch.cx + Math.cos(a) * (ch.rx * 0.78),
        y: ch.cy + Math.sin(a) * (ch.ry * 0.78),
        phase: rng() * 6.28,
        color: torchColor,
      });
    }
  }
  for (const cor of corridors) {
    torches.push({
      x: (cor.x1 + cor.x2) * 0.5,
      y: (cor.y1 + cor.y2) * 0.5 - 28,
      phase: rng() * 6.28,
      color: torchColor,
    });
  }

  // Treasure Chests distributed in side alcoves, hubs, and Boss Vault
  const tierMult = entrance.tier === 3 ? 1.75 : entrance.tier === 2 ? 1.3 : 1;
  const chests: CaveChest[] = [];
  for (let i = 1; i < chambers.length - 1; i++) {
    const ch = chambers[i];
    const cid = `${entrance.id}_chest_${i}`;
    const ang = (i % 2 === 0 ? -0.65 : 0.75) + (rng() - 0.5) * 0.4;
    chests.push({
      id: cid,
      x: ch.cx + Math.cos(ang) * ch.rx * 0.52,
      y: ch.cy + Math.sin(ang) * ch.ry * 0.52,
      goldValue: Math.round((75 + rng() * 55) * tierMult),
      tier: 'NORMAL',
      opened: openedChestIds.has(cid),
    });
  }
  // Extra hidden chest in first alcove or entry wing
  const wingCid = `${entrance.id}_chest_wing`;
  chests.push({
    id: wingCid,
    x: chambers[1].cx - chambers[1].rx * 0.52,
    y: chambers[1].cy + chambers[1].ry * 0.36,
    goldValue: Math.round((85 + rng() * 45) * tierMult),
    tier: 'NORMAL',
    opened: openedChestIds.has(wingCid),
  });
  const bossCid = `${entrance.id}_chest_boss`;
  chests.push({
    id: bossCid,
    x: bossChamber.cx + bossChamber.rx * 0.52,
    y: bossChamber.cy,
    goldValue: Math.round((190 + rng() * 90) * tierMult),
    tier: 'BOSS',
    opened: openedChestIds.has(bossCid),
  });

  // Theme-Specific Secret Weapon Altar
  const altarWeapon = pickCaveWeapon(theme, entrance.tier, rng);
  const altarId = `${entrance.id}_altar`;
  const weaponAltar = {
    id: altarId,
    x: bossChamber.cx + bossChamber.rx * 0.25,
    y: bossChamber.cy - bossChamber.ry * 0.48,
    weaponId: altarWeapon,
    claimed: openedChestIds.has(altarId) || unlockedWeapons.has(altarWeapon),
  };

  // Subterranean Enemies & Theme Boss
  const hpScale = entrance.tier === 3 ? 1.55 : entrance.tier === 2 ? 1.25 : 1;
  const enemies: CaveEnemy[] = [];
  let mobIdx = 0;

  const addCreature = (kind: CaveEnemyKind, x: number, y: number) => {
    const isBoss =
      kind === 'CRYSTAL_GOLEM' || kind === 'LAVA_ELEMENTAL' || kind === 'TOMB_GUARDIAN';
    const baseHp =
      kind === 'BAT'
        ? 44
        : kind === 'SPIDER'
        ? 58
        : kind === 'CRAB'
        ? 74
        : kind === 'SCORPION'
        ? 94
        : kind === 'LAVA_ELEMENTAL'
        ? 360
        : kind === 'TOMB_GUARDIAN'
        ? 380
        : 330;
    const baseDmg =
      kind === 'BAT'
        ? 9
        : kind === 'SPIDER'
        ? 13
        : kind === 'CRAB'
        ? 13
        : kind === 'SCORPION'
        ? 17
        : 28;
    const speed =
      kind === 'BAT'
        ? 128
        : kind === 'SPIDER'
        ? 118
        : kind === 'CRAB'
        ? 86
        : kind === 'SCORPION'
        ? 105
        : 78;
    const radius = isBoss ? 26 : kind === 'SCORPION' ? 14 : 12;
    const name =
      kind === 'BAT'
        ? 'Mağara Yarasası'
        : kind === 'SPIDER'
        ? 'Karanlık Örümcek'
        : kind === 'CRAB'
        ? 'Kaya Yengeci'
        : kind === 'SCORPION'
        ? 'Gölge Akrebi'
        : kind === 'LAVA_ELEMENTAL'
        ? 'Magma Devi (Patron)'
        : kind === 'TOMB_GUARDIAN'
        ? 'Kadim Muhafız (Patron)'
        : 'Kristal Golem (Patron)';

    const maxHp = Math.round(baseHp * hpScale);
    enemies.push({
      id: `${entrance.id}_mob_${mobIdx++}`,
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
      goldBounty: isBoss ? Math.round(135 * tierMult) : kind === 'SCORPION' ? 32 : 22,
    });
  };

  const mobPool: CaveEnemyKind[] =
    theme === 'VOLCANIC_CALDERA'
      ? ['SCORPION', 'BAT', 'SPIDER']
      : theme === 'SMUGGLER_COVE'
      ? ['CRAB', 'BAT', 'SPIDER']
      : theme === 'FUNGAL_ABYSS'
      ? ['SPIDER', 'BAT', 'CRAB']
      : ['SCORPION', 'SPIDER', 'BAT'];

  // Entry patrol (far enough from entrance)
  addCreature(mobPool[0], entryChamber.cx + 86, entryChamber.cy + (rng() - 0.5) * 40);

  // Middle chambers (3-4 foes each)
  for (let ci = 1; ci < chambers.length - 1; ci++) {
    const ch = chambers[ci];
    const count = ch.kind === 'HUB' ? 4 : 3;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rng() * 0.7;
      const mx = ch.cx + Math.cos(a) * (ch.rx * 0.42);
      const my = ch.cy + Math.sin(a) * (ch.ry * 0.42);
      const kind = mobPool[(ci + k) % mobPool.length];
      addCreature(kind, mx, my);
    }
  }

  // Boss Chamber Guards + Theme Boss
  addCreature('SCORPION', bossChamber.cx - 85, bossChamber.cy - 65);
  addCreature('SPIDER', bossChamber.cx - 85, bossChamber.cy + 65);
  const bossKind: CaveEnemyKind =
    theme === 'VOLCANIC_CALDERA'
      ? 'LAVA_ELEMENTAL'
      : theme === 'ANCIENT_TOMB'
      ? 'TOMB_GUARDIAN'
      : 'CRYSTAL_GOLEM';
  addCreature(bossKind, bossChamber.cx + 36, bossChamber.cy);

  return {
    caveId: entrance.id,
    islandId: entrance.islandId,
    name: entrance.name,
    tier: entrance.tier,
    theme,
    width,
    height,
    chambers,
    corridors,
    pillars,
    pools,
    bridges,
    props,
    crystals,
    torches,
    entryPos,
    exitPos,
    chests,
    weaponAltar,
    enemies,
  };
}

export function isPointInsideCaveWalkable(
  cave: CaveInterior,
  x: number,
  y: number,
  margin = 12
): boolean {
  for (const ch of cave.chambers) {
    if (Math.abs(x - ch.cx) > ch.rx * 1.18 || Math.abs(y - ch.cy) > ch.ry * 1.18) continue;
    const nx = (x - ch.cx) / Math.max(1, ch.rx - margin);
    const ny = (y - ch.cy) / Math.max(1, ch.ry - margin);
    if (nx * nx + ny * ny <= 1) return true;
    if (ch.rockPoly.length > 3 && margin <= 6 && pointInPoly(x, y, ch.rockPoly)) return true;
  }
  for (const cor of cave.corridors) {
    const cp = closestPointOnSegment(x, y, cor.x1, cor.y1, cor.x2, cor.y2);
    const halfW = cor.width * 0.5 - margin * 0.48;
    if (dist(x, y, cp.x, cp.y) <= halfW) {
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

  // Smoothly clamp toward nearest chamber ellipse or angled corridor capsule
  let bestDist = Infinity;
  let clampedX = nx;
  let clampedY = ny;

  for (const ch of cave.chambers) {
    const rx = Math.max(12, ch.rx - entityRadius);
    const ry = Math.max(12, ch.ry - entityRadius);
    const dx = nx - ch.cx;
    const dy = ny - ch.cy;
    const len = Math.hypot(dx / rx, dy / ry);
    if (len > 0.0001) {
      const cx = ch.cx + dx / len;
      const cy = ch.cy + dy / len;
      const d = dist(nx, ny, cx, cy);
      if (d < bestDist) {
        bestDist = d;
        clampedX = cx;
        clampedY = cy;
      }
    }
  }

  for (const cor of cave.corridors) {
    const cp = closestPointOnSegment(nx, ny, cor.x1, cor.y1, cor.x2, cor.y2);
    const maxR = Math.max(8, cor.width * 0.5 - entityRadius * 0.5);
    const dToSeg = dist(nx, ny, cp.x, cp.y);
    if (dToSeg <= maxR) {
      return { x: nx, y: ny };
    }
    const ang = Math.atan2(ny - cp.y, nx - cp.x);
    const cx = cp.x + Math.cos(ang) * maxR;
    const cy = cp.y + Math.sin(ang) * maxR;
    const d = dist(nx, ny, cx, cy);
    if (d < bestDist) {
      bestDist = d;
      clampedX = cx;
      clampedY = cy;
    }
  }

  return { x: clampedX, y: clampedY };
}
