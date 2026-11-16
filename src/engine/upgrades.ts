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
    maxLevel: 6,
    baseCost: 80,
    costMultiplier: 1.75,
    statLabel: (lvl) => `${36 + (lvl - 1) * 10} px menzil`,
  },
  {
    key: 'boatLevel',
    title: 'Gemi Sınıfı ve Gövde',
    subtitle: 'Gemiyi daha büyük sınıfa yükseltir; hız, direk sayısı ve gövde zırhı artar.',
    maxLevel: 6,
    baseCost: 110,
    costMultiplier: 1.85,
    statLabel: (lvl) => {
      const cls = getShipClass(lvl);
      return `${cls.name} · ${cls.masts} Direk · ${getMaxBoatHp(lvl)} Can`;
    },
  },
  {
    key: 'cannonLevel',
    title: 'Yan Borda Topları',
    subtitle: 'Teknenin iki yanındaki top hasarını ve namlu sayısını artırır.',
    maxLevel: 6,
    baseCost: 120,
    costMultiplier: 1.8,
    statLabel: (lvl) => `${getCannonCountPerSide(lvl)}x yan top · ${getCannonDamage(lvl)} hasar`,
  },
  {
    key: 'radarLevel',
    title: 'Hazine Radarı',
    subtitle: 'Sıcak-soğuk algılama menzilini açar ve yön oku ekler.',
    maxLevel: 6,
    baseCost: 95,
    costMultiplier: 1.75,
    statLabel: (lvl) => (lvl >= 2 ? `Yön oku + ${1100 + (lvl - 1) * 350}m` : '1100m menzil'),
  },
  {
    key: 'luckLevel',
    title: 'Korsan Çantası',
    subtitle: 'Bulunan hazinelerin satış değerini ve nadirlik şansını artırır.',
    maxLevel: 6,
    baseCost: 130,
    costMultiplier: 1.9,
    statLabel: (lvl) => `+%${(lvl - 1) * 25} değer`,
  },
];

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, currentLevel - 1)) / 5) * 5;
}

export function getDigRadius(shovelLevel: number): number {
  return 36 + (shovelLevel - 1) * 10;
}

export function getDigCooldownMs(shovelLevel: number): number {
  return Math.max(240, 440 - (shovelLevel - 1) * 38);
}

export function getBoatSpeed(boatLevel: number): number {
  return getShipClass(boatLevel).maxSpeed;
}

export function getMaxBoatHp(boatLevel: number): number {
  return 100 + (boatLevel - 1) * 30;
}

export function getCannonDamage(cannonLevel: number): number {
  return 22 + (cannonLevel - 1) * 9;
}

export function getCannonCooldownMs(cannonLevel: number): number {
  return Math.max(520, 1050 - (cannonLevel - 1) * 95);
}

export function getCannonCountPerSide(cannonLevel: number): number {
  if (cannonLevel >= 5) return 3;
  if (cannonLevel >= 2) return 2;
  return 1;
}

export function getRadarCooldownMs(radarLevel: number): number {
  return Math.max(450, 950 - (radarLevel - 1) * 90);
}

export function getValueMultiplier(luckLevel: number): number {
  return 1 + (luckLevel - 1) * 0.25;
}
