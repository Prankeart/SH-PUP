import { PlayerIdentity, PlayerProfileLedger, RoomLedger, StarterSlot } from '../types/online';
import { getIslandRadiusAtAngle, WorldManager } from './worldGen';

const IDENTITY_KEY = 'tropik_ada_online_identity_v1';
const DB_NAME = 'tropik_ada_online_db';
const DB_VERSION = 1;
const STORE_NAME = 'room_ledgers';

function randomToken(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function loadPlayerIdentity(): PlayerIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
      if (parsed.playerId && parsed.name && parsed.bannerColor) {
        return {
          playerId: parsed.playerId,
          name: parsed.name,
          bannerColor: parsed.bannerColor,
        };
      }
    }
  } catch {
    // Ignore storage read error
  }
  const fresh: PlayerIdentity = {
    playerId: `cap_${randomToken(10)}`,
    name: `Kaptan ${Math.floor(100 + Math.random() * 899)}`,
    bannerColor: '#10B981',
  };
  savePlayerIdentity(fresh);
  return fresh;
}

export function savePlayerIdentity(identity: PlayerIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Ignore quota errors
  }
}

export function createProfileForSlot(
  identity: PlayerIdentity,
  slot: StarterSlot,
  worldManager: WorldManager
): PlayerProfileLedger {
  const island = worldManager.addStarterSlot(slot);
  const dockAngle = island.traderDock?.angle ?? Math.atan2(-slot.centerY, -slot.centerX);
  const coastR = getIslandRadiusAtAngle(island, dockAngle + 0.14);
  const playerX = slot.centerX + Math.cos(dockAngle + 0.14) * (coastR * 0.45);
  const playerY = slot.centerY + Math.sin(dockAngle + 0.14) * (coastR * 0.45);
  const boatX = slot.centerX + Math.cos(dockAngle + 0.14) * (coastR + 40);
  const boatY = slot.centerY + Math.sin(dockAngle + 0.14) * (coastR + 40);

  return {
    playerId: identity.playerId,
    name: identity.name,
    bannerColor: identity.bannerColor,
    starterSlotIndex: slot.slotIndex,
    gold: 80,
    totalGoldEarned: 80,
    treasuresFoundCount: 0,
    enemiesSunkCount: 0,
    landEnemiesDefeated: 0,
    boatHp: 100,
    playerHp: 100,
    equippedWeapon: null,
    weaponSlots: [],
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
      repairShellsLevel: 1,
    },
    kingdomFounded: false,
    kingdomName: `${identity.name} Devleti`,
    armyLevel: 1,
    conqueredIslandIds: [],
    escortShipCount: 0,
    soldiers: [],
    discoveredIslandIds: [slot.islandId],
    claimedMilestoneIds: [],
    unlockedAchievementIds: [],
    collectedRelicIds: [],
    stormsSurvivedCount: 0,
    wood: 0,
    iron: 0,
    repairKits: 1,
    caughtFishCount: 0,
    ownedPets: [],
    activePet: null,
    discoveredLogIds: [],
    soldiersLostCount: 0,
    shipsLostCount: 0,
    openedCaveChestIds: [],
    arenaWinsCount: 0,
    cavesExploredCount: 0,
    player: {
      x: playerX,
      y: playerY,
      angle: dockAngle,
      isSailing: false,
    },
    boat: {
      x: boatX,
      y: boatY,
      angle: dockAngle + Math.PI * 0.5,
    },
    lastSeenAt: Date.now(),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'roomInfo.roomId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

export async function saveRoomLedger(ledger: RoomLedger): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const clone: RoomLedger = {
        ...ledger,
        roomInfo: { ...ledger.roomInfo, updatedAt: Date.now() },
      };
      store.put(clone);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    try {
      localStorage.setItem(`tropik_room_${ledger.roomInfo.roomId}`, JSON.stringify(ledger));
    } catch {
      // Ignore fallback quota error
    }
  }
}

export async function loadRoomLedger(roomId: string): Promise<RoomLedger | null> {
  const cleanId = roomId.trim().toUpperCase();
  try {
    const db = await openDb();
    const res = await new Promise<RoomLedger | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as RoomLedger | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
    if (res) return res;
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(`tropik_room_${cleanId}`);
    return raw ? (JSON.parse(raw) as RoomLedger) : null;
  } catch {
    return null;
  }
}

export async function listRoomLedgers(): Promise<RoomLedger[]> {
  const merged = new Map<string, RoomLedger>();

  try {
    const db = await openDb();
    const res = await new Promise<RoomLedger[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result as RoomLedger[] | undefined) ?? []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
    for (const r of res) {
      if (r?.roomInfo?.roomId) {
        merged.set(r.roomInfo.roomId, r);
      }
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('tropik_room_')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as RoomLedger;
      const id = parsed?.roomInfo?.roomId;
      if (!id) continue;
      const existing = merged.get(id);
      if (!existing || (parsed.roomInfo.updatedAt ?? 0) > (existing.roomInfo.updatedAt ?? 0)) {
        merged.set(id, parsed);
      }
    }
  } catch {
    // Ignore storage read error
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => (b.roomInfo.updatedAt ?? 0) - (a.roomInfo.updatedAt ?? 0));
  return all;
}

export async function deleteRoomLedger(roomId: string): Promise<void> {
  const cleanId = roomId.trim().toUpperCase();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(cleanId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore
  }
  try {
    localStorage.removeItem(`tropik_room_${cleanId}`);
  } catch {
    // Ignore
  }
}

export function exportRoomLedgerJson(ledger: RoomLedger): string {
  return JSON.stringify(ledger, null, 2);
}

export function parseImportedRoomLedger(jsonText: string): RoomLedger | null {
  try {
    const parsed = JSON.parse(jsonText) as Partial<RoomLedger>;
    if (
      !parsed.roomInfo ||
      typeof parsed.roomInfo.roomId !== 'string' ||
      typeof parsed.roomInfo.worldSeed !== 'number' ||
      !Array.isArray(parsed.starterSlots) ||
      !parsed.playersById
    ) {
      return null;
    }
    return {
      roomInfo: parsed.roomInfo,
      starterSlots: parsed.starterSlots,
      openedTreasureIds: Array.isArray(parsed.openedTreasureIds) ? parsed.openedTreasureIds : [],
      dugCraters: Array.isArray(parsed.dugCraters) ? parsed.dugCraters : [],
      islandOwners: parsed.islandOwners ?? {},
      warDeclarations: parsed.warDeclarations ?? {},
      playersById: parsed.playersById,
    };
  } catch {
    return null;
  }
}
