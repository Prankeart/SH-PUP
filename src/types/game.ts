export type GamePhase = 'TITLE_MENU' | 'PLAYING';

export type ActiveModal =
  | 'NONE'
  | 'MAP'
  | 'SHOP'
  | 'SETTINGS'
  | 'KINGDOM'
  | 'JOURNAL'
  | 'LAYOUT_EDIT';

export type HeatTier = 'HOT' | 'WARM' | 'COOL' | 'COLD' | 'NONE';

export type EnemyFactionId = 'CORSAIR' | 'IMPERIAL' | 'SUN_CLAN';

export type FactionId = 'NEUTRAL' | 'PLAYER' | EnemyFactionId;

export type SoldierType = 'SWORDSMAN' | 'MUSKETEER' | 'HEAVY_GUARD' | 'GRENADIER';

export type SeasonId = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export type WorldEventType =
  | 'STORM'
  | 'TREASURE_TIDE'
  | 'BOUNTY_CONVOY'
  | 'FOG'
  | 'CASTAWAY_RESCUE';

export interface ActiveWorldEvent {
  type: WorldEventType;
  title: string;
  description: string;
  startedAt: number;
  endsAt: number;
}

export interface KeybindingsConfig {
  digOrFire: string;
  attack: string;
  boat: string;
  radar: string;
  ability: string;
  fish: string;
  stance: string;
  repair: string;
  chat: string;
  voiceMute: string;
  map: string;
  shop: string;
  kingdom: string;
  journal: string;
  reload: string;
  switchWeapon: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface PalmTree {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  frondCount: number;
  swayOffset: number;
  hasCoconuts: boolean;
}

export interface RockProp {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  points: Vec2[];
}

export type LandmarkType =
  | 'TEMPLE'
  | 'TOWER'
  | 'VILLAGE'
  | 'BASTION'
  | 'CAMP'
  | 'OBELISK'
  | 'RUINS'
  | 'SHIPWRECK'
  | 'LIGHTHOUSE'
  | 'TRADING_POST'
  | 'SEA_ARCH'
  | 'CITY_PLAZA'
  | 'TAVERN'
  | 'FOUNTAIN'
  | 'ARENA_RING'
  | 'CAVE_ENTRANCE'
  | 'SECRET_SHRINE';

export type SpecialZoneType = 'CITY' | 'ARENA' | 'SECRET';

export type CaveTheme =
  | 'CRYSTAL_GROTTO'
  | 'VOLCANIC_CALDERA'
  | 'SMUGGLER_COVE'
  | 'ANCIENT_TOMB'
  | 'FUNGAL_ABYSS';

export interface CaveEntrance {
  id: string;
  islandId: string;
  x: number;
  y: number;
  name: string;
  tier: 1 | 2 | 3;
  theme?: CaveTheme;
  biome?: IslandBiome;
}

export type CaveEnemyKind =
  | 'CRAB'
  | 'BAT'
  | 'SCORPION'
  | 'SPIDER'
  | 'CRYSTAL_GOLEM'
  | 'LAVA_ELEMENTAL'
  | 'TOMB_GUARDIAN';

export interface CaveEnemy {
  id: string;
  kind: CaveEnemyKind;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  isBoss?: boolean;
  lastAttackTime: number;
  hitFlashTime: number;
  walkPhase: number;
  homePos: Vec2;
  goldBounty: number;
}

export interface CaveChest {
  id: string;
  x: number;
  y: number;
  goldValue: number;
  tier: 'NORMAL' | 'BOSS';
  opened: boolean;
}

export interface CaveWeaponAltar {
  id: string;
  x: number;
  y: number;
  weaponId: WeaponId;
  claimed: boolean;
}

export interface CaveChamber {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rockPoly: Vec2[];
  kind?: 'ENTRY' | 'HUB' | 'ALCOVE' | 'BOSS';
}

export interface CaveWallPillar {
  x: number;
  y: number;
  radius: number;
  jaggedPoly?: Vec2[];
}

export interface CaveCorridor {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface CavePool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  kind: 'WATER' | 'LAVA' | 'SPORE';
  points?: Vec2[];
}

export interface CaveBridge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  material: 'WOOD' | 'STONE';
}

export interface CaveProp {
  x: number;
  y: number;
  kind: 'MUSHROOM' | 'CRATE' | 'RUNE_CIRCLE' | 'BONES' | 'SHIP_RIB' | 'STALAGMITE';
  size: number;
  angle: number;
  color: string;
}

export interface CaveInterior {
  caveId: string;
  islandId: string;
  name: string;
  tier: 1 | 2 | 3;
  theme: CaveTheme;
  width: number;
  height: number;
  chambers: CaveChamber[];
  corridors: CaveCorridor[];
  pillars: CaveWallPillar[];
  pools: CavePool[];
  bridges: CaveBridge[];
  props: CaveProp[];
  crystals: Array<{ x: number; y: number; size: number; color: string; angle: number }>;
  torches: Array<{ x: number; y: number; phase: number; color?: string }>;
  entryPos: Vec2;
  exitPos: Vec2;
  chests: CaveChest[];
  weaponAltar: CaveWeaponAltar | null;
  enemies: CaveEnemy[];
}

export interface ActiveCaveState {
  cave: CaveInterior;
  returnX: number;
  returnY: number;
  islandId: string;
  islandName: string;
  playerX: number;
  playerY: number;
  playerAngle: number;
  cameraX: number;
  cameraY: number;
  bossDefeated: boolean;
}

export interface MapWaypoint {
  x: number;
  y: number;
  label: string;
}

export type IslandBiome =
  | 'TROPICAL'
  | 'JUNGLE'
  | 'OASIS'
  | 'VOLCANIC'
  | 'RUINS'
  | 'CORAL_REEF'
  | 'DARK_LAGOON';

export type PetId = 'PARROT' | 'MONKEY' | 'TURTLE';

export type ArmyStance = 'FOLLOW' | 'CHARGE' | 'DEFEND';

export interface ResourceNode {
  id: string;
  islandId: string;
  kind: 'WOOD' | 'IRON';
  x: number;
  y: number;
  amount: number;
}

export interface SeaHazard {
  id: string;
  kind: 'MINE' | 'BARREL';
  x: number;
  y: number;
  radius: number;
  bobOffset: number;
}

export interface InlandLake {
  x: number;
  y: number;
  radius: number;
  points: Vec2[];
  isVolcanicCrater?: boolean;
}

export interface IslandRoad {
  from: Vec2;
  to: Vec2;
  ctrl: Vec2;
}

export interface IslandFoliage {
  x: number;
  y: number;
  radius: number;
  kind: 'FERN' | 'FLOWERS' | 'CRATE_PILE';
  color: string;
  rotation: number;
}

export interface Landmark {
  id: string;
  type: LandmarkType;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  /** Sub-huts for village cluster or tents for war camp */
  subOffsets?: Array<{ dx: number; dy: number; rot: number; scale: number }>;
}

export type WeaponId =
  | 'CUTLASS'
  | 'PISTOL'
  | 'MUSKET'
  | 'DUAL_PISTOL'
  | 'OBSIDIAN_BLADE'
  | 'CRYSTAL_BLUNDERBUSS'
  | 'ANCIENT_HARPOON'
  | 'SHADOW_SCYTHE'
  | 'MAGMA_CANNON'
  | 'STORM_TRIDENT'
  | 'PHANTOM_REPEATER';

export interface WeaponPickup {
  id: string;
  islandId: string;
  x: number;
  y: number;
  weaponId: WeaponId;
}

export interface IslandEnemySpawn {
  id: string;
  islandId: string;
  factionId: FactionId;
  squadId: string | null;
  squadColor: string;
  role: 'LEADER' | 'FLANKER' | 'SOLO';
  combatStyle: 'MELEE' | 'RANGED';
  x: number;
  y: number;
  formationOffset: Vec2;
  tier: 1 | 2 | 3;
}

export interface IslandEnemy extends IslandEnemySpawn {
  angle: number;
  hp: number;
  maxHp: number;
  alerted: boolean;
  lastAttackTime: number;
  hitFlashTime: number;
  walkPhase: number;
  patrolCenter: Vec2;
  patrolAngle: number;
  attackSwingTime: number;
  aiNextScanTime?: number;
  cachedTargetKind?: 'PLAYER' | 'ALLY_SOLDIER' | 'RIVAL_ENEMY';
  cachedTargetAlly?: AllySoldier | null;
  cachedTargetRival?: IslandEnemy | null;
}

export interface AllySoldierRosterItem {
  id: string;
  type: SoldierType;
  hp: number;
  maxHp: number;
}

export interface AllySoldier extends AllySoldierRosterItem {
  x: number;
  y: number;
  angle: number;
  lastAttackTime: number;
  hitFlashTime: number;
  walkPhase: number;
  attackSwingTime: number;
  roamTarget?: Vec2;
  roamWaitUntil?: number;
  personalSpeedMult?: number;
  wanderSeed?: number;
  aiNextScanTime?: number;
  cachedTarget?: IslandEnemy | null;
}

export interface AllyShip {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  lastFireTime: number;
  hitFlashTime: number;
  slotIndex: number;
  patrolTarget?: Vec2;
  nextDecisionTime?: number;
  cruiseSpeedMult?: number;
  orbitSign?: 1 | -1;
  aiNextScanTime?: number;
  cachedTarget?: EnemyShip | null;
}

export interface LandProjectile {
  id: string;
  owner: 'PLAYER' | 'ENEMY';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  life: number;
  splashRadius?: number;
}

export type TreasureRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface TreasureTemplate {
  name: string;
  rarity: TreasureRarity;
  baseValue: number;
  color: string;
}

export interface TreasureSpot {
  id: string;
  islandId: string;
  x: number;
  y: number;
  template: TreasureTemplate;
}

export interface TraderDock {
  x: number;
  y: number;
  angle: number;
}

export interface Island {
  id: string;
  sectorX: number;
  sectorY: number;
  name: string;
  biome: IslandBiome;
  centerX: number;
  centerY: number;
  baseRadius: number;
  maxRadius: number;
  isLarge: boolean;
  factionId: FactionId;
  fortPos: Vec2 | null;
  radialProfile: number[];
  coastPoints: Vec2[];
  grassPoints: Vec2[];
  lakes: InlandLake[];
  roads: IslandRoad[];
  foliage: IslandFoliage[];
  palms: PalmTree[];
  rocks: RockProp[];
  landmarks: Landmark[];
  weaponPickups: WeaponPickup[];
  resourceNodes: ResourceNode[];
  enemySpawns: IslandEnemySpawn[];
  treasures: TreasureSpot[];
  traderDock: TraderDock | null;
  isStarter: boolean;
  specialZone?: SpecialZoneType | null;
  isSecret?: boolean;
  caves?: CaveEntrance[];
  arenaCenter?: Vec2 | null;
}

export interface DigCrater {
  id: string;
  islandId: string;
  x: number;
  y: number;
  radius: number;
  depth: number;
  rotation: number;
  foundTreasure: boolean;
}

export interface BagItem {
  uid: string;
  name: string;
  rarity: TreasureRarity;
  value: number;
  color: string;
  islandName: string;
}

export interface Upgrades {
  shovelLevel: number;
  boatLevel: number;
  radarLevel: number;
  luckLevel: number;
  cannonLevel: number;
  hullPlatingLevel?: number;
  crewSkillLevel?: number;
  repairShellsLevel?: number;
}

export interface KingdomState {
  founded: boolean;
  name: string;
  bannerColor: string;
  armyLevel: number;
  conqueredIslandIds: string[];
  islandOwners: Record<string, FactionId>;
  atWarWith: EnemyFactionId[];
  soldiers: AllySoldierRosterItem[];
  escortShipCount: number;
}

export type TouchButtonId =
  | 'digOrFire'
  | 'boatOrInteract'
  | 'attack'
  | 'radar'
  | 'ability'
  | 'fish'
  | 'stance'
  | 'repair'
  | 'joystick'
  | 'minimap'
  | 'weaponPanel';

export interface TouchButtonTransform {
  dx: number;
  dy: number;
  scale?: number;
  opacity?: number;
}

export type TouchLayoutConfig = Partial<Record<TouchButtonId, TouchButtonTransform>>;

export interface GameSettings {
  soundEnabled: boolean;
  ambientEnabled: boolean;
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  autoFullscreen: boolean;
  joystickMode: 'FIXED' | 'DYNAMIC';
  showWaves: boolean;
  touchControls: 'AUTO' | 'ALWAYS' | 'HIDDEN';
  touchLayout?: TouchLayoutConfig;
  desktopShowActionBar: boolean;
  desktopShowSettingsButton: boolean;
  desktopShowHudButtons: boolean;
  colorblindMode: boolean;
  screenShakeIntensity: number;
  showTutorialHints: boolean;
  language: 'tr' | 'en';
  keybindings: KeybindingsConfig;
}

export interface RadarReading {
  heat: HeatTier;
  label: string;
  distance: number | null;
  angle: number | null;
  timestamp: number;
}

export interface RadarPulseEffect {
  x: number;
  y: number;
  startTime: number;
  maxRadius: number;
  heat: HeatTier;
  targetAngle: number | null;
  showDirection: boolean;
}

export interface Particle {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'SAND' | 'WATER' | 'GOLD' | 'WAKE' | 'SMOKE' | 'SPLINTER' | 'MUZZLE' | 'SPARK';
}

export interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export interface EnemyShip {
  id: string;
  name: string;
  factionId: EnemyFactionId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  hp: number;
  maxHp: number;
  lastFireTime: number;
  hitFlashTime: number;
  patrolAngle: number;
  broadsideSign: 1 | -1;
  goldBounty: number;
  tier: 1 | 2 | 3;
  isEventBoss?: boolean;
  isHealer?: boolean;
  lastSelfRepairTime?: number;
}

export interface Cannonball {
  id: string;
  owner: 'PLAYER' | EnemyFactionId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
}

export interface FloatingLoot {
  id: string;
  x: number;
  y: number;
  goldValue: number;
  healHp?: number;
  kind?: 'CHEST' | 'CASTAWAY_MAP';
  bobOffset: number;
  life: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface SaveData {
  version: number;
  worldSeed: number;
  gold: number;
  totalGoldEarned: number;
  treasuresFoundCount: number;
  enemiesSunkCount: number;
  landEnemiesDefeated: number;
  boatHp: number;
  playerHp: number;
  equippedWeapon: WeaponId | null;
  weaponSlots?: WeaponId[];
  unlockedWeapons: WeaponId[];
  collectedPickupIds: string[];
  bag: BagItem[];
  upgrades: Upgrades;
  kingdom: KingdomState;
  dugCraters: DigCrater[];
  openedTreasureIds: string[];
  discoveredIslandIds: string[];
  playTimeSec?: number;
  worldTimeSec?: number;
  collectedRelicIds?: string[];
  claimedMilestoneIds?: string[];
  unlockedAchievementIds?: string[];
  tutorialCompleted?: string[];
  stormsSurvivedCount?: number;
  wood?: number;
  iron?: number;
  repairKits?: number;
  caughtFishCount?: number;
  ownedPets?: PetId[];
  activePet?: PetId | null;
  armyStance?: ArmyStance;
  fortTurretIslandIds?: string[];
  harvestedNodeIds?: string[];
  discoveredLogIds?: string[];
  soldiersLostCount?: number;
  shipsLostCount?: number;
  conquestHistory?: Array<{ islandName: string; factionName: string; dayNumber: number }>;
  openedCaveChestIds?: string[];
  clearedCaveIds?: string[];
  arenaWinsCount?: number;
  cavesExploredCount?: number;
  mapPin?: MapWaypoint | null;
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
}
