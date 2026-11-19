import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CloudLightning,
  Heart,
  HelpCircle,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Move,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  Volume2,
  X as XIcon,
} from 'lucide-react';
import {
  ActiveCaveState,
  ActiveModal,
  ActiveWorldEvent,
  AllyShip,
  AllySoldier,
  ArmyStance,
  Cannonball,
  CaveChest,
  CaveEntrance,
  DigCrater,
  EnemyFactionId,
  EnemyShip,
  FactionId,
  FloatingLoot,
  FloatingText,
  GamePhase,
  GameSettings,
  HeatTier,
  Island,
  IslandEnemy,
  LandProjectile,
  Particle,
  PetId,
  RadarPulseEffect,
  RadarReading,
  SaveData,
  SeaHazard,
  SoldierType,
  TouchButtonId,
  TouchButtonTransform,
  TouchLayoutConfig,
  Vec2,
  WaterRipple,
  WeaponId,
} from './types/game';
import {
  clearSaveData,
  createInitialSave,
  loadFromSlot,
  loadSaveData,
  loadSettings,
  normalizeSaveData,
  persistSaveData,
  persistSettings,
  saveToSlot,
} from './engine/storage';
import {
  generateIslandGarrison,
  getIslandRadiusAtAngle,
  isPointOnIsland,
  WorldManager,
} from './engine/worldGen';
import {
  getCannonCooldownMs,
  getCannonCountPerSide,
  getCannonDamage,
  getCrewSkillBonuses,
  getDamageReductionRatio,
  getDigCooldownMs,
  getDigRadius,
  getMaxBoatHp,
  getRadarCooldownMs,
  getRepairShellHealRatio,
  getShipClass,
  getUpgradeCost,
  getValueMultiplier,
  UPGRADE_DEFS,
  UpgradeKey,
} from './engine/upgrades';
import {
  ENEMY_FACTIONS,
  ENEMY_FACTION_LIST,
  ESCORT_SHIP_STATS,
  getArmyUpgradeCost,
  getEffectiveIslandFaction,
  getEnemyShipSpec,
  getIslandArmyStats,
  getSoldierPowerMultiplier,
  KINGDOM_COSTS,
  MAX_ARMY_LEVEL,
  SOLDIER_SPECS,
} from './engine/factions';
import { applyWeaponAcquire, normalizeWeaponSlots, WEAPONS } from './engine/weapons';
import {
  ACHIEVEMENTS,
  CAMPAIGN_MILESTONES,
  CampaignStatsInput,
  CAPTAIN_LOGS,
  getCaptainLogBonuses,
  getRelicSetBonuses,
  PET_DEFS,
  RELIC_DEFS,
  rollCatchFish,
  TUTORIAL_STEPS,
} from './engine/progression';
import { createWorldEvent, getWorldCycleInfo } from './engine/worldEvents';
import { clearRenderCaches, renderGameFrame } from './engine/renderer';
import { generateCaveInterior, isPointInsideCaveWalkable, resolveCaveCollision } from './engine/caves';
import { renderCaveFrame } from './engine/caveRenderer';
import { SpatialGrid } from './engine/spatialGrid';
import { PerformanceGovernor } from './engine/perfGovernor';
import { soundEngine } from './engine/audio';
import { clamp, dist, lerp, lerpAngle } from './utils/prng';
import {
  exitAppFullscreen,
  isCurrentlyFullscreen,
  requestAppFullscreen,
} from './utils/fullscreen';
import {
  OnlineChatMessage,
  OnlineConnectionStatus,
  OnlineModeRule,
  OnlineProjectileSnapshot,
  OnlineRoomInfo,
  OnlineWorldEvent,
  PlayerIdentity,
  PlayerProfileLedger,
  RemoteEscortShipSnapshot,
  RemotePlayerSnapshot,
  RemotePlayerView,
  RemoteSoldierSnapshot,
  StarterSlot,
  VoicePeerInfo,
} from './types/online';
import { loadPlayerIdentity, savePlayerIdentity } from './engine/onlineStorage';
import { OnlineSessionManager } from './engine/onlineNetwork';
import { VoiceChatManager, VoiceStateSnapshot } from './engine/voiceChat';
import { VirtualJoystick } from './components/VirtualJoystick';
import { ActionControls, ActionControlsDisplayMode } from './components/ActionControls';
import { TopRightHud } from './components/TopRightHud';
import { MiniMap, MiniMapLiveSnapshot } from './components/MiniMap';
import { MapModal } from './components/MapModal';
import { ShopModal } from './components/ShopModal';
import { KingdomModal } from './components/KingdomModal';
import { formatKeyCode, SettingsModal } from './components/SettingsModal';
import { JournalModal } from './components/JournalModal';
import { TitleOverlay } from './components/TitleOverlay';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { WeaponHudPanel } from './components/WeaponHudPanel';
import {
  ActionButtonKey,
  ALL_ACTION_BUTTON_KEYS,
  computeUnifiedHudLayout,
  resolveDraggedTouchTransform,
} from './utils/hudLayout';

const PLAYER_SPEED = 175;
const MAX_PLAYER_HP = 100;
const ABILITY_BASE_COOLDOWN_MS = 18000;
const ENEMY_NAMES = ['Kızıl Kanca', 'Kara Fırtına', 'Gölge Pruva', 'Demir Borda', 'Korsan Yelkenci'];

function buildInitialSoldiers(save: SaveData): AllySoldier[] {
  return save.kingdom.soldiers.map((s, idx) => {
    const a = (idx / Math.max(1, save.kingdom.soldiers.length)) * Math.PI * 2 + Math.random() * 0.4;
    const rad = 32 + Math.random() * 64;
    return {
      ...s,
      x: save.player.x + Math.cos(a) * rad,
      y: save.player.y + Math.sin(a) * rad,
      angle: Math.random() * Math.PI * 2,
      lastAttackTime: 0,
      hitFlashTime: -1000,
      walkPhase: idx * 0.8,
      attackSwingTime: 0,
      roamWaitUntil: 0,
      personalSpeedMult: 0.86 + Math.random() * 0.28,
      wanderSeed: Math.random() * 1000,
    };
  });
}

function buildInitialEscortShips(save: SaveData): AllyShip[] {
  const count = save.kingdom.escortShipCount;
  const ships: AllyShip[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 190 + Math.random() * 240;
    ships.push({
      id: `ally_ship_${i}_${save.worldSeed}`,
      name: `Korvet ${i + 1}`,
      x: save.boat.x + Math.cos(a) * d,
      y: save.boat.y + Math.sin(a) * d,
      angle: a + Math.PI * 0.5,
      hp: ESCORT_SHIP_STATS.maxHp,
      maxHp: ESCORT_SHIP_STATS.maxHp,
      lastFireTime: 0,
      hitFlashTime: -1000,
      slotIndex: i,
      nextDecisionTime: 0,
      cruiseSpeedMult: 0.86 + Math.random() * 0.28,
      orbitSign: i % 2 === 0 ? 1 : -1,
    });
  }
  return ships;
}

export default function App() {
  const inviteRoomCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() || '';
  }, []);

  const initialSave = useMemo(() => loadSaveData(), []);
  const [hasSavedProgress, setHasSavedProgress] = useState<boolean>(Boolean(initialSave));
  const [save, setSave] = useState<SaveData>(() => initialSave ?? createInitialSave());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [activeModal, setActiveModal] = useState<ActiveModal>('NONE');
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissPortraitHint, setDismissPortraitHint] = useState<boolean>(false);

  // Online P2P Multiplayer State
  const [identity, setIdentity] = useState<PlayerIdentity>(() => loadPlayerIdentity());
  const [showOnlineLobby, setShowOnlineLobby] = useState<boolean>(() => Boolean(inviteRoomCode));
  const [onlineActive, setOnlineActive] = useState<boolean>(false);
  const [onlineStatus, setOnlineStatus] = useState<OnlineConnectionStatus>('IDLE');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<'HOST' | 'CLIENT' | null>(null);
  const [onlineRoomInfo, setOnlineRoomInfo] = useState<OnlineRoomInfo | null>(null);
  const [onlineLobbyPlayers, setOnlineLobbyPlayers] = useState<RemotePlayerSnapshot[]>([]);
  const [onlineStarterSlots, setOnlineStarterSlots] = useState<StarterSlot[]>([]);
  const [onlineIslandOwners, setOnlineIslandOwners] = useState<Record<string, string>>({});
  const [onlineWarDeclarations, setOnlineWarDeclarations] = useState<Record<string, string[]>>({});
  const [onlinePing, setOnlinePing] = useState<number | null>(null);
  const [onlineChat, setOnlineChat] = useState<OnlineChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const voiceManagerRef = useRef<VoiceChatManager | null>(null);
  const voicePeersRef = useRef<VoicePeerInfo[]>([]);
  const lastVoiceProxUpdateRef = useRef<number>(0);
  const [voicePeersCount, setVoicePeersCount] = useState<number>(0);
  const [voiceState, setVoiceState] = useState<VoiceStateSnapshot>({
    enabled: false,
    muted: false,
    mode: 'PROXIMITY',
    connecting: false,
    error: null,
    activeSpeakerIds: [],
    connectedVoicePeerCount: 0,
  });
  const activeEmotesRef = useRef<
    Array<{ targetId: string; emote: string; startedAt: number; expiresAt: number }>
  >([]);
  const [isCoarseDevice, setIsCoarseDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints > 0 && (window.innerWidth < 768 || window.innerHeight <= 600))
    );
  });
  const isCoarseDeviceRef = useRef<boolean>(isCoarseDevice);
  const [viewport, setViewport] = useState<{ vw: number; vh: number }>(() => {
    if (typeof window === 'undefined') return { vw: 1024, vh: 768 };
    return {
      vw: Math.round(window.visualViewport?.width ?? window.innerWidth),
      vh: Math.round(window.visualViewport?.height ?? window.innerHeight),
    };
  });
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640 || window.innerHeight < 500;
  });
  const [isShortViewport, setIsShortViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight < 540;
  });
  const [draftTouchLayout, setDraftTouchLayout] = useState<TouchLayoutConfig>({});
  const [selectedTouchButton, setSelectedTouchButton] = useState<TouchButtonId | null>(null);

  const [hudState, setHudState] = useState({
    canBoard: false,
    canDisembark: false,
    canDig: true,
    nearDock: false,
    isSailing: save.player.isSailing,
    shipClassName: getShipClass(save.upgrades.boatLevel).name,
    boatHp: save.boatHp,
    maxBoatHp: getMaxBoatHp(save.upgrades.boatLevel),
    playerHp: save.playerHp,
    equippedWeapon: save.equippedWeapon as WeaponId | null,
    weaponSlots: (save.weaponSlots ?? []) as WeaponId[],
    activeAmmo: (save.equippedWeapon && WEAPONS[save.equippedWeapon]?.magSize
      ? WEAPONS[save.equippedWeapon]?.magSize ?? null
      : null) as number | null,
    activeMaxAmmo: (save.equippedWeapon && WEAPONS[save.equippedWeapon]?.magSize
      ? WEAPONS[save.equippedWeapon]?.magSize ?? null
      : null) as number | null,
    isReloading: false,
    reloadProgress: 0,
    nearbyEnemyCount: 0,
    currentIslandName: 'Başlangıç Limanı' as string | null,
    digCooldownPct: 0,
    cannonCooldownPct: 0,
    attackCooldownPct: 0,
    radarCooldownPct: 0,
    abilityCooldownPct: 0,
    cycleLabel: 'Gün 1 · İlkbahar · Gündüz',
    canFish: false,
    isFishing: false,
    fishingBite: false,
    repairKits: save.repairKits ?? 1,
    armyStance: (save.armyStance ?? 'CHARGE') as ArmyStance,
    interactLabel: null as string | null,
    zoneBanner: null as { label: string; tone: 'CITY' | 'ARENA' | 'SECRET' | 'CAVE' } | null,
    arenaWaveText: null as string | null,
  });
  const [lastRadar, setLastRadar] = useState<RadarReading | null>(null);
  const [activeWorldEvent, setActiveWorldEvent] = useState<ActiveWorldEvent | null>(null);
  const activeWorldEventRef = useRef<ActiveWorldEvent | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveRef = useRef<SaveData>(save);
  const settingsRef = useRef<GameSettings>(settings);
  const phaseRef = useRef<GamePhase>(phase);
  const modalRef = useRef<ActiveModal>(activeModal);
  const hasTouchControlsRef = useRef<boolean>(false);
  const identityRef = useRef<PlayerIdentity>(identity);
  const onlineActiveRef = useRef<boolean>(false);
  const onlineManagerRef = useRef<OnlineSessionManager | null>(null);
  const onlineRoomInfoRef = useRef<OnlineRoomInfo | null>(null);
  const onlineIslandOwnersRef = useRef<Record<string, string>>({});
  const onlineOwnersForRenderRef = useRef<
    Record<string, { shortName: string; color: string; isCapturable?: boolean }> | undefined
  >(undefined);
  const onlineWarDeclarationsRef = useRef<Record<string, string[]>>({});
  const onlineAtWarSetRef = useRef<Set<string>>(new Set());
  const remotePlayersRef = useRef<Map<string, RemotePlayerView>>(new Map());
  const onlineProjectilesRef = useRef<OnlineProjectileSnapshot[]>([]);
  const lastPoseSendRef = useRef<number>(0);
  const lastArmyPoseSendRef = useRef<number>(0);
  const lastRosterUiSyncRef = useRef<number>(0);
  const lastClaimSentRef = useRef<{ islandId: string; at: number }>({ islandId: '', at: 0 });

  const worldManagerRef = useRef<WorldManager>(
    new WorldManager(save.worldSeed, save.upgrades.luckLevel)
  );
  const openedTreasureSetRef = useRef<Set<string>>(new Set(save.openedTreasureIds));
  const collectedPickupSetRef = useRef<Set<string>>(new Set(save.collectedPickupIds));
  const enemyCombatGridRef = useRef<SpatialGrid<IslandEnemy>>(new SpatialGrid<IslandEnemy>(240));
  const allyCombatGridRef = useRef<SpatialGrid<AllySoldier>>(new SpatialGrid<AllySoldier>(240));
  const enemySepGridRef = useRef<SpatialGrid<IslandEnemy>>(new SpatialGrid<IslandEnemy>(44));
  const allySepGridRef = useRef<SpatialGrid<AllySoldier>>(new SpatialGrid<AllySoldier>(44));
  const enemyShipGridRef = useRef<SpatialGrid<EnemyShip>>(new SpatialGrid<EnemyShip>(260));
  const allyShipGridRef = useRef<SpatialGrid<AllyShip>>(new SpatialGrid<AllyShip>(260));
  const enemyQueryBufRef = useRef<IslandEnemy[]>([]);
  const allyQueryBufRef = useRef<AllySoldier[]>([]);
  const enemyShipQueryBufRef = useRef<EnemyShip[]>([]);
  const allyShipQueryBufRef = useRef<AllyShip[]>([]);
  const perfGovRef = useRef<PerformanceGovernor>(new PerformanceGovernor());
  const pendingSyncRef = useRef({
    rosterDirty: false,
    shipCountDirty: false,
    landKills: 0,
    seaKills: 0,
    soldiersLost: 0,
    shipsLost: 0,
    lastSyncAt: 0,
  });

  const simRef = useRef({
    playerX: save.player.x,
    playerY: save.player.y,
    playerAngle: save.player.angle,
    playerHp: save.playerHp,
    playerHitFlashUntil: 0,
    isSailing: save.player.isSailing,
    boatX: save.boat.x,
    boatY: save.boat.y,
    boatVx: 0,
    boatVy: 0,
    boatAngle: save.boat.angle,
    boatHp: save.boatHp,
    boatHitFlashUntil: 0,
    boatSpeedRatio: 0,
    walkPhase: 0,
    digAnimStart: 0,
    attackAnimStart: 0,
    lastDigTime: 0,
    lastCannonTime: 0,
    lastAttackTime: 0,
    lastRadarTime: 0,
    lastAbilityTime: -30000,
    abilityAuraUntilMs: 0,
    lastPassiveRegenTime: 0,
    nextWorldEventTime: performance.now() + 34000,
    cameraX: save.player.isSailing ? save.boat.x : save.player.x,
    cameraY: save.player.isSailing ? save.boat.y : save.player.y,
    zoom: 1,
    screenShake: 0,
    joystickVec: { x: 0, y: 0 } as Vec2,
    keys: new Set<string>(),
    enemies: [] as EnemyShip[],
    allyShips: buildInitialEscortShips(save),
    islandEnemies: [] as IslandEnemy[],
    allySoldiers: buildInitialSoldiers(save),
    spawnedIslandIds: new Set<string>(),
    spawnedFactionByIsland: new Map<string, FactionId>(),
    landProjectiles: [] as LandProjectile[],
    cannonballs: [] as Cannonball[],
    floatingLoot: [] as FloatingLoot[],
    waterRipples: [] as WaterRipple[],
    nextEnemySpawnTime: performance.now() + 7000,
    nextCampaignTime: performance.now() + 26000,
    radarPulses: [] as RadarPulseEffect[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    fortCapture: null as {
      islandId: string;
      progress: number;
      defendersLeft: number;
      wallHp?: number;
      maxWallHp?: number;
    } | null,
    fortWallsHpByIsland: new Map<string, { hp: number; maxHp: number }>(),
    lastTributeTime: performance.now(),
    lastWakeTime: 0,
    lastSoldierSfxTime: 0,
    lastCannonSfxTime: 0,
    lastAutoSaveTime: performance.now(),
    worldTimeSec: save.worldTimeSec ?? 36,
    playTimeSec: save.playTimeSec ?? 0,
    hazards: [] as SeaHazard[],
    harvestedNodeIds: new Set<string>(save.harvestedNodeIds ?? []),
    fortTurretFireTimes: new Map<string, number>(),
    fishing: {
      active: false,
      x: 0,
      y: 0,
      bite: false,
      biteAt: 0,
      expireAt: 0,
    },
    activeCave: null as ActiveCaveState | null,
    arenaChallenge: null as {
      active: boolean;
      islandId: string;
      centerX: number;
      centerY: number;
      wave: number;
      totalWaves: number;
    } | null,
  });
  const sentOnlineAchRef = useRef<Set<string>>(new Set());
  const weaponAmmoRef = useRef<Partial<Record<WeaponId, number>>>({});
  const reloadStateRef = useRef<{
    weaponId: WeaponId;
    startedAt: number;
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    saveRef.current = save;
    worldManagerRef.current.setSeed(save.worldSeed);
    worldManagerRef.current.setLuckLevel(save.upgrades.luckLevel);
    openedTreasureSetRef.current = new Set(save.openedTreasureIds);
    collectedPickupSetRef.current = new Set(save.collectedPickupIds);
  }, [save]);

  useEffect(() => {
    identityRef.current = identity;
    savePlayerIdentity(identity);
  }, [identity]);

  useEffect(() => {
    onlineRoomInfoRef.current = onlineRoomInfo;
  }, [onlineRoomInfo]);

  useEffect(() => {
    onlineIslandOwnersRef.current = onlineIslandOwners;
  }, [onlineIslandOwners]);

  useEffect(() => {
    onlineWarDeclarationsRef.current = onlineWarDeclarations;
    const nextWarSet = new Set<string>();
    const selfId = identity.playerId;
    if (onlineRoomInfo?.rule === 'PVP') {
      const myDecls = onlineWarDeclarations[selfId] ?? [];
      for (const otherId of myDecls) {
        if (onlineWarDeclarations[otherId]?.includes(selfId)) {
          nextWarSet.add(otherId);
        }
      }
    }
    onlineAtWarSetRef.current = nextWarSet;
  }, [onlineWarDeclarations, onlineRoomInfo?.rule, identity.playerId]);

  const sessionFullscreenHandledRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    soundEngine.setEnabled(settings.soundEnabled);
    soundEngine.setAmbientEnabled(settings.ambientEnabled);
    soundEngine.setVolumes(
      settings.masterVolume,
      settings.sfxVolume,
      settings.ambientVolume
    );
    persistSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!settings.autoFullscreen) {
      sessionFullscreenHandledRef.current = true;
      void exitAppFullscreen();
      return;
    }

    if (sessionFullscreenHandledRef.current || isCurrentlyFullscreen()) {
      return;
    }

    let cleanedUp = false;
    void requestAppFullscreen().then((entered) => {
      if (!cleanedUp && entered) {
        sessionFullscreenHandledRef.current = true;
      }
    });

    const handleFirstGesture = () => {
      if (sessionFullscreenHandledRef.current || !settingsRef.current.autoFullscreen) {
        cleanup();
        return;
      }
      sessionFullscreenHandledRef.current = true;
      void requestAppFullscreen();
      cleanup();
    };

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener('pointerdown', handleFirstGesture, true);
      window.removeEventListener('keydown', handleFirstGesture, true);
    };

    window.addEventListener('pointerdown', handleFirstGesture, true);
    window.addEventListener('keydown', handleFirstGesture, true);
    return cleanup;
  }, [settings.autoFullscreen]);

  useEffect(() => {
    let lastTouchEndAt = 0;

    const preventIosGesture = (e: Event) => {
      e.preventDefault();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'PLAYING') return;
      if (e.touches.length > 1 && modalRef.current === 'NONE') {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('button, a, input, textarea, select')) {
          e.preventDefault();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (phaseRef.current !== 'PLAYING') return;
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (phaseRef.current !== 'PLAYING') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;

      const now = Date.now();
      if (now - lastTouchEndAt <= 350) {
        // Prevent iOS Safari double-tap-to-zoom while keeping ActionControls/Joystick pointerdown instant
        if (modalRef.current === 'NONE' || target?.tagName === 'CANVAS') {
          e.preventDefault();
        }
      }
      lastTouchEndAt = now;
    };

    const handleDblClick = (e: MouseEvent) => {
      if (phaseRef.current !== 'PLAYING') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      e.preventDefault();
    };

    document.addEventListener('gesturestart', preventIosGesture, { passive: false });
    document.addEventListener('gesturechange', preventIosGesture, { passive: false });
    document.addEventListener('gestureend', preventIosGesture, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('dblclick', handleDblClick, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventIosGesture);
      document.removeEventListener('gesturechange', preventIosGesture);
      document.removeEventListener('gestureend', preventIosGesture);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('dblclick', handleDblClick);
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    modalRef.current = activeModal;
  }, [activeModal]);

  useEffect(() => {
    if (!initialSave) {
      const starter = worldManagerRef.current.getIslandAtSector(0, 0);
      if (starter) {
        const coastR = getIslandRadiusAtAngle(starter, 0.12);
        const safePlayerX = Math.cos(0.12) * (coastR * 0.45);
        const safePlayerY = Math.sin(0.12) * (coastR * 0.45);
        const safeBoatX = Math.cos(0.12) * (coastR + 36);
        const safeBoatY = Math.sin(0.12) * (coastR + 36);

        simRef.current.playerX = safePlayerX;
        simRef.current.playerY = safePlayerY;
        simRef.current.boatX = safeBoatX;
        simRef.current.boatY = safeBoatY;
        simRef.current.cameraX = safePlayerX;
        simRef.current.cameraY = safePlayerY;

        setSave((prev) => ({
          ...prev,
          player: { ...prev.player, x: safePlayerX, y: safePlayerY },
          boat: { ...prev.boat, x: safeBoatX, y: safeBoatY, angle: 0.12 + Math.PI / 2 },
        }));
      }
    }
  }, [initialSave]);

  useEffect(() => {
    const checkViewport = () => {
      const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const vh = Math.round(window.visualViewport?.height ?? window.innerHeight);
      const portrait = vw < 720 && vh > vw;
      setViewport((prev) => (prev.vw === vw && prev.vh === vh ? prev : { vw, vh }));
      setIsPortrait(portrait);
      setIsNarrowViewport(vw < 640 || vh < 500);
      setIsShortViewport(vh < 540);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    window.visualViewport?.addEventListener('resize', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
      window.visualViewport?.removeEventListener('resize', checkViewport);
    };
  }, []);

  useEffect(() => {
    const coarseMql = window.matchMedia('(pointer: coarse)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsCoarseDevice(e.matches);
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setIsCoarseDevice(true);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !coarseMql.matches &&
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      ) {
        setIsCoarseDevice(false);
      }
    };

    coarseMql.addEventListener('change', handleMediaChange);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      coarseMql.removeEventListener('change', handleMediaChange);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    isCoarseDeviceRef.current = isCoarseDevice;
  }, [isCoarseDevice]);

  useEffect(() => {
    const handleVisibilityOrPageShow = () => {
      if (document.visibilityState === 'visible') {
        clearRenderCaches();
      }
    };
    const handlePageShow = () => {
      clearRenderCaches();
    };
    const canvas = canvasRef.current;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      clearRenderCaches();
    };
    const handleContextRestored = () => {
      clearRenderCaches();
    };
    document.addEventListener('visibilitychange', handleVisibilityOrPageShow);
    window.addEventListener('pageshow', handlePageShow);
    canvas?.addEventListener('contextlost', handleContextLost);
    canvas?.addEventListener('contextrestored', handleContextRestored);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrPageShow);
      window.removeEventListener('pageshow', handlePageShow);
      canvas?.removeEventListener('contextlost', handleContextLost);
      canvas?.removeEventListener('contextrestored', handleContextRestored);
    };
  }, []);

  const addFloatingText = useCallback(
    (x: number, y: number, text: string, color: string, priority = true) => {
      const budget = perfGovRef.current.getCurrentBudget();
      if (!priority && budget.skipDamageFloatingTexts) return;
      const list = simRef.current.floatingTexts;
      if (!priority && list.length >= budget.maxFloatingTexts) return;
      if (list.length >= budget.maxFloatingTexts + 10) {
        // Evict oldest text with swap-and-pop
        list[0] = list[list.length - 1];
        list.pop();
      }
      list.push({
        id: `${Date.now()}_${Math.random()}`,
        x,
        y,
        text,
        color,
        life: 1.35,
        maxLife: 1.35,
      });
    },
    []
  );

  const spawnParticles = useCallback(
    (
      x: number,
      y: number,
      count: number,
      color: string,
      type: Particle['type'],
      speed = 90,
      size = 3.5,
      arcZ = false
    ) => {
      const budget = perfGovRef.current.getCurrentBudget();
      const particles = simRef.current.particles;
      const currentLen = particles.length;
      if (currentLen >= budget.maxParticles) return;
      const actualCount =
        currentLen > budget.maxParticles * 0.65
          ? Math.max(1, Math.ceil(count / 3))
          : budget.tier === 'MASS_BATTLE'
          ? Math.max(2, Math.ceil(count / 2))
          : count;
      const allowed = Math.min(actualCount, budget.maxParticles - currentLen);
      for (let i = 0; i < allowed; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        particles.push({
          x,
          y,
          z: arcZ ? 2 + Math.random() * 4 : 0,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          vz: arcZ ? 55 + Math.random() * 75 : 0,
          size: size * (0.7 + Math.random() * 0.6),
          color,
          alpha: 1,
          life: 0.45 + Math.random() * 0.35,
          maxLife: 0.8,
          type,
        });
      }
    },
    []
  );

  const commitSave = useCallback((updater: (prev: SaveData) => SaveData, skipDiskFlush = false) => {
    setSave((prev) => {
      const next = updater(prev);
      if (!onlineActiveRef.current) {
        next.worldTimeSec = simRef.current.worldTimeSec;
        next.playTimeSec = simRef.current.playTimeSec;
      }
      saveRef.current = next;
      if (!skipDiskFlush && !onlineActiveRef.current) {
        persistSaveData(next);
      }
      return next;
    });
  }, []);

  const markTutorialStep = useCallback(
    (stepId: string) => {
      if (onlineActiveRef.current) return;
      const done = saveRef.current.tutorialCompleted ?? [];
      if (done.includes(stepId)) return;
      commitSave((prev) => ({
        ...prev,
        tutorialCompleted: [...(prev.tutorialCompleted ?? []), stepId],
      }));
    },
    [commitSave]
  );

  const profileToSaveData = useCallback(
    (
      prof: PlayerProfileLedger,
      worldSeed: number,
      openedTreasureIds: string[],
      dugCraters: DigCrater[]
    ): SaveData => {
      const weaponState = normalizeWeaponSlots(
        prof.weaponSlots,
        prof.unlockedWeapons,
        prof.equippedWeapon
      );
      return {
      version: 1,
      worldSeed,
      gold: prof.gold,
      totalGoldEarned: prof.totalGoldEarned,
      treasuresFoundCount: prof.treasuresFoundCount,
      enemiesSunkCount: prof.enemiesSunkCount,
      landEnemiesDefeated: prof.landEnemiesDefeated,
      boatHp: prof.boatHp,
      playerHp: prof.playerHp,
      equippedWeapon: weaponState.equippedWeapon,
      weaponSlots: weaponState.weaponSlots,
      unlockedWeapons: weaponState.unlockedWeapons,
      collectedPickupIds: prof.collectedPickupIds,
      bag: prof.bag,
      upgrades: {
        ...prof.upgrades,
        hullPlatingLevel: prof.upgrades.hullPlatingLevel ?? 1,
        crewSkillLevel: prof.upgrades.crewSkillLevel ?? 1,
        repairShellsLevel: prof.upgrades.repairShellsLevel ?? 1,
      },
      kingdom: {
        founded: prof.kingdomFounded,
        name: prof.kingdomName,
        bannerColor: prof.bannerColor,
        armyLevel: prof.armyLevel,
        conqueredIslandIds: prof.conqueredIslandIds,
        escortShipCount: prof.escortShipCount,
        soldiers: prof.soldiers,
        atWarWith: [],
        islandOwners: {},
      },
      openedTreasureIds,
      discoveredIslandIds: prof.discoveredIslandIds,
      dugCraters,
      claimedMilestoneIds: prof.claimedMilestoneIds ?? [],
      unlockedAchievementIds: prof.unlockedAchievementIds ?? [],
      collectedRelicIds: prof.collectedRelicIds ?? [],
      stormsSurvivedCount: prof.stormsSurvivedCount ?? 0,
      wood: prof.wood ?? 0,
      iron: prof.iron ?? 0,
      repairKits: prof.repairKits ?? 1,
      caughtFishCount: prof.caughtFishCount ?? 0,
      ownedPets: prof.ownedPets ?? [],
      activePet: prof.activePet ?? null,
      discoveredLogIds: prof.discoveredLogIds ?? [],
      soldiersLostCount: prof.soldiersLostCount ?? 0,
      shipsLostCount: prof.shipsLostCount ?? 0,
      openedCaveChestIds: prof.openedCaveChestIds ?? [],
      arenaWinsCount: prof.arenaWinsCount ?? 0,
      cavesExploredCount: prof.cavesExploredCount ?? 0,
      conquestHistory: saveRef.current?.conquestHistory ?? [],
      armyStance: saveRef.current?.armyStance ?? 'CHARGE',
      mapPin: saveRef.current?.mapPin ?? null,
      fortTurretIslandIds: [],
      harvestedNodeIds: [],
      player: prof.player,
      boat: prof.boat,
    };
    },
    []
  );

  const applySaveSnapshotToSim = useCallback((nextSave: SaveData, resetWorldEntities: boolean) => {
    const sim = simRef.current;
    sim.playerX = nextSave.player.x;
    sim.playerY = nextSave.player.y;
    sim.playerAngle = nextSave.player.angle;
    sim.playerHp = nextSave.playerHp;
    sim.isSailing = nextSave.player.isSailing;
    sim.boatX = nextSave.boat.x;
    sim.boatY = nextSave.boat.y;
    sim.boatAngle = nextSave.boat.angle;
    sim.boatHp = nextSave.boatHp;
    sim.boatVx = 0;
    sim.boatVy = 0;
    sim.boatSpeedRatio = 0;
    sim.cameraX = nextSave.player.isSailing ? nextSave.boat.x : nextSave.player.x;
    sim.cameraY = nextSave.player.isSailing ? nextSave.boat.y : nextSave.player.y;
    sim.allyShips = buildInitialEscortShips(nextSave);
    sim.allySoldiers = buildInitialSoldiers(nextSave);
    pendingSyncRef.current.rosterDirty = false;
    pendingSyncRef.current.shipCountDirty = false;
    pendingSyncRef.current.landKills = 0;
    pendingSyncRef.current.seaKills = 0;
    pendingSyncRef.current.soldiersLost = 0;
    pendingSyncRef.current.shipsLost = 0;
    pendingSyncRef.current.lastSyncAt = 0;
    sim.worldTimeSec = nextSave.worldTimeSec ?? 36;
    sim.playTimeSec = nextSave.playTimeSec ?? 0;
    sim.harvestedNodeIds = new Set(nextSave.harvestedNodeIds ?? []);
    sim.fishing.active = false;
    sim.activeCave = null;
    sim.arenaChallenge = null;
    sentOnlineAchRef.current.clear();
    if (resetWorldEntities) {
      reloadStateRef.current = null;
      weaponAmmoRef.current = {};
      perfGovRef.current.reset();
      sim.enemies = [];
      sim.islandEnemies = [];
      sim.landProjectiles = [];
      sim.cannonballs = [];
      sim.floatingLoot = [];
      sim.hazards = [];
      sim.waterRipples = [];
      sim.particles = [];
      sim.floatingTexts = [];
      sim.radarPulses = [];
      sim.fortCapture = null;
      sim.fortWallsHpByIsland.clear();
      sim.fortTurretFireTimes.clear();
      sim.spawnedIslandIds.clear();
      sim.spawnedFactionByIsland.clear();
      activeEmotesRef.current = [];
    }
  }, []);

  const ensureOnlineManager = useCallback((): OnlineSessionManager => {
    if (onlineManagerRef.current) return onlineManagerRef.current;

    const mgr = new OnlineSessionManager({
      onStatusChange: (status, errMsg) => {
        setOnlineStatus(status);
        setOnlineError(errMsg ?? null);
        setOnlineRole(mgr.getRole());
      },
      onLobbyUpdate: (roomInfo, players, slots) => {
        setOnlineRoomInfo(roomInfo);
        setOnlineLobbyPlayers(players);
        setOnlineStarterSlots(slots);
        worldManagerRef.current.setOnlineMode(true);
        worldManagerRef.current.setSeed(roomInfo.worldSeed);
        worldManagerRef.current.setStarterSlots(slots);
      },
      onWelcome: (msg) => {
        setOnlineRoomInfo(msg.roomInfo);
        setOnlineStarterSlots(msg.starterSlots);
        setOnlineIslandOwners(msg.islandOwners);
        setOnlineWarDeclarations(msg.warDeclarations ?? {});
        setOnlineLobbyPlayers(msg.players);
        setOnlineRole(mgr.getRole());

        clearRenderCaches();
        worldManagerRef.current.setOnlineMode(true);
        worldManagerRef.current.setSeed(msg.roomInfo.worldSeed);
        worldManagerRef.current.setLuckLevel(msg.yourProfile.upgrades.luckLevel);
        worldManagerRef.current.setStarterSlots(msg.starterSlots);

        const nextSave = profileToSaveData(
          msg.yourProfile,
          msg.roomInfo.worldSeed,
          msg.openedTreasureIds,
          msg.dugCraters
        );
        saveRef.current = nextSave;
        setSave(nextSave);
        applySaveSnapshotToSim(nextSave, true);

        const selfId = identityRef.current.playerId;
        remotePlayersRef.current.clear();
        const now = performance.now();
        for (const p of msg.players) {
          if (p.id === selfId) continue;
          remotePlayersRef.current.set(p.id, {
            ...p,
            targetX: p.x,
            targetY: p.y,
            targetAngle: p.angle,
            targetBoatX: p.boatX,
            targetBoatY: p.boatY,
            targetBoatAngle: p.boatAngle,
            lastSnapshotTime: now,
          });
        }

        if (msg.roomInfo.started) {
          onlineActiveRef.current = true;
          setOnlineActive(true);
          setShowOnlineLobby(false);
          setPhase('PLAYING');
        }
      },
      onGameStarted: (roomInfo, slots) => {
        setOnlineRoomInfo(roomInfo);
        setOnlineStarterSlots(slots);
        worldManagerRef.current.setOnlineMode(true);
        worldManagerRef.current.setSeed(roomInfo.worldSeed);
        worldManagerRef.current.setStarterSlots(slots);
        onlineActiveRef.current = true;
        setOnlineActive(true);
        setShowOnlineLobby(false);
        setPhase('PLAYING');
      },
      onStarterAdded: (slot) => {
        setOnlineStarterSlots((prev) =>
          prev.some((s) => s.playerId === slot.playerId)
            ? prev.map((s) => (s.playerId === slot.playerId ? slot : s))
            : [...prev, slot]
        );
        worldManagerRef.current.addStarterSlot(slot);
        if (slot.playerId !== identityRef.current.playerId) {
          const sim = simRef.current;
          addFloatingText(
            sim.isSailing ? sim.boatX : sim.playerX,
            (sim.isSailing ? sim.boatY : sim.playerY) - 42,
            `${slot.ownerName} Adaya Katıldı!`,
            slot.bannerColor
          );
        }
      },
      onProfileSync: (prof) => {
        const sim = simRef.current;
        const prevSave = saveRef.current;
        const boatLevelUp = prof.upgrades.boatLevel > prevSave.upgrades.boatLevel;
        if (prof.boatHp < sim.boatHp || boatLevelUp) {
          sim.boatHp = prof.boatHp;
        }
        if (prof.playerHp < sim.playerHp) {
          sim.playerHp = prof.playerHp;
        }

        const syncedWeapons = normalizeWeaponSlots(
          prof.weaponSlots,
          prof.unlockedWeapons,
          prof.equippedWeapon
        );
        const nextSave: SaveData = {
          ...prevSave,
          gold: prof.gold,
          totalGoldEarned: prof.totalGoldEarned,
          treasuresFoundCount: prof.treasuresFoundCount,
          enemiesSunkCount: prof.enemiesSunkCount,
          landEnemiesDefeated: prof.landEnemiesDefeated,
          boatHp: Math.round(sim.boatHp),
          playerHp: Math.round(sim.playerHp),
          equippedWeapon: syncedWeapons.equippedWeapon,
          weaponSlots: syncedWeapons.weaponSlots,
          unlockedWeapons: syncedWeapons.unlockedWeapons,
          collectedPickupIds: Array.from(
            new Set([...prevSave.collectedPickupIds, ...prof.collectedPickupIds])
          ),
          bag: prof.bag,
          upgrades: {
            ...prof.upgrades,
            hullPlatingLevel: prof.upgrades.hullPlatingLevel ?? 1,
            crewSkillLevel: prof.upgrades.crewSkillLevel ?? 1,
            repairShellsLevel: prof.upgrades.repairShellsLevel ?? 1,
          },
          discoveredIslandIds: Array.from(
            new Set([...prevSave.discoveredIslandIds, ...prof.discoveredIslandIds])
          ),
          claimedMilestoneIds: prof.claimedMilestoneIds ?? prevSave.claimedMilestoneIds ?? [],
          unlockedAchievementIds:
            prof.unlockedAchievementIds ?? prevSave.unlockedAchievementIds ?? [],
          collectedRelicIds: prof.collectedRelicIds ?? prevSave.collectedRelicIds ?? [],
          stormsSurvivedCount: prof.stormsSurvivedCount ?? prevSave.stormsSurvivedCount ?? 0,
          wood: prof.wood ?? prevSave.wood ?? 0,
          iron: prof.iron ?? prevSave.iron ?? 0,
          repairKits: prof.repairKits ?? prevSave.repairKits ?? 1,
          caughtFishCount: prof.caughtFishCount ?? prevSave.caughtFishCount ?? 0,
          ownedPets: prof.ownedPets ?? prevSave.ownedPets ?? [],
          activePet: prof.activePet !== undefined ? prof.activePet : prevSave.activePet ?? null,
          discoveredLogIds: prof.discoveredLogIds ?? prevSave.discoveredLogIds ?? [],
          soldiersLostCount: prof.soldiersLostCount ?? prevSave.soldiersLostCount ?? 0,
          shipsLostCount: prof.shipsLostCount ?? prevSave.shipsLostCount ?? 0,
          openedCaveChestIds:
            prof.openedCaveChestIds ?? prevSave.openedCaveChestIds ?? [],
          arenaWinsCount: prof.arenaWinsCount ?? prevSave.arenaWinsCount ?? 0,
          cavesExploredCount:
            prof.cavesExploredCount ?? prevSave.cavesExploredCount ?? 0,
          kingdom: {
            ...prevSave.kingdom,
            founded: prof.kingdomFounded,
            name: prof.kingdomName,
            bannerColor: prof.bannerColor,
            armyLevel: prof.armyLevel,
            conqueredIslandIds: prof.conqueredIslandIds,
            escortShipCount: prof.escortShipCount,
            soldiers: prof.soldiers,
          },
        };

        if (sim.allyShips.length !== prof.escortShipCount) {
          const diff = prof.escortShipCount - sim.allyShips.length;
          if (diff > 0) {
            for (let i = 0; i < diff; i++) {
              const slot = sim.allyShips.length;
              const formA = sim.boatAngle + (slot % 2 === 0 ? 2.1 : -2.1) + i * 0.25;
              const ringDist = 95 + Math.floor(slot / 2) * 32;
              sim.allyShips.push({
                id: `oally_${Date.now()}_${slot}_${i}`,
                name: `Korvet ${slot + 1}`,
                x: sim.boatX + Math.cos(formA) * (160 + ringDist),
                y: sim.boatY + Math.sin(formA) * (160 + ringDist),
                angle: Math.random() * Math.PI * 2,
                hp: ESCORT_SHIP_STATS.maxHp,
                maxHp: ESCORT_SHIP_STATS.maxHp,
                lastFireTime: 0,
                hitFlashTime: -1000,
                slotIndex: slot,
                nextDecisionTime: 0,
                cruiseSpeedMult: 0.86 + Math.random() * 0.28,
                orbitSign: slot % 2 === 0 ? 1 : -1,
              });
            }
          } else {
            sim.allyShips = sim.allyShips.slice(0, prof.escortShipCount);
          }
        }

        const nowMs = performance.now();
        const existingMap = new Map<string, AllySoldier>(sim.allySoldiers.map((s) => [s.id, s]));
        let needsRebuild = sim.allySoldiers.length !== prof.soldiers.length;
        if (!needsRebuild) {
          for (let i = 0; i < prof.soldiers.length; i++) {
            const rs = prof.soldiers[i];
            const sol = sim.allySoldiers[i];
            if (!sol || sol.id !== rs.id) {
              needsRebuild = true;
              break;
            }
            if (rs.hp < sol.hp) sol.hitFlashTime = nowMs;
            sol.hp = rs.hp;
            sol.maxHp = rs.maxHp;
          }
        }
        if (needsRebuild) {
          const baseX = sim.isSailing ? sim.boatX : sim.playerX;
          const baseY = sim.isSailing ? sim.boatY : sim.playerY;
          sim.allySoldiers = prof.soldiers.map((rs, idx) => {
            const ex = existingMap.get(rs.id);
            if (ex) {
              return {
                ...ex,
                hp: rs.hp,
                maxHp: rs.maxHp,
                hitFlashTime: rs.hp < ex.hp ? nowMs : ex.hitFlashTime,
              };
            }
            const a = (idx / Math.max(1, prof.soldiers.length)) * Math.PI * 2;
            const r = 24 + Math.random() * 34;
            return {
              ...rs,
              x: baseX + Math.cos(a) * r,
              y: baseY + Math.sin(a) * r,
              angle: sim.playerAngle,
              lastAttackTime: 0,
              hitFlashTime: -1000,
              walkPhase: idx * 0.6,
              attackSwingTime: 0,
            };
          });
        }

        saveRef.current = nextSave;
        setSave(nextSave);
      },
      onSnapshot: (players, projectiles) => {
        const now = performance.now();
        const selfId = identityRef.current.playerId;
        if (
          now - lastRosterUiSyncRef.current >= 950 ||
          modalRef.current === 'MAP' ||
          modalRef.current === 'KINGDOM'
        ) {
          lastRosterUiSyncRef.current = now;
          setOnlineLobbyPlayers((prev) => {
            const selfPose = prev.find((p) => p.id === selfId);
            const merged = [...players];
            if (selfPose) merged.unshift(selfPose);
            return merged;
          });
        }

        const seenIds = new Set<string>();
        for (const p of players) {
          if (p.id === selfId) continue;
          seenIds.add(p.id);
          const existing = remotePlayersRef.current.get(p.id);
          if (existing) {
            existing.name = p.name;
            existing.bannerColor = p.bannerColor;
            existing.kingdomFounded = p.kingdomFounded;
            existing.kingdomName = p.kingdomName;
            existing.targetX = p.x;
            existing.targetY = p.y;
            existing.targetAngle = p.angle;
            existing.targetBoatX = p.boatX;
            existing.targetBoatY = p.boatY;
            existing.targetBoatAngle = p.boatAngle;
            existing.isSailing = p.isSailing;
            existing.boatLevel = p.boatLevel;
            existing.boatHp = p.boatHp;
            existing.maxBoatHp = p.maxBoatHp;
            existing.playerHp = p.playerHp;
            existing.equippedWeapon = p.equippedWeapon;
            existing.speedRatio = p.speedRatio;
            existing.walkPhase = p.walkPhase;
            existing.digAnimProgress = p.digAnimProgress;
            existing.attackAnimProgress = p.attackAnimProgress;
            existing.hitFlash = p.hitFlash;
            existing.connected = p.connected;
            existing.isHost = p.isHost;
            existing.starterSlotIndex = p.starterSlotIndex;
            existing.conqueredCount = p.conqueredCount;
            existing.lastSnapshotTime = now;

            if (p.soldiers) {
              const prevMap = new Map<string, RemoteSoldierSnapshot>(
                (existing.soldiers ?? []).map((s) => [s.id, s])
              );
              const tMap = existing.soldierTargets ?? new Map<string, RemoteSoldierSnapshot>();
              tMap.clear();
              const nextSoldiers: RemoteSoldierSnapshot[] = [];
              for (const rs of p.soldiers) {
                tMap.set(rs.id, rs);
                const prevS = prevMap.get(rs.id);
                nextSoldiers.push(
                  prevS
                    ? {
                        ...rs,
                        x: prevS.x,
                        y: prevS.y,
                        angle: prevS.angle,
                      }
                    : { ...rs }
                );
              }
              existing.soldiers = nextSoldiers;
              existing.soldierTargets = tMap;
            } else {
              existing.soldiers = undefined;
              existing.soldierTargets?.clear();
            }

            if (p.ships) {
              const prevShipMap = new Map<string, RemoteEscortShipSnapshot>(
                (existing.ships ?? []).map((sh) => [sh.id, sh])
              );
              const shMap = existing.shipTargets ?? new Map<string, RemoteEscortShipSnapshot>();
              shMap.clear();
              const nextShips: RemoteEscortShipSnapshot[] = [];
              for (const sh of p.ships) {
                shMap.set(sh.id, sh);
                const prevSh = prevShipMap.get(sh.id);
                nextShips.push(
                  prevSh
                    ? {
                        ...sh,
                        x: prevSh.x,
                        y: prevSh.y,
                        angle: prevSh.angle,
                      }
                    : { ...sh }
                );
              }
              existing.ships = nextShips;
              existing.shipTargets = shMap;
            } else {
              existing.ships = undefined;
              existing.shipTargets?.clear();
            }
          } else {
            const soldierTargets = new Map<string, RemoteSoldierSnapshot>();
            p.soldiers?.forEach((s) => soldierTargets.set(s.id, s));
            const shipTargets = new Map<string, RemoteEscortShipSnapshot>();
            p.ships?.forEach((sh) => shipTargets.set(sh.id, sh));
            remotePlayersRef.current.set(p.id, {
              ...p,
              targetX: p.x,
              targetY: p.y,
              targetAngle: p.angle,
              targetBoatX: p.boatX,
              targetBoatY: p.boatY,
              targetBoatAngle: p.boatAngle,
              lastSnapshotTime: now,
              soldiers: p.soldiers?.map((s) => ({ ...s })),
              ships: p.ships?.map((sh) => ({ ...sh })),
              soldierTargets,
              shipTargets,
            });
          }
        }
        for (const id of remotePlayersRef.current.keys()) {
          if (!seenIds.has(id)) {
            remotePlayersRef.current.delete(id);
          }
        }

        onlineProjectilesRef.current = projectiles.map((pr) => ({ ...pr }));
      },
      onWorldEvent: (evt: OnlineWorldEvent) => {
        const sim = simRef.current;
        const payload = evt.payload;
        if (evt.type === 'crater:dug') {
          const crater = payload.crater as DigCrater | undefined;
          if (crater) {
            setSave((prev) => {
              const exists = prev.dugCraters.some((c) => c.id === crater.id);
              const nextCraters = exists
                ? prev.dugCraters.map((c) => (c.id === crater.id ? crater : c))
                : [...prev.dugCraters.slice(-380), crater];
              const next = { ...prev, dugCraters: nextCraters };
              saveRef.current = next;
              return next;
            });
          }
        } else if (evt.type === 'treasure:opened') {
          const tid = String(payload.treasureId || '');
          const finderId = String(payload.finderId || '');
          const finderName = String(payload.finderName || 'Bir kaptan');
          const tx = Number(payload.x || 0);
          const ty = Number(payload.y || 0);
          if (tid) {
            setSave((prev) => {
              if (prev.openedTreasureIds.includes(tid)) return prev;
              const next = { ...prev, openedTreasureIds: [...prev.openedTreasureIds, tid] };
              saveRef.current = next;
              return next;
            });
          }
          if (finderId && finderId !== identityRef.current.playerId) {
            addFloatingText(tx, ty - 26, `${finderName} Hazine Buldu!`, '#FDE047');
          }
        } else if (evt.type === 'island:claimed') {
          const islandId = String(payload.islandId || '');
          const ownerId = String(payload.ownerId || '');
          const ownerName = String(payload.ownerName || '');
          const color = String(payload.bannerColor || '#10B981');
          if (islandId && ownerId) {
            setOnlineIslandOwners((prev) => ({ ...prev, [islandId]: ownerId }));
            const isl = worldManagerRef.current.getIslandById(islandId);
            if (isl && ownerId !== identityRef.current.playerId) {
              addFloatingText(
                isl.centerX,
                isl.centerY - isl.maxRadius - 20,
                `${ownerName}, ${isl.name} Adasını Aldı!`,
                color
              );
            }
          }
        } else if (evt.type === 'player:hit') {
          const targetId = String(payload.targetId || '');
          const dmg = Number(payload.damage || 0);
          const isNaval = Boolean(payload.isNaval);
          const hx = Number(payload.x || 0);
          const hy = Number(payload.y || 0);
          const now = performance.now();
          soundEngine.playCannonHit();
          spawnParticles(hx, hy, 9, isNaval ? '#B45309' : '#FCA5A5', isNaval ? 'SPLINTER' : 'SPARK', 100, 3.2, true);
          if (targetId === identityRef.current.playerId) {
            sim.screenShake = Math.max(sim.screenShake, isNaval ? 4.5 : 3.0);
            if (isNaval) {
              sim.boatHitFlashUntil = now + 180;
              sim.boatHp = Math.max(0, Number(payload.hpLeft ?? sim.boatHp - dmg));
              addFloatingText(sim.boatX, sim.boatY - 26, `-${dmg} Gövde`, '#F87171');
            } else {
              sim.playerHitFlashUntil = now + 180;
              sim.playerHp = Math.max(0, Number(payload.hpLeft ?? sim.playerHp - dmg));
              addFloatingText(sim.playerX, sim.playerY - 22, `-${dmg}`, '#F87171');
            }
          }
        } else if (evt.type === 'player:respawn') {
          const pid = String(payload.playerId || '');
          if (pid === identityRef.current.playerId) {
            const rx = Number(payload.x || 0);
            const ry = Number(payload.y || 0);
            const rbx = Number(payload.boatX || rx);
            const rby = Number(payload.boatY || ry);
            const isSailing = Boolean(payload.isSailing);
            sim.playerX = rx;
            sim.playerY = ry;
            sim.boatX = rbx;
            sim.boatY = rby;
            sim.boatVx = 0;
            sim.boatVy = 0;
            sim.isSailing = isSailing;
            sim.playerHp = 100;
            sim.boatHp = Math.round(getMaxBoatHp(saveRef.current.upgrades.boatLevel) * 0.75);
            addFloatingText(rx, ry - 30, 'Başlangıç Adana Çekildin!', '#FBBF24');
          }
        } else if (evt.type === 'war:status') {
          const fromId = String(payload.fromId || '');
          const fromName = String(payload.fromName || 'Bir kaptan');
          const targetId = String(payload.targetId || '');
          const targetName = String(payload.targetName || 'Bir kaptan');
          const mutual = Boolean(payload.mutual);
          const cancelled = Boolean(payload.cancelled);
          const selfId = identityRef.current.playerId;
          const fx = sim.isSailing ? sim.boatX : sim.playerX;
          const fy = (sim.isSailing ? sim.boatY : sim.playerY) - 36;
          if (!cancelled) {
            if (mutual) {
              soundEngine.playWarHorn();
              addFloatingText(fx, fy, `⚔ ${fromName} & ${targetName} Savaşta!`, '#FCA5A5');
            } else if (targetId === selfId) {
              soundEngine.playWarHorn();
              addFloatingText(
                fx,
                fy,
                `${fromName} sana savaş açtı! Devlet menüsünden karşılık ver.`,
                '#FBBF24'
              );
            } else if (fromId === selfId) {
              addFloatingText(fx, fy, `${targetName}'e savaş ilanı gönderildi`, '#FDE68A');
            }
          }
        } else if (evt.type === 'army:hit') {
          const hx = Number(payload.x || 0);
          const hy = Number(payload.y || 0);
          const dmg = Number(payload.damage || 0);
          const isShip = String(payload.unitKind || '') === 'SHIP';
          const killed = Boolean(payload.killed);
          if (
            dist(hx, hy, sim.isSailing ? sim.boatX : sim.playerX, sim.isSailing ? sim.boatY : sim.playerY) <
            950
          ) {
            spawnParticles(
              hx,
              hy,
              killed ? 8 : 4,
              isShip ? '#B45309' : '#FCA5A5',
              isShip ? 'SPLINTER' : 'SPARK',
              85,
              2.6,
              true
            );
            if (dmg > 0) {
              addFloatingText(hx, hy - 18, `-${dmg}`, killed ? '#EF4444' : '#FCA5A5', false);
            }
          }
        } else if (evt.type === 'player:emote') {
          const targetId = String(payload.playerId || '');
          const emote = String(payload.emote || '');
          if (targetId && emote) {
            const nowMs = performance.now();
            activeEmotesRef.current = [
              ...activeEmotesRef.current.filter((e) => e.targetId !== targetId && e.expiresAt > nowMs),
              { targetId, emote, startedAt: nowMs, expiresAt: nowMs + 3200 },
            ];
            soundEngine.playBoatBoard(true);
          }
        } else if (evt.type === 'arena:win') {
          const winnerId = String(payload.winnerId || '');
          const winnerName = String(payload.winnerName || 'Bir kaptan');
          const rewardGold = Number(payload.rewardGold || 80);
          soundEngine.playArenaBell();
          const fx = sim.isSailing ? sim.boatX : sim.playerX;
          const fy = (sim.isSailing ? sim.boatY : sim.playerY) - 42;
          if (winnerId === identityRef.current.playerId) {
            spawnParticles(fx, fy + 24, 24, '#F97316', 'GOLD', 140, 4.0, true);
            addFloatingText(
              fx,
              fy,
              `Arena Zaferi! +${rewardGold} Altın`,
              '#FBBF24'
            );
          } else {
            addFloatingText(
              fx,
              fy,
              `⚔ ${winnerName} Arena Düellosunu Kazandı!`,
              '#FDBA74'
            );
          }
        }
      },
      onWarSync: (decl) => {
        setOnlineWarDeclarations(decl);
      },
      onChat: (msg) => {
        setOnlineChat((prev) => [...prev.slice(-24), msg]);
      },
      onPingUpdate: (rtt) => {
        setOnlinePing(rtt);
      },
      onVoicePeers: (peers) => {
        voicePeersRef.current = peers;
        setVoicePeersCount(peers.length);
        voiceManagerRef.current?.updateKnownPeers(peers);
      },
    });

    onlineManagerRef.current = mgr;
    return mgr;
  }, [addFloatingText, applySaveSnapshotToSim, profileToSaveData, spawnParticles]);

  const ensureVoiceManager = useCallback((): VoiceChatManager => {
    if (!voiceManagerRef.current) {
      voiceManagerRef.current = new VoiceChatManager((snap) => {
        setVoiceState(snap);
      });
    }
    return voiceManagerRef.current;
  }, []);

  const handleToggleVoiceJoin = useCallback(async () => {
    const vm = ensureVoiceManager();
    if (vm.getSnapshot().enabled) {
      vm.disable();
      return;
    }
    const peer = onlineManagerRef.current?.getPeer();
    if (!peer) return;
    await vm.enable(peer, identityRef.current.playerId, voicePeersRef.current);
  }, [ensureVoiceManager]);

  const handleToggleVoiceMute = useCallback(() => {
    voiceManagerRef.current?.toggleMute();
  }, []);

  const handleToggleVoiceMode = useCallback(() => {
    const vm = ensureVoiceManager();
    const nextMode = vm.getSnapshot().mode === 'PROXIMITY' ? 'ROOM' : 'PROXIMITY';
    vm.setMode(nextMode);
  }, [ensureVoiceManager]);

  useEffect(() => {
    return () => {
      voiceManagerRef.current?.disable();
      onlineManagerRef.current?.disconnect();
    };
  }, []);

  const handleLeaveToMenu = useCallback(() => {
    voiceManagerRef.current?.disable();
    voicePeersRef.current = [];
    setVoicePeersCount(0);
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.disconnect();
      onlineActiveRef.current = false;
      setOnlineActive(false);
      setOnlineRoomInfo(null);
      setOnlineLobbyPlayers([]);
      setOnlineStarterSlots([]);
      setOnlineIslandOwners({});
      setOnlineWarDeclarations({});
      onlineAtWarSetRef.current.clear();
      setOnlinePing(null);
      remotePlayersRef.current.clear();
      onlineProjectilesRef.current = [];
      clearRenderCaches();
      worldManagerRef.current.setOnlineMode(false);

      const offlineSave = loadSaveData() ?? createInitialSave();
      worldManagerRef.current.setSeed(offlineSave.worldSeed);
      worldManagerRef.current.setLuckLevel(offlineSave.upgrades.luckLevel);
      saveRef.current = offlineSave;
      setSave(offlineSave);
      applySaveSnapshotToSim(offlineSave, true);
    }
    setActiveModal('NONE');
    setShowOnlineLobby(false);
    setPhase('TITLE_MENU');
  }, [applySaveSnapshotToSim]);

  const ensureWarWithFaction = useCallback(
    (factionId: FactionId) => {
      if (factionId === 'NEUTRAL' || factionId === 'PLAYER') return;
      if (saveRef.current.kingdom.atWarWith.includes(factionId)) return;
      soundEngine.playWarHorn();
      addFloatingText(
        simRef.current.isSailing ? simRef.current.boatX : simRef.current.playerX,
        (simRef.current.isSailing ? simRef.current.boatY : simRef.current.playerY) - 34,
        `${ENEMY_FACTIONS[factionId].shortName} ile Savaş Başladı!`,
        '#FCA5A5'
      );
      commitSave((prev) => ({
        ...prev,
        kingdom: {
          ...prev.kingdom,
          atWarWith: prev.kingdom.atWarWith.includes(factionId)
            ? prev.kingdom.atWarWith
            : [...prev.kingdom.atWarWith, factionId],
        },
      }));
    },
    [addFloatingText, commitSave]
  );

  const findStandingIsland = useCallback((x: number, y: number): Island | null => {
    const nearby = worldManagerRef.current.getVisibleIslands(x, y, 1);
    for (const isl of nearby) {
      if (isPointOnIsland(isl, x, y, 0)) {
        return isl;
      }
    }
    return null;
  }, []);

  const findNearestShoreIsland = useCallback((x: number, y: number, maxCoastGap: number): Island | null => {
    const nearby = worldManagerRef.current.getVisibleIslands(x, y, 1);
    let best: Island | null = null;
    let bestGap = Infinity;
    for (const isl of nearby) {
      const d = Math.hypot(x - isl.centerX, y - isl.centerY);
      const coastR = getIslandRadiusAtAngle(isl, Math.atan2(y - isl.centerY, x - isl.centerX));
      const gap = d - coastR;
      if (gap <= maxCoastGap && gap < bestGap) {
        best = isl;
        bestGap = gap;
      }
    }
    return best;
  }, []);

  const recordEnemyDefeat = useCallback(
    (enemy: IslandEnemy, nowMs?: number) => {
      const t = nowMs ?? performance.now();
      if (t - simRef.current.lastSoldierSfxTime > 95) {
        simRef.current.lastSoldierSfxTime = t;
        soundEngine.playEnemySunk();
      }
      spawnParticles(enemy.x, enemy.y, 12, enemy.squadColor, 'SPARK', 110, 3.6, true);

      const lootList = simRef.current.floatingLoot;
      if (lootList.length < 75) {
        const bounty = enemy.tier === 3 ? 65 : enemy.tier === 2 ? 45 : 28;
        const dropsHeal = Math.random() < 0.38;
        lootList.push({
          id: `land_loot_${Date.now()}_${Math.random()}`,
          x: enemy.x,
          y: enemy.y,
          goldValue: bounty,
          healHp: dropsHeal ? 22 : undefined,
          bobOffset: Math.random() * Math.PI * 2,
          life: 38,
        });
      }

      pendingSyncRef.current.landKills += 1;
    },
    [spawnParticles]
  );

  const grantNextCaptainLog = useCallback(
    (x: number, y: number): boolean => {
      const discovered = new Set(saveRef.current.discoveredLogIds ?? []);
      const nextLog = CAPTAIN_LOGS.find((l) => !discovered.has(l.id));
      if (!nextLog) return false;
      const isEn = settingsRef.current.language === 'en';
      soundEngine.playRelicFound();
      addFloatingText(
        x,
        y,
        `${isEn ? "Karloff's Log" : 'Karloff Günlüğü'}: ${
          isEn ? nextLog.titleEn : nextLog.title
        } (+${nextLog.rewardGold}G)`,
        '#38BDF8'
      );
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:discover_log',
          logId: nextLog.id,
        });
        return true;
      }
      commitSave((prev) => ({
        ...prev,
        gold: prev.gold + nextLog.rewardGold,
        totalGoldEarned: prev.totalGoldEarned + nextLog.rewardGold,
        discoveredLogIds: prev.discoveredLogIds?.includes(nextLog.id)
          ? prev.discoveredLogIds
          : [...(prev.discoveredLogIds ?? []), nextLog.id],
      }));
      return true;
    },
    [addFloatingText, commitSave]
  );

  const isSiegeableEnemyFort = useCallback((isl: Island, currentSave: SaveData): boolean => {
    if (onlineActiveRef.current || !isl.fortPos) return false;
    const eff = getEffectiveIslandFaction(isl.factionId, isl.id, isl.isStarter, currentSave.kingdom);
    return eff !== 'NEUTRAL' && eff !== 'PLAYER';
  }, []);

  const getOrInitFortWall = useCallback((isl: Island) => {
    const existing = simRef.current.fortWallsHpByIsland.get(isl.id);
    if (existing) return existing;
    const maxHp = isl.isLarge ? 160 : 100;
    const created = { hp: maxHp, maxHp };
    simRef.current.fortWallsHpByIsland.set(isl.id, created);
    return created;
  }, []);

  const damageFortWall = useCallback(
    (isl: Island, rawDmg: number, nowMs: number): boolean => {
      if (!isl.fortPos || !isSiegeableEnemyFort(isl, saveRef.current)) return false;
      const wall = getOrInitFortWall(isl);
      if (wall.hp <= 0) return false;
      const dmg = Math.max(1, Math.round(rawDmg));
      wall.hp = Math.max(0, wall.hp - dmg);
      const eff = getEffectiveIslandFaction(
        isl.factionId,
        isl.id,
        isl.isStarter,
        saveRef.current.kingdom
      );
      ensureWarWithFaction(eff);
      if (nowMs - simRef.current.lastSoldierSfxTime > 85) {
        simRef.current.lastSoldierSfxTime = nowMs;
        soundEngine.playCannonHit();
      }
      spawnParticles(isl.fortPos.x, isl.fortPos.y, 7, '#CBD5E1', 'SPLINTER', 105, 3.4, true);
      if (wall.hp === 0) {
        simRef.current.screenShake = Math.max(simRef.current.screenShake, 4.2);
        spawnParticles(isl.fortPos.x, isl.fortPos.y, 18, '#94A3B8', 'SMOKE', 130, 5.2, true);
        addFloatingText(
          isl.fortPos.x,
          isl.fortPos.y - 36,
          settingsRef.current.language === 'en' ? 'Fort Wall Breached!' : 'Kale Suru Yıkıldı!',
          '#34D399'
        );
      } else {
        addFloatingText(isl.fortPos.x, isl.fortPos.y - 26, `-${dmg} Sur`, '#CBD5E1', false);
      }
      return true;
    },
    [addFloatingText, ensureWarWithFaction, getOrInitFortWall, isSiegeableEnemyFort, spawnParticles]
  );

  const tryHarvestResourceNodes = useCallback(
    (px: number, py: number, radius = 48): boolean => {
      const standing = findStandingIsland(px, py);
      if (!standing || !standing.resourceNodes || standing.resourceNodes.length === 0) return false;
      const sim = simRef.current;
      let harvestedWood = 0;
      let harvestedIron = 0;
      const newlyHarvested: string[] = [];

      for (const node of standing.resourceNodes) {
        if (sim.harvestedNodeIds.has(node.id)) continue;
        if (dist(px, py, node.x, node.y) <= radius + 14) {
          sim.harvestedNodeIds.add(node.id);
          newlyHarvested.push(node.id);
          if (node.kind === 'WOOD') {
            harvestedWood += node.amount;
            spawnParticles(node.x, node.y, 10, '#B45309', 'SPLINTER', 100, 3.2, true);
            addFloatingText(node.x, node.y - 20, `+${node.amount} Odun`, '#FDE68A');
          } else {
            harvestedIron += node.amount;
            spawnParticles(node.x, node.y, 10, '#94A3B8', 'SPARK', 100, 3.2, true);
            addFloatingText(node.x, node.y - 20, `+${node.amount} Demir`, '#CBD5E1');
          }
        }
      }

      if (newlyHarvested.length === 0) return false;
      soundEngine.playResourceHarvest();

      if (onlineActiveRef.current) {
        if (harvestedWood > 0) {
          onlineManagerRef.current?.submitLocalCommand({
            type: 'cmd:harvest_resource',
            kind: 'WOOD',
            amount: harvestedWood,
          });
        }
        if (harvestedIron > 0) {
          onlineManagerRef.current?.submitLocalCommand({
            type: 'cmd:harvest_resource',
            kind: 'IRON',
            amount: harvestedIron,
          });
        }
      } else {
        commitSave((prev) => ({
          ...prev,
          wood: (prev.wood ?? 0) + harvestedWood,
          iron: (prev.iron ?? 0) + harvestedIron,
          harvestedNodeIds: [...(prev.harvestedNodeIds ?? []), ...newlyHarvested].slice(-300),
        }));
      }
      return true;
    },
    [addFloatingText, commitSave, findStandingIsland, spawnParticles]
  );

  const getWeaponAmmo = useCallback((weaponId: WeaponId): number => {
    const def = WEAPONS[weaponId];
    if (!def || def.kind !== 'RANGED' || !def.magSize) return 0;
    const cur = weaponAmmoRef.current[weaponId];
    if (typeof cur !== 'number') {
      weaponAmmoRef.current[weaponId] = def.magSize;
      return def.magSize;
    }
    return cur;
  }, []);

  const startWeaponReload = useCallback(
    (weaponId: WeaponId, announceEmpty = false) => {
      const def = WEAPONS[weaponId];
      if (!def || def.kind !== 'RANGED' || !def.magSize) return;
      const curAmmo = getWeaponAmmo(weaponId);
      if (curAmmo >= def.magSize) return;
      if (reloadStateRef.current?.weaponId === weaponId) return;

      reloadStateRef.current = {
        weaponId,
        startedAt: performance.now(),
        durationMs: def.reloadMs ?? 1200,
      };
      soundEngine.playReload();

      if (announceEmpty) {
        const sim = simRef.current;
        const pos = sim.activeCave
          ? { x: sim.activeCave.playerX, y: sim.activeCave.playerY }
          : { x: sim.playerX, y: sim.playerY };
        addFloatingText(
          pos.x,
          pos.y - 28,
          settingsRef.current.language === 'en' ? 'Reloading...' : 'Mermi Yenileniyor...',
          '#FCD34D'
        );
      }
    },
    [addFloatingText, getWeaponAmmo]
  );

  const handleReloadWeapon = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const weaponId = saveRef.current.equippedWeapon;
    if (!weaponId) return;
    startWeaponReload(weaponId, false);
  }, [startWeaponReload]);

  const handleSelectWeaponSlot = useCallback(
    (slotIndex: number) => {
      if (phaseRef.current !== 'PLAYING') return;
      const norm = normalizeWeaponSlots(
        saveRef.current.weaponSlots,
        saveRef.current.unlockedWeapons,
        saveRef.current.equippedWeapon
      );
      const nextWeapon = norm.weaponSlots[slotIndex];
      if (!nextWeapon || nextWeapon === norm.equippedWeapon) return;
      reloadStateRef.current = null;
      soundEngine.playWeaponSwitch();
      const def = WEAPONS[nextWeapon];
      const sim = simRef.current;
      const pos = sim.activeCave
        ? { x: sim.activeCave.playerX, y: sim.activeCave.playerY }
        : { x: sim.playerX, y: sim.playerY };
      addFloatingText(
        pos.x,
        pos.y - 26,
        settingsRef.current.language === 'en' ? def.nameEn : def.name,
        def.color
      );

      commitSave(
        (prev) => ({
          ...prev,
          weaponSlots: norm.weaponSlots,
          equippedWeapon: nextWeapon,
        }),
        onlineActiveRef.current
      );
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:equip_weapon',
          weaponId: nextWeapon,
        });
      }
    },
    [addFloatingText, commitSave]
  );

  const handleSwitchWeapon = useCallback(
    (dir: 1 | -1 = 1) => {
      if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
      const norm = normalizeWeaponSlots(
        saveRef.current.weaponSlots,
        saveRef.current.unlockedWeapons,
        saveRef.current.equippedWeapon
      );
      if (norm.weaponSlots.length <= 1) return;
      const curIdx = norm.equippedWeapon ? norm.weaponSlots.indexOf(norm.equippedWeapon) : 0;
      const safeIdx = curIdx >= 0 ? curIdx : 0;
      const nextIdx = (safeIdx + dir + norm.weaponSlots.length) % norm.weaponSlots.length;
      handleSelectWeaponSlot(nextIdx);
    },
    [handleSelectWeaponSlot]
  );

  const handleBuyWeapon = useCallback(
    (weaponId: WeaponId, replaceSlotIndex?: number) => {
      const def = WEAPONS[weaponId];
      if (!def || !def.shopCost) return;
      const cur = saveRef.current;
      if (cur.unlockedWeapons.includes(weaponId) || cur.gold < def.shopCost) return;
      reloadStateRef.current = null;
      if (def.kind === 'RANGED' && def.magSize) {
        weaponAmmoRef.current[weaponId] = def.magSize;
      }
      soundEngine.playWeaponPickup();

      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:buy_weapon',
          weaponId,
          replaceSlotIndex,
        });
        return;
      }
      commitSave((prev) => {
        if (prev.unlockedWeapons.includes(weaponId) || prev.gold < def.shopCost!) return prev;
        const nextLoadout = applyWeaponAcquire(prev, weaponId, 'EQUIP_OR_BUY', replaceSlotIndex);
        return {
          ...prev,
          gold: prev.gold - def.shopCost!,
          unlockedWeapons: nextLoadout.unlockedWeapons,
          weaponSlots: nextLoadout.weaponSlots,
          equippedWeapon: nextLoadout.equippedWeapon,
        };
      });
    },
    [commitSave]
  );

  const handleEquipWeapon = useCallback(
    (weaponId: WeaponId, replaceSlotIndex?: number) => {
      const def = WEAPONS[weaponId];
      if (!def || !saveRef.current.unlockedWeapons.includes(weaponId)) return;
      reloadStateRef.current = null;
      if (def.kind === 'RANGED' && def.magSize && weaponAmmoRef.current[weaponId] === undefined) {
        weaponAmmoRef.current[weaponId] = def.magSize;
      }
      soundEngine.playWeaponSwitch();

      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:equip_weapon',
          weaponId,
          replaceSlotIndex,
        });
        return;
      }
      commitSave((prev) => {
        const nextLoadout = applyWeaponAcquire(prev, weaponId, 'EQUIP_OR_BUY', replaceSlotIndex);
        return {
          ...prev,
          unlockedWeapons: nextLoadout.unlockedWeapons,
          weaponSlots: nextLoadout.weaponSlots,
          equippedWeapon: nextLoadout.equippedWeapon,
        };
      });
    },
    [commitSave]
  );

  // Land Weapon Attack (Melee Cutlass or Ranged Pistol/Musket)
  const handleAttackLand = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    if (sim.isSailing) return;

    const weaponId = saveRef.current.equippedWeapon;
    if (!weaponId) return;

    const def = WEAPONS[weaponId];
    const now = performance.now();
    if (reloadStateRef.current?.weaponId === weaponId) return;
    if (now - sim.lastAttackTime < def.cooldownMs) return;

    if (def.kind === 'RANGED' && def.magSize) {
      const curAmmo = getWeaponAmmo(weaponId);
      if (curAmmo <= 0) {
        startWeaponReload(weaponId, true);
        return;
      }
      weaponAmmoRef.current[weaponId] = curAmmo - 1;
    }

    sim.lastAttackTime = now;
    sim.attackAnimStart = now;

    if (def.kind === 'MELEE') {
      tryHarvestResourceNodes(
        sim.playerX + Math.cos(sim.playerAngle) * 18,
        sim.playerY + Math.sin(sim.playerAngle) * 18,
        36
      );
    }

    const crewBonuses = getCrewSkillBonuses(saveRef.current.upgrades.crewSkillLevel ?? 1);
    const attackDamage = Math.round(def.damage * crewBonuses.weaponDmgMult);

    // Cave Interior Combat Branch
    if (sim.activeCave) {
      const caveState = sim.activeCave;
      const cave = caveState.cave;
      let caveAimAngle = caveState.playerAngle;
      let nearestCaveDistSq = Infinity;
      const scanCaveR = def.range + 45;
      for (const ce of cave.enemies) {
        if (ce.hp <= 0) continue;
        const dx = ce.x - caveState.playerX;
        const dy = ce.y - caveState.playerY;
        const dSq = dx * dx + dy * dy;
        if (dSq <= scanCaveR * scanCaveR && dSq < nearestCaveDistSq) {
          const toE = Math.atan2(dy, dx);
          const diff = Math.abs(
            Math.atan2(Math.sin(toE - caveState.playerAngle), Math.cos(toE - caveState.playerAngle))
          );
          if (diff < 1.35 || dSq < 85 * 85) {
            nearestCaveDistSq = dSq;
            caveAimAngle = toE;
          }
        }
      }
      caveState.playerAngle = caveAimAngle;

      if (def.kind === 'MELEE') {
        soundEngine.playSwordSlash();
        sim.screenShake = Math.max(sim.screenShake, 2.2);
        let hitAny = false;
        for (const ce of cave.enemies) {
          if (ce.hp <= 0) continue;
          const dx = ce.x - caveState.playerX;
          const dy = ce.y - caveState.playerY;
          const dSq = dx * dx + dy * dy;
          if (dSq <= (def.range + ce.radius) * (def.range + ce.radius)) {
            const toE = Math.atan2(dy, dx);
            const diff = Math.abs(Math.atan2(Math.sin(toE - caveAimAngle), Math.cos(toE - caveAimAngle)));
            if (diff <= 1.28 || dSq < (28 + ce.radius) * (28 + ce.radius)) {
              ce.hp -= attackDamage;
              ce.hitFlashTime = now;
              const pushed = resolveCaveCollision(
                cave,
                ce.x + Math.cos(toE) * 16,
                ce.y + Math.sin(toE) * 16,
                ce.radius
              );
              ce.x = pushed.x;
              ce.y = pushed.y;
              hitAny = true;
              spawnParticles(ce.x, ce.y, 7, '#E879F9', 'SPARK', 95, 3, true);
              addFloatingText(ce.x, ce.y - 20, `-${attackDamage}`, '#FDE047');
              if (ce.hp <= 0) {
                spawnParticles(ce.x, ce.y, ce.isBoss ? 22 : 10, '#FBBF24', 'GOLD', 120, 3.6, true);
                addFloatingText(
                  ce.x,
                  ce.y - 32,
                  ce.isBoss ? `${ce.name} Yenildi! +${ce.goldBounty}G` : `+${ce.goldBounty}G`,
                  ce.isBoss ? '#C084FC' : '#FDE047'
                );
                if (ce.isBoss) caveState.bossDefeated = true;
                if (!onlineActiveRef.current) {
                  commitSave((prev) => ({
                    ...prev,
                    gold: prev.gold + ce.goldBounty,
                    totalGoldEarned: prev.totalGoldEarned + ce.goldBounty,
                    landEnemiesDefeated: prev.landEnemiesDefeated + 1,
                  }));
                } else {
                  pendingSyncRef.current.landKills += 1;
                }
              }
            }
          }
        }
        cave.enemies = cave.enemies.filter((e) => e.hp > 0);
        if (hitAny) soundEngine.playCannonHit();
      } else {
        soundEngine.playPistolShot();
        sim.screenShake = Math.max(sim.screenShake, 1.8);
        const startX = caveState.playerX + Math.cos(caveAimAngle) * 16;
        const startY = caveState.playerY + Math.sin(caveAimAngle) * 16;
        for (let p = 0; p < def.pellets; p++) {
          const spreadOffset =
            def.pellets === 1
              ? (Math.random() - 0.5) * def.spreadRad
              : (p / (def.pellets - 1) - 0.5) * def.spreadRad;
          const shotA = caveAimAngle + spreadOffset;
          sim.landProjectiles.push({
            id: `clp_${Date.now()}_${Math.random()}`,
            owner: 'PLAYER',
            x: startX,
            y: startY,
            vx: Math.cos(shotA) * def.projectileSpeed,
            vy: Math.sin(shotA) * def.projectileSpeed,
            damage: attackDamage,
            color: def.color,
            life: def.range / def.projectileSpeed,
          });
        }
      }
      return;
    }

    // SpatialGrid-accelerated soft-assist aim toward nearest island enemy
    let aimAngle = sim.playerAngle;
    let nearestDistSq = Infinity;
    const scanR = def.range + 45;
    const nearbyEnemies = enemyCombatGridRef.current.queryRadius(
      sim.playerX,
      sim.playerY,
      scanR,
      enemyQueryBufRef.current
    );
    for (let i = 0; i < nearbyEnemies.length; i++) {
      const ie = nearbyEnemies[i];
      if (ie.hp <= 0) continue;
      const dx = ie.x - sim.playerX;
      const dy = ie.y - sim.playerY;
      const dSq = dx * dx + dy * dy;
      if (dSq <= scanR * scanR && dSq < nearestDistSq) {
        const toEnemy = Math.atan2(dy, dx);
        const angleDiff = Math.abs(Math.atan2(Math.sin(toEnemy - sim.playerAngle), Math.cos(toEnemy - sim.playerAngle)));
        if (angleDiff < 1.35 || dSq < 85 * 85) {
          nearestDistSq = dSq;
          aimAngle = toEnemy;
        }
      }
    }
    if (onlineActiveRef.current) {
      const selfStanding = findStandingIsland(sim.playerX, sim.playerY);
      const selfInArena =
        selfStanding?.specialZone === 'ARENA' &&
        selfStanding.arenaCenter &&
        dist(sim.playerX, sim.playerY, selfStanding.arenaCenter.x, selfStanding.arenaCenter.y) <= 198;
      const selfInCity = selfStanding?.specialZone === 'CITY';
      if (!selfInCity) {
        for (const rp of remotePlayersRef.current.values()) {
          if (!rp.connected || rp.isSailing || rp.inCaveId) continue;
          const rpInArena =
            selfInArena &&
            selfStanding?.arenaCenter &&
            dist(rp.x, rp.y, selfStanding.arenaCenter.x, selfStanding.arenaCenter.y) <= 198;
          if (!onlineAtWarSetRef.current.has(rp.id) && !rpInArena) continue;
          const capDx = rp.x - sim.playerX;
          const capDy = rp.y - sim.playerY;
          const capDSq = capDx * capDx + capDy * capDy;
          if (capDSq <= scanR * scanR && capDSq < nearestDistSq) {
            const toCap = Math.atan2(capDy, capDx);
            const angleDiff = Math.abs(Math.atan2(Math.sin(toCap - sim.playerAngle), Math.cos(toCap - sim.playerAngle)));
            if (angleDiff < 1.35 || capDSq < 85 * 85) {
              nearestDistSq = capDSq;
              aimAngle = toCap;
            }
          }
          if (rp.soldiers && onlineAtWarSetRef.current.has(rp.id)) {
            for (let si = 0; si < rp.soldiers.length; si++) {
              const rs = rp.soldiers[si];
              const sdx = rs.x - sim.playerX;
              const sdy = rs.y - sim.playerY;
              const sdSq = sdx * sdx + sdy * sdy;
              if (sdSq <= scanR * scanR && sdSq < nearestDistSq) {
                const toSol = Math.atan2(sdy, sdx);
                const angleDiff = Math.abs(Math.atan2(Math.sin(toSol - sim.playerAngle), Math.cos(toSol - sim.playerAngle)));
                if (angleDiff < 1.35 || sdSq < 85 * 85) {
                  nearestDistSq = sdSq;
                  aimAngle = toSol;
                }
              }
            }
          }
        }
      }
    }
    sim.playerAngle = aimAngle;

    if (def.kind === 'MELEE') {
      soundEngine.playSwordSlash();
      sim.screenShake = Math.max(sim.screenShake, 2.0);
      let hitCount = 0;

      for (let i = 0; i < nearbyEnemies.length; i++) {
        const ie = nearbyEnemies[i];
        if (ie.hp <= 0) continue;
        const dx = ie.x - sim.playerX;
        const dy = ie.y - sim.playerY;
        const dSq = dx * dx + dy * dy;
        if (dSq <= def.range * def.range) {
          const toE = Math.atan2(dy, dx);
          const diff = Math.abs(Math.atan2(Math.sin(toE - aimAngle), Math.cos(toE - aimAngle)));
          if (diff <= 1.25 || dSq < 28 * 28) {
            ie.hp -= attackDamage;
            ie.hitFlashTime = now;
            ie.alerted = true;
            ensureWarWithFaction(ie.factionId);
            ie.x += Math.cos(toE) * 16;
            ie.y += Math.sin(toE) * 16;
            hitCount++;

            spawnParticles(ie.x, ie.y, 7, '#F8FAFC', 'SPARK', 90, 3, true);
            addFloatingText(ie.x, ie.y - 20, `-${attackDamage}`, '#FDE047');

            if (ie.hp <= 0) {
              recordEnemyDefeat(ie, now);
            }
          }
        }
      }
      // Compact defeated enemies immediately via swap-and-pop
      for (let i = sim.islandEnemies.length - 1; i >= 0; i--) {
        if (sim.islandEnemies[i].hp <= 0) {
          sim.islandEnemies[i] = sim.islandEnemies[sim.islandEnemies.length - 1];
          sim.islandEnemies.pop();
        }
      }
      const standingForWall = findStandingIsland(sim.playerX, sim.playerY);
      if (
        standingForWall?.fortPos &&
        dist(sim.playerX, sim.playerY, standingForWall.fortPos.x, standingForWall.fortPos.y) <=
          def.range + 28
      ) {
        if (damageFortWall(standingForWall, attackDamage, now)) hitCount++;
      }
      if (hitCount > 0) soundEngine.playCannonHit();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:land_attack',
          x: sim.playerX,
          y: sim.playerY,
          angle: aimAngle,
          weaponId,
          damage: def.damage,
          range: def.range,
          isRanged: false,
        });
      }
    } else {
      soundEngine.playPistolShot();
      sim.screenShake = Math.max(sim.screenShake, 1.8);

      const startX = sim.playerX + Math.cos(aimAngle) * 16;
      const startY = sim.playerY + Math.sin(aimAngle) * 16;

      for (let p = 0; p < def.pellets; p++) {
        const spreadOffset =
          def.pellets === 1
            ? (Math.random() - 0.5) * def.spreadRad
            : ((p / (def.pellets - 1)) - 0.5) * def.spreadRad;
        const shotA = aimAngle + spreadOffset;

        sim.landProjectiles.push({
          id: `lp_${Date.now()}_${Math.random()}`,
          owner: 'PLAYER',
          x: startX,
          y: startY,
          vx: Math.cos(shotA) * def.projectileSpeed,
          vy: Math.sin(shotA) * def.projectileSpeed,
          damage: attackDamage,
          color: def.color,
          life: def.range / def.projectileSpeed,
        });
      }

      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:land_attack',
          x: sim.playerX,
          y: sim.playerY,
          angle: aimAngle,
          weaponId,
          damage: def.damage,
          range: def.range,
          isRanged: true,
        });
      }

      sim.particles.push({
        x: startX,
        y: startY,
        z: 6,
        vx: Math.cos(aimAngle) * 40,
        vy: Math.sin(aimAngle) * 40,
        vz: 0,
        size: 5,
        color: '#FDE047',
        alpha: 1,
        life: 0.1,
        maxLife: 0.1,
        type: 'MUZZLE',
      });
    }
  }, [
    addFloatingText,
    ensureWarWithFaction,
    getWeaponAmmo,
    recordEnemyDefeat,
    spawnParticles,
    startWeaponReload,
  ]);

  const fireBroadside = useCallback(
    (
      owner: 'PLAYER' | EnemyFactionId,
      shipX: number,
      shipY: number,
      shipAngle: number,
      countPerSide: number,
      damage: number,
      sides: Array<1 | -1>,
      shipScale = 1
    ) => {
      const baseOffsets =
        countPerSide === 1
          ? [0]
          : countPerSide === 2
          ? [-9, 9]
          : countPerSide === 3
          ? [-13, 0, 13]
          : [-16, -5.5, 5.5, 16];
      const offsets = baseOffsets.map((o) => o * shipScale);
      const cosA = Math.cos(shipAngle);
      const sinA = Math.sin(shipAngle);
      const speed = owner === 'PLAYER' ? 410 : 355;

      const budget = perfGovRef.current.getCurrentBudget();
      const sim = simRef.current;

      for (const side of sides) {
        const fireAngle = shipAngle + side * (Math.PI / 2);
        const dirX = Math.cos(fireAngle);
        const dirY = Math.sin(fireAngle);

        for (const ox of offsets) {
          if (sim.cannonballs.length >= budget.maxCannonballs) break;
          const portX = shipX + cosA * ox + dirX * (16 * shipScale);
          const portY = shipY + sinA * ox + dirY * (16 * shipScale);

          sim.cannonballs.push({
            id: `cb_${Date.now()}_${Math.random()}`,
            owner,
            x: portX,
            y: portY,
            z: 8,
            vx: dirX * speed + (Math.random() - 0.5) * 26,
            vy: dirY * speed + (Math.random() - 0.5) * 26,
            vz: 48,
            damage,
            life: 1.15,
          });

          if (sim.particles.length < budget.maxParticles) {
            sim.particles.push({
              x: portX,
              y: portY,
              z: 6,
              vx: dirX * 45,
              vy: dirY * 45,
              vz: 10,
              size: 6.5,
              color: '#FDE047',
              alpha: 1,
              life: 0.14,
              maxLife: 0.14,
              type: 'MUZZLE',
            });
            const smokeCount = budget.tier === 'MASS_BATTLE' ? 1 : budget.tier === 'BALANCED' ? 2 : 3;
            for (let s = 0; s < smokeCount && sim.particles.length < budget.maxParticles; s++) {
              sim.particles.push({
                x: portX + (Math.random() - 0.5) * 6,
                y: portY + (Math.random() - 0.5) * 6,
                z: 7,
                vx: dirX * (55 + Math.random() * 45) + (Math.random() - 0.5) * 25,
                vy: dirY * (55 + Math.random() * 45) + (Math.random() - 0.5) * 25,
                vz: 14,
                size: 6 + Math.random() * 5,
                color: '#F1F5F9',
                alpha: 0.78,
                life: 0.5 + Math.random() * 0.25,
                maxLife: 0.75,
                type: 'SMOKE',
              });
            }
          }
        }
      }

      const nowMs = performance.now();
      const isPlayerFlagship =
        owner === 'PLAYER' &&
        Math.abs(shipX - sim.boatX) < 1 &&
        Math.abs(shipY - sim.boatY) < 1;
      if (isPlayerFlagship || nowMs - sim.lastCannonSfxTime > 80) {
        sim.lastCannonSfxTime = nowMs;
        soundEngine.playCannonFire(owner === 'PLAYER');
      }
    },
    []
  );

  const handleFireCannons = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    if (!sim.isSailing) return;

    const now = performance.now();
    const cannonLvl = saveRef.current.upgrades.cannonLevel;
    const cooldown = getCannonCooldownMs(cannonLvl);
    if (now - sim.lastCannonTime < cooldown) return;

    sim.lastCannonTime = now;
    sim.screenShake = Math.max(sim.screenShake, 2.5);

    const countPerSide = getCannonCountPerSide(cannonLvl);
    const relicBonuses = getRelicSetBonuses(saveRef.current.collectedRelicIds ?? []);
    const damage = Math.round(getCannonDamage(cannonLvl) * relicBonuses.cannonDmgMult);
    const shipSpec = getShipClass(saveRef.current.upgrades.boatLevel);
    if (onlineActiveRef.current) {
      soundEngine.playCannonFire(true);
      onlineManagerRef.current?.submitLocalCommand({
        type: 'cmd:fire_cannon',
        x: sim.boatX,
        y: sim.boatY,
        angle: sim.boatAngle,
        cannonCount: countPerSide,
        damage,
      });
      return;
    }
    fireBroadside(
      'PLAYER',
      sim.boatX,
      sim.boatY,
      sim.boatAngle,
      countPerSide,
      damage,
      [-1, 1],
      shipSpec.scale
    );
  }, [fireBroadside]);

  // Realistic Multi-Stage Digging Physics (+ chance to unearth bonus weapons & relics!)
  const handleDig = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    if (sim.isSailing || sim.activeCave) return;

    const now = performance.now();
    const shovelLvl = saveRef.current.upgrades.shovelLevel;
    const cooldown = getDigCooldownMs(shovelLvl);
    if (now - sim.lastDigTime < cooldown) return;

    const island = findStandingIsland(sim.playerX, sim.playerY);
    if (!island) return;

    sim.lastDigTime = now;
    sim.digAnimStart = now;
    sim.screenShake = Math.max(sim.screenShake, 2.2);

    let digX = sim.playerX + Math.cos(sim.playerAngle) * 19;
    let digY = sim.playerY + Math.sin(sim.playerAngle) * 19;
    if (!isPointOnIsland(island, digX, digY, -4)) {
      digX = sim.playerX;
      digY = sim.playerY;
    }

    tryHarvestResourceNodes(digX, digY, 34);

    const existingCrater = saveRef.current.dugCraters.find(
      (c) => c.islandId === island.id && dist(digX, digY, c.x, c.y) <= 22
    );
    const targetX = existingCrater ? existingCrater.x : digX;
    const targetY = existingCrater ? existingCrater.y : digY;
    const digPower = shovelLvl >= 4 ? 2 : 1;
    const newDepth = existingCrater ? Math.min(3, (existingCrater.depth || 1) + digPower) : digPower;

    spawnParticles(targetX, targetY, 10, '#D9B26F', 'SAND', 95, 3.6, true);
    spawnParticles(targetX, targetY, 7, '#7C5430', 'SAND', 75, 3.4, true);

    const digRadius = getDigRadius(shovelLvl);
    const openedSet = new Set(saveRef.current.openedTreasureIds);
    const hitTreasure = island.treasures.find(
      (t) => !openedSet.has(t.id) && dist(targetX, targetY, t.x, t.y) <= digRadius
    );

    const requiredDepth =
      hitTreasure &&
      !(island.isStarter && hitTreasure.id.endsWith('_tr_0')) &&
      hitTreasure.template.rarity !== 'COMMON'
        ? 2
        : 1;

    if (hitTreasure && newDepth >= requiredDepth) {
      soundEngine.playDig(true, false);
      spawnParticles(targetX, targetY, 24, '#FBBF24', 'GOLD', 145, 4.2, true);
      markTutorialStep('tut_dig');

      const relicBonuses = getRelicSetBonuses(saveRef.current.collectedRelicIds ?? []);
      const logBonuses = getCaptainLogBonuses(saveRef.current.discoveredLogIds ?? []);
      const cycleInfo = getWorldCycleInfo(saveRef.current.worldTimeSec ?? 36);
      const valueMult =
        getValueMultiplier(saveRef.current.upgrades.luckLevel) *
        relicBonuses.treasureValueMult *
        logBonuses.treasureValueMult *
        (1 + cycleInfo.treasureLuckBonus);
      const finalValue = Math.round((hitTreasure.template.baseValue * valueMult) / 5) * 5;
      const instantBonus = 25;

      // Chance to also unearth a weapon on non-starter islands
      let foundWeapon: WeaponId | null = null;
      if (!island.isStarter && Math.random() < 0.35) {
        const pool: WeaponId[] = ['PISTOL', 'MUSKET', 'DUAL_PISTOL'];
        const candidate = pool[Math.floor(Math.random() * pool.length)];
        if (!saveRef.current.unlockedWeapons.includes(candidate)) {
          foundWeapon = candidate;
        }
      }

      // Chance to unearth an undiscovered Relic (doubled during FOG or TREASURE_TIDE events!)
      let foundRelicId: string | null = null;
      const ownedRelics = new Set(saveRef.current.collectedRelicIds ?? []);
      const missingRelics = RELIC_DEFS.filter((r) => !ownedRelics.has(r.id));
      if (missingRelics.length > 0) {
        const evType = activeWorldEventRef.current?.type;
        const baseChance = (island.isStarter ? 0.14 : 0.28) + logBonuses.rareLuckBonus;
        const relicChance = Math.min(
          0.85,
          evType === 'FOG' || evType === 'TREASURE_TIDE' ? baseChance * 2 : baseChance
        );
        if (Math.random() < relicChance) {
          const pick = missingRelics[Math.floor(Math.random() * missingRelics.length)];
          foundRelicId = pick.id;
          soundEngine.playRelicFound();
          addFloatingText(
            targetX,
            targetY - 46,
            `Kalıntı Bulundu: ${
              settingsRef.current.language === 'en' ? pick.nameEn : pick.name
            }!`,
            '#C084FC'
          );
          if (onlineActiveRef.current) {
            onlineManagerRef.current?.submitLocalCommand({
              type: 'cmd:discover_relic',
              relicId: pick.id,
            });
          }
        }
      }

      if (Math.random() < 0.22 + logBonuses.rareLuckBonus) {
        grantNextCaptainLog(targetX, targetY - 64);
      }

      addFloatingText(
        targetX,
        targetY - 24,
        foundWeapon
          ? `${WEAPONS[foundWeapon].name} & ${hitTreasure.template.name}!`
          : `${hitTreasure.template.name}! +${instantBonus} Altın`,
        '#FDE047'
      );

      const bagItem = {
        uid: `${hitTreasure.id}_${Date.now()}`,
        name: hitTreasure.template.name,
        rarity: hitTreasure.template.rarity,
        value: finalValue,
        color: hitTreasure.template.color,
        islandName: island.name,
      };
      const craterId = existingCrater?.id ?? `cr_${Date.now()}_${Math.random()}`;

      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:dig',
          islandId: island.id,
          x: targetX,
          y: targetY,
          foundTreasureId: hitTreasure.id,
          craterId,
          newDepth,
          foundTreasure: true,
          instantBonus,
          bagItem,
          unlockedWeapon: foundWeapon ?? undefined,
        });
        return;
      }

      commitSave((prev) => {
        const updatedCraters = existingCrater
          ? prev.dugCraters.map((c) =>
              c.id === existingCrater.id ? { ...c, depth: newDepth, foundTreasure: true } : c
            )
          : [
              ...prev.dugCraters.slice(-350),
              {
                id: craterId,
                islandId: island.id,
                x: targetX,
                y: targetY,
                radius: 14 + Math.min(8, shovelLvl * 1.3),
                depth: newDepth,
                rotation: Math.random() * Math.PI * 2,
                foundTreasure: true,
              },
            ];

        const nextLoadout = foundWeapon
          ? applyWeaponAcquire(prev, foundWeapon, 'PICKUP')
          : null;
        if (foundWeapon && WEAPONS[foundWeapon].magSize) {
          weaponAmmoRef.current[foundWeapon] = WEAPONS[foundWeapon].magSize;
        }
        const prevRelics = prev.collectedRelicIds ?? [];
        const nextRelics =
          foundRelicId && !prevRelics.includes(foundRelicId)
            ? [...prevRelics, foundRelicId]
            : prevRelics;

        return {
          ...prev,
          gold: prev.gold + instantBonus,
          totalGoldEarned: prev.totalGoldEarned + instantBonus,
          treasuresFoundCount: prev.treasuresFoundCount + 1,
          equippedWeapon: nextLoadout ? nextLoadout.equippedWeapon : prev.equippedWeapon,
          weaponSlots: nextLoadout ? nextLoadout.weaponSlots : prev.weaponSlots,
          unlockedWeapons: nextLoadout ? nextLoadout.unlockedWeapons : prev.unlockedWeapons,
          collectedRelicIds: nextRelics,
          openedTreasureIds: [...prev.openedTreasureIds, hitTreasure.id],
          dugCraters: updatedCraters,
          bag: [...prev.bag, bagItem],
        };
      });
    } else {
      const hitDeeperClue = Boolean(hitTreasure && newDepth < requiredDepth);
      soundEngine.playDig(false, hitDeeperClue);

      if (hitDeeperClue) {
        spawnParticles(targetX, targetY, 6, '#FDE047', 'GOLD', 70, 2.8, true);
        addFloatingText(targetX, targetY - 22, 'Sandık derinde! Tekrar kaz', '#FCD34D');
      }

      const craterId = existingCrater?.id ?? `cr_${Date.now()}_${Math.random()}`;
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:dig',
          islandId: island.id,
          x: targetX,
          y: targetY,
          craterId,
          newDepth,
          foundTreasure: false,
          instantBonus: 0,
        });
        return;
      }

      commitSave((prev) => {
        const updatedCraters: DigCrater[] = existingCrater
          ? prev.dugCraters.map((c) =>
              c.id === existingCrater.id ? { ...c, depth: newDepth } : c
            )
          : [
              ...prev.dugCraters.slice(-350),
              {
                id: craterId,
                islandId: island.id,
                x: targetX,
                y: targetY,
                radius: 14 + Math.min(8, shovelLvl * 1.3),
                depth: newDepth,
                rotation: Math.random() * Math.PI * 2,
                foundTreasure: false,
              },
            ];
        return { ...prev, dugCraters: updatedCraters };
      });
    }
  }, [
    addFloatingText,
    commitSave,
    findStandingIsland,
    markTutorialStep,
    spawnParticles,
    tryHarvestResourceNodes,
  ]);

  const handleToggleBoat = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    const shipSpec = getShipClass(saveRef.current.upgrades.boatLevel);

    if (!sim.isSailing) {
      if (dist(sim.playerX, sim.playerY, sim.boatX, sim.boatY) <= 125 + (shipSpec.hullRadius - 20)) {
        sim.isSailing = true;
        sim.boatVx = 0;
        sim.boatVy = 0;
        sim.boatSpeedRatio = 0;
        sim.playerX = sim.boatX;
        sim.playerY = sim.boatY;
        soundEngine.playBoatBoard(true);
        markTutorialStep('tut_boat');
        addFloatingText(sim.boatX, sim.boatY - 26, `${shipSpec.name} · Yelken Açıldı`, '#6EE7B7');
        commitSave((prev) => ({
          ...prev,
          player: { ...prev.player, isSailing: true, x: sim.boatX, y: sim.boatY },
        }));
      }
    } else {
      const shoreIsland = findNearestShoreIsland(
        sim.boatX,
        sim.boatY,
        95 + (shipSpec.hullRadius - 20)
      );
      if (shoreIsland) {
        const angle = Math.atan2(sim.boatY - shoreIsland.centerY, sim.boatX - shoreIsland.centerX);
        const coastR = getIslandRadiusAtAngle(shoreIsland, angle);
        const landX = shoreIsland.centerX + Math.cos(angle) * (coastR - 24);
        const landY = shoreIsland.centerY + Math.sin(angle) * (coastR - 24);

        sim.isSailing = false;
        sim.boatVx = 0;
        sim.boatVy = 0;
        sim.boatSpeedRatio = 0;
        sim.playerX = landX;
        sim.playerY = landY;

        // Disembark hired army in a natural scattered beachhead wave so troops immediately fan out
        sim.allySoldiers.forEach((sol) => {
          const offsetAngle = angle + (Math.random() - 0.5) * 1.15;
          const inward = 20 + Math.random() * 75;
          const localCoastR = getIslandRadiusAtAngle(shoreIsland, offsetAngle);
          const sx = shoreIsland.centerX + Math.cos(offsetAngle) * Math.max(20, localCoastR - inward);
          const sy = shoreIsland.centerY + Math.sin(offsetAngle) * Math.max(20, localCoastR - inward);
          sol.x = sx;
          sol.y = sy;
          sol.angle = offsetAngle + Math.PI + (Math.random() - 0.5) * 0.7;
          sol.roamTarget = undefined;
          sol.roamWaitUntil = 0;
        });

        soundEngine.playBoatBoard(false);
        addFloatingText(landX, landY - 24, shoreIsland.name, '#FDE68A');

        commitSave((prev) => {
          const discovered = prev.discoveredIslandIds.includes(shoreIsland.id)
            ? prev.discoveredIslandIds
            : [...prev.discoveredIslandIds, shoreIsland.id];
          return {
            ...prev,
            discoveredIslandIds: discovered,
            boatHp: sim.boatHp,
            playerHp: sim.playerHp,
            player: { x: landX, y: landY, angle: sim.playerAngle, isSailing: false },
            boat: { x: sim.boatX, y: sim.boatY, angle: sim.boatAngle },
          };
        });
      }
    }
  }, [addFloatingText, commitSave, findNearestShoreIsland, markTutorialStep]);

  const enterCave = useCallback(
    (island: Island, entrance: CaveEntrance) => {
      const sim = simRef.current;
      const openedSet = new Set(saveRef.current.openedCaveChestIds ?? []);
      const unlockedSet = new Set(saveRef.current.unlockedWeapons);
      const interior = generateCaveInterior(
        entrance,
        saveRef.current.worldSeed,
        openedSet,
        unlockedSet
      );
      sim.fishing.active = false;
      sim.landProjectiles = [];
      sim.activeCave = {
        cave: interior,
        returnX: entrance.x,
        returnY: entrance.y + 26,
        islandId: island.id,
        islandName: island.name,
        playerX: interior.entryPos.x,
        playerY: interior.entryPos.y,
        cameraX: interior.entryPos.x,
        cameraY: interior.entryPos.y,
        playerAngle: 0,
        bossDefeated: interior.enemies.every((e) => !e.isBoss),
      };
      soundEngine.playCaveTransition(true);
      addFloatingText(
        interior.entryPos.x,
        interior.entryPos.y - 32,
        entrance.name,
        '#C084FC'
      );
    },
    [addFloatingText]
  );

  const exitCave = useCallback(
    (injured = false) => {
      const sim = simRef.current;
      const active = sim.activeCave;
      if (!active) return;
      sim.playerX = active.returnX;
      sim.playerY = active.returnY;
      sim.landProjectiles = [];
      sim.activeCave = null;
      soundEngine.playCaveTransition(false);
      if (injured) {
        sim.playerHp = 60;
        addFloatingText(
          sim.playerX,
          sim.playerY - 28,
          settingsRef.current.language === 'en'
            ? 'Retreated from cave injured!'
            : 'Mağaradan Yaralı Çıktın!',
          '#F87171'
        );
      } else {
        addFloatingText(
          sim.playerX,
          sim.playerY - 28,
          active.islandName,
          '#7DD3FC'
        );
      }
    },
    [addFloatingText]
  );

  const openCaveChest = useCallback(
    (chest: CaveChest) => {
      const sim = simRef.current;
      const active = sim.activeCave;
      if (!active || chest.opened) return;
      chest.opened = true;
      soundEngine.playChestOpen();
      spawnParticles(chest.x, chest.y, 20, '#FBBF24', 'GOLD', 130, 3.8, true);
      addFloatingText(chest.x, chest.y - 26, `+${chest.goldValue} Altın Sandık!`, '#FDE047');

      const alreadyOpened = (saveRef.current.openedCaveChestIds ?? []).includes(chest.id);
      if (alreadyOpened) return;

      const isBossOrFirst =
        chest.tier === 'BOSS' ||
        active.cave.chests.filter((c) => c.opened).length === 1;

      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:claim_cave_chest',
          chestId: chest.id,
          goldValue: chest.goldValue,
          isBossOrFirstInCave: isBossOrFirst,
        });
        return;
      }

      commitSave((prev) => {
        const opened = prev.openedCaveChestIds ?? [];
        if (opened.includes(chest.id)) return prev;
        return {
          ...prev,
          gold: prev.gold + chest.goldValue,
          totalGoldEarned: prev.totalGoldEarned + chest.goldValue,
          openedCaveChestIds: [...opened, chest.id],
          cavesExploredCount:
            (prev.cavesExploredCount ?? 0) + (isBossOrFirst ? 1 : 0),
        };
      });
    },
    [addFloatingText, commitSave, spawnParticles]
  );

  const claimCaveWeaponAltar = useCallback(() => {
    const sim = simRef.current;
    const active = sim.activeCave;
    const altar = active?.cave.weaponAltar;
    if (!active || !altar || altar.claimed) return;
    altar.claimed = true;
    const def = WEAPONS[altar.weaponId];
    soundEngine.playWeaponPickup();
    spawnParticles(altar.x, altar.y, 24, def.color, 'GOLD', 145, 4.2, true);
    addFloatingText(
      altar.x,
      altar.y - 30,
      `Gizli Silah: ${def.name}!`,
      '#C084FC'
    );

    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({
        type: 'cmd:claim_cave_chest',
        chestId: altar.id,
        goldValue: 40,
        weaponId: altar.weaponId,
      });
      return;
    }

    if (def.kind === 'RANGED' && def.magSize) {
      weaponAmmoRef.current[altar.weaponId] = def.magSize;
    }
    commitSave((prev) => {
      const nextLoadout = applyWeaponAcquire(prev, altar.weaponId, 'PICKUP');
      return {
        ...prev,
        gold: prev.gold + 40,
        totalGoldEarned: prev.totalGoldEarned + 40,
        openedCaveChestIds: (prev.openedCaveChestIds ?? []).includes(altar.id)
          ? prev.openedCaveChestIds ?? []
          : [...(prev.openedCaveChestIds ?? []), altar.id],
        unlockedWeapons: nextLoadout.unlockedWeapons,
        weaponSlots: nextLoadout.weaponSlots,
        equippedWeapon: nextLoadout.equippedWeapon,
      };
    });
  }, [addFloatingText, commitSave, spawnParticles]);

  const startOfflineArenaWave = useCallback(
    (island: Island, wave: number) => {
      if (!island.arenaCenter) return;
      const sim = simRef.current;
      const cx = island.arenaCenter.x;
      const cy = island.arenaCenter.y;
      const count = wave === 1 ? 3 : wave === 2 ? 4 : 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + wave * 0.45;
        const r = 135;
        const isBoss = wave === 3 && i === 0;
        const tier: 1 | 2 | 3 = wave === 1 ? 1 : wave === 2 ? 2 : 3;
        const stats = getIslandArmyStats(tier);
        const maxHp = isBoss ? Math.round(stats.hp * 2.1) : stats.hp;
        sim.islandEnemies.push({
          id: `arena_wave_${wave}_${Date.now()}_${i}`,
          islandId: island.id,
          factionId: 'CORSAIR',
          squadId: null,
          squadColor: isBoss ? '#F97316' : '#EF4444',
          role: isBoss ? 'LEADER' : 'FLANKER',
          combatStyle: wave >= 2 && i === count - 1 ? 'RANGED' : 'MELEE',
          formationOffset: { x: 0, y: 0 },
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          tier,
          angle: a + Math.PI,
          hp: maxHp,
          maxHp,
          alerted: true,
          lastAttackTime: 0,
          hitFlashTime: -1000,
          walkPhase: i * 0.7,
          patrolCenter: { x: cx, y: cy },
          patrolAngle: a,
          attackSwingTime: 0,
        });
      }
      soundEngine.playArenaBell();
      addFloatingText(
        cx,
        cy - 44,
        settingsRef.current.language === 'en'
          ? `Arena Wave ${wave}/3!`
          : `Arena Dalgası ${wave}/3!`,
        '#F97316'
      );
    },
    [addFloatingText]
  );

  const handlePrimaryInteract = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;

    if (sim.activeCave) {
      const cave = sim.activeCave.cave;
      const px = sim.activeCave.playerX;
      const py = sim.activeCave.playerY;
      const nearChest = cave.chests.find((c) => !c.opened && dist(px, py, c.x, c.y) <= 46);
      if (nearChest) {
        openCaveChest(nearChest);
        return;
      }
      if (
        cave.weaponAltar &&
        !cave.weaponAltar.claimed &&
        dist(px, py, cave.weaponAltar.x, cave.weaponAltar.y) <= 46
      ) {
        claimCaveWeaponAltar();
        return;
      }
      if (dist(px, py, cave.exitPos.x, cave.exitPos.y) <= 50) {
        exitCave(false);
        return;
      }
      return;
    }

    if (!sim.isSailing) {
      const standing = findStandingIsland(sim.playerX, sim.playerY);
      if (standing?.caves) {
        const nearEnt = standing.caves.find((c) => dist(sim.playerX, sim.playerY, c.x, c.y) <= 46);
        if (nearEnt) {
          enterCave(standing, nearEnt);
          return;
        }
      }
      if (
        !onlineActiveRef.current &&
        !sim.arenaChallenge?.active &&
        standing?.specialZone === 'ARENA' &&
        standing.arenaCenter &&
        dist(sim.playerX, sim.playerY, standing.arenaCenter.x, standing.arenaCenter.y) <= 185
      ) {
        sim.arenaChallenge = {
          active: true,
          islandId: standing.id,
          centerX: standing.arenaCenter.x,
          centerY: standing.arenaCenter.y,
          wave: 1,
          totalWaves: 3,
        };
        startOfflineArenaWave(standing, 1);
        return;
      }
    }

    handleToggleBoat();
  }, [
    claimCaveWeaponAltar,
    enterCave,
    exitCave,
    findStandingIsland,
    handleToggleBoat,
    openCaveChest,
    startOfflineArenaWave,
  ]);

  const handleRadar = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    const now = performance.now();
    const relicBonuses = getRelicSetBonuses(saveRef.current.collectedRelicIds ?? []);
    const cooldown = getRadarCooldownMs(saveRef.current.upgrades.radarLevel) * relicBonuses.cooldownMult;
    if (now - sim.lastRadarTime < cooldown) return;
    sim.lastRadarTime = now;
    markTutorialStep('tut_radar');

    const px = sim.isSailing ? sim.boatX : sim.playerX;
    const py = sim.isSailing ? sim.boatY : sim.playerY;
    const radarLevel = saveRef.current.upgrades.radarLevel;
    const petRangeMult = saveRef.current.activePet === 'PARROT' ? 1.25 : 1;
    const maxRange = (1100 + (radarLevel - 1) * 350) * petRangeMult;
    const openedSet = new Set(saveRef.current.openedTreasureIds);

    const nearbyIslands = worldManagerRef.current.getVisibleIslands(px, py, 2);
    const standingIsland = !sim.isSailing ? findStandingIsland(px, py) : null;

    let closestDist = Infinity;
    let closestAngle: number | null = null;

    const candidates = standingIsland ? [standingIsland] : nearbyIslands;
    for (const isl of candidates) {
      for (const tr of isl.treasures) {
        if (openedSet.has(tr.id)) continue;
        const d = dist(px, py, tr.x, tr.y);
        if (d < closestDist && d <= maxRange) {
          closestDist = d;
          closestAngle = Math.atan2(tr.y - py, tr.x - px);
        }
      }
    }

    if (closestAngle === null && standingIsland) {
      for (const isl of nearbyIslands) {
        for (const tr of isl.treasures) {
          if (openedSet.has(tr.id)) continue;
          const d = dist(px, py, tr.x, tr.y);
          if (d < closestDist && d <= maxRange) {
            closestDist = d;
            closestAngle = Math.atan2(tr.y - py, tr.x - px);
          }
        }
      }
    }

    let heat: HeatTier = 'NONE';
    let label = settingsRef.current.language === 'en' ? 'No treasure nearby' : 'Yakında hazine yok';
    if (closestAngle !== null) {
      if (closestDist <= 85) {
        heat = 'HOT';
        label = settingsRef.current.language === 'en' ? 'Very Hot! Dig Here' : 'Çok Sıcak! Burayı Kaz';
      } else if (closestDist <= 220) {
        heat = 'WARM';
        label = settingsRef.current.language === 'en' ? 'Warm' : 'Sıcak';
      } else if (closestDist <= 460) {
        heat = 'COOL';
        label = settingsRef.current.language === 'en' ? 'Cool' : 'Ilık';
      } else {
        heat = 'COLD';
        label = settingsRef.current.language === 'en' ? 'Cold' : 'Soğuk';
      }
    }

    soundEngine.playRadarPing(heat);
    sim.radarPulses.push({
      x: px,
      y: py,
      startTime: now,
      maxRadius: Math.min(260, Math.max(130, 120 + radarLevel * 20)),
      heat,
      targetAngle: closestAngle,
      showDirection: radarLevel >= 2,
    });

    setLastRadar({
      heat,
      label,
      distance: closestAngle !== null ? closestDist / 10 : null,
      angle: closestAngle,
      timestamp: Date.now(),
    });
  }, [findStandingIsland, markTutorialStep]);

  const handleTriggerAbility = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    const now = performance.now();
    const relicBonuses = getRelicSetBonuses(saveRef.current.collectedRelicIds ?? []);
    const cd = ABILITY_BASE_COOLDOWN_MS * relicBonuses.cooldownMult;
    if (now - sim.lastAbilityTime < cd) return;

    sim.lastAbilityTime = now;
    sim.abilityAuraUntilMs = now + 6000;
    sim.screenShake = Math.max(sim.screenShake, 2.5);
    soundEngine.playAbilityOrder();

    const isEn = settingsRef.current.language === 'en';
    if (sim.isSailing) {
      const maxHp = getMaxBoatHp(saveRef.current.upgrades.boatLevel);
      sim.boatHp = Math.min(maxHp, sim.boatHp + 28);
      sim.boatVx += Math.cos(sim.boatAngle) * 145;
      sim.boatVy += Math.sin(sim.boatAngle) * 145;
      spawnParticles(sim.boatX, sim.boatY, 16, '#38BDF8', 'WATER', 130, 4, true);
      addFloatingText(
        sim.boatX,
        sim.boatY - 30,
        isEn ? 'Full Speed & Repairs!' : 'Tam Yol & Hızlı Onarım!',
        '#6EE7B7'
      );
    } else {
      const maxCapHp = MAX_PLAYER_HP + relicBonuses.extraPlayerMaxHp;
      sim.playerHp = Math.min(maxCapHp, sim.playerHp + 20);
      for (const sol of sim.allySoldiers) {
        if (sol.hp > 0) sol.hp = Math.min(sol.maxHp, sol.hp + sol.maxHp * 0.25);
      }
      spawnParticles(sim.playerX, sim.playerY, 20, '#FBBF24', 'GOLD', 140, 3.8, true);

      // Shockwave area damage around Captain
      const shockDmg = 28 + (saveRef.current.upgrades.crewSkillLevel ?? 1) * 4;
      const nearby = enemyCombatGridRef.current.queryRadius(
        sim.playerX,
        sim.playerY,
        150,
        enemyQueryBufRef.current
      );
      for (let i = 0; i < nearby.length; i++) {
        const ie = nearby[i];
        if (ie.hp <= 0) continue;
        const dx = ie.x - sim.playerX;
        const dy = ie.y - sim.playerY;
        const d = Math.hypot(dx, dy);
        if (d <= 150) {
          ie.hp -= shockDmg;
          ie.hitFlashTime = now;
          ie.alerted = true;
          ensureWarWithFaction(ie.factionId);
          if (d > 1) {
            ie.x += (dx / d) * 28;
            ie.y += (dy / d) * 28;
          }
          addFloatingText(ie.x, ie.y - 20, `-${shockDmg}`, '#FDE047', false);
          if (ie.hp <= 0) recordEnemyDefeat(ie, now);
        }
      }
      for (let i = sim.islandEnemies.length - 1; i >= 0; i--) {
        if (sim.islandEnemies[i].hp <= 0) {
          sim.islandEnemies[i] = sim.islandEnemies[sim.islandEnemies.length - 1];
          sim.islandEnemies.pop();
        }
      }
      addFloatingText(
        sim.playerX,
        sim.playerY - 32,
        isEn ? 'War Cry! Troops Boosted!' : 'Savaş Emri! Ordu Güçlendi!',
        '#FDE047'
      );
    }
  }, [addFloatingText, ensureWarWithFaction, recordEnemyDefeat, spawnParticles]);

  const handleClaimMilestone = useCallback(
    (milestoneId: string) => {
      const ms = CAMPAIGN_MILESTONES.find((m) => m.id === milestoneId);
      if (!ms) return;
      const s = saveRef.current;
      if ((s.claimedMilestoneIds ?? []).includes(milestoneId)) return;
      const statsInput: CampaignStatsInput = {
        treasuresFoundCount: s.treasuresFoundCount,
        enemiesSunkCount: s.enemiesSunkCount,
        landEnemiesDefeated: s.landEnemiesDefeated,
        discoveredIslandsCount: s.discoveredIslandIds.length,
        conqueredIslandsCount: s.kingdom.conqueredIslandIds.length,
        kingdomFounded: s.kingdom.founded,
        boatLevel: s.upgrades.boatLevel,
        collectedRelicsCount: (s.collectedRelicIds ?? []).length,
        totalGoldEarned: s.totalGoldEarned,
        stormsSurvivedCount: s.stormsSurvivedCount ?? 0,
        soldiersCount: s.kingdom.soldiers.length,
        escortShipCount: s.kingdom.escortShipCount,
      };
      if (!ms.isComplete(statsInput)) return;

      soundEngine.playUpgrade();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:claim_milestone',
          milestoneId,
        });
        return;
      }
      commitSave((prev) => ({
        ...prev,
        gold: prev.gold + ms.rewardGold,
        totalGoldEarned: prev.totalGoldEarned + ms.rewardGold,
        claimedMilestoneIds: [...(prev.claimedMilestoneIds ?? []), milestoneId],
      }));
    },
    [commitSave]
  );

  const handleCycleStance = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const order: ArmyStance[] = ['CHARGE', 'FOLLOW', 'DEFEND'];
    const cur = saveRef.current.armyStance ?? 'CHARGE';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    soundEngine.playBoatBoard(true);
    const sim = simRef.current;
    const isEn = settingsRef.current.language === 'en';
    const label =
      next === 'FOLLOW'
        ? isEn
          ? 'Army: Follow Captain'
          : 'Ordu Düzeni: Takip'
        : next === 'DEFEND'
        ? isEn
          ? 'Army: Defend Fort'
          : 'Ordu Düzeni: Savunma'
        : isEn
        ? 'Army: Charge!'
        : 'Ordu Düzeni: Saldırı!';
    addFloatingText(
      sim.isSailing ? sim.boatX : sim.playerX,
      (sim.isSailing ? sim.boatY : sim.playerY) - 34,
      label,
      '#6EE7B7'
    );
    commitSave((prev) => ({ ...prev, armyStance: next }), onlineActiveRef.current);
  }, [addFloatingText, commitSave]);

  const handleSetArmyStance = useCallback(
    (next: ArmyStance) => {
      commitSave((prev) => ({ ...prev, armyStance: next }), onlineActiveRef.current);
    },
    [commitSave]
  );

  const handleFishAction = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    const isEn = settingsRef.current.language === 'en';
    const now = performance.now();

    if (sim.fishing.active) {
      if (sim.fishing.bite) {
        const fish = rollCatchFish(
          saveRef.current.upgrades.luckLevel,
          activeWorldEventRef.current?.type === 'TREASURE_TIDE'
        );
        const caughtValue = fish.goldValue;
        soundEngine.playFishingCatch();
        spawnParticles(sim.fishing.x, sim.fishing.y, 16, fish.color, 'GOLD', 120, 3.8, true);
        addFloatingText(
          sim.fishing.x,
          sim.fishing.y - 24,
          `${isEn ? fish.nameEn : fish.name} (+${caughtValue}G)`,
          fish.color
        );
        if (fish.goldValue >= 80 && Math.random() < 0.25) {
          grantNextCaptainLog(sim.fishing.x, sim.fishing.y - 44);
        }
        sim.fishing.active = false;
        sim.fishing.bite = false;
        if (onlineActiveRef.current) {
          onlineManagerRef.current?.submitLocalCommand({
            type: 'cmd:fish_catch',
            goldValue: caughtValue,
          });
        } else {
          commitSave((prev) => ({
            ...prev,
            gold: prev.gold + caughtValue,
            totalGoldEarned: prev.totalGoldEarned + caughtValue,
            caughtFishCount: (prev.caughtFishCount ?? 0) + 1,
          }));
        }
      } else {
        sim.fishing.active = false;
        addFloatingText(sim.fishing.x, sim.fishing.y - 16, isEn ? 'Line Reeled' : 'Olta Çekildi', '#94A3B8');
      }
      return;
    }

    if (sim.isSailing && sim.boatSpeedRatio > 0.28) {
      addFloatingText(
        sim.boatX,
        sim.boatY - 28,
        isEn ? 'Slow down to fish!' : 'Olta atmak için yavaşla!',
        '#FCD34D'
      );
      return;
    }

    const baseX = sim.isSailing ? sim.boatX : sim.playerX;
    const baseY = sim.isSailing ? sim.boatY : sim.playerY;
    const castAngle = sim.isSailing ? sim.boatAngle + Math.PI * 0.5 : sim.playerAngle;
    const targetX = baseX + Math.cos(castAngle) * 62;
    const targetY = baseY + Math.sin(castAngle) * 62;
    const nearby = worldManagerRef.current.getVisibleIslands(targetX, targetY, 1);
    const inWater = !nearby.some((isl) => isPointOnIsland(isl, targetX, targetY, 0));
    if (!inWater) {
      addFloatingText(
        baseX,
        baseY - 26,
        isEn ? 'Face open water to cast line!' : 'Olta atmak için denize dön!',
        '#FCD34D'
      );
      return;
    }

    soundEngine.playFishingCast();
    const biteAt = now + 2400 + Math.random() * 2200;
    sim.fishing = {
      active: true,
      x: targetX,
      y: targetY,
      bite: false,
      biteAt,
      expireAt: biteAt + 4200,
    };
    sim.waterRipples.push({ x: targetX, y: targetY, radius: 3, maxRadius: 24, alpha: 0.9 });
  }, [addFloatingText, commitSave, spawnParticles]);

  const handleUseRepairKit = useCallback(() => {
    if ((saveRef.current.repairKits ?? 0) <= 0) return;
    const sim = simRef.current;
    const maxBoat = getMaxBoatHp(saveRef.current.upgrades.boatLevel);
    const relicB = getRelicSetBonuses(saveRef.current.collectedRelicIds ?? []);
    const maxCap = MAX_PLAYER_HP + relicB.extraPlayerMaxHp;
    if (sim.boatHp >= maxBoat && sim.playerHp >= maxCap) {
      addFloatingText(
        sim.isSailing ? sim.boatX : sim.playerX,
        (sim.isSailing ? sim.boatY : sim.playerY) - 28,
        settingsRef.current.language === 'en' ? 'HP is already full!' : 'Gemi ve Kaptan tam can!',
        '#FCD34D'
      );
      return;
    }
    soundEngine.playUpgrade();
    spawnParticles(
      sim.isSailing ? sim.boatX : sim.playerX,
      sim.isSailing ? sim.boatY : sim.playerY,
      16,
      '#34D399',
      'GOLD',
      110,
      3.5,
      true
    );
    addFloatingText(
      sim.isSailing ? sim.boatX : sim.playerX,
      (sim.isSailing ? sim.boatY : sim.playerY) - 28,
      '+75 Gemi · +40 Kaptan Canı!',
      '#6EE7B7'
    );
    if (onlineActiveRef.current) {
      sim.boatHp = Math.min(maxBoat, sim.boatHp + 75);
      sim.playerHp = Math.min(maxCap, sim.playerHp + 40);
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:use_repair_kit' });
      return;
    }
    sim.boatHp = Math.min(maxBoat, sim.boatHp + 75);
    sim.playerHp = Math.min(maxCap, sim.playerHp + 40);
    commitSave((prev) => ({
      ...prev,
      repairKits: Math.max(0, (prev.repairKits ?? 1) - 1),
      boatHp: Math.round(sim.boatHp),
      playerHp: Math.round(sim.playerHp),
    }));
  }, [addFloatingText, commitSave, spawnParticles]);

  const handleCraftRepairKit = useCallback(() => {
    const s = saveRef.current;
    const hasRes = (s.wood ?? 0) >= 2 && (s.iron ?? 0) >= 1;
    if (!hasRes && s.gold < 60) return;
    soundEngine.playUpgrade();
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:craft_repair_kit' });
      return;
    }
    commitSave((prev) => {
      if ((prev.wood ?? 0) >= 2 && (prev.iron ?? 0) >= 1) {
        return {
          ...prev,
          wood: (prev.wood ?? 0) - 2,
          iron: (prev.iron ?? 0) - 1,
          repairKits: (prev.repairKits ?? 0) + 1,
        };
      }
      if (prev.gold >= 60) {
        return {
          ...prev,
          gold: prev.gold - 60,
          repairKits: (prev.repairKits ?? 0) + 1,
        };
      }
      return prev;
    });
  }, [commitSave]);

  const handleSellResources = useCallback(() => {
    if (!hudState.nearDock) return;
    const w = saveRef.current.wood ?? 0;
    const ir = saveRef.current.iron ?? 0;
    const total = w * 12 + ir * 18;
    if (total <= 0) return;
    soundEngine.playSellCoins();
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:sell_resources' });
      return;
    }
    commitSave((prev) => ({
      ...prev,
      wood: 0,
      iron: 0,
      gold: prev.gold + total,
      totalGoldEarned: prev.totalGoldEarned + total,
    }));
  }, [commitSave, hudState.nearDock]);

  const handleAdoptPet = useCallback(
    (petId: PetId) => {
      const def = PET_DEFS.find((p) => p.id === petId);
      if (!def) return;
      const owned = saveRef.current.ownedPets ?? [];
      if (owned.includes(petId) || saveRef.current.gold < def.cost) return;
      soundEngine.playUpgrade();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:adopt_pet', petId });
        return;
      }
      commitSave((prev) => ({
        ...prev,
        gold: prev.gold - def.cost,
        ownedPets: [...(prev.ownedPets ?? []), petId],
        activePet: petId,
      }));
    },
    [commitSave]
  );

  const handleEquipPet = useCallback(
    (petId: PetId | null) => {
      soundEngine.playBoatBoard(true);
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:equip_pet', petId });
        return;
      }
      commitSave((prev) => ({ ...prev, activePet: petId }));
    },
    [commitSave]
  );

  const handleBuildFortTurret = useCallback(
    (islandId: string) => {
      if (onlineActiveRef.current) return;
      const s = saveRef.current;
      const turrets = s.fortTurretIslandIds ?? [];
      if (turrets.includes(islandId)) return;
      if ((s.wood ?? 0) < 4 || (s.iron ?? 0) < 3 || s.gold < 120) return;
      soundEngine.playUpgrade();
      commitSave((prev) => ({
        ...prev,
        wood: (prev.wood ?? 0) - 4,
        iron: (prev.iron ?? 0) - 3,
        gold: prev.gold - 120,
        fortTurretIslandIds: [...(prev.fortTurretIslandIds ?? []), islandId],
      }));
    },
    [commitSave]
  );

  const buildSyncedOfflineSave = useCallback((): SaveData => {
    const sim = simRef.current;
    return {
      ...saveRef.current,
      worldTimeSec: sim.worldTimeSec,
      playTimeSec: sim.playTimeSec,
      harvestedNodeIds: Array.from(sim.harvestedNodeIds).slice(-300),
      boatHp: Math.round(sim.boatHp),
      playerHp: Math.round(sim.playerHp),
      kingdom: {
        ...saveRef.current.kingdom,
        soldiers: sim.allySoldiers.map((sol) => ({
          id: sol.id,
          type: sol.type,
          hp: Math.max(1, Math.round(sol.hp)),
          maxHp: sol.maxHp,
        })),
        escortShipCount: sim.allyShips.length,
      },
      player: {
        x: sim.playerX,
        y: sim.playerY,
        angle: sim.playerAngle,
        isSailing: sim.isSailing,
      },
      boat: {
        x: sim.boatX,
        y: sim.boatY,
        angle: sim.boatAngle,
      },
    };
  }, []);

  const handleQuickSave = useCallback(() => {
    if (onlineActiveRef.current) return;
    const snap = buildSyncedOfflineSave();
    saveRef.current = snap;
    setSave(snap);
    persistSaveData(snap);
    saveToSlot(1, snap);
    soundEngine.playSellCoins();
    const sim = simRef.current;
    addFloatingText(
      sim.isSailing ? sim.boatX : sim.playerX,
      (sim.isSailing ? sim.boatY : sim.playerY) - 34,
      settingsRef.current.language === 'en' ? 'Quick Saved!' : 'Hızlı Kayıt Alındı!',
      '#6EE7B7'
    );
  }, [addFloatingText, buildSyncedOfflineSave]);

  const handleSaveToSlot = useCallback(
    (slot: number) => {
      if (onlineActiveRef.current) return;
      const snap = buildSyncedOfflineSave();
      saveRef.current = snap;
      setSave(snap);
      persistSaveData(snap);
      saveToSlot(slot, snap);
      soundEngine.playSellCoins();
    },
    [buildSyncedOfflineSave]
  );

  const applyOfflineLoadedSave = useCallback(
    (loaded: SaveData) => {
      worldManagerRef.current.setOnlineMode(false);
      worldManagerRef.current.setSeed(loaded.worldSeed);
      worldManagerRef.current.setLuckLevel(loaded.upgrades.luckLevel);
      saveRef.current = loaded;
      setSave(loaded);
      persistSaveData(loaded);
      setHasSavedProgress(true);
      applySaveSnapshotToSim(loaded, true);
      activeWorldEventRef.current = null;
      setActiveWorldEvent(null);
      setLastRadar(null);
    },
    [applySaveSnapshotToSim]
  );

  const handleLoadFromSlot = useCallback(
    (slot: number) => {
      if (onlineActiveRef.current) return;
      const loaded = loadFromSlot(slot);
      if (!loaded) return;
      applyOfflineLoadedSave(loaded);
      soundEngine.playUpgrade();
      setActiveModal('NONE');
    },
    [applyOfflineLoadedSave]
  );

  const handleStartWithSeed = useCallback(
    (seed: number) => {
      if (onlineActiveRef.current) return;
      const fresh = createInitialSave(seed);
      worldManagerRef.current.setOnlineMode(false);
      worldManagerRef.current.setSeed(fresh.worldSeed);
      worldManagerRef.current.setLuckLevel(1);
      const starter = worldManagerRef.current.getIslandAtSector(0, 0);
      if (starter) {
        const coastR = getIslandRadiusAtAngle(starter, 0.12);
        fresh.player.x = Math.cos(0.12) * (coastR * 0.45);
        fresh.player.y = Math.sin(0.12) * (coastR * 0.45);
        fresh.boat.x = Math.cos(0.12) * (coastR + 36);
        fresh.boat.y = Math.sin(0.12) * (coastR + 36);
      }
      applyOfflineLoadedSave(fresh);
      setActiveModal('NONE');
    },
    [applyOfflineLoadedSave]
  );

  const handleExportSave = useCallback(() => {
    const snap = buildSyncedOfflineSave();
    return JSON.stringify(snap, null, 2);
  }, [buildSyncedOfflineSave]);

  const handleImportSave = useCallback(
    (jsonStr: string): boolean => {
      if (onlineActiveRef.current) return false;
      try {
        const parsed = normalizeSaveData(JSON.parse(jsonStr));
        if (!parsed) return false;
        applyOfflineLoadedSave(parsed);
        soundEngine.playUpgrade();
        return true;
      } catch {
        return false;
      }
    },
    [applyOfflineLoadedSave]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      simRef.current.keys.add(code);

      if (code === 'Escape') {
        if (activeModal !== 'NONE') {
          setActiveModal('NONE');
        } else if (phaseRef.current === 'PLAYING') {
          setActiveModal('SETTINGS');
        }
        return;
      }
      if (phaseRef.current !== 'PLAYING') return;

      if (code === 'F5' && !onlineActiveRef.current) {
        e.preventDefault();
        handleQuickSave();
        return;
      }

      const kb = settingsRef.current.keybindings;
      if (code === kb.map) {
        setActiveModal((prev) => (prev === 'MAP' ? 'NONE' : 'MAP'));
        return;
      }
      if (code === kb.shop) {
        setActiveModal((prev) => (prev === 'SHOP' ? 'NONE' : 'SHOP'));
        return;
      }
      if (code === kb.kingdom) {
        setActiveModal((prev) => (prev === 'KINGDOM' ? 'NONE' : 'KINGDOM'));
        return;
      }
      if (code === kb.journal) {
        setActiveModal((prev) => (prev === 'JOURNAL' ? 'NONE' : 'JOURNAL'));
        return;
      }
      if (modalRef.current !== 'NONE') return;

      if (code === kb.digOrFire || code === 'Space') {
        e.preventDefault();
        if (simRef.current.isSailing) handleFireCannons();
        else handleDig();
      } else if (code === kb.attack) {
        handleAttackLand();
      } else if (code === kb.reload) {
        handleReloadWeapon();
      } else if (code === kb.switchWeapon) {
        handleSwitchWeapon(1);
      } else if (code === 'Digit1' && !Object.values(kb).includes('Digit1')) {
        handleSelectWeaponSlot(0);
      } else if (code === 'Digit2' && !Object.values(kb).includes('Digit2')) {
        handleSelectWeaponSlot(1);
      } else if (code === kb.boat) {
        handlePrimaryInteract();
      } else if (code === kb.radar) {
        handleRadar();
      } else if (code === kb.ability) {
        handleTriggerAbility();
      } else if (code === kb.fish) {
        handleFishAction();
      } else if (code === kb.stance) {
        handleCycleStance();
      } else if (code === kb.repair) {
        handleUseRepairKit();
      } else if (code === kb.chat && onlineActiveRef.current) {
        setChatOpen((prev) => !prev);
      } else if (code === kb.voiceMute && onlineActiveRef.current) {
        handleToggleVoiceMute();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeModal,
    handleAttackLand,
    handleCycleStance,
    handleDig,
    handleFireCannons,
    handleFishAction,
    handlePrimaryInteract,
    handleQuickSave,
    handleRadar,
    handleReloadWeapon,
    handleSelectWeaponSlot,
    handleSwitchWeapon,
    handleToggleVoiceMute,
    handleTriggerAbility,
    handleUseRepairKit,
  ]);

  // Main 60fps Loop
  useEffect(() => {
    let rafId = 0;
    let lastFrameTime = performance.now();
    let lastHudSync = 0;
    let frameCounter = 0;

    const step = (now: number) => {
      try {
      frameCounter++;
      const rawDeltaMs = now - lastFrameTime;
      const dt = Number.isFinite(rawDeltaMs) ? Math.max(0, Math.min(0.05, rawDeltaMs / 1000)) : 0.016;
      lastFrameTime = now;

      const sim = simRef.current;
      const currentSave = saveRef.current;
      const currentSettings = settingsRef.current;

      // Sanitize simulation coordinates if any external state or NaN ever slipped in
      if (!Number.isFinite(sim.playerX) || !Number.isFinite(sim.playerY)) {
        sim.playerX = Number.isFinite(currentSave.player.x) ? currentSave.player.x : 0;
        sim.playerY = Number.isFinite(currentSave.player.y) ? currentSave.player.y : 0;
      }
      if (!Number.isFinite(sim.boatX) || !Number.isFinite(sim.boatY)) {
        sim.boatX = Number.isFinite(currentSave.boat.x) ? currentSave.boat.x : 0;
        sim.boatY = Number.isFinite(currentSave.boat.y) ? currentSave.boat.y : 0;
      }
      if (!Number.isFinite(sim.boatVx) || !Number.isFinite(sim.boatVy)) {
        sim.boatVx = 0;
        sim.boatVy = 0;
      }
      if (!Number.isFinite(sim.cameraX) || !Number.isFinite(sim.cameraY)) {
        sim.cameraX = sim.isSailing ? sim.boatX : sim.playerX;
        sim.cameraY = sim.isSailing ? sim.boatY : sim.playerY;
      }
      if (!Number.isFinite(sim.zoom) || sim.zoom <= 0) {
        sim.zoom = 1;
      }

      const isPlaying = phaseRef.current === 'PLAYING' && modalRef.current === 'NONE';
      const maxBoatHp = getMaxBoatHp(currentSave.upgrades.boatLevel);
      const activeUnitCount =
        sim.allySoldiers.length +
        sim.islandEnemies.length +
        sim.allyShips.length +
        sim.enemies.length +
        Math.floor((sim.landProjectiles.length + sim.cannonballs.length) * 0.5);
      const budget = perfGovRef.current.update(rawDeltaMs, activeUnitCount, now);

      sim.screenShake = Math.max(0, sim.screenShake - dt * 16);

      if (reloadStateRef.current) {
        const rs = reloadStateRef.current;
        if (currentSave.equippedWeapon !== rs.weaponId) {
          reloadStateRef.current = null;
        } else if (now >= rs.startedAt + rs.durationMs) {
          const rDef = WEAPONS[rs.weaponId];
          if (rDef?.magSize) {
            weaponAmmoRef.current[rs.weaponId] = rDef.magSize;
          }
          reloadStateRef.current = null;
        }
      }

      let ix = sim.joystickVec.x;
      let iy = sim.joystickVec.y;
      if (sim.keys.has('KeyW') || sim.keys.has('ArrowUp')) iy -= 1;
      if (sim.keys.has('KeyS') || sim.keys.has('ArrowDown')) iy += 1;
      if (sim.keys.has('KeyA') || sim.keys.has('ArrowLeft')) ix -= 1;
      if (sim.keys.has('KeyD') || sim.keys.has('ArrowRight')) ix += 1;

      const inputMag = Math.hypot(ix, iy);
      if (inputMag > 1) {
        ix /= inputMag;
        iy /= inputMag;
      }

      const activeShipSpec = getShipClass(currentSave.upgrades.boatLevel);
      const activeCenterX = sim.isSailing ? sim.boatX : sim.playerX;
      const activeCenterY = sim.isSailing ? sim.boatY : sim.playerY;
      const visibleIslands = worldManagerRef.current.getVisibleIslands(activeCenterX, activeCenterY, 2);

      const relicBonuses = getRelicSetBonuses(currentSave.collectedRelicIds ?? []);
      const crewBonuses = getCrewSkillBonuses(currentSave.upgrades.crewSkillLevel ?? 1);
      const totalArmorReduction = Math.min(
        0.6,
        getDamageReductionRatio(currentSave.upgrades.hullPlatingLevel ?? 1) +
          relicBonuses.extraArmorReduction
      );
      const effectiveMaxPlayerHp = MAX_PLAYER_HP + relicBonuses.extraPlayerMaxHp;

      if (isPlaying && !onlineActiveRef.current) {
        sim.playTimeSec += dt;
        sim.worldTimeSec += dt;
        saveRef.current.playTimeSec = sim.playTimeSec;
        saveRef.current.worldTimeSec = sim.worldTimeSec;
      }
      const effectiveWorldTimeSec = onlineActiveRef.current
        ? 36 + Math.max(0, (Date.now() - (onlineRoomInfoRef.current?.createdAt ?? Date.now())) / 1000)
        : sim.worldTimeSec;
      const cycleInfo = getWorldCycleInfo(effectiveWorldTimeSec);

      // Random World Events Scheduler (Offline)
      if (isPlaying && !onlineActiveRef.current) {
        const curEv = activeWorldEventRef.current;
        if (curEv && now >= curEv.endsAt) {
          const endedType = curEv.type;
          activeWorldEventRef.current = null;
          setActiveWorldEvent(null);
          if (endedType === 'STORM') {
            addFloatingText(
              activeCenterX,
              activeCenterY - 40,
              currentSettings.language === 'en' ? 'Storm Cleared!' : 'Fırtına Dindi!',
              '#7DD3FC'
            );
            commitSave((prev) => ({
              ...prev,
              stormsSurvivedCount: (prev.stormsSurvivedCount ?? 0) + 1,
            }));
          }
        } else if (!curEv && now >= sim.nextWorldEventTime) {
          sim.nextWorldEventTime = now + 52000 + Math.random() * 28000;
          const ev = createWorldEvent(cycleInfo.season, now);
          activeWorldEventRef.current = ev;
          setActiveWorldEvent(ev);
          addFloatingText(activeCenterX, activeCenterY - 48, ev.title, '#FDE047');

          if (ev.type === 'STORM') {
            soundEngine.playStormThunder();
          } else if (ev.type === 'TREASURE_TIDE') {
            for (let k = 0; k < 4; k++) {
              const a = Math.random() * Math.PI * 2;
              const r = 240 + Math.random() * 240;
              const lx = activeCenterX + Math.cos(a) * r;
              const ly = activeCenterY + Math.sin(a) * r;
              if (!visibleIslands.some((isl) => isPointOnIsland(isl, lx, ly, 20))) {
                sim.floatingLoot.push({
                  id: `tide_${Date.now()}_${k}`,
                  x: lx,
                  y: ly,
                  goldValue: 55 + Math.floor(Math.random() * 45),
                  bobOffset: Math.random() * Math.PI * 2,
                  life: 45,
                });
              }
            }
          } else if (ev.type === 'BOUNTY_CONVOY') {
            const ba = Math.random() * Math.PI * 2;
            const bx = activeCenterX + Math.cos(ba) * 680;
            const by = activeCenterY + Math.sin(ba) * 680;
            if (!visibleIslands.some((isl) => isPointOnIsland(isl, bx, by, 50))) {
              const spec = getEnemyShipSpec(3);
              const healerSpec = getEnemyShipSpec(2);
              const escortSpec = getEnemyShipSpec(1);
              const aimCenter = Math.atan2(activeCenterY - by, activeCenterX - bx);
              sim.enemies.push(
                {
                  id: `bounty_${Date.now()}`,
                  name: 'Kraliyet Hazine Kalyonu (Ödül)',
                  factionId: 'CORSAIR',
                  x: bx,
                  y: by,
                  angle: aimCenter,
                  speed: spec.speed * 0.92,
                  hp: Math.round(spec.maxHp * 1.4),
                  maxHp: Math.round(spec.maxHp * 1.4),
                  lastFireTime: now,
                  hitFlashTime: -1000,
                  patrolAngle: Math.random() * Math.PI * 2,
                  broadsideSign: 1,
                  goldBounty: spec.bounty * 2,
                  tier: 3,
                  isEventBoss: true,
                },
                {
                  id: `bounty_heal_${Date.now()}`,
                  name: 'Konvoy Tamir Fırkateyni',
                  factionId: 'CORSAIR',
                  x: bx - 85,
                  y: by + 65,
                  angle: aimCenter,
                  speed: healerSpec.speed,
                  hp: healerSpec.maxHp,
                  maxHp: healerSpec.maxHp,
                  lastFireTime: now,
                  hitFlashTime: -1000,
                  patrolAngle: Math.random() * Math.PI * 2,
                  broadsideSign: -1,
                  goldBounty: Math.round(healerSpec.bounty * 1.2),
                  tier: 2,
                  isHealer: true,
                },
                {
                  id: `bounty_esc_${Date.now()}`,
                  name: 'Konvoy Koruma Brigantini',
                  factionId: 'CORSAIR',
                  x: bx + 85,
                  y: by - 65,
                  angle: aimCenter,
                  speed: escortSpec.speed,
                  hp: escortSpec.maxHp,
                  maxHp: escortSpec.maxHp,
                  lastFireTime: now,
                  hitFlashTime: -1000,
                  patrolAngle: Math.random() * Math.PI * 2,
                  broadsideSign: 1,
                  goldBounty: escortSpec.bounty,
                  tier: 1,
                }
              );
              soundEngine.playWarHorn();
            }
          } else if (ev.type === 'CASTAWAY_RESCUE') {
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * Math.PI * 2;
              const r = 260 + Math.random() * 260;
              const lx = activeCenterX + Math.cos(a) * r;
              const ly = activeCenterY + Math.sin(a) * r;
              if (!visibleIslands.some((isl) => isPointOnIsland(isl, lx, ly, 24))) {
                sim.floatingLoot.push({
                  id: `castaway_${Date.now()}_${k}`,
                  x: lx,
                  y: ly,
                  goldValue: 45 + Math.floor(Math.random() * 35),
                  bobOffset: Math.random() * Math.PI * 2,
                  life: 65,
                  kind: 'CASTAWAY_MAP',
                });
              }
            }
          }
        }
      }

      if (sim.activeCave) {
        const caveState = sim.activeCave;
        const cave = caveState.cave;
        if (isPlaying && inputMag > 0.05) {
          const targetAngle = Math.atan2(iy, ix);
          caveState.playerAngle = lerpAngle(caveState.playerAngle, targetAngle, Math.min(1, dt * 14));
          sim.walkPhase += dt * 13 * Math.min(1, inputMag);
          const footSpeed =
            PLAYER_SPEED *
            crewBonuses.footSpeedMult *
            (now < sim.abilityAuraUntilMs ? 1.15 : 1);
          const resolved = resolveCaveCollision(
            cave,
            caveState.playerX + ix * footSpeed * dt,
            caveState.playerY + iy * footSpeed * dt,
            11
          );
          caveState.playerX = resolved.x;
          caveState.playerY = resolved.y;
        }
        caveState.cameraX += (caveState.playerX - caveState.cameraX) * Math.min(1, dt * 8);
        caveState.cameraY += (caveState.playerY - caveState.cameraY) * Math.min(1, dt * 8);

        if (isPlaying) {
          // Cave Monster & Boss AI
          for (const ce of cave.enemies) {
            if (ce.hp <= 0) continue;
            const dToPlayer = dist(ce.x, ce.y, caveState.playerX, caveState.playerY);
            if (dToPlayer <= 320) {
              const ang = Math.atan2(caveState.playerY - ce.y, caveState.playerX - ce.x);
              ce.angle = lerpAngle(ce.angle, ang, Math.min(1, dt * 7));
              ce.walkPhase += dt * 10;

              if (ce.isBoss && dToPlayer > 110 && now - ce.lastAttackTime >= 1650) {
                ce.lastAttackTime = now;
                for (let b = -1; b <= 1; b += 2) {
                  const shotA = ang + b * 0.14;
                  sim.landProjectiles.push({
                    id: `cboss_${Date.now()}_${b}`,
                    owner: 'ENEMY',
                    x: ce.x + Math.cos(shotA) * (ce.radius + 6),
                    y: ce.y + Math.sin(shotA) * (ce.radius + 6),
                    vx: Math.cos(shotA) * 240,
                    vy: Math.sin(shotA) * 240,
                    damage: Math.round(ce.damage * 0.85),
                    color: '#C084FC',
                    life: 1.5,
                  });
                }
              }

              if (dToPlayer > ce.radius + 14) {
                const moved = resolveCaveCollision(
                  cave,
                  ce.x + Math.cos(ang) * ce.speed * dt,
                  ce.y + Math.sin(ang) * ce.speed * dt,
                  ce.radius
                );
                ce.x = moved.x;
                ce.y = moved.y;
              } else if (now - ce.lastAttackTime >= 900) {
                ce.lastAttackTime = now;
                const dmg = Math.max(2, Math.round(ce.damage * (1 - totalArmorReduction)));
                sim.playerHp = Math.max(0, sim.playerHp - dmg);
                sim.playerHitFlashUntil = now + 180;
                sim.screenShake = Math.max(sim.screenShake, 3.2);
                soundEngine.playSwordSlash();
                addFloatingText(caveState.playerX, caveState.playerY - 22, `-${dmg}`, '#F87171');
              }
            }
          }

          // Cave Projectiles
          for (let i = sim.landProjectiles.length - 1; i >= 0; i--) {
            const lp = sim.landProjectiles[i];
            lp.x += lp.vx * dt;
            lp.y += lp.vy * dt;
            lp.life -= dt;
            let hit = false;
            if (!isPointInsideCaveWalkable(cave, lp.x, lp.y, 4)) {
              spawnParticles(lp.x, lp.y, 4, lp.color, 'SPARK', 65, 2.2, true);
              hit = true;
            } else if (lp.owner === 'PLAYER') {
              for (const ce of cave.enemies) {
                if (ce.hp <= 0) continue;
                if (dist(lp.x, lp.y, ce.x, ce.y) <= ce.radius + 7) {
                  ce.hp -= lp.damage;
                  ce.hitFlashTime = now;
                  hit = true;
                  soundEngine.playCannonHit();
                  spawnParticles(ce.x, ce.y, 6, '#E879F9', 'SPARK', 80, 2.8, true);
                  addFloatingText(ce.x, ce.y - 20, `-${lp.damage}`, '#FDE047');
                  if (ce.hp <= 0) {
                    spawnParticles(ce.x, ce.y, ce.isBoss ? 22 : 10, '#FBBF24', 'GOLD', 120, 3.6, true);
                    addFloatingText(
                      ce.x,
                      ce.y - 32,
                      ce.isBoss ? `${ce.name} Yenildi! +${ce.goldBounty}G` : `+${ce.goldBounty}G`,
                      ce.isBoss ? '#C084FC' : '#FDE047'
                    );
                    if (ce.isBoss) caveState.bossDefeated = true;
                    if (!onlineActiveRef.current) {
                      commitSave((prev) => ({
                        ...prev,
                        gold: prev.gold + ce.goldBounty,
                        totalGoldEarned: prev.totalGoldEarned + ce.goldBounty,
                        landEnemiesDefeated: prev.landEnemiesDefeated + 1,
                      }));
                    } else {
                      pendingSyncRef.current.landKills += 1;
                    }
                  }
                  break;
                }
              }
              cave.enemies = cave.enemies.filter((e) => e.hp > 0);
            } else if (dist(lp.x, lp.y, caveState.playerX, caveState.playerY) <= 15) {
              const dmg = Math.max(2, Math.round(lp.damage * (1 - totalArmorReduction)));
              sim.playerHp = Math.max(0, sim.playerHp - dmg);
              sim.playerHitFlashUntil = now + 180;
              sim.screenShake = Math.max(sim.screenShake, 2.8);
              spawnParticles(caveState.playerX, caveState.playerY, 6, '#C084FC', 'SPARK', 80, 2.6, true);
              addFloatingText(caveState.playerX, caveState.playerY - 22, `-${dmg}`, '#F87171');
              hit = true;
            }
            if (hit || lp.life <= 0) {
              sim.landProjectiles[i] = sim.landProjectiles[sim.landProjectiles.length - 1];
              sim.landProjectiles.pop();
            }
          }

          if (sim.playerHp <= 0) {
            exitCave(true);
          }
        }
      } else {
      // Lazily populate island enemies & refresh garrison when island ownership changes
      for (const isl of visibleIslands) {
        const effFaction = getEffectiveIslandFaction(
          isl.factionId,
          isl.id,
          isl.isStarter,
          currentSave.kingdom
        );
        const prevSpawnedFaction = sim.spawnedFactionByIsland.get(isl.id);
        if (!sim.spawnedIslandIds.has(isl.id) || (prevSpawnedFaction !== undefined && prevSpawnedFaction !== effFaction)) {
          sim.spawnedIslandIds.add(isl.id);
          sim.spawnedFactionByIsland.set(isl.id, effFaction);

          // Remove outdated defenders if island ownership flipped
          if (prevSpawnedFaction !== undefined && prevSpawnedFaction !== effFaction) {
            sim.islandEnemies = sim.islandEnemies.filter((ie) => ie.islandId !== isl.id);
          }

          if (effFaction !== 'PLAYER') {
            const spawns =
              effFaction === isl.factionId ? isl.enemySpawns : generateIslandGarrison(isl, effFaction);
            for (const sp of spawns) {
              const stats = getIslandArmyStats(sp.tier);
              sim.islandEnemies.push({
                ...sp,
                angle: Math.random() * Math.PI * 2,
                hp: stats.hp,
                maxHp: stats.hp,
                alerted: false,
                lastAttackTime: 0,
                hitFlashTime: -1000,
                walkPhase: Math.random() * Math.PI * 2,
                patrolCenter: { x: sp.x, y: sp.y },
                patrolAngle: Math.random() * Math.PI * 2,
                attackSwingTime: 0,
              });
            }
          }
        }
      }

      // Player & Realistic Hydrodynamic Boat Movement
      const abilityActive = now < sim.abilityAuraUntilMs;
      const shipSpeedMult = relicBonuses.shipSpeedMult * (abilityActive ? 1.2 : 1);
      const effectiveMaxBoatSpeed = activeShipSpec.maxSpeed * shipSpeedMult;
      if (sim.isSailing) {
        if (isPlaying) {
          const curCos = Math.cos(sim.boatAngle);
          const curSin = Math.sin(sim.boatAngle);
          const curForward = sim.boatVx * curCos + sim.boatVy * curSin;
          const speedFactor = clamp(Math.abs(curForward) / effectiveMaxBoatSpeed, 0, 1);

          if (inputMag > 0.05) {
            const targetAngle = Math.atan2(iy, ix);
            const angleDiff = Math.atan2(
              Math.sin(targetAngle - sim.boatAngle),
              Math.cos(targetAngle - sim.boatAngle)
            );
            // Rudder turns faster under headway while retaining dockside maneuverability
            const maxTurnStep = activeShipSpec.turnRate * (0.48 + 0.52 * speedFactor) * dt;
            const turnStep = clamp(angleDiff, -maxTurnStep, maxTurnStep);
            sim.boatAngle += turnStep;

            // Sail thrust acts along the hull's current bow heading
            const alignFactor = clamp((Math.cos(angleDiff) + 1) * 0.5, 0.24, 1);
            const bowX = Math.cos(sim.boatAngle);
            const bowY = Math.sin(sim.boatAngle);
            sim.boatVx += bowX * activeShipSpec.accel * shipSpeedMult * inputMag * alignFactor * dt;
            sim.boatVy += bowY * activeShipSpec.accel * shipSpeedMult * inputMag * alignFactor * dt;
          }

          // Decompose velocity into forward & lateral components for keel carving & water drag
          const fX = Math.cos(sim.boatAngle);
          const fY = Math.sin(sim.boatAngle);
          const rX = -fY;
          const rY = fX;
          let fwd = sim.boatVx * fX + sim.boatVy * fY;
          let lat = sim.boatVx * rX + sim.boatVy * rY;

          // Strong lateral keel grip reduces sideways skidding while preserving carving drift
          lat *= Math.exp(-activeShipSpec.lateralGrip * dt);

          // Hydrodynamic hull drag (higher coasting resistance when sails are slackened)
          const coastFactor = inputMag > 0.05 ? 1 : 1.25;
          fwd *= Math.exp(-activeShipSpec.waterDrag * coastFactor * dt);
          fwd = clamp(fwd, -effectiveMaxBoatSpeed * 0.35, effectiveMaxBoatSpeed);

          if (inputMag <= 0.05 && Math.hypot(fwd, lat) < 3) {
            fwd = 0;
            lat = 0;
          }

          sim.boatVx = fX * fwd + rX * lat;
          sim.boatVy = fY * fwd + rY * lat;

          let nextX = sim.boatX + sim.boatVx * dt;
          let nextY = sim.boatY + sim.boatVy * dt;

          for (const isl of visibleIslands) {
            const dx = nextX - isl.centerX;
            const dy = nextY - isl.centerY;
            const d = Math.hypot(dx, dy);
            const minWaterR =
              getIslandRadiusAtAngle(isl, Math.atan2(dy, dx)) + activeShipSpec.hullRadius;
            if (d < minWaterR && d > 0.001) {
              const nx = dx / d;
              const ny = dy / d;
              nextX = isl.centerX + nx * minWaterR;
              nextY = isl.centerY + ny * minWaterR;
              const inwardVel = sim.boatVx * nx + sim.boatVy * ny;
              if (inwardVel < 0) {
                sim.boatVx -= inwardVel * nx * 1.05;
                sim.boatVy -= inwardVel * ny * 1.05;
                sim.boatVx *= 0.9;
                sim.boatVy *= 0.9;
              }
            }
          }

          sim.boatX = nextX;
          sim.boatY = nextY;
          sim.playerX = nextX;
          sim.playerY = nextY;

          const totalSpeed = Math.hypot(sim.boatVx, sim.boatVy);
          sim.boatSpeedRatio = clamp(totalSpeed / effectiveMaxBoatSpeed, 0, 1);

          if (
            sim.boatSpeedRatio > 0.08 &&
            now - sim.lastWakeTime > 58 - sim.boatSpeedRatio * 18
          ) {
            sim.lastWakeTime = now;
            const sternDist = 20 * activeShipSpec.scale;
            const sternX = sim.boatX - fX * sternDist;
            const sternY = sim.boatY - fY * sternDist;
            const wakeSize = (5.5 + Math.random() * 4) * (0.8 + activeShipSpec.scale * 0.45);
            sim.particles.push({
              x: sternX + (Math.random() - 0.5) * 10 * activeShipSpec.scale,
              y: sternY + (Math.random() - 0.5) * 10 * activeShipSpec.scale,
              vx: -fX * 22,
              vy: -fY * 22,
              size: wakeSize,
              color: '#E0F7FA',
              alpha: 0.48,
              life: 0.6,
              maxLife: 0.6,
              type: 'WAKE',
            });

            // Side bow spray when carving through a turn at speed
            if (Math.abs(lat) > 22 && sim.boatSpeedRatio > 0.35) {
              const spraySide = lat > 0 ? -1 : 1;
              const bowOffset = 14 * activeShipSpec.scale;
              const sideOffset = 9 * activeShipSpec.scale * spraySide;
              sim.particles.push({
                x: sim.boatX + fX * bowOffset + rX * sideOffset,
                y: sim.boatY + fY * bowOffset + rY * sideOffset,
                vx: rX * spraySide * 32 - fX * 14,
                vy: rY * spraySide * 32 - fY * 14,
                size: 3.5 * activeShipSpec.scale,
                color: '#F0FDFA',
                alpha: 0.55,
                life: 0.35,
                maxLife: 0.35,
                type: 'WATER',
              });
            }
          }
        } else {
          sim.boatVx *= Math.exp(-6 * dt);
          sim.boatVy *= Math.exp(-6 * dt);
          sim.boatSpeedRatio = Math.max(0, sim.boatSpeedRatio - dt * 4);
        }
      } else {
        sim.boatVx = 0;
        sim.boatVy = 0;
        sim.boatSpeedRatio = Math.max(0, sim.boatSpeedRatio - dt * 4);

        if (isPlaying && inputMag > 0.05) {
          const targetAngle = Math.atan2(iy, ix);
          sim.playerAngle = lerpAngle(sim.playerAngle, targetAngle, Math.min(1, dt * 14));
          sim.walkPhase += dt * 13 * Math.min(1, inputMag);

          const footSpeed = PLAYER_SPEED * crewBonuses.footSpeedMult * (abilityActive ? 1.15 : 1);
          let nextX = sim.playerX + ix * footSpeed * dt;
          let nextY = sim.playerY + iy * footSpeed * dt;

          const currentIsland = findStandingIsland(sim.playerX, sim.playerY);
          if (currentIsland) {
            const dx = nextX - currentIsland.centerX;
            const dy = nextY - currentIsland.centerY;
            const a = Math.atan2(dy, dx);
            const maxLandR = getIslandRadiusAtAngle(currentIsland, a) - 8;
            const d = Math.hypot(dx, dy);
            if (d > maxLandR) {
              nextX = currentIsland.centerX + Math.cos(a) * maxLandR;
              nextY = currentIsland.centerY + Math.sin(a) * maxLandR;
            }

            // Collide with palms, rocks, and landmarks (temples/towers/huts)
            for (const palm of currentIsland.palms) {
              const pd = dist(nextX, nextY, palm.x, palm.y);
              if (pd < 15 && pd > 0.01) {
                const pushA = Math.atan2(nextY - palm.y, nextX - palm.x);
                nextX = palm.x + Math.cos(pushA) * 15;
                nextY = palm.y + Math.sin(pushA) * 15;
              }
            }
            for (const rock of currentIsland.rocks) {
              const rd = dist(nextX, nextY, rock.x, rock.y);
              const minD = rock.radius + 9;
              if (rd < minD && rd > 0.01) {
                const pushA = Math.atan2(nextY - rock.y, nextX - rock.x);
                nextX = rock.x + Math.cos(pushA) * minD;
                nextY = rock.y + Math.sin(pushA) * minD;
              }
            }
            for (const lm of currentIsland.landmarks) {
              if ((lm.type === 'VILLAGE' || lm.type === 'CAMP') && lm.subOffsets) {
                for (const sub of lm.subOffsets) {
                  const hx = lm.x + sub.dx;
                  const hy = lm.y + sub.dy;
                  const hd = dist(nextX, nextY, hx, hy);
                  if (hd < 21 && hd > 0.01) {
                    const pushA = Math.atan2(nextY - hy, nextX - hx);
                    nextX = hx + Math.cos(pushA) * 21;
                    nextY = hy + Math.sin(pushA) * 21;
                  }
                }
              } else {
                const ld = dist(nextX, nextY, lm.x, lm.y);
                const minLD = lm.radius + 4;
                if (ld < minLD && ld > 0.01) {
                  const pushA = Math.atan2(nextY - lm.y, nextX - lm.x);
                  nextX = lm.x + Math.cos(pushA) * minLD;
                  nextY = lm.y + Math.sin(pushA) * minLD;
                }
              }
            }
          }

          sim.playerX = nextX;
          sim.playerY = nextY;
        }
      }

      // Check Weapon Pickups when on foot
      if (isPlaying && !sim.isSailing) {
        const standingIsl = findStandingIsland(sim.playerX, sim.playerY);
        if (standingIsl) {
          for (const wp of standingIsl.weaponPickups) {
            if (
              !currentSave.collectedPickupIds.includes(wp.id) &&
              dist(sim.playerX, sim.playerY, wp.x, wp.y) <= 28
            ) {
              soundEngine.playWeaponPickup();
              spawnParticles(wp.x, wp.y, 18, WEAPONS[wp.weaponId].color, 'GOLD', 120, 3.8, true);
              addFloatingText(
                wp.x,
                wp.y - 24,
                `Silah Bulundu: ${WEAPONS[wp.weaponId].name}!`,
                '#FDE047'
              );
              if (WEAPONS[wp.weaponId].magSize) {
                weaponAmmoRef.current[wp.weaponId] = WEAPONS[wp.weaponId].magSize;
              }
              commitSave((prev) => {
                const nextLoadout = applyWeaponAcquire(prev, wp.weaponId, 'PICKUP');
                return {
                  ...prev,
                  collectedPickupIds: [...prev.collectedPickupIds, wp.id],
                  unlockedWeapons: nextLoadout.unlockedWeapons,
                  weaponSlots: nextLoadout.weaponSlots,
                  equippedWeapon: nextLoadout.equippedWeapon,
                };
              });
              if (onlineActiveRef.current) {
                onlineManagerRef.current?.submitLocalCommand({
                  type: 'cmd:pickup_weapon',
                  pickupId: wp.id,
                  weaponId: wp.weaponId,
                });
              }
            }
          }
        }
      }

      // Build O(1) visible island lookup map and two-tier SpatialGrids for fast combat & separation
      const visibleIslandMap = new Map<string, Island>();
      for (let i = 0; i < visibleIslands.length; i++) {
        visibleIslandMap.set(visibleIslands[i].id, visibleIslands[i]);
      }

      const standingIsl = !sim.isSailing ? findStandingIsland(sim.playerX, sim.playerY) : null;
      const standingIslandEnemies: IslandEnemy[] = [];
      const islandFirstFaction = new Map<string, FactionId>();
      const multiFactionIslands = new Set<string>();

      const enemyCombatGrid = enemyCombatGridRef.current;
      const allyCombatGrid = allyCombatGridRef.current;
      const enemySepGrid = enemySepGridRef.current;
      const allySepGrid = allySepGridRef.current;
      const enemyShipGrid = enemyShipGridRef.current;
      const allyShipGrid = allyShipGridRef.current;
      const enemyQueryBuf = enemyQueryBufRef.current;
      const allyQueryBuf = allyQueryBufRef.current;
      const enemyShipQueryBuf = enemyShipQueryBufRef.current;
      const allyShipQueryBuf = allyShipQueryBufRef.current;

      enemyCombatGrid.clear();
      allyCombatGrid.clear();
      enemySepGrid.clear();
      allySepGrid.clear();
      enemyShipGrid.clear();
      allyShipGrid.clear();

      for (let i = 0; i < sim.islandEnemies.length; i++) {
        const ie = sim.islandEnemies[i];
        if (ie.hp > 0) {
          enemyCombatGrid.insert(ie);
          enemySepGrid.insert(ie);
          if (standingIsl && ie.islandId === standingIsl.id) {
            standingIslandEnemies.push(ie);
          }
          const seen = islandFirstFaction.get(ie.islandId);
          if (seen === undefined) {
            islandFirstFaction.set(ie.islandId, ie.factionId);
          } else if (seen !== ie.factionId) {
            multiFactionIslands.add(ie.islandId);
          }
        }
      }
      for (let i = 0; i < sim.allySoldiers.length; i++) {
        const sol = sim.allySoldiers[i];
        if (sol.hp > 0) {
          allyCombatGrid.insert(sol);
          allySepGrid.insert(sol);
        }
      }
      for (let i = 0; i < sim.enemies.length; i++) {
        if (sim.enemies[i].hp > 0) enemyShipGrid.insert(sim.enemies[i]);
      }
      for (let i = 0; i < sim.allyShips.length; i++) {
        if (sim.allyShips[i].hp > 0) allyShipGrid.insert(sim.allyShips[i]);
      }

      // Coordinated Island Enemy & Massive Garrison AI (Two-Tier SpatialGrid + Target Caching)
      if (isPlaying) {
        const squadLeaders = new Map<string, IslandEnemy>();
        for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
          const ie = sim.islandEnemies[ei];
          if (ie.hp > 0 && ie.squadId && ie.role === 'LEADER') {
            squadLeaders.set(ie.squadId, ie);
          }
        }

        if (!sim.isSailing) {
          let alertedSquads: Set<string> | null = null;
          const activeAlertSq = 1550 * 1550;
          const spotPlayerSq = 255 * 255;
          const spotAllySq = 250 * 250;
          for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
            const ie = sim.islandEnemies[ei];
            if (ie.alerted || ie.hp <= 0) continue;
            if (onlineActiveRef.current && ie.factionId === 'NEUTRAL') continue;
            if ((ei + frameCounter) % 4 !== 0) continue;
            const adx = ie.x - activeCenterX;
            const ady = ie.y - activeCenterY;
            if (adx * adx + ady * ady > activeAlertSq) continue;

            const pdx = ie.x - sim.playerX;
            const pdy = ie.y - sim.playerY;
            const spotPlayer = pdx * pdx + pdy * pdy < spotPlayerSq;
            let spotAlly = false;
            if (!spotPlayer && sim.allySoldiers.length > 0) {
              const nearestSpot = allyCombatGrid.queryNearest(
                ie.x,
                ie.y,
                250,
                (sol) => sol.hp > 0
              );
              spotAlly = nearestSpot.item !== null && nearestSpot.distSq < spotAllySq;
            }
            if (spotPlayer || spotAlly) {
              if (ie.squadId && ie.role === 'LEADER') {
                addFloatingText(ie.x, ie.y - 26, 'Takım Saldırısı!', '#FCA5A5', false);
              }
              ie.alerted = true;
              if (ie.squadId) {
                if (!alertedSquads) alertedSquads = new Set<string>();
                alertedSquads.add(ie.squadId);
              }
            }
          }
          if (alertedSquads && alertedSquads.size > 0) {
            for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
              const ie = sim.islandEnemies[ei];
              if (ie.squadId && alertedSquads.has(ie.squadId)) {
                ie.alerted = true;
              }
            }
          }
        } else if (frameCounter % 6 === 0) {
          const deAlertSq = 520 * 520;
          for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
            const ie = sim.islandEnemies[ei];
            if (!ie.alerted) continue;
            const dx = ie.x - sim.playerX;
            const dy = ie.y - sim.playerY;
            if (dx * dx + dy * dy > deAlertSq) {
              ie.alerted = false;
            }
          }
        }

        const activeEnemySq = 1600 * 1600;
        const alertScanSq = 1100 * 1100;
        for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
          const ie = sim.islandEnemies[ei];
          if (ie.hp <= 0) continue;
          const adx = ie.x - activeCenterX;
          const ady = ie.y - activeCenterY;
          const distActiveSq = adx * adx + ady * ady;
          if (distActiveSq > activeEnemySq) continue;

          const island = visibleIslandMap.get(ie.islandId);
          if (!island) continue;

          const stats = getIslandArmyStats(ie.tier);
          const hasRivalFactions = multiFactionIslands.has(ie.islandId);

          let targetEntityX = sim.playerX;
          let targetEntityY = sim.playerY;
          let targetKind: 'PLAYER' | 'ALLY_SOLDIER' | 'RIVAL_ENEMY' = 'PLAYER';
          let targetAlly: AllySoldier | null = null;
          let targetRival: IslandEnemy | null = null;
          let dToTarget = !sim.isSailing
            ? Math.hypot(ie.x - sim.playerX, ie.y - sim.playerY)
            : Infinity;

          // Validate cached target or rescan periodically
          let needsRescan = now >= (ie.aiNextScanTime ?? 0);
          if (!needsRescan) {
            if (ie.cachedTargetKind === 'ALLY_SOLDIER') {
              if (!sim.isSailing && ie.cachedTargetAlly && ie.cachedTargetAlly.hp > 0) {
                const ds = dist(ie.x, ie.y, ie.cachedTargetAlly.x, ie.cachedTargetAlly.y);
                if (ds < 440 && ds < dToTarget) {
                  dToTarget = ds;
                  targetEntityX = ie.cachedTargetAlly.x;
                  targetEntityY = ie.cachedTargetAlly.y;
                  targetKind = 'ALLY_SOLDIER';
                  targetAlly = ie.cachedTargetAlly;
                } else {
                  needsRescan = true;
                }
              } else {
                needsRescan = true;
              }
            } else if (ie.cachedTargetKind === 'RIVAL_ENEMY') {
              if (ie.cachedTargetRival && ie.cachedTargetRival.hp > 0) {
                const dr = dist(ie.x, ie.y, ie.cachedTargetRival.x, ie.cachedTargetRival.y);
                if (dr < 410 && dr < dToTarget) {
                  dToTarget = dr;
                  targetEntityX = ie.cachedTargetRival.x;
                  targetEntityY = ie.cachedTargetRival.y;
                  targetKind = 'RIVAL_ENEMY';
                  targetRival = ie.cachedTargetRival;
                } else {
                  needsRescan = true;
                }
              } else {
                needsRescan = true;
              }
            }
          }

          if (needsRescan) {
            ie.aiNextScanTime = now + budget.aiScanIntervalMs + (ei % 7) * 20;
            if (!sim.isSailing && sim.allySoldiers.length > 0 && (ie.alerted || distActiveSq < alertScanSq)) {
              const nearestAlly = allyCombatGrid.queryNearest(
                ie.x,
                ie.y,
                400,
                (sol) => sol.hp > 0
              );
              if (nearestAlly.item) {
                const ds = Math.sqrt(nearestAlly.distSq);
                if (ds < dToTarget) {
                  dToTarget = ds;
                  targetEntityX = nearestAlly.item.x;
                  targetEntityY = nearestAlly.item.y;
                  targetKind = 'ALLY_SOLDIER';
                  targetAlly = nearestAlly.item;
                }
              }
            }

            if (hasRivalFactions) {
              const nearestRival = enemyCombatGrid.queryNearest(
                ie.x,
                ie.y,
                380,
                (other) =>
                  other !== ie &&
                  other.hp > 0 &&
                  other.islandId === ie.islandId &&
                  other.factionId !== ie.factionId
              );
              if (nearestRival.item) {
                const dr = Math.sqrt(nearestRival.distSq);
                if (dr < dToTarget) {
                  dToTarget = dr;
                  targetEntityX = nearestRival.item.x;
                  targetEntityY = nearestRival.item.y;
                  targetKind = 'RIVAL_ENEMY';
                  targetRival = nearestRival.item;
                }
              }
            }

            ie.cachedTargetKind = targetKind;
            ie.cachedTargetAlly = targetAlly;
            ie.cachedTargetRival = targetRival;
          }

          const hasTarget =
            targetKind === 'RIVAL_ENEMY' || (!sim.isSailing && ie.alerted && dToTarget < 480);

          let targetX = ie.patrolCenter.x;
          let targetY = ie.patrolCenter.y;
          let moveSpeed = 62;

          if (hasTarget) {
            moveSpeed = stats.moveSpeed;
            const lowHpRetreat = ie.hp < ie.maxHp * 0.28 && (ie.combatStyle === 'RANGED' || ie.tier === 1);
            if (lowHpRetreat) {
              const awayA = Math.atan2(ie.y - targetEntityY, ie.x - targetEntityX);
              targetX = ie.x + Math.cos(awayA) * 90;
              targetY = ie.y + Math.sin(awayA) * 90;
              moveSpeed = stats.moveSpeed * 1.08;
            } else if (ie.combatStyle === 'MELEE') {
              const flankAngle =
                ie.role === 'FLANKER' ? (ei % 2 === 0 ? 0.55 : -0.55) : 0;
              const approachA =
                Math.atan2(ie.y - targetEntityY, ie.x - targetEntityX) + flankAngle;
              targetX = targetEntityX + Math.cos(approachA) * 26;
              targetY = targetEntityY + Math.sin(approachA) * 26;
            } else {
              const awayA = Math.atan2(ie.y - targetEntityY, ie.x - targetEntityX);
              targetX = targetEntityX + Math.cos(awayA) * 165;
              targetY = targetEntityY + Math.sin(awayA) * 165;
            }
          } else if (ie.squadId && ie.role === 'FLANKER') {
            const leader = squadLeaders.get(ie.squadId);
            if (leader) {
              const cosL = Math.cos(leader.angle);
              const sinL = Math.sin(leader.angle);
              targetX = leader.x + cosL * ie.formationOffset.x - sinL * ie.formationOffset.y;
              targetY = leader.y + sinL * ie.formationOffset.x + cosL * ie.formationOffset.y;
              moveSpeed = 86;
            }
          } else {
            ie.patrolAngle += dt * 0.55;
            targetX = ie.patrolCenter.x + Math.cos(ie.patrolAngle) * 72;
            targetY = ie.patrolCenter.y + Math.sin(ie.patrolAngle) * 72;
          }

          const dx = targetX - ie.x;
          const dy = targetY - ie.y;
          const distTargetSq = dx * dx + dy * dy;

          if (distTargetSq > 36) {
            const distTarget = Math.sqrt(distTargetSq);
            const desiredA = Math.atan2(dy, dx);
            ie.angle = lerpAngle(ie.angle, desiredA, Math.min(1, dt * 8));
            let nx = ie.x + (dx / distTarget) * moveSpeed * dt;
            let ny = ie.y + (dy / distTarget) * moveSpeed * dt;

            const idx = nx - island.centerX;
            const idy = ny - island.centerY;
            const innerSafe = island.baseRadius * 0.62;
            const islDistSq = idx * idx + idy * idy;
            if (islDistSq > innerSafe * innerSafe) {
              const ia = Math.atan2(idy, idx);
              const maxR = getIslandRadiusAtAngle(island, ia) - 12;
              if (islDistSq > maxR * maxR) {
                nx = island.centerX + Math.cos(ia) * maxR;
                ny = island.centerY + Math.sin(ia) * maxR;
              }
            }
            ie.x = nx;
            ie.y = ny;
            ie.walkPhase += dt * 10;
          } else if (hasTarget) {
            ie.angle = lerpAngle(
              ie.angle,
              Math.atan2(targetEntityY - ie.y, targetEntityX - ie.x),
              Math.min(1, dt * 10)
            );
          }

          // Capped O(1) neighborhood soft separation via fine SpatialGrid (no atan2/cos/sin)
          if ((ei + frameCounter) % budget.sepStride === 0) {
            enemySepGrid.queryRadiusCapped(ie.x, ie.y, 22, enemyQueryBuf, budget.maxSepNeighbors);
            for (let ej = 0; ej < enemyQueryBuf.length; ej++) {
              const other = enemyQueryBuf[ej];
              if (other === ie || other.hp <= 0) continue;
              const sdx = ie.x - other.x;
              const sdy = ie.y - other.y;
              const sdSq = sdx * sdx + sdy * sdy;
              if (sdSq > 0.04 && sdSq < 441) {
                const sd = Math.sqrt(sdSq);
                const push = ((21 - sd) * 0.35) / sd;
                const px = sdx * push;
                const py = sdy * push;
                ie.x += px;
                ie.y += py;
                other.x -= px;
                other.y -= py;
              }
            }
          }

          // Enemy Attack Execution
          if (hasTarget) {
            const attackCd = ie.combatStyle === 'MELEE' ? 1120 : 1800;
            if (now - ie.lastAttackTime > attackCd) {
              if (ie.combatStyle === 'MELEE' && dToTarget < 36) {
                ie.lastAttackTime = now;
                ie.attackSwingTime = now;
                const dmg = stats.meleeDmg;
                if (now - sim.lastSoldierSfxTime > 95) {
                  sim.lastSoldierSfxTime = now;
                  soundEngine.playSwordSlash();
                }

                if (targetKind === 'RIVAL_ENEMY' && targetRival && targetRival.hp > 0) {
                  targetRival.hp -= dmg;
                  targetRival.hitFlashTime = now;
                  addFloatingText(targetRival.x, targetRival.y - 18, `-${dmg}`, '#FDE047', false);
                } else if (
                  targetKind === 'ALLY_SOLDIER' &&
                  targetAlly &&
                  targetAlly.hp > 0
                ) {
                  const shieldedDmg =
                    targetAlly.type === 'SWORDSMAN' && abilityActive
                      ? Math.max(1, Math.round(dmg * 0.55))
                      : dmg;
                  targetAlly.hp -= shieldedDmg;
                  targetAlly.hitFlashTime = now;
                  addFloatingText(
                    targetAlly.x,
                    targetAlly.y - 18,
                    `-${shieldedDmg}`,
                    '#FCA5A5',
                    false
                  );
                  if (targetAlly.hp <= 0) {
                    pendingSyncRef.current.rosterDirty = true;
                    addFloatingText(targetAlly.x, targetAlly.y - 26, 'Asker Düştü!', '#F87171', false);
                  }
                } else if (targetKind === 'PLAYER') {
                  const reducedDmg = Math.max(
                    1,
                    Math.round(dmg * cycleInfo.enemyPowerMult * (1 - totalArmorReduction))
                  );
                  sim.playerHp = Math.max(0, sim.playerHp - reducedDmg);
                  sim.playerHitFlashUntil = now + 150;
                  sim.screenShake = Math.max(sim.screenShake, 3);
                  addFloatingText(sim.playerX, sim.playerY - 22, `-${reducedDmg}`, '#F87171', false);
                }
              } else if (
                ie.combatStyle === 'RANGED' &&
                dToTarget < 270 &&
                sim.landProjectiles.length < budget.maxLandProjectiles
              ) {
                ie.lastAttackTime = now;
                const shotA = Math.atan2(targetEntityY - ie.y, targetEntityX - ie.x);
                sim.landProjectiles.push({
                  id: `elp_${Date.now()}_${Math.random()}`,
                  owner: 'ENEMY',
                  x: ie.x + Math.cos(shotA) * 14,
                  y: ie.y + Math.sin(shotA) * 14,
                  vx: Math.cos(shotA) * 300,
                  vy: Math.sin(shotA) * 300,
                  damage: stats.rangedDmg,
                  color: ie.squadColor || '#F87171',
                  life: 1.0,
                });
                if (now - sim.lastSoldierSfxTime > 95) {
                  sim.lastSoldierSfxTime = now;
                  soundEngine.playPistolShot();
                }
              }
            }
          }
        }
      }

      // Autonomous & Organic Allied Soldiers AI (Staggered SpatialGrid + Capped Separation)
      if (isPlaying && !sim.isSailing && sim.allySoldiers.length > 0) {
        const { dmgMult } = getSoldierPowerMultiplier(currentSave.kingdom.armyLevel);

        const pickFreeIslandRoamSpot = (isl: Island): Vec2 => {
          const roll = Math.random();
          if (roll < 0.28 && isl.landmarks.length > 0) {
            const lm = isl.landmarks[Math.floor(Math.random() * isl.landmarks.length)];
            const a = Math.random() * Math.PI * 2;
            const d = lm.radius + 24 + Math.random() * 68;
            return { x: lm.x + Math.cos(a) * d, y: lm.y + Math.sin(a) * d };
          }
          if (roll < 0.42 && isl.fortPos) {
            const a = Math.random() * Math.PI * 2;
            const d = 32 + Math.random() * 88;
            return { x: isl.fortPos.x + Math.cos(a) * d, y: isl.fortPos.y + Math.sin(a) * d };
          }
          const a = Math.random() * Math.PI * 2;
          const coastR = getIslandRadiusAtAngle(isl, a);
          const r = coastR * (0.14 + Math.random() * 0.72);
          return { x: isl.centerX + Math.cos(a) * r, y: isl.centerY + Math.sin(a) * r };
        };

        const innerSafeIslandSq = standingIsl ? Math.pow(standingIsl.baseRadius * 0.62, 2) : 0;

        for (let ai = 0; ai < sim.allySoldiers.length; ai++) {
          const sol = sim.allySoldiers[ai];
          if (sol.hp <= 0) continue;
          if (sol.personalSpeedMult === undefined) {
            sol.personalSpeedMult = 0.86 + Math.random() * 0.28;
          }
          if (sol.wanderSeed === undefined) {
            sol.wanderSeed = Math.random() * 1000;
          }

          const spec = SOLDIER_SPECS[sol.type] ?? SOLDIER_SPECS.SWORDSMAN;
          const abilityBoostMult = abilityActive ? 1.25 : 1;
          const effectiveDmg = Math.round(spec.damage * dmgMult * abilityBoostMult);

          // 1. Staggered target acquisition via coarse combat SpatialGrid
          let nearestEnemy: IslandEnemy | null =
            sol.cachedTarget && sol.cachedTarget.hp > 0 ? sol.cachedTarget : null;
          let nearestEnemyDist = Infinity;
          if (nearestEnemy) {
            const edx = nearestEnemy.x - sol.x;
            const edy = nearestEnemy.y - sol.y;
            const edSq = edx * edx + edy * edy;
            if (edSq <= 480 * 480) {
              nearestEnemyDist = Math.sqrt(edSq);
            } else {
              nearestEnemy = null;
            }
          }

          if (!nearestEnemy || now >= (sol.aiNextScanTime ?? 0)) {
            sol.aiNextScanTime = now + budget.aiScanIntervalMs + (ai % 9) * 18;
            const res = enemyCombatGrid.queryNearest(
              sol.x,
              sol.y,
              460,
              (ie) => ie.hp > 0
            );
            if (res.item) {
              nearestEnemy = res.item;
              nearestEnemyDist = Math.sqrt(res.distSq);
            } else {
              nearestEnemy = null;
            }
            sol.cachedTarget = nearestEnemy;
          }

          // Online PvP enemy acquisition (mutual war OR Battle Arena duel ring, never City safe zone)
          let onlineLandTarget: {
            playerId: string;
            unitKind: 'SOLDIER' | 'PLAYER';
            unitId?: string;
            x: number;
            y: number;
          } | null = null;
          let onlineLandDist = Infinity;
          const solInCity = standingIsl?.specialZone === 'CITY';
          const solInArena =
            standingIsl?.specialZone === 'ARENA' &&
            standingIsl.arenaCenter &&
            dist(sol.x, sol.y, standingIsl.arenaCenter.x, standingIsl.arenaCenter.y) <= 198;
          if (!nearestEnemy && onlineActiveRef.current && !solInCity) {
            let bestOnlineSq = 520 * 520;
            for (const rp of remotePlayersRef.current.values()) {
              if (!rp.connected || rp.isSailing || rp.inCaveId) continue;
              const rpInArena =
                solInArena &&
                standingIsl?.arenaCenter &&
                dist(rp.x, rp.y, standingIsl.arenaCenter.x, standingIsl.arenaCenter.y) <= 198;
              if (!onlineAtWarSetRef.current.has(rp.id) && !rpInArena) continue;
              const pdx = rp.x - sol.x;
              const pdy = rp.y - sol.y;
              const pdSq = pdx * pdx + pdy * pdy;
              if (pdSq < bestOnlineSq) {
                bestOnlineSq = pdSq;
                onlineLandTarget = { playerId: rp.id, unitKind: 'PLAYER', x: rp.x, y: rp.y };
              }
              if (rp.soldiers) {
                for (let rsi = 0; rsi < rp.soldiers.length; rsi++) {
                  const rsol = rp.soldiers[rsi];
                  const sdx = rsol.x - sol.x;
                  const sdy = rsol.y - sol.y;
                  const sdSq = sdx * sdx + sdy * sdy;
                  if (sdSq < bestOnlineSq) {
                    bestOnlineSq = sdSq;
                    onlineLandTarget = {
                      playerId: rp.id,
                      unitKind: 'SOLDIER',
                      unitId: rsol.id,
                      x: rsol.x,
                      y: rsol.y,
                    };
                  }
                }
              }
            }
            if (onlineLandTarget) {
              onlineLandDist = Math.sqrt(bestOnlineSq);
            }
          }

          // 2. Army Stance & Target Leashing (CHARGE / FOLLOW / DEFEND)
          const armyStance = currentSave.armyStance ?? 'CHARGE';
          let huntTarget: IslandEnemy | null = nearestEnemy;
          if (armyStance === 'FOLLOW' && nearestEnemy && nearestEnemyDist > 185) {
            huntTarget = null;
          } else if (
            armyStance === 'CHARGE' &&
            !huntTarget &&
            !onlineLandTarget &&
            standingIslandEnemies.length > 0 &&
            ai % 3 !== 0
          ) {
            const cand = standingIslandEnemies[(ai * 7) % standingIslandEnemies.length];
            if (cand && cand.hp > 0) huntTarget = cand;
          }

          let goalX = sol.x;
          let goalY = sol.y;
          let moveSpd = spec.speed * sol.personalSpeedMult;
          let isIdling = false;

          const isRangedSoldier = sol.type === 'MUSKETEER' || sol.type === 'GRENADIER';
          const standingFortWall =
            standingIsl && standingIsl.fortPos && isSiegeableEnemyFort(standingIsl, currentSave)
              ? getOrInitFortWall(standingIsl)
              : null;
          const siegeFortPos =
            standingIsl?.fortPos && standingFortWall && standingFortWall.hp > 0
              ? standingIsl.fortPos
              : null;

          const activeTargetPos: Vec2 | null = huntTarget
            ? { x: huntTarget.x, y: huntTarget.y }
            : onlineLandTarget
            ? { x: onlineLandTarget.x, y: onlineLandTarget.y }
            : siegeFortPos && armyStance !== 'FOLLOW'
            ? siegeFortPos
            : null;

          if (activeTargetPos) {
            sol.roamWaitUntil = 0;
            if (!isRangedSoldier) {
              const flankOffset = ((ai % 7) - 3) * 0.34;
              const approachA =
                Math.atan2(sol.y - activeTargetPos.y, sol.x - activeTargetPos.x) + flankOffset;
              const standoff = !huntTarget && !onlineLandTarget && siegeFortPos ? 40 : 24;
              goalX = activeTargetPos.x + Math.cos(approachA) * standoff;
              goalY = activeTargetPos.y + Math.sin(approachA) * standoff;
            } else {
              const spreadOffset = ((ai % 9) - 4) * 0.17;
              const awayA =
                Math.atan2(sol.y - activeTargetPos.y, sol.x - activeTargetPos.x) + spreadOffset;
              const standDist = (sol.type === 'GRENADIER' ? 172 : 156) + (ai % 4) * 18;
              goalX = activeTargetPos.x + Math.cos(awayA) * standDist;
              goalY = activeTargetPos.y + Math.sin(awayA) * standDist;
            }
          } else if (armyStance === 'FOLLOW') {
            const followA = ai * 2.39996 + now * 0.00035;
            const followR = 38 + (ai % 5) * 18;
            goalX = sim.playerX + Math.cos(followA) * followR;
            goalY = sim.playerY + Math.sin(followA) * followR;
            moveSpd = spec.speed * 0.96;
          } else if (armyStance === 'DEFEND' && standingIsl?.fortPos) {
            const guardA = ai * 2.39996;
            const guardR = 32 + (ai % 5) * 18;
            goalX = standingIsl.fortPos.x + Math.cos(guardA) * guardR;
            goalY = standingIsl.fortPos.y + Math.sin(guardA) * guardR;
            moveSpd = spec.speed * 0.85;
          } else if (standingIsl) {
            if (sol.roamWaitUntil && now < sol.roamWaitUntil) {
              isIdling = true;
              const glanceAngle = Math.sin(now * 0.0012 + sol.wanderSeed) * 1.4;
              sol.angle = lerpAngle(sol.angle, glanceAngle, Math.min(1, dt * 1.8));
            } else {
              if (
                !sol.roamTarget ||
                !isPointOnIsland(standingIsl, sol.roamTarget.x, sol.roamTarget.y, -10)
              ) {
                sol.roamTarget = pickFreeIslandRoamSpot(standingIsl);
              }
              goalX = sol.roamTarget.x;
              goalY = sol.roamTarget.y;
              moveSpd = spec.speed * sol.personalSpeedMult * (0.58 + (ai % 5) * 0.06);
              const gdx = sol.x - goalX;
              const gdy = sol.y - goalY;
              if (gdx * gdx + gdy * gdy <= 484) {
                sol.roamTarget = undefined;
                sol.roamWaitUntil = now + 1200 + Math.random() * 2800;
                isIdling = true;
              }
            }
          } else {
            const wanderA = ai * 2.39996 + Math.sin(now * 0.0005 + ai) * 0.5;
            const wanderR = 90 + (ai % 6) * 28;
            goalX = sim.playerX + Math.cos(wanderA) * wanderR;
            goalY = sim.playerY + Math.sin(wanderA) * wanderR;
            moveSpd = spec.speed * 0.9;
          }

          if (!isIdling) {
            const dx = goalX - sol.x;
            const dy = goalY - sol.y;
            const dGoalSq = dx * dx + dy * dy;
            if (dGoalSq > 49) {
              const dGoal = Math.sqrt(dGoalSq);
              sol.angle = lerpAngle(sol.angle, Math.atan2(dy, dx), Math.min(1, dt * 10));
              let nx = sol.x + (dx / dGoal) * moveSpd * dt;
              let ny = sol.y + (dy / dGoal) * moveSpd * dt;
              if (standingIsl) {
                const idx = nx - standingIsl.centerX;
                const idy = ny - standingIsl.centerY;
                const islDistSq = idx * idx + idy * idy;
                if (islDistSq > innerSafeIslandSq) {
                  const ia = Math.atan2(idy, idx);
                  const maxR = getIslandRadiusAtAngle(standingIsl, ia) - 12;
                  if (islDistSq > maxR * maxR) {
                    nx = standingIsl.centerX + Math.cos(ia) * maxR;
                    ny = standingIsl.centerY + Math.sin(ia) * maxR;
                  }
                }
              }
              sol.x = nx;
              sol.y = ny;
              sol.walkPhase += dt * (activeTargetPos ? 11 : 7.5);
            } else if (nearestEnemy) {
              sol.angle = lerpAngle(
                sol.angle,
                Math.atan2(nearestEnemy.y - sol.y, nearestEnemy.x - sol.x),
                Math.min(1, dt * 12)
              );
            } else if (onlineLandTarget) {
              sol.angle = lerpAngle(
                sol.angle,
                Math.atan2(onlineLandTarget.y - sol.y, onlineLandTarget.x - sol.x),
                Math.min(1, dt * 12)
              );
            } else if (siegeFortPos) {
              sol.angle = lerpAngle(
                sol.angle,
                Math.atan2(siegeFortPos.y - sol.y, siegeFortPos.x - sol.x),
                Math.min(1, dt * 12)
              );
            }
          }

          // Capped O(1) neighborhood separation via fine SpatialGrid (no atan2/cos/sin)
          if ((ai + frameCounter) % budget.sepStride === 0) {
            allySepGrid.queryRadiusCapped(sol.x, sol.y, 20, allyQueryBuf, budget.maxSepNeighbors);
            for (let aj = 0; aj < allyQueryBuf.length; aj++) {
              const other = allyQueryBuf[aj];
              if (other === sol || other.hp <= 0) continue;
              const sdx = sol.x - other.x;
              const sdy = sol.y - other.y;
              const sdSq = sdx * sdx + sdy * sdy;
              if (sdSq > 0.04 && sdSq < 361) {
                const sd = Math.sqrt(sdSq);
                const push = ((19 - sd) * 0.34) / sd;
                const px = sdx * push;
                const py = sdy * push;
                sol.x += px;
                sol.y += py;
                other.x -= px;
                other.y -= py;
              }
            }
          }

          // Soldier Attack Execution (+ Class Ultimates & Fort Wall Siege)
          if (nearestEnemy && nearestEnemy.hp > 0 && now - sol.lastAttackTime >= spec.cooldownMs) {
            const targetE = nearestEnemy;
            const dE = nearestEnemyDist;
            if (!isRangedSoldier && dE <= spec.range + 6) {
              sol.lastAttackTime = now;
              sol.attackSwingTime = now;
              targetE.hp -= effectiveDmg;
              targetE.hitFlashTime = now;
              targetE.alerted = true;
              ensureWarWithFaction(targetE.factionId);
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playSwordSlash();
              }
              spawnParticles(targetE.x, targetE.y, 4, '#F8FAFC', 'SPARK', 80, 2.5, true);
              addFloatingText(targetE.x, targetE.y - 18, `-${effectiveDmg}`, '#6EE7B7', false);
              if (targetE.hp <= 0) {
                recordEnemyDefeat(targetE, now);
                sol.cachedTarget = null;
              }
              if (abilityActive && sol.type === 'HEAVY_GUARD') {
                const cleaveDmg = Math.round(effectiveDmg * 0.65);
                enemyCombatGrid.queryRadius(sol.x, sol.y, 48, enemyQueryBuf);
                for (let ci = 0; ci < enemyQueryBuf.length; ci++) {
                  const ce = enemyQueryBuf[ci];
                  if (ce === targetE || ce.hp <= 0) continue;
                  const cdx = ce.x - sol.x;
                  const cdy = ce.y - sol.y;
                  const cd = Math.hypot(cdx, cdy);
                  if (cd <= 48) {
                    ce.hp -= cleaveDmg;
                    ce.hitFlashTime = now;
                    ce.alerted = true;
                    if (cd > 1) {
                      ce.x += (cdx / cd) * 14;
                      ce.y += (cdy / cd) * 14;
                    }
                    addFloatingText(ce.x, ce.y - 18, `-${cleaveDmg}`, '#FBBF24', false);
                    if (ce.hp <= 0) recordEnemyDefeat(ce, now);
                  }
                }
                spawnParticles(sol.x, sol.y, 7, '#FBBF24', 'SPARK', 105, 3.2, true);
              }
            } else if (
              isRangedSoldier &&
              dE <= spec.range &&
              sim.landProjectiles.length < budget.maxLandProjectiles
            ) {
              sol.lastAttackTime = now;
              const shotA = Math.atan2(targetE.y - sol.y, targetE.x - sol.x);
              const isGrenadier = sol.type === 'GRENADIER';
              const projSpeed = isGrenadier ? 335 : 410;
              const shotOffsets =
                sol.type === 'MUSKETEER' && abilityActive ? [-0.13, 0, 0.13] : [0];
              const grenRadius = abilityActive ? 86 : 54;
              const shotDmg =
                isGrenadier && abilityActive ? Math.round(effectiveDmg * 1.25) : effectiveDmg;
              for (let si = 0; si < shotOffsets.length; si++) {
                if (sim.landProjectiles.length >= budget.maxLandProjectiles) break;
                const a = shotA + shotOffsets[si];
                sim.landProjectiles.push({
                  id: `alp_${Date.now()}_${Math.random()}`,
                  owner: 'PLAYER',
                  x: sol.x + Math.cos(a) * 14,
                  y: sol.y + Math.sin(a) * 14,
                  vx: Math.cos(a) * projSpeed,
                  vy: Math.sin(a) * projSpeed,
                  damage: shotDmg,
                  color: isGrenadier ? '#FB923C' : currentSave.kingdom.bannerColor || '#10B981',
                  life: isGrenadier ? 0.9 : 0.85,
                  splashRadius: isGrenadier ? grenRadius : undefined,
                });
              }
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playPistolShot();
              }
            }
          } else if (
            onlineLandTarget &&
            now - sol.lastAttackTime >= spec.cooldownMs
          ) {
            if (!isRangedSoldier && onlineLandDist <= spec.range + 10) {
              sol.lastAttackTime = now;
              sol.attackSwingTime = now;
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playSwordSlash();
              }
              spawnParticles(onlineLandTarget.x, onlineLandTarget.y, 4, '#F8FAFC', 'SPARK', 80, 2.5, true);
              onlineManagerRef.current?.submitLocalCommand({
                type: 'cmd:pvp_army_hit',
                targetPlayerId: onlineLandTarget.playerId,
                targetUnitKind: onlineLandTarget.unitKind,
                targetUnitId: onlineLandTarget.unitId,
                damage: effectiveDmg,
                x: onlineLandTarget.x,
                y: onlineLandTarget.y,
              });
            } else if (isRangedSoldier && onlineLandDist <= spec.range) {
              sol.lastAttackTime = now;
              const shotA = Math.atan2(onlineLandTarget.y - sol.y, onlineLandTarget.x - sol.x);
              const isGrenadier = sol.type === 'GRENADIER';
              const shotOffsets =
                sol.type === 'MUSKETEER' && abilityActive ? [-0.13, 0, 0.13] : [0];
              const grenRadius = abilityActive ? 86 : 54;
              const shotDmg =
                isGrenadier && abilityActive ? Math.round(effectiveDmg * 1.25) : effectiveDmg;
              for (let si = 0; si < shotOffsets.length; si++) {
                onlineManagerRef.current?.submitLocalCommand({
                  type: 'cmd:land_attack',
                  x: sol.x,
                  y: sol.y,
                  angle: shotA + shotOffsets[si],
                  weaponId: null,
                  damage: shotDmg,
                  range: spec.range,
                  isRanged: true,
                  splashRadius: isGrenadier ? grenRadius : undefined,
                  projColor: isGrenadier ? '#FB923C' : currentSave.kingdom.bannerColor || '#10B981',
                });
              }
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playPistolShot();
              }
            }
          } else if (
            standingIsl &&
            siegeFortPos &&
            now - sol.lastAttackTime >= spec.cooldownMs
          ) {
            const dFort = dist(sol.x, sol.y, siegeFortPos.x, siegeFortPos.y);
            if (!isRangedSoldier && dFort <= spec.range + 36) {
              sol.lastAttackTime = now;
              sol.attackSwingTime = now;
              const wallDmg =
                sol.type === 'HEAVY_GUARD'
                  ? abilityActive
                    ? 42
                    : 24
                  : Math.max(8, Math.round(effectiveDmg * 0.7));
              damageFortWall(standingIsl, wallDmg, now);
            } else if (
              isRangedSoldier &&
              dFort <= spec.range + 16 &&
              sim.landProjectiles.length < budget.maxLandProjectiles
            ) {
              sol.lastAttackTime = now;
              const shotA = Math.atan2(siegeFortPos.y - sol.y, siegeFortPos.x - sol.x);
              const isGrenadier = sol.type === 'GRENADIER';
              const projSpeed = isGrenadier ? 335 : 410;
              sim.landProjectiles.push({
                id: `alp_siege_${Date.now()}_${Math.random()}`,
                owner: 'PLAYER',
                x: sol.x + Math.cos(shotA) * 14,
                y: sol.y + Math.sin(shotA) * 14,
                vx: Math.cos(shotA) * projSpeed,
                vy: Math.sin(shotA) * projSpeed,
                damage: isGrenadier ? (abilityActive ? 38 : 24) : Math.round(effectiveDmg * 0.7),
                color: isGrenadier ? '#FB923C' : currentSave.kingdom.bannerColor || '#10B981',
                life: 0.9,
                splashRadius: isGrenadier ? (abilityActive ? 86 : 54) : undefined,
              });
            }
          }
        }
      }

      // Land Projectiles Update (SpatialGrid accelerated + swap-and-pop removal)
      if (isPlaying) {
        for (let i = sim.landProjectiles.length - 1; i >= 0; i--) {
          const lp = sim.landProjectiles[i];
          lp.x += lp.vx * dt;
          lp.y += lp.vy * dt;
          lp.life -= dt;

          let hit = false;
          if (lp.owner === 'PLAYER') {
            enemyCombatGrid.queryRadius(lp.x, lp.y, 24, enemyQueryBuf);
            const hitR = lp.splashRadius ? 20 : 16;
            const hitRSq = hitR * hitR;
            for (let ei = 0; ei < enemyQueryBuf.length; ei++) {
              const ie = enemyQueryBuf[ei];
              if (ie.hp <= 0) continue;
              const hdx = lp.x - ie.x;
              const hdy = lp.y - ie.y;
              if (hdx * hdx + hdy * hdy <= hitRSq) {
                if (lp.splashRadius) {
                  const blastR = lp.splashRadius;
                  const blastRSq = blastR * blastR;
                  const splashDmg = Math.round(lp.damage * 0.78);
                  if (now - sim.lastSoldierSfxTime > 95) {
                    sim.lastSoldierSfxTime = now;
                    soundEngine.playCannonHit();
                  }
                  sim.screenShake = Math.max(sim.screenShake, 2.2);
                  spawnParticles(lp.x, lp.y, 9, '#FB923C', 'MUZZLE', 120, 4.4, true);
                  spawnParticles(lp.x, lp.y, 5, '#475569', 'SMOKE', 65, 5.2, true);
                  enemyCombatGrid.queryRadius(lp.x, lp.y, blastR, enemyQueryBuf);
                  for (let si = 0; si < enemyQueryBuf.length; si++) {
                    const target = enemyQueryBuf[si];
                    if (target.hp <= 0) continue;
                    const sdx = lp.x - target.x;
                    const sdy = lp.y - target.y;
                    if (sdx * sdx + sdy * sdy <= blastRSq) {
                      const dealt = target === ie ? lp.damage : splashDmg;
                      target.hp -= dealt;
                      target.hitFlashTime = now;
                      target.alerted = true;
                      ensureWarWithFaction(target.factionId);
                      addFloatingText(target.x, target.y - 20, `-${dealt}`, '#FB923C', false);
                      if (target.hp <= 0) {
                        recordEnemyDefeat(target, now);
                      }
                    }
                  }
                } else {
                  ie.hp -= lp.damage;
                  ie.hitFlashTime = now;
                  ie.alerted = true;
                  ensureWarWithFaction(ie.factionId);
                  if (now - sim.lastSoldierSfxTime > 95) {
                    sim.lastSoldierSfxTime = now;
                    soundEngine.playCannonHit();
                  }
                  spawnParticles(ie.x, ie.y, 5, '#FDE047', 'SPARK', 90, 2.8, true);
                  addFloatingText(ie.x, ie.y - 20, `-${lp.damage}`, '#FDE047', false);
                  if (ie.hp <= 0) {
                    recordEnemyDefeat(ie, now);
                  }
                }
                hit = true;
                break;
              }
            }
            if (!hit && standingIsl?.fortPos && isSiegeableEnemyFort(standingIsl, currentSave)) {
              const fdx = lp.x - standingIsl.fortPos.x;
              const fdy = lp.y - standingIsl.fortPos.y;
              if (fdx * fdx + fdy * fdy <= 34 * 34) {
                const wallDmg = lp.splashRadius ? Math.round(lp.damage * 1.45) : lp.damage;
                if (damageFortWall(standingIsl, wallDmg, now)) {
                  if (lp.splashRadius) {
                    spawnParticles(lp.x, lp.y, 9, '#FB923C', 'MUZZLE', 120, 4.4, true);
                  }
                  hit = true;
                }
              }
            }
          } else if (!sim.isSailing) {
            const pdx = lp.x - sim.playerX;
            const pdy = lp.y - sim.playerY;
            if (pdx * pdx + pdy * pdy <= 196) {
              const reducedDmg = Math.max(
                1,
                Math.round(lp.damage * cycleInfo.enemyPowerMult * (1 - totalArmorReduction))
              );
              sim.playerHp = Math.max(0, sim.playerHp - reducedDmg);
              sim.playerHitFlashUntil = now + 150;
              sim.screenShake = Math.max(sim.screenShake, 2.8);
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playCannonHit();
              }
              addFloatingText(sim.playerX, sim.playerY - 22, `-${reducedDmg}`, '#F87171', false);
              hit = true;
            } else {
              allyCombatGrid.queryRadius(lp.x, lp.y, 20, allyQueryBuf);
              for (let ai = 0; ai < allyQueryBuf.length; ai++) {
                const ally = allyQueryBuf[ai];
                if (ally.hp <= 0) continue;
                const adx = lp.x - ally.x;
                const ady = lp.y - ally.y;
                if (adx * adx + ady * ady <= 169) {
                  const effectiveProjDmg =
                    ally.type === 'SWORDSMAN' && abilityActive
                      ? Math.max(1, Math.round(lp.damage * 0.55))
                      : lp.damage;
                  ally.hp -= effectiveProjDmg;
                  ally.hitFlashTime = now;
                  if (now - sim.lastSoldierSfxTime > 95) {
                    sim.lastSoldierSfxTime = now;
                    soundEngine.playCannonHit();
                  }
                  addFloatingText(ally.x, ally.y - 18, `-${effectiveProjDmg}`, '#FCA5A5', false);
                  if (ally.hp <= 0) {
                    pendingSyncRef.current.rosterDirty = true;
                    addFloatingText(ally.x, ally.y - 24, 'Asker Düştü!', '#F87171', false);
                  }
                  hit = true;
                  break;
                }
              }
            }
          }

          if (!hit && lp.life <= 0 && lp.splashRadius && lp.owner === 'PLAYER') {
            const blastR = lp.splashRadius;
            const blastRSq = blastR * blastR;
            const splashDmg = Math.round(lp.damage * 0.78);
            spawnParticles(lp.x, lp.y, 8, '#FB923C', 'MUZZLE', 110, 4.0, true);
            enemyCombatGrid.queryRadius(lp.x, lp.y, blastR, enemyQueryBuf);
            for (let si = 0; si < enemyQueryBuf.length; si++) {
              const target = enemyQueryBuf[si];
              if (target.hp <= 0) continue;
              const sdx = lp.x - target.x;
              const sdy = lp.y - target.y;
              if (sdx * sdx + sdy * sdy <= blastRSq) {
                target.hp -= splashDmg;
                target.hitFlashTime = now;
                target.alerted = true;
                ensureWarWithFaction(target.factionId);
                addFloatingText(target.x, target.y - 20, `-${splashDmg}`, '#FB923C', false);
                if (target.hp <= 0) {
                  recordEnemyDefeat(target, now);
                }
              }
            }
          }

          if (hit || lp.life <= 0) {
            sim.landProjectiles[i] = sim.landProjectiles[sim.landProjectiles.length - 1];
            sim.landProjectiles.pop();
          }
        }
      }

      // Single O(N) swap-and-pop compaction pass for defeated land enemies & fallen soldiers
      for (let ei = sim.islandEnemies.length - 1; ei >= 0; ei--) {
        if (sim.islandEnemies[ei].hp <= 0) {
          const dead = sim.islandEnemies[ei];
          if (sim.particles.length < budget.maxParticles) {
            spawnParticles(dead.x, dead.y, 6, dead.squadColor, 'SPARK', 90, 3, true);
          }
          sim.islandEnemies[ei] = sim.islandEnemies[sim.islandEnemies.length - 1];
          sim.islandEnemies.pop();
        }
      }
      for (let ai = sim.allySoldiers.length - 1; ai >= 0; ai--) {
        if (sim.allySoldiers[ai].hp <= 0) {
          sim.allySoldiers[ai] = sim.allySoldiers[sim.allySoldiers.length - 1];
          sim.allySoldiers.pop();
          pendingSyncRef.current.rosterDirty = true;
          pendingSyncRef.current.soldiersLost += 1;
        }
      }

      // Safe recovery if Player HP reaches 0 on foot
      if (isPlaying && !sim.isSailing && sim.playerHp <= 0) {
        const ownStarterId = onlineActiveRef.current
          ? `starter_${identityRef.current.playerId}`
          : '';
        const starter = onlineActiveRef.current
          ? worldManagerRef.current.getIslandById(ownStarterId) ??
            worldManagerRef.current.getStarterIslands()[0] ??
            null
          : worldManagerRef.current.getIslandAtSector(0, 0);
        const dockA = starter?.traderDock?.angle ?? 0.12;
        const coastR = starter ? getIslandRadiusAtAngle(starter, dockA) : 290;
        const sx0 = starter?.centerX ?? 0;
        const sy0 = starter?.centerY ?? 0;
        const safePlayerX = sx0 + Math.cos(dockA) * (coastR * 0.45);
        const safePlayerY = sy0 + Math.sin(dockA) * (coastR * 0.45);
        const safeBoatX = sx0 + Math.cos(dockA) * (coastR + 36);
        const safeBoatY = sy0 + Math.sin(dockA) * (coastR + 36);

        sim.playerX = safePlayerX;
        sim.playerY = safePlayerY;
        sim.boatX = safeBoatX;
        sim.boatY = safeBoatY;
        sim.playerHp = 70;
        sim.landProjectiles = [];
        sim.allySoldiers.forEach((sol, idx) => {
          sol.x = safePlayerX + (idx % 3) * 18 - 18;
          sol.y = safePlayerY + Math.floor(idx / 3) * 18 + 18;
        });
        addFloatingText(safePlayerX, safePlayerY - 26, 'Limana Taşındın!', '#FBBF24');
        commitSave((prev) => ({
          ...prev,
          playerHp: 70,
          player: { ...prev.player, x: safePlayerX, y: safePlayerY, isSailing: false },
          boat: { ...prev.boat, x: safeBoatX, y: safeBoatY },
        }));
      }

      // Gentle player & soldier heal on Starter Capital / Conquered Islands + passive Crew regen
      if (isPlaying && !sim.isSailing) {
        const standing = findStandingIsland(sim.playerX, sim.playerY);
        const isOwnStarter =
          standing &&
          standing.isStarter &&
          (!onlineActiveRef.current || standing.id === `starter_${identityRef.current.playerId}`);
        const isFriendlyTerritory =
          standing &&
          (isOwnStarter ||
            standing.specialZone === 'CITY' ||
            currentSave.kingdom.conqueredIslandIds.includes(standing.id));
        if (isFriendlyTerritory) {
          if (sim.playerHp < effectiveMaxPlayerHp) {
            sim.playerHp = Math.min(effectiveMaxPlayerHp, sim.playerHp + 14 * dt);
          }
          for (const sol of sim.allySoldiers) {
            if (sol.hp < sol.maxHp) {
              sol.hp = Math.min(sol.maxHp, sol.hp + 10 * dt);
            }
          }
        } else if (now - sim.playerHitFlashUntil > 4500 && sim.playerHp < effectiveMaxPlayerHp) {
          sim.playerHp = Math.min(
            effectiveMaxPlayerHp,
            sim.playerHp + crewBonuses.hpRegenPerSec * relicBonuses.regenMult * dt
          );
        }
      }

      // Offline Arena 3-Wave Challenge Progression
      if (isPlaying && !onlineActiveRef.current && sim.arenaChallenge?.active) {
        const ac = sim.arenaChallenge;
        const arenaStanding = !sim.isSailing ? findStandingIsland(sim.playerX, sim.playerY) : null;
        if (sim.isSailing || !arenaStanding || arenaStanding.id !== ac.islandId) {
          sim.islandEnemies = sim.islandEnemies.filter((ie) => !ie.id.startsWith('arena_wave_'));
          sim.arenaChallenge = null;
        } else {
          const remaining = sim.islandEnemies.some(
            (ie) => ie.hp > 0 && ie.id.startsWith('arena_wave_')
          );
          if (!remaining) {
            if (ac.wave < ac.totalWaves) {
              ac.wave += 1;
              startOfflineArenaWave(arenaStanding, ac.wave);
            } else {
              const rewardGold = 180;
              soundEngine.playArenaBell();
              spawnParticles(ac.centerX, ac.centerY, 30, '#F97316', 'GOLD', 150, 4.4, true);
              const grantHarpoon = !currentSave.unlockedWeapons.includes('ANCIENT_HARPOON');
              addFloatingText(
                ac.centerX,
                ac.centerY - 40,
                grantHarpoon
                  ? `Arena Şampiyonu! +${rewardGold}G & Kadim Zıpkın!`
                  : `Arena Şampiyonu! +${rewardGold} Altın!`,
                '#FBBF24'
              );
              sim.arenaChallenge = null;
              if (grantHarpoon && WEAPONS.ANCIENT_HARPOON.magSize) {
                weaponAmmoRef.current.ANCIENT_HARPOON = WEAPONS.ANCIENT_HARPOON.magSize;
              }
              commitSave((prev) => {
                const nextLoadout = grantHarpoon
                  ? applyWeaponAcquire(prev, 'ANCIENT_HARPOON', 'PICKUP')
                  : null;
                return {
                  ...prev,
                  gold: prev.gold + rewardGold,
                  totalGoldEarned: prev.totalGoldEarned + rewardGold,
                  arenaWinsCount: (prev.arenaWinsCount ?? 0) + 1,
                  unlockedWeapons: nextLoadout ? nextLoadout.unlockedWeapons : prev.unlockedWeapons,
                  weaponSlots: nextLoadout ? nextLoadout.weaponSlots : prev.weaponSlots,
                  equippedWeapon: nextLoadout ? nextLoadout.equippedWeapon : prev.equippedWeapon,
                };
              });
            }
          }
        }
      }

      // Active Turtle Pet Passive Boat Repair + Fishing & Sea Hazards + Fort Turrets
      if (isPlaying && sim.isSailing && currentSave.activePet === 'TURTLE' && sim.boatHp < maxBoatHp) {
        sim.boatHp = Math.min(maxBoatHp, sim.boatHp + 1.5 * dt);
      }

      if (sim.fishing.active) {
        const fx = sim.isSailing ? sim.boatX : sim.playerX;
        const fy = sim.isSailing ? sim.boatY : sim.playerY;
        if (!isPlaying || dist(fx, fy, sim.fishing.x, sim.fishing.y) > 140 || (sim.isSailing && sim.boatSpeedRatio > 0.35)) {
          sim.fishing.active = false;
          sim.fishing.bite = false;
        } else if (!sim.fishing.bite && now >= sim.fishing.biteAt) {
          sim.fishing.bite = true;
          soundEngine.playRadarPing('WARM');
          sim.waterRipples.push({ x: sim.fishing.x, y: sim.fishing.y, radius: 4, maxRadius: 32, alpha: 0.95 });
          addFloatingText(
            sim.fishing.x,
            sim.fishing.y - 20,
            currentSettings.language === 'en' ? 'Bite! Press G!' : 'Balık Vurdu! [G]',
            '#FDE047'
          );
        } else if (sim.fishing.bite && now >= sim.fishing.expireAt) {
          sim.fishing.active = false;
          sim.fishing.bite = false;
          addFloatingText(
            sim.fishing.x,
            sim.fishing.y - 16,
            currentSettings.language === 'en' ? 'Fish escaped...' : 'Balık kaçtı...',
            '#94A3B8'
          );
        }
      }

      // Sea Hazards (Mines & Supply Barrels - Offline)
      if (isPlaying && !onlineActiveRef.current) {
        sim.hazards = sim.hazards.filter((h) => dist(h.x, h.y, activeCenterX, activeCenterY) < 2200);
        if (sim.hazards.length < 12 && frameCounter % 30 === 0) {
          const ha = Math.random() * Math.PI * 2;
          const hd = 480 + Math.random() * 980;
          const hx = activeCenterX + Math.cos(ha) * hd;
          const hy = activeCenterY + Math.sin(ha) * hd;
          if (!visibleIslands.some((isl) => isPointOnIsland(isl, hx, hy, 48))) {
            sim.hazards.push({
              id: `haz_${Date.now()}_${Math.random()}`,
              kind: Math.random() < 0.58 ? 'MINE' : 'BARREL',
              x: hx,
              y: hy,
              radius: 14,
              bobOffset: Math.random() * Math.PI * 2,
            });
          }
        }
        if (sim.isSailing) {
          for (let hi = sim.hazards.length - 1; hi >= 0; hi--) {
            const h = sim.hazards[hi];
            if (dist(sim.boatX, sim.boatY, h.x, h.y) <= activeShipSpec.hullRadius + h.radius) {
              sim.hazards.splice(hi, 1);
              if (h.kind === 'BARREL') {
                soundEngine.playResourceHarvest();
                const bonusGold = 25 + Math.floor(Math.random() * 25);
                const wAmt = 1 + Math.floor(Math.random() * 2);
                const iAmt = Math.random() < 0.5 ? 1 : 0;
                addFloatingText(
                  h.x,
                  h.y - 24,
                  `+${bonusGold}G · +${wAmt} Odun${iAmt > 0 ? ` · +${iAmt} Demir` : ''}`,
                  '#FDE68A'
                );
                commitSave((prev) => ({
                  ...prev,
                  gold: prev.gold + bonusGold,
                  totalGoldEarned: prev.totalGoldEarned + bonusGold,
                  wood: (prev.wood ?? 0) + wAmt,
                  iron: (prev.iron ?? 0) + iAmt,
                }));
              } else {
                const rawDmg = currentSave.activePet === 'TURTLE' ? 18 : 28;
                const dmg = Math.max(4, Math.round(rawDmg * (1 - totalArmorReduction)));
                sim.boatHp = Math.max(1, sim.boatHp - dmg);
                sim.boatHitFlashUntil = now + 220;
                sim.screenShake = Math.max(sim.screenShake, 5.5);
                soundEngine.playMineExplosion();
                spawnParticles(h.x, h.y, 18, '#F97316', 'MUZZLE', 150, 4.8, true);
                addFloatingText(h.x, h.y - 26, `Mayın! -${dmg}`, '#EF4444');
              }
            }
          }
        }
      }

      // Conquered Island Fort Defense Turrets (Offline)
      if (isPlaying && !onlineActiveRef.current && (currentSave.fortTurretIslandIds?.length ?? 0) > 0) {
        const turretSet = new Set(currentSave.fortTurretIslandIds ?? []);
        for (const isl of visibleIslands) {
          if (!isl.fortPos || !turretSet.has(isl.id)) continue;
          const lastTurretFire = sim.fortTurretFireTimes.get(isl.id) ?? 0;
          if (now - lastTurretFire < 1550) continue;

          const nearEnemyShip = enemyShipGrid.queryNearest(isl.fortPos.x, isl.fortPos.y, 440, (e) => e.hp > 0);
          if (nearEnemyShip.item) {
            sim.fortTurretFireTimes.set(isl.id, now);
            const ang = Math.atan2(nearEnemyShip.item.y - isl.fortPos.y, nearEnemyShip.item.x - isl.fortPos.x);
            sim.cannonballs.push({
              id: `turret_cb_${Date.now()}_${Math.random()}`,
              owner: 'PLAYER',
              x: isl.fortPos.x,
              y: isl.fortPos.y,
              z: 18,
              vx: Math.cos(ang) * 430,
              vy: Math.sin(ang) * 430,
              vz: 40,
              damage: 28,
              life: 1.2,
            });
            soundEngine.playCannonFire(true);
            continue;
          }

          const nearLandEnemy = enemyCombatGrid.queryNearest(isl.fortPos.x, isl.fortPos.y, 380, (ie) => ie.hp > 0);
          if (nearLandEnemy.item) {
            sim.fortTurretFireTimes.set(isl.id, now);
            const ang = Math.atan2(nearLandEnemy.item.y - isl.fortPos.y, nearLandEnemy.item.x - isl.fortPos.x);
            sim.landProjectiles.push({
              id: `turret_lp_${Date.now()}_${Math.random()}`,
              owner: 'PLAYER',
              x: isl.fortPos.x,
              y: isl.fortPos.y,
              vx: Math.cos(ang) * 410,
              vy: Math.sin(ang) * 410,
              damage: 24,
              color: '#34D399',
              life: 1.0,
            });
            soundEngine.playPistolShot();
          }
        }
      }

      // Periodic Nation Warship Spawner (Offline only — Online removes bot warships)
      if (isPlaying && !onlineActiveRef.current) {
        sim.enemies = sim.enemies.filter(
          (e) => dist(e.x, e.y, activeCenterX, activeCenterY) < 2500
        );

        if (sim.enemies.length < 15 && now >= sim.nextEnemySpawnTime) {
          sim.nextEnemySpawnTime = now + (sim.isSailing ? 6500 : 11500) + Math.random() * 5000;
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = 780 + Math.random() * 340;
          const sx = activeCenterX + Math.cos(spawnAngle) * spawnDist;
          const sy = activeCenterY + Math.sin(spawnAngle) * spawnDist;

          const spawnIslands = worldManagerRef.current.getVisibleIslands(sx, sy, 1);
          const inWater = !spawnIslands.some((isl) => isPointOnIsland(isl, sx, sy, 52));
          const outsideSafeZone = Math.hypot(sx, sy) > 640;

          if (inWater && outsideSafeZone) {
            let factionId: EnemyFactionId =
              ENEMY_FACTION_LIST[Math.floor(Math.random() * ENEMY_FACTION_LIST.length)].id;
            let bestDist = Infinity;
            for (const isl of visibleIslands) {
              const eff = getEffectiveIslandFaction(
                isl.factionId,
                isl.id,
                isl.isStarter,
                currentSave.kingdom
              );
              if (eff !== 'NEUTRAL' && eff !== 'PLAYER') {
                const d = dist(sx, sy, isl.centerX, isl.centerY);
                if (d < bestDist) {
                  bestDist = d;
                  factionId = eff;
                }
              }
            }

            // Ensure variety when ships already exist so rival fleets clash on the ocean
            if (sim.enemies.length >= 1 && Math.random() < 0.5) {
              const existing = sim.enemies[0].factionId;
              const others = ENEMY_FACTION_LIST.filter((f) => f.id !== existing);
              factionId = others[Math.floor(Math.random() * others.length)].id;
            }

            const progressScore =
              currentSave.enemiesSunkCount + currentSave.kingdom.conqueredIslandIds.length * 2;
            const remainingCap = Math.max(1, 15 - sim.enemies.length);
            const fleetCount = Math.min(
              remainingCap,
              Math.random() < 0.32 ? 4 : Math.random() < 0.65 ? 3 : 2
            );
            for (let fc = 0; fc < fleetCount; fc++) {
              const tierRoll = Math.random();
              const tier: 1 | 2 | 3 =
                progressScore >= 3 && tierRoll > 0.55
                  ? 3
                  : progressScore >= 1 && tierRoll > 0.28
                  ? 2
                  : 1;
              const shipSpec = getEnemyShipSpec(tier);
              const shipTitle = ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
              const offAngle = fc * 1.45;
              const offX = Math.cos(offAngle) * (fc * 72);
              const offY = Math.sin(offAngle) * (fc * 72);
              sim.enemies.push({
                id: `enemy_${Date.now()}_${fc}_${Math.random()}`,
                name: `${ENEMY_FACTIONS[factionId].shortName} · ${shipSpec.label} (${shipTitle})`,
                factionId,
                x: sx + offX,
                y: sy + offY,
                angle: Math.random() * Math.PI * 2,
                speed: shipSpec.speed,
                hp: shipSpec.maxHp,
                maxHp: shipSpec.maxHp,
                lastFireTime: now,
                hitFlashTime: -1000,
                patrolAngle: Math.random() * Math.PI * 2,
                broadsideSign: Math.random() > 0.5 ? 1 : -1,
                goldBounty: shipSpec.bounty,
                tier,
                isHealer: fc > 0 && tier >= 2 && Math.random() < 0.25,
              });
            }
          }
        }
      }

      // Autonomous & Independent Allied Escort Warships AI (SpatialGrid accelerated, zero O(N^2))
      if (isPlaying && sim.allyShips.length > 0) {
        const pickOpenSeaPatrolPoint = (): Vec2 => {
          for (let attempt = 0; attempt < 8; attempt++) {
            const a = Math.random() * Math.PI * 2;
            const r = 280 + Math.random() * 680;
            const px = sim.boatX + Math.cos(a) * r;
            const py = sim.boatY + Math.sin(a) * r;
            if (!visibleIslands.some((isl) => isPointOnIsland(isl, px, py, 64))) {
              return { x: px, y: py };
            }
          }
          const fa = Math.random() * Math.PI * 2;
          return { x: sim.boatX + Math.cos(fa) * 380, y: sim.boatY + Math.sin(fa) * 380 };
        };

        for (let asi = 0; asi < sim.allyShips.length; asi++) {
          const allyShip = sim.allyShips[asi];
          if (allyShip.hp <= 0) continue;
          if (allyShip.cruiseSpeedMult === undefined) {
            allyShip.cruiseSpeedMult = 0.85 + Math.random() * 0.28;
          }
          if (allyShip.orbitSign === undefined) {
            allyShip.orbitSign = allyShip.slotIndex % 2 === 0 ? 1 : -1;
          }

          let targetEnemy: EnemyShip | null =
            allyShip.cachedTarget && allyShip.cachedTarget.hp > 0 ? allyShip.cachedTarget : null;
          let targetEnemyDist = Infinity;
          if (targetEnemy) {
            const edx = targetEnemy.x - allyShip.x;
            const edy = targetEnemy.y - allyShip.y;
            const dSq = edx * edx + edy * edy;
            if (dSq <= 960 * 960) {
              targetEnemyDist = Math.sqrt(dSq);
            } else {
              targetEnemy = null;
            }
          }

          if (!targetEnemy || now >= (allyShip.aiNextScanTime ?? 0)) {
            allyShip.aiNextScanTime = now + budget.aiScanIntervalMs + (asi % 5) * 25;
            if (sim.enemies.length > 0) {
              const res = enemyShipGrid.queryNearest(
                allyShip.x,
                allyShip.y,
                940,
                (enemy) =>
                  enemy.hp > 0 &&
                  (currentSave.kingdom.atWarWith.includes(enemy.factionId) ||
                    enemy.factionId === 'CORSAIR')
              );
              if (res.item) {
                targetEnemy = res.item;
                targetEnemyDist = Math.sqrt(res.distSq);
              } else {
                targetEnemy = null;
              }
            } else {
              targetEnemy = null;
            }
            allyShip.cachedTarget = targetEnemy;
          }

          let onlineSeaTarget: { x: number; y: number } | null = null;
          let onlineSeaDist = Infinity;
          if (!targetEnemy && onlineActiveRef.current && onlineAtWarSetRef.current.size > 0) {
            let bestShipSq = 940 * 940;
            for (const rp of remotePlayersRef.current.values()) {
              if (!rp.connected || !onlineAtWarSetRef.current.has(rp.id)) continue;
              if (rp.isSailing) {
                const bdx = rp.boatX - allyShip.x;
                const bdy = rp.boatY - allyShip.y;
                const bdSq = bdx * bdx + bdy * bdy;
                if (bdSq < bestShipSq) {
                  bestShipSq = bdSq;
                  onlineSeaTarget = { x: rp.boatX, y: rp.boatY };
                }
              }
              if (rp.ships) {
                for (let shi = 0; shi < rp.ships.length; shi++) {
                  const sh = rp.ships[shi];
                  const sdx = sh.x - allyShip.x;
                  const sdy = sh.y - allyShip.y;
                  const sdSq = sdx * sdx + sdy * sdy;
                  if (sdSq < bestShipSq) {
                    bestShipSq = sdSq;
                    onlineSeaTarget = { x: sh.x, y: sh.y };
                  }
                }
              }
            }
            if (onlineSeaTarget) {
              onlineSeaDist = Math.sqrt(bestShipSq);
            }
          }

          const dToPlayerBoat = dist(allyShip.x, allyShip.y, sim.boatX, sim.boatY);
          let desiredAngle = allyShip.angle;
          let moveSpd = ESCORT_SHIP_STATS.speed * allyShip.cruiseSpeedMult;

          const activeSeaTarget: Vec2 | null = targetEnemy
            ? { x: targetEnemy.x, y: targetEnemy.y }
            : onlineSeaTarget;
          const activeSeaDist = targetEnemy ? targetEnemyDist : onlineSeaDist;

          if (activeSeaTarget) {
            const aToEnemy = Math.atan2(activeSeaTarget.y - allyShip.y, activeSeaTarget.x - allyShip.x);
            const idealRange = 185 + (allyShip.slotIndex % 3) * 36;
            const radial =
              activeSeaDist > idealRange + 45
                ? -0.48
                : activeSeaDist < idealRange - 45
                ? 0.48
                : 0;
            desiredAngle = aToEnemy + allyShip.orbitSign * (Math.PI / 2 + radial);
            moveSpd = ESCORT_SHIP_STATS.speed * (0.94 + (allyShip.slotIndex % 3) * 0.05);
          } else if (dToPlayerBoat > 1350) {
            const scatterA =
              Math.atan2(sim.boatY - allyShip.y, sim.boatX - allyShip.x) +
              allyShip.orbitSign * 0.35;
            desiredAngle = scatterA;
            moveSpd = ESCORT_SHIP_STATS.speed * 1.1;
          } else {
            if (
              !allyShip.patrolTarget ||
              !allyShip.nextDecisionTime ||
              now >= allyShip.nextDecisionTime ||
              dist(allyShip.x, allyShip.y, allyShip.patrolTarget.x, allyShip.patrolTarget.y) < 85
            ) {
              allyShip.patrolTarget = pickOpenSeaPatrolPoint();
              allyShip.nextDecisionTime = now + 4500 + Math.random() * 5000;
            }
            desiredAngle = Math.atan2(
              allyShip.patrolTarget.y - allyShip.y,
              allyShip.patrolTarget.x - allyShip.x
            );
            moveSpd = ESCORT_SHIP_STATS.speed * 0.68 * allyShip.cruiseSpeedMult;
          }

          // SpatialGrid-bounded ship-to-ship & player-boat collision avoidance
          let repelX = 0;
          let repelY = 0;
          if (sim.isSailing && dToPlayerBoat < 115 && dToPlayerBoat > 1) {
            const w = (115 - dToPlayerBoat) / (115 * dToPlayerBoat);
            repelX += (allyShip.x - sim.boatX) * w;
            repelY += (allyShip.y - sim.boatY) * w;
          }
          if ((asi + frameCounter) % budget.sepStride === 0) {
            allyShipGrid.queryRadiusCapped(
              allyShip.x,
              allyShip.y,
              95,
              allyShipQueryBuf,
              budget.maxSepNeighbors + 2
            );
            for (let oj = 0; oj < allyShipQueryBuf.length; oj++) {
              const otherAlly = allyShipQueryBuf[oj];
              if (otherAlly === allyShip) continue;
              const sdx = allyShip.x - otherAlly.x;
              const sdy = allyShip.y - otherAlly.y;
              const dSq = sdx * sdx + sdy * sdy;
              if (dSq > 1 && dSq < 9025) {
                const dOther = Math.sqrt(dSq);
                const w = (95 - dOther) / (95 * dOther);
                repelX += sdx * w;
                repelY += sdy * w;
              }
            }
          }
          if (repelX !== 0 || repelY !== 0) {
            const steerX = Math.cos(desiredAngle) + repelX * 1.5;
            const steerY = Math.sin(desiredAngle) + repelY * 1.5;
            desiredAngle = Math.atan2(steerY, steerX);
          }

          allyShip.angle = lerpAngle(allyShip.angle, desiredAngle, Math.min(1, dt * 2.6));
          let nx = allyShip.x + Math.cos(allyShip.angle) * moveSpd * dt;
          let ny = allyShip.y + Math.sin(allyShip.angle) * moveSpd * dt;

          for (let ii = 0; ii < visibleIslands.length; ii++) {
            const isl = visibleIslands[ii];
            const dx = nx - isl.centerX;
            const dy = ny - isl.centerY;
            const boundR = isl.maxRadius + 38;
            if (dx * dx + dy * dy >= boundR * boundR) continue;
            const d = Math.hypot(dx, dy);
            const coastAngle = Math.atan2(dy, dx);
            const minR = getIslandRadiusAtAngle(isl, coastAngle) + 36;
            if (d < minR && d > 0.01) {
              nx = isl.centerX + Math.cos(coastAngle) * minR;
              ny = isl.centerY + Math.sin(coastAngle) * minR;
              allyShip.angle = lerpAngle(
                allyShip.angle,
                coastAngle + allyShip.orbitSign * (Math.PI / 2),
                0.35
              );
              allyShip.patrolTarget = pickOpenSeaPatrolPoint();
            }
          }
          allyShip.x = nx;
          allyShip.y = ny;

          if (
            sim.particles.length < budget.maxParticles &&
            Math.random() < dt * 9 * budget.wakeSpawnScale
          ) {
            sim.particles.push({
              x: allyShip.x - Math.cos(allyShip.angle) * 20,
              y: allyShip.y - Math.sin(allyShip.angle) * 20,
              vx: 0,
              vy: 0,
              size: 5.5,
              color: '#E0F7FA',
              alpha: 0.4,
              life: 0.45,
              maxLife: 0.45,
              type: 'WAKE',
            });
          }

          if (
            activeSeaTarget &&
            activeSeaDist < 400 &&
            now - allyShip.lastFireTime >= ESCORT_SHIP_STATS.cooldownMs
          ) {
            const fX = Math.cos(allyShip.angle);
            const fY = Math.sin(allyShip.angle);
            const toEX = (activeSeaTarget.x - allyShip.x) / Math.max(1, activeSeaDist);
            const toEY = (activeSeaTarget.y - allyShip.y) / Math.max(1, activeSeaDist);
            if (Math.abs(fX * toEX + fY * toEY) < 0.64) {
              allyShip.lastFireTime = now;
              if (onlineActiveRef.current) {
                if (now - sim.lastCannonSfxTime > 95) {
                  sim.lastCannonSfxTime = now;
                  soundEngine.playCannonFire(true);
                }
                onlineManagerRef.current?.submitLocalCommand({
                  type: 'cmd:fire_cannon',
                  x: allyShip.x,
                  y: allyShip.y,
                  angle: allyShip.angle,
                  cannonCount: 2,
                  damage: ESCORT_SHIP_STATS.damage,
                });
              } else {
                const side: 1 | -1 = fX * toEY - fY * toEX >= 0 ? 1 : -1;
                fireBroadside(
                  'PLAYER',
                  allyShip.x,
                  allyShip.y,
                  allyShip.angle,
                  2,
                  ESCORT_SHIP_STATS.damage,
                  [side],
                  1.05
                );
              }
            }
          }
        }
      }

      // Enemy Ship Broadside AI (SpatialGrid accelerated targeting + fast island bounds)
      if (isPlaying) {
        for (let ei = 0; ei < sim.enemies.length; ei++) {
          const enemy = sim.enemies[ei];
          if (enemy.hp <= 0) continue;
          if (
            enemy.tier === 3 &&
            enemy.hp < enemy.maxHp * 0.85 &&
            now - enemy.hitFlashTime > 6500
          ) {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + 7 * dt);
          }
          if (enemy.isHealer) {
            enemyShipGrid.queryRadius(enemy.x, enemy.y, 260, enemyShipQueryBuf);
            for (let hi = 0; hi < enemyShipQueryBuf.length; hi++) {
              const allyE = enemyShipQueryBuf[hi];
              if (allyE.hp > 0 && allyE.hp < allyE.maxHp && allyE.factionId === enemy.factionId) {
                allyE.hp = Math.min(allyE.maxHp, allyE.hp + 10 * dt);
              }
            }
          }
          const shipSpec = getEnemyShipSpec(enemy.tier);
          const atWarWithPlayer =
            currentSave.kingdom.atWarWith.includes(enemy.factionId) ||
            enemy.factionId === 'CORSAIR';

          let targetX = sim.boatX;
          let targetY = sim.boatY;
          let targetDist = Infinity;

          if (sim.isSailing && atWarWithPlayer) {
            const dBoat = dist(enemy.x, enemy.y, sim.boatX, sim.boatY);
            if (dBoat < 640) {
              targetDist = dBoat;
              targetX = sim.boatX;
              targetY = sim.boatY;
            }
            if (sim.allyShips.length > 0) {
              const nearestAlly = allyShipGrid.queryNearest(
                enemy.x,
                enemy.y,
                640,
                (a) => a.hp > 0
              );
              if (nearestAlly.item) {
                const dAlly = Math.sqrt(nearestAlly.distSq);
                if (dAlly < targetDist) {
                  targetDist = dAlly;
                  targetX = nearestAlly.item.x;
                  targetY = nearestAlly.item.y;
                }
              }
            }
          }

          const nearestRivalShip = enemyShipGrid.queryNearest(
            enemy.x,
            enemy.y,
            700,
            (other) => other !== enemy && other.hp > 0 && other.factionId !== enemy.factionId
          );
          if (nearestRivalShip.item) {
            const dOther = Math.sqrt(nearestRivalShip.distSq);
            if (dOther < targetDist) {
              targetDist = dOther;
              targetX = nearestRivalShip.item.x;
              targetY = nearestRivalShip.item.y;
            }
          }

          let desiredAngle = enemy.patrolAngle;
          const isLowHpShip =
            enemy.tier <= 2 && !enemy.isEventBoss && enemy.hp < enemy.maxHp * 0.32;
          if (isLowHpShip) {
            const nearbyHealer = enemyShipGrid.queryNearest(
              enemy.x,
              enemy.y,
              520,
              (other) =>
                other !== enemy &&
                other.hp > 0 &&
                Boolean(other.isHealer) &&
                other.factionId === enemy.factionId
            );
            if (nearbyHealer.item) {
              desiredAngle = Math.atan2(
                nearbyHealer.item.y - enemy.y,
                nearbyHealer.item.x - enemy.x
              );
            } else if (targetDist < 420) {
              const angleToTarget = Math.atan2(targetY - enemy.y, targetX - enemy.x);
              desiredAngle = angleToTarget + Math.PI + enemy.broadsideSign * 0.38;
            } else {
              enemy.patrolAngle += dt * 0.25 * enemy.broadsideSign;
            }
          } else if (targetDist < 680) {
            const angleToTarget = Math.atan2(targetY - enemy.y, targetX - enemy.x);
            const radialPush = targetDist > 260 ? -0.45 : targetDist < 170 ? 0.5 : 0;
            desiredAngle = angleToTarget + enemy.broadsideSign * (Math.PI / 2 + radialPush);
          } else {
            enemy.patrolAngle += dt * 0.25 * enemy.broadsideSign;
          }

          enemy.angle = lerpAngle(enemy.angle, desiredAngle, Math.min(1, dt * 2.4));
          let nx = enemy.x + Math.cos(enemy.angle) * enemy.speed * dt;
          let ny = enemy.y + Math.sin(enemy.angle) * enemy.speed * dt;

          const extraR = 34 * shipSpec.scale;
          for (let ii = 0; ii < visibleIslands.length; ii++) {
            const isl = visibleIslands[ii];
            const dx = nx - isl.centerX;
            const dy = ny - isl.centerY;
            const boundR = isl.maxRadius + extraR + 4;
            if (dx * dx + dy * dy >= boundR * boundR) continue;
            const d = Math.hypot(dx, dy);
            const minR = getIslandRadiusAtAngle(isl, Math.atan2(dy, dx)) + extraR;
            if (d < minR) {
              const pushA = Math.atan2(dy, dx);
              nx = isl.centerX + Math.cos(pushA) * minR;
              ny = isl.centerY + Math.sin(pushA) * minR;
              enemy.patrolAngle += Math.PI * 0.5;
            }
          }
          enemy.x = nx;
          enemy.y = ny;

          if (
            sim.particles.length < budget.maxParticles &&
            Math.random() < dt * 10 * budget.wakeSpawnScale
          ) {
            sim.particles.push({
              x: enemy.x - Math.cos(enemy.angle) * 24 * shipSpec.scale,
              y: enemy.y - Math.sin(enemy.angle) * 24 * shipSpec.scale,
              vx: 0,
              vy: 0,
              size: 6 * shipSpec.scale,
              color: '#E0F7FA',
              alpha: 0.42,
              life: 0.45,
              maxLife: 0.45,
              type: 'WAKE',
            });
          }

          if (targetDist < 420 && now - enemy.lastFireTime > shipSpec.fireCd) {
            const forwardX = Math.cos(enemy.angle);
            const forwardY = Math.sin(enemy.angle);
            const toTargetX = (targetX - enemy.x) / Math.max(1, targetDist);
            const toTargetY = (targetY - enemy.y) / Math.max(1, targetDist);
            const forwardDot = forwardX * toTargetX + forwardY * toTargetY;

            if (Math.abs(forwardDot) < 0.58) {
              enemy.lastFireTime = now;
              const rightCross = forwardX * toTargetY - forwardY * toTargetX;
              const firingSide: 1 | -1 = rightCross >= 0 ? 1 : -1;
              fireBroadside(
                enemy.factionId,
                enemy.x,
                enemy.y,
                enemy.angle,
                shipSpec.cannons,
                shipSpec.damage,
                [firingSide],
                shipSpec.scale
              );
            }
          }
        }
      }

      // Cannonballs Ballistics (SpatialGrid + swap-and-pop)
      if (isPlaying) {
        let playerPulledToDock = false;
        const isStormActive = activeWorldEventRef.current?.type === 'STORM';
        for (let i = sim.cannonballs.length - 1; i >= 0; i--) {
          const cb = sim.cannonballs[i];
          if (isStormActive) {
            cb.vx += Math.sin(now * 0.001) * 32 * dt;
            cb.vy += 24 * dt;
          }
          cb.x += cb.vx * dt;
          cb.y += cb.vy * dt;
          cb.z += cb.vz * dt;
          cb.vz -= 135 * dt;
          cb.life -= dt;

          if (
            sim.particles.length < budget.maxParticles &&
            Math.random() < dt * 22 * budget.wakeSpawnScale
          ) {
            sim.particles.push({
              x: cb.x,
              y: cb.y,
              z: Math.max(0, cb.z),
              vx: 0,
              vy: 0,
              vz: 8,
              size: 3,
              color: 'rgba(226, 232, 240, 0.7)',
              alpha: 0.55,
              life: 0.25,
              maxLife: 0.25,
              type: 'SMOKE',
            });
          }

          let removed = false;

          if (cb.owner === 'PLAYER') {
            enemyShipGrid.queryRadius(cb.x, cb.y, 42, enemyShipQueryBuf);
            for (let ei = 0; ei < enemyShipQueryBuf.length; ei++) {
              const enemy = enemyShipQueryBuf[ei];
              if (enemy.hp <= 0) continue;
              const hitR = enemy.tier === 3 ? 36 : enemy.tier === 2 ? 30 : 25;
              const dx = cb.x - enemy.x;
              const dy = cb.y - enemy.y;
              if (dx * dx + dy * dy <= hitR * hitR) {
                ensureWarWithFaction(enemy.factionId);
                enemy.hp -= cb.damage;
                enemy.hitFlashTime = now;
                const healRatio = getRepairShellHealRatio(currentSave.upgrades.repairShellsLevel ?? 1);
                if (healRatio > 0 && sim.boatHp < maxBoatHp) {
                  sim.boatHp = Math.min(maxBoatHp, sim.boatHp + Math.max(1, Math.round(cb.damage * healRatio)));
                }
                sim.screenShake = Math.max(sim.screenShake, 3);
                soundEngine.playCannonHit();
                spawnParticles(cb.x, cb.y, 8, '#92400E', 'SPLINTER', 120, 3.6, true);
                spawnParticles(cb.x, cb.y, 5, '#F97316', 'MUZZLE', 90, 4.2, true);
                addFloatingText(enemy.x, enemy.y - 26, `-${cb.damage}`, '#FCA5A5', false);

                if (enemy.hp <= 0) {
                  soundEngine.playEnemySunk();
                  spawnParticles(enemy.x, enemy.y, 18, '#78350F', 'SPLINTER', 150, 4.5, true);
                  spawnParticles(enemy.x, enemy.y, 12, '#FBBF24', 'GOLD', 130, 4.0, true);
                  if (sim.floatingLoot.length < 75) {
                    sim.floatingLoot.push({
                      id: `loot_${Date.now()}_${Math.random()}`,
                      x: enemy.x,
                      y: enemy.y,
                      goldValue: isStormActive ? Math.round(enemy.goldBounty * 1.5) : enemy.goldBounty,
                      bobOffset: Math.random() * Math.PI * 2,
                      life: 45,
                    });
                  }
                  addFloatingText(enemy.x, enemy.y - 36, `${enemy.name} Batırıldı!`, '#FDE047');
                  pendingSyncRef.current.seaKills += 1;
                }

                sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
                sim.cannonballs.pop();
                removed = true;
                break;
              }
            }
            if (!removed && sim.hazards.length > 0) {
              for (let hi = sim.hazards.length - 1; hi >= 0; hi--) {
                const hz = sim.hazards[hi];
                if (hz.kind === 'MINE' && dist(cb.x, cb.y, hz.x, hz.y) <= hz.radius + 10) {
                  sim.hazards.splice(hi, 1);
                  soundEngine.playMineExplosion();
                  spawnParticles(hz.x, hz.y, 14, '#F97316', 'MUZZLE', 140, 4.2, true);
                  addFloatingText(hz.x, hz.y - 20, '+15G', '#FDE047', false);
                  commitSave((prev) => ({ ...prev, gold: prev.gold + 15, totalGoldEarned: prev.totalGoldEarned + 15 }));
                  sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
                  sim.cannonballs.pop();
                  removed = true;
                  break;
                }
              }
            }
            if (!removed && cb.z <= 12) {
              for (let ii = 0; ii < visibleIslands.length; ii++) {
                const isl = visibleIslands[ii];
                if (!isl.fortPos || !isSiegeableEnemyFort(isl, currentSave)) continue;
                const fdx = cb.x - isl.fortPos.x;
                const fdy = cb.y - isl.fortPos.y;
                if (fdx * fdx + fdy * fdy <= 48 * 48 && getOrInitFortWall(isl).hp > 0) {
                  damageFortWall(isl, Math.round(cb.damage * 1.35), now);
                  sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
                  sim.cannonballs.pop();
                  removed = true;
                  break;
                }
              }
            }
          } else {
            let hitOtherShip = false;
            enemyShipGrid.queryRadius(cb.x, cb.y, 42, enemyShipQueryBuf);
            for (let ei = 0; ei < enemyShipQueryBuf.length; ei++) {
              const otherShip = enemyShipQueryBuf[ei];
              if (otherShip.hp <= 0 || otherShip.factionId === cb.owner) continue;
              const hitR = otherShip.tier === 3 ? 35 : otherShip.tier === 2 ? 29 : 24;
              const dx = cb.x - otherShip.x;
              const dy = cb.y - otherShip.y;
              if (dx * dx + dy * dy <= hitR * hitR) {
                otherShip.hp -= cb.damage;
                otherShip.hitFlashTime = now;
                soundEngine.playCannonHit();
                spawnParticles(cb.x, cb.y, 6, '#92400E', 'SPLINTER', 110, 3.3, true);
                if (otherShip.hp <= 0) {
                  soundEngine.playEnemySunk();
                  spawnParticles(otherShip.x, otherShip.y, 14, '#78350F', 'SPLINTER', 140, 4.2, true);
                  if (sim.floatingLoot.length < 75) {
                    sim.floatingLoot.push({
                      id: `loot_${Date.now()}_${Math.random()}`,
                      x: otherShip.x,
                      y: otherShip.y,
                      goldValue: Math.round(otherShip.goldBounty * 0.75),
                      bobOffset: Math.random() * Math.PI * 2,
                      life: 45,
                    });
                  }
                  addFloatingText(otherShip.x, otherShip.y - 30, `${otherShip.name} Batırıldı!`, '#FDE047');
                }
                sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
                sim.cannonballs.pop();
                removed = true;
                hitOtherShip = true;
                break;
              }
            }

            let hitEscort = false;
            if (!hitOtherShip && sim.allyShips.length > 0) {
              allyShipGrid.queryRadius(cb.x, cb.y, 32, allyShipQueryBuf);
              for (let ai = 0; ai < allyShipQueryBuf.length; ai++) {
                const allyShip = allyShipQueryBuf[ai];
                if (allyShip.hp <= 0) continue;
                const dx = cb.x - allyShip.x;
                const dy = cb.y - allyShip.y;
                if (dx * dx + dy * dy <= 529) {
                  allyShip.hp -= cb.damage;
                  allyShip.hitFlashTime = now;
                  soundEngine.playCannonHit();
                  spawnParticles(cb.x, cb.y, 6, '#B45309', 'SPLINTER', 100, 3.2, true);
                  addFloatingText(allyShip.x, allyShip.y - 22, `-${cb.damage}`, '#FCA5A5', false);
                  if (allyShip.hp <= 0) {
                    soundEngine.playEnemySunk();
                    spawnParticles(allyShip.x, allyShip.y, 14, '#78350F', 'SPLINTER', 140, 4.0, true);
                    addFloatingText(allyShip.x, allyShip.y - 30, 'Refakat Gemisi Battı!', '#EF4444');
                    pendingSyncRef.current.shipCountDirty = true;
                  }
                  sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
                  sim.cannonballs.pop();
                  removed = true;
                  hitEscort = true;
                  break;
                }
              }
            }

            if (
              !hitOtherShip &&
              !hitEscort &&
              sim.isSailing &&
              dist(cb.x, cb.y, sim.boatX, sim.boatY) <= activeShipSpec.hullRadius + 3
            ) {
              const reducedDmg = Math.max(
                1,
                Math.round(cb.damage * cycleInfo.enemyPowerMult * (1 - totalArmorReduction))
              );
              sim.boatHp = Math.max(0, sim.boatHp - reducedDmg);
              sim.boatHitFlashUntil = now + 150;
              sim.screenShake = Math.max(sim.screenShake, 4.5);
              soundEngine.playCannonHit();
              spawnParticles(cb.x, cb.y, 8, '#B45309', 'SPLINTER', 110, 3.4, true);
              addFloatingText(sim.boatX, sim.boatY - 26, `-${reducedDmg} Gövde`, '#F87171');

              if (sim.boatHp <= 0) {
                const starter = worldManagerRef.current.getIslandAtSector(0, 0);
                const coastR = starter ? getIslandRadiusAtAngle(starter, 0.12) : 290;
                const safeX = Math.cos(0.12) * (coastR + activeShipSpec.hullRadius + 20);
                const safeY = Math.sin(0.12) * (coastR + activeShipSpec.hullRadius + 20);

                sim.boatX = safeX;
                sim.boatY = safeY;
                sim.boatVx = 0;
                sim.boatVy = 0;
                sim.boatSpeedRatio = 0;
                sim.playerX = safeX;
                sim.playerY = safeY;
                sim.boatHp = Math.round(maxBoatHp * 0.65);
                sim.enemies = [];
                sim.cannonballs = [];
                addFloatingText(safeX, safeY - 32, 'Gemi Limana Çekildi!', '#FBBF24');
                pendingSyncRef.current.shipsLost += 1;
                commitSave((prev) => ({
                  ...prev,
                  boatHp: sim.boatHp,
                  player: { ...prev.player, x: safeX, y: safeY },
                  boat: { ...prev.boat, x: safeX, y: safeY },
                }));
                playerPulledToDock = true;
                break;
              }

              sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
              sim.cannonballs.pop();
              removed = true;
            }
          }

          if (removed) continue;

          let hitLand = false;
          for (let ii = 0; ii < visibleIslands.length; ii++) {
            const isl = visibleIslands[ii];
            const dx = cb.x - isl.centerX;
            const dy = cb.y - isl.centerY;
            if (dx * dx + dy * dy <= isl.maxRadius * isl.maxRadius && isPointOnIsland(isl, cb.x, cb.y, 0)) {
              hitLand = true;
              break;
            }
          }
          if (hitLand) {
            spawnParticles(cb.x, cb.y, 6, '#D9B26F', 'SAND', 80, 3.2, true);
            sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
            sim.cannonballs.pop();
            continue;
          }

          if (cb.z <= 0 || cb.life <= 0) {
            sim.waterRipples.push({
              x: cb.x,
              y: cb.y,
              radius: 4,
              maxRadius: 28,
              alpha: 0.85,
            });
            spawnParticles(cb.x, cb.y, 4, '#E0F7FA', 'WATER', 65, 3, true);
            soundEngine.playWaterSplash();
            sim.cannonballs[i] = sim.cannonballs[sim.cannonballs.length - 1];
            sim.cannonballs.pop();
          }
        }

        // Single swap-and-pop compaction for sunk enemy & escort ships
        if (!playerPulledToDock) {
          for (let ei = sim.enemies.length - 1; ei >= 0; ei--) {
            if (sim.enemies[ei].hp <= 0) {
              sim.enemies[ei] = sim.enemies[sim.enemies.length - 1];
              sim.enemies.pop();
            }
          }
          for (let ai = sim.allyShips.length - 1; ai >= 0; ai--) {
            if (sim.allyShips[ai].hp <= 0) {
              sim.allyShips[ai] = sim.allyShips[sim.allyShips.length - 1];
              sim.allyShips.pop();
              pendingSyncRef.current.shipCountDirty = true;
              pendingSyncRef.current.shipsLost += 1;
            }
          }
        }
      }

      // Floating Loot pickup (both ocean bounty, castaway rafts & island enemy drops, with Golden Monkey magnet)
      if (isPlaying) {
        const hasMonkey = currentSave.activePet === 'MONKEY';
        for (let i = sim.floatingLoot.length - 1; i >= 0; i--) {
          const loot = sim.floatingLoot[i];
          loot.life -= dt;
          if (loot.life <= 0) {
            sim.floatingLoot.splice(i, 1);
            continue;
          }
          const collectorX = sim.isSailing ? sim.boatX : sim.playerX;
          const collectorY = sim.isSailing ? sim.boatY : sim.playerY;
          const pickupR = sim.isSailing ? 56 : 34;
          const dLoot = dist(collectorX, collectorY, loot.x, loot.y);

          if (hasMonkey && dLoot > pickupR && dLoot <= pickupR + 85) {
            const pullAng = Math.atan2(collectorY - loot.y, collectorX - loot.x);
            loot.x += Math.cos(pullAng) * 195 * dt;
            loot.y += Math.sin(pullAng) * 195 * dt;
          }

          if (dLoot <= pickupR) {
            soundEngine.playSellCoins();
            spawnParticles(loot.x, loot.y, 14, '#FBBF24', 'GOLD', 110, 3.6, true);
            if (loot.healHp) {
              sim.playerHp = Math.min(effectiveMaxPlayerHp, sim.playerHp + loot.healHp);
            }
            const reward = hasMonkey ? Math.round(loot.goldValue * 1.1) : loot.goldValue;
            if (loot.kind === 'CASTAWAY_MAP') {
              const wideIslands = worldManagerRef.current.getVisibleIslands(loot.x, loot.y, 4);
              const undiscovered = wideIslands.find(
                (isl) => !saveRef.current.discoveredIslandIds.includes(isl.id)
              );
              addFloatingText(
                loot.x,
                loot.y - 24,
                undiscovered
                  ? `Kazazede Kurtarıldı! +${reward}G · ${undiscovered.name} Haritası`
                  : `Kazazede Kurtarıldı! +${reward}G · +2 Kereste`,
                '#38BDF8'
              );
              sim.floatingLoot.splice(i, 1);
              commitSave((prev) => ({
                ...prev,
                gold: prev.gold + reward,
                totalGoldEarned: prev.totalGoldEarned + reward,
                wood: (prev.wood ?? 0) + 2,
                discoveredIslandIds:
                  undiscovered && !prev.discoveredIslandIds.includes(undiscovered.id)
                    ? [...prev.discoveredIslandIds, undiscovered.id]
                    : prev.discoveredIslandIds,
                playerHp: Math.round(sim.playerHp),
              }));
              if (onlineActiveRef.current && undiscovered) {
                onlineManagerRef.current?.submitLocalCommand({
                  type: 'cmd:discover_islands',
                  islandIds: [undiscovered.id],
                });
              }
              grantNextCaptainLog(loot.x, loot.y - 46);
            } else {
              addFloatingText(
                loot.x,
                loot.y - 22,
                loot.healHp
                  ? `+${reward} Altın · +${loot.healHp} Can`
                  : `+${reward} Altın Ganimet!`,
                '#FDE047'
              );
              sim.floatingLoot.splice(i, 1);
              commitSave((prev) => ({
                ...prev,
                gold: prev.gold + reward,
                totalGoldEarned: prev.totalGoldEarned + reward,
                playerHp: Math.round(sim.playerHp),
              }));
            }
          }
        }
      }

      const nearDock = visibleIslands.some(
        (isl) =>
          isl.traderDock &&
          dist(activeCenterX, activeCenterY, isl.traderDock.x, isl.traderDock.y) <=
            115 + (activeShipSpec.hullRadius - 20)
      );
      if (isPlaying && nearDock && sim.boatHp < maxBoatHp) {
        sim.boatHp = Math.min(maxBoatHp, sim.boatHp + 18 * dt);
      }

      if (isPlaying) {
        const newlyDiscovered: string[] = [];
        for (const isl of visibleIslands) {
          if (
            !currentSave.discoveredIslandIds.includes(isl.id) &&
            dist(activeCenterX, activeCenterY, isl.centerX, isl.centerY) < isl.maxRadius + 380
          ) {
            newlyDiscovered.push(isl.id);
          }
        }
        if (newlyDiscovered.length > 0) {
          const firstIsl = visibleIslands.find((i) => i.id === newlyDiscovered[0]);
          if (firstIsl) {
            addFloatingText(
              firstIsl.centerX,
              firstIsl.centerY - firstIsl.maxRadius - 20,
              `${firstIsl.name} Keşfedildi!`,
              '#7DD3FC'
            );
          }
          commitSave((prev) => ({
            ...prev,
            discoveredIslandIds: Array.from(new Set([...prev.discoveredIslandIds, ...newlyDiscovered])),
          }));
          if (onlineActiveRef.current) {
            onlineManagerRef.current?.submitLocalCommand({
              type: 'cmd:discover_islands',
              islandIds: newlyDiscovered,
            });
          }
        }
      }

      // Island Fort Capture & Progressive Fort Wall Siege Mechanic
      if (isPlaying && !sim.isSailing) {
        const standing = findStandingIsland(sim.playerX, sim.playerY);
        if (standing && standing.fortPos) {
          const onlineOwnerId = onlineActiveRef.current
            ? onlineIslandOwnersRef.current[standing.id]
            : undefined;
          const onlineRule = onlineRoomInfoRef.current?.rule ?? 'PVP';
          const canOnlineCapture =
            onlineActiveRef.current &&
            !standing.isStarter &&
            onlineOwnerId !== identityRef.current.playerId &&
            (!onlineOwnerId ||
              (onlineRule === 'PVP' && onlineAtWarSetRef.current.has(onlineOwnerId)));

          const effFaction = getEffectiveIslandFaction(
            standing.factionId,
            standing.id,
            standing.isStarter,
            currentSave.kingdom
          );
          if ((!onlineActiveRef.current && effFaction !== 'NEUTRAL' && effFaction !== 'PLAYER') || canOnlineCapture) {
            const defendersLeft = standingIslandEnemies.length;
            const wall = !onlineActiveRef.current ? getOrInitFortWall(standing) : { hp: 0, maxHp: 0 };
            const prevProg =
              sim.fortCapture && sim.fortCapture.islandId === standing.id
                ? sim.fortCapture.progress
                : 0;
            const inFortZone =
              dist(sim.playerX, sim.playerY, standing.fortPos.x, standing.fortPos.y) <= 78 ||
              allyCombatGrid.queryNearest(standing.fortPos.x, standing.fortPos.y, 78).item !== null;

            let nextProg = prevProg;
            if (defendersLeft === 0 && wall.hp <= 0 && inFortZone) {
              nextProg = Math.min(1, prevProg + 0.45 * dt);
            } else {
              nextProg = Math.max(0, prevProg - 0.25 * dt);
            }

            if (nextProg >= 1) {
              const conquestBounty = 120;
              soundEngine.playConquestFanfare();
              spawnParticles(
                standing.fortPos.x,
                standing.fortPos.y,
                28,
                currentSave.kingdom.bannerColor || '#10B981',
                'GOLD',
                150,
                4.4,
                true
              );
              addFloatingText(
                standing.fortPos.x,
                standing.fortPos.y - 38,
                `${standing.name} Fethedildi! +${conquestBounty} Altın`,
                '#34D399'
              );
              sim.fortCapture = null;
              sim.fortWallsHpByIsland.delete(standing.id);
              if (onlineActiveRef.current) {
                if (
                  lastClaimSentRef.current.islandId !== standing.id ||
                  now - lastClaimSentRef.current.at > 1500
                ) {
                  lastClaimSentRef.current = { islandId: standing.id, at: now };
                  onlineManagerRef.current?.submitLocalCommand({
                    type: 'cmd:claim_island',
                    islandId: standing.id,
                  });
                }
              } else {
                const factionShort =
                  ENEMY_FACTIONS[effFaction as EnemyFactionId]?.shortName ?? standing.factionId;
                commitSave((prev) => ({
                  ...prev,
                  gold: prev.gold + conquestBounty,
                  totalGoldEarned: prev.totalGoldEarned + conquestBounty,
                  conquestHistory: [
                    ...(prev.conquestHistory ?? []).slice(-29),
                    {
                      islandName: standing.name,
                      factionName: factionShort,
                      dayNumber: cycleInfo.dayNumber,
                    },
                  ],
                  kingdom: {
                    ...prev.kingdom,
                    founded: true,
                    conqueredIslandIds: prev.kingdom.conqueredIslandIds.includes(standing.id)
                      ? prev.kingdom.conqueredIslandIds
                      : [...prev.kingdom.conqueredIslandIds, standing.id],
                  },
                }));
                if (Math.random() < 0.6) {
                  grantNextCaptainLog(standing.fortPos.x, standing.fortPos.y - 56);
                }
              }
            } else {
              sim.fortCapture = {
                islandId: standing.id,
                progress: nextProg,
                defendersLeft,
                wallHp: wall.maxHp > 0 ? wall.hp : undefined,
                maxWallHp: wall.maxHp > 0 ? wall.maxHp : undefined,
              };
            }
          } else {
            sim.fortCapture = null;
          }
        } else {
          sim.fortCapture = null;
        }
      } else {
        sim.fortCapture = null;
      }

      // Passive Kingdom Tribute every 20 seconds (Offline)
      if (isPlaying && !onlineActiveRef.current && currentSave.kingdom.founded && now - sim.lastTributeTime >= 20000) {
        sim.lastTributeTime = now;
        const tribute = 10 + currentSave.kingdom.conqueredIslandIds.length * 15;
        addFloatingText(
          activeCenterX,
          activeCenterY - 40,
          `Devlet Vergisi: +${tribute} Altın`,
          '#FDE047'
        );
        commitSave((prev) => ({
          ...prev,
          gold: prev.gold + tribute,
          totalGoldEarned: prev.totalGoldEarned + tribute,
        }));
      }

      // Rival Nations Geopolitics (Offline only — Online has neutral villagers instead of bot empires)
      if (isPlaying && !onlineActiveRef.current && now >= sim.nextCampaignTime) {
        sim.nextCampaignTime = now + 22000 + Math.random() * 12000;
        const k = currentSave.kingdom;
        const worldIslands = worldManagerRef.current.getVisibleIslands(0, 0, 3);

        // 1) Rival Nation War Declaration on Player
        const playerThreat =
          k.founded || k.conqueredIslandIds.length > 0 || k.soldiers.length >= 4;
        if (playerThreat && Math.random() < 0.42) {
          const peacefulRivals = ENEMY_FACTION_LIST.filter((f) => !k.atWarWith.includes(f.id));
          if (peacefulRivals.length > 0) {
            const aggressor = peacefulRivals[Math.floor(Math.random() * peacefulRivals.length)];
            soundEngine.playWarHorn();
            addFloatingText(
              activeCenterX,
              activeCenterY - 48,
              `${aggressor.name} Sana Savaş Açtı!`,
              '#FCA5A5'
            );
            // Dispatch an immediate raiding flagship near player's waters if space in ocean
            if (sim.enemies.length < 7) {
              const ra = Math.random() * Math.PI * 2;
              const rx = activeCenterX + Math.cos(ra) * 760;
              const ry = activeCenterY + Math.sin(ra) * 760;
              if (!visibleIslands.some((isl) => isPointOnIsland(isl, rx, ry, 45))) {
                const raidTier: 1 | 2 | 3 = k.conqueredIslandIds.length >= 2 ? 3 : 2;
                const raidSpec = getEnemyShipSpec(raidTier);
                sim.enemies.push({
                  id: `raid_${Date.now()}_${Math.random()}`,
                  name: `${aggressor.shortName} Akın Gemisi`,
                  factionId: aggressor.id,
                  x: rx,
                  y: ry,
                  angle: Math.atan2(activeCenterY - ry, activeCenterX - rx),
                  speed: raidSpec.speed,
                  hp: raidSpec.maxHp,
                  maxHp: raidSpec.maxHp,
                  lastFireTime: now,
                  hitFlashTime: -1000,
                  patrolAngle: Math.random() * Math.PI * 2,
                  broadsideSign: Math.random() > 0.5 ? 1 : -1,
                  goldBounty: raidSpec.bounty,
                  tier: raidTier,
                });
              }
            }
            commitSave((prev) => ({
              ...prev,
              kingdom: {
                ...prev.kingdom,
                atWarWith: prev.kingdom.atWarWith.includes(aggressor.id)
                  ? prev.kingdom.atWarWith
                  : [...prev.kingdom.atWarWith, aggressor.id],
              },
            }));
          }
        }

        // 2) Rival Nation Expedition to Conquer Neutral, Rival, or Player Islands
        const attacker = ENEMY_FACTION_LIST[Math.floor(Math.random() * ENEMY_FACTION_LIST.length)].id;
        const attackerIslands = worldIslands.filter(
          (isl) => getEffectiveIslandFaction(isl.factionId, isl.id, isl.isStarter, k) === attacker
        );
        if (attackerIslands.length > 0) {
          const sourceIsl = attackerIslands[Math.floor(Math.random() * attackerIslands.length)];
          const candidateTargets = worldIslands.filter((isl) => {
            if (isl.isStarter || isl.id === sourceIsl.id) return false;
            const owner = getEffectiveIslandFaction(isl.factionId, isl.id, isl.isStarter, k);
            if (owner === attacker) return false;
            if (owner === 'PLAYER' && !k.atWarWith.includes(attacker)) return false;
            return dist(sourceIsl.centerX, sourceIsl.centerY, isl.centerX, isl.centerY) <= 2300;
          });

          if (candidateTargets.length > 0) {
            const target = candidateTargets[Math.floor(Math.random() * candidateTargets.length)];
            const prevOwner = getEffectiveIslandFaction(
              target.factionId,
              target.id,
              target.isStarter,
              k
            );
            const targetDistToPlayer = dist(
              target.centerX,
              target.centerY,
              activeCenterX,
              activeCenterY
            );

            if (targetDistToPlayer > 1100) {
              // Resolve off-screen regional campaign
              const winChance = prevOwner === 'NEUTRAL' ? 0.65 : target.isLarge ? 0.38 : 0.52;
              if (Math.random() < winChance) {
                sim.spawnedIslandIds.delete(target.id);
                sim.spawnedFactionByIsland.delete(target.id);
                sim.islandEnemies = sim.islandEnemies.filter((ie) => ie.islandId !== target.id);

                if (prevOwner === 'PLAYER') {
                  soundEngine.playWarHorn();
                  addFloatingText(
                    activeCenterX,
                    activeCenterY - 58,
                    `${ENEMY_FACTIONS[attacker].shortName}, ${target.name} Adanı Ele Geçirdi!`,
                    '#F87171'
                  );
                } else if (currentSave.discoveredIslandIds.includes(target.id)) {
                  addFloatingText(
                    activeCenterX,
                    activeCenterY - 58,
                    `${ENEMY_FACTIONS[attacker].shortName}, ${target.name} Adasını Fethetti!`,
                    '#FDE047'
                  );
                }

                commitSave((prev) => ({
                  ...prev,
                  kingdom: {
                    ...prev.kingdom,
                    conqueredIslandIds: prev.kingdom.conqueredIslandIds.filter(
                      (id) => id !== target.id
                    ),
                    islandOwners: {
                      ...prev.kingdom.islandOwners,
                      [target.id]: attacker,
                    },
                  },
                }));
              }
            } else if (prevOwner !== 'PLAYER') {
              // Nearby visible rival island: land a massive live 18-soldier invasion force!
              const landAngle = Math.atan2(
                sourceIsl.centerY - target.centerY,
                sourceIsl.centerX - target.centerX
              );
              const coastR = getIslandRadiusAtAngle(target, landAngle);
              const squadId = `${target.id}_invade_${Date.now()}`;
              const invaderTier: 1 | 2 | 3 = target.isLarge ? 3 : 2;
              const stats = getIslandArmyStats(invaderTier);
              const factionColor = ENEMY_FACTIONS[attacker].color;

              for (let m = 0; m < 18; m++) {
                const rank = Math.floor(m / 6);
                const slot = m % 6;
                const a = landAngle + (slot - 2.5) * 0.13;
                const ix = target.centerX + Math.cos(a) * Math.max(24, coastR - 26 - rank * 18);
                const iy = target.centerY + Math.sin(a) * Math.max(24, coastR - 26 - rank * 18);
                const isLeader = m === 0 || m === 6 || m === 12;
                sim.islandEnemies.push({
                  id: `${squadId}_${m}`,
                  islandId: target.id,
                  factionId: attacker,
                  squadId,
                  squadColor: factionColor,
                  role: isLeader ? 'LEADER' : 'FLANKER',
                  combatStyle: rank === 2 ? 'RANGED' : 'MELEE',
                  x: ix,
                  y: iy,
                  formationOffset: { x: (slot - 2.5) * 22, y: -rank * 24 },
                  tier: isLeader ? invaderTier : (Math.max(1, invaderTier - 1) as 1 | 2 | 3),
                  angle: landAngle + Math.PI,
                  hp: stats.hp,
                  maxHp: stats.hp,
                  alerted: false,
                  lastAttackTime: 0,
                  hitFlashTime: -1000,
                  walkPhase: m * 0.7,
                  patrolCenter: target.fortPos ?? { x: target.centerX, y: target.centerY },
                  patrolAngle: Math.random() * Math.PI * 2,
                  attackSwingTime: 0,
                });
              }
              addFloatingText(
                target.centerX,
                target.centerY - target.maxRadius - 12,
                `${ENEMY_FACTIONS[attacker].shortName} Büyük Çıkarması!`,
                factionColor
              );
            }
          }
        }
      }

      const targetCamX = sim.isSailing ? sim.boatX : sim.playerX;
      const targetCamY = sim.isSailing ? sim.boatY : sim.playerY;
      const targetZoom = sim.isSailing
        ? Math.max(0.68, 0.88 - (activeShipSpec.scale - 1) * 0.16)
        : 1.04;
      sim.cameraX += (targetCamX - sim.cameraX) * Math.min(1, dt * 7);
      sim.cameraY += (targetCamY - sim.cameraY) * Math.min(1, dt * 7);
      sim.zoom += (targetZoom - sim.zoom) * Math.min(1, dt * 4);
      }

      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.z !== undefined && p.vz !== undefined) {
          p.z += p.vz * dt;
          p.vz -= 290 * dt;
          if (p.z < 0) {
            p.z = 0;
            p.vz = -p.vz * 0.25;
            p.vx *= 0.65;
            p.vy *= 0.65;
          }
        }
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.life -= dt;
        p.alpha = p.life / p.maxLife;
        if (p.life <= 0) {
          sim.particles[i] = sim.particles[sim.particles.length - 1];
          sim.particles.pop();
        }
      }

      for (let i = sim.waterRipples.length - 1; i >= 0; i--) {
        const r = sim.waterRipples[i];
        r.radius += 52 * dt;
        r.alpha -= 1.5 * dt;
        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          sim.waterRipples[i] = sim.waterRipples[sim.waterRipples.length - 1];
          sim.waterRipples.pop();
        }
      }

      for (let i = sim.floatingTexts.length - 1; i >= 0; i--) {
        const ft = sim.floatingTexts[i];
        ft.y -= 28 * dt;
        ft.life -= dt;
        if (ft.life <= 0) {
          sim.floatingTexts[i] = sim.floatingTexts[sim.floatingTexts.length - 1];
          sim.floatingTexts.pop();
        }
      }

      sim.radarPulses = sim.radarPulses.filter((rp) => now - rp.startTime < 950);

      // Smooth 60fps Remote Player Interpolation + Projectile Extrapolation in Online Mode
      const digProgress =
        sim.digAnimStart > 0 ? clamp((now - sim.digAnimStart) / 300, 0, 1) : 0;
      if (digProgress >= 1) sim.digAnimStart = 0;

      const attackProgress =
        sim.attackAnimStart > 0 ? clamp((now - sim.attackAnimStart) / 220, 0, 1) : 0;
      if (attackProgress >= 1) sim.attackAnimStart = 0;

      if (onlineActiveRef.current) {
        const interp = Math.min(1, dt * 12);
        for (const rp of remotePlayersRef.current.values()) {
          if (Number.isFinite(rp.targetX) && Number.isFinite(rp.targetY)) {
            rp.x = Number.isFinite(rp.x) ? lerp(rp.x, rp.targetX, interp) : rp.targetX;
            rp.y = Number.isFinite(rp.y) ? lerp(rp.y, rp.targetY, interp) : rp.targetY;
          }
          if (Number.isFinite(rp.targetAngle)) {
            rp.angle = Number.isFinite(rp.angle) ? lerpAngle(rp.angle, rp.targetAngle, interp) : rp.targetAngle;
          }
          if (Number.isFinite(rp.targetBoatX) && Number.isFinite(rp.targetBoatY)) {
            rp.boatX = Number.isFinite(rp.boatX) ? lerp(rp.boatX, rp.targetBoatX, interp) : rp.targetBoatX;
            rp.boatY = Number.isFinite(rp.boatY) ? lerp(rp.boatY, rp.targetBoatY, interp) : rp.targetBoatY;
          }
          if (Number.isFinite(rp.targetBoatAngle)) {
            rp.boatAngle = Number.isFinite(rp.boatAngle)
              ? lerpAngle(rp.boatAngle, rp.targetBoatAngle, interp)
              : rp.targetBoatAngle;
          }

          if (rp.soldiers && rp.soldierTargets) {
            for (let si = 0; si < rp.soldiers.length; si++) {
              const rs = rp.soldiers[si];
              const tgt = rp.soldierTargets.get(rs.id);
              if (tgt) {
                rs.x = lerp(rs.x, tgt.x, interp);
                rs.y = lerp(rs.y, tgt.y, interp);
                rs.angle = lerpAngle(rs.angle, tgt.angle, interp);
              }
            }
          }
          if (rp.ships && rp.shipTargets) {
            for (let shi = 0; shi < rp.ships.length; shi++) {
              const sh = rp.ships[shi];
              const tgt = rp.shipTargets.get(sh.id);
              if (tgt) {
                sh.x = lerp(sh.x, tgt.x, interp);
                sh.y = lerp(sh.y, tgt.y, interp);
                sh.angle = lerpAngle(sh.angle, tgt.angle, interp);
              }
            }
          }
        }
        for (const op of onlineProjectilesRef.current) {
          op.x += op.vx * dt;
          op.y += op.vy * dt;
          if (op.kind === 'CANNON') {
            op.vz -= 210 * dt;
            op.z = Math.max(0, op.z + op.vz * dt);
          }
        }

        if (isPlaying && now - lastPoseSendRef.current >= 50) {
          lastPoseSendRef.current = now;
          const sendArmy = now - lastArmyPoseSendRef.current >= 100;
          if (sendArmy) lastArmyPoseSendRef.current = now;
          onlineManagerRef.current?.submitLocalPose({
            x: sim.playerX,
            y: sim.playerY,
            angle: sim.playerAngle,
            boatX: sim.boatX,
            boatY: sim.boatY,
            boatAngle: sim.boatAngle,
            isSailing: sim.isSailing,
            speedRatio: sim.boatSpeedRatio,
            walkPhase: sim.walkPhase,
            digAnimProgress: digProgress,
            attackAnimProgress: attackProgress,
            inCaveId: sim.activeCave?.cave.caveId,
            soldiers:
              sendArmy && !sim.isSailing && !sim.activeCave && sim.allySoldiers.length > 0
                ? sim.allySoldiers.slice(0, 160).map((s) => ({
                    id: s.id,
                    x: Math.round(s.x),
                    y: Math.round(s.y),
                    angle: Math.round(s.angle * 100) / 100,
                    swinging: now - s.attackSwingTime < 220 ? true : undefined,
                  }))
                : undefined,
            ships:
              sendArmy && sim.allyShips.length > 0
                ? sim.allyShips.slice(0, 60).map((sh) => ({
                    id: sh.id,
                    x: Math.round(sh.x),
                    y: Math.round(sh.y),
                    angle: Math.round(sh.angle * 100) / 100,
                  }))
                : undefined,
          });
        }
        if (now - lastVoiceProxUpdateRef.current >= 220) {
          lastVoiceProxUpdateRef.current = now;
          voiceManagerRef.current?.updateProximityVolumes(
            activeCenterX,
            activeCenterY,
            remotePlayersRef.current
          );
        }
      }

      // Flush batched combat losses & kill counts at most every ~380ms to avoid per-death React re-renders
      const pendingSync = pendingSyncRef.current;
      if (
        !onlineActiveRef.current &&
        (pendingSync.rosterDirty ||
          pendingSync.shipCountDirty ||
          pendingSync.landKills > 0 ||
          pendingSync.seaKills > 0 ||
          pendingSync.soldiersLost > 0 ||
          pendingSync.shipsLost > 0) &&
        (modalRef.current === 'KINGDOM' || now - pendingSync.lastSyncAt >= 380)
      ) {
        pendingSync.lastSyncAt = now;
        const addLandKills = pendingSync.landKills;
        const addSeaKills = pendingSync.seaKills;
        const addSoldiersLost = pendingSync.soldiersLost;
        const addShipsLost = pendingSync.shipsLost;
        const syncRoster = pendingSync.rosterDirty;
        const syncShips = pendingSync.shipCountDirty;
        pendingSync.landKills = 0;
        pendingSync.seaKills = 0;
        pendingSync.soldiersLost = 0;
        pendingSync.shipsLost = 0;
        pendingSync.rosterDirty = false;
        pendingSync.shipCountDirty = false;

        commitSave(
          (prev) => ({
            ...prev,
            landEnemiesDefeated: prev.landEnemiesDefeated + addLandKills,
            enemiesSunkCount: prev.enemiesSunkCount + addSeaKills,
            soldiersLostCount: (prev.soldiersLostCount ?? 0) + addSoldiersLost,
            shipsLostCount: (prev.shipsLostCount ?? 0) + addShipsLost,
            kingdom: {
              ...prev.kingdom,
              soldiers: syncRoster
                ? sim.allySoldiers.map((sol) => ({
                    id: sol.id,
                    type: sol.type,
                    hp: Math.max(1, Math.round(sol.hp)),
                    maxHp: sol.maxHp,
                  }))
                : prev.kingdom.soldiers,
              escortShipCount: syncShips ? sim.allyShips.length : prev.kingdom.escortShipCount,
            },
          }),
          true
        );
      }

      if (
        isPlaying &&
        !onlineActiveRef.current &&
        now - sim.lastAutoSaveTime > 2000 &&
        Number.isFinite(sim.playerX) &&
        Number.isFinite(sim.playerY) &&
        Number.isFinite(sim.boatX) &&
        Number.isFinite(sim.boatY)
      ) {
        sim.lastAutoSaveTime = now;
        const updatedSave: SaveData = {
          ...saveRef.current,
          worldTimeSec: sim.worldTimeSec,
          playTimeSec: sim.playTimeSec,
          harvestedNodeIds: Array.from(sim.harvestedNodeIds).slice(-300),
          boatHp: Math.round(sim.boatHp),
          playerHp: Math.round(sim.playerHp),
          kingdom: {
            ...saveRef.current.kingdom,
            soldiers: sim.allySoldiers.map((sol) => ({
              id: sol.id,
              type: sol.type,
              hp: Math.round(sol.hp),
              maxHp: sol.maxHp,
            })),
            escortShipCount: sim.allyShips.length,
          },
          player: {
            x: sim.playerX,
            y: sim.playerY,
            angle: sim.playerAngle,
            isSailing: sim.isSailing,
          },
          boat: {
            x: sim.boatX,
            y: sim.boatY,
            angle: sim.boatAngle,
          },
        };
        saveRef.current = updatedSave;
        persistSaveData(updatedSave);
      }

      const nearBoat =
        !sim.isSailing &&
        dist(sim.playerX, sim.playerY, sim.boatX, sim.boatY) <=
          125 + (activeShipSpec.hullRadius - 20);
      const nearShore = sim.isSailing
        ? findNearestShoreIsland(sim.boatX, sim.boatY, 95 + (activeShipSpec.hullRadius - 20))
        : null;
      const postStandingIsl = !sim.isSailing ? findStandingIsland(sim.playerX, sim.playerY) : null;
      const nearDock =
        !sim.activeCave &&
        visibleIslands.some(
          (isl) =>
            isl.traderDock &&
            dist(activeCenterX, activeCenterY, isl.traderDock.x, isl.traderDock.y) <=
              115 + (activeShipSpec.hullRadius - 20)
        );

      let digTarget: Vec2 | null = null;
      if (!sim.isSailing && postStandingIsl) {
        const tx = sim.playerX + Math.cos(sim.playerAngle) * 19;
        const ty = sim.playerY + Math.sin(sim.playerAngle) * 19;
        digTarget = isPointOnIsland(postStandingIsl, tx, ty, -4)
          ? { x: tx, y: ty }
          : { x: sim.playerX, y: sim.playerY };
      }

      let interactionHint: { x: number; y: number; label: string; color?: string } | null = null;
      let interactLabel: string | null = null;
      const isEnHud = currentSettings.language === 'en';
      if (sim.activeCave) {
        const cave = sim.activeCave.cave;
        const cpx = sim.activeCave.playerX;
        const cpy = sim.activeCave.playerY;
        const nearChest = cave.chests.find((c) => !c.opened && dist(cpx, cpy, c.x, c.y) <= 46);
        const nearAltar = Boolean(
          cave.weaponAltar &&
            !cave.weaponAltar.claimed &&
            dist(cpx, cpy, cave.weaponAltar.x, cave.weaponAltar.y) <= 46
        );
        const nearExit = dist(cpx, cpy, cave.exitPos.x, cave.exitPos.y) <= 50;
        if (nearChest) interactLabel = isEnHud ? 'Open Chest' : 'Sandığı Aç';
        else if (nearAltar) interactLabel = isEnHud ? 'Claim Weapon' : 'Silahı Al';
        else if (nearExit) interactLabel = isEnHud ? 'Exit Cave' : 'Mağaradan Çık';
      } else if (!sim.isSailing && postStandingIsl) {
        const nearCave = postStandingIsl.caves?.find(
          (c) => dist(sim.playerX, sim.playerY, c.x, c.y) <= 46
        );
        if (nearCave) {
          interactLabel = isEnHud ? 'Enter Cave' : 'Mağaraya Gir';
          interactionHint = {
            x: nearCave.x,
            y: nearCave.y - 34,
            label: `[E] ${interactLabel}`,
            color: '#C084FC',
          };
        } else if (
          !onlineActiveRef.current &&
          !sim.arenaChallenge?.active &&
          postStandingIsl.specialZone === 'ARENA' &&
          postStandingIsl.arenaCenter &&
          dist(
            sim.playerX,
            sim.playerY,
            postStandingIsl.arenaCenter.x,
            postStandingIsl.arenaCenter.y
          ) <= 185
        ) {
          interactLabel = isEnHud ? 'Start Arena' : 'Arenaya Gir';
          interactionHint = {
            x: sim.playerX,
            y: sim.playerY - 34,
            label: `[E] ${interactLabel}`,
            color: '#F97316',
          };
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          if (rect.width >= 4 && rect.height >= 4) {
            const stableDprCap = isCoarseDeviceRef.current ? 1.5 : 2;
            const dpr = Math.min(window.devicePixelRatio || 1, stableDprCap);
            const targetW = Math.max(1, Math.floor(rect.width * dpr));
            const targetH = Math.max(1, Math.floor(rect.height * dpr));
            if (Math.abs(canvas.width - targetW) > 2 || Math.abs(canvas.height - targetH) > 2) {
              canvas.width = targetW;
              canvas.height = targetH;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          if (sim.activeCave) {
            const cave = sim.activeCave.cave;
            const cpx = sim.activeCave.playerX;
            const cpy = sim.activeCave.playerY;
            const nearChest =
              cave.chests.find((c) => !c.opened && dist(cpx, cpy, c.x, c.y) <= 46) ?? null;
            const nearAltar = Boolean(
              cave.weaponAltar &&
                !cave.weaponAltar.claimed &&
                dist(cpx, cpy, cave.weaponAltar.x, cave.weaponAltar.y) <= 46
            );
            const nearExit = dist(cpx, cpy, cave.exitPos.x, cave.exitPos.y) <= 50;

            renderCaveFrame(ctx, rect.width, rect.height, {
              timeSec: now / 1000,
              screenShake: sim.screenShake,
              screenShakeIntensity: currentSettings.screenShakeIntensity,
              activeCave: sim.activeCave,
              playerHitFlash: now < sim.playerHitFlashUntil,
              equippedWeapon: currentSave.equippedWeapon,
              attackAnimProgress: attackProgress,
              landProjectiles: sim.landProjectiles,
              particles: sim.particles,
              floatingTexts: sim.floatingTexts,
              nearChest,
              nearAltar,
              nearExit,
              language: currentSettings.language,
            });
          } else {
            const selfId = identityRef.current.playerId;
            const visibleOnlineProjectiles = onlineActiveRef.current
              ? onlineProjectilesRef.current.filter(
                  (op) => !(op.kind === 'LAND' && op.ownerId === selfId)
                )
              : undefined;

            const homeIsl = isPlaying
              ? onlineActiveRef.current
                ? worldManagerRef.current.getIslandById(`starter_${selfId}`) ??
                  worldManagerRef.current.getStarterIslands()[0] ??
                  null
                : worldManagerRef.current.getIslandAtSector(0, 0)
              : null;
            const homeAccent = onlineActiveRef.current
              ? identityRef.current.bannerColor
              : currentSave.kingdom.founded
              ? currentSave.kingdom.bannerColor
              : '#FBBF24';

            const activeEmotes: Array<{ x: number; y: number; emote: string; alpha: number }> = [];
            if (activeEmotesRef.current.length > 0) {
              activeEmotesRef.current = activeEmotesRef.current.filter((e) => e.expiresAt > now);
              for (const e of activeEmotesRef.current) {
                let ex: number | null = null;
                let ey: number | null = null;
                if (e.targetId === selfId) {
                  ex = sim.isSailing ? sim.boatX : sim.playerX;
                  ey = (sim.isSailing ? sim.boatY : sim.playerY) - (sim.isSailing ? 48 : 38);
                } else {
                  const rp = remotePlayersRef.current.get(e.targetId);
                  if (rp && rp.connected && !rp.inCaveId) {
                    ex = rp.isSailing ? rp.boatX : rp.x;
                    ey = (rp.isSailing ? rp.boatY : rp.y) - (rp.isSailing ? 48 : 38);
                  }
                }
                if (ex !== null && ey !== null) {
                  const remain = e.expiresAt - now;
                  const alpha = remain < 500 ? Math.max(0, remain / 500) : 1;
                  activeEmotes.push({ x: ex, y: ey, emote: e.emote, alpha });
                }
              }
            }

            renderGameFrame(ctx, rect.width, rect.height, {
              timeSec: now / 1000,
              camera: { x: sim.cameraX, y: sim.cameraY },
              zoom: sim.zoom,
              screenShake: sim.screenShake,
              islands: visibleIslands,
              craters: currentSave.dugCraters,
              openedTreasureIds: openedTreasureSetRef.current,
              collectedPickupIds: collectedPickupSetRef.current,
              player: {
                x: sim.playerX,
                y: sim.playerY,
                angle: sim.playerAngle,
                isSailing: sim.isSailing,
                walkPhase: sim.walkPhase,
                digAnimProgress: digProgress,
                attackAnimProgress: attackProgress,
                equippedWeapon: currentSave.equippedWeapon,
                hitFlash: now < sim.playerHitFlashUntil,
                canDig: !sim.isSailing && Boolean(postStandingIsl),
                digTarget,
              },
              boat: {
                x: sim.boatX,
                y: sim.boatY,
                angle: sim.boatAngle,
                speedRatio: sim.boatSpeedRatio,
                boatLevel: currentSave.upgrades.boatLevel,
                cannonCountPerSide: getCannonCountPerSide(currentSave.upgrades.cannonLevel),
                hitFlash: now < sim.boatHitFlashUntil,
              },
              enemies: sim.enemies,
              allyShips: sim.allyShips,
              islandEnemies: sim.islandEnemies,
              allySoldiers: sim.allySoldiers,
              landProjectiles: sim.landProjectiles,
              cannonballs: sim.cannonballs,
              floatingLoot: sim.floatingLoot,
              waterRipples: sim.waterRipples,
              radarPulses: sim.radarPulses,
              particles: sim.particles,
              floatingTexts: sim.floatingTexts,
              kingdom: currentSave.kingdom,
              fortCapture: sim.fortCapture,
              showWaves: currentSettings.showWaves,
              nearBoat,
              nearDock,
              remotePlayers: onlineActiveRef.current
                ? Array.from(remotePlayersRef.current.values()).filter((rp) => !rp.inCaveId)
                : undefined,
              onlineProjectiles: visibleOnlineProjectiles,
              onlineIslandOwners: onlineOwnersForRenderRef.current,
              onlineAtWarPlayerIds: onlineAtWarSetRef.current,
              renderLod: budget.renderLod,
              homeIsland: homeIsl
                ? {
                    x: homeIsl.centerX,
                    y: homeIsl.centerY,
                    radius: homeIsl.baseRadius,
                    name: homeIsl.name,
                    accentColor: homeAccent,
                  }
                : null,
              hasTouchControls: hasTouchControlsRef.current,
              colorblindMode: currentSettings.colorblindMode,
              screenShakeIntensity: currentSettings.screenShakeIntensity,
              worldCycle: {
                darknessAlpha: cycleInfo.darknessAlpha,
                tintColor: cycleInfo.tintColor,
              },
              activeWorldEventType: activeWorldEventRef.current?.type ?? null,
              abilityAuraUntilMs: sim.abilityAuraUntilMs,
              abilityActive: now < sim.abilityAuraUntilMs,
              activeEmotes,
              hazards: sim.hazards,
              activePet: currentSave.activePet ?? null,
              fishingState: sim.fishing.active
                ? { active: true, x: sim.fishing.x, y: sim.fishing.y, bite: sim.fishing.bite }
                : null,
              fortTurretIslandIds: new Set(currentSave.fortTurretIslandIds ?? []),
              harvestedNodeIds: sim.harvestedNodeIds,
              interactionHint,
              mapWaypoint: currentSave.mapPin ?? null,
            });
          }
          }
        }
      }

      if (now - lastHudSync > 90) {
        lastHudSync = now;
        const digCd = getDigCooldownMs(currentSave.upgrades.shovelLevel);
        const cannonCd = getCannonCooldownMs(currentSave.upgrades.cannonLevel);
        const radarCd =
          getRadarCooldownMs(currentSave.upgrades.radarLevel) * relicBonuses.cooldownMult;
        const abilityCd = ABILITY_BASE_COOLDOWN_MS * relicBonuses.cooldownMult;
        const attackCd = currentSave.equippedWeapon
          ? WEAPONS[currentSave.equippedWeapon].cooldownMs
          : 400;

        let nearbySeaEnemies = 0;
        for (let i = 0; i < sim.enemies.length; i++) {
          const e = sim.enemies[i];
          const dx = e.x - activeCenterX;
          const dy = e.y - activeCenterY;
          if (dx * dx + dy * dy < 620 * 620) nearbySeaEnemies++;
        }
        let nearbyLandEnemies = 0;
        if (sim.activeCave) {
          nearbyLandEnemies = sim.activeCave.cave.enemies.length;
        } else {
          for (let i = 0; i < sim.islandEnemies.length; i++) {
            const ie = sim.islandEnemies[i];
            if (!ie.alerted) continue;
            const dx = ie.x - activeCenterX;
            const dy = ie.y - activeCenterY;
            if (dx * dx + dy * dy < 420 * 420) nearbyLandEnemies++;
          }
        }

        const isEn = currentSettings.language === 'en';
        const cLabel = isEn
          ? `Day ${cycleInfo.dayNumber} · ${cycleInfo.seasonLabelEn} · ${cycleInfo.periodLabelEn}`
          : `Gün ${cycleInfo.dayNumber} · ${cycleInfo.seasonLabel} · ${cycleInfo.periodLabel}`;
        const canFishNow = !sim.activeCave && (!sim.isSailing || sim.boatSpeedRatio <= 0.28);

        let zoneBanner: { label: string; tone: 'CITY' | 'ARENA' | 'SECRET' | 'CAVE' } | null = null;
        if (sim.activeCave) {
          zoneBanner = { label: sim.activeCave.cave.name, tone: 'CAVE' };
        } else if (!sim.isSailing && postStandingIsl) {
          if (postStandingIsl.specialZone === 'CITY') {
            zoneBanner = {
              label: isEn ? 'Grand City · Safe Gathering Hub' : 'Sosyal Kent · Barış Alanı',
              tone: 'CITY',
            };
          } else if (postStandingIsl.specialZone === 'ARENA') {
            const inRing =
              postStandingIsl.arenaCenter &&
              dist(
                sim.playerX,
                sim.playerY,
                postStandingIsl.arenaCenter.x,
                postStandingIsl.arenaCenter.y
              ) <= 198;
            zoneBanner = {
              label: inRing
                ? isEn
                  ? 'Arena Ring · Open Duel'
                  : 'Savaş Arenası · Düello Alanı'
                : isEn
                ? 'Battle Arena Island'
                : 'Savaş Arenası Adası',
              tone: 'ARENA',
            };
          } else if (postStandingIsl.specialZone === 'SECRET') {
            zoneBanner = {
              label: isEn ? 'Hidden Sanctuary' : 'Gizli Sığınak',
              tone: 'SECRET',
            };
          }
        }

        const normWeapons = normalizeWeaponSlots(
          currentSave.weaponSlots,
          currentSave.unlockedWeapons,
          currentSave.equippedWeapon
        );
        const eqId = normWeapons.equippedWeapon;
        const eqDef = eqId ? WEAPONS[eqId] : null;
        const eqIsRanged = Boolean(eqDef && eqDef.kind === 'RANGED' && eqDef.magSize);
        const eqMaxAmmo = eqIsRanged ? eqDef!.magSize! : null;
        const eqAmmo =
          eqId && eqIsRanged
            ? typeof weaponAmmoRef.current[eqId] === 'number'
              ? weaponAmmoRef.current[eqId]!
              : eqMaxAmmo
            : null;
        const rs = reloadStateRef.current;
        const reloadingNow = Boolean(rs && rs.weaponId === eqId);
        const reloadProg =
          reloadingNow && rs ? clamp((now - rs.startedAt) / Math.max(1, rs.durationMs), 0, 1) : 0;

        setHudState({
          canBoard: !sim.activeCave && nearBoat,
          canDisembark: Boolean(nearShore),
          canDig: !sim.activeCave && !sim.isSailing && Boolean(postStandingIsl),
          nearDock: !sim.activeCave && nearDock,
          isSailing: sim.isSailing,
          shipClassName: activeShipSpec.name,
          boatHp: Math.round(sim.boatHp),
          maxBoatHp,
          playerHp: Math.round(sim.playerHp),
          equippedWeapon: eqId,
          weaponSlots: normWeapons.weaponSlots,
          activeAmmo: eqAmmo,
          activeMaxAmmo: eqMaxAmmo,
          isReloading: reloadingNow,
          reloadProgress: reloadProg,
          nearbyEnemyCount: sim.isSailing ? nearbySeaEnemies : nearbyLandEnemies,
          currentIslandName: sim.activeCave
            ? sim.activeCave.cave.name
            : postStandingIsl
            ? postStandingIsl.name
            : nearShore
            ? `${nearShore.name} Açıkları`
            : isEn
            ? 'Open Sea'
            : 'Açık Deniz',
          digCooldownPct: clamp(1 - (now - sim.lastDigTime) / digCd, 0, 1),
          cannonCooldownPct: clamp(1 - (now - sim.lastCannonTime) / cannonCd, 0, 1),
          attackCooldownPct: clamp(1 - (now - sim.lastAttackTime) / attackCd, 0, 1),
          radarCooldownPct: clamp(1 - (now - sim.lastRadarTime) / radarCd, 0, 1),
          abilityCooldownPct: clamp(1 - (now - sim.lastAbilityTime) / abilityCd, 0, 1),
          cycleLabel: cLabel,
          canFish: canFishNow,
          isFishing: sim.fishing.active,
          fishingBite: sim.fishing.bite,
          repairKits: currentSave.repairKits ?? 0,
          armyStance: currentSave.armyStance ?? 'CHARGE',
          interactLabel,
          zoneBanner,
          arenaWaveText: sim.arenaChallenge?.active
            ? isEn
              ? `Arena Wave ${sim.arenaChallenge.wave}/${sim.arenaChallenge.totalWaves}`
              : `Arena Dalgası ${sim.arenaChallenge.wave}/${sim.arenaChallenge.totalWaves}`
            : null,
        });
      }
      } catch (err) {
        console.error('Frame step recovered:', err);
        clearRenderCaches();
      } finally {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [
    addFloatingText,
    commitSave,
    ensureWarWithFaction,
    exitCave,
    findNearestShoreIsland,
    findStandingIsland,
    fireBroadside,
    recordEnemyDefeat,
    spawnParticles,
    startOfflineArenaWave,
  ]);

  const handleSellItem = useCallback(
    (uid: string) => {
      if (!hudState.nearDock) return;
      const item = saveRef.current.bag.find((b) => b.uid === uid);
      if (!item) return;
      soundEngine.playSellCoins();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:sell_item', uid });
        return;
      }
      commitSave((prev) => ({
        ...prev,
        gold: prev.gold + item.value,
        totalGoldEarned: prev.totalGoldEarned + item.value,
        bag: prev.bag.filter((b) => b.uid !== uid),
      }));
    },
    [commitSave, hudState.nearDock]
  );

  const handleSellAll = useCallback(() => {
    if (!hudState.nearDock || saveRef.current.bag.length === 0) return;
    const total = saveRef.current.bag.reduce((sum, i) => sum + i.value, 0);
    soundEngine.playSellCoins();
    markTutorialStep('tut_shop');
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:sell_all' });
      return;
    }
    commitSave((prev) => ({
      ...prev,
      gold: prev.gold + total,
      totalGoldEarned: prev.totalGoldEarned + total,
      bag: [],
    }));
  }, [commitSave, hudState.nearDock, markTutorialStep]);

  const handleBuyUpgrade = useCallback(
    (key: UpgradeKey) => {
      if (!hudState.nearDock) return;
      const def = UPGRADE_DEFS.find((d) => d.key === key);
      if (!def) return;
      const currentLvl = saveRef.current.upgrades[key] ?? 1;
      if (currentLvl >= def.maxLevel) return;
      const cost = getUpgradeCost(def, currentLvl);
      if (saveRef.current.gold < cost) return;

      soundEngine.playUpgrade();
      markTutorialStep('tut_shop');
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:buy_upgrade', key });
        return;
      }
      const nextUpgrades = {
        ...saveRef.current.upgrades,
        [key]: currentLvl + 1,
      };
      if (key === 'boatLevel') {
        simRef.current.boatHp = getMaxBoatHp(nextUpgrades.boatLevel);
      }

      commitSave((prev) => ({
        ...prev,
        gold: prev.gold - cost,
        boatHp: Math.round(simRef.current.boatHp),
        upgrades: nextUpgrades,
      }));
    },
    [commitSave, hudState.nearDock, markTutorialStep]
  );

  const handleFoundKingdom = useCallback(
    (name: string, bannerColor: string) => {
      if (saveRef.current.gold < KINGDOM_COSTS.FOUND_KINGDOM) return;
      soundEngine.playConquestFanfare();
      markTutorialStep('tut_kingdom');
      addFloatingText(
        simRef.current.isSailing ? simRef.current.boatX : simRef.current.playerX,
        (simRef.current.isSailing ? simRef.current.boatY : simRef.current.playerY) - 34,
        `${name} İlan Edildi!`,
        '#34D399'
      );
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:found_kingdom',
          name,
          bannerColor,
        });
        return;
      }
      commitSave((prev) => ({
        ...prev,
        gold: prev.gold - KINGDOM_COSTS.FOUND_KINGDOM,
        kingdom: {
          ...prev.kingdom,
          founded: true,
          name,
          bannerColor,
        },
      }));
    },
    [addFloatingText, commitSave, markTutorialStep]
  );

  const handleRecruitSoldier = useCallback(
    (type: SoldierType, count = 1) => {
      const spec = SOLDIER_SPECS[type];
      const k = saveRef.current.kingdom;
      const armyLevel = Math.max(1, k.armyLevel || 1);
      const actualCount = Math.max(1, count);
      const totalCost = spec.cost * actualCount;
      if (!k.founded || saveRef.current.gold < totalCost) return;

      soundEngine.playUpgrade();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:recruit_soldier',
          soldierType: type,
          count: actualCount,
        });
        return;
      }

      const { hpMult } = getSoldierPowerMultiplier(armyLevel);
      const scaledHp = Math.round(spec.maxHp * hpMult);
      const baseX = simRef.current.isSailing ? simRef.current.boatX : simRef.current.playerX;
      const baseY = simRef.current.isSailing ? simRef.current.boatY : simRef.current.playerY;

      const addedRoster: { id: string; type: SoldierType; hp: number; maxHp: number }[] = [];
      for (let i = 0; i < actualCount; i++) {
        const id = `sol_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const angle = Math.random() * Math.PI * 2;
        const radius = 24 + Math.random() * 28;
        simRef.current.allySoldiers.push({
          id,
          type,
          hp: scaledHp,
          maxHp: scaledHp,
          x: baseX + Math.cos(angle) * radius,
          y: baseY + Math.sin(angle) * radius,
          angle: simRef.current.playerAngle,
          lastAttackTime: 0,
          hitFlashTime: -1000,
          walkPhase: Math.random() * Math.PI * 2,
          attackSwingTime: 0,
        });
        addedRoster.push({ id, type, hp: scaledHp, maxHp: scaledHp });
      }

      commitSave((prev) => ({
        ...prev,
        gold: prev.gold - totalCost,
        kingdom: {
          ...prev.kingdom,
          soldiers: [...prev.kingdom.soldiers, ...addedRoster],
        },
      }));
    },
    [commitSave]
  );

  const handleUpgradeArmy = useCallback(() => {
    const k = saveRef.current.kingdom;
    const curLevel = Math.max(1, k.armyLevel || 1);
    const cost = getArmyUpgradeCost(curLevel);
    if (!k.founded || curLevel >= MAX_ARMY_LEVEL || saveRef.current.gold < cost) return;

    soundEngine.playUpgrade();
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:upgrade_army' });
      return;
    }

    const nextLevel = curLevel + 1;
    const { hpMult } = getSoldierPowerMultiplier(nextLevel);

    for (const sol of simRef.current.allySoldiers) {
      const baseSpec = SOLDIER_SPECS[sol.type] ?? SOLDIER_SPECS.SWORDSMAN;
      const newMax = Math.round(baseSpec.maxHp * hpMult);
      const ratio = sol.maxHp > 0 ? sol.hp / sol.maxHp : 1;
      sol.maxHp = newMax;
      sol.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
    }

    commitSave((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      kingdom: {
        ...prev.kingdom,
        armyLevel: nextLevel,
        soldiers: simRef.current.allySoldiers.map((sol) => ({
          id: sol.id,
          type: sol.type,
          hp: Math.max(1, Math.round(sol.hp)),
          maxHp: sol.maxHp,
        })),
      },
    }));
  }, [commitSave]);

  const handleRecruitShip = useCallback(
    (count = 1) => {
      const k = saveRef.current.kingdom;
      const actualCount = Math.max(1, count);
      const totalCost = KINGDOM_COSTS.ESCORT_SHIP * actualCount;
      if (!k.founded || saveRef.current.gold < totalCost) return;

      soundEngine.playUpgrade();
      if (onlineActiveRef.current) {
        onlineManagerRef.current?.submitLocalCommand({
          type: 'cmd:recruit_ship',
          count: actualCount,
        });
        return;
      }

      for (let i = 0; i < actualCount; i++) {
        const slot = simRef.current.allyShips.length;
        const formA = simRef.current.boatAngle + (slot % 2 === 0 ? 2.1 : -2.1) + i * 0.25;
        const ringDist = 95 + Math.floor(slot / 2) * 32;
        simRef.current.allyShips.push({
          id: `ally_ship_${Date.now()}_${slot}_${i}`,
          name: `Korvet ${slot + 1}`,
          x: simRef.current.boatX + Math.cos(formA) * (160 + ringDist),
          y: simRef.current.boatY + Math.sin(formA) * (160 + ringDist),
          angle: Math.random() * Math.PI * 2,
          hp: ESCORT_SHIP_STATS.maxHp,
          maxHp: ESCORT_SHIP_STATS.maxHp,
          lastFireTime: 0,
          hitFlashTime: -1000,
          slotIndex: slot,
          nextDecisionTime: 0,
          cruiseSpeedMult: 0.86 + Math.random() * 0.28,
          orbitSign: slot % 2 === 0 ? 1 : -1,
        });
      }

      commitSave((prev) => ({
        ...prev,
        gold: prev.gold - totalCost,
        kingdom: {
          ...prev.kingdom,
          escortShipCount: prev.kingdom.escortShipCount + actualCount,
        },
      }));
    },
    [commitSave]
  );

  const handleHealArmy = useCallback(() => {
    if (saveRef.current.gold < KINGDOM_COSTS.HEAL_ARMY) return;
    soundEngine.playSellCoins();
    if (onlineActiveRef.current) {
      onlineManagerRef.current?.submitLocalCommand({ type: 'cmd:heal_army' });
      return;
    }
    for (const sol of simRef.current.allySoldiers) {
      sol.hp = sol.maxHp;
    }
    commitSave((prev) => ({
      ...prev,
      gold: prev.gold - KINGDOM_COSTS.HEAL_ARMY,
      kingdom: {
        ...prev.kingdom,
        soldiers: prev.kingdom.soldiers.map((s) => ({ ...s, hp: s.maxHp })),
      },
    }));
  }, [commitSave]);

  const handleDeclareWar = useCallback(
    (factionId: EnemyFactionId) => {
      if (saveRef.current.kingdom.atWarWith.includes(factionId)) return;
      soundEngine.playWarHorn();
      addFloatingText(
        simRef.current.isSailing ? simRef.current.boatX : simRef.current.playerX,
        (simRef.current.isSailing ? simRef.current.boatY : simRef.current.playerY) - 34,
        `${ENEMY_FACTIONS[factionId].shortName} Devleti'ne Savaş Açıldı!`,
        '#FCA5A5'
      );
      commitSave((prev) => ({
        ...prev,
        kingdom: {
          ...prev.kingdom,
          atWarWith: [...prev.kingdom.atWarWith, factionId],
        },
      }));
    },
    [addFloatingText, commitSave]
  );

  const handleDeclareOnlineWar = useCallback(
    (targetPlayerId: string, cancel = false) => {
      if (!onlineActiveRef.current) return;
      if (!cancel) soundEngine.playWarHorn();
      onlineManagerRef.current?.submitLocalCommand({
        type: 'cmd:declare_war',
        targetPlayerId,
        cancel,
      });
    },
    []
  );

  const handleResetSave = useCallback(() => {
    clearSaveData();
    clearRenderCaches();
    const fresh = createInitialSave();
    worldManagerRef.current.setSeed(fresh.worldSeed);
    worldManagerRef.current.setLuckLevel(1);

    const starter = worldManagerRef.current.getIslandAtSector(0, 0);
    if (starter) {
      const coastR = getIslandRadiusAtAngle(starter, 0.12);
      fresh.player.x = Math.cos(0.12) * (coastR * 0.45);
      fresh.player.y = Math.sin(0.12) * (coastR * 0.45);
      fresh.boat.x = Math.cos(0.12) * (coastR + 36);
      fresh.boat.y = Math.sin(0.12) * (coastR + 36);
    }

    simRef.current.playerX = fresh.player.x;
    simRef.current.playerY = fresh.player.y;
    simRef.current.boatX = fresh.boat.x;
    simRef.current.boatY = fresh.boat.y;
    simRef.current.boatVx = 0;
    simRef.current.boatVy = 0;
    simRef.current.boatSpeedRatio = 0;
    simRef.current.boatHp = fresh.boatHp;
    simRef.current.playerHp = fresh.playerHp;
    simRef.current.isSailing = false;
    simRef.current.cameraX = fresh.player.x;
    simRef.current.cameraY = fresh.player.y;
    simRef.current.enemies = [];
    simRef.current.allyShips = [];
    simRef.current.islandEnemies = [];
    simRef.current.allySoldiers = [];
    simRef.current.fortCapture = null;
    simRef.current.spawnedIslandIds.clear();
    simRef.current.spawnedFactionByIsland.clear();
    simRef.current.nextCampaignTime = performance.now() + 26000;
    simRef.current.landProjectiles = [];
    simRef.current.cannonballs = [];
    simRef.current.floatingLoot = [];
    simRef.current.waterRipples = [];
    simRef.current.particles = [];
    simRef.current.floatingTexts = [];
    simRef.current.radarPulses = [];
    simRef.current.hazards = [];
    simRef.current.harvestedNodeIds.clear();
    simRef.current.fortTurretFireTimes.clear();
    simRef.current.fortWallsHpByIsland.clear();
    activeEmotesRef.current = [];
    simRef.current.fishing.active = false;
    simRef.current.worldTimeSec = fresh.worldTimeSec ?? 36;
    simRef.current.playTimeSec = 0;
    pendingSyncRef.current.rosterDirty = false;
    pendingSyncRef.current.shipCountDirty = false;
    pendingSyncRef.current.landKills = 0;
    pendingSyncRef.current.seaKills = 0;
    pendingSyncRef.current.soldiersLost = 0;
    pendingSyncRef.current.shipsLost = 0;
    pendingSyncRef.current.lastSyncAt = 0;
    perfGovRef.current.reset();

    persistSaveData(fresh);
    setSave(fresh);
    setHasSavedProgress(false);
    setLastRadar(null);
    setActiveModal('NONE');
  }, []);

  const nationIslandCounts = useMemo(() => {
    const counts: Record<EnemyFactionId, number> = { CORSAIR: 0, IMPERIAL: 0, SUN_CLAN: 0 };
    const worldIslands = worldManagerRef.current.getVisibleIslands(0, 0, 3);
    for (const isl of worldIslands) {
      const owner = getEffectiveIslandFaction(isl.factionId, isl.id, isl.isStarter, save.kingdom);
      if (owner !== 'NEUTRAL' && owner !== 'PLAYER') {
        counts[owner] = (counts[owner] ?? 0) + 1;
      }
    }
    return counts;
  }, [save.kingdom, save.worldSeed]);

  const ownedIslandsForModal = useMemo(() => {
    const worldIslands = worldManagerRef.current.getVisibleIslands(0, 0, 3);
    return save.kingdom.conqueredIslandIds.map((id) => ({
      id,
      name: worldIslands.find((w) => w.id === id)?.name ?? id,
    }));
  }, [save.kingdom.conqueredIslandIds, save.worldSeed]);

  const onlineIslandOwnersForDisplay = useMemo(() => {
    if (!onlineActive) return undefined;
    const map: Record<string, { shortName: string; color: string; isCapturable?: boolean }> = {};
    const playerById = new Map<string, RemotePlayerSnapshot>();
    for (const p of onlineLobbyPlayers) {
      playerById.set(p.id, p);
    }

    for (const slot of onlineStarterSlots) {
      const p = playerById.get(slot.playerId);
      const isSelf = slot.playerId === identity.playerId;
      map[slot.islandId] = {
        shortName: isSelf
          ? save.kingdom.founded
            ? save.kingdom.name
            : identity.name
          : p?.kingdomFounded
          ? p.kingdomName
          : slot.ownerName,
        color: isSelf ? save.kingdom.bannerColor : p?.bannerColor ?? slot.bannerColor,
        isCapturable: false,
      };
    }

    for (const [islandId, ownerId] of Object.entries(onlineIslandOwners)) {
      const p = playerById.get(ownerId);
      const isSelf = ownerId === identity.playerId;
      map[islandId] = {
        shortName: isSelf
          ? save.kingdom.founded
            ? save.kingdom.name
            : identity.name
          : p?.kingdomFounded
          ? p.kingdomName
          : p?.name ?? 'Kaptan',
        color: isSelf ? save.kingdom.bannerColor : p?.bannerColor ?? '#F59E0B',
        isCapturable: onlineRoomInfo?.rule === 'PVP' && !isSelf,
      };
    }
    return map;
  }, [
    onlineActive,
    onlineLobbyPlayers,
    onlineStarterSlots,
    onlineIslandOwners,
    onlineRoomInfo?.rule,
    identity.playerId,
    identity.name,
    save.kingdom.founded,
    save.kingdom.name,
    save.kingdom.bannerColor,
  ]);

  useEffect(() => {
    onlineOwnersForRenderRef.current = onlineIslandOwnersForDisplay;
  }, [onlineIslandOwnersForDisplay]);

  // Automatic Achievement Unlocker (Offline & Online Authoritative)
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const stats: CampaignStatsInput = {
      treasuresFoundCount: save.treasuresFoundCount,
      enemiesSunkCount: save.enemiesSunkCount,
      landEnemiesDefeated: save.landEnemiesDefeated,
      discoveredIslandsCount: save.discoveredIslandIds.length,
      conqueredIslandsCount: save.kingdom.conqueredIslandIds.length,
      kingdomFounded: save.kingdom.founded,
      boatLevel: save.upgrades.boatLevel,
      collectedRelicsCount: (save.collectedRelicIds ?? []).length,
      totalGoldEarned: save.totalGoldEarned,
      stormsSurvivedCount: save.stormsSurvivedCount ?? 0,
      soldiersCount: save.kingdom.soldiers.length,
      escortShipCount: save.kingdom.escortShipCount,
    };
    const already = new Set(save.unlockedAchievementIds ?? []);
    const newlyUnlocked = ACHIEVEMENTS.filter(
      (a) => !already.has(a.id) && !(onlineActive && sentOnlineAchRef.current.has(a.id)) && a.check(stats)
    );
    if (newlyUnlocked.length === 0) return;

    const totalBonus = newlyUnlocked.reduce((sum, a) => sum + a.rewardGold, 0);
    soundEngine.playAchievement();
    const sim = simRef.current;
    const first = newlyUnlocked[0];
    const title = settings.language === 'en' ? first.titleEn : first.title;
    addFloatingText(
      sim.isSailing ? sim.boatX : sim.playerX,
      (sim.isSailing ? sim.boatY : sim.playerY) - 52,
      `${settings.language === 'en' ? 'Achievement' : 'Başarım'}: ${title} (+${totalBonus}G)`,
      '#FDE047'
    );
    if (onlineActive) {
      newlyUnlocked.forEach((a) => sentOnlineAchRef.current.add(a.id));
      onlineManagerRef.current?.submitLocalCommand({
        type: 'cmd:unlock_achievements',
        achievementIds: newlyUnlocked.map((a) => a.id),
      });
      return;
    }
    commitSave((prev) => ({
      ...prev,
      gold: prev.gold + totalBonus,
      totalGoldEarned: prev.totalGoldEarned + totalBonus,
      unlockedAchievementIds: [
        ...(prev.unlockedAchievementIds ?? []),
        ...newlyUnlocked.map((a) => a.id),
      ],
    }));
  }, [
    onlineActive,
    phase,
    save.treasuresFoundCount,
    save.enemiesSunkCount,
    save.landEnemiesDefeated,
    save.discoveredIslandIds.length,
    save.kingdom.conqueredIslandIds.length,
    save.kingdom.founded,
    save.upgrades.boatLevel,
    save.collectedRelicIds,
    save.totalGoldEarned,
    save.stormsSurvivedCount,
    save.kingdom.soldiers.length,
    save.kingdom.escortShipCount,
    save.unlockedAchievementIds,
    settings.language,
    addFloatingText,
    commitSave,
  ]);

  const claimableMilestoneCount = useMemo(() => {
    const stats: CampaignStatsInput = {
      treasuresFoundCount: save.treasuresFoundCount,
      enemiesSunkCount: save.enemiesSunkCount,
      landEnemiesDefeated: save.landEnemiesDefeated,
      discoveredIslandsCount: save.discoveredIslandIds.length,
      conqueredIslandsCount: save.kingdom.conqueredIslandIds.length,
      kingdomFounded: save.kingdom.founded,
      boatLevel: save.upgrades.boatLevel,
      collectedRelicsCount: (save.collectedRelicIds ?? []).length,
      totalGoldEarned: save.totalGoldEarned,
      stormsSurvivedCount: save.stormsSurvivedCount ?? 0,
      soldiersCount: save.kingdom.soldiers.length,
      escortShipCount: save.kingdom.escortShipCount,
    };
    const claimed = new Set(save.claimedMilestoneIds ?? []);
    return CAMPAIGN_MILESTONES.filter((m) => !claimed.has(m.id) && m.isComplete(stats)).length;
  }, [save]);

  const nextTutorialStep = useMemo(() => {
    if (onlineActive || !settings.showTutorialHints || phase !== 'PLAYING' || activeModal !== 'NONE') {
      return null;
    }
    const done = new Set(save.tutorialCompleted ?? []);
    return TUTORIAL_STEPS.find((step) => !done.has(step.id)) ?? null;
  }, [onlineActive, settings.showTutorialHints, phase, activeModal, save.tutorialCompleted]);

  const relicBonusesUi = useMemo(
    () => getRelicSetBonuses(save.collectedRelicIds ?? []),
    [save.collectedRelicIds]
  );
  const effectiveMaxPlayerHpUi = MAX_PLAYER_HP + relicBonusesUi.extraPlayerMaxHp;

  const activeHp = hudState.isSailing ? hudState.boatHp : hudState.playerHp;
  const activeMaxHp = hudState.isSailing ? hudState.maxBoatHp : effectiveMaxPlayerHpUi;
  const hpPct = clamp((activeHp / Math.max(1, activeMaxHp)) * 100, 0, 100);
  const weaponDef = hudState.equippedWeapon ? WEAPONS[hudState.equippedWeapon] : null;
  const isCompactHud = isCoarseDevice || isNarrowViewport;
  const isCompactTouch = isCompactHud || isShortViewport;
  const isEditingLayout = activeModal === 'LAYOUT_EDIT';
  const controlsDisplayMode: ActionControlsDisplayMode = isEditingLayout
    ? 'TOUCH'
    : settings.touchControls === 'ALWAYS'
    ? 'TOUCH'
    : isCoarseDevice
    ? settings.touchControls === 'HIDDEN'
      ? 'HIDDEN'
      : 'TOUCH'
    : settings.desktopShowActionBar
    ? 'DESKTOP'
    : 'HIDDEN';
  const activeTouchLayout = isEditingLayout ? draftTouchLayout : settings.touchLayout;

  const visibleTouchActionKeys = useMemo<ActionButtonKey[]>(() => {
    const keys: ActionButtonKey[] = ['ability', 'radar', 'boatOrInteract', 'digOrFire'];
    if (hudState.repairKits > 0) keys.push('repair');
    if (save.kingdom.soldiers.length > 0 && !hudState.isSailing) keys.push('stance');
    if (hudState.canFish || hudState.isFishing) keys.push('fish');
    if (!hudState.isSailing && Boolean(weaponDef)) keys.push('attack');
    return keys;
  }, [
    hudState.repairKits,
    save.kingdom.soldiers.length,
    hudState.isSailing,
    hudState.canFish,
    hudState.isFishing,
    weaponDef,
  ]);

  const desktopActionButtonCount = useMemo(() => {
    let count = 3; // Order, Radar, Dig/Fire
    if (save.kingdom.soldiers.length > 0 && !hudState.isSailing) count++;
    if (hudState.repairKits > 0) count++;
    if (hudState.canFish || hudState.isFishing) count++;
    if (!hudState.isSailing && Boolean(weaponDef)) count++;
    const boatActionEnabled = hudState.isSailing ? hudState.canDisembark : hudState.canBoard;
    if (hudState.interactLabel || boatActionEnabled) count++;
    return count;
  }, [
    save.kingdom.soldiers.length,
    hudState.isSailing,
    hudState.repairKits,
    hudState.canFish,
    hudState.isFishing,
    weaponDef,
    hudState.interactLabel,
    hudState.canBoard,
    hudState.canDisembark,
  ]);

  const showPortraitHintBanner =
    isCoarseDevice && isPortrait && !dismissPortraitHint && phase === 'PLAYING' && !isEditingLayout;

  const hudLayoutBaseInput = useMemo(
    () => ({
      vw: viewport.vw,
      vh: viewport.vh,
      isCoarseDevice,
      controlsDisplayMode,
      isEditingLayout,
      visibleActionIds: visibleTouchActionKeys,
      desktopActionButtonCount,
      showTopRightHudButtons: isCoarseDevice ? true : settings.desktopShowHudButtons,
      showTopRightSettingsButton: isCoarseDevice ? true : settings.desktopShowSettingsButton,
      gold: save.gold,
      bagCount: save.bag.length,
      nearDock: hudState.nearDock,
      hasWeaponPanel: hudState.weaponSlots.length > 0 && !isEditingLayout,
      onlineActive,
      voiceEnabled: voiceState.enabled,
      chatOpen,
      hasTutorial: Boolean(nextTutorialStep),
      showPortraitHint: showPortraitHintBanner,
      hasWorldEvent: Boolean(activeWorldEvent && !onlineActive),
    }),
    [
      viewport.vw,
      viewport.vh,
      isCoarseDevice,
      controlsDisplayMode,
      isEditingLayout,
      visibleTouchActionKeys,
      desktopActionButtonCount,
      settings.desktopShowHudButtons,
      settings.desktopShowSettingsButton,
      save.gold,
      save.bag.length,
      hudState.nearDock,
      hudState.weaponSlots.length,
      onlineActive,
      voiceState.enabled,
      chatOpen,
      nextTutorialStep,
      showPortraitHintBanner,
      activeWorldEvent,
    ]
  );

  const hudLayout = useMemo(
    () =>
      computeUnifiedHudLayout({
        ...hudLayoutBaseInput,
        touchLayout: activeTouchLayout,
      }),
    [hudLayoutBaseInput, activeTouchLayout]
  );

  const openLayoutEditor = useCallback(() => {
    setDraftTouchLayout(settings.touchLayout ? { ...settings.touchLayout } : {});
    setSelectedTouchButton(controlsDisplayMode === 'TOUCH' ? 'digOrFire' : 'weaponPanel');
    setActiveModal('LAYOUT_EDIT');
  }, [controlsDisplayMode, settings.touchLayout]);

  const updateDraftButtonTransform = useCallback(
    (id: TouchButtonId, next: TouchButtonTransform) => {
      setDraftTouchLayout((prev) => ({
        ...prev,
        [id]: next,
      }));
    },
    []
  );

  const handleDragResolve = useCallback(
    (id: TouchButtonId, candidate: TouchButtonTransform): TouchButtonTransform =>
      resolveDraggedTouchTransform(id, candidate, hudLayoutBaseInput, draftTouchLayout),
    [hudLayoutBaseInput, draftTouchLayout]
  );

  const getMiniMapLiveSnapshot = useCallback((): MiniMapLiveSnapshot => {
    const s = simRef.current;
    return {
      playerX: s.playerX,
      playerY: s.playerY,
      playerAngle: s.playerAngle,
      boatX: s.boatX,
      boatY: s.boatY,
      boatAngle: s.boatAngle,
      isSailing: s.isSailing,
      activeCave: s.activeCave,
    };
  }, []);

  useEffect(() => {
    hasTouchControlsRef.current = controlsDisplayMode === 'TOUCH';
    if (controlsDisplayMode !== 'TOUCH') {
      simRef.current.joystickVec = { x: 0, y: 0 };
    }
  }, [controlsDisplayMode]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07364B] touch-none select-none">
      <canvas ref={canvasRef} className="block w-full h-full touch-none select-none" />

      {phase === 'TITLE_MENU' && !showOnlineLobby && (
        <TitleOverlay
          hasSavedProgress={hasSavedProgress}
          savedGold={save.gold}
          discoveredCount={save.discoveredIslandIds.length}
          treasuresFoundCount={save.treasuresFoundCount}
          boatLevel={save.upgrades.boatLevel}
          captainName={identity.name}
          inviteRoomCode={inviteRoomCode}
          language={settings.language}
          soundEnabled={settings.soundEnabled && settings.masterVolume > 0}
          onToggleLanguage={() =>
            setSettings((prev) => ({
              ...prev,
              language: prev.language === 'en' ? 'tr' : 'en',
            }))
          }
          onToggleSound={() =>
            setSettings((prev) => {
              const nextEnabled = !(prev.soundEnabled && prev.masterVolume > 0);
              return {
                ...prev,
                soundEnabled: nextEnabled,
                masterVolume: nextEnabled && prev.masterVolume === 0 ? 100 : prev.masterVolume,
              };
            })
          }
          onOpenSettings={() => setActiveModal('SETTINGS')}
          onStart={() => {
            soundEngine.ensureAmbientOcean();
            onlineActiveRef.current = false;
            setOnlineActive(false);
            worldManagerRef.current.setOnlineMode(false);
            setPhase('PLAYING');
          }}
          onOpenOnline={() => {
            soundEngine.ensureAmbientOcean();
            ensureOnlineManager();
            setShowOnlineLobby(true);
          }}
        />
      )}

      {showOnlineLobby && (
        <OnlineLobbyModal
          identity={identity}
          onUpdateIdentity={setIdentity}
          status={onlineStatus}
          errorMsg={onlineError}
          role={onlineRole}
          roomInfo={onlineRoomInfo}
          players={onlineLobbyPlayers}
          starterSlots={onlineStarterSlots}
          initialRoomCode={inviteRoomCode}
          language={settings.language}
          onCreateRoom={(rule: OnlineModeRule, resumeRoomId?: string) => {
            const mgr = ensureOnlineManager();
            void mgr.createOrResumeHostRoom(identity, rule, resumeRoomId).catch(() => {
              // Error surfaced via onStatusChange
            });
          }}
          onJoinRoom={(code: string) => {
            const mgr = ensureOnlineManager();
            mgr.joinRoom(code, identity);
          }}
          onHostStartGame={() => {
            onlineManagerRef.current?.hostStartGame();
          }}
          onHostChangeRule={(rule: OnlineModeRule) => {
            onlineManagerRef.current?.hostSetRule(rule);
          }}
          onDisconnect={() => {
            onlineManagerRef.current?.disconnect();
            setOnlineRoomInfo(null);
            setOnlineLobbyPlayers([]);
            setOnlineStarterSlots([]);
          }}
          onClose={() => setShowOnlineLobby(false)}
        />
      )}

      {phase === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
          {/* Active World Event Banner (Top-Center when gap allows, otherwise inside Top-Left stack) */}
          {activeWorldEvent && !onlineActive && hudLayout.showTopCenterEvent && (
            <div
              style={{ maxWidth: `${hudLayout.topCenterEventMaxWidth}px` }}
              className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F2936]/90 border border-amber-400/45 text-xs text-amber-200 shadow-lg"
            >
              {activeWorldEvent.type === 'STORM' ? (
                <CloudLightning className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              )}
              <span className="font-semibold truncate">{activeWorldEvent.title}</span>
              <span className="text-[11px] text-slate-300 truncate">
                {activeWorldEvent.description}
              </span>
            </div>
          )}

          {/* Mini Map (Independently positioned & collision-solved) */}
          <div
            style={{ top: `${hudLayout.minimap.pad}px`, left: `${hudLayout.minimap.pad}px` }}
            className={`pointer-events-auto absolute ${isEditingLayout ? 'z-30' : ''}`}
          >
            <MiniMap
              size={hudLayout.minimap.baseSize}
              worldManager={worldManagerRef.current}
              discoveredIslandIds={save.discoveredIslandIds}
              kingdom={save.kingdom}
              mapPin={save.mapPin ?? null}
              onlineMode={onlineActive}
              onlinePlayers={onlineLobbyPlayers.filter((p) => p.id !== identity.playerId)}
              onlineIslandOwners={onlineIslandOwnersForDisplay}
              colorblindMode={settings.colorblindMode}
              language={settings.language}
              touchLayout={activeTouchLayout}
              resolvedGeom={hudLayout.minimap}
              isEditingLayout={isEditingLayout}
              isSelected={selectedTouchButton === 'minimap'}
              onSelectButton={setSelectedTouchButton}
              onUpdateButtonTransform={updateDraftButtonTransform}
              onDragResolve={handleDragResolve}
              getLiveSnapshot={getMiniMapLiveSnapshot}
              onOpenMap={() => setActiveModal('MAP')}
            />
          </div>

          {/* Top-Left Status Stack (Always avoids MiniMap, TopRightHud, and Bottom Controls) */}
          <div
            style={{
              top: `${hudLayout.topLeftPlacement.top}px`,
              left: `${hudLayout.topLeftPlacement.left}px`,
              maxWidth: `${hudLayout.topLeftPlacement.maxWidth}px`,
              maxHeight: `${hudLayout.topLeftPlacement.maxHeight}px`,
            }}
            className={`pointer-events-auto absolute overflow-y-auto flex flex-col items-start min-w-0 ${
              isCompactTouch ? 'gap-1' : 'gap-2'
            } ${isEditingLayout ? 'pointer-events-none opacity-45' : ''}`}
          >
            {onlineActive && onlineRoomInfo && (
              <div
                className={`${
                  isCompactTouch ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
                } rounded-lg bg-[#0F2936]/90 border border-sky-400/35 font-medium text-sky-200 flex items-center gap-1.5 max-w-full shadow-md shrink-0`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    onlineStatus === 'RECONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                <span className="truncate font-mono-num">
                  Oda {onlineRoomInfo.roomId} ·{' '}
                  {onlineLobbyPlayers.filter((p) => p.connected).length} Kaptan ·{' '}
                  {onlineRoomInfo.rule === 'COOP' ? 'Co-op' : 'PvP'}
                  {!isCompactHud && onlinePing !== null ? ` · ${onlinePing}ms` : ''}
                </span>
              </div>
            )}

            {(hudState.isSailing || activeHp < activeMaxHp || hudState.nearbyEnemyCount > 0) && (
              <div
                className={`${
                  isCompactTouch ? 'px-2 py-1 gap-1.5' : 'px-3 py-2 gap-2.5'
                } rounded-xl bg-[#0F2936]/90 border border-white/15 flex items-center shadow-md max-w-full shrink-0`}
              >
                <Heart
                  className={`${
                    isCompactTouch ? 'w-3.5 h-3.5' : 'w-4 h-4'
                  } text-red-400 shrink-0`}
                />
                <div
                  className={`${
                    isCompactTouch ? 'w-14' : 'w-28'
                  } h-2 rounded-full bg-slate-900 overflow-hidden shrink-0`}
                >
                  <div
                    className={`h-full transition-all duration-150 ${
                      hpPct > 45 ? 'bg-emerald-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <span
                  className={`font-mono-num ${
                    isCompactTouch ? 'text-[11px]' : 'text-xs'
                  } font-semibold text-slate-100 whitespace-nowrap`}
                >
                  {activeHp}/{activeMaxHp}
                </span>
                {hudState.isSailing && !isCompactHud && (
                  <span className="text-[11px] font-semibold text-amber-200/90 border-l border-white/15 pl-2 whitespace-nowrap">
                    {hudState.shipClassName}
                  </span>
                )}
              </div>
            )}

            {hudState.currentIslandName && hudState.zoneBanner?.tone !== 'CAVE' && (
              <div
                className={`${
                  isCompactTouch ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
                } rounded-lg bg-[#0F2936]/85 border border-white/15 font-medium text-slate-100 truncate max-w-full shadow-md shrink-0`}
              >
                {hudState.currentIslandName}
              </div>
            )}

            {hudState.zoneBanner && (
              <div
                className={`${
                  isCompactTouch ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
                } rounded-lg border font-semibold flex items-center gap-1.5 max-w-full shadow-md whitespace-nowrap shrink-0 ${
                  hudState.zoneBanner.tone === 'CITY'
                    ? 'bg-sky-950/85 border-sky-400/45 text-sky-200'
                    : hudState.zoneBanner.tone === 'ARENA'
                    ? 'bg-orange-950/85 border-orange-400/45 text-orange-200'
                    : 'bg-purple-950/85 border-purple-400/45 text-purple-200'
                }`}
              >
                {hudState.zoneBanner.tone === 'CITY' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                ) : hudState.zoneBanner.tone === 'ARENA' ? (
                  <Swords className="w-3.5 h-3.5 text-orange-300 shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                )}
                <span className="truncate">{hudState.zoneBanner.label}</span>
              </div>
            )}

            {(hudState.arenaWaveText ||
              hudState.nearbyEnemyCount > 0 ||
              (activeWorldEvent && !onlineActive && !hudLayout.showTopCenterEvent)) && (
              <div
                className={`${
                  isCompactTouch || hudLayout.topLeftPlacement.maxHeight < 180
                    ? 'flex flex-wrap items-center gap-1'
                    : 'flex flex-col items-start gap-2'
                } max-w-full shrink-0`}
              >
                {hudState.arenaWaveText && (
                  <div
                    className={`${
                      isCompactTouch ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
                    } rounded-lg bg-orange-950/90 border border-amber-400/60 text-amber-200 font-bold flex items-center gap-1 shadow-md whitespace-nowrap`}
                  >
                    <Swords className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{hudState.arenaWaveText}</span>
                  </div>
                )}

                {hudState.nearbyEnemyCount > 0 && (
                  <div
                    className={`${
                      isCompactTouch ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-3 py-1.5 text-xs gap-1.5'
                    } rounded-xl bg-red-950/85 border border-red-400/45 text-red-200 font-semibold flex items-center shadow-md max-w-full`}
                  >
                    <ShieldAlert
                      className={`${
                        isCompactTouch ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      } text-red-400 shrink-0`}
                    />
                    <span className="whitespace-nowrap">
                      {isCompactHud
                        ? `Düşman (${hudState.nearbyEnemyCount})`
                        : hudState.isSailing
                        ? `Yakında Düşman Gemisi (${hudState.nearbyEnemyCount})`
                        : `Adada Düşman Takımı (${hudState.nearbyEnemyCount})`}
                    </span>
                  </div>
                )}

                {activeWorldEvent && !onlineActive && !hudLayout.showTopCenterEvent && (
                  <div
                    className={`${
                      isCompactTouch ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
                    } rounded-lg bg-[#0F2936]/90 border border-amber-400/40 text-amber-200 font-semibold flex items-center gap-1 shadow-md max-w-full`}
                  >
                    {activeWorldEvent.type === 'STORM' ? (
                      <CloudLightning className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    )}
                    <span className="truncate">{activeWorldEvent.title}</span>
                  </div>
                )}
              </div>
            )}

            {hudState.nearDock &&
              !hudLayout.isTopRightCompact &&
              (isCoarseDevice || settings.desktopShowHudButtons) && (
                <button
                  type="button"
                  onClick={() => setActiveModal('SHOP')}
                  className="flex px-3.5 py-2 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-amber-400/50 text-amber-300 text-xs font-semibold items-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer shrink-0"
                >
                  <Store className="w-4 h-4" />
                  <span>
                    {settings.language === 'en'
                      ? 'Merchant Dock Open (T)'
                      : 'Tüccar İskelesi Açık (T)'}
                  </span>
                </button>
              )}
          </div>

          {/* Top-Right HUD (independently anchored) */}
          <div
            style={{ top: `${hudLayout.pad}px`, right: `${hudLayout.pad}px` }}
            className={`pointer-events-none absolute ${
              isEditingLayout ? 'opacity-35 pointer-events-none' : ''
            }`}
          >
            <TopRightHud
              isCompactMode={hudLayout.isTopRightCompact}
              maxWidth={hudLayout.topRightMaxWidth}
              gold={save.gold}
              bagCount={save.bag.length}
              nearDock={hudState.nearDock}
              kingdomFounded={save.kingdom.founded}
              soldierCount={save.kingdom.soldiers.length}
              journalBadgeCount={claimableMilestoneCount}
              weaponOffsetRight={
                !hudLayout.isTopRightCompact && hudLayout.weaponAtDefaultSpot
                  ? Math.round(hudLayout.weaponPanel.baseW * hudLayout.weaponPanel.scale + 8)
                  : 0
              }
              language={settings.language}
              showSettingsButton={isCoarseDevice ? true : settings.desktopShowSettingsButton}
              showHudButtons={isCoarseDevice ? true : settings.desktopShowHudButtons}
              onOpenSettings={() => setActiveModal('SETTINGS')}
              onOpenShop={() => setActiveModal('SHOP')}
              onOpenKingdom={() => setActiveModal('KINGDOM')}
              onOpenJournal={() => setActiveModal('JOURNAL')}
            />
          </div>

          {/* Weapon & Ammo HUD Panel (Independently positioned, movable & resizable in Layout Editor) */}
          {(hudState.weaponSlots.length > 0 || isEditingLayout) && (
            <div
              style={{
                top: `${hudLayout.weaponPanel.baseTop}px`,
                right: `${hudLayout.weaponPanel.baseRight}px`,
              }}
              className={`pointer-events-none absolute ${isEditingLayout ? 'z-30' : 'z-20'}`}
            >
              <WeaponHudPanel
                weaponSlots={
                  hudState.weaponSlots.length > 0
                    ? hudState.weaponSlots
                    : ['PISTOL', 'CUTLASS']
                }
                equippedWeapon={
                  hudState.weaponSlots.length > 0
                    ? hudState.equippedWeapon
                    : 'PISTOL'
                }
                activeAmmo={hudState.weaponSlots.length > 0 ? hudState.activeAmmo : 6}
                activeMaxAmmo={hudState.weaponSlots.length > 0 ? hudState.activeMaxAmmo : 6}
                isReloading={hudState.weaponSlots.length > 0 ? hudState.isReloading : false}
                reloadProgress={hudState.weaponSlots.length > 0 ? hudState.reloadProgress : 0}
                isTouchMode={
                  controlsDisplayMode === 'TOUCH' ||
                  isCoarseDevice ||
                  hudLayout.isTopRightCompact
                }
                switchKeyLabel={formatKeyCode(settings.keybindings.switchWeapon)}
                reloadKeyLabel={formatKeyCode(settings.keybindings.reload)}
                language={settings.language}
                touchLayout={activeTouchLayout}
                resolvedGeom={hudLayout.weaponPanel}
                isEditingLayout={isEditingLayout}
                isSelected={selectedTouchButton === 'weaponPanel'}
                onSelectButton={setSelectedTouchButton}
                onUpdateButtonTransform={updateDraftButtonTransform}
                onDragResolve={handleDragResolve}
                onSwitchWeapon={handleSwitchWeapon}
                onSelectSlot={handleSelectWeaponSlot}
                onReload={handleReloadWeapon}
              />
            </div>
          )}

          {/* TOUCH mode: Unified Non-Overlapping Bottom Stack (Portrait Hint + Tutorial + Online Chat/Voice) */}
          {controlsDisplayMode === 'TOUCH' &&
            (showPortraitHintBanner ||
              nextTutorialStep ||
              (onlineActive && !isEditingLayout)) && (
              <div
                style={{
                  bottom: `${hudLayout.bottomStackPlacement.bottom}px`,
                  left: `${hudLayout.bottomStackPlacement.left}px`,
                  transform: hudLayout.bottomStackPlacement.translateXMinus50
                    ? 'translateX(-50%)'
                    : undefined,
                  maxWidth: `${hudLayout.bottomStackPlacement.maxWidth}px`,
                  maxHeight: `${hudLayout.bottomStackPlacement.maxHeight}px`,
                }}
                className={`pointer-events-none absolute z-30 w-full flex flex-col gap-1.5 ${
                  hudLayout.bottomStackPlacement.align === 'center' ? 'items-center' : 'items-start'
                }`}
              >
                {showPortraitHintBanner && (
                  <div className="pointer-events-auto max-w-full px-3 py-1.5 rounded-xl bg-[#0F2936]/95 border border-amber-400/40 text-[11px] text-slate-100 flex items-center gap-2 shadow-xl">
                    <RotateCw className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">
                      {settings.language === 'en'
                        ? 'Rotate to landscape for best view'
                        : 'En iyi deneyim için telefonu yatay çevirin'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissPortraitHint(true)}
                      className="text-slate-300 hover:text-white font-semibold ml-1 shrink-0 cursor-pointer"
                    >
                      {settings.language === 'en' ? 'Close' : 'Kapat'}
                    </button>
                  </div>
                )}

                {nextTutorialStep && !isEditingLayout && (
                  <div className="pointer-events-auto max-w-full px-3 py-1.5 rounded-xl bg-[#0F2936]/95 border border-amber-400/40 text-xs text-slate-100 flex items-center gap-2 shadow-xl">
                    <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-amber-200 mr-1.5">
                        {settings.language === 'en' ? nextTutorialStep.titleEn : nextTutorialStep.title}:
                      </span>
                      <span className="text-slate-200">
                        {settings.language === 'en' ? nextTutorialStep.textEn : nextTutorialStep.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => markTutorialStep(nextTutorialStep.id)}
                      aria-label="Dismiss hint"
                      className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {onlineActive && !isEditingLayout && (
                  <div
                    className={`pointer-events-auto flex flex-col gap-1.5 max-w-full ${
                      hudLayout.bottomStackPlacement.align === 'center'
                        ? 'items-center'
                        : 'items-start'
                    }`}
                  >
                    {chatOpen && (
                      <div className="w-72 max-w-full rounded-2xl bg-[#0F2936]/95 border border-sky-400/35 shadow-2xl overflow-hidden backdrop-blur-md">
                        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-200">
                            {settings.language === 'en' ? 'Fleet Chat & Emotes' : 'Filo Sohbeti & İfadeler'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setChatOpen(false)}
                            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="max-h-28 overflow-y-auto px-3 py-2 space-y-1 text-xs">
                          {onlineChat.length === 0 ? (
                            <div className="text-slate-400 text-[11px]">
                              {settings.language === 'en'
                                ? 'No messages yet. Say ahoy!'
                                : 'Henüz mesaj yok. Kaptanlara selam ver!'}
                            </div>
                          ) : (
                            onlineChat.map((m) => (
                              <div key={m.id} className="leading-snug break-words">
                                {m.senderId === 'SYSTEM' ? (
                                  <span className="text-amber-300/90 italic">{m.text}</span>
                                ) : (
                                  <>
                                    <span
                                      className="font-bold mr-1.5"
                                      style={{ color: m.bannerColor || '#38BDF8' }}
                                    >
                                      {m.senderName}:
                                    </span>
                                    <span className="text-slate-100">{m.text}</span>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="px-2.5 py-1.5 border-t border-white/10 flex items-center justify-between gap-1 bg-slate-900/40">
                          {['👋', '⚔️', '💰', '🏴‍☠️', '🆘', '❤️'].map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => onlineManagerRef.current?.sendEmote(em)}
                              className="flex-1 py-1 rounded-lg hover:bg-white/15 active:scale-90 transition text-sm cursor-pointer"
                              title="İfade Gönder"
                            >
                              {em}
                            </button>
                          ))}
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const trimmed = chatInput.trim();
                            if (!trimmed) return;
                            onlineManagerRef.current?.sendChat(trimmed);
                            setChatInput('');
                          }}
                          className="p-2 border-t border-white/10 flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={chatInput}
                            maxLength={140}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={
                              settings.language === 'en' ? 'Message fleet...' : 'Filoya mesaj yaz...'
                            }
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                          />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold cursor-pointer"
                            aria-label="Send"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    )}

                    {voiceState.error && (
                      <div className="px-2.5 py-1 rounded-lg bg-red-950/90 border border-red-400/50 text-red-200 text-[11px] flex items-center gap-1.5 shadow-lg max-w-full">
                        <span className="truncate">{voiceState.error}</span>
                        <button
                          type="button"
                          onClick={() => voiceManagerRef.current?.clearError()}
                          className="p-0.5 rounded hover:bg-white/10 text-red-300 shrink-0 cursor-pointer"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div
                      className={`flex flex-wrap items-center gap-1 max-w-full ${
                        hudLayout.bottomStackPlacement.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setChatOpen((prev) => !prev)}
                        className="px-2.5 py-1 text-[11px] rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-sky-400/40 text-sky-200 font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-sky-300" />
                        <span>{settings.language === 'en' ? 'Chat' : 'Sohbet'}</span>
                        {onlineChat.length > 0 && !chatOpen && (
                          <span className="px-1.5 py-0.2 rounded-full bg-sky-500/30 text-[10px] font-mono-num text-sky-100">
                            {onlineChat.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleVoiceJoin()}
                        disabled={voiceState.connecting}
                        className={`px-2.5 py-1 text-[11px] rounded-xl border font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap transition-colors ${
                          voiceState.enabled
                            ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/55 text-emerald-200'
                            : 'bg-[#0F2936]/90 hover:bg-[#173D4F] border-white/15 text-slate-200'
                        }`}
                      >
                        {voiceState.enabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-slate-300" />
                        )}
                        <span>
                          {voiceState.connecting
                            ? settings.language === 'en'
                              ? 'Connecting...'
                              : 'Bağlanıyor...'
                            : voiceState.enabled
                            ? settings.language === 'en'
                              ? 'Leave'
                              : 'Sesten Çık'
                            : settings.language === 'en'
                            ? 'Voice'
                            : 'Sesli Sohbet'}
                        </span>
                        {voiceState.enabled && (
                          <span className="px-1.5 rounded-full bg-emerald-500/25 text-[10px] font-mono-num text-emerald-100">
                            {voiceState.connectedVoicePeerCount}
                            {voicePeersCount > 1 ? `/${Math.max(1, voicePeersCount - 1)}` : ''}
                          </span>
                        )}
                      </button>

                      {voiceState.enabled && (
                        <>
                          <button
                            type="button"
                            onClick={handleToggleVoiceMute}
                            title={
                              voiceState.muted
                                ? settings.language === 'en'
                                  ? 'Unmute Mic'
                                  : 'Mikrofonu Aç'
                                : settings.language === 'en'
                                ? 'Mute Mic'
                                : 'Mikrofonu Kapat'
                            }
                            className={`p-1.5 rounded-xl border shadow-lg cursor-pointer flex items-center gap-1 ${
                              voiceState.muted
                                ? 'bg-red-950/90 border-red-400/50 text-red-200'
                                : 'bg-[#0F2936]/90 border-emerald-400/40 text-emerald-200'
                            }`}
                          >
                            {voiceState.muted ? (
                              <MicOff className="w-3.5 h-3.5" />
                            ) : (
                              <Mic className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleVoiceMode}
                            className="px-2 py-1 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-sky-400/35 text-sky-200 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer whitespace-nowrap"
                          >
                            <Radio className="w-3 h-3 text-sky-300" />
                            <span>
                              {voiceState.mode === 'PROXIMITY'
                                ? settings.language === 'en'
                                  ? 'Proximity'
                                  : 'Yakınlık'
                                : settings.language === 'en'
                                ? 'Room'
                                : 'Oda'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          {/* DESKTOP / HIDDEN mode: Guaranteed non-overlapping Tutorial Hint */}
          {controlsDisplayMode !== 'TOUCH' && nextTutorialStep && (
            <div
              style={{
                bottom: `${hudLayout.desktopTutorialPlacement.bottom}px`,
                left: `${hudLayout.desktopTutorialPlacement.left}px`,
                maxWidth: `${hudLayout.desktopTutorialPlacement.maxWidth}px`,
              }}
              className="pointer-events-auto absolute -translate-x-1/2 z-25 px-3.5 py-2 rounded-xl bg-[#0F2936]/95 border border-amber-400/40 text-xs text-slate-100 flex items-center gap-2.5 shadow-xl"
            >
              <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-amber-200 mr-1.5">
                  {settings.language === 'en' ? nextTutorialStep.titleEn : nextTutorialStep.title}:
                </span>
                <span className="text-slate-200">
                  {settings.language === 'en' ? nextTutorialStep.textEn : nextTutorialStep.text}
                </span>
              </div>
              <button
                type="button"
                onClick={() => markTutorialStep(nextTutorialStep.id)}
                aria-label="Dismiss hint"
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* DESKTOP / HIDDEN mode: Online Chat & Quick Emotes Widget */}
          {controlsDisplayMode !== 'TOUCH' && onlineActive && !isEditingLayout && (
            <div
              style={{
                bottom: `${hudLayout.desktopChatPlacement.bottom}px`,
                left: `${hudLayout.desktopChatPlacement.left}px`,
                maxWidth: `${hudLayout.desktopChatPlacement.maxWidth}px`,
                maxHeight: `${hudLayout.desktopChatPlacement.maxHeight}px`,
              }}
              className="pointer-events-auto absolute z-30 flex flex-col gap-1.5 items-start"
            >
              {chatOpen && (
                <div className="w-72 max-w-full rounded-2xl bg-[#0F2936]/95 border border-sky-400/35 shadow-2xl overflow-hidden backdrop-blur-md">
                  <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-200">
                      {settings.language === 'en' ? 'Fleet Chat & Emotes' : 'Filo Sohbeti & İfadeler'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChatOpen(false)}
                      className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto px-3 py-2 space-y-1 text-xs">
                    {onlineChat.length === 0 ? (
                      <div className="text-slate-400 text-[11px]">
                        {settings.language === 'en'
                          ? 'No messages yet. Say ahoy!'
                          : 'Henüz mesaj yok. Kaptanlara selam ver!'}
                      </div>
                    ) : (
                      onlineChat.map((m) => (
                        <div key={m.id} className="leading-snug break-words">
                          {m.senderId === 'SYSTEM' ? (
                            <span className="text-amber-300/90 italic">{m.text}</span>
                          ) : (
                            <>
                              <span
                                className="font-bold mr-1.5"
                                style={{ color: m.bannerColor || '#38BDF8' }}
                              >
                                {m.senderName}:
                              </span>
                              <span className="text-slate-100">{m.text}</span>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-2.5 py-1.5 border-t border-white/10 flex items-center justify-between gap-1 bg-slate-900/40">
                    {['👋', '⚔️', '💰', '🏴‍☠️', '🆘', '❤️'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => onlineManagerRef.current?.sendEmote(em)}
                        className="flex-1 py-1 rounded-lg hover:bg-white/15 active:scale-90 transition text-sm cursor-pointer"
                        title="İfade Gönder"
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = chatInput.trim();
                      if (!trimmed) return;
                      onlineManagerRef.current?.sendChat(trimmed);
                      setChatInput('');
                    }}
                    className="p-2 border-t border-white/10 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      maxLength={140}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        settings.language === 'en' ? 'Message fleet...' : 'Filoya mesaj yaz...'
                      }
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold cursor-pointer"
                      aria-label="Send"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {voiceState.error && (
                <div className="px-2.5 py-1 rounded-lg bg-red-950/90 border border-red-400/50 text-red-200 text-[11px] flex items-center gap-1.5 shadow-lg max-w-xs">
                  <span className="truncate">{voiceState.error}</span>
                  <button
                    type="button"
                    onClick={() => voiceManagerRef.current?.clearError()}
                    className="p-0.5 rounded hover:bg-white/10 text-red-300 shrink-0 cursor-pointer"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setChatOpen((prev) => !prev)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-sky-400/40 text-sky-200 font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-sky-300" />
                  <span>{settings.language === 'en' ? 'Chat & Emotes' : 'Sohbet & İfade'}</span>
                  {controlsDisplayMode === 'DESKTOP' && (
                    <span className="text-[10px] font-mono-num text-sky-300/80">
                      [{formatKeyCode(settings.keybindings.chat)}]
                    </span>
                  )}
                  {onlineChat.length > 0 && !chatOpen && (
                    <span className="px-1.5 py-0.2 rounded-full bg-sky-500/30 text-[10px] font-mono-num text-sky-100">
                      {onlineChat.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleToggleVoiceJoin()}
                  disabled={voiceState.connecting}
                  className={`px-3 py-1.5 text-xs rounded-xl border font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap transition-colors ${
                    voiceState.enabled
                      ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/55 text-emerald-200'
                      : 'bg-[#0F2936]/90 hover:bg-[#173D4F] border-white/15 text-slate-200'
                  }`}
                >
                  {voiceState.enabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>
                    {voiceState.connecting
                      ? settings.language === 'en'
                        ? 'Connecting...'
                        : 'Bağlanıyor...'
                      : voiceState.enabled
                      ? settings.language === 'en'
                        ? 'Leave Voice'
                        : 'Sesten Çık'
                      : settings.language === 'en'
                      ? 'Join Voice'
                      : 'Sesli Sohbet'}
                  </span>
                  {voiceState.enabled && (
                    <span className="px-1.5 rounded-full bg-emerald-500/25 text-[10px] font-mono-num text-emerald-100">
                      {voiceState.connectedVoicePeerCount}
                      {voicePeersCount > 1 ? `/${Math.max(1, voicePeersCount - 1)}` : ''}
                    </span>
                  )}
                </button>

                {voiceState.enabled && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleVoiceMute}
                      title={
                        voiceState.muted
                          ? settings.language === 'en'
                            ? 'Unmute Mic'
                            : 'Mikrofonu Aç'
                          : settings.language === 'en'
                          ? 'Mute Mic'
                          : 'Mikrofonu Kapat'
                      }
                      className={`p-1.5 rounded-xl border shadow-lg cursor-pointer flex items-center gap-1 ${
                        voiceState.muted
                          ? 'bg-red-950/90 border-red-400/50 text-red-200'
                          : 'bg-[#0F2936]/90 border-emerald-400/40 text-emerald-200'
                      }`}
                    >
                      {voiceState.muted ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                      {controlsDisplayMode === 'DESKTOP' && (
                        <span className="text-[10px] font-mono-num opacity-85">
                          [{formatKeyCode(settings.keybindings.voiceMute)}]
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleVoiceMode}
                      className="px-2.5 py-1.5 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-sky-400/35 text-sky-200 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer whitespace-nowrap"
                      title={
                        settings.language === 'en'
                          ? 'Switch Proximity vs Room-Wide Voice'
                          : 'Yakınlık / Tüm Oda Ses Modunu Değiştir'
                      }
                    >
                      <Radio className="w-3 h-3 text-sky-300" />
                      <span>
                        {voiceState.mode === 'PROXIMITY'
                          ? settings.language === 'en'
                            ? 'Proximity'
                            : 'Yakınlık'
                          : settings.language === 'en'
                          ? 'Room'
                          : 'Oda'}
                      </span>
                    </button>

                    {voiceState.activeSpeakerIds.length > 0 && (
                      <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-[10px] font-semibold text-emerald-200 flex items-center gap-1 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {settings.language === 'en' ? 'Speaking' : 'Konuşuyor'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom-Left Virtual Joystick (independently anchored & collision-solved) */}
          {controlsDisplayMode === 'TOUCH' && (
            <div
              style={{
                bottom: `${hudLayout.joystick.pad}px`,
                left: `${hudLayout.joystick.pad}px`,
              }}
              className={`pointer-events-none absolute ${isEditingLayout ? 'z-30' : ''}`}
            >
              <VirtualJoystick
                mode={settings.joystickMode}
                compact={hudLayout.isCompactTouch}
                touchLayout={activeTouchLayout}
                resolvedGeom={hudLayout.joystick}
                isEditingLayout={isEditingLayout}
                isSelected={selectedTouchButton === 'joystick'}
                language={settings.language}
                onSelectButton={setSelectedTouchButton}
                onUpdateButtonTransform={updateDraftButtonTransform}
                onDragResolve={handleDragResolve}
                onChange={(vec) => {
                  simRef.current.joystickVec = vec;
                }}
              />
            </div>
          )}

          {/* Bottom-Right Action Controls (independently anchored & collision-solved) */}
          <div
            style={{
              bottom: `${hudLayout.actionContainer.pad}px`,
              right: `${hudLayout.actionContainer.pad}px`,
            }}
            className={`pointer-events-none absolute ${isEditingLayout ? 'z-30' : ''}`}
          >
            <ActionControls
              displayMode={controlsDisplayMode}
              compact={hudLayout.isCompactTouch}
              isSailing={hudState.isSailing}
              canBoard={hudState.canBoard}
              canDisembark={hudState.canDisembark}
              canDig={hudState.canDig}
              equippedWeapon={hudState.equippedWeapon}
              digCooldownPct={hudState.digCooldownPct}
              cannonCooldownPct={hudState.cannonCooldownPct}
              attackCooldownPct={hudState.attackCooldownPct}
              radarCooldownPct={hudState.radarCooldownPct}
              abilityCooldownPct={hudState.abilityCooldownPct}
              lastRadar={lastRadar}
              colorblindMode={settings.colorblindMode}
              language={settings.language}
              abilityKeyLabel={formatKeyCode(settings.keybindings.ability)}
              keyLabels={{
                digOrFire: formatKeyCode(settings.keybindings.digOrFire),
                attack: formatKeyCode(settings.keybindings.attack),
                boat: formatKeyCode(settings.keybindings.boat),
                radar: formatKeyCode(settings.keybindings.radar),
                ability: formatKeyCode(settings.keybindings.ability),
                fish: formatKeyCode(settings.keybindings.fish),
                stance: formatKeyCode(settings.keybindings.stance),
                repair: formatKeyCode(settings.keybindings.repair),
              }}
              canFish={hudState.canFish}
              isFishing={hudState.isFishing}
              fishingBite={hudState.fishingBite}
              repairKits={hudState.repairKits}
              armyStance={hudState.armyStance}
              hasSoldiers={save.kingdom.soldiers.length > 0}
              interactLabel={hudState.interactLabel}
              touchLayout={activeTouchLayout}
              resolvedContainer={hudLayout.actionContainer}
              resolvedButtons={hudLayout.actionButtons}
              radarToastPlacement={hudLayout.radarToastPlacement}
              desktopMaxWidth={hudLayout.desktopActionBar.maxWidth}
              isEditingLayout={isEditingLayout}
              selectedButtonId={selectedTouchButton}
              onSelectButton={setSelectedTouchButton}
              onUpdateButtonTransform={updateDraftButtonTransform}
              onDragResolve={handleDragResolve}
              onDig={handleDig}
              onFireCannons={handleFireCannons}
              onAttackLand={handleAttackLand}
              onToggleBoat={handleToggleBoat}
              onInteract={handlePrimaryInteract}
              onRadar={handleRadar}
              onTriggerAbility={handleTriggerAbility}
              onFish={handleFishAction}
              onUseRepairKit={handleUseRepairKit}
              onCycleStance={handleCycleStance}
            />
          </div>

          {/* Interactive Touch Button Layout Editor Toolbar (Positioned in open clear space) */}
          {isEditingLayout && (
            <>
              <div className="pointer-events-none fixed inset-0 bg-slate-950/35 z-20" />
              <div
                style={{
                  top: `${hudLayout.editorToolbarPlacement.top}px`,
                  left: `${hudLayout.editorToolbarPlacement.left}px`,
                  width: `${hudLayout.editorToolbarPlacement.width}px`,
                }}
                className="pointer-events-auto fixed z-40 rounded-2xl bg-[#0F2936]/95 border border-amber-400/50 shadow-2xl backdrop-blur-md px-3 py-2.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Move className="w-4 h-4 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-50 truncate">
                        {settings.language === 'en'
                          ? 'Drag, resize & set opacity'
                          : 'Konum, boyut ve opaklık düzenle'}
                      </div>
                      {selectedTouchButton && (
                        <div className="text-[11px] text-amber-300 truncate">
                          {settings.language === 'en' ? 'Selected: ' : 'Seçili: '}
                          {selectedTouchButton === 'digOrFire'
                            ? settings.language === 'en'
                              ? 'Dig / Fire'
                              : 'Kazı Yap / Top At'
                            : selectedTouchButton === 'boatOrInteract'
                            ? settings.language === 'en'
                              ? 'Ship / Interact'
                              : 'Tekne / Etkileşim'
                            : selectedTouchButton === 'attack'
                            ? settings.language === 'en'
                              ? 'Attack'
                              : 'Saldır'
                            : selectedTouchButton === 'radar'
                            ? 'Radar'
                            : selectedTouchButton === 'ability'
                            ? settings.language === 'en'
                              ? 'Order'
                              : 'Savaş Emri'
                            : selectedTouchButton === 'fish'
                            ? settings.language === 'en'
                              ? 'Fishing'
                              : 'Olta'
                            : selectedTouchButton === 'stance'
                            ? settings.language === 'en'
                              ? 'Army Stance'
                              : 'Ordu Düzeni'
                            : selectedTouchButton === 'repair'
                            ? settings.language === 'en'
                              ? 'Repair Kit'
                              : 'Tamir Kiti'
                            : selectedTouchButton === 'minimap'
                            ? settings.language === 'en'
                              ? 'Mini Map'
                              : 'Mini Harita'
                            : selectedTouchButton === 'weaponPanel'
                            ? settings.language === 'en'
                              ? 'Weapon Panel'
                              : 'Silah Paneli'
                            : settings.language === 'en'
                            ? 'Move Joystick'
                            : 'Hareket Joystick'}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTouchButton && (
                    <div className="flex items-center gap-1 shrink-0 bg-slate-900/70 border border-white/10 rounded-lg px-1.5 py-1">
                      <button
                        type="button"
                        aria-label="Küçült"
                        onClick={() => {
                          const minScale =
                            selectedTouchButton === 'minimap' ||
                            selectedTouchButton === 'weaponPanel'
                              ? 0.65
                              : 0.75;
                          const cur = draftTouchLayout[selectedTouchButton] ?? { dx: 0, dy: 0, scale: 1 };
                          const nextScale = Math.max(minScale, Math.round(((cur.scale ?? 1) - 0.1) * 100) / 100);
                          const resolved = handleDragResolve(selectedTouchButton, { ...cur, scale: nextScale });
                          updateDraftButtonTransform(selectedTouchButton, resolved);
                        }}
                        className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono-num text-[11px] font-bold text-slate-200 w-9 text-center">
                        %{Math.round((draftTouchLayout[selectedTouchButton]?.scale ?? 1) * 100)}
                      </span>
                      <button
                        type="button"
                        aria-label="Büyüt"
                        onClick={() => {
                          const maxScale =
                            selectedTouchButton === 'minimap'
                              ? 1.6
                              : selectedTouchButton === 'weaponPanel'
                              ? 1.45
                              : 1.35;
                          const cur = draftTouchLayout[selectedTouchButton] ?? { dx: 0, dy: 0, scale: 1 };
                          const nextScale = Math.min(maxScale, Math.round(((cur.scale ?? 1) + 0.1) * 100) / 100);
                          const resolved = handleDragResolve(selectedTouchButton, { ...cur, scale: nextScale });
                          updateDraftButtonTransform(selectedTouchButton, resolved);
                        }}
                        className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title={settings.language === 'en' ? 'Reset Selected' : 'Seçili Öğeyi Sıfırla'}
                        onClick={() => {
                          setDraftTouchLayout((prev) => {
                            const next = { ...prev };
                            delete next[selectedTouchButton];
                            return next;
                          });
                        }}
                        className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-sky-300 flex items-center justify-center cursor-pointer ml-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Opacity slider for selected element + Apply to All */}
                {selectedTouchButton && (() => {
                  const curOpacity = draftTouchLayout[selectedTouchButton]?.opacity ?? 1;
                  const opacityPct = Math.round(curOpacity * 100);
                  return (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                      <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap shrink-0">
                        {settings.language === 'en' ? 'Opacity' : 'Opaklık'}
                      </span>
                      <input
                        type="range"
                        min={25}
                        max={100}
                        step={5}
                        value={opacityPct}
                        aria-label={settings.language === 'en' ? 'Control Opacity' : 'Kontrol Opaklığı'}
                        onChange={(e) => {
                          const nextOpacity = Math.max(0.25, Math.min(1, Number(e.target.value) / 100));
                          const cur = draftTouchLayout[selectedTouchButton] ?? { dx: 0, dy: 0, scale: 1 };
                          updateDraftButtonTransform(selectedTouchButton, {
                            ...cur,
                            opacity: nextOpacity,
                          });
                        }}
                        className="flex-1 min-w-0 accent-amber-400 cursor-pointer"
                      />
                      <span className="font-mono-num text-[11px] font-bold text-amber-300 w-9 text-right shrink-0">
                        %{opacityPct}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetIds: TouchButtonId[] =
                            controlsDisplayMode === 'TOUCH'
                              ? [...ALL_ACTION_BUTTON_KEYS, 'joystick', 'minimap', 'weaponPanel']
                              : ['minimap', 'weaponPanel'];
                          setDraftTouchLayout((prev) => {
                            const next = { ...prev };
                            for (const id of targetIds) {
                              const cur = next[id] ?? { dx: 0, dy: 0, scale: 1 };
                              next[id] = { ...cur, opacity: curOpacity };
                            }
                            return next;
                          });
                        }}
                        title={
                          settings.language === 'en'
                            ? 'Apply this opacity to all controls'
                            : 'Bu opaklığı tüm kontrollere uygula'
                        }
                        className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {settings.language === 'en' ? 'All' : 'Tümüne'}
                      </button>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDraftTouchLayout({})}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{settings.language === 'en' ? 'Reset All' : 'Varsayılan'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTouchButton('minimap')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        selectedTouchButton === 'minimap'
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-white/10 hover:bg-white/15 border-transparent text-slate-200'
                      }`}
                    >
                      {settings.language === 'en' ? 'Mini Map' : 'Mini Harita'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTouchButton('weaponPanel')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        selectedTouchButton === 'weaponPanel'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-white/10 hover:bg-white/15 border-transparent text-slate-200'
                      }`}
                    >
                      {settings.language === 'en' ? 'Weapon Panel' : 'Silah Paneli'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveModal('NONE')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      {settings.language === 'en' ? 'Cancel' : 'İptal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettings((prev) => ({
                          ...prev,
                          touchControls:
                            prev.touchControls === 'HIDDEN' &&
                            Object.keys(draftTouchLayout).some(
                              (k) => k !== 'minimap' && k !== 'weaponPanel'
                            )
                              ? 'ALWAYS'
                              : prev.touchControls,
                          touchLayout: draftTouchLayout,
                        }));
                        setActiveModal('NONE');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{settings.language === 'en' ? 'Save' : 'Kaydet'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeModal === 'MAP' && (
        <MapModal
          worldManager={worldManagerRef.current}
          discoveredIslandIds={save.discoveredIslandIds}
          openedTreasureIds={save.openedTreasureIds}
          dugCraters={save.dugCraters}
          kingdom={save.kingdom}
          playerPos={{ x: simRef.current.playerX, y: simRef.current.playerY }}
          boatPos={{ x: simRef.current.boatX, y: simRef.current.boatY }}
          isSailing={simRef.current.isSailing}
          mapPin={save.mapPin ?? null}
          onlineMode={onlineActive}
          onlinePlayers={onlineLobbyPlayers.filter((p) => p.id !== identity.playerId)}
          onlineIslandOwners={onlineIslandOwnersForDisplay}
          colorblindMode={settings.colorblindMode}
          language={settings.language}
          onSetMapPin={(pin) => commitSave((prev) => ({ ...prev, mapPin: pin }), false)}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'SHOP' && (
        <ShopModal
          gold={save.gold}
          bag={save.bag}
          upgrades={save.upgrades}
          nearDock={hudState.nearDock}
          wood={save.wood ?? 0}
          iron={save.iron ?? 0}
          repairKits={save.repairKits ?? 0}
          caughtFishCount={save.caughtFishCount ?? 0}
          ownedPets={save.ownedPets ?? []}
          activePet={save.activePet ?? null}
          unlockedWeapons={save.unlockedWeapons}
          equippedWeapon={save.equippedWeapon}
          weaponSlots={
            normalizeWeaponSlots(
              save.weaponSlots,
              save.unlockedWeapons,
              save.equippedWeapon
            ).weaponSlots
          }
          language={settings.language}
          onlineMode={onlineActive}
          onSellAll={handleSellAll}
          onSellItem={handleSellItem}
          onBuyUpgrade={handleBuyUpgrade}
          onEquipWeapon={handleEquipWeapon}
          onBuyWeapon={handleBuyWeapon}
          onSellResources={handleSellResources}
          onCraftRepairKit={handleCraftRepairKit}
          onUseRepairKit={handleUseRepairKit}
          onAdoptPet={handleAdoptPet}
          onEquipPet={handleEquipPet}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'KINGDOM' && (
        <KingdomModal
          gold={save.gold}
          kingdom={save.kingdom}
          nationIslandCounts={nationIslandCounts}
          onlineMode={onlineActive}
          onlineRule={onlineRoomInfo?.rule}
          onlineSelfId={identity.playerId}
          onlinePlayers={onlineLobbyPlayers}
          onlineWarDeclarations={onlineWarDeclarations}
          armyStance={save.armyStance ?? 'CHARGE'}
          wood={save.wood ?? 0}
          iron={save.iron ?? 0}
          fortTurretIslandIds={save.fortTurretIslandIds ?? []}
          ownedIslands={ownedIslandsForModal}
          language={settings.language}
          onFoundKingdom={handleFoundKingdom}
          onRecruitSoldier={handleRecruitSoldier}
          onUpgradeArmy={handleUpgradeArmy}
          onRecruitShip={handleRecruitShip}
          onHealArmy={handleHealArmy}
          onDeclareWar={handleDeclareWar}
          onDeclareOnlineWar={handleDeclareOnlineWar}
          onSetArmyStance={handleSetArmyStance}
          onBuildFortTurret={handleBuildFortTurret}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'JOURNAL' && (
        <JournalModal
          save={save}
          language={settings.language}
          onClaimMilestone={handleClaimMilestone}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'SETTINGS' && (
        <SettingsModal
          settings={settings}
          worldSeed={save.worldSeed}
          onlineMode={onlineActive}
          onlineRoomId={onlineRoomInfo?.roomId}
          isTouchDevice={isCoarseDevice}
          onUpdateSettings={setSettings}
          onResetSave={handleResetSave}
          onQuickSave={handleQuickSave}
          onSaveToSlot={handleSaveToSlot}
          onLoadFromSlot={handleLoadFromSlot}
          onStartWithSeed={handleStartWithSeed}
          onExportSave={handleExportSave}
          onImportSave={handleImportSave}
          onLeaveToMenu={phase === 'PLAYING' ? handleLeaveToMenu : undefined}
          onOpenLayoutEditor={phase === 'PLAYING' ? openLayoutEditor : undefined}
          onClose={() => setActiveModal('NONE')}
        />
      )}
    </div>
  );
}
