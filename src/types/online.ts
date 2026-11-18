import {
  AllySoldierRosterItem,
  BagItem,
  CaveTheme,
  DigCrater,
  IslandBiome,
  PetId,
  SoldierType,
  Upgrades,
  WeaponId,
} from './game';
import { UpgradeKey } from '../engine/upgrades';

export type OnlineModeRule = 'COOP' | 'PVP';

export type OnlineRole = 'OFFLINE' | 'HOST' | 'CLIENT';

export type OnlineConnectionStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'LOBBY'
  | 'PLAYING'
  | 'RECONNECTING'
  | 'ERROR';

export interface PlayerIdentity {
  playerId: string;
  name: string;
  bannerColor: string;
}

export interface StarterSlot {
  slotIndex: number;
  playerId: string;
  ownerName: string;
  bannerColor: string;
  islandId: string;
  centerX: number;
  centerY: number;
  seed: number;
}

export interface PlayerProfileLedger {
  playerId: string;
  name: string;
  bannerColor: string;
  starterSlotIndex: number;
  gold: number;
  totalGoldEarned: number;
  treasuresFoundCount: number;
  enemiesSunkCount: number;
  landEnemiesDefeated: number;
  boatHp: number;
  playerHp: number;
  equippedWeapon: WeaponId | null;
  unlockedWeapons: WeaponId[];
  collectedPickupIds: string[];
  bag: BagItem[];
  upgrades: Upgrades;
  kingdomFounded: boolean;
  kingdomName: string;
  armyLevel: number;
  conqueredIslandIds: string[];
  escortShipCount: number;
  soldiers: AllySoldierRosterItem[];
  discoveredIslandIds: string[];
  claimedMilestoneIds?: string[];
  unlockedAchievementIds?: string[];
  collectedRelicIds?: string[];
  stormsSurvivedCount?: number;
  wood?: number;
  iron?: number;
  repairKits?: number;
  caughtFishCount?: number;
  ownedPets?: PetId[];
  activePet?: PetId | null;
  discoveredLogIds?: string[];
  soldiersLostCount?: number;
  shipsLostCount?: number;
  openedCaveChestIds?: string[];
  arenaWinsCount?: number;
  cavesExploredCount?: number;
  player: {
    x: number;
    y: number;
    angle: number;
    isSailing: boolean;
  };
  boat: {
    x: number;
    y: number;
    angle: number;
  };
  lastSeenAt: number;
}

export interface RemoteSoldierSnapshot {
  id: string;
  type: SoldierType;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  swinging?: boolean;
}

export interface RemoteEscortShipSnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
}

export interface RemotePlayerSnapshot {
  id: string;
  name: string;
  bannerColor: string;
  kingdomFounded: boolean;
  kingdomName: string;
  x: number;
  y: number;
  angle: number;
  boatX: number;
  boatY: number;
  boatAngle: number;
  isSailing: boolean;
  boatLevel: number;
  boatHp: number;
  maxBoatHp: number;
  playerHp: number;
  equippedWeapon: WeaponId | null;
  speedRatio: number;
  walkPhase: number;
  digAnimProgress: number;
  attackAnimProgress: number;
  hitFlash: boolean;
  connected: boolean;
  isHost: boolean;
  starterSlotIndex: number;
  conqueredCount: number;
  inCaveId?: string | null;
  caveX?: number;
  caveY?: number;
  caveAngle?: number;
  soldiers?: RemoteSoldierSnapshot[];
  ships?: RemoteEscortShipSnapshot[];
}

export interface OnlineCaveEnemySnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  walkPhase: number;
  hitFlash: boolean;
}

export interface OnlineCaveProjectileSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  color: string;
}

export interface OnlineCaveSnapshot {
  caveId: string;
  enemies: OnlineCaveEnemySnapshot[];
  projectiles: OnlineCaveProjectileSnapshot[];
  openedChestIds: string[];
  altarClaimed: boolean;
  bossDefeated: boolean;
}

export interface VoicePeerInfo {
  playerId: string;
  peerId: string;
  name: string;
  bannerColor: string;
  x?: number;
  y?: number;
}

export interface RemotePlayerView extends RemotePlayerSnapshot {
  targetX: number;
  targetY: number;
  targetAngle: number;
  targetBoatX: number;
  targetBoatY: number;
  targetBoatAngle: number;
  lastSnapshotTime: number;
  soldierTargets?: Map<string, RemoteSoldierSnapshot>;
  shipTargets?: Map<string, RemoteEscortShipSnapshot>;
}

export interface OnlineProjectileSnapshot {
  id: string;
  ownerId: string;
  kind: 'CANNON' | 'LAND';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  color: string;
  life: number;
  splashRadius?: number;
}

export interface OnlineRoomInfo {
  roomId: string;
  hostPlayerId: string;
  hostName: string;
  worldSeed: number;
  rule: OnlineModeRule;
  started: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RoomLedger {
  roomInfo: OnlineRoomInfo;
  starterSlots: StarterSlot[];
  openedTreasureIds: string[];
  dugCraters: DigCrater[];
  islandOwners: Record<string, string>; // islandId -> playerId
  warDeclarations?: Record<string, string[]>; // declarerPlayerId -> targetPlayerIds
  playersById: Record<string, PlayerProfileLedger>;
}

export interface OnlineChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  bannerColor: string;
  text: string;
  ts: number;
}

export interface OnlineWorldEvent {
  eventId: string;
  type:
    | 'treasure:opened'
    | 'crater:dug'
    | 'island:claimed'
    | 'player:hit'
    | 'player:respawn'
    | 'war:status'
    | 'army:hit'
    | 'chat:msg'
    | 'player:emote'
    | 'arena:win'
    | 'fx:toast';
  payload: Record<string, unknown>;
}

export type ClientToHostMessage =
  | {
      type: 'hello';
      playerId: string;
      name: string;
      bannerColor: string;
    }
  | {
      type: 'state:pose';
      seq: number;
      x: number;
      y: number;
      angle: number;
      boatX: number;
      boatY: number;
      boatAngle: number;
      isSailing: boolean;
      speedRatio: number;
      walkPhase: number;
      digAnimProgress: number;
      attackAnimProgress: number;
      inCaveId?: string | null;
      caveX?: number;
      caveY?: number;
      caveAngle?: number;
      soldiers?: Array<{ id: string; x: number; y: number; angle: number; swinging?: boolean }>;
      ships?: Array<{ id: string; x: number; y: number; angle: number }>;
    }
  | {
      type: 'cmd:dig';
      islandId: string;
      x: number;
      y: number;
      foundTreasureId?: string;
      craterId: string;
      newDepth: number;
      foundTreasure: boolean;
      instantBonus: number;
      bagItem?: BagItem;
      unlockedWeapon?: WeaponId;
    }
  | {
      type: 'cmd:fire_cannon';
      x: number;
      y: number;
      angle: number;
      cannonCount: number;
      damage: number;
    }
  | {
      type: 'cmd:land_attack';
      x: number;
      y: number;
      angle: number;
      weaponId: WeaponId | null;
      damage: number;
      range: number;
      isRanged: boolean;
      splashRadius?: number;
      projColor?: string;
    }
  | {
      type: 'cmd:pickup_weapon';
      pickupId: string;
      weaponId: WeaponId;
    }
  | {
      type: 'cmd:sell_item';
      uid: string;
    }
  | {
      type: 'cmd:sell_all';
    }
  | {
      type: 'cmd:buy_upgrade';
      key: UpgradeKey;
    }
  | {
      type: 'cmd:found_kingdom';
      name: string;
      bannerColor: string;
    }
  | {
      type: 'cmd:recruit_soldier';
      soldierType: SoldierType;
      count: number;
    }
  | {
      type: 'cmd:upgrade_army';
    }
  | {
      type: 'cmd:recruit_ship';
      count: number;
    }
  | {
      type: 'cmd:heal_army';
    }
  | {
      type: 'cmd:claim_island';
      islandId: string;
    }
  | {
      type: 'cmd:discover_islands';
      islandIds: string[];
    }
  | {
      type: 'cmd:declare_war';
      targetPlayerId: string;
      cancel?: boolean;
    }
  | {
      type: 'cmd:pvp_army_hit';
      targetPlayerId: string;
      targetUnitKind: 'SOLDIER' | 'SHIP' | 'PLAYER';
      targetUnitId?: string;
      damage: number;
      x: number;
      y: number;
    }
  | {
      type: 'cmd:claim_milestone';
      milestoneId: string;
    }
  | {
      type: 'cmd:unlock_achievements';
      achievementIds: string[];
    }
  | {
      type: 'cmd:discover_relic';
      relicId: string;
    }
  | {
      type: 'cmd:harvest_resource';
      kind: 'WOOD' | 'IRON';
      amount: number;
    }
  | {
      type: 'cmd:sell_resources';
    }
  | {
      type: 'cmd:craft_repair_kit';
    }
  | {
      type: 'cmd:use_repair_kit';
    }
  | {
      type: 'cmd:fish_catch';
      goldValue: number;
    }
  | {
      type: 'cmd:adopt_pet';
      petId: PetId;
    }
  | {
      type: 'cmd:equip_pet';
      petId: PetId | null;
    }
  | {
      type: 'cmd:discover_log';
      logId: string;
    }
  | {
      type: 'cmd:emote';
      emote: string;
    }
  | {
      type: 'cmd:chat';
      text: string;
    }
  | {
      type: 'cmd:claim_cave_chest';
      chestId: string;
      goldValue: number;
      weaponId?: WeaponId;
      caveId?: string;
      isBossOrFirstInCave?: boolean;
    }
  | {
      type: 'cmd:arena_win';
      rewardGold: number;
      weaponId?: WeaponId;
      unlockedWeapon?: WeaponId;
    }
  | {
      type: 'cmd:enter_cave';
      caveId: string;
      islandId: string;
      entranceName: string;
      entranceX: number;
      entranceY: number;
      tier: 1 | 2 | 3;
      theme?: CaveTheme;
      biome?: IslandBiome;
    }
  | {
      type: 'cmd:exit_cave';
      caveId: string;
    }
  | {
      type: 'cmd:cave_attack';
      caveId: string;
      x: number;
      y: number;
      angle: number;
      weaponId: WeaponId | null;
      damage: number;
      range: number;
      isRanged: boolean;
      splashRadius?: number;
      projectileSpeed?: number;
      pellets?: number;
      spreadRad?: number;
      projColor?: string;
      lifesteal?: number;
    }
  | {
      type: 'cmd:cave_interact';
      caveId: string;
      targetKind: 'CHEST' | 'ALTAR';
      targetId: string;
    }
  | {
      type: 'cmd:equip_weapon';
      weaponId: WeaponId;
    }
  | {
      type: 'cmd:buy_weapon';
      weaponId: WeaponId;
    }
  | {
      type: 'cmd:ping';
      ts: number;
    };

export type HostToClientMessage =
  | {
      type: 'welcome';
      roomInfo: OnlineRoomInfo;
      yourProfile: PlayerProfileLedger;
      starterSlots: StarterSlot[];
      openedTreasureIds: string[];
      dugCraters: DigCrater[];
      islandOwners: Record<string, string>;
      warDeclarations: Record<string, string[]>;
      players: RemotePlayerSnapshot[];
    }
  | {
      type: 'lobby:state';
      roomInfo: OnlineRoomInfo;
      players: RemotePlayerSnapshot[];
      starterSlots: StarterSlot[];
      warDeclarations?: Record<string, string[]>;
    }
  | {
      type: 'game:started';
      roomInfo: OnlineRoomInfo;
      starterSlots: StarterSlot[];
    }
  | {
      type: 'world:starter_added';
      slot: StarterSlot;
    }
  | {
      type: 'war:sync';
      warDeclarations: Record<string, string[]>;
    }
  | {
      type: 'world:snapshot';
      t: number;
      players: RemotePlayerSnapshot[];
      projectiles: OnlineProjectileSnapshot[];
    }
  | {
      type: 'world:event';
      event: OnlineWorldEvent;
    }
  | {
      type: 'player:profile_sync';
      profile: PlayerProfileLedger;
    }
  | {
      type: 'voice:peers';
      peers: VoicePeerInfo[];
    }
  | {
      type: 'cave:snapshot';
      snapshot: OnlineCaveSnapshot;
    }
  | {
      type: 'pong';
      ts: number;
    }
  | {
      type: 'error';
      message: string;
    };
