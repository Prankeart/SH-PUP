import {
  CaveEntrance,
  EnemyFactionId,
  FactionId,
  InlandLake,
  Island,
  IslandBiome,
  IslandEnemySpawn,
  IslandFoliage,
  IslandRoad,
  Landmark,
  PalmTree,
  ResourceNode,
  RockProp,
  SpecialZoneType,
  TreasureSpot,
  TreasureTemplate,
  Vec2,
  WeaponId,
  WeaponPickup,
} from '../types/game';
import { StarterSlot } from '../types/online';
import { ENEMY_FACTIONS, getIslandGarrisonProfile } from './factions';
import { dist, hashCoords, mulberry32 } from '../utils/prng';

export const SECTOR_SIZE = 2250;
const PROFILE_SLICES = 48;

const ISLAND_PREFIXES = [
  'Mercan',
  'Zümrüt',
  'Palmiye',
  'Altınkum',
  'Korsan',
  'Lagün',
  'Fısıltı',
  'Güneş',
  'Pruva',
  'Yakut',
  'Sığlık',
  'Rüzgar',
  'Volkan',
  'Ejder',
  'Gök',
  'Fırtına',
];

const ISLAND_SUFFIXES = [
  'Adası',
  'Koyu',
  'Atolü',
  'Burnu',
  'Kayası',
  'Tepesi',
  'Cenneti',
  'Sığınağı',
  'Kalesi',
  'Yarımadası',
];

function pickIslandFaction(sx: number, sy: number, isStarter: boolean, isLarge: boolean, rng: () => number): FactionId {
  if (isStarter) return 'NEUTRAL';
  if (sx === 1 && sy === 0) return 'NEUTRAL';
  if (sx === 0 && sy === 1) return 'CORSAIR';
  if (sx === -1 && sy === 0) return 'IMPERIAL';
  if (sx === 0 && sy === -1) return 'SUN_CLAN';

  // Outer sectors: ~74% claimed by one of the 3 enemy nations (all large islands are claimed!)
  if (!isLarge && rng() > 0.72) return 'NEUTRAL';

  const r = rng();
  if (sx >= 1 && sy <= 0) {
    return r < 0.6 ? 'IMPERIAL' : r < 0.85 ? 'CORSAIR' : 'SUN_CLAN';
  }
  if (sy >= 1 && sx <= 0) {
    return r < 0.55 ? 'CORSAIR' : r < 0.85 ? 'SUN_CLAN' : 'IMPERIAL';
  }
  if (sx >= 0 && sy >= 1) {
    return r < 0.58 ? 'SUN_CLAN' : r < 0.85 ? 'IMPERIAL' : 'CORSAIR';
  }
  const pool: EnemyFactionId[] = ['CORSAIR', 'IMPERIAL', 'SUN_CLAN'];
  return pool[Math.floor(rng() * pool.length)];
}

function pickIslandBiome(isStarter: boolean, factionId: FactionId, isLarge: boolean, rng: () => number): IslandBiome {
  if (isStarter) return 'TROPICAL';
  const r = rng();
  if (factionId === 'CORSAIR') {
    if (r < 0.28) return 'VOLCANIC';
    if (r < 0.54) return 'DARK_LAGOON';
    if (r < 0.78) return 'JUNGLE';
    return r < 0.9 ? 'TROPICAL' : 'RUINS';
  }
  if (factionId === 'SUN_CLAN') {
    if (r < 0.3) return 'OASIS';
    if (r < 0.58) return 'CORAL_REEF';
    if (r < 0.82) return 'RUINS';
    return 'TROPICAL';
  }
  if (factionId === 'IMPERIAL') {
    if (r < 0.28) return 'TROPICAL';
    if (r < 0.52) return 'CORAL_REEF';
    if (r < 0.74) return 'JUNGLE';
    return isLarge ? 'RUINS' : 'DARK_LAGOON';
  }
  const biomes: IslandBiome[] = [
    'TROPICAL',
    'JUNGLE',
    'OASIS',
    'RUINS',
    'VOLCANIC',
    'CORAL_REEF',
    'DARK_LAGOON',
  ];
  return biomes[Math.floor(r * biomes.length)];
}

const TREASURE_TEMPLATES: TreasureTemplate[] = [
  { name: 'Bronz Sikke Kesesi', rarity: 'COMMON', baseValue: 55, color: '#D97706' },
  { name: 'Gümüş Kadeh', rarity: 'COMMON', baseValue: 75, color: '#94A3B8' },
  { name: 'Antik Pirinç Pusula', rarity: 'RARE', baseValue: 135, color: '#F59E0B' },
  { name: 'Turkuaz İnci Kolye', rarity: 'RARE', baseValue: 165, color: '#06B6D4' },
  { name: 'Zümrüt Ganimet Sandığı', rarity: 'EPIC', baseValue: 260, color: '#10B981' },
  { name: 'Kraliyet Yakut Tacı', rarity: 'LEGENDARY', baseValue: 440, color: '#EF4444' },
];

function pickTreasureTemplate(rng: () => number, distanceFactor: number, luckLevel: number): TreasureTemplate {
  const luckBoost = (luckLevel - 1) * 0.06;
  const roll = Math.min(0.999, rng() + distanceFactor * 0.14 + luckBoost);
  if (roll > 0.93) return TREASURE_TEMPLATES[5];
  if (roll > 0.78) return TREASURE_TEMPLATES[4];
  if (roll > 0.56) return TREASURE_TEMPLATES[3];
  if (roll > 0.36) return TREASURE_TEMPLATES[2];
  if (roll > 0.18) return TREASURE_TEMPLATES[1];
  return TREASURE_TEMPLATES[0];
}

function getProfileRadius(radialProfile: number[], angle: number): number {
  const twoPi = Math.PI * 2;
  const normalized = ((angle % twoPi) + twoPi) % twoPi;
  const exactIndex = (normalized / twoPi) * PROFILE_SLICES;
  const i0 = Math.floor(exactIndex) % PROFILE_SLICES;
  const i1 = (i0 + 1) % PROFILE_SLICES;
  const frac = exactIndex - Math.floor(exactIndex);
  return radialProfile[i0] * (1 - frac) + radialProfile[i1] * frac;
}

export function getIslandRadiusAtAngle(island: Island, angle: number): number {
  return getProfileRadius(island.radialProfile, angle);
}

export function isPointOnIsland(island: Island, x: number, y: number, margin = 0): boolean {
  const dx = x - island.centerX;
  const dy = y - island.centerY;
  const d = Math.hypot(dx, dy);
  if (d > island.maxRadius + margin) return false;
  const angle = Math.atan2(dy, dx);
  return d <= getIslandRadiusAtAngle(island, angle) + margin;
}

export function generateSectorIsland(
  worldSeed: number,
  sx: number,
  sy: number,
  luckLevel = 1,
  onlineMode = false
): Island | null {
  const sectorSeed = hashCoords(worldSeed, sx, sy);
  const rng = mulberry32(sectorSeed);
  const isStarter = !onlineMode && sx === 0 && sy === 0;
  if (onlineMode && sx === 0 && sy === 0) {
    // Online mode keeps (0,0) as open central meeting sea surrounded by equal starter islands
    return null;
  }
  const isNearOrigin = Math.abs(sx) <= 1 && Math.abs(sy) <= 1;

  const isGuaranteedCity = sx === 1 && sy === 1;
  const isGuaranteedArena = sx === -1 && sy === 1;
  const isGuaranteedSecret = (sx === 2 && sy === 1) || (sx === -2 && sy === -1);
  const spawnRoll = rng();
  const guaranteedNeighbor =
    (sx === 1 && sy === 0) ||
    (sx === 0 && sy === 1) ||
    (sx === -1 && sy === 0) ||
    isGuaranteedCity ||
    isGuaranteedArena ||
    isGuaranteedSecret;
  if (!isStarter && !guaranteedNeighbor && spawnRoll > 0.77) {
    return null;
  }

  let specialZone: SpecialZoneType | null = null;
  if (!isStarter) {
    if (isGuaranteedCity) specialZone = 'CITY';
    else if (isGuaranteedArena) specialZone = 'ARENA';
    else if (isGuaranteedSecret) specialZone = 'SECRET';
    else if (Math.abs(sx) >= 2 || Math.abs(sy) >= 2) {
      const zRoll = rng();
      if (zRoll < 0.1) specialZone = 'CITY';
      else if (zRoll < 0.18) specialZone = 'ARENA';
      else if (zRoll < 0.3) specialZone = 'SECRET';
    }
  }
  const isSecret = specialZone === 'SECRET';

  // Large & Mega Islands with rich interiors and huge armies
  const isGuaranteedLarge = sx === 0 && sy === 1;
  const isLarge =
    !isStarter &&
    (specialZone === 'CITY' ||
      specialZone === 'ARENA' ||
      isGuaranteedLarge ||
      rng() < 0.42);

  const centerX = isStarter ? 0 : sx * SECTOR_SIZE + (rng() - 0.5) * 340;
  const centerY = isStarter ? 0 : sy * SECTOR_SIZE + (rng() - 0.5) * 340;
  const baseRadius = isStarter
    ? 375
    : specialZone === 'CITY'
    ? 820 + rng() * 120
    : specialZone === 'ARENA'
    ? 540 + rng() * 80
    : specialZone === 'SECRET'
    ? 440 + rng() * 90
    : isLarge
    ? 580 + rng() * 225
    : 300 + rng() * 190;

  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const p4 = rng() * Math.PI * 2;
  const a1 = 0.07 + rng() * 0.08;
  const a2 = 0.05 + rng() * 0.06;
  const a3 = 0.03 + rng() * 0.04;
  const a4 = 0.02 + rng() * 0.03;

  const radialProfile: number[] = [];
  const coastPoints: Vec2[] = [];
  const grassPoints: Vec2[] = [];
  let maxRadius = 0;

  for (let i = 0; i < PROFILE_SLICES; i++) {
    const theta = (i / PROFILE_SLICES) * Math.PI * 2;
    const wave =
      1 +
      a1 * Math.sin(theta * 2 + p1) +
      a2 * Math.cos(theta * 3 + p2) +
      a3 * Math.sin(theta * 5 + p3) +
      a4 * Math.cos(theta * 7 + p4);
    const r = baseRadius * wave;
    radialProfile.push(r);
    if (r > maxRadius) maxRadius = r;
    coastPoints.push({
      x: centerX + Math.cos(theta) * r,
      y: centerY + Math.sin(theta) * r,
    });
    grassPoints.push({
      x: centerX + Math.cos(theta) * r * 0.72,
      y: centerY + Math.sin(theta) * r * 0.72,
    });
  }

  const factionId: FactionId =
    onlineMode || specialZone !== null
      ? 'NEUTRAL'
      : pickIslandFaction(sx, sy, isStarter, isLarge, rng);
  const biome =
    specialZone === 'CITY'
      ? 'TROPICAL'
      : specialZone === 'ARENA'
      ? 'VOLCANIC'
      : specialZone === 'SECRET'
      ? 'DARK_LAGOON'
      : pickIslandBiome(isStarter, factionId, isLarge, rng);

  const islandId = `island_${sx}_${sy}`;
  const isMega = isLarge && baseRadius >= 690;
  const rawBaseName = `${ISLAND_PREFIXES[Math.floor(rng() * ISLAND_PREFIXES.length)]} ${
    ISLAND_SUFFIXES[Math.floor(rng() * ISLAND_SUFFIXES.length)]
  }`;
  const name = isStarter
    ? 'Başlangıç Limanı'
    : specialZone === 'CITY'
    ? `${rawBaseName} Büyük Kenti`
    : specialZone === 'ARENA'
    ? `${rawBaseName} Savaş Arenası`
    : specialZone === 'SECRET'
    ? `Gizli ${rawBaseName} Sığınağı`
    : `${rawBaseName}${isMega ? ' (Büyük Kıta)' : isLarge ? ' (Büyük Ada)' : ''}`;

  const hasTrader =
    isStarter ||
    specialZone === 'CITY' ||
    specialZone === 'ARENA' ||
    (sx === 1 && sy === 0) ||
    (!isNearOrigin && factionId === 'NEUTRAL' && rng() < 0.36);
  let traderDock: Island['traderDock'] = null;
  if (hasTrader) {
    const dockAngle = isStarter ? Math.PI : rng() * Math.PI * 2;
    const coastR = getProfileRadius(radialProfile, dockAngle);
    traderDock = {
      x: centerX + Math.cos(dockAngle) * (coastR + 8),
      y: centerY + Math.sin(dockAngle) * (coastR + 8),
      angle: dockAngle,
    };
  }

  // Command Fort / Flagpole position placed early so landmarks & lakes respect it
  let fortPos: Vec2 | null = { x: centerX, y: centerY };
  if (specialZone === 'CITY' || specialZone === 'ARENA') {
    fortPos = null;
  } else if (isStarter) {
    fortPos = { x: centerX - 75, y: centerY - 36 };
  } else {
    const fa = rng() * Math.PI * 2;
    const fr = getProfileRadius(radialProfile, fa) * (0.08 + rng() * 0.14);
    fortPos = { x: centerX + Math.cos(fa) * fr, y: centerY + Math.sin(fa) * fr };
  }

  // Inland Lakes / Oasis Lagoons / Volcanic Crater Lakes
  const lakes: InlandLake[] = [];
  const wantLakes = isLarge
    ? biome === 'OASIS' || biome === 'VOLCANIC'
      ? 2
      : rng() < 0.78
      ? 1
      : 0
    : biome === 'OASIS' || (biome === 'VOLCANIC' && rng() < 0.7)
    ? 1
    : 0;

  for (let l = 0; l < wantLakes; l++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const la = rng() * Math.PI * 2;
      const lr = getProfileRadius(radialProfile, la) * (0.28 + rng() * 0.25);
      const lx = centerX + Math.cos(la) * lr;
      const ly = centerY + Math.sin(la) * lr;
      const lakeR = (isLarge ? 48 : 34) + rng() * (isLarge ? 32 : 16);
      if (fortPos && dist(lx, ly, fortPos.x, fortPos.y) < lakeR + 82) continue;
      if (traderDock && dist(lx, ly, traderDock.x, traderDock.y) < lakeR + 95) continue;
      if (lakes.some((lk) => dist(lx, ly, lk.x, lk.y) < lk.radius + lakeR + 65)) continue;

      const pts: Vec2[] = [];
      const sides = 12;
      for (let s = 0; s < sides; s++) {
        const theta = (s / sides) * Math.PI * 2;
        const rad = lakeR * (0.78 + rng() * 0.34);
        pts.push({ x: lx + Math.cos(theta) * rad, y: ly + Math.sin(theta) * rad });
      }
      lakes.push({
        x: lx,
        y: ly,
        radius: lakeR,
        points: pts,
        isVolcanicCrater: biome === 'VOLCANIC',
      });
      break;
    }
  }

  // Diverse Landmarks: Temples, Bastions, Villages, War Camps, Watchtowers, Obelisks, Ruins, Shipwrecks
  const landmarks: Landmark[] = [];
  const tryPlaceLandmark = (
    id: string,
    type: Landmark['type'],
    radius: number,
    minFrac: number,
    maxFrac: number,
    subOffsets?: Landmark['subOffsets']
  ): boolean => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = getProfileRadius(radialProfile, a) * (minFrac + rng() * (maxFrac - minFrac));
      const lx = centerX + Math.cos(a) * r;
      const ly = centerY + Math.sin(a) * r;
      if (fortPos && dist(lx, ly, fortPos.x, fortPos.y) < radius + 72) continue;
      if (traderDock && dist(lx, ly, traderDock.x, traderDock.y) < radius + 95) continue;
      if (lakes.some((lk) => dist(lx, ly, lk.x, lk.y) < lk.radius + radius + 34)) continue;
      if (landmarks.some((lm) => dist(lm.x, lm.y, lx, ly) < lm.radius + radius + 58)) continue;
      landmarks.push({
        id,
        type,
        x: lx,
        y: ly,
        radius,
        rotation: rng() * Math.PI * 2,
        subOffsets,
      });
      return true;
    }
    return false;
  };

  const makeClusterOffsets = (count: number, spread: number) => {
    const offs = [];
    for (let h = 0; h < count; h++) {
      const ha = (h / count) * Math.PI * 2 + rng() * 0.45;
      const hd = spread + rng() * 14;
      offs.push({
        dx: Math.cos(ha) * hd,
        dy: Math.sin(ha) * hd,
        rot: ha + Math.PI / 2,
        scale: 0.88 + rng() * 0.24,
      });
    }
    return offs;
  };

  let arenaCenter: Vec2 | null = null;
  const caves: CaveEntrance[] = [];

  if (specialZone === 'CITY') {
    landmarks.push({
      id: `${islandId}_city_plaza`,
      type: 'CITY_PLAZA',
      x: centerX,
      y: centerY,
      radius: 95,
      rotation: 0,
    });
    landmarks.push({
      id: `${islandId}_fountain`,
      type: 'FOUNTAIN',
      x: centerX,
      y: centerY,
      radius: 34,
      rotation: 0,
    });
    tryPlaceLandmark(`${islandId}_tavern_0`, 'TAVERN', 48, 0.24, 0.34);
    tryPlaceLandmark(`${islandId}_tavern_1`, 'TAVERN', 46, 0.3, 0.44);
    tryPlaceLandmark(`${islandId}_trading_city`, 'TRADING_POST', 36, 0.26, 0.42);
    tryPlaceLandmark(
      `${islandId}_village_0`,
      'VILLAGE',
      64,
      0.38,
      0.56,
      makeClusterOffsets(6, 42)
    );
    tryPlaceLandmark(
      `${islandId}_village_1`,
      'VILLAGE',
      62,
      0.42,
      0.62,
      makeClusterOffsets(5, 38)
    );
    tryPlaceLandmark(`${islandId}_lighthouse_city`, 'LIGHTHOUSE', 28, 0.76, 0.86);
  } else if (specialZone === 'ARENA') {
    arenaCenter = { x: centerX, y: centerY };
    landmarks.push({
      id: `${islandId}_arena_ring`,
      type: 'ARENA_RING',
      x: centerX,
      y: centerY,
      radius: 195,
      rotation: 0,
    });
    for (let t = 0; t < 4; t++) {
      const ta = (t / 4) * Math.PI * 2 + Math.PI * 0.25;
      landmarks.push({
        id: `${islandId}_arena_tower_${t}`,
        type: 'TOWER',
        x: centerX + Math.cos(ta) * 245,
        y: centerY + Math.sin(ta) * 245,
        radius: 26,
        rotation: ta,
      });
    }
    tryPlaceLandmark(
      `${islandId}_arena_camp`,
      'CAMP',
      44,
      0.54,
      0.7,
      makeClusterOffsets(4, 30)
    );
  } else if (specialZone === 'SECRET') {
    tryPlaceLandmark(`${islandId}_secret_shrine`, 'SECRET_SHRINE', 44, 0.2, 0.36);
    tryPlaceLandmark(`${islandId}_secret_obelisk`, 'OBELISK', 24, 0.42, 0.6);
    tryPlaceLandmark(`${islandId}_secret_ruins`, 'RUINS', 36, 0.38, 0.62);
  } else if (isStarter) {
    // Cozy camp & ancient obelisk on starter island for immediate exploration variety
    tryPlaceLandmark(`${islandId}_camp_0`, 'CAMP', 42, 0.42, 0.56, makeClusterOffsets(3, 28));
    tryPlaceLandmark(`${islandId}_obelisk_0`, 'OBELISK', 24, 0.46, 0.6, undefined);
  } else if (isLarge) {
    // 1. Temple or Ruins
    if (isGuaranteedLarge || biome === 'RUINS' || rng() < 0.85) {
      tryPlaceLandmark(
        `${islandId}_temple`,
        biome === 'RUINS' && rng() < 0.4 ? 'RUINS' : 'TEMPLE',
        46,
        0.18,
        0.36
      );
    }

    // 2. Village Cluster (bigger villages with 4-6 huts)
    if (isGuaranteedLarge || rng() < 0.88) {
      tryPlaceLandmark(
        `${islandId}_village`,
        'VILLAGE',
        62,
        0.4,
        0.62,
        makeClusterOffsets(4 + Math.floor(rng() * 3), 38)
      );
    }

    // 3. Stone Bastion or Military War Camp (faction strongholds)
    if (factionId !== 'NEUTRAL') {
      tryPlaceLandmark(`${islandId}_bastion`, 'BASTION', 40, 0.34, 0.56);
      tryPlaceLandmark(
        `${islandId}_camp`,
        'CAMP',
        46,
        0.48,
        0.68,
        makeClusterOffsets(3 + Math.floor(rng() * 2), 30)
      );
    }

    // 4. Watchtower(s)
    const towerCount = isMega ? 2 : rng() < 0.6 ? 2 : 1;
    for (let t = 0; t < towerCount; t++) {
      tryPlaceLandmark(`${islandId}_tower_${t}`, 'TOWER', 27, 0.52, 0.72);
    }

    // 5. Ancient Obelisk / Ruins / Coastal Shipwreck
    if (rng() < 0.8) {
      tryPlaceLandmark(`${islandId}_obelisk`, 'OBELISK', 24, 0.28, 0.55);
    }
    if (rng() < 0.72) {
      tryPlaceLandmark(`${islandId}_ruins`, 'RUINS', 36, 0.35, 0.62);
    }
    if (rng() < 0.78) {
      tryPlaceLandmark(`${islandId}_wreck`, 'SHIPWRECK', 34, 0.74, 0.86);
    }
    if (rng() < 0.68) {
      tryPlaceLandmark(`${islandId}_lighthouse`, 'LIGHTHOUSE', 26, 0.76, 0.88);
    }
    if (rng() < 0.65) {
      tryPlaceLandmark(`${islandId}_trading`, 'TRADING_POST', 32, 0.42, 0.66);
    }
    if (rng() < 0.55) {
      tryPlaceLandmark(`${islandId}_arch`, 'SEA_ARCH', 30, 0.78, 0.89);
    }
  } else {
    // Standard / Medium islands get 1 to 3 varied landmarks
    const mediumPool: Landmark['type'][] = [
      'TOWER',
      'CAMP',
      'OBELISK',
      'RUINS',
      'VILLAGE',
      'SHIPWRECK',
      'LIGHTHOUSE',
      'TRADING_POST',
      'SEA_ARCH',
    ];
    const targetCount = baseRadius >= 380 ? 3 : 1 + Math.floor(rng() * 2);
    for (let m = 0; m < targetCount; m++) {
      const picked = mediumPool[Math.floor(rng() * mediumPool.length)];
      const rad =
        picked === 'VILLAGE'
          ? 56
          : picked === 'CAMP'
          ? 42
          : picked === 'RUINS'
          ? 34
          : picked === 'SHIPWRECK' || picked === 'TRADING_POST'
          ? 32
          : picked === 'SEA_ARCH'
          ? 29
          : 25;
      const minF =
        picked === 'SHIPWRECK' || picked === 'LIGHTHOUSE' || picked === 'SEA_ARCH' ? 0.74 : 0.28;
      const maxF =
        picked === 'SHIPWRECK' || picked === 'LIGHTHOUSE' || picked === 'SEA_ARCH' ? 0.87 : 0.64;
      const subs =
        picked === 'VILLAGE'
          ? makeClusterOffsets(3 + Math.floor(rng() * 2), 34)
          : picked === 'CAMP'
          ? makeClusterOffsets(3, 28)
          : undefined;
      tryPlaceLandmark(`${islandId}_lm_${m}`, picked, rad, minF, maxF, subs);
    }
  }

  // Enterable Cave Entrances on eligible islands
  const isGuaranteedCave = sx === 1 && sy === 0;
  const wantCave =
    !isStarter &&
    specialZone !== 'CITY' &&
    specialZone !== 'ARENA' &&
    (isGuaranteedCave || specialZone === 'SECRET' || (isLarge && rng() < 0.65) || rng() < 0.35);
  if (wantCave) {
    const caveId = `${islandId}_cave_0`;
    if (tryPlaceLandmark(`${caveId}_lm`, 'CAVE_ENTRANCE', 30, 0.35, 0.65)) {
      const caveLm = landmarks[landmarks.length - 1];
      const sectorTier = Math.hypot(sx, sy);
      const tier: 1 | 2 | 3 =
        specialZone === 'SECRET' || sectorTier >= 2.8 ? 3 : isLarge || sectorTier >= 1.5 ? 2 : 1;
      caves.push({
        id: caveId,
        islandId,
        x: caveLm.x,
        y: caveLm.y,
        name:
          tier === 3
            ? `${rawBaseName} Kristal Mağarası`
            : tier === 2
            ? `${rawBaseName} Derin Mağara`
            : `${rawBaseName} Mağarası`,
        tier,
      });
    }
  }

  // Dirt / Cobble Roads linking fort/plaza, landmarks, and trader dock
  const roads: IslandRoad[] = [];
  const hubPos = fortPos ?? (specialZone === 'CITY' ? { x: centerX, y: centerY } : null);
  if (hubPos) {
    const roadTargets: Vec2[] = [];
    if (traderDock) {
      const dockAngle = traderDock.angle;
      const innerR = getProfileRadius(radialProfile, dockAngle) * 0.88;
      roadTargets.push({
        x: centerX + Math.cos(dockAngle) * innerR,
        y: centerY + Math.sin(dockAngle) * innerR,
      });
    }
    for (const lm of landmarks.slice(0, specialZone === 'CITY' ? 6 : 4)) {
      if (lm.type !== 'SHIPWRECK' && lm.type !== 'CITY_PLAZA' && lm.type !== 'FOUNTAIN') {
        roadTargets.push({ x: lm.x, y: lm.y });
      }
    }
    for (const target of roadTargets) {
      const midX = (hubPos.x + target.x) * 0.5 + (rng() - 0.5) * 44;
      const midY = (hubPos.y + target.y) * 0.5 + (rng() - 0.5) * 44;
      roads.push({ from: hubPos, to: target, ctrl: { x: midX, y: midY } });
    }
  }

  // Palm trees (scaled to bigger island area)
  const palmTarget = isStarter
    ? 16
    : isMega
    ? 52
    : isLarge
    ? 38
    : Math.floor(11 + (baseRadius / 480) * 14);
  const palms: PalmTree[] = [];
  for (let i = 0; i < palmTarget * 4 && palms.length < palmTarget; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = localR * (0.14 + rng() * 0.7);
    const px = centerX + Math.cos(angle) * r;
    const py = centerY + Math.sin(angle) * r;

    if (isStarter && dist(px, py, 110, 25) < 75) continue;
    if (fortPos && dist(px, py, fortPos.x, fortPos.y) < 62) continue;
    if (traderDock && dist(px, py, traderDock.x, traderDock.y) < 75) continue;
    if (lakes.some((lk) => dist(px, py, lk.x, lk.y) < lk.radius + 20)) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, px, py) < lm.radius + 26)) continue;
    if (palms.some((p) => dist(p.x, p.y, px, py) < 54)) continue;

    palms.push({
      id: `${islandId}_palm_${palms.length}`,
      x: px,
      y: py,
      scale: 0.78 + rng() * 0.52,
      rotation: rng() * Math.PI * 2,
      frondCount: 6 + Math.floor(rng() * 3),
      swayOffset: rng() * Math.PI * 2,
      hasCoconuts: rng() > 0.32,
    });
  }

  // Coastal & interior rocks
  const rockTarget = isMega ? 20 : isLarge ? 14 : Math.floor(5 + rng() * 5);
  const rocks: RockProp[] = [];
  for (let i = 0; i < rockTarget * 3 && rocks.length < rockTarget; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = localR * (0.45 + rng() * 0.44);
    const rx = centerX + Math.cos(angle) * r;
    const ry = centerY + Math.sin(angle) * r;
    if (isStarter && dist(rx, ry, 110, 25) < 65) continue;
    if (fortPos && dist(rx, ry, fortPos.x, fortPos.y) < 60) continue;
    if (traderDock && dist(rx, ry, traderDock.x, traderDock.y) < 65) continue;
    if (lakes.some((lk) => dist(rx, ry, lk.x, lk.y) < lk.radius + 22)) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, rx, ry) < lm.radius + 24)) continue;
    if (palms.some((p) => dist(p.x, p.y, rx, ry) < 40)) continue;
    if (rocks.some((rk) => dist(rk.x, rk.y, rx, ry) < 44)) continue;

    const rockR = 11 + rng() * 14;
    const pts: Vec2[] = [];
    const sides = 7;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const rad = rockR * (0.75 + rng() * 0.38);
      pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }

    rocks.push({
      id: `${islandId}_rock_${rocks.length}`,
      x: rx,
      y: ry,
      radius: rockR,
      rotation: rng() * Math.PI * 2,
      points: pts,
    });
  }

  // Foliage patches (ferns, tropical flowers, crate supplies near beaches)
  const foliageTarget = isMega ? 42 : isLarge ? 30 : 14;
  const foliage: IslandFoliage[] = [];
  const flowerColors = ['#FB7185', '#FBBF24', '#E879F9', '#F43F5E'];
  for (let i = 0; i < foliageTarget * 2 && foliage.length < foliageTarget; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const isBeach = rng() < 0.22;
    const r = localR * (isBeach ? 0.74 + rng() * 0.14 : 0.15 + rng() * 0.54);
    const fx = centerX + Math.cos(angle) * r;
    const fy = centerY + Math.sin(angle) * r;
    if (lakes.some((lk) => dist(fx, fy, lk.x, lk.y) < lk.radius + 14)) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, fx, fy) < lm.radius + 16)) continue;

    const kind: IslandFoliage['kind'] = isBeach
      ? rng() < 0.55
        ? 'CRATE_PILE'
        : 'FERN'
      : rng() < 0.65
      ? 'FERN'
      : 'FLOWERS';
    foliage.push({
      x: fx,
      y: fy,
      radius: 7 + rng() * 7,
      kind,
      color:
        kind === 'FLOWERS'
          ? flowerColors[Math.floor(rng() * flowerColors.length)]
          : biome === 'VOLCANIC'
          ? '#3F6212'
          : '#2E7D32',
      rotation: rng() * Math.PI * 2,
    });
  }

  // Weapon Pickups (Cutlass on starter; up to 2 pickups on huge islands)
  const weaponPickups: WeaponPickup[] = [];
  if (isStarter) {
    const wa = -0.52;
    const wr = getProfileRadius(radialProfile, wa) * 0.52;
    weaponPickups.push({
      id: `${islandId}_wp_0`,
      islandId,
      x: centerX + Math.cos(wa) * wr,
      y: centerY + Math.sin(wa) * wr,
      weaponId: 'CUTLASS',
    });
  } else if (isLarge || rng() < 0.48) {
    const sectorDist = Math.hypot(sx, sy);
    const pickupCount = isMega ? 2 : 1;
    for (let wpIdx = 0; wpIdx < pickupCount; wpIdx++) {
      const weaponRoll = rng() + Math.min(0.45, sectorDist * 0.08);
      const weaponId: WeaponId =
        weaponRoll > 1.05
          ? 'DUAL_PISTOL'
          : weaponRoll > 0.72
          ? 'MUSKET'
          : weaponRoll > 0.3
          ? 'PISTOL'
          : 'CUTLASS';

      const anchor = landmarks[wpIdx % Math.max(1, landmarks.length)];
      let wx = centerX;
      let wy = centerY;
      if (anchor) {
        const wa = rng() * Math.PI * 2;
        wx = anchor.x + Math.cos(wa) * (anchor.radius + 28);
        wy = anchor.y + Math.sin(wa) * (anchor.radius + 28);
      } else {
        const wa = rng() * Math.PI * 2;
        const wr = getProfileRadius(radialProfile, wa) * 0.45;
        wx = centerX + Math.cos(wa) * wr;
        wy = centerY + Math.sin(wa) * wr;
      }
      weaponPickups.push({
        id: `${islandId}_wp_${wpIdx}`,
        islandId,
        x: wx,
        y: wy,
        weaponId,
      });
    }
  }

  // Coordinated Massive Island Enemy Armies & Garrison Squads (Cities & Arenas are garrison-free)
  const sectorDist = Math.hypot(sx, sy);
  const enemySpawns: IslandEnemySpawn[] =
    isStarter || specialZone === 'CITY' || specialZone === 'ARENA'
      ? []
      : buildGarrisonSpawns(
          islandId,
          centerX,
          centerY,
          radialProfile,
          landmarks,
          fortPos,
          isLarge,
          baseRadius,
          factionId,
          sectorDist,
          rng
        );

  // Hidden buried treasures (scaled to huge islands & secret sanctuaries)
  const treasureCount = isStarter
    ? 3
    : specialZone === 'SECRET'
    ? 5 + Math.floor(rng() * 2)
    : specialZone === 'CITY' || specialZone === 'ARENA'
    ? 2
    : isMega
    ? 5 + Math.floor(rng() * 3)
    : isLarge
    ? 4 + Math.floor(rng() * 2)
    : 2 + Math.floor(rng() * 2);
  const treasures: TreasureSpot[] = [];

  for (let i = 0; i < treasureCount * 7 && treasures.length < treasureCount; i++) {
    const angle = isStarter && treasures.length === 0 ? 0.38 : rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = isStarter && treasures.length === 0 ? localR * 0.72 : localR * (0.2 + rng() * 0.68);
    const tx = centerX + Math.cos(angle) * r;
    const ty = centerY + Math.sin(angle) * r;

    if (lakes.some((lk) => dist(tx, ty, lk.x, lk.y) < lk.radius + 20)) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, tx, ty) < lm.radius + 20)) continue;
    if (palms.some((p) => dist(p.x, p.y, tx, ty) < 28)) continue;
    if (rocks.some((rk) => dist(rk.x, rk.y, tx, ty) < 30)) continue;
    if (treasures.some((tr) => dist(tr.x, tr.y, tx, ty) < 95)) continue;

    const template =
      isStarter && treasures.length === 0
        ? TREASURE_TEMPLATES[2]
        : pickTreasureTemplate(rng, Math.min(1, sectorDist / 5), luckLevel);

    treasures.push({
      id: `${islandId}_tr_${treasures.length}`,
      islandId,
      x: tx,
      y: ty,
      template,
    });
  }

  // Harvestable Wood & Iron Resource Nodes
  const resourceTarget = isStarter ? 4 : isMega ? 9 : isLarge ? 7 : 4;
  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < resourceTarget * 4 && resourceNodes.length < resourceTarget; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const kind: ResourceNode['kind'] = i % 2 === 0 ? 'WOOD' : 'IRON';
    const r = localR * (kind === 'WOOD' ? 0.28 + rng() * 0.42 : 0.42 + rng() * 0.36);
    const nx = centerX + Math.cos(angle) * r;
    const ny = centerY + Math.sin(angle) * r;
    if (fortPos && dist(nx, ny, fortPos.x, fortPos.y) < 55) continue;
    if (traderDock && dist(nx, ny, traderDock.x, traderDock.y) < 62) continue;
    if (lakes.some((lk) => dist(nx, ny, lk.x, lk.y) < lk.radius + 18)) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, nx, ny) < lm.radius + 20)) continue;
    if (resourceNodes.some((rn) => dist(rn.x, rn.y, nx, ny) < 60)) continue;

    resourceNodes.push({
      id: `${islandId}_res_${resourceNodes.length}`,
      islandId,
      kind,
      x: nx,
      y: ny,
      amount: kind === 'WOOD' ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 3),
    });
  }

  return {
    id: islandId,
    sectorX: sx,
    sectorY: sy,
    name,
    biome,
    centerX,
    centerY,
    baseRadius,
    maxRadius,
    isLarge,
    factionId,
    fortPos,
    radialProfile,
    coastPoints,
    grassPoints,
    lakes,
    roads,
    foliage,
    palms,
    rocks,
    landmarks,
    weaponPickups,
    resourceNodes,
    enemySpawns,
    treasures,
    traderDock,
    isStarter,
    specialZone,
    isSecret,
    caves,
    arenaCenter,
  };
}

const SQUAD_MEMBER_TEMPLATES: Array<{
  off: Vec2;
  role: 'LEADER' | 'FLANKER';
  style: 'MELEE' | 'RANGED';
}> = [
  { off: { x: 0, y: 0 }, role: 'LEADER', style: 'MELEE' },
  { off: { x: -32, y: -18 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: 32, y: -18 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: -62, y: -10 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: 62, y: -10 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: -24, y: 24 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: 24, y: 24 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: -56, y: 24 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: 56, y: 24 }, role: 'FLANKER', style: 'MELEE' },
  { off: { x: -46, y: -48 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: 0, y: -50 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: 46, y: -48 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: -78, y: -38 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: 78, y: -38 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: -32, y: -76 }, role: 'FLANKER', style: 'RANGED' },
  { off: { x: 32, y: -76 }, role: 'FLANKER', style: 'RANGED' },
];

function buildGarrisonSpawns(
  islandId: string,
  centerX: number,
  centerY: number,
  radialProfile: number[],
  landmarks: Landmark[],
  fortPos: Vec2 | null,
  isLarge: boolean,
  baseRadius: number,
  factionId: FactionId,
  sectorDist: number,
  rng: () => number
): IslandEnemySpawn[] {
  const enemySpawns: IslandEnemySpawn[] = [];
  const factionColor =
    factionId !== 'NEUTRAL' && factionId !== 'PLAYER'
      ? ENEMY_FACTIONS[factionId].color
      : '#64748B';
  const profile = getIslandGarrisonProfile(isLarge, baseRadius, factionId, sectorDist);

  for (let sq = 0; sq < profile.squadCount; sq++) {
    const squadId = `${islandId}_${factionId}_squad_${sq}`;
    const anchorLandmark =
      landmarks.length > 0 ? landmarks[Math.max(0, sq - 1) % landmarks.length] : undefined;

    let baseX = centerX;
    let baseY = centerY;
    if (sq === 0 && fortPos) {
      baseX = fortPos.x + (rng() - 0.5) * 44;
      baseY = fortPos.y + (rng() - 0.5) * 44;
    } else if (anchorLandmark && sq <= landmarks.length) {
      const a = rng() * Math.PI * 2;
      baseX = anchorLandmark.x + Math.cos(a) * (anchorLandmark.radius + 64);
      baseY = anchorLandmark.y + Math.sin(a) * (anchorLandmark.radius + 64);
    } else {
      const sectorIdx = sq - (landmarks.length + 1);
      const sectorTotal = Math.max(1, profile.squadCount - (landmarks.length + 1));
      const a = (sectorIdx / sectorTotal) * Math.PI * 2 + rng() * 0.55;
      const frac = sq % 2 === 0 ? 0.34 + rng() * 0.22 : 0.62 + rng() * 0.2;
      const r = getProfileRadius(radialProfile, a) * frac;
      baseX = centerX + Math.cos(a) * r;
      baseY = centerY + Math.sin(a) * r;
    }

    for (let idx = 0; idx < profile.perSquad; idx++) {
      const tmpl = SQUAD_MEMBER_TEMPLATES[idx] ?? {
        off: {
          x: Math.cos(idx * 1.1) * (40 + idx * 3),
          y: Math.sin(idx * 1.1) * (40 + idx * 3),
        },
        role: 'FLANKER' as const,
        style: idx % 2 === 0 ? ('MELEE' as const) : ('RANGED' as const),
      };
      const tier: 1 | 2 | 3 =
        tmpl.role === 'LEADER' || (isLarge && (idx === 4 || idx === 9 || idx === 13))
          ? profile.leaderTier
          : profile.baseTier;
      let mx = baseX + tmpl.off.x;
      let my = baseY + tmpl.off.y;
      const mdx = mx - centerX;
      const mdy = my - centerY;
      const ma = Math.atan2(mdy, mdx);
      const maxLandR = getProfileRadius(radialProfile, ma) - 20;
      if (Math.hypot(mdx, mdy) > maxLandR) {
        mx = centerX + Math.cos(ma) * Math.max(12, maxLandR);
        my = centerY + Math.sin(ma) * Math.max(12, maxLandR);
      }

      enemySpawns.push({
        id: `${squadId}_m${idx}`,
        islandId,
        factionId,
        squadId,
        squadColor: factionColor,
        role: tmpl.role,
        combatStyle: tmpl.style,
        x: mx,
        y: my,
        formationOffset: tmpl.off,
        tier,
      });
    }
  }

  // Scouts on smaller neutral islands
  if (factionId === 'NEUTRAL' && profile.squadCount === 0 && rng() < 0.72) {
    const scoutCount = baseRadius >= 315 ? 4 : 2;
    for (let s = 0; s < scoutCount; s++) {
      const a = rng() * Math.PI * 2;
      const r = getProfileRadius(radialProfile, a) * (0.34 + (s % 3) * 0.14);
      enemySpawns.push({
        id: `${islandId}_solo_${s}`,
        islandId,
        factionId: 'NEUTRAL',
        squadId: null,
        squadColor: '#64748B',
        role: 'SOLO',
        combatStyle: s % 2 === 1 || rng() > 0.5 ? 'RANGED' : 'MELEE',
        x: centerX + Math.cos(a) * r,
        y: centerY + Math.sin(a) * r,
        formationOffset: { x: 0, y: 0 },
        tier: 1,
      });
    }
  }

  return enemySpawns;
}

export function generateIslandGarrison(island: Island, factionId: FactionId): IslandEnemySpawn[] {
  if (island.isStarter || factionId === 'PLAYER') return [];
  const rng = mulberry32(hashCoords(island.sectorX * 31 + factionId.length, island.sectorY * 17, Math.round(island.baseRadius)));
  return buildGarrisonSpawns(
    island.id,
    island.centerX,
    island.centerY,
    island.radialProfile,
    island.landmarks,
    island.fortPos,
    island.isLarge,
    island.baseRadius,
    factionId,
    Math.hypot(island.sectorX, island.sectorY),
    rng
  );
}

export function generateStarterIslandFromSlot(slot: StarterSlot, luckLevel = 1): Island {
  const rng = mulberry32(slot.seed);
  const centerX = slot.centerX;
  const centerY = slot.centerY;
  const baseRadius = 305;

  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const radialProfile: number[] = [];
  const coastPoints: Vec2[] = [];
  const grassPoints: Vec2[] = [];
  let maxRadius = 0;

  for (let i = 0; i < PROFILE_SLICES; i++) {
    const theta = (i / PROFILE_SLICES) * Math.PI * 2;
    const wave =
      1 +
      0.08 * Math.sin(theta * 2 + p1) +
      0.05 * Math.cos(theta * 3 + p2) +
      0.03 * Math.sin(theta * 5 + p3);
    const r = baseRadius * wave;
    radialProfile.push(r);
    if (r > maxRadius) maxRadius = r;
    coastPoints.push({
      x: centerX + Math.cos(theta) * r,
      y: centerY + Math.sin(theta) * r,
    });
    grassPoints.push({
      x: centerX + Math.cos(theta) * r * 0.72,
      y: centerY + Math.sin(theta) * r * 0.72,
    });
  }

  // Trader dock faces inward toward the central sea (0,0) so friends meet easily
  const dockAngle = Math.atan2(-centerY, -centerX);
  const dockR = getProfileRadius(radialProfile, dockAngle);
  const traderDock: Island['traderDock'] = {
    x: centerX + Math.cos(dockAngle) * (dockR + 8),
    y: centerY + Math.sin(dockAngle) * (dockR + 8),
    angle: dockAngle,
  };

  const fortPos: Vec2 = { x: centerX - 62, y: centerY - 28 };
  const lakes: InlandLake[] = [];
  const landmarks: Landmark[] = [
    {
      id: `${slot.islandId}_camp_0`,
      type: 'CAMP',
      x: centerX + 86,
      y: centerY - 58,
      radius: 38,
      rotation: 0.4,
      subOffsets: [
        { dx: -22, dy: -12, rot: 0.2, scale: 0.9 },
        { dx: 24, dy: -10, rot: 2.1, scale: 0.92 },
        { dx: 4, dy: 24, rot: 4.1, scale: 0.88 },
      ],
    },
    {
      id: `${slot.islandId}_obelisk_0`,
      type: 'OBELISK',
      x: centerX - 75,
      y: centerY + 84,
      radius: 22,
      rotation: 0.9,
    },
  ];

  const dockInnerR = getProfileRadius(radialProfile, dockAngle) * 0.85;
  const roads: IslandRoad[] = [
    {
      from: fortPos,
      to: {
        x: centerX + Math.cos(dockAngle) * dockInnerR,
        y: centerY + Math.sin(dockAngle) * dockInnerR,
      },
      ctrl: { x: centerX + 12, y: centerY + 14 },
    },
    {
      from: fortPos,
      to: { x: landmarks[0].x, y: landmarks[0].y },
      ctrl: { x: centerX + 10, y: centerY - 48 },
    },
  ];

  const spawnClearX = centerX + Math.cos(dockAngle) * 75;
  const spawnClearY = centerY + Math.sin(dockAngle) * 75;

  const palms: PalmTree[] = [];
  for (let i = 0; i < 48 && palms.length < 13; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = localR * (0.2 + rng() * 0.64);
    const px = centerX + Math.cos(angle) * r;
    const py = centerY + Math.sin(angle) * r;
    if (dist(px, py, spawnClearX, spawnClearY) < 68) continue;
    if (dist(px, py, fortPos.x, fortPos.y) < 58) continue;
    if (dist(px, py, traderDock.x, traderDock.y) < 72) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, px, py) < lm.radius + 24)) continue;
    if (palms.some((p) => dist(p.x, p.y, px, py) < 52)) continue;
    palms.push({
      id: `${slot.islandId}_palm_${palms.length}`,
      x: px,
      y: py,
      scale: 0.8 + rng() * 0.44,
      rotation: rng() * Math.PI * 2,
      frondCount: 6 + Math.floor(rng() * 3),
      swayOffset: rng() * Math.PI * 2,
      hasCoconuts: rng() > 0.35,
    });
  }

  const rocks: RockProp[] = [];
  for (let i = 0; i < 16 && rocks.length < 4; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = localR * (0.48 + rng() * 0.38);
    const rx = centerX + Math.cos(angle) * r;
    const ry = centerY + Math.sin(angle) * r;
    if (dist(rx, ry, spawnClearX, spawnClearY) < 62) continue;
    if (dist(rx, ry, fortPos.x, fortPos.y) < 56) continue;
    if (dist(rx, ry, traderDock.x, traderDock.y) < 64) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, rx, ry) < lm.radius + 22)) continue;
    if (palms.some((p) => dist(p.x, p.y, rx, ry) < 38)) continue;
    const rockR = 11 + rng() * 10;
    const pts: Vec2[] = [];
    for (let s = 0; s < 7; s++) {
      const a = (s / 7) * Math.PI * 2;
      const rad = rockR * (0.78 + rng() * 0.32);
      pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }
    rocks.push({
      id: `${slot.islandId}_rock_${rocks.length}`,
      x: rx,
      y: ry,
      radius: rockR,
      rotation: rng() * Math.PI * 2,
      points: pts,
    });
  }

  const foliage: IslandFoliage[] = [];
  const flowerColors = ['#FB7185', '#FBBF24', '#E879F9', '#F43F5E'];
  for (let i = 0; i < 20 && foliage.length < 11; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = localR * (0.2 + rng() * 0.58);
    const fx = centerX + Math.cos(angle) * r;
    const fy = centerY + Math.sin(angle) * r;
    if (landmarks.some((lm) => dist(lm.x, lm.y, fx, fy) < lm.radius + 14)) continue;
    const kind: IslandFoliage['kind'] = rng() < 0.6 ? 'FERN' : 'FLOWERS';
    foliage.push({
      x: fx,
      y: fy,
      radius: 7 + rng() * 6,
      kind,
      color: kind === 'FLOWERS' ? flowerColors[Math.floor(rng() * flowerColors.length)] : '#2E7D32',
      rotation: rng() * Math.PI * 2,
    });
  }

  const wpAngle = dockAngle + Math.PI * 0.65;
  const wpR = getProfileRadius(radialProfile, wpAngle) * 0.52;
  const weaponPickups: WeaponPickup[] = [
    {
      id: `${slot.islandId}_wp_0`,
      islandId: slot.islandId,
      x: centerX + Math.cos(wpAngle) * wpR,
      y: centerY + Math.sin(wpAngle) * wpR,
      weaponId: 'CUTLASS',
    },
  ];

  const treasures: TreasureSpot[] = [];
  for (let i = 0; i < 24 && treasures.length < 3; i++) {
    const angle = treasures.length === 0 ? dockAngle + 0.72 : rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const r = treasures.length === 0 ? localR * 0.68 : localR * (0.26 + rng() * 0.58);
    const tx = centerX + Math.cos(angle) * r;
    const ty = centerY + Math.sin(angle) * r;
    if (landmarks.some((lm) => dist(lm.x, lm.y, tx, ty) < lm.radius + 18)) continue;
    if (palms.some((p) => dist(p.x, p.y, tx, ty) < 24)) continue;
    if (rocks.some((rk) => dist(rk.x, rk.y, tx, ty) < 26)) continue;
    if (treasures.some((tr) => dist(tr.x, tr.y, tx, ty) < 88)) continue;
    const template =
      treasures.length === 0
        ? TREASURE_TEMPLATES[2]
        : pickTreasureTemplate(rng, 0.15, luckLevel);
    treasures.push({
      id: `${slot.islandId}_tr_${treasures.length}`,
      islandId: slot.islandId,
      x: tx,
      y: ty,
      template,
    });
  }

  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < 12 && resourceNodes.length < 4; i++) {
    const angle = rng() * Math.PI * 2;
    const localR = getProfileRadius(radialProfile, angle);
    const kind: ResourceNode['kind'] = i % 2 === 0 ? 'WOOD' : 'IRON';
    const r = localR * (0.3 + rng() * 0.42);
    const nx = centerX + Math.cos(angle) * r;
    const ny = centerY + Math.sin(angle) * r;
    if (dist(nx, ny, fortPos.x, fortPos.y) < 52) continue;
    if (dist(nx, ny, traderDock.x, traderDock.y) < 60) continue;
    if (landmarks.some((lm) => dist(lm.x, lm.y, nx, ny) < lm.radius + 18)) continue;
    if (resourceNodes.some((rn) => dist(rn.x, rn.y, nx, ny) < 55)) continue;
    resourceNodes.push({
      id: `${slot.islandId}_res_${resourceNodes.length}`,
      islandId: slot.islandId,
      kind,
      x: nx,
      y: ny,
      amount: 2,
    });
  }

  return {
    id: slot.islandId,
    sectorX: 0,
    sectorY: 0,
    name: `${slot.ownerName} Adası`,
    biome: 'TROPICAL',
    centerX,
    centerY,
    baseRadius,
    maxRadius,
    isLarge: false,
    factionId: 'NEUTRAL',
    fortPos,
    radialProfile,
    coastPoints,
    grassPoints,
    lakes,
    roads,
    foliage,
    palms,
    rocks,
    landmarks,
    weaponPickups,
    resourceNodes,
    enemySpawns: [],
    treasures,
    traderDock,
    isStarter: true,
  };
}

export function computeNextStarterSlot(
  existingSlots: StarterSlot[],
  playerId: string,
  ownerName: string,
  bannerColor: string,
  worldSeed: number,
  worldManager: WorldManager
): StarterSlot {
  const existing = existingSlots.find((s) => s.playerId === playerId);
  if (existing) {
    return { ...existing, ownerName, bannerColor };
  }

  const slotIndex = existingSlots.length;
  const starterRadius = 345;
  const waterGap = 190;

  const isFreeWaterSpot = (cx: number, cy: number): boolean => {
    for (const s of existingSlots) {
      if (dist(cx, cy, s.centerX, s.centerY) < starterRadius * 2 + waterGap) {
        return false;
      }
    }
    const nearbySectors = worldManager.getVisibleIslands(cx, cy, 2);
    for (const isl of nearbySectors) {
      if (isl.isStarter) continue;
      if (dist(cx, cy, isl.centerX, isl.centerY) < isl.maxRadius + starterRadius + waterGap) {
        return false;
      }
    }
    return true;
  };

  // Ring 0 places the first 4 players close to each other around (0,0) (~760px radius)
  // Outer rings expand dynamically as more players join
  const candidatePoints: Array<{ x: number; y: number }> = [];
  const ring0Angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const a of ring0Angles) {
    candidatePoints.push({ x: Math.cos(a) * 760, y: Math.sin(a) * 760 });
  }

  // Expanding concentric ocean rings for additional players (scalable outward indefinitely)
  for (let ring = 1; ring <= 40; ring++) {
    const r = 760 + ring * 940;
    const count = Math.max(8, Math.floor((2 * Math.PI * r) / 960));
    const phase = ring * 0.37;
    for (let k = 0; k < count; k++) {
      const a = phase + (k / count) * Math.PI * 2;
      candidatePoints.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  let chosen = candidatePoints[0];
  for (const pt of candidatePoints) {
    if (isFreeWaterSpot(pt.x, pt.y)) {
      chosen = pt;
      break;
    }
  }

  return {
    slotIndex,
    playerId,
    ownerName,
    bannerColor,
    islandId: `starter_${playerId}`,
    centerX: Math.round(chosen.x),
    centerY: Math.round(chosen.y),
    seed: hashCoords(worldSeed, slotIndex + 101, 777),
  };
}

export class WorldManager {
  private cache = new Map<string, Island | null>();
  private starterIslands = new Map<string, Island>();
  private worldSeed: number;
  private luckLevel: number;
  private onlineMode: boolean;

  constructor(worldSeed: number, luckLevel = 1, onlineMode = false) {
    this.worldSeed = worldSeed;
    this.luckLevel = luckLevel;
    this.onlineMode = onlineMode;
  }

  public setSeed(seed: number) {
    if (seed !== this.worldSeed) {
      this.worldSeed = seed;
      this.cache.clear();
    }
  }

  public setOnlineMode(online: boolean) {
    if (online !== this.onlineMode) {
      this.onlineMode = online;
      this.cache.clear();
      if (!online) {
        this.starterIslands.clear();
      }
    }
  }

  public isOnlineMode(): boolean {
    return this.onlineMode;
  }

  public setLuckLevel(luckLevel: number) {
    this.luckLevel = luckLevel;
  }

  public setStarterSlots(slots: StarterSlot[]) {
    this.starterIslands.clear();
    for (const slot of slots) {
      this.starterIslands.set(slot.islandId, generateStarterIslandFromSlot(slot, this.luckLevel));
    }
  }

  public addStarterSlot(slot: StarterSlot): Island {
    const existing = this.starterIslands.get(slot.islandId);
    if (existing) {
      existing.name = `${slot.ownerName} Adası`;
      return existing;
    }
    const island = generateStarterIslandFromSlot(slot, this.luckLevel);
    this.starterIslands.set(slot.islandId, island);
    return island;
  }

  public getStarterIslands(): Island[] {
    return Array.from(this.starterIslands.values());
  }

  public getIslandAtSector(sx: number, sy: number): Island | null {
    const key = `${sx}_${sy}`;
    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        generateSectorIsland(this.worldSeed, sx, sy, this.luckLevel, this.onlineMode)
      );
    }
    return this.cache.get(key) ?? null;
  }

  public getVisibleIslands(centerX: number, centerY: number, radiusSectors = 2): Island[] {
    const csx = Math.round(centerX / SECTOR_SIZE);
    const csy = Math.round(centerY / SECTOR_SIZE);
    const result: Island[] = [];

    for (let dx = -radiusSectors; dx <= radiusSectors; dx++) {
      for (let dy = -radiusSectors; dy <= radiusSectors; dy++) {
        const island = this.getIslandAtSector(csx + dx, csy + dy);
        if (island) result.push(island);
      }
    }

    if (this.onlineMode && this.starterIslands.size > 0) {
      const maxDist = (radiusSectors + 0.8) * SECTOR_SIZE;
      for (const isl of this.starterIslands.values()) {
        if (Math.hypot(isl.centerX - centerX, isl.centerY - centerY) <= maxDist) {
          result.push(isl);
        }
      }
    }

    return result;
  }

  public getIslandById(id: string): Island | null {
    const starter = this.starterIslands.get(id);
    if (starter) return starter;
    const parts = id.split('_');
    if (parts.length !== 3) return null;
    const sx = Number(parts[1]);
    const sy = Number(parts[2]);
    if (Number.isNaN(sx) || Number.isNaN(sy)) return null;
    return this.getIslandAtSector(sx, sy);
  }
}
