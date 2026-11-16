import { GameSettings, SaveData } from '../types/game';

const SAVE_KEY = 'tropik_ada_save_v1';
const SETTINGS_KEY = 'tropik_ada_settings_v1';

export function createInitialSave(worldSeed?: number): SaveData {
  const seed = worldSeed ?? Math.floor(100000 + Math.random() * 899999);
  return {
    version: 1,
    worldSeed: seed,
    gold: 50,
    totalGoldEarned: 50,
    treasuresFoundCount: 0,
    enemiesSunkCount: 0,
    landEnemiesDefeated: 0,
    boatHp: 100,
    playerHp: 100,
    equippedWeapon: null,
    unlockedWeapons: [],
    collectedPickupIds: [],
    bag: [],
    upgrades: {
      shovelLevel: 1,
      boatLevel: 1,
      radarLevel: 1,
      luckLevel: 1,
      cannonLevel: 1,
    },
    kingdom: {
      founded: false,
      name: 'Turkuaz Cumhuriyeti',
      bannerColor: '#10B981',
      armyLevel: 1,
      conqueredIslandIds: [],
      islandOwners: {},
      atWarWith: [],
      soldiers: [],
      escortShipCount: 0,
    },
    dugCraters: [],
    openedTreasureIds: [],
    discoveredIslandIds: ['island_0_0'],
    player: {
      x: 110,
      y: 25,
      angle: 0,
      isSailing: false,
    },
    boat: {
      x: 345,
      y: 40,
      angle: 0.25,
    },
  };
}

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (typeof parsed.worldSeed !== 'number' || !parsed.player || !parsed.boat || !parsed.upgrades) {
      return null;
    }
    const boatLevel = parsed.upgrades.boatLevel ?? 1;
    const maxHp = 100 + (boatLevel - 1) * 30;
    return {
      version: 1,
      worldSeed: parsed.worldSeed,
      gold: typeof parsed.gold === 'number' ? parsed.gold : 0,
      totalGoldEarned: typeof parsed.totalGoldEarned === 'number' ? parsed.totalGoldEarned : 0,
      treasuresFoundCount:
        typeof parsed.treasuresFoundCount === 'number' ? parsed.treasuresFoundCount : 0,
      enemiesSunkCount:
        typeof parsed.enemiesSunkCount === 'number' ? parsed.enemiesSunkCount : 0,
      landEnemiesDefeated:
        typeof parsed.landEnemiesDefeated === 'number' ? parsed.landEnemiesDefeated : 0,
      boatHp:
        typeof parsed.boatHp === 'number' ? Math.max(25, Math.min(maxHp, parsed.boatHp)) : maxHp,
      playerHp:
        typeof parsed.playerHp === 'number' ? Math.max(25, Math.min(100, parsed.playerHp)) : 100,
      equippedWeapon: parsed.equippedWeapon ?? null,
      unlockedWeapons: Array.isArray(parsed.unlockedWeapons) ? parsed.unlockedWeapons : [],
      collectedPickupIds: Array.isArray(parsed.collectedPickupIds) ? parsed.collectedPickupIds : [],
      bag: Array.isArray(parsed.bag) ? parsed.bag : [],
      upgrades: {
        shovelLevel: parsed.upgrades.shovelLevel ?? 1,
        boatLevel,
        radarLevel: parsed.upgrades.radarLevel ?? 1,
        luckLevel: parsed.upgrades.luckLevel ?? 1,
        cannonLevel: parsed.upgrades.cannonLevel ?? 1,
      },
      kingdom: {
        founded: Boolean(parsed.kingdom?.founded),
        name:
          typeof parsed.kingdom?.name === 'string' && parsed.kingdom.name.trim()
            ? parsed.kingdom.name
            : 'Turkuaz Cumhuriyeti',
        bannerColor:
          typeof parsed.kingdom?.bannerColor === 'string'
            ? parsed.kingdom.bannerColor
            : '#10B981',
        armyLevel:
          typeof parsed.kingdom?.armyLevel === 'number' && parsed.kingdom.armyLevel >= 1
            ? parsed.kingdom.armyLevel
            : 1,
        conqueredIslandIds: Array.isArray(parsed.kingdom?.conqueredIslandIds)
          ? parsed.kingdom.conqueredIslandIds
          : [],
        islandOwners:
          parsed.kingdom?.islandOwners && typeof parsed.kingdom.islandOwners === 'object'
            ? parsed.kingdom.islandOwners
            : {},
        atWarWith: Array.isArray(parsed.kingdom?.atWarWith) ? parsed.kingdom.atWarWith : [],
        soldiers: Array.isArray(parsed.kingdom?.soldiers) ? parsed.kingdom.soldiers : [],
        escortShipCount:
          typeof parsed.kingdom?.escortShipCount === 'number' ? parsed.kingdom.escortShipCount : 0,
      },
      dugCraters: Array.isArray(parsed.dugCraters)
        ? parsed.dugCraters.map((c) => ({ ...c, depth: c.depth ?? 1 }))
        : [],
      openedTreasureIds: Array.isArray(parsed.openedTreasureIds) ? parsed.openedTreasureIds : [],
      discoveredIslandIds: Array.isArray(parsed.discoveredIslandIds)
        ? parsed.discoveredIslandIds
        : ['island_0_0'],
      player: parsed.player,
      boat: parsed.boat,
    };
  } catch {
    return null;
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  joystickMode: 'FIXED',
  showWaves: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      joystickMode: parsed.joystickMode === 'DYNAMIC' ? 'DYNAMIC' : 'FIXED',
      showWaves: parsed.showWaves ?? true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}
