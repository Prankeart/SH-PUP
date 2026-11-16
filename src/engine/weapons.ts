import { WeaponId } from '../types/game';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: 'MELEE' | 'RANGED';
  tier: number;
  damage: number;
  range: number;
  cooldownMs: number;
  pellets: number;
  spreadRad: number;
  projectileSpeed: number;
  color: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  CUTLASS: {
    id: 'CUTLASS',
    name: 'Korsan Palası',
    kind: 'MELEE',
    tier: 1,
    damage: 34,
    range: 68,
    cooldownMs: 360,
    pellets: 1,
    spreadRad: 0,
    projectileSpeed: 0,
    color: '#CBD5E1',
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'Çakmaklı Tabanca',
    kind: 'RANGED',
    tier: 2,
    damage: 38,
    range: 340,
    cooldownMs: 420,
    pellets: 1,
    spreadRad: 0.04,
    projectileSpeed: 540,
    color: '#F59E0B',
  },
  MUSKET: {
    id: 'MUSKET',
    name: 'Korsan Tüfeği',
    kind: 'RANGED',
    tier: 3,
    damage: 24,
    range: 310,
    cooldownMs: 560,
    pellets: 3,
    spreadRad: 0.24,
    projectileSpeed: 510,
    color: '#38BDF8',
  },
  DUAL_PISTOL: {
    id: 'DUAL_PISTOL',
    name: 'Altın Çift Tabanca',
    kind: 'RANGED',
    tier: 4,
    damage: 34,
    range: 390,
    cooldownMs: 300,
    pellets: 2,
    spreadRad: 0.12,
    projectileSpeed: 590,
    color: '#FDE047',
  },
};

export function pickStrongerWeapon(current: WeaponId | null, candidate: WeaponId): WeaponId {
  if (!current) return candidate;
  return WEAPONS[candidate].tier >= WEAPONS[current].tier ? candidate : current;
}
