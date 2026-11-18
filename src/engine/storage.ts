import { GameSettings, KeybindingsConfig, SaveData } from '../types/game';
import { getMaxBoatHp } from './upgrades';

const SAVE_KEY = 'tropik_ada_save_v1';
const SETTINGS_KEY = 'tropik_ada_settings_v1';
const SLOT_KEY_PREFIX = 'tropik_ada_save_slot_';

export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  digOrFire: 'Space',
  attack: 'KeyF',
  boat: 'KeyE',
  radar: 'KeyR',
  ability: 'KeyQ',
  map: 'KeyM',
  shop: 'KeyT',
  kingdom: 'KeyK',
  journal: 'KeyJ',
};

export function createInitialSave(worldSeed?: number): SaveData {
  const seed = worldSeed ?? Math.floor(100000 + Math.random() * 899999);
  return {
    version: 2,
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
      hullPlatingLevel: 1,
      crewSkillLevel: 1,
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
    playTimeSec: 0,
    worldTimeSec: 36, // Start in bright morning light
    collectedRelicIds: [],
    claimedMilestoneIds: [],
    unlockedAchievementIds: [],
    tutorialCompleted: [],
    stormsSurvivedCount: 0,
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

export function normalizeSaveData(rawObj: unknown): SaveData | null {
  try {
    const parsed = rawObj as Partial<SaveData>;
    if (!parsed || typeof parsed.worldSeed !== 'number' || !parsed.player || !parsed.boat || !parsed.upgrades) {
      return null;
    }
    const boatLevel = Math.max(1, Math.min(8, parsed.upgrades.boatLevel ?? 1));
    const maxHp = getMaxBoatHp(boatLevel);
    return {
      version: 2,
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
        typeof parsed.playerHp === 'number' ? Math.max(25, Math.min(125, parsed.playerHp)) : 100,
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
        hullPlatingLevel: parsed.upgrades.hullPlatingLevel ?? 1,
        crewSkillLevel: parsed.upgrades.crewSkillLevel ?? 1,
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
      playTimeSec: typeof parsed.playTimeSec === 'number' ? parsed.playTimeSec : 0,
      worldTimeSec: typeof parsed.worldTimeSec === 'number' ? parsed.worldTimeSec : 36,
      collectedRelicIds: Array.isArray(parsed.collectedRelicIds) ? parsed.collectedRelicIds : [],
      claimedMilestoneIds: Array.isArray(parsed.claimedMilestoneIds) ? parsed.claimedMilestoneIds : [],
      unlockedAchievementIds: Array.isArray(parsed.unlockedAchievementIds)
        ? parsed.unlockedAchievementIds
        : [],
      tutorialCompleted: Array.isArray(parsed.tutorialCompleted) ? parsed.tutorialCompleted : [],
      stormsSurvivedCount:
        typeof parsed.stormsSurvivedCount === 'number' ? parsed.stormsSurvivedCount : 0,
      player: parsed.player,
      boat: parsed.boat,
    };
  } catch {
    return null;
  }
}

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return normalizeSaveData(JSON.parse(raw));
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

export interface SaveSlotSummary {
  slot: number;
  savedAt: number;
  gold: number;
  worldSeed: number;
  discoveredCount: number;
  conqueredCount: number;
  boatLevel: number;
}

export function saveToSlot(slot: number, data: SaveData): void {
  try {
    localStorage.setItem(
      `${SLOT_KEY_PREFIX}${slot}`,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadFromSlot(slot: number): SaveData | null {
  try {
    const raw = localStorage.getItem(`${SLOT_KEY_PREFIX}${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: unknown };
    return normalizeSaveData(parsed.data ?? parsed);
  } catch {
    return null;
  }
}

export function listSaveSlots(): Array<SaveSlotSummary | null> {
  return [1, 2, 3].map((slot) => {
    try {
      const raw = localStorage.getItem(`${SLOT_KEY_PREFIX}${slot}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt?: number; data?: Partial<SaveData> };
      const d = parsed.data;
      if (!d || typeof d.worldSeed !== 'number') return null;
      return {
        slot,
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
        gold: typeof d.gold === 'number' ? d.gold : 0,
        worldSeed: d.worldSeed,
        discoveredCount: Array.isArray(d.discoveredIslandIds) ? d.discoveredIslandIds.length : 1,
        conqueredCount: Array.isArray(d.kingdom?.conqueredIslandIds)
          ? d.kingdom.conqueredIslandIds.length
          : 0,
        boatLevel: d.upgrades?.boatLevel ?? 1,
      };
    } catch {
      return null;
    }
  });
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  ambientEnabled: true,
  joystickMode: 'FIXED',
  showWaves: true,
  touchControls: 'AUTO',
  colorblindMode: false,
  screenShakeIntensity: 100,
  showTutorialHints: true,
  language: 'tr',
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      ambientEnabled: parsed.ambientEnabled ?? true,
      joystickMode: parsed.joystickMode === 'DYNAMIC' ? 'DYNAMIC' : 'FIXED',
      showWaves: parsed.showWaves ?? true,
      touchControls:
        parsed.touchControls === 'ALWAYS' || parsed.touchControls === 'HIDDEN'
          ? parsed.touchControls
          : 'AUTO',
      colorblindMode: parsed.colorblindMode ?? false,
      screenShakeIntensity:
        typeof parsed.screenShakeIntensity === 'number'
          ? Math.max(0, Math.min(100, parsed.screenShakeIntensity))
          : 100,
      showTutorialHints: parsed.showTutorialHints ?? true,
      language: parsed.language === 'en' ? 'en' : 'tr',
      keybindings: {
        ...DEFAULT_KEYBINDINGS,
        ...(parsed.keybindings ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } };
  }
}

export function persistSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}
