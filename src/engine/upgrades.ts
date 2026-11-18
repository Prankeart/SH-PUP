import { Upgrades } from '../types/game';

export type UpgradeKey = keyof Upgrades;

export interface ShipClassSpec {
  level: number;
  name: string;
  scale: number;
  masts: 1 | 2 | 3;
  maxSpeed: number;
  accel: number;
  turnRate: number; // rad/sec
  lateralGrip: number; // higher = tighter keel carving
  waterDrag: number;
  hullRadius: number;
  hasQuarterdeck: boolean;
  hasBowsprit: boolean;
  hasGoldTrim: boolean;
}

export const SHIP_CLASSES: ShipClassSpec[] = [
  {
    level: 1,
    name: 'Ahşap Kayık',
    scale: 0.96,
    masts: 1,
    maxSpeed: 235,
    accel: 340,
    turnRate: 3.1,
    lateralGrip: 4.2,
    waterDrag: 1.45,
    hullRadius: 20,
    hasQuarterdeck: false,
    hasBowsprit: false,
    hasGoldTrim: false,
  },
  {
    level: 2,
    name: 'Kıyı Teknesi',
    scale: 1.1,
    masts: 1,
    maxSpeed: 275,
    accel: 370,
    turnRate: 2.95,
    lateralGrip: 4.5,
    waterDrag: 1.35,
    hullRadius: 23,
    hasQuarterdeck: false,
    hasBowsprit: true,
    hasGoldTrim: false,
  },
  {
    level: 3,
    name: 'Şalupa',
    scale: 1.24,
    masts: 1,
    maxSpeed: 315,
    accel: 400,
    turnRate: 2.8,
    lateralGrip: 4.8,
    waterDrag: 1.28,
    hullRadius: 26,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: false,
  },
  {
    level: 4,
    name: 'Brigantin',
    scale: 1.4,
    masts: 2,
    maxSpeed: 355,
    accel: 430,
    turnRate: 2.65,
    lateralGrip: 5.0,
    waterDrag: 1.2,
    hullRadius: 30,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: false,
  },
  {
    level: 5,
    name: 'Fırkateyn',
    scale: 1.56,
    masts: 3,
    maxSpeed: 395,
    accel: 465,
    turnRate: 2.5,
    lateralGrip: 5.2,
    waterDrag: 1.12,
    hullRadius: 34,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: true,
  },
  {
    level: 6,
    name: 'Kraliyet Kalyonu',
    scale: 1.74,
    masts: 3,
    maxSpeed: 440,
    accel: 500,
    turnRate: 2.35,
    lateralGrip: 5.4,
    waterDrag: 1.05,
    hullRadius: 38,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: true,
  },
  {
    level: 7,
    name: 'Savaş Kalyonu',
    scale: 1.88,
    masts: 3,
    maxSpeed: 475,
    accel: 535,
    turnRate: 2.28,
    lateralGrip: 5.6,
    waterDrag: 1.0,
    hullRadius: 41,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: true,
  },
  {
    level: 8,
    name: 'Amiral Armadası',
    scale: 2.02,
    masts: 3,
    maxSpeed: 515,
    accel: 575,
    turnRate: 2.22,
    lateralGrip: 5.8,
    waterDrag: 0.96,
    hullRadius: 44,
    hasQuarterdeck: true,
    hasBowsprit: true,
    hasGoldTrim: true,
  },
];

export function getShipClass(boatLevel: number): ShipClassSpec {
  const idx = Math.max(0, Math.min(SHIP_CLASSES.length - 1, boatLevel - 1));
  return SHIP_CLASSES[idx];
}

export interface UpgradeDef {
  key: UpgradeKey;
  title: string;
  subtitle: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  statLabel: (level: number) => string;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: 'shovelLevel',
    title: 'Çelik Kürek',
    subtitle: 'Kazı yarıçapını genişletir, derin katmanları daha hızlı açar.',
    maxLevel: 8,
    baseCost: 80,
    costMultiplier: 1.7,
    statLabel: (lvl) => `${36 + (lvl - 1) * 10} px menzil`,
  },
  {
    key: 'boatLevel',
    title: 'Gemi Sınıfı ve Gövde',
    subtitle: 'Gemiyi daha büyük sınıfa yükseltir; hız, direk sayısı ve gövde zırhı artar.',
    maxLevel: 8,
    baseCost: 110,
    costMultiplier: 1.78,
    statLabel: (lvl) => {
      const cls = getShipClass(lvl);
      return `${cls.name} · ${cls.masts} Direk · ${getMaxBoatHp(lvl)} Can`;
    },
  },
  {
    key: 'cannonLevel',
    title: 'Yan Borda Topları',
    subtitle: 'Teknenin iki yanındaki top hasarını ve namlu sayısını artırır.',
    maxLevel: 8,
    baseCost: 120,
    costMultiplier: 1.74,
    statLabel: (lvl) => `${getCannonCountPerSide(lvl)}x yan top · ${getCannonDamage(lvl)} hasar`,
  },
  {
    key: 'radarLevel',
    title: 'Hazine Radarı',
    subtitle: 'Sıcak-soğuk algılama menzilini açar ve yön oku ekler.',
    maxLevel: 8,
    baseCost: 95,
    costMultiplier: 1.7,
    statLabel: (lvl) => (lvl >= 2 ? `Yön oku + ${1100 + (lvl - 1) * 350}m` : '1100m menzil'),
  },
  {
    key: 'luckLevel',
    title: 'Korsan Çantası',
    subtitle: 'Bulunan hazinelerin satış değerini ve nadirlik şansını artırır.',
    maxLevel: 8,
    baseCost: 130,
    costMultiplier: 1.8,
    statLabel: (lvl) => `+%${(lvl - 1) * 25} değer`,
  },
  {
    key: 'hullPlatingLevel',
    title: 'Plaka Dayanımı',
    subtitle: 'Gemi zırh plakalarını güçlendirir; deniz ve kara hasarını azaltır.',
    maxLevel: 8,
    baseCost: 115,
    costMultiplier: 1.72,
    statLabel: (lvl) => `-%${Math.round(getDamageReductionRatio(lvl) * 100)} gelen hasar`,
  },
  {
    key: 'crewSkillLevel',
    title: 'Denizci Yetkinliği',
    subtitle: 'Kaptan hızını, silah hasarını ve açıkta can yenilenmesini artırır.',
    maxLevel: 8,
    baseCost: 105,
    costMultiplier: 1.72,
    statLabel: (lvl) => {
      const b = getCrewSkillBonuses(lvl);
      return `+%${Math.round((b.weaponDmgMult - 1) * 100)} silah · +${b.hpRegenPerSec.toFixed(1)} can/sn`;
    },
  },
];

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, currentLevel - 1)) / 5) * 5;
}

export function getDigRadius(shovelLevel: number): number {
  return 36 + (shovelLevel - 1) * 10;
}

export function getDigCooldownMs(shovelLevel: number): number {
  return Math.max(190, 440 - (shovelLevel - 1) * 34);
}

export function getBoatSpeed(boatLevel: number): number {
  return getShipClass(boatLevel).maxSpeed;
}

export function getMaxBoatHp(boatLevel: number): number {
  return 100 + (boatLevel - 1) * 35;
}

export function getCannonDamage(cannonLevel: number): number {
  return 22 + (cannonLevel - 1) * 10;
}

export function getCannonCooldownMs(cannonLevel: number): number {
  return Math.max(440, 1050 - (cannonLevel - 1) * 85);
}

export function getCannonCountPerSide(cannonLevel: number): number {
  if (cannonLevel >= 7) return 4;
  if (cannonLevel >= 5) return 3;
  if (cannonLevel >= 2) return 2;
  return 1;
}

export function getRadarCooldownMs(radarLevel: number): number {
  return Math.max(380, 950 - (radarLevel - 1) * 80);
}

export function getValueMultiplier(luckLevel: number): number {
  return 1 + (luckLevel - 1) * 0.25;
}

export function getDamageReductionRatio(hullPlatingLevel = 1): number {
  const lvl = Math.max(1, hullPlatingLevel);
  return Math.min(0.45, (lvl - 1) * 0.06);
}

export function getCrewSkillBonuses(crewSkillLevel = 1): {
  footSpeedMult: number;
  weaponDmgMult: number;
  hpRegenPerSec: number;
} {
  const lvl = Math.max(1, crewSkillLevel);
  return {
    footSpeedMult: 1 + (lvl - 1) * 0.04,
    weaponDmgMult: 1 + (lvl - 1) * 0.08,
    hpRegenPerSec: 0.4 + (lvl - 1) * 0.55,
  };
}
