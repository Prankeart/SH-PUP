import { WeaponId } from '../types/game';

export const MAX_CARRIED_WEAPONS = 2;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  nameEn: string;
  kind: 'MELEE' | 'RANGED';
  tier: number;
  damage: number;
  range: number;
  cooldownMs: number;
  pellets: number;
  spreadRad: number;
  projectileSpeed: number;
  magSize?: number;
  reloadMs?: number;
  color: string;
  splashRadius?: number;
  lifesteal?: number;
  shopCost?: number;
  description: string;
  descriptionEn: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  CUTLASS: {
    id: 'CUTLASS',
    name: 'Korsan Palası',
    nameEn: 'Pirate Cutlass',
    kind: 'MELEE',
    tier: 1,
    damage: 34,
    range: 68,
    cooldownMs: 360,
    pellets: 1,
    spreadRad: 0,
    projectileSpeed: 0,
    color: '#CBD5E1',
    description: 'Yakın mesafede hızlı ve güvenilir klasik korsan kılıcı.',
    descriptionEn: 'Fast and reliable classic pirate cutlass for close combat.',
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'Çakmaklı Tabanca',
    nameEn: 'Flintlock Pistol',
    kind: 'RANGED',
    tier: 2,
    damage: 38,
    range: 340,
    cooldownMs: 420,
    pellets: 1,
    spreadRad: 0.04,
    projectileSpeed: 540,
    magSize: 6,
    reloadMs: 1050,
    color: '#F59E0B',
    shopCost: 140,
    description: 'Tek atışta isabetli orta menzilli denizci tabancası.',
    descriptionEn: 'Accurate mid-range single-shot naval flintlock.',
  },
  MUSKET: {
    id: 'MUSKET',
    name: 'Korsan Tüfeği',
    nameEn: 'Pirate Musket',
    kind: 'RANGED',
    tier: 3,
    damage: 24,
    range: 310,
    cooldownMs: 560,
    pellets: 3,
    spreadRad: 0.24,
    projectileSpeed: 510,
    magSize: 4,
    reloadMs: 1300,
    color: '#38BDF8',
    shopCost: 260,
    description: 'Üçlü saçma atarak düşman gruplarını dağıtan tüfek.',
    descriptionEn: 'Fires a 3-pellet spread ideal for breaking groups.',
  },
  DUAL_PISTOL: {
    id: 'DUAL_PISTOL',
    name: 'Altın Çift Tabanca',
    nameEn: 'Golden Dual Pistols',
    kind: 'RANGED',
    tier: 4,
    damage: 34,
    range: 390,
    cooldownMs: 300,
    pellets: 2,
    spreadRad: 0.12,
    projectileSpeed: 590,
    magSize: 12,
    reloadMs: 1200,
    color: '#FDE047',
    shopCost: 420,
    description: 'Çok hızlı çift mermi atan altın işlemeli tabanca çifti.',
    descriptionEn: 'Rapid-firing twin golden flintlocks.',
  },
  OBSIDIAN_BLADE: {
    id: 'OBSIDIAN_BLADE',
    name: 'Obsidyen Kılıcı',
    nameEn: 'Obsidian Blade',
    kind: 'MELEE',
    tier: 4,
    damage: 58,
    range: 86,
    cooldownMs: 320,
    pellets: 1,
    spreadRad: 0,
    projectileSpeed: 0,
    color: '#C084FC',
    description: 'Mağara sunaklarından çıkarılan keskin volkanik kılıç.',
    descriptionEn: 'Razor-sharp volcanic blade forged in subterranean altars.',
  },
  CRYSTAL_BLUNDERBUSS: {
    id: 'CRYSTAL_BLUNDERBUSS',
    name: 'Kristal Karabina',
    nameEn: 'Crystal Blunderbuss',
    kind: 'RANGED',
    tier: 5,
    damage: 28,
    range: 360,
    cooldownMs: 470,
    pellets: 5,
    spreadRad: 0.34,
    projectileSpeed: 570,
    magSize: 5,
    reloadMs: 1300,
    color: '#22D3EE',
    description: '5 kristal parçacığı fırlatan yüksek hasarlı karabina.',
    descriptionEn: 'Shatters foes with a 5-shard crystal blast.',
  },
  ANCIENT_HARPOON: {
    id: 'ANCIENT_HARPOON',
    name: 'Kadim Zıpkın Tüfeği',
    nameEn: 'Ancient Harpoon',
    kind: 'RANGED',
    tier: 5,
    damage: 74,
    range: 480,
    cooldownMs: 430,
    pellets: 1,
    spreadRad: 0.02,
    projectileSpeed: 720,
    magSize: 4,
    reloadMs: 1200,
    color: '#FB923C',
    description: 'Uzun menzilli yüksek hızlı delici arena zıpkını.',
    descriptionEn: 'Long-range high-velocity arena harpoon rifle.',
  },
  SHADOW_SCYTHE: {
    id: 'SHADOW_SCYTHE',
    name: 'Gölge Tırpanı',
    nameEn: 'Shadow Scythe',
    kind: 'MELEE',
    tier: 5,
    damage: 68,
    range: 98,
    cooldownMs: 350,
    pellets: 1,
    spreadRad: 0,
    projectileSpeed: 0,
    color: '#A855F7',
    lifesteal: 5,
    shopCost: 680,
    description: 'Geniş biçme alanı ve isabette +5 Can çalma özelliğine sahip tırpan.',
    descriptionEn: 'Wide sweeping reaper blade that drains +5 HP on hit.',
  },
  MAGMA_CANNON: {
    id: 'MAGMA_CANNON',
    name: 'Volkan Topu',
    nameEn: 'Magma Hand-Cannon',
    kind: 'RANGED',
    tier: 6,
    damage: 78,
    range: 380,
    cooldownMs: 620,
    pellets: 1,
    spreadRad: 0.03,
    projectileSpeed: 460,
    magSize: 3,
    reloadMs: 1450,
    color: '#F97316',
    splashRadius: 68,
    shopCost: 860,
    description: 'Çarptığı alanda patlayarak yakındaki tüm düşmanlara alan hasarı verir.',
    descriptionEn: 'Launches unstable magma shells that explode on impact.',
  },
  STORM_TRIDENT: {
    id: 'STORM_TRIDENT',
    name: 'Fırtına Mızrağı',
    nameEn: 'Storm Trident',
    kind: 'RANGED',
    tier: 6,
    damage: 42,
    range: 430,
    cooldownMs: 390,
    pellets: 3,
    spreadRad: 0.16,
    projectileSpeed: 680,
    magSize: 6,
    reloadMs: 1250,
    color: '#38BDF8',
    description: 'Üçlü yıldırım mızrağı fırlatan kadim deniz silahı.',
    descriptionEn: 'Unleashes three crackling lightning bolts per volley.',
  },
  PHANTOM_REPEATER: {
    id: 'PHANTOM_REPEATER',
    name: 'Hayalet Arbaleti',
    nameEn: 'Phantom Repeater',
    kind: 'RANGED',
    tier: 6,
    damage: 52,
    range: 460,
    cooldownMs: 230,
    pellets: 1,
    spreadRad: 0.03,
    projectileSpeed: 740,
    magSize: 14,
    reloadMs: 1150,
    color: '#10B981',
    shopCost: 920,
    description: 'Seri atışlı hayalet enerjisi oku fırlatan yüksek tempolu arbalet.',
    descriptionEn: 'Ultra-rapid phantom bolt repeater with long range.',
  },
};

export const WEAPON_LIST: WeaponDef[] = Object.values(WEAPONS);

export function pickStrongerWeapon(current: WeaponId | null, candidate: WeaponId): WeaponId {
  if (!current) return candidate;
  return WEAPONS[candidate].tier >= WEAPONS[current].tier ? candidate : current;
}

export function normalizeWeaponSlots(
  rawSlots: WeaponId[] | undefined,
  unlockedWeapons: WeaponId[],
  equippedWeapon: WeaponId | null
): { weaponSlots: WeaponId[]; equippedWeapon: WeaponId | null; unlockedWeapons: WeaponId[] } {
  const unlockedSet = new Set<WeaponId>(
    unlockedWeapons.filter((id) => Boolean(WEAPONS[id]))
  );
  if (equippedWeapon && WEAPONS[equippedWeapon]) {
    unlockedSet.add(equippedWeapon);
  }

  const cleanSlots: WeaponId[] = [];
  if (Array.isArray(rawSlots)) {
    for (const id of rawSlots) {
      if (WEAPONS[id] && !cleanSlots.includes(id) && cleanSlots.length < MAX_CARRIED_WEAPONS) {
        cleanSlots.push(id);
        unlockedSet.add(id);
      }
    }
  } else {
    // Legacy save without weaponSlots: seed from equippedWeapon + next strongest unlocked weapon
    if (equippedWeapon && WEAPONS[equippedWeapon]) {
      cleanSlots.push(equippedWeapon);
    }
    const sortedUnlocked = Array.from(unlockedSet).sort(
      (a, b) => WEAPONS[b].tier - WEAPONS[a].tier
    );
    for (const id of sortedUnlocked) {
      if (!cleanSlots.includes(id) && cleanSlots.length < MAX_CARRIED_WEAPONS) {
        cleanSlots.push(id);
      }
    }
  }

  let resolvedEquipped =
    equippedWeapon && WEAPONS[equippedWeapon] ? equippedWeapon : cleanSlots[0] ?? null;
  if (resolvedEquipped && !cleanSlots.includes(resolvedEquipped)) {
    if (cleanSlots.length < MAX_CARRIED_WEAPONS) {
      cleanSlots.push(resolvedEquipped);
    } else {
      cleanSlots[0] = resolvedEquipped;
    }
  }
  if (!resolvedEquipped && cleanSlots.length > 0) {
    resolvedEquipped = cleanSlots[0];
  }

  return {
    weaponSlots: cleanSlots,
    equippedWeapon: resolvedEquipped,
    unlockedWeapons: Array.from(unlockedSet),
  };
}

export function applyWeaponAcquire(
  state: {
    unlockedWeapons: WeaponId[];
    weaponSlots?: WeaponId[];
    equippedWeapon: WeaponId | null;
  },
  candidate: WeaponId,
  mode: 'EQUIP_OR_BUY' | 'PICKUP',
  replaceSlotIndex?: number
): {
  unlockedWeapons: WeaponId[];
  weaponSlots: WeaponId[];
  equippedWeapon: WeaponId | null;
  replacedWeapon: WeaponId | null;
} {
  const norm = normalizeWeaponSlots(
    state.weaponSlots,
    state.unlockedWeapons,
    state.equippedWeapon
  );
  const nextUnlocked = norm.unlockedWeapons.includes(candidate)
    ? norm.unlockedWeapons
    : [...norm.unlockedWeapons, candidate];
  const nextSlots = [...norm.weaponSlots];
  let nextEquipped = norm.equippedWeapon;
  let replacedWeapon: WeaponId | null = null;

  if (nextSlots.includes(candidate)) {
    if (mode === 'EQUIP_OR_BUY') {
      nextEquipped = candidate;
    } else {
      nextEquipped = pickStrongerWeapon(nextEquipped, candidate);
    }
    return {
      unlockedWeapons: nextUnlocked,
      weaponSlots: nextSlots,
      equippedWeapon: nextEquipped,
      replacedWeapon: null,
    };
  }

  if (nextSlots.length < MAX_CARRIED_WEAPONS) {
    nextSlots.push(candidate);
    nextEquipped =
      mode === 'EQUIP_OR_BUY'
        ? candidate
        : pickStrongerWeapon(nextEquipped, candidate);
    return {
      unlockedWeapons: nextUnlocked,
      weaponSlots: nextSlots,
      equippedWeapon: nextEquipped,
      replacedWeapon: null,
    };
  }

  // Already carrying MAX_CARRIED_WEAPONS (2)
  if (mode === 'EQUIP_OR_BUY') {
    const activeIdx = nextEquipped ? nextSlots.indexOf(nextEquipped) : 0;
    const targetIdx =
      typeof replaceSlotIndex === 'number' &&
      replaceSlotIndex >= 0 &&
      replaceSlotIndex < MAX_CARRIED_WEAPONS
        ? replaceSlotIndex
        : activeIdx >= 0
        ? activeIdx
        : 0;
    replacedWeapon = nextSlots[targetIdx] ?? null;
    nextSlots[targetIdx] = candidate;
    nextEquipped = candidate;
  } else {
    // PICKUP: replace the weaker carried slot if candidate is >= its tier
    let weakestIdx = 0;
    for (let i = 1; i < nextSlots.length; i++) {
      if (WEAPONS[nextSlots[i]].tier < WEAPONS[nextSlots[weakestIdx]].tier) {
        weakestIdx = i;
      }
    }
    const weakestWeapon = nextSlots[weakestIdx];
    if (WEAPONS[candidate].tier >= WEAPONS[weakestWeapon].tier) {
      replacedWeapon = weakestWeapon;
      nextSlots[weakestIdx] = candidate;
      nextEquipped = pickStrongerWeapon(nextEquipped, candidate);
    }
  }

  return {
    unlockedWeapons: nextUnlocked,
    weaponSlots: nextSlots,
    equippedWeapon: nextEquipped,
    replacedWeapon,
  };
}
