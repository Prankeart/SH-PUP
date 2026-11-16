import { EnemyFactionId, FactionId, KingdomState, SoldierType } from '../types/game';

export interface FactionSpec {
  id: EnemyFactionId;
  name: string;
  shortName: string;
  color: string;
  sailColor: string;
  hullColor: string;
  description: string;
}

export const ENEMY_FACTIONS: Record<EnemyFactionId, FactionSpec> = {
  CORSAIR: {
    id: 'CORSAIR',
    name: 'Kızıl Korsan Konfederasyonu',
    shortName: 'Kızıl Korsan',
    color: '#EF4444',
    sailColor: '#991B1B',
    hullColor: '#4A2511',
    description: 'Batı ve kuzey geçitlerinde baskınlar düzenleyen hızlı korsan filoları.',
  },
  IMPERIAL: {
    id: 'IMPERIAL',
    name: 'Demir Armadası İmparatorluğu',
    shortName: 'Demir Armada',
    color: '#3B82F6',
    sailColor: '#1D4ED8',
    hullColor: '#334155',
    description: 'Zırhlı kalyonları ve disiplinli tüfekçi birlikleriyle doğu adalarını tutar.',
  },
  SUN_CLAN: {
    id: 'SUN_CLAN',
    name: 'Altın Güneş Sultanlığı',
    shortName: 'Altın Güneş',
    color: '#A855F7',
    sailColor: '#7E22CE',
    hullColor: '#581C87',
    description: 'Güney tapınaklarını ve zengin inci lagünlerini savunan seçkin muhafızlar.',
  },
};

export const ENEMY_FACTION_LIST: FactionSpec[] = [
  ENEMY_FACTIONS.CORSAIR,
  ENEMY_FACTIONS.IMPERIAL,
  ENEMY_FACTIONS.SUN_CLAN,
];

export const PLAYER_BANNER_OPTIONS = [
  { id: 'EMERALD', name: 'Zümrüt Sancak', color: '#10B981', sailColor: '#047857' },
  { id: 'AMBER', name: 'Altın Sancak', color: '#F59E0B', sailColor: '#B45309' },
  { id: 'CYAN', name: 'Turkuaz Sancak', color: '#06B6D4', sailColor: '#0E7490' },
  { id: 'ROSE', name: 'Yakut Sancak', color: '#F43F5E', sailColor: '#BE123C' },
];

export interface SoldierSpec {
  type: SoldierType;
  name: string;
  cost: number;
  maxHp: number;
  damage: number;
  range: number;
  cooldownMs: number;
  speed: number;
  description: string;
}

export const SOLDIER_SPECS: Record<SoldierType, SoldierSpec> = {
  SWORDSMAN: {
    type: 'SWORDSMAN',
    name: 'Kılıçlı Piyade',
    cost: 35,
    maxHp: 115,
    damage: 20,
    range: 34,
    cooldownMs: 740,
    speed: 158,
    description: 'Hızlı ve hesaplı ön saf askeri; dev piyade mangaları kurmak için idealdir.',
  },
  MUSKETEER: {
    type: 'MUSKETEER',
    name: 'Tüfekçi Birliği',
    cost: 55,
    maxHp: 85,
    damage: 24,
    range: 245,
    cooldownMs: 1100,
    speed: 146,
    description: 'Uzak mesafeden yaylım ateşiyle düşman birliklerini indirir.',
  },
  HEAVY_GUARD: {
    type: 'HEAVY_GUARD',
    name: 'Ağır Zırhlı Muhafız',
    cost: 85,
    maxHp: 215,
    damage: 32,
    range: 38,
    cooldownMs: 800,
    speed: 140,
    description: 'Kalkanı ve ağır baltasıyla cepheyi yaran elit hücum birliği.',
  },
  GRENADIER: {
    type: 'GRENADIER',
    name: 'Humbaracı Topçu',
    cost: 115,
    maxHp: 135,
    damage: 38,
    range: 255,
    cooldownMs: 1450,
    speed: 136,
    description: 'Patlayıcı humbara güllesi fırlatarak düşman kalabalığına alan hasarı verir.',
  },
};

export const KINGDOM_COSTS = {
  FOUND_KINGDOM: 100,
  ESCORT_SHIP: 140,
  HEAL_ARMY: 35,
};

export const MAX_ARMY_LEVEL = 8;

const ARMY_UPGRADE_COSTS = [0, 120, 180, 260, 360, 480, 620, 780];

export function getArmyUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_ARMY_LEVEL) return 0;
  return ARMY_UPGRADE_COSTS[currentLevel] ?? 780;
}

export function getSoldierPowerMultiplier(armyLevel: number): { hpMult: number; dmgMult: number } {
  const lvl = Math.max(1, armyLevel);
  return {
    hpMult: 1 + (lvl - 1) * 0.12,
    dmgMult: 1 + (lvl - 1) * 0.1,
  };
}

export const ESCORT_SHIP_STATS = {
  maxHp: 215,
  damage: 22,
  cooldownMs: 1550,
  speed: 280,
};

export function getMaxSoldiers(_conqueredCount = 0, _armyLevel = 1): number {
  return Infinity;
}

export function getMaxEscortShips(_conqueredCount = 0, _armyLevel = 1): number {
  return Infinity;
}

export interface IslandArmyStats {
  hp: number;
  meleeDmg: number;
  rangedDmg: number;
  moveSpeed: number;
}

export function getIslandArmyStats(tier: 1 | 2 | 3): IslandArmyStats {
  if (tier === 3) {
    return { hp: 185, meleeDmg: 22, rangedDmg: 18, moveSpeed: 122 };
  }
  if (tier === 2) {
    return { hp: 120, meleeDmg: 15, rangedDmg: 14, moveSpeed: 112 };
  }
  return { hp: 72, meleeDmg: 10, rangedDmg: 10, moveSpeed: 100 };
}

export interface IslandGarrisonProfile {
  squadCount: number;
  perSquad: number;
  baseTier: 1 | 2 | 3;
  leaderTier: 1 | 2 | 3;
}

export function getIslandGarrisonProfile(
  isLarge: boolean,
  baseRadius: number,
  factionId: FactionId,
  sectorDist: number
): IslandGarrisonProfile {
  if (factionId === 'NEUTRAL') {
    if (isLarge) {
      return { squadCount: 4, perSquad: 12, baseTier: 1, leaderTier: 2 };
    }
    if (baseRadius >= 340) {
      return { squadCount: 2, perSquad: 7, baseTier: 1, leaderTier: 1 };
    }
    return { squadCount: 0, perSquad: 0, baseTier: 1, leaderTier: 1 };
  }

  if (isLarge) {
    // Mega & Large islands defended by massive 135–192 soldier armies!
    const squadCount = baseRadius >= 690 ? 12 : baseRadius >= 610 ? 10 : 9;
    const perSquad = baseRadius >= 690 ? 16 : 15;
    const baseTier: 1 | 2 | 3 = sectorDist >= 1.9 ? 3 : 2;
    return {
      squadCount,
      perSquad,
      baseTier,
      leaderTier: 3,
    };
  }

  if (baseRadius >= 375) {
    const baseTier: 1 | 2 | 3 = sectorDist >= 2.1 ? 2 : 1;
    const leaderTier: 1 | 2 | 3 = sectorDist >= 1.9 ? 3 : 2;
    return {
      squadCount: 7,
      perSquad: 13,
      baseTier,
      leaderTier,
    };
  }

  return {
    squadCount: 5,
    perSquad: 11,
    baseTier: sectorDist >= 2.2 ? 2 : 1,
    leaderTier: sectorDist >= 1.6 ? 2 : 1,
  };
}

export interface EnemyShipSpec {
  tier: 1 | 2 | 3;
  label: string;
  maxHp: number;
  speed: number;
  cannons: number;
  damage: number;
  fireCd: number;
  bounty: number;
  scale: number;
}

export function getEnemyShipSpec(tier: 1 | 2 | 3): EnemyShipSpec {
  if (tier === 3) {
    return {
      tier: 3,
      label: 'Kraliyet Kalyonu',
      maxHp: 260,
      speed: 138,
      cannons: 4,
      damage: 20,
      fireCd: 1850,
      bounty: 240,
      scale: 1.44,
    };
  }
  if (tier === 2) {
    return {
      tier: 2,
      label: 'Savaş Gemisi',
      maxHp: 170,
      speed: 152,
      cannons: 3,
      damage: 16,
      fireCd: 2050,
      bounty: 145,
      scale: 1.22,
    };
  }
  return {
    tier: 1,
    label: 'Firkateyn',
    maxHp: 105,
    speed: 170,
    cannons: 2,
    damage: 12,
    fireCd: 2500,
    bounty: 80,
    scale: 1.0,
  };
}

export function getEffectiveIslandFaction(
  baseFaction: FactionId,
  islandId: string,
  isStarter: boolean,
  kingdom: KingdomState
): FactionId {
  if (kingdom.founded && isStarter) return 'PLAYER';
  if (kingdom.conqueredIslandIds.includes(islandId)) return 'PLAYER';
  if (kingdom.islandOwners && kingdom.islandOwners[islandId]) {
    return kingdom.islandOwners[islandId];
  }
  return baseFaction;
}

export function getFactionDisplay(
  factionId: FactionId,
  kingdom: KingdomState
): { name: string; shortName: string; color: string; sailColor: string } {
  if (factionId === 'PLAYER') {
    const banner =
      PLAYER_BANNER_OPTIONS.find((b) => b.color === kingdom.bannerColor) ??
      PLAYER_BANNER_OPTIONS[0];
    return {
      name: kingdom.name || 'Turkuaz Devleti',
      shortName: kingdom.name || 'Devletim',
      color: banner.color,
      sailColor: banner.sailColor,
    };
  }
  if (factionId === 'NEUTRAL') {
    return {
      name: 'Bağımsız Ada',
      shortName: 'Bağımsız',
      color: '#94A3B8',
      sailColor: '#64748B',
    };
  }
  const spec = ENEMY_FACTIONS[factionId];
  return {
    name: spec.name,
    shortName: spec.shortName,
    color: spec.color,
    sailColor: spec.sailColor,
  };
}
