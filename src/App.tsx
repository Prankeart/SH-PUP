import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, RotateCw, ShieldAlert, Store, Sword } from 'lucide-react';
import {
  ActiveModal,
  AllyShip,
  AllySoldier,
  Cannonball,
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
  RadarPulseEffect,
  RadarReading,
  SaveData,
  SoldierType,
  Vec2,
  WaterRipple,
  WeaponId,
} from './types/game';
import {
  clearSaveData,
  createInitialSave,
  loadSaveData,
  loadSettings,
  persistSaveData,
  persistSettings,
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
  getDigCooldownMs,
  getDigRadius,
  getMaxBoatHp,
  getRadarCooldownMs,
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
import { pickStrongerWeapon, WEAPONS } from './engine/weapons';
import { renderGameFrame } from './engine/renderer';
import { SpatialGrid } from './engine/spatialGrid';
import { soundEngine } from './engine/audio';
import { clamp, dist, lerpAngle } from './utils/prng';
import { VirtualJoystick } from './components/VirtualJoystick';
import { ActionControls } from './components/ActionControls';
import { TopRightHud } from './components/TopRightHud';
import { MapModal } from './components/MapModal';
import { ShopModal } from './components/ShopModal';
import { KingdomModal } from './components/KingdomModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleOverlay } from './components/TitleOverlay';

const PLAYER_SPEED = 175;
const MAX_PLAYER_HP = 100;
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
  const initialSave = useMemo(() => loadSaveData(), []);
  const [hasSavedProgress, setHasSavedProgress] = useState<boolean>(Boolean(initialSave));
  const [save, setSave] = useState<SaveData>(() => initialSave ?? createInitialSave());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [activeModal, setActiveModal] = useState<ActiveModal>('NONE');
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissPortraitHint, setDismissPortraitHint] = useState<boolean>(false);

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
    nearbyEnemyCount: 0,
    currentIslandName: 'Başlangıç Limanı' as string | null,
    digCooldownPct: 0,
    cannonCooldownPct: 0,
    attackCooldownPct: 0,
    radarCooldownPct: 0,
  });
  const [lastRadar, setLastRadar] = useState<RadarReading | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveRef = useRef<SaveData>(save);
  const settingsRef = useRef<GameSettings>(settings);
  const phaseRef = useRef<GamePhase>(phase);
  const modalRef = useRef<ActiveModal>(activeModal);

  const worldManagerRef = useRef<WorldManager>(
    new WorldManager(save.worldSeed, save.upgrades.luckLevel)
  );
  const openedTreasureSetRef = useRef<Set<string>>(new Set(save.openedTreasureIds));
  const collectedPickupSetRef = useRef<Set<string>>(new Set(save.collectedPickupIds));
  const enemyGridRef = useRef<SpatialGrid<IslandEnemy>>(new SpatialGrid<IslandEnemy>(110));
  const allyGridRef = useRef<SpatialGrid<AllySoldier>>(new SpatialGrid<AllySoldier>(110));
  const enemyQueryBufRef = useRef<IslandEnemy[]>([]);
  const allyQueryBufRef = useRef<AllySoldier[]>([]);

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
    fortCapture: null as { islandId: string; progress: number; defendersLeft: number } | null,
    lastTributeTime: performance.now(),
    lastWakeTime: 0,
    lastSoldierSfxTime: 0,
    lastAutoSaveTime: performance.now(),
  });

  useEffect(() => {
    saveRef.current = save;
    worldManagerRef.current.setSeed(save.worldSeed);
    worldManagerRef.current.setLuckLevel(save.upgrades.luckLevel);
    openedTreasureSetRef.current = new Set(save.openedTreasureIds);
    collectedPickupSetRef.current = new Set(save.collectedPickupIds);
  }, [save]);

  useEffect(() => {
    settingsRef.current = settings;
    soundEngine.setEnabled(settings.soundEnabled);
    persistSettings(settings);
  }, [settings]);

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
    const checkOrientation = () => {
      const portrait = window.innerWidth < 720 && window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const addFloatingText = useCallback(
    (x: number, y: number, text: string, color: string, priority = true) => {
      if (!priority && simRef.current.floatingTexts.length >= 26) return;
      simRef.current.floatingTexts.push({
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
      const currentLen = simRef.current.particles.length;
      if (currentLen > 460) return;
      const actualCount = currentLen > 300 ? Math.max(2, Math.ceil(count / 2)) : count;
      for (let i = 0; i < actualCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        simRef.current.particles.push({
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
      saveRef.current = next;
      if (!skipDiskFlush) {
        persistSaveData(next);
      }
      return next;
    });
  }, []);

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

  const defeatIslandEnemy = useCallback(
    (enemy: IslandEnemy, idx: number) => {
      simRef.current.islandEnemies.splice(idx, 1);
      soundEngine.playEnemySunk();
      spawnParticles(enemy.x, enemy.y, 16, enemy.squadColor, 'SPARK', 110, 3.6, true);

      const bounty = enemy.tier === 3 ? 65 : enemy.tier === 2 ? 45 : 28;
      const dropsHeal = Math.random() < 0.38;
      simRef.current.floatingLoot.push({
        id: `land_loot_${Date.now()}_${Math.random()}`,
        x: enemy.x,
        y: enemy.y,
        goldValue: bounty,
        healHp: dropsHeal ? 22 : undefined,
        bobOffset: Math.random() * Math.PI * 2,
        life: 38,
      });

      commitSave(
        (prev) => ({
          ...prev,
          landEnemiesDefeated: prev.landEnemiesDefeated + 1,
        }),
        true
      );
    },
    [commitSave, spawnParticles]
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
    if (now - sim.lastAttackTime < def.cooldownMs) return;
    sim.lastAttackTime = now;
    sim.attackAnimStart = now;

    // Gentle soft-assist aim toward nearest island enemy in front/close range so mobile controls feel crisp
    let aimAngle = sim.playerAngle;
    let nearestDist = Infinity;
    for (const ie of sim.islandEnemies) {
      const d = dist(sim.playerX, sim.playerY, ie.x, ie.y);
      if (d <= def.range + 40 && d < nearestDist) {
        const toEnemy = Math.atan2(ie.y - sim.playerY, ie.x - sim.playerX);
        const angleDiff = Math.abs(Math.atan2(Math.sin(toEnemy - sim.playerAngle), Math.cos(toEnemy - sim.playerAngle)));
        if (angleDiff < 1.35 || d < 85) {
          nearestDist = d;
          aimAngle = toEnemy;
        }
      }
    }
    sim.playerAngle = aimAngle;

    if (def.kind === 'MELEE') {
      soundEngine.playSwordSlash();
      sim.screenShake = Math.max(sim.screenShake, 2.0);
      let hitCount = 0;

      for (let i = sim.islandEnemies.length - 1; i >= 0; i--) {
        const ie = sim.islandEnemies[i];
        const d = dist(sim.playerX, sim.playerY, ie.x, ie.y);
        if (d <= def.range) {
          const toE = Math.atan2(ie.y - sim.playerY, ie.x - sim.playerX);
          const diff = Math.abs(Math.atan2(Math.sin(toE - aimAngle), Math.cos(toE - aimAngle)));
          if (diff <= 1.25 || d < 28) {
            ie.hp -= def.damage;
            ie.hitFlashTime = now;
            ie.alerted = true;
            ensureWarWithFaction(ie.factionId);
            // Knockback impulse
            ie.x += Math.cos(toE) * 16;
            ie.y += Math.sin(toE) * 16;
            hitCount++;

            spawnParticles(ie.x, ie.y, 8, '#F8FAFC', 'SPARK', 90, 3, true);
            addFloatingText(ie.x, ie.y - 20, `-${def.damage}`, '#FDE047');

            if (ie.hp <= 0) {
              defeatIslandEnemy(ie, i);
            }
          }
        }
      }
      if (hitCount > 0) soundEngine.playCannonHit();
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
          damage: def.damage,
          color: def.color,
          life: def.range / def.projectileSpeed,
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
  }, [addFloatingText, defeatIslandEnemy, ensureWarWithFaction, spawnParticles]);

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

      for (const side of sides) {
        const fireAngle = shipAngle + side * (Math.PI / 2);
        const dirX = Math.cos(fireAngle);
        const dirY = Math.sin(fireAngle);

        for (const ox of offsets) {
          const portX = shipX + cosA * ox + dirX * (16 * shipScale);
          const portY = shipY + sinA * ox + dirY * (16 * shipScale);

          simRef.current.cannonballs.push({
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

          simRef.current.particles.push({
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
          for (let s = 0; s < 3; s++) {
            simRef.current.particles.push({
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

      soundEngine.playCannonFire(owner === 'PLAYER');
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
    const damage = getCannonDamage(cannonLvl);
    const shipSpec = getShipClass(saveRef.current.upgrades.boatLevel);
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

  // Realistic Multi-Stage Digging Physics (+ chance to unearth bonus weapons!)
  const handleDig = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    if (sim.isSailing) return;

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

      const valueMult = getValueMultiplier(saveRef.current.upgrades.luckLevel);
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

      addFloatingText(
        targetX,
        targetY - 24,
        foundWeapon
          ? `${WEAPONS[foundWeapon].name} & ${hitTreasure.template.name}!`
          : `${hitTreasure.template.name}! +${instantBonus} Altın`,
        '#FDE047'
      );

      commitSave((prev) => {
        const updatedCraters = existingCrater
          ? prev.dugCraters.map((c) =>
              c.id === existingCrater.id ? { ...c, depth: newDepth, foundTreasure: true } : c
            )
          : [
              ...prev.dugCraters.slice(-350),
              {
                id: `cr_${Date.now()}_${Math.random()}`,
                islandId: island.id,
                x: targetX,
                y: targetY,
                radius: 14 + Math.min(8, shovelLvl * 1.3),
                depth: newDepth,
                rotation: Math.random() * Math.PI * 2,
                foundTreasure: true,
              },
            ];

        const nextUnlocked =
          foundWeapon && !prev.unlockedWeapons.includes(foundWeapon)
            ? [...prev.unlockedWeapons, foundWeapon]
            : prev.unlockedWeapons;

        return {
          ...prev,
          gold: prev.gold + instantBonus,
          totalGoldEarned: prev.totalGoldEarned + instantBonus,
          treasuresFoundCount: prev.treasuresFoundCount + 1,
          equippedWeapon: foundWeapon
            ? pickStrongerWeapon(prev.equippedWeapon, foundWeapon)
            : prev.equippedWeapon,
          unlockedWeapons: nextUnlocked,
          openedTreasureIds: [...prev.openedTreasureIds, hitTreasure.id],
          dugCraters: updatedCraters,
          bag: [
            ...prev.bag,
            {
              uid: `${hitTreasure.id}_${Date.now()}`,
              name: hitTreasure.template.name,
              rarity: hitTreasure.template.rarity,
              value: finalValue,
              color: hitTreasure.template.color,
              islandName: island.name,
            },
          ],
        };
      });
    } else {
      const hitDeeperClue = Boolean(hitTreasure && newDepth < requiredDepth);
      soundEngine.playDig(false, hitDeeperClue);

      if (hitDeeperClue) {
        spawnParticles(targetX, targetY, 6, '#FDE047', 'GOLD', 70, 2.8, true);
        addFloatingText(targetX, targetY - 22, 'Sandık derinde! Tekrar kaz', '#FCD34D');
      }

      commitSave((prev) => {
        const updatedCraters: DigCrater[] = existingCrater
          ? prev.dugCraters.map((c) =>
              c.id === existingCrater.id ? { ...c, depth: newDepth } : c
            )
          : [
              ...prev.dugCraters.slice(-350),
              {
                id: `cr_${Date.now()}_${Math.random()}`,
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
  }, [addFloatingText, commitSave, findStandingIsland, spawnParticles]);

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
  }, [addFloatingText, commitSave, findNearestShoreIsland]);

  const handleRadar = useCallback(() => {
    if (phaseRef.current !== 'PLAYING' || modalRef.current !== 'NONE') return;
    const sim = simRef.current;
    const now = performance.now();
    const cooldown = getRadarCooldownMs(saveRef.current.upgrades.radarLevel);
    if (now - sim.lastRadarTime < cooldown) return;
    sim.lastRadarTime = now;

    const px = sim.isSailing ? sim.boatX : sim.playerX;
    const py = sim.isSailing ? sim.boatY : sim.playerY;
    const radarLevel = saveRef.current.upgrades.radarLevel;
    const maxRange = 1100 + (radarLevel - 1) * 350;
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
    let label = 'Yakında hazine yok';
    if (closestAngle !== null) {
      if (closestDist <= 85) {
        heat = 'HOT';
        label = 'Çok Sıcak! Burayı Kaz';
      } else if (closestDist <= 220) {
        heat = 'WARM';
        label = 'Sıcak';
      } else if (closestDist <= 460) {
        heat = 'COOL';
        label = 'Ilık';
      } else {
        heat = 'COLD';
        label = 'Soğuk';
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
  }, [findStandingIsland]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      simRef.current.keys.add(code);

      if (code === 'Escape' && activeModal !== 'NONE') {
        setActiveModal('NONE');
        return;
      }
      if (phaseRef.current !== 'PLAYING') return;

      if (code === 'KeyM') {
        setActiveModal((prev) => (prev === 'MAP' ? 'NONE' : 'MAP'));
        return;
      }
      if (code === 'KeyT') {
        setActiveModal((prev) => (prev === 'SHOP' ? 'NONE' : 'SHOP'));
        return;
      }
      if (code === 'KeyK') {
        setActiveModal((prev) => (prev === 'KINGDOM' ? 'NONE' : 'KINGDOM'));
        return;
      }
      if (modalRef.current !== 'NONE') return;

      if (code === 'Space') {
        e.preventDefault();
        if (simRef.current.isSailing) handleFireCannons();
        else handleDig();
      } else if (code === 'KeyF') {
        handleAttackLand();
      } else if (code === 'KeyE') {
        handleToggleBoat();
      } else if (code === 'KeyR') {
        handleRadar();
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
  }, [activeModal, handleAttackLand, handleDig, handleFireCannons, handleRadar, handleToggleBoat]);

  // Main 60fps Loop
  useEffect(() => {
    let rafId = 0;
    let lastFrameTime = performance.now();
    let lastHudSync = 0;
    let frameCounter = 0;

    const step = (now: number) => {
      frameCounter++;
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const sim = simRef.current;
      const currentSave = saveRef.current;
      const currentSettings = settingsRef.current;
      const isPlaying = phaseRef.current === 'PLAYING' && modalRef.current === 'NONE';
      const maxBoatHp = getMaxBoatHp(currentSave.upgrades.boatLevel);

      sim.screenShake = Math.max(0, sim.screenShake - dt * 16);

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
      if (sim.isSailing) {
        if (isPlaying) {
          const curCos = Math.cos(sim.boatAngle);
          const curSin = Math.sin(sim.boatAngle);
          const curForward = sim.boatVx * curCos + sim.boatVy * curSin;
          const speedFactor = clamp(Math.abs(curForward) / activeShipSpec.maxSpeed, 0, 1);

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
            sim.boatVx += bowX * activeShipSpec.accel * inputMag * alignFactor * dt;
            sim.boatVy += bowY * activeShipSpec.accel * inputMag * alignFactor * dt;
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
          fwd = clamp(fwd, -activeShipSpec.maxSpeed * 0.35, activeShipSpec.maxSpeed);

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
          sim.boatSpeedRatio = clamp(totalSpeed / activeShipSpec.maxSpeed, 0, 1);

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

          let nextX = sim.playerX + ix * PLAYER_SPEED * dt;
          let nextY = sim.playerY + iy * PLAYER_SPEED * dt;

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
              commitSave((prev) => ({
                ...prev,
                collectedPickupIds: [...prev.collectedPickupIds, wp.id],
                unlockedWeapons: prev.unlockedWeapons.includes(wp.weaponId)
                  ? prev.unlockedWeapons
                  : [...prev.unlockedWeapons, wp.weaponId],
                equippedWeapon: pickStrongerWeapon(prev.equippedWeapon, wp.weaponId),
              }));
            }
          }
        }
      }

      // Build O(1) visible island lookup map and SpatialGrids for fast combat & separation
      const visibleIslandMap = new Map<string, Island>();
      for (let i = 0; i < visibleIslands.length; i++) {
        visibleIslandMap.set(visibleIslands[i].id, visibleIslands[i]);
      }

      const standingIsl = !sim.isSailing ? findStandingIsland(sim.playerX, sim.playerY) : null;
      const standingIslandEnemies: IslandEnemy[] = [];
      const islandFirstFaction = new Map<string, FactionId>();
      const multiFactionIslands = new Set<string>();

      const enemyGrid = enemyGridRef.current;
      const allyGrid = allyGridRef.current;
      const enemyQueryBuf = enemyQueryBufRef.current;
      const allyQueryBuf = allyQueryBufRef.current;
      enemyGrid.clear();
      allyGrid.clear();
      for (let i = 0; i < sim.islandEnemies.length; i++) {
        const ie = sim.islandEnemies[i];
        if (ie.hp > 0) {
          enemyGrid.insert(ie);
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
        if (sol.hp > 0) allyGrid.insert(sol);
      }

      // Coordinated Island Enemy & Massive Garrison AI (with SpatialGrid + multi-faction checks)
      if (isPlaying) {
        const squadLeaders = new Map<string, IslandEnemy>();
        for (const ie of sim.islandEnemies) {
          if (ie.squadId && ie.role === 'LEADER') {
            squadLeaders.set(ie.squadId, ie);
          }
        }

        if (!sim.isSailing) {
          const alertedSquads = new Set<string>();
          for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
            const ie = sim.islandEnemies[ei];
            if (ie.alerted) continue;
            if ((ei + frameCounter) % 3 !== 0) continue;
            if (dist(ie.x, ie.y, activeCenterX, activeCenterY) > 1550) continue;
            const spotPlayer = dist(ie.x, ie.y, sim.playerX, sim.playerY) < 255;
            let spotAlly = false;
            if (!spotPlayer && sim.allySoldiers.length > 0) {
              allyGrid.queryRadius(ie.x, ie.y, 250, allyQueryBuf);
              for (let a = 0; a < allyQueryBuf.length; a++) {
                const sol = allyQueryBuf[a];
                if (sol.hp > 0 && dist(ie.x, ie.y, sol.x, sol.y) < 250) {
                  spotAlly = true;
                  break;
                }
              }
            }
            if (spotPlayer || spotAlly) {
              if (ie.squadId && ie.role === 'LEADER') {
                addFloatingText(ie.x, ie.y - 26, 'Takım Saldırısı!', '#FCA5A5', false);
              }
              ie.alerted = true;
              if (ie.squadId) alertedSquads.add(ie.squadId);
            }
          }
          if (alertedSquads.size > 0) {
            for (const ie of sim.islandEnemies) {
              if (ie.squadId && alertedSquads.has(ie.squadId)) {
                ie.alerted = true;
              }
            }
          }
        } else {
          for (const ie of sim.islandEnemies) {
            if (dist(ie.x, ie.y, sim.playerX, sim.playerY) > 520) {
              ie.alerted = false;
            }
          }
        }

        for (let ei = 0; ei < sim.islandEnemies.length; ei++) {
          const ie = sim.islandEnemies[ei];
          if (ie.hp <= 0) continue;
          const island = visibleIslandMap.get(ie.islandId);
          if (!island) continue;
          const distToActive = dist(ie.x, ie.y, activeCenterX, activeCenterY);
          if (distToActive > 1600) continue;

          const stats = getIslandArmyStats(ie.tier);
          const hasRivalFactions = multiFactionIslands.has(ie.islandId);

          let targetEntityX = sim.playerX;
          let targetEntityY = sim.playerY;
          let targetKind: 'PLAYER' | 'ALLY_SOLDIER' | 'RIVAL_ENEMY' = 'PLAYER';
          let targetAlly: AllySoldier | null = null;
          let targetRival: IslandEnemy | null = null;
          let dToTarget = !sim.isSailing ? dist(ie.x, ie.y, sim.playerX, sim.playerY) : Infinity;

          if (!sim.isSailing && sim.allySoldiers.length > 0 && (ie.alerted || distToActive < 1100)) {
            allyGrid.queryRadius(ie.x, ie.y, 400, allyQueryBuf);
            for (let ai = 0; ai < allyQueryBuf.length; ai++) {
              const sol = allyQueryBuf[ai];
              if (sol.hp <= 0) continue;
              const ds = dist(ie.x, ie.y, sol.x, sol.y);
              if (ds < dToTarget) {
                dToTarget = ds;
                targetEntityX = sol.x;
                targetEntityY = sol.y;
                targetKind = 'ALLY_SOLDIER';
                targetAlly = sol;
              }
            }
          }

          if (hasRivalFactions) {
            enemyGrid.queryRadius(ie.x, ie.y, 380, enemyQueryBuf);
            for (let ri = 0; ri < enemyQueryBuf.length; ri++) {
              const other = enemyQueryBuf[ri];
              if (other === ie || other.hp <= 0 || other.islandId !== ie.islandId) continue;
              if (other.factionId === ie.factionId) continue;
              const dr = dist(ie.x, ie.y, other.x, other.y);
              if (dr < 380 && dr < dToTarget) {
                dToTarget = dr;
                targetEntityX = other.x;
                targetEntityY = other.y;
                targetKind = 'RIVAL_ENEMY';
                targetRival = other;
              }
            }
          }

          const hasTarget =
            targetKind === 'RIVAL_ENEMY' || (!sim.isSailing && ie.alerted && dToTarget < 480);

          let targetX = ie.patrolCenter.x;
          let targetY = ie.patrolCenter.y;
          let moveSpeed = 62;

          if (hasTarget) {
            moveSpeed = stats.moveSpeed;
            if (ie.combatStyle === 'MELEE') {
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
          const distTarget = Math.hypot(dx, dy);

          if (distTarget > 6) {
            const desiredA = Math.atan2(dy, dx);
            ie.angle = lerpAngle(ie.angle, desiredA, Math.min(1, dt * 8));
            let nx = ie.x + (dx / distTarget) * moveSpeed * dt;
            let ny = ie.y + (dy / distTarget) * moveSpeed * dt;

            const idx = nx - island.centerX;
            const idy = ny - island.centerY;
            const ia = Math.atan2(idy, idx);
            const maxR = getIslandRadiusAtAngle(island, ia) - 12;
            if (Math.hypot(idx, idy) > maxR) {
              nx = island.centerX + Math.cos(ia) * maxR;
              ny = island.centerY + Math.sin(ia) * maxR;
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

          // O(1) neighborhood soft separation via SpatialGrid
          if (hasTarget || (ei + frameCounter) % 2 === 0) {
            enemyGrid.queryRadius(ie.x, ie.y, 22, enemyQueryBuf);
            for (let ej = 0; ej < enemyQueryBuf.length; ej++) {
              const other = enemyQueryBuf[ej];
              if (other === ie || other.hp <= 0) continue;
              const sd = dist(ie.x, ie.y, other.x, other.y);
              if (sd > 0.1 && sd < 21) {
                const push = (21 - sd) * 0.35;
                const pa = Math.atan2(ie.y - other.y, ie.x - other.x);
                ie.x += Math.cos(pa) * push;
                ie.y += Math.sin(pa) * push;
                other.x -= Math.cos(pa) * push;
                other.y -= Math.sin(pa) * push;
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
                  targetAlly.hp -= dmg;
                  targetAlly.hitFlashTime = now;
                  addFloatingText(targetAlly.x, targetAlly.y - 18, `-${dmg}`, '#FCA5A5', false);
                  if (targetAlly.hp <= 0) {
                    const fallenId = targetAlly.id;
                    const realAllyIdx = sim.allySoldiers.indexOf(targetAlly);
                    if (realAllyIdx >= 0) sim.allySoldiers.splice(realAllyIdx, 1);
                    addFloatingText(targetAlly.x, targetAlly.y - 26, 'Asker Düştü!', '#F87171', false);
                    commitSave(
                      (prev) => ({
                        ...prev,
                        kingdom: {
                          ...prev.kingdom,
                          soldiers: prev.kingdom.soldiers.filter((s) => s.id !== fallenId),
                        },
                      }),
                      true
                    );
                  }
                } else if (targetKind === 'PLAYER') {
                  sim.playerHp = Math.max(0, sim.playerHp - dmg);
                  sim.playerHitFlashUntil = now + 150;
                  sim.screenShake = Math.max(sim.screenShake, 3);
                  addFloatingText(sim.playerX, sim.playerY - 22, `-${dmg}`, '#F87171', false);
                }
              } else if (ie.combatStyle === 'RANGED' && dToTarget < 270) {
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

        // Remove any island enemies defeated in faction-vs-faction skirmishes
        for (let ei = sim.islandEnemies.length - 1; ei >= 0; ei--) {
          if (sim.islandEnemies[ei].hp <= 0) {
            spawnParticles(
              sim.islandEnemies[ei].x,
              sim.islandEnemies[ei].y,
              10,
              sim.islandEnemies[ei].squadColor,
              'SPARK',
              90,
              3,
              true
            );
            sim.islandEnemies.splice(ei, 1);
          }
        }
      }

      // Autonomous & Organic Allied Soldiers AI (roam freely, scout, hunt, flank — never glued behind player!)
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
          const effectiveDmg = Math.round(spec.damage * dmgMult);

          // 1. Scan nearby enemies via SpatialGrid (within 460px)
          let nearestEnemy: IslandEnemy | null = null;
          let nearestEnemyDist = 460;
          enemyGrid.queryRadius(sol.x, sol.y, 460, enemyQueryBuf);
          for (let ei = 0; ei < enemyQueryBuf.length; ei++) {
            const ie = enemyQueryBuf[ei];
            if (ie.hp <= 0) continue;
            const d = dist(sol.x, sol.y, ie.x, ie.y);
            if (d < nearestEnemyDist) {
              nearestEnemyDist = d;
              nearestEnemy = ie;
            }
          }

          // 2. If no nearby enemy, some independent raiders actively hunt distant enemies across huge islands
          let huntTarget: IslandEnemy | null = nearestEnemy;
          if (!huntTarget && standingIslandEnemies.length > 0 && ai % 3 !== 0) {
            huntTarget = standingIslandEnemies[(ai * 7) % standingIslandEnemies.length];
          }

          let goalX = sol.x;
          let goalY = sol.y;
          let moveSpd = spec.speed * sol.personalSpeedMult;
          let isIdling = false;

          const isRangedSoldier = sol.type === 'MUSKETEER' || sol.type === 'GRENADIER';

          if (huntTarget) {
            sol.roamWaitUntil = 0;
            if (!isRangedSoldier) {
              const flankOffset = ((ai % 7) - 3) * 0.34;
              const approachA =
                Math.atan2(sol.y - huntTarget.y, sol.x - huntTarget.x) + flankOffset;
              goalX = huntTarget.x + Math.cos(approachA) * 24;
              goalY = huntTarget.y + Math.sin(approachA) * 24;
            } else {
              const spreadOffset = ((ai % 9) - 4) * 0.17;
              const awayA = Math.atan2(sol.y - huntTarget.y, sol.x - huntTarget.x) + spreadOffset;
              const standDist = (sol.type === 'GRENADIER' ? 172 : 156) + (ai % 4) * 18;
              goalX = huntTarget.x + Math.cos(awayA) * standDist;
              goalY = huntTarget.y + Math.sin(awayA) * standDist;
            }
          } else if (standingIsl) {
            // Free autonomous island wandering (no player-tail trailing!)
            if (sol.roamWaitUntil && now < sol.roamWaitUntil) {
              isIdling = true;
              // Gently glance around while standing guard
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
              moveSpd = spec.speed * sol.personalSpeedMult * (0.58 + ((ai % 5) * 0.06));
              if (dist(sol.x, sol.y, goalX, goalY) <= 22) {
                sol.roamTarget = undefined;
                sol.roamWaitUntil = now + 1200 + Math.random() * 2800;
                isIdling = true;
              }
            }
          } else {
            // Off-island fallback: drift loosely into wide perimeter around player
            const wanderA = (ai * 2.39996) + Math.sin(now * 0.0005 + ai) * 0.5;
            const wanderR = 90 + (ai % 6) * 28;
            goalX = sim.playerX + Math.cos(wanderA) * wanderR;
            goalY = sim.playerY + Math.sin(wanderA) * wanderR;
            moveSpd = spec.speed * 0.9;
          }

          if (!isIdling) {
            const dx = goalX - sol.x;
            const dy = goalY - sol.y;
            const dGoal = Math.hypot(dx, dy);
            if (dGoal > 7) {
              sol.angle = lerpAngle(sol.angle, Math.atan2(dy, dx), Math.min(1, dt * 10));
              let nx = sol.x + (dx / dGoal) * moveSpd * dt;
              let ny = sol.y + (dy / dGoal) * moveSpd * dt;
              if (standingIsl) {
                const idx = nx - standingIsl.centerX;
                const idy = ny - standingIsl.centerY;
                const ia = Math.atan2(idy, idx);
                const maxR = getIslandRadiusAtAngle(standingIsl, ia) - 12;
                if (Math.hypot(idx, idy) > maxR) {
                  nx = standingIsl.centerX + Math.cos(ia) * maxR;
                  ny = standingIsl.centerY + Math.sin(ia) * maxR;
                }
              }
              sol.x = nx;
              sol.y = ny;
              sol.walkPhase += dt * (huntTarget ? 11 : 7.5);
            } else if (nearestEnemy) {
              sol.angle = lerpAngle(
                sol.angle,
                Math.atan2(nearestEnemy.y - sol.y, nearestEnemy.x - sol.x),
                Math.min(1, dt * 12)
              );
            }
          }

          // O(1) neighborhood separation between allied soldiers via SpatialGrid
          allyGrid.queryRadius(sol.x, sol.y, 20, allyQueryBuf);
          for (let aj = 0; aj < allyQueryBuf.length; aj++) {
            const other = allyQueryBuf[aj];
            if (other === sol || other.hp <= 0) continue;
            const sd = dist(sol.x, sol.y, other.x, other.y);
            if (sd > 0.1 && sd < 19) {
              const push = (19 - sd) * 0.34;
              const pa = Math.atan2(sol.y - other.y, sol.x - other.x);
              sol.x += Math.cos(pa) * push;
              sol.y += Math.sin(pa) * push;
              other.x -= Math.cos(pa) * push;
              other.y -= Math.sin(pa) * push;
            }
          }

          // Soldier Attack Execution
          if (nearestEnemy && now - sol.lastAttackTime >= spec.cooldownMs) {
            const targetE = nearestEnemy;
            const dE = dist(sol.x, sol.y, targetE.x, targetE.y);
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
              spawnParticles(targetE.x, targetE.y, 5, '#F8FAFC', 'SPARK', 80, 2.5, true);
              addFloatingText(targetE.x, targetE.y - 18, `-${effectiveDmg}`, '#6EE7B7', false);
              if (targetE.hp <= 0) {
                const realIdx = sim.islandEnemies.indexOf(targetE);
                if (realIdx >= 0) defeatIslandEnemy(targetE, realIdx);
              }
            } else if (isRangedSoldier && dE <= spec.range) {
              sol.lastAttackTime = now;
              const shotA = Math.atan2(targetE.y - sol.y, targetE.x - sol.x);
              const isGrenadier = sol.type === 'GRENADIER';
              const projSpeed = isGrenadier ? 335 : 410;
              sim.landProjectiles.push({
                id: `alp_${Date.now()}_${Math.random()}`,
                owner: 'PLAYER',
                x: sol.x + Math.cos(shotA) * 14,
                y: sol.y + Math.sin(shotA) * 14,
                vx: Math.cos(shotA) * projSpeed,
                vy: Math.sin(shotA) * projSpeed,
                damage: effectiveDmg,
                color: isGrenadier ? '#FB923C' : currentSave.kingdom.bannerColor || '#10B981',
                life: isGrenadier ? 0.9 : 0.85,
                splashRadius: isGrenadier ? 54 : undefined,
              });
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playPistolShot();
              }
            }
          }
        }
      }

      // Land Projectiles Update (SpatialGrid accelerated collisions)
      if (isPlaying) {
        for (let i = sim.landProjectiles.length - 1; i >= 0; i--) {
          const lp = sim.landProjectiles[i];
          lp.x += lp.vx * dt;
          lp.y += lp.vy * dt;
          lp.life -= dt;

          let hit = false;
          if (lp.owner === 'PLAYER') {
            enemyGrid.queryRadius(lp.x, lp.y, 24, enemyQueryBuf);
            for (let ei = 0; ei < enemyQueryBuf.length; ei++) {
              const ie = enemyQueryBuf[ei];
              if (ie.hp <= 0) continue;
              if (dist(lp.x, lp.y, ie.x, ie.y) <= (lp.splashRadius ? 20 : 16)) {
                if (lp.splashRadius) {
                  const blastR = lp.splashRadius;
                  const splashDmg = Math.round(lp.damage * 0.78);
                  if (now - sim.lastSoldierSfxTime > 95) {
                    sim.lastSoldierSfxTime = now;
                    soundEngine.playCannonHit();
                  }
                  sim.screenShake = Math.max(sim.screenShake, 2.2);
                  spawnParticles(lp.x, lp.y, 12, '#FB923C', 'MUZZLE', 120, 4.4, true);
                  spawnParticles(lp.x, lp.y, 7, '#475569', 'SMOKE', 65, 5.2, true);
                  enemyGrid.queryRadius(lp.x, lp.y, blastR, enemyQueryBuf);
                  for (let si = 0; si < enemyQueryBuf.length; si++) {
                    const target = enemyQueryBuf[si];
                    if (target.hp <= 0) continue;
                    const sd = dist(lp.x, lp.y, target.x, target.y);
                    if (sd <= blastR) {
                      const dealt = target === ie ? lp.damage : splashDmg;
                      target.hp -= dealt;
                      target.hitFlashTime = now;
                      target.alerted = true;
                      ensureWarWithFaction(target.factionId);
                      addFloatingText(target.x, target.y - 20, `-${dealt}`, '#FB923C', false);
                      if (target.hp <= 0) {
                        const realIdx = sim.islandEnemies.indexOf(target);
                        if (realIdx >= 0) defeatIslandEnemy(target, realIdx);
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
                  spawnParticles(ie.x, ie.y, 6, '#FDE047', 'SPARK', 90, 2.8, true);
                  addFloatingText(ie.x, ie.y - 20, `-${lp.damage}`, '#FDE047', false);
                  if (ie.hp <= 0) {
                    const realIdx = sim.islandEnemies.indexOf(ie);
                    if (realIdx >= 0) defeatIslandEnemy(ie, realIdx);
                  }
                }
                hit = true;
                break;
              }
            }
          } else if (!sim.isSailing) {
            if (dist(lp.x, lp.y, sim.playerX, sim.playerY) <= 14) {
              sim.playerHp = Math.max(0, sim.playerHp - lp.damage);
              sim.playerHitFlashUntil = now + 150;
              sim.screenShake = Math.max(sim.screenShake, 2.8);
              if (now - sim.lastSoldierSfxTime > 95) {
                sim.lastSoldierSfxTime = now;
                soundEngine.playCannonHit();
              }
              addFloatingText(sim.playerX, sim.playerY - 22, `-${lp.damage}`, '#F87171', false);
              hit = true;
            } else {
              allyGrid.queryRadius(lp.x, lp.y, 20, allyQueryBuf);
              for (let ai = 0; ai < allyQueryBuf.length; ai++) {
                const ally = allyQueryBuf[ai];
                if (ally.hp <= 0) continue;
                if (dist(lp.x, lp.y, ally.x, ally.y) <= 13) {
                  ally.hp -= lp.damage;
                  ally.hitFlashTime = now;
                  if (now - sim.lastSoldierSfxTime > 95) {
                    sim.lastSoldierSfxTime = now;
                    soundEngine.playCannonHit();
                  }
                  addFloatingText(ally.x, ally.y - 18, `-${lp.damage}`, '#FCA5A5', false);
                  if (ally.hp <= 0) {
                    const fallenId = ally.id;
                    const realAllyIdx = sim.allySoldiers.indexOf(ally);
                    if (realAllyIdx >= 0) sim.allySoldiers.splice(realAllyIdx, 1);
                    addFloatingText(ally.x, ally.y - 24, 'Asker Düştü!', '#F87171', false);
                    commitSave((prev) => ({
                      ...prev,
                      kingdom: {
                        ...prev.kingdom,
                        soldiers: prev.kingdom.soldiers.filter((s) => s.id !== fallenId),
                      },
                    }));
                  }
                  hit = true;
                  break;
                }
              }
            }
          }

          if (!hit && lp.life <= 0 && lp.splashRadius && lp.owner === 'PLAYER') {
            const blastR = lp.splashRadius;
            const splashDmg = Math.round(lp.damage * 0.78);
            spawnParticles(lp.x, lp.y, 10, '#FB923C', 'MUZZLE', 110, 4.0, true);
            enemyGrid.queryRadius(lp.x, lp.y, blastR, enemyQueryBuf);
            for (let si = 0; si < enemyQueryBuf.length; si++) {
              const target = enemyQueryBuf[si];
              if (target.hp <= 0) continue;
              if (dist(lp.x, lp.y, target.x, target.y) <= blastR) {
                target.hp -= splashDmg;
                target.hitFlashTime = now;
                target.alerted = true;
                ensureWarWithFaction(target.factionId);
                addFloatingText(target.x, target.y - 20, `-${splashDmg}`, '#FB923C', false);
                if (target.hp <= 0) {
                  const realIdx = sim.islandEnemies.indexOf(target);
                  if (realIdx >= 0) defeatIslandEnemy(target, realIdx);
                }
              }
            }
          }

          if (hit || lp.life <= 0) {
            sim.landProjectiles.splice(i, 1);
          }
        }
      }

      // Safe recovery if Player HP reaches 0 on foot
      if (isPlaying && !sim.isSailing && sim.playerHp <= 0) {
        const starter = worldManagerRef.current.getIslandAtSector(0, 0);
        const coastR = starter ? getIslandRadiusAtAngle(starter, 0.12) : 290;
        const safePlayerX = Math.cos(0.12) * (coastR * 0.45);
        const safePlayerY = Math.sin(0.12) * (coastR * 0.45);
        const safeBoatX = Math.cos(0.12) * (coastR + 36);
        const safeBoatY = Math.sin(0.12) * (coastR + 36);

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

      // Gentle player & soldier heal on Starter Capital or Conquered Islands
      if (isPlaying && !sim.isSailing) {
        const standing = findStandingIsland(sim.playerX, sim.playerY);
        const isFriendlyTerritory =
          standing &&
          (standing.isStarter || currentSave.kingdom.conqueredIslandIds.includes(standing.id));
        if (isFriendlyTerritory) {
          if (sim.playerHp < MAX_PLAYER_HP) {
            sim.playerHp = Math.min(MAX_PLAYER_HP, sim.playerHp + 14 * dt);
          }
          for (const sol of sim.allySoldiers) {
            if (sol.hp < sol.maxHp) {
              sol.hp = Math.min(sol.maxHp, sol.hp + 10 * dt);
            }
          }
        }
      }

      // Periodic Nation Warship Spawner (up to 15 ships & 2–4 ship battle squadrons across rival nations)
      if (isPlaying) {
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
              });
            }
          }
        }
      }

      // Autonomous & Independent Allied Escort Warships AI (free patrolling & hunting, never a stiff V-tail!)
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

        for (const allyShip of sim.allyShips) {
          if (allyShip.cruiseSpeedMult === undefined) {
            allyShip.cruiseSpeedMult = 0.85 + Math.random() * 0.28;
          }
          if (allyShip.orbitSign === undefined) {
            allyShip.orbitSign = allyShip.slotIndex % 2 === 0 ? 1 : -1;
          }

          let targetEnemy: EnemyShip | null = null;
          let targetEnemyDist = 940;
          for (const enemy of sim.enemies) {
            const hostile =
              currentSave.kingdom.atWarWith.includes(enemy.factionId) ||
              enemy.factionId === 'CORSAIR';
            if (!hostile) continue;
            const d = dist(allyShip.x, allyShip.y, enemy.x, enemy.y);
            if (d < targetEnemyDist) {
              targetEnemyDist = d;
              targetEnemy = enemy;
            }
          }

          const dToPlayerBoat = dist(allyShip.x, allyShip.y, sim.boatX, sim.boatY);
          let desiredAngle = allyShip.angle;
          let moveSpd = ESCORT_SHIP_STATS.speed * allyShip.cruiseSpeedMult;

          if (targetEnemy) {
            // Engage hostile ship independently with individualized broadside orbit
            const aToEnemy = Math.atan2(targetEnemy.y - allyShip.y, targetEnemy.x - allyShip.x);
            const idealRange = 185 + (allyShip.slotIndex % 3) * 36;
            const radial =
              targetEnemyDist > idealRange + 45
                ? -0.48
                : targetEnemyDist < idealRange - 45
                ? 0.48
                : 0;
            desiredAngle = aToEnemy + allyShip.orbitSign * (Math.PI / 2 + radial);
            moveSpd = ESCORT_SHIP_STATS.speed * (0.94 + (allyShip.slotIndex % 3) * 0.05);
          } else if (dToPlayerBoat > 1350) {
            // Catch up loosely to the general sea theater around the player (not behind the stern)
            const scatterA =
              Math.atan2(sim.boatY - allyShip.y, sim.boatX - allyShip.x) +
              allyShip.orbitSign * 0.35;
            desiredAngle = scatterA;
            moveSpd = ESCORT_SHIP_STATS.speed * 1.1;
          } else {
            // Independent free-roaming patrol across surrounding waters
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

          // Smooth ship-to-ship & player-boat collision avoidance steering
          let repelX = 0;
          let repelY = 0;
          if (sim.isSailing && dToPlayerBoat < 115 && dToPlayerBoat > 1) {
            const awayA = Math.atan2(allyShip.y - sim.boatY, allyShip.x - sim.boatX);
            const w = (115 - dToPlayerBoat) / 115;
            repelX += Math.cos(awayA) * w;
            repelY += Math.sin(awayA) * w;
          }
          for (const otherAlly of sim.allyShips) {
            if (otherAlly === allyShip) continue;
            const dOther = dist(allyShip.x, allyShip.y, otherAlly.x, otherAlly.y);
            if (dOther < 95 && dOther > 1) {
              const awayA = Math.atan2(allyShip.y - otherAlly.y, allyShip.x - otherAlly.x);
              const w = (95 - dOther) / 95;
              repelX += Math.cos(awayA) * w;
              repelY += Math.sin(awayA) * w;
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

          for (const isl of visibleIslands) {
            const dx = nx - isl.centerX;
            const dy = ny - isl.centerY;
            const d = Math.hypot(dx, dy);
            const coastAngle = Math.atan2(dy, dx);
            const minR = getIslandRadiusAtAngle(isl, coastAngle) + 36;
            if (d < minR && d > 0.01) {
              nx = isl.centerX + Math.cos(coastAngle) * minR;
              ny = isl.centerY + Math.sin(coastAngle) * minR;
              // Steer tangentially around the island coast instead of getting stuck
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

          if (Math.random() < dt * 9) {
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
            targetEnemy &&
            targetEnemyDist < 400 &&
            now - allyShip.lastFireTime >= ESCORT_SHIP_STATS.cooldownMs
          ) {
            const fX = Math.cos(allyShip.angle);
            const fY = Math.sin(allyShip.angle);
            const toEX = (targetEnemy.x - allyShip.x) / Math.max(1, targetEnemyDist);
            const toEY = (targetEnemy.y - allyShip.y) / Math.max(1, targetEnemyDist);
            if (Math.abs(fX * toEX + fY * toEY) < 0.64) {
              allyShip.lastFireTime = now;
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

      // Enemy Ship Broadside AI (fights BOTH rival nations at sea and hostile player fleets!)
      if (isPlaying) {
        for (const enemy of sim.enemies) {
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
            for (const allyShip of sim.allyShips) {
              const dAlly = dist(enemy.x, enemy.y, allyShip.x, allyShip.y);
              if (dAlly < 640 && dAlly < targetDist) {
                targetDist = dAlly;
                targetX = allyShip.x;
                targetY = allyShip.y;
              }
            }
          }

          // Check rival enemy nation warships on the ocean!
          for (const other of sim.enemies) {
            if (other.id === enemy.id || other.factionId === enemy.factionId) continue;
            const dOther = dist(enemy.x, enemy.y, other.x, other.y);
            if (dOther < 700 && dOther < targetDist) {
              targetDist = dOther;
              targetX = other.x;
              targetY = other.y;
            }
          }

          let desiredAngle = enemy.patrolAngle;
          if (targetDist < 680) {
            const angleToTarget = Math.atan2(targetY - enemy.y, targetX - enemy.x);
            const radialPush = targetDist > 260 ? -0.45 : targetDist < 170 ? 0.5 : 0;
            desiredAngle = angleToTarget + enemy.broadsideSign * (Math.PI / 2 + radialPush);
          } else {
            enemy.patrolAngle += dt * 0.25 * enemy.broadsideSign;
          }

          enemy.angle = lerpAngle(enemy.angle, desiredAngle, Math.min(1, dt * 2.4));
          let nx = enemy.x + Math.cos(enemy.angle) * enemy.speed * dt;
          let ny = enemy.y + Math.sin(enemy.angle) * enemy.speed * dt;

          for (const isl of visibleIslands) {
            const dx = nx - isl.centerX;
            const dy = ny - isl.centerY;
            const d = Math.hypot(dx, dy);
            const minR = getIslandRadiusAtAngle(isl, Math.atan2(dy, dx)) + 34 * shipSpec.scale;
            if (d < minR) {
              const pushA = Math.atan2(dy, dx);
              nx = isl.centerX + Math.cos(pushA) * minR;
              ny = isl.centerY + Math.sin(pushA) * minR;
              enemy.patrolAngle += Math.PI * 0.5;
            }
          }
          enemy.x = nx;
          enemy.y = ny;

          if (Math.random() < dt * 10) {
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

      // Cannonballs Ballistics
      if (isPlaying) {
        for (let i = sim.cannonballs.length - 1; i >= 0; i--) {
          const cb = sim.cannonballs[i];
          cb.x += cb.vx * dt;
          cb.y += cb.vy * dt;
          cb.z += cb.vz * dt;
          cb.vz -= 135 * dt;
          cb.life -= dt;

          if (Math.random() < dt * 22) {
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
            for (let ei = sim.enemies.length - 1; ei >= 0; ei--) {
              const enemy = sim.enemies[ei];
              const hitR = enemy.tier === 3 ? 36 : enemy.tier === 2 ? 30 : 25;
              if (dist(cb.x, cb.y, enemy.x, enemy.y) <= hitR) {
                ensureWarWithFaction(enemy.factionId);
                enemy.hp -= cb.damage;
                enemy.hitFlashTime = now;
                sim.screenShake = Math.max(sim.screenShake, 3);
                soundEngine.playCannonHit();
                spawnParticles(cb.x, cb.y, 10, '#92400E', 'SPLINTER', 120, 3.6, true);
                spawnParticles(cb.x, cb.y, 6, '#F97316', 'MUZZLE', 90, 4.2, true);
                addFloatingText(enemy.x, enemy.y - 26, `-${cb.damage}`, '#FCA5A5');

                if (enemy.hp <= 0) {
                  soundEngine.playEnemySunk();
                  spawnParticles(enemy.x, enemy.y, 24, '#78350F', 'SPLINTER', 150, 4.5, true);
                  spawnParticles(enemy.x, enemy.y, 16, '#FBBF24', 'GOLD', 130, 4.0, true);
                  sim.floatingLoot.push({
                    id: `loot_${Date.now()}_${Math.random()}`,
                    x: enemy.x,
                    y: enemy.y,
                    goldValue: enemy.goldBounty,
                    bobOffset: Math.random() * Math.PI * 2,
                    life: 45,
                  });
                  addFloatingText(enemy.x, enemy.y - 36, `${enemy.name} Batırıldı!`, '#FDE047');
                  sim.enemies.splice(ei, 1);
                  commitSave((prev) => ({
                    ...prev,
                    enemiesSunkCount: prev.enemiesSunkCount + 1,
                  }));
                }

                sim.cannonballs.splice(i, 1);
                removed = true;
                break;
              }
            }
          } else {
            // Rival-nation cannonball: first check if it hits a competing nation's ship!
            let hitOtherShip = false;
            for (let ei = sim.enemies.length - 1; ei >= 0; ei--) {
              const otherShip = sim.enemies[ei];
              if (otherShip.factionId === cb.owner) continue;
              const hitR = otherShip.tier === 3 ? 35 : otherShip.tier === 2 ? 29 : 24;
              if (dist(cb.x, cb.y, otherShip.x, otherShip.y) <= hitR) {
                otherShip.hp -= cb.damage;
                otherShip.hitFlashTime = now;
                soundEngine.playCannonHit();
                spawnParticles(cb.x, cb.y, 8, '#92400E', 'SPLINTER', 110, 3.3, true);
                if (otherShip.hp <= 0) {
                  soundEngine.playEnemySunk();
                  spawnParticles(otherShip.x, otherShip.y, 20, '#78350F', 'SPLINTER', 140, 4.2, true);
                  sim.floatingLoot.push({
                    id: `loot_${Date.now()}_${Math.random()}`,
                    x: otherShip.x,
                    y: otherShip.y,
                    goldValue: Math.round(otherShip.goldBounty * 0.75),
                    bobOffset: Math.random() * Math.PI * 2,
                    life: 45,
                  });
                  addFloatingText(otherShip.x, otherShip.y - 30, `${otherShip.name} Batırıldı!`, '#FDE047');
                  sim.enemies.splice(ei, 1);
                }
                sim.cannonballs.splice(i, 1);
                removed = true;
                hitOtherShip = true;
                break;
              }
            }

            let hitEscort = false;
            if (!hitOtherShip) {
              for (let ai = sim.allyShips.length - 1; ai >= 0; ai--) {
                const allyShip = sim.allyShips[ai];
                if (dist(cb.x, cb.y, allyShip.x, allyShip.y) <= 23) {
                  allyShip.hp -= cb.damage;
                  allyShip.hitFlashTime = now;
                  soundEngine.playCannonHit();
                  spawnParticles(cb.x, cb.y, 8, '#B45309', 'SPLINTER', 100, 3.2, true);
                  addFloatingText(allyShip.x, allyShip.y - 22, `-${cb.damage}`, '#FCA5A5');
                  if (allyShip.hp <= 0) {
                    soundEngine.playEnemySunk();
                    spawnParticles(allyShip.x, allyShip.y, 18, '#78350F', 'SPLINTER', 140, 4.0, true);
                    addFloatingText(allyShip.x, allyShip.y - 30, 'Refakat Gemisi Battı!', '#EF4444');
                    sim.allyShips.splice(ai, 1);
                    commitSave((prev) => ({
                      ...prev,
                      kingdom: {
                        ...prev.kingdom,
                        escortShipCount: sim.allyShips.length,
                      },
                    }));
                  }
                  sim.cannonballs.splice(i, 1);
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
              sim.boatHp = Math.max(0, sim.boatHp - cb.damage);
              sim.boatHitFlashUntil = now + 150;
              sim.screenShake = Math.max(sim.screenShake, 4.5);
              soundEngine.playCannonHit();
              spawnParticles(cb.x, cb.y, 10, '#B45309', 'SPLINTER', 110, 3.4, true);
              addFloatingText(sim.boatX, sim.boatY - 26, `-${cb.damage} Gövde`, '#F87171');

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
                commitSave((prev) => ({
                  ...prev,
                  boatHp: sim.boatHp,
                  player: { ...prev.player, x: safeX, y: safeY },
                  boat: { ...prev.boat, x: safeX, y: safeY },
                }));
                break;
              }

              sim.cannonballs.splice(i, 1);
              removed = true;
            }
          }

          if (removed) continue;

          const hitLand = visibleIslands.some((isl) => isPointOnIsland(isl, cb.x, cb.y, 0));
          if (hitLand) {
            spawnParticles(cb.x, cb.y, 8, '#D9B26F', 'SAND', 80, 3.2, true);
            sim.cannonballs.splice(i, 1);
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
            spawnParticles(cb.x, cb.y, 6, '#E0F7FA', 'WATER', 65, 3, true);
            soundEngine.playWaterSplash();
            sim.cannonballs.splice(i, 1);
          }
        }
      }

      // Floating Loot pickup (both ocean bounty & island enemy drops)
      if (isPlaying) {
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

          if (dist(collectorX, collectorY, loot.x, loot.y) <= pickupR) {
            soundEngine.playSellCoins();
            spawnParticles(loot.x, loot.y, 14, '#FBBF24', 'GOLD', 110, 3.6, true);
            if (loot.healHp) {
              sim.playerHp = Math.min(MAX_PLAYER_HP, sim.playerHp + loot.healHp);
            }
            addFloatingText(
              loot.x,
              loot.y - 22,
              loot.healHp
                ? `+${loot.goldValue} Altın · +${loot.healHp} Can`
                : `+${loot.goldValue} Altın Ganimet!`,
              '#FDE047'
            );
            const reward = loot.goldValue;
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
        }
      }

      // Island Fort Capture & Conquest Mechanic
      if (isPlaying && !sim.isSailing) {
        const standing = findStandingIsland(sim.playerX, sim.playerY);
        if (standing && standing.fortPos) {
          const effFaction = getEffectiveIslandFaction(
            standing.factionId,
            standing.id,
            standing.isStarter,
            currentSave.kingdom
          );
          if (effFaction !== 'NEUTRAL' && effFaction !== 'PLAYER') {
            const defendersLeft = sim.islandEnemies.filter((ie) => ie.islandId === standing.id).length;
            const prevProg =
              sim.fortCapture && sim.fortCapture.islandId === standing.id
                ? sim.fortCapture.progress
                : 0;
            const inFortZone =
              dist(sim.playerX, sim.playerY, standing.fortPos.x, standing.fortPos.y) <= 78 ||
              sim.allySoldiers.some(
                (sol) => dist(sol.x, sol.y, standing.fortPos!.x, standing.fortPos!.y) <= 78
              );

            let nextProg = prevProg;
            if (defendersLeft === 0 && inFortZone) {
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
              commitSave((prev) => ({
                ...prev,
                gold: prev.gold + conquestBounty,
                totalGoldEarned: prev.totalGoldEarned + conquestBounty,
                kingdom: {
                  ...prev.kingdom,
                  founded: true,
                  conqueredIslandIds: prev.kingdom.conqueredIslandIds.includes(standing.id)
                    ? prev.kingdom.conqueredIslandIds
                    : [...prev.kingdom.conqueredIslandIds, standing.id],
                },
              }));
            } else {
              sim.fortCapture = { islandId: standing.id, progress: nextProg, defendersLeft };
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

      // Passive Kingdom Tribute every 20 seconds
      if (isPlaying && currentSave.kingdom.founded && now - sim.lastTributeTime >= 20000) {
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

      // Rival Nations Geopolitics: War Declarations & Island Conquests
      if (isPlaying && now >= sim.nextCampaignTime) {
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

      if (isPlaying && now - sim.lastAutoSaveTime > 2000) {
        sim.lastAutoSaveTime = now;
        const updatedSave: SaveData = {
          ...saveRef.current,
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

      let digTarget: Vec2 | null = null;
      if (!sim.isSailing && postStandingIsl) {
        const tx = sim.playerX + Math.cos(sim.playerAngle) * 19;
        const ty = sim.playerY + Math.sin(sim.playerAngle) * 19;
        digTarget = isPointOnIsland(postStandingIsl, tx, ty, -4)
          ? { x: tx, y: ty }
          : { x: sim.playerX, y: sim.playerY };
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetW = Math.max(1, Math.floor(rect.width * dpr));
          const targetH = Math.max(1, Math.floor(rect.height * dpr));
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const digProgress =
            sim.digAnimStart > 0 ? clamp((now - sim.digAnimStart) / 300, 0, 1) : 0;
          if (digProgress >= 1) sim.digAnimStart = 0;

          const attackProgress =
            sim.attackAnimStart > 0 ? clamp((now - sim.attackAnimStart) / 220, 0, 1) : 0;
          if (attackProgress >= 1) sim.attackAnimStart = 0;

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
          });
        }
      }

      if (now - lastHudSync > 90) {
        lastHudSync = now;
        const digCd = getDigCooldownMs(currentSave.upgrades.shovelLevel);
        const cannonCd = getCannonCooldownMs(currentSave.upgrades.cannonLevel);
        const radarCd = getRadarCooldownMs(currentSave.upgrades.radarLevel);
        const attackCd = currentSave.equippedWeapon
          ? WEAPONS[currentSave.equippedWeapon].cooldownMs
          : 400;

        const nearbySeaEnemies = sim.enemies.filter(
          (e) => dist(e.x, e.y, activeCenterX, activeCenterY) < 620
        ).length;
        const nearbyLandEnemies = sim.islandEnemies.filter(
          (ie) => ie.alerted && dist(ie.x, ie.y, activeCenterX, activeCenterY) < 420
        ).length;

        setHudState({
          canBoard: nearBoat,
          canDisembark: Boolean(nearShore),
          canDig: !sim.isSailing && Boolean(postStandingIsl),
          nearDock,
          isSailing: sim.isSailing,
          shipClassName: activeShipSpec.name,
          boatHp: Math.round(sim.boatHp),
          maxBoatHp,
          playerHp: Math.round(sim.playerHp),
          equippedWeapon: currentSave.equippedWeapon,
          nearbyEnemyCount: sim.isSailing ? nearbySeaEnemies : nearbyLandEnemies,
          currentIslandName: postStandingIsl
            ? postStandingIsl.name
            : nearShore
            ? `${nearShore.name} Açıkları`
            : 'Açık Deniz',
          digCooldownPct: clamp(1 - (now - sim.lastDigTime) / digCd, 0, 1),
          cannonCooldownPct: clamp(1 - (now - sim.lastCannonTime) / cannonCd, 0, 1),
          attackCooldownPct: clamp(1 - (now - sim.lastAttackTime) / attackCd, 0, 1),
          radarCooldownPct: clamp(1 - (now - sim.lastRadarTime) / radarCd, 0, 1),
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [
    addFloatingText,
    commitSave,
    defeatIslandEnemy,
    ensureWarWithFaction,
    findNearestShoreIsland,
    findStandingIsland,
    fireBroadside,
    spawnParticles,
  ]);

  const handleSellItem = useCallback(
    (uid: string) => {
      if (!hudState.nearDock) return;
      const item = saveRef.current.bag.find((b) => b.uid === uid);
      if (!item) return;
      soundEngine.playSellCoins();
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
    commitSave((prev) => ({
      ...prev,
      gold: prev.gold + total,
      totalGoldEarned: prev.totalGoldEarned + total,
      bag: [],
    }));
  }, [commitSave, hudState.nearDock]);

  const handleBuyUpgrade = useCallback(
    (key: UpgradeKey) => {
      if (!hudState.nearDock) return;
      const def = UPGRADE_DEFS.find((d) => d.key === key);
      if (!def) return;
      const currentLvl = saveRef.current.upgrades[key];
      if (currentLvl >= def.maxLevel) return;
      const cost = getUpgradeCost(def, currentLvl);
      if (saveRef.current.gold < cost) return;

      soundEngine.playUpgrade();
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
    [commitSave, hudState.nearDock]
  );

  const handleFoundKingdom = useCallback(
    (name: string, bannerColor: string) => {
      if (saveRef.current.gold < KINGDOM_COSTS.FOUND_KINGDOM) return;
      soundEngine.playConquestFanfare();
      addFloatingText(
        simRef.current.isSailing ? simRef.current.boatX : simRef.current.playerX,
        (simRef.current.isSailing ? simRef.current.boatY : simRef.current.playerY) - 34,
        `${name} İlan Edildi!`,
        '#34D399'
      );
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
    [addFloatingText, commitSave]
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

    const nextLevel = curLevel + 1;
    const { hpMult } = getSoldierPowerMultiplier(nextLevel);
    soundEngine.playUpgrade();

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

  const handleResetSave = useCallback(() => {
    clearSaveData();
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

  const activeHp = hudState.isSailing ? hudState.boatHp : hudState.playerHp;
  const activeMaxHp = hudState.isSailing ? hudState.maxBoatHp : MAX_PLAYER_HP;
  const hpPct = clamp((activeHp / Math.max(1, activeMaxHp)) * 100, 0, 100);
  const weaponDef = hudState.equippedWeapon ? WEAPONS[hudState.equippedWeapon] : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07364B]">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {phase === 'TITLE_MENU' && (
        <TitleOverlay
          hasSavedProgress={hasSavedProgress}
          savedGold={save.gold}
          discoveredCount={save.discoveredIslandIds.length}
          onStart={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-0 z-20 p-3 sm:p-5 flex flex-col justify-between">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="pointer-events-auto flex flex-col items-start gap-2">
              {(hudState.isSailing || activeHp < activeMaxHp || hudState.nearbyEnemyCount > 0) && (
                <div className="px-3 py-2 rounded-xl bg-[#0F2936]/90 border border-white/15 flex items-center gap-2.5 shadow-md">
                  <Heart className="w-4 h-4 text-red-400 shrink-0" />
                  <div className="w-24 sm:w-28 h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hpPct > 45 ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-slate-100">
                    {activeHp}/{activeMaxHp}
                  </span>
                  {hudState.isSailing && (
                    <span className="text-[11px] font-semibold text-amber-200/90 border-l border-white/15 pl-2 whitespace-nowrap">
                      {hudState.shipClassName}
                    </span>
                  )}
                </div>
              )}

              {!hudState.isSailing && weaponDef && (
                <div className="px-3 py-1.5 rounded-xl bg-[#0F2936]/90 border border-white/15 text-xs font-medium text-slate-100 flex items-center gap-2 shadow-md">
                  <Sword className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="whitespace-nowrap">{weaponDef.name}</span>
                </div>
              )}

              {hudState.nearbyEnemyCount > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-red-950/85 border border-red-400/45 text-red-200 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="whitespace-nowrap">
                    {hudState.isSailing
                      ? `Yakında Düşman Gemisi (${hudState.nearbyEnemyCount})`
                      : `Adada Düşman Takımı (${hudState.nearbyEnemyCount})`}
                  </span>
                </div>
              )}

              {hudState.nearDock && (
                <button
                  type="button"
                  onClick={() => setActiveModal('SHOP')}
                  className="px-3.5 py-2 rounded-xl bg-[#0F2936]/90 hover:bg-[#173D4F] border border-amber-400/50 text-amber-300 text-xs font-semibold flex items-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer"
                >
                  <Store className="w-4 h-4" />
                  <span>Tüccar İskelesi Açık (T)</span>
                </button>
              )}
            </div>

            <TopRightHud
              gold={save.gold}
              bagCount={save.bag.length}
              nearDock={hudState.nearDock}
              currentIslandName={hudState.currentIslandName}
              kingdomFounded={save.kingdom.founded}
              soldierCount={save.kingdom.soldiers.length}
              onOpenSettings={() => setActiveModal('SETTINGS')}
              onOpenMap={() => setActiveModal('MAP')}
              onOpenShop={() => setActiveModal('SHOP')}
              onOpenKingdom={() => setActiveModal('KINGDOM')}
            />
          </div>

          {/* Bottom Row */}
          <div className="flex items-end justify-between gap-4">
            <VirtualJoystick
              mode={settings.joystickMode}
              onChange={(vec) => {
                simRef.current.joystickVec = vec;
              }}
            />

            <ActionControls
              isSailing={hudState.isSailing}
              canBoard={hudState.canBoard}
              canDisembark={hudState.canDisembark}
              canDig={hudState.canDig}
              equippedWeapon={hudState.equippedWeapon}
              digCooldownPct={hudState.digCooldownPct}
              cannonCooldownPct={hudState.cannonCooldownPct}
              attackCooldownPct={hudState.attackCooldownPct}
              radarCooldownPct={hudState.radarCooldownPct}
              lastRadar={lastRadar}
              onDig={handleDig}
              onFireCannons={handleFireCannons}
              onAttackLand={handleAttackLand}
              onToggleBoat={handleToggleBoat}
              onRadar={handleRadar}
            />
          </div>
        </div>
      )}

      {isPortrait && !dismissPortraitHint && phase === 'PLAYING' && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#0F2936]/95 border border-amber-400/40 text-xs text-slate-100 flex items-center gap-2.5 shadow-xl">
          <RotateCw className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="whitespace-nowrap">En iyi deneyim için telefonu yatay çevirin</span>
          <button
            type="button"
            onClick={() => setDismissPortraitHint(true)}
            className="text-slate-400 hover:text-white font-semibold ml-1 cursor-pointer"
          >
            Kapat
          </button>
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
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'SHOP' && (
        <ShopModal
          gold={save.gold}
          bag={save.bag}
          upgrades={save.upgrades}
          nearDock={hudState.nearDock}
          onSellAll={handleSellAll}
          onSellItem={handleSellItem}
          onBuyUpgrade={handleBuyUpgrade}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'KINGDOM' && (
        <KingdomModal
          gold={save.gold}
          kingdom={save.kingdom}
          nationIslandCounts={nationIslandCounts}
          onFoundKingdom={handleFoundKingdom}
          onRecruitSoldier={handleRecruitSoldier}
          onUpgradeArmy={handleUpgradeArmy}
          onRecruitShip={handleRecruitShip}
          onHealArmy={handleHealArmy}
          onDeclareWar={handleDeclareWar}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'SETTINGS' && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          onResetSave={handleResetSave}
          onClose={() => setActiveModal('NONE')}
        />
      )}
    </div>
  );
}
