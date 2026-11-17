import Peer, { DataConnection } from 'peerjs';
import {
  ClientToHostMessage,
  HostToClientMessage,
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
  RemoteSoldierSnapshot,
  RoomLedger,
  StarterSlot,
} from '../types/online';
import { SoldierType, WeaponId } from '../types/game';
import {
  computeNextStarterSlot,
  getIslandRadiusAtAngle,
  isPointOnIsland,
  WorldManager,
} from './worldGen';
import {
  createProfileForSlot,
  generateRoomCode,
  loadRoomLedger,
  saveRoomLedger,
} from './onlineStorage';
import {
  getMaxBoatHp,
  getUpgradeCost,
  UPGRADE_DEFS,
  UpgradeKey,
} from './upgrades';
import {
  ESCORT_SHIP_STATS,
  getArmyUpgradeCost,
  getSoldierPowerMultiplier,
  KINGDOM_COSTS,
  MAX_ARMY_LEVEL,
  SOLDIER_SPECS,
} from './factions';
import { pickStrongerWeapon } from './weapons';
import { clamp, dist } from '../utils/prng';

const PEER_PREFIX = 'shpup-tropikada-v1-';
const INTEREST_RADIUS = 3400;

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface OnlineCallbacks {
  onStatusChange: (status: OnlineConnectionStatus, errorMsg?: string) => void;
  onLobbyUpdate: (
    roomInfo: OnlineRoomInfo,
    players: RemotePlayerSnapshot[],
    starterSlots: StarterSlot[]
  ) => void;
  onWelcome: (msg: Extract<HostToClientMessage, { type: 'welcome' }>) => void;
  onGameStarted: (roomInfo: OnlineRoomInfo, starterSlots: StarterSlot[]) => void;
  onStarterAdded: (slot: StarterSlot) => void;
  onProfileSync: (profile: PlayerProfileLedger) => void;
  onSnapshot: (
    players: RemotePlayerSnapshot[],
    projectiles: OnlineProjectileSnapshot[]
  ) => void;
  onWorldEvent: (event: OnlineWorldEvent) => void;
  onWarSync: (warDeclarations: Record<string, string[]>) => void;
  onChat: (msg: OnlineChatMessage) => void;
  onPingUpdate: (rttMs: number) => void;
}

export class OnlineSessionManager {
  private peer: Peer | null = null;
  private role: 'HOST' | 'CLIENT' | null = null;
  private status: OnlineConnectionStatus = 'IDLE';
  private callbacks: OnlineCallbacks;
  private identity: PlayerIdentity | null = null;

  // Host state
  private ledger: RoomLedger | null = null;
  private worldManager: WorldManager | null = null;
  private connections = new Map<string, DataConnection>(); // conn.peer -> conn
  private peerToPlayerId = new Map<string, string>();
  private playerToConn = new Map<string, DataConnection>();
  private playerPoses = new Map<string, RemotePlayerSnapshot>();
  private playerSoldierPoses = new Map<
    string,
    Map<string, { x: number; y: number; angle: number; swinging?: boolean }>
  >();
  private playerEscortShips = new Map<string, RemoteEscortShipSnapshot[]>();
  private projectiles: OnlineProjectileSnapshot[] = [];
  private hitFlashUntilByPlayer = new Map<string, number>();
  private hostTickTimer: number | null = null;
  private hostSaveTimer: number | null = null;
  private lastTickMs = 0;

  // Client state
  private hostConn: DataConnection | null = null;
  private currentRoomId = '';
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private poseSeq = 0;
  private destroyed = false;

  constructor(callbacks: OnlineCallbacks) {
    this.callbacks = callbacks;
  }

  public getRole(): 'HOST' | 'CLIENT' | null {
    return this.role;
  }

  public getStatus(): OnlineConnectionStatus {
    return this.status;
  }

  public getLedger(): RoomLedger | null {
    return this.ledger;
  }

  private setStatus(next: OnlineConnectionStatus, err?: string) {
    this.status = next;
    this.callbacks.onStatusChange(next, err);
  }

  public async createOrResumeHostRoom(
    identity: PlayerIdentity,
    rule: OnlineModeRule,
    resumeRoomId?: string
  ): Promise<string> {
    this.disconnect();
    this.destroyed = false;
    this.role = 'HOST';
    this.identity = identity;
    this.setStatus('CONNECTING');

    const roomId = (resumeRoomId || generateRoomCode()).trim().toUpperCase();
    this.currentRoomId = roomId;

    let existingLedger = resumeRoomId ? await loadRoomLedger(roomId) : null;
    const worldSeed = existingLedger?.roomInfo.worldSeed ?? Math.floor(100000 + Math.random() * 899999);

    const wm = new WorldManager(worldSeed, 1, true);
    this.worldManager = wm;

    if (existingLedger) {
      existingLedger = {
        ...existingLedger,
        warDeclarations: existingLedger.warDeclarations ?? {},
        roomInfo: {
          ...existingLedger.roomInfo,
          hostPlayerId: identity.playerId,
          hostName: identity.name,
          rule,
          updatedAt: Date.now(),
        },
      };
      wm.setStarterSlots(existingLedger.starterSlots);
    } else {
      const hostSlot = computeNextStarterSlot(
        [],
        identity.playerId,
        identity.name,
        identity.bannerColor,
        worldSeed,
        wm
      );
      wm.addStarterSlot(hostSlot);
      const hostProfile = createProfileForSlot(identity, hostSlot, wm);
      existingLedger = {
        roomInfo: {
          roomId,
          hostPlayerId: identity.playerId,
          hostName: identity.name,
          worldSeed,
          rule,
          started: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        starterSlots: [hostSlot],
        openedTreasureIds: [],
        dugCraters: [],
        islandOwners: {},
        warDeclarations: {},
        playersById: {
          [identity.playerId]: hostProfile,
        },
      };
    }

    // Ensure host has a profile & starter slot even on imported/resumed rooms
    if (!existingLedger.playersById[identity.playerId]) {
      const hostSlot = computeNextStarterSlot(
        existingLedger.starterSlots,
        identity.playerId,
        identity.name,
        identity.bannerColor,
        worldSeed,
        wm
      );
      existingLedger.starterSlots.push(hostSlot);
      wm.addStarterSlot(hostSlot);
      existingLedger.playersById[identity.playerId] = createProfileForSlot(identity, hostSlot, wm);
    } else {
      existingLedger.playersById[identity.playerId].name = identity.name;
      existingLedger.playersById[identity.playerId].bannerColor = identity.bannerColor;
    }

    this.ledger = existingLedger;
    const hostProf = existingLedger.playersById[identity.playerId];
    this.playerPoses.set(identity.playerId, this.profileToPose(hostProf, true, true));
    await saveRoomLedger(existingLedger);

    return new Promise((resolve, reject) => {
      const peer = new Peer(`${PEER_PREFIX}${roomId}`, {
        debug: 0,
        config: ICE_CONFIG,
      });
      this.peer = peer;

      peer.on('open', () => {
        if (this.destroyed) return;
        this.setStatus(existingLedger!.roomInfo.started ? 'PLAYING' : 'LOBBY');
        this.callbacks.onWelcome({
          type: 'welcome',
          roomInfo: existingLedger!.roomInfo,
          yourProfile: hostProf,
          starterSlots: existingLedger!.starterSlots,
          openedTreasureIds: existingLedger!.openedTreasureIds,
          dugCraters: existingLedger!.dugCraters,
          islandOwners: existingLedger!.islandOwners,
          warDeclarations: existingLedger!.warDeclarations ?? {},
          players: Array.from(this.playerPoses.values()),
        });
        this.startHostLoops();
        resolve(roomId);
      });

      peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });

      peer.on('error', (err) => {
        const msg =
          err.type === 'unavailable-id'
            ? 'Bu oda kodu şu an kullanımda. Yeni bir oda kodu deneyin.'
            : `P2P bağlantı hatası: ${err.message || err.type}`;
        this.setStatus('ERROR', msg);
        reject(new Error(msg));
      });
    });
  }

  public joinRoom(roomIdRaw: string, identity: PlayerIdentity): void {
    this.disconnect();
    this.destroyed = false;
    this.role = 'CLIENT';
    this.identity = identity;
    this.currentRoomId = roomIdRaw.trim().toUpperCase();
    this.setStatus('CONNECTING');

    const peer = new Peer({
      debug: 0,
      config: ICE_CONFIG,
    });
    this.peer = peer;

    peer.on('open', () => {
      if (this.destroyed) return;
      this.connectToHost();
    });

    peer.on('error', (err) => {
      if (this.destroyed) return;
      if (err.type === 'peer-unavailable') {
        this.setStatus('ERROR', 'Oda bulunamadı. Oda kodunu ve kurucunun açık olduğunu kontrol edin.');
      } else {
        this.setStatus('RECONNECTING', `Bağlantı yenileniyor (${err.type})...`);
        this.scheduleReconnect();
      }
    });
  }

  private connectToHost() {
    if (!this.peer || this.destroyed || !this.identity) return;
    const targetPeerId = `${PEER_PREFIX}${this.currentRoomId}`;
    const conn = this.peer.connect(targetPeerId, { reliable: true });
    this.hostConn = conn;

    conn.on('open', () => {
      if (this.destroyed || !this.identity) return;
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.sendToHost({
        type: 'hello',
        playerId: this.identity.playerId,
        name: this.identity.name,
        bannerColor: this.identity.bannerColor,
      });
      this.startClientPingLoop();
    });

    conn.on('data', (raw) => {
      const msg = raw as HostToClientMessage;
      this.handleHostMessage(msg);
    });

    conn.on('close', () => {
      if (this.destroyed) return;
      this.setStatus('RECONNECTING', 'Kurucu ile bağlantı koptu, yeniden bağlanılıyor...');
      this.scheduleReconnect();
    });

    conn.on('error', () => {
      if (this.destroyed) return;
      this.setStatus('RECONNECTING', 'Veri kanalı hatası, yeniden bağlanılıyor...');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.destroyed || this.role !== 'CLIENT') return;
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed && this.peer && !this.peer.destroyed) {
        this.connectToHost();
      }
    }, 2200);
  }

  private startClientPingLoop() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (this.hostConn?.open) {
        this.sendToHost({ type: 'cmd:ping', ts: performance.now() });
      }
    }, 2800);
  }

  private setupHostConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    conn.on('data', (raw) => {
      const msg = raw as ClientToHostMessage;
      this.handleClientMessage(conn, msg);
    });
    conn.on('close', () => {
      this.connections.delete(conn.peer);
      const pid = this.peerToPlayerId.get(conn.peer);
      this.peerToPlayerId.delete(conn.peer);
      if (pid) {
        this.playerToConn.delete(pid);
        const pose = this.playerPoses.get(pid);
        if (pose) {
          pose.connected = false;
        }
        this.broadcastLobbyState();
      }
    });
  }

  private profileToPose(
    prof: PlayerProfileLedger,
    connected: boolean,
    isHost: boolean
  ): RemotePlayerSnapshot {
    return {
      id: prof.playerId,
      name: prof.name,
      bannerColor: prof.bannerColor,
      kingdomFounded: prof.kingdomFounded,
      kingdomName: prof.kingdomName,
      x: prof.player.x,
      y: prof.player.y,
      angle: prof.player.angle,
      boatX: prof.boat.x,
      boatY: prof.boat.y,
      boatAngle: prof.boat.angle,
      isSailing: prof.player.isSailing,
      boatLevel: prof.upgrades.boatLevel,
      boatHp: prof.boatHp,
      maxBoatHp: getMaxBoatHp(prof.upgrades.boatLevel),
      playerHp: prof.playerHp,
      equippedWeapon: prof.equippedWeapon,
      speedRatio: 0,
      walkPhase: 0,
      digAnimProgress: 0,
      attackAnimProgress: 0,
      hitFlash: false,
      connected,
      isHost,
      starterSlotIndex: prof.starterSlotIndex,
      conqueredCount: prof.conqueredIslandIds.length,
    };
  }

  private handleClientMessage(conn: DataConnection, msg: ClientToHostMessage) {
    if (!this.ledger || !this.worldManager) return;

    if (msg.type === 'cmd:ping') {
      if (conn.open) conn.send({ type: 'pong', ts: msg.ts } satisfies HostToClientMessage);
      return;
    }

    if (msg.type === 'hello') {
      const pid = msg.playerId;
      this.peerToPlayerId.set(conn.peer, pid);
      this.playerToConn.set(pid, conn);

      let prof = this.ledger.playersById[pid];
      let slotAdded: StarterSlot | null = null;

      if (!prof) {
        const slot = computeNextStarterSlot(
          this.ledger.starterSlots,
          pid,
          msg.name,
          msg.bannerColor,
          this.ledger.roomInfo.worldSeed,
          this.worldManager
        );
        this.ledger.starterSlots.push(slot);
        this.worldManager.addStarterSlot(slot);
        prof = createProfileForSlot(
          { playerId: pid, name: msg.name, bannerColor: msg.bannerColor },
          slot,
          this.worldManager
        );
        this.ledger.playersById[pid] = prof;
        slotAdded = slot;
      } else {
        prof.name = msg.name;
        prof.bannerColor = msg.bannerColor;
        prof.lastSeenAt = Date.now();
        const existingSlot = this.ledger.starterSlots.find((s) => s.playerId === pid);
        if (existingSlot) {
          existingSlot.ownerName = msg.name;
          existingSlot.bannerColor = msg.bannerColor;
          this.worldManager.addStarterSlot(existingSlot);
        }
      }

      const pose = this.profileToPose(prof, true, pid === this.ledger.roomInfo.hostPlayerId);
      this.playerPoses.set(pid, pose);

      if (conn.open) {
        conn.send({
          type: 'welcome',
          roomInfo: this.ledger.roomInfo,
          yourProfile: prof,
          starterSlots: this.ledger.starterSlots,
          openedTreasureIds: this.ledger.openedTreasureIds,
          dugCraters: this.ledger.dugCraters,
          islandOwners: this.ledger.islandOwners,
          warDeclarations: this.ledger.warDeclarations ?? {},
          players: Array.from(this.playerPoses.values()),
        } satisfies HostToClientMessage);
      }

      if (slotAdded) {
        this.callbacks.onStarterAdded(slotAdded);
        this.broadcastToClients({ type: 'world:starter_added', slot: slotAdded }, pid);
      }

      this.broadcastLobbyState();
      void saveRoomLedger(this.ledger);
      return;
    }

    const pid = this.peerToPlayerId.get(conn.peer);
    if (!pid) return;
    this.processAuthoritativeCommand(pid, msg);
  }

  public submitLocalPose(pose: Omit<Extract<ClientToHostMessage, { type: 'state:pose' }>, 'type' | 'seq'>) {
    if (this.role === 'HOST' && this.identity) {
      this.applyPose(this.identity.playerId, { type: 'state:pose', seq: ++this.poseSeq, ...pose });
    } else if (this.role === 'CLIENT') {
      this.sendToHost({ type: 'state:pose', seq: ++this.poseSeq, ...pose });
    }
  }

  public submitLocalCommand(cmd: Exclude<ClientToHostMessage, { type: 'hello' } | { type: 'state:pose' }>) {
    if (this.role === 'HOST' && this.identity) {
      this.processAuthoritativeCommand(this.identity.playerId, cmd);
    } else if (this.role === 'CLIENT') {
      this.sendToHost(cmd);
    }
  }

  public hostStartGame() {
    if (this.role !== 'HOST' || !this.ledger) return;
    this.ledger.roomInfo.started = true;
    this.ledger.roomInfo.updatedAt = Date.now();
    this.setStatus('PLAYING');
    this.broadcastToClients({
      type: 'game:started',
      roomInfo: this.ledger.roomInfo,
      starterSlots: this.ledger.starterSlots,
    });
    this.callbacks.onGameStarted(this.ledger.roomInfo, this.ledger.starterSlots);
    void saveRoomLedger(this.ledger);
  }

  public hostSetRule(rule: OnlineModeRule) {
    if (this.role !== 'HOST' || !this.ledger) return;
    this.ledger.roomInfo.rule = rule;
    this.ledger.roomInfo.updatedAt = Date.now();
    this.broadcastLobbyState();
    void saveRoomLedger(this.ledger);
  }

  public arePlayersAtWar(pidA: string, pidB: string): boolean {
    if (!this.ledger || this.ledger.roomInfo.rule !== 'PVP' || pidA === pidB) return false;
    const decl = this.ledger.warDeclarations ?? {};
    return Boolean(decl[pidA]?.includes(pidB) && decl[pidB]?.includes(pidA));
  }

  private broadcastWarSync() {
    if (!this.ledger) return;
    const decl = this.ledger.warDeclarations ?? {};
    this.callbacks.onWarSync({ ...decl });
    this.broadcastToClients({ type: 'war:sync', warDeclarations: decl });
  }

  private applyPose(pid: string, msg: Extract<ClientToHostMessage, { type: 'state:pose' }>) {
    if (!this.ledger) return;
    const prof = this.ledger.playersById[pid];
    const pose = this.playerPoses.get(pid);
    if (!prof || !pose) return;

    prof.player = { x: msg.x, y: msg.y, angle: msg.angle, isSailing: msg.isSailing };
    prof.boat = { x: msg.boatX, y: msg.boatY, angle: msg.boatAngle };
    prof.lastSeenAt = Date.now();

    pose.x = msg.x;
    pose.y = msg.y;
    pose.angle = msg.angle;
    pose.boatX = msg.boatX;
    pose.boatY = msg.boatY;
    pose.boatAngle = msg.boatAngle;
    pose.isSailing = msg.isSailing;
    pose.speedRatio = msg.speedRatio;
    pose.walkPhase = msg.walkPhase;
    pose.digAnimProgress = msg.digAnimProgress;
    pose.attackAnimProgress = msg.attackAnimProgress;
    pose.connected = true;

    if (msg.soldiers) {
      let smap = this.playerSoldierPoses.get(pid);
      if (!smap) {
        smap = new Map();
        this.playerSoldierPoses.set(pid, smap);
      }
      smap.clear();
      for (let i = 0; i < msg.soldiers.length; i++) {
        const s = msg.soldiers[i];
        smap.set(s.id, { x: s.x, y: s.y, angle: s.angle, swinging: s.swinging });
      }
    }

    if (msg.ships || prof.escortShipCount > 0) {
      let existingShips = this.playerEscortShips.get(pid) ?? [];
      if (existingShips.length !== prof.escortShipCount) {
        const nextShips: RemoteEscortShipSnapshot[] = [];
        for (let i = 0; i < prof.escortShipCount; i++) {
          const prev = existingShips[i];
          const incoming = msg.ships?.[i];
          const formA = msg.boatAngle + (i % 2 === 0 ? 2.1 : -2.1);
          const ringD = 120 + Math.floor(i / 2) * 36;
          nextShips.push({
            id: incoming?.id ?? prev?.id ?? `oship_${pid}_${i}`,
            x: incoming?.x ?? prev?.x ?? msg.boatX + Math.cos(formA) * ringD,
            y: incoming?.y ?? prev?.y ?? msg.boatY + Math.sin(formA) * ringD,
            angle: incoming?.angle ?? prev?.angle ?? msg.boatAngle,
            hp: prev?.hp ?? ESCORT_SHIP_STATS.maxHp,
            maxHp: prev?.maxHp ?? ESCORT_SHIP_STATS.maxHp,
          });
        }
        existingShips = nextShips;
        this.playerEscortShips.set(pid, existingShips);
      } else if (msg.ships) {
        for (let i = 0; i < existingShips.length; i++) {
          const inc = msg.ships[i];
          if (inc) {
            existingShips[i].id = inc.id;
            existingShips[i].x = inc.x;
            existingShips[i].y = inc.y;
            existingShips[i].angle = inc.angle;
          }
        }
      }
    }
  }

  private processAuthoritativeCommand(pid: string, msg: ClientToHostMessage) {
    if (!this.ledger || !this.worldManager) return;
    const prof = this.ledger.playersById[pid];
    if (!prof) return;

    if (msg.type === 'state:pose') {
      this.applyPose(pid, msg);
      return;
    }

    if (msg.type === 'cmd:chat') {
      const clean = msg.text.trim().slice(0, 140);
      if (!clean) return;
      const evt: OnlineWorldEvent = {
        eventId: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'chat:msg',
        payload: {
          id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          senderId: pid,
          senderName: prof.name,
          bannerColor: prof.bannerColor,
          text: clean,
          ts: Date.now(),
        },
      };
      this.emitAndBroadcastEvent(evt);
      return;
    }

    if (msg.type === 'cmd:discover_islands') {
      let changed = false;
      for (const id of msg.islandIds) {
        if (!prof.discoveredIslandIds.includes(id)) {
          prof.discoveredIslandIds.push(id);
          changed = true;
        }
      }
      if (changed) this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:pickup_weapon') {
      if (!prof.collectedPickupIds.includes(msg.pickupId)) {
        prof.collectedPickupIds.push(msg.pickupId);
      }
      if (!prof.unlockedWeapons.includes(msg.weaponId)) {
        prof.unlockedWeapons.push(msg.weaponId);
      }
      prof.equippedWeapon = pickStrongerWeapon(prof.equippedWeapon, msg.weaponId);
      const pose = this.playerPoses.get(pid);
      if (pose) pose.equippedWeapon = prof.equippedWeapon;
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:dig') {
      const existingCrater = this.ledger.dugCraters.find(
        (c) => c.islandId === msg.islandId && dist(c.x, c.y, msg.x, msg.y) <= 22
      );
      if (existingCrater) {
        existingCrater.depth = msg.newDepth;
        if (msg.foundTreasure) existingCrater.foundTreasure = true;
      } else {
        this.ledger.dugCraters = [
          ...this.ledger.dugCraters.slice(-450),
          {
            id: msg.craterId,
            islandId: msg.islandId,
            x: msg.x,
            y: msg.y,
            radius: 15,
            depth: msg.newDepth,
            rotation: Math.random() * Math.PI * 2,
            foundTreasure: msg.foundTreasure,
          },
        ];
      }

      this.emitAndBroadcastEvent({
        eventId: `cr_${msg.craterId}_${msg.newDepth}`,
        type: 'crater:dug',
        payload: {
          crater: existingCrater ?? this.ledger.dugCraters[this.ledger.dugCraters.length - 1],
        },
      });

      if (msg.foundTreasure && msg.foundTreasureId) {
        if (!this.ledger.openedTreasureIds.includes(msg.foundTreasureId)) {
          this.ledger.openedTreasureIds.push(msg.foundTreasureId);
          prof.gold += msg.instantBonus;
          prof.totalGoldEarned += msg.instantBonus;
          prof.treasuresFoundCount += 1;
          if (msg.bagItem) prof.bag.push(msg.bagItem);
          if (msg.unlockedWeapon) {
            if (!prof.unlockedWeapons.includes(msg.unlockedWeapon)) {
              prof.unlockedWeapons.push(msg.unlockedWeapon);
            }
            prof.equippedWeapon = pickStrongerWeapon(prof.equippedWeapon, msg.unlockedWeapon);
            const pose = this.playerPoses.get(pid);
            if (pose) pose.equippedWeapon = prof.equippedWeapon;
          }
          this.emitAndBroadcastEvent({
            eventId: `tr_${msg.foundTreasureId}`,
            type: 'treasure:opened',
            payload: {
              treasureId: msg.foundTreasureId,
              finderId: pid,
              finderName: prof.name,
              x: msg.x,
              y: msg.y,
            },
          });
          this.syncProfileToPlayer(pid, prof);
        }
      }
      return;
    }

    if (msg.type === 'cmd:sell_item') {
      const idx = prof.bag.findIndex((b) => b.uid === msg.uid);
      if (idx >= 0) {
        const [item] = prof.bag.splice(idx, 1);
        prof.gold += item.value;
        prof.totalGoldEarned += item.value;
        this.syncProfileToPlayer(pid, prof);
      }
      return;
    }

    if (msg.type === 'cmd:sell_all') {
      if (prof.bag.length > 0) {
        const total = prof.bag.reduce((sum, i) => sum + i.value, 0);
        prof.bag = [];
        prof.gold += total;
        prof.totalGoldEarned += total;
        this.syncProfileToPlayer(pid, prof);
      }
      return;
    }

    if (msg.type === 'cmd:buy_upgrade') {
      const def = UPGRADE_DEFS.find((d) => d.key === msg.key);
      if (!def) return;
      const curLvl = prof.upgrades[msg.key as UpgradeKey];
      if (curLvl >= def.maxLevel) return;
      const cost = getUpgradeCost(def, curLvl);
      if (prof.gold < cost) return;
      prof.gold -= cost;
      prof.upgrades[msg.key as UpgradeKey] = curLvl + 1;
      if (msg.key === 'boatLevel') {
        prof.boatHp = getMaxBoatHp(prof.upgrades.boatLevel);
        const pose = this.playerPoses.get(pid);
        if (pose) {
          pose.boatLevel = prof.upgrades.boatLevel;
          pose.boatHp = prof.boatHp;
          pose.maxBoatHp = prof.boatHp;
        }
      }
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:found_kingdom') {
      if (prof.gold < KINGDOM_COSTS.FOUND_KINGDOM) return;
      const cleanName = msg.name.trim().slice(0, 28) || `${prof.name} Devleti`;
      prof.gold -= KINGDOM_COSTS.FOUND_KINGDOM;
      prof.kingdomFounded = true;
      prof.kingdomName = cleanName;
      prof.bannerColor = msg.bannerColor;

      const starterSlot = this.ledger.starterSlots.find((s) => s.playerId === pid);
      if (starterSlot) {
        starterSlot.bannerColor = msg.bannerColor;
        this.ledger.islandOwners[starterSlot.islandId] = pid;
        if (!prof.conqueredIslandIds.includes(starterSlot.islandId)) {
          prof.conqueredIslandIds.push(starterSlot.islandId);
        }
        this.emitAndBroadcastEvent({
          eventId: `isl_${starterSlot.islandId}_${pid}`,
          type: 'island:claimed',
          payload: {
            islandId: starterSlot.islandId,
            ownerId: pid,
            ownerName: cleanName,
            bannerColor: msg.bannerColor,
          },
        });
      }

      const pose = this.playerPoses.get(pid);
      if (pose) {
        pose.kingdomFounded = true;
        pose.kingdomName = cleanName;
        pose.bannerColor = msg.bannerColor;
        pose.conqueredCount = prof.conqueredIslandIds.length;
      }

      this.syncProfileToPlayer(pid, prof);
      this.broadcastLobbyState();
      return;
    }

    if (msg.type === 'cmd:recruit_soldier') {
      if (!prof.kingdomFounded) return;
      const spec = SOLDIER_SPECS[msg.soldierType as SoldierType];
      if (!spec) return;
      const qty = Math.max(1, Math.min(25, msg.count));
      const cost = spec.cost * qty;
      if (prof.gold < cost) return;
      const { hpMult } = getSoldierPowerMultiplier(Math.max(1, prof.armyLevel));
      const scaledHp = Math.round(spec.maxHp * hpMult);
      prof.gold -= cost;
      for (let i = 0; i < qty; i++) {
        prof.soldiers.push({
          id: `osol_${pid}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
          type: msg.soldierType,
          hp: scaledHp,
          maxHp: scaledHp,
        });
      }
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:upgrade_army') {
      if (!prof.kingdomFounded) return;
      const cur = Math.max(1, prof.armyLevel);
      if (cur >= MAX_ARMY_LEVEL) return;
      const cost = getArmyUpgradeCost(cur);
      if (prof.gold < cost) return;
      prof.gold -= cost;
      prof.armyLevel = cur + 1;
      const { hpMult } = getSoldierPowerMultiplier(prof.armyLevel);
      prof.soldiers = prof.soldiers.map((s) => {
        const sp = SOLDIER_SPECS[s.type] ?? SOLDIER_SPECS.SWORDSMAN;
        const nextMax = Math.round(sp.maxHp * hpMult);
        return { ...s, maxHp: nextMax, hp: nextMax };
      });
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:recruit_ship') {
      if (!prof.kingdomFounded) return;
      const qty = Math.max(1, Math.min(10, msg.count));
      const cost = KINGDOM_COSTS.ESCORT_SHIP * qty;
      if (prof.gold < cost) return;
      prof.gold -= cost;
      prof.escortShipCount += qty;
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:heal_army') {
      if (!prof.kingdomFounded || prof.gold < KINGDOM_COSTS.HEAL_ARMY) return;
      prof.gold -= KINGDOM_COSTS.HEAL_ARMY;
      prof.soldiers = prof.soldiers.map((s) => ({ ...s, hp: s.maxHp }));
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:claim_island') {
      const prevOwner = this.ledger.islandOwners[msg.islandId];
      if (prevOwner === pid) return;
      if (prevOwner && prevOwner !== pid) {
        if (this.ledger.roomInfo.rule === 'COOP') {
          return; // In Co-op mode players don't steal each other's islands
        }
        if (!this.arePlayersAtWar(pid, prevOwner)) {
          return; // Mutual war declaration required before conquering another player's island
        }
      }
      if (prevOwner && this.ledger.playersById[prevOwner]) {
        this.ledger.playersById[prevOwner].conqueredIslandIds = this.ledger.playersById[
          prevOwner
        ].conqueredIslandIds.filter((id) => id !== msg.islandId);
        const prevPose = this.playerPoses.get(prevOwner);
        if (prevPose) {
          prevPose.conqueredCount = this.ledger.playersById[prevOwner].conqueredIslandIds.length;
        }
        this.syncProfileToPlayer(prevOwner, this.ledger.playersById[prevOwner]);
      }
      this.ledger.islandOwners[msg.islandId] = pid;
      if (!prof.conqueredIslandIds.includes(msg.islandId)) {
        prof.conqueredIslandIds.push(msg.islandId);
      }
      prof.kingdomFounded = true;
      prof.gold += 120;
      prof.totalGoldEarned += 120;

      const pose = this.playerPoses.get(pid);
      if (pose) {
        pose.kingdomFounded = true;
        pose.conqueredCount = prof.conqueredIslandIds.length;
      }

      this.emitAndBroadcastEvent({
        eventId: `isl_${msg.islandId}_${Date.now()}`,
        type: 'island:claimed',
        payload: {
          islandId: msg.islandId,
          ownerId: pid,
          ownerName: prof.kingdomName || prof.name,
          bannerColor: prof.bannerColor,
        },
      });
      this.syncProfileToPlayer(pid, prof);
      return;
    }

    if (msg.type === 'cmd:declare_war') {
      if (this.ledger.roomInfo.rule !== 'PVP') return;
      const targetId = msg.targetPlayerId;
      if (!targetId || targetId === pid) return;
      const targetProf = this.ledger.playersById[targetId];
      if (!targetProf) return;

      if (!this.ledger.warDeclarations) this.ledger.warDeclarations = {};
      const list = this.ledger.warDeclarations[pid] ?? [];
      this.ledger.warDeclarations[pid] = list;

      if (msg.cancel) {
        // Can cancel a pending declaration if mutual war has not started yet
        if (!this.arePlayersAtWar(pid, targetId) && list.includes(targetId)) {
          this.ledger.warDeclarations[pid] = list.filter((id) => id !== targetId);
          this.broadcastWarSync();
          this.emitAndBroadcastEvent({
            eventId: `war_${pid}_${targetId}_${Date.now()}`,
            type: 'war:status',
            payload: {
              fromId: pid,
              fromName: prof.name,
              targetId,
              targetName: targetProf.name,
              mutual: false,
              cancelled: true,
            },
          });
          void saveRoomLedger(this.ledger);
        }
        return;
      }

      if (!list.includes(targetId)) {
        list.push(targetId);
      }
      const mutual = this.arePlayersAtWar(pid, targetId);
      this.broadcastWarSync();
      this.emitAndBroadcastEvent({
        eventId: `war_${pid}_${targetId}_${Date.now()}`,
        type: 'war:status',
        payload: {
          fromId: pid,
          fromName: prof.name,
          targetId,
          targetName: targetProf.name,
          mutual,
          cancelled: false,
        },
      });
      void saveRoomLedger(this.ledger);
      return;
    }

    if (msg.type === 'cmd:pvp_army_hit') {
      if (!this.arePlayersAtWar(pid, msg.targetPlayerId)) return;
      const targetProf = this.ledger.playersById[msg.targetPlayerId];
      const targetPose = this.playerPoses.get(msg.targetPlayerId);
      if (!targetProf || !targetPose || !targetPose.connected) return;
      const safeDmg = clamp(Math.round(msg.damage), 1, 140);

      if (msg.targetUnitKind === 'PLAYER') {
        const isNaval = targetPose.isSailing;
        const tx = isNaval ? targetPose.boatX : targetPose.x;
        const ty = isNaval ? targetPose.boatY : targetPose.y;
        if (dist(msg.x, msg.y, tx, ty) <= 220) {
          this.damagePlayerOnHost(msg.targetPlayerId, safeDmg, pid, isNaval);
        }
        return;
      }

      if (msg.targetUnitKind === 'SOLDIER' && msg.targetUnitId && !targetPose.isSailing) {
        const sIdx = targetProf.soldiers.findIndex((s) => s.id === msg.targetUnitId);
        if (sIdx === -1) return;
        const sol = targetProf.soldiers[sIdx];
        sol.hp = Math.max(0, sol.hp - safeDmg);
        const killed = sol.hp <= 0;
        if (killed) {
          targetProf.soldiers.splice(sIdx, 1);
          prof.landEnemiesDefeated += 1;
          prof.gold += 8;
          prof.totalGoldEarned += 8;
          this.syncProfileToPlayer(pid, prof);
        }
        this.emitAndBroadcastEvent({
          eventId: `ahit_${msg.targetUnitId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          type: 'army:hit',
          payload: {
            targetPlayerId: msg.targetPlayerId,
            unitKind: 'SOLDIER',
            unitId: msg.targetUnitId,
            x: msg.x,
            y: msg.y,
            damage: safeDmg,
            killed,
            bannerColor: targetProf.bannerColor,
          },
        });
        this.syncProfileToPlayer(msg.targetPlayerId, targetProf);
        return;
      }

      if (msg.targetUnitKind === 'SHIP' && msg.targetUnitId) {
        const ships = this.playerEscortShips.get(msg.targetPlayerId);
        if (!ships) return;
        const shIdx = ships.findIndex((s) => s.id === msg.targetUnitId);
        if (shIdx === -1) return;
        const ship = ships[shIdx];
        ship.hp = Math.max(0, ship.hp - safeDmg);
        const killed = ship.hp <= 0;
        if (killed) {
          ships.splice(shIdx, 1);
          targetProf.escortShipCount = Math.max(0, targetProf.escortShipCount - 1);
          prof.enemiesSunkCount += 1;
          prof.gold += 30;
          prof.totalGoldEarned += 30;
          this.syncProfileToPlayer(pid, prof);
          this.syncProfileToPlayer(msg.targetPlayerId, targetProf);
        }
        this.emitAndBroadcastEvent({
          eventId: `ahit_${msg.targetUnitId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          type: 'army:hit',
          payload: {
            targetPlayerId: msg.targetPlayerId,
            unitKind: 'SHIP',
            unitId: msg.targetUnitId,
            x: ship.x,
            y: ship.y,
            damage: safeDmg,
            killed,
            bannerColor: targetProf.bannerColor,
          },
        });
      }
      return;
    }

    if (msg.type === 'cmd:fire_cannon') {
      const sideX = -Math.sin(msg.angle);
      const sideY = Math.cos(msg.angle);
      const fX = Math.cos(msg.angle);
      const fY = Math.sin(msg.angle);
      const count = Math.max(1, Math.min(5, msg.cannonCount));
      for (const side of [-1, 1] as const) {
        for (let i = 0; i < count; i++) {
          const along = count === 1 ? 0 : (i / (count - 1) - 0.5) * 26;
          const speed = 415 + Math.random() * 22;
          this.projectiles.push({
            id: `ocb_${pid}_${Date.now()}_${side}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            ownerId: pid,
            kind: 'CANNON',
            x: msg.x + fX * along + sideX * side * 14,
            y: msg.y + fY * along + sideY * side * 14,
            z: 8,
            vx: sideX * side * speed + fX * 18,
            vy: sideY * side * speed + fY * 18,
            vz: 118,
            damage: msg.damage,
            color: prof.bannerColor,
            life: 1.55,
          });
        }
      }
      return;
    }

    if (msg.type === 'cmd:land_attack') {
      if (msg.isRanged) {
        const speed = msg.splashRadius ? 345 : 440;
        this.projectiles.push({
          id: `olp_${pid}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          ownerId: pid,
          kind: 'LAND',
          x: msg.x + Math.cos(msg.angle) * 16,
          y: msg.y + Math.sin(msg.angle) * 16,
          z: 0,
          vx: Math.cos(msg.angle) * speed,
          vy: Math.sin(msg.angle) * speed,
          vz: 0,
          damage: msg.damage,
          color: msg.projColor || prof.bannerColor,
          life: msg.range ? Math.min(1.2, msg.range / speed + 0.15) : 0.9,
          splashRadius: msg.splashRadius,
        });
      } else if (this.ledger.roomInfo.rule === 'PVP') {
        // Authoritative melee PvP hit check (only against players at war with attacker)
        for (const [targetId, targetPose] of this.playerPoses.entries()) {
          if (targetId === pid || !targetPose.connected || targetPose.isSailing) continue;
          if (!this.arePlayersAtWar(pid, targetId)) continue;
          const d = dist(msg.x, msg.y, targetPose.x, targetPose.y);
          if (d <= msg.range + 16) {
            this.damagePlayerOnHost(targetId, msg.damage, pid, false);
          }
          // Also check melee hit against enemy player's soldiers
          const targetProf = this.ledger.playersById[targetId];
          const smap = this.playerSoldierPoses.get(targetId);
          if (targetProf && smap && targetProf.soldiers.length > 0) {
            let anySoldierDamaged = false;
            for (let si = targetProf.soldiers.length - 1; si >= 0; si--) {
              const sol = targetProf.soldiers[si];
              const spos = smap.get(sol.id);
              if (!spos) continue;
              if (dist(msg.x, msg.y, spos.x, spos.y) <= msg.range + 16) {
                sol.hp = Math.max(0, sol.hp - msg.damage);
                anySoldierDamaged = true;
                const killed = sol.hp <= 0;
                if (killed) {
                  targetProf.soldiers.splice(si, 1);
                  prof.landEnemiesDefeated += 1;
                  prof.gold += 8;
                  prof.totalGoldEarned += 8;
                }
                this.emitAndBroadcastEvent({
                  eventId: `ahit_${sol.id}_${Date.now()}_${si}`,
                  type: 'army:hit',
                  payload: {
                    targetPlayerId: targetId,
                    unitKind: 'SOLDIER',
                    unitId: sol.id,
                    x: spos.x,
                    y: spos.y,
                    damage: msg.damage,
                    killed,
                    bannerColor: targetProf.bannerColor,
                  },
                });
              }
            }
            if (anySoldierDamaged) {
              this.syncProfileToPlayer(targetId, targetProf);
              this.syncProfileToPlayer(pid, prof);
            }
          }
        }
      }
    }
  }

  private damagePlayerOnHost(
    targetId: string,
    damage: number,
    attackerId: string,
    isNaval: boolean
  ) {
    if (!this.ledger || !this.worldManager) return;
    const prof = this.ledger.playersById[targetId];
    const pose = this.playerPoses.get(targetId);
    if (!prof || !pose) return;

    this.hitFlashUntilByPlayer.set(targetId, performance.now() + 180);

    if (isNaval) {
      prof.boatHp = Math.max(0, prof.boatHp - damage);
      pose.boatHp = prof.boatHp;
      this.emitAndBroadcastEvent({
        eventId: `hit_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: 'player:hit',
        payload: {
          targetId,
          attackerId,
          damage,
          isNaval: true,
          x: pose.boatX,
          y: pose.boatY,
          hpLeft: prof.boatHp,
        },
      });
      if (prof.boatHp <= 0) {
        const attacker = this.ledger.playersById[attackerId];
        if (attacker) {
          attacker.enemiesSunkCount += 1;
          attacker.gold += 60;
          attacker.totalGoldEarned += 60;
          this.syncProfileToPlayer(attackerId, attacker);
        }
        this.respawnPlayerAtStarter(targetId, prof, pose, true);
      } else {
        this.syncProfileToPlayer(targetId, prof);
      }
    } else {
      prof.playerHp = Math.max(0, prof.playerHp - damage);
      pose.playerHp = prof.playerHp;
      this.emitAndBroadcastEvent({
        eventId: `hit_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: 'player:hit',
        payload: {
          targetId,
          attackerId,
          damage,
          isNaval: false,
          x: pose.x,
          y: pose.y,
          hpLeft: prof.playerHp,
        },
      });
      if (prof.playerHp <= 0) {
        const attacker = this.ledger.playersById[attackerId];
        if (attacker) {
          attacker.landEnemiesDefeated += 1;
          attacker.gold += 45;
          attacker.totalGoldEarned += 45;
          this.syncProfileToPlayer(attackerId, attacker);
        }
        this.respawnPlayerAtStarter(targetId, prof, pose, false);
      } else {
        this.syncProfileToPlayer(targetId, prof);
      }
    }
  }

  private respawnPlayerAtStarter(
    pid: string,
    prof: PlayerProfileLedger,
    pose: RemotePlayerSnapshot,
    isNaval: boolean
  ) {
    if (!this.ledger || !this.worldManager) return;
    const slot =
      this.ledger.starterSlots.find((s) => s.playerId === pid) ?? this.ledger.starterSlots[0];
    const starter = slot ? this.worldManager.getIslandById(slot.islandId) : null;
    const angle = starter?.traderDock?.angle ?? 0.2;
    const coastR = starter ? getIslandRadiusAtAngle(starter, angle) : 300;
    const cx = starter?.centerX ?? 0;
    const cy = starter?.centerY ?? 0;

    const safeBoatX = cx + Math.cos(angle) * (coastR + 40);
    const safeBoatY = cy + Math.sin(angle) * (coastR + 40);
    const safeLandX = cx + Math.cos(angle) * (coastR * 0.45);
    const safeLandY = cy + Math.sin(angle) * (coastR * 0.45);

    prof.boatHp = Math.round(getMaxBoatHp(prof.upgrades.boatLevel) * 0.75);
    prof.playerHp = 100;
    prof.player = {
      x: isNaval ? safeBoatX : safeLandX,
      y: isNaval ? safeBoatY : safeLandY,
      angle: 0,
      isSailing: isNaval,
    };
    prof.boat = { x: safeBoatX, y: safeBoatY, angle: angle + Math.PI * 0.5 };

    pose.x = prof.player.x;
    pose.y = prof.player.y;
    pose.boatX = safeBoatX;
    pose.boatY = safeBoatY;
    pose.isSailing = isNaval;
    pose.boatHp = prof.boatHp;
    pose.playerHp = prof.playerHp;

    this.emitAndBroadcastEvent({
      eventId: `resp_${pid}_${Date.now()}`,
      type: 'player:respawn',
      payload: {
        playerId: pid,
        name: prof.name,
        x: prof.player.x,
        y: prof.player.y,
        boatX: safeBoatX,
        boatY: safeBoatY,
        isSailing: isNaval,
      },
    });
    this.syncProfileToPlayer(pid, prof);
  }

  private startHostLoops() {
    if (this.hostTickTimer !== null) window.clearInterval(this.hostTickTimer);
    if (this.hostSaveTimer !== null) window.clearInterval(this.hostSaveTimer);
    this.lastTickMs = performance.now();

    // 20 Hz Host authoritative tick + interest-culled snapshot broadcast
    this.hostTickTimer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTickMs) / 1000);
      this.lastTickMs = now;
      this.stepHostProjectiles(dt, now);
      this.broadcastSnapshots(now);
    }, 50);

    this.hostSaveTimer = window.setInterval(() => {
      if (this.ledger) {
        void saveRoomLedger(this.ledger);
      }
    }, 6000);
  }

  private stepHostProjectiles(dt: number, now: number) {
    if (!this.ledger || !this.worldManager) return;
    const isPvp = this.ledger.roomInfo.rule === 'PVP';

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'CANNON') {
        p.vz -= 210 * dt;
        p.z += p.vz * dt;
      }

      let hit = false;
      if (isPvp) {
        for (const [targetId, targetPose] of this.playerPoses.entries()) {
          if (targetId === p.ownerId || !targetPose.connected) continue;
          if (!this.arePlayersAtWar(p.ownerId, targetId)) continue;

          if (p.kind === 'CANNON') {
            if (targetPose.isSailing && dist(p.x, p.y, targetPose.boatX, targetPose.boatY) <= 28) {
              this.damagePlayerOnHost(targetId, p.damage, p.ownerId, true);
              hit = true;
              break;
            }
            const ships = this.playerEscortShips.get(targetId);
            const targetProf = this.ledger.playersById[targetId];
            if (ships && targetProf) {
              for (let si = ships.length - 1; si >= 0; si--) {
                const ship = ships[si];
                if (dist(p.x, p.y, ship.x, ship.y) <= 26) {
                  ship.hp = Math.max(0, ship.hp - p.damage);
                  const killed = ship.hp <= 0;
                  if (killed) {
                    ships.splice(si, 1);
                    targetProf.escortShipCount = Math.max(0, targetProf.escortShipCount - 1);
                    const atkProf = this.ledger.playersById[p.ownerId];
                    if (atkProf) {
                      atkProf.enemiesSunkCount += 1;
                      atkProf.gold += 30;
                      atkProf.totalGoldEarned += 30;
                      this.syncProfileToPlayer(p.ownerId, atkProf);
                    }
                    this.syncProfileToPlayer(targetId, targetProf);
                  }
                  this.emitAndBroadcastEvent({
                    eventId: `ahit_${ship.id}_${Date.now()}_${si}`,
                    type: 'army:hit',
                    payload: {
                      targetPlayerId: targetId,
                      unitKind: 'SHIP',
                      unitId: ship.id,
                      x: ship.x,
                      y: ship.y,
                      damage: p.damage,
                      killed,
                      bannerColor: targetProf.bannerColor,
                    },
                  });
                  hit = true;
                  break;
                }
              }
              if (hit) break;
            }
          } else if (p.kind === 'LAND' && !targetPose.isSailing) {
            if (dist(p.x, p.y, targetPose.x, targetPose.y) <= 18) {
              this.damagePlayerOnHost(targetId, p.damage, p.ownerId, false);
              hit = true;
            }
            const targetProf = this.ledger.playersById[targetId];
            const smap = this.playerSoldierPoses.get(targetId);
            if (!hit && targetProf && smap && targetProf.soldiers.length > 0) {
              const hitR = p.splashRadius ? 20 : 16;
              for (let si = targetProf.soldiers.length - 1; si >= 0; si--) {
                const sol = targetProf.soldiers[si];
                const spos = smap.get(sol.id);
                if (!spos) continue;
                if (dist(p.x, p.y, spos.x, spos.y) <= hitR) {
                  hit = true;
                  break;
                }
              }
            }
            if (hit && targetProf && smap) {
              const blastR = p.splashRadius ?? 20;
              let anySoldierDamaged = false;
              for (let si = targetProf.soldiers.length - 1; si >= 0; si--) {
                const sol = targetProf.soldiers[si];
                const spos = smap.get(sol.id);
                if (!spos) continue;
                if (dist(p.x, p.y, spos.x, spos.y) <= blastR) {
                  const dealt = p.splashRadius ? Math.round(p.damage * 0.85) : p.damage;
                  sol.hp = Math.max(0, sol.hp - dealt);
                  anySoldierDamaged = true;
                  const killed = sol.hp <= 0;
                  if (killed) {
                    targetProf.soldiers.splice(si, 1);
                    const atkProf = this.ledger.playersById[p.ownerId];
                    if (atkProf) {
                      atkProf.landEnemiesDefeated += 1;
                      atkProf.gold += 8;
                      atkProf.totalGoldEarned += 8;
                      this.syncProfileToPlayer(p.ownerId, atkProf);
                    }
                  }
                  this.emitAndBroadcastEvent({
                    eventId: `ahit_${sol.id}_${Date.now()}_${si}`,
                    type: 'army:hit',
                    payload: {
                      targetPlayerId: targetId,
                      unitKind: 'SOLDIER',
                      unitId: sol.id,
                      x: spos.x,
                      y: spos.y,
                      damage: dealt,
                      killed,
                      bannerColor: targetProf.bannerColor,
                    },
                  });
                }
              }
              if (anySoldierDamaged) {
                this.syncProfileToPlayer(targetId, targetProf);
              }
              break;
            }
            if (hit) break;
          }
        }
      }

      if (!hit && p.kind === 'CANNON') {
        const nearbyIsl = this.worldManager.getVisibleIslands(p.x, p.y, 1);
        if (nearbyIsl.some((isl) => isPointOnIsland(isl, p.x, p.y, 0))) {
          hit = true;
        }
      }

      if (hit || p.life <= 0 || (p.kind === 'CANNON' && p.z <= 0)) {
        this.projectiles.splice(i, 1);
      }
    }

    for (const [pid, pose] of this.playerPoses.entries()) {
      pose.hitFlash = (this.hitFlashUntilByPlayer.get(pid) ?? 0) > now;
    }
  }

  private buildReplicatedPose(
    pose: RemotePlayerSnapshot,
    includeArmies: boolean
  ): RemotePlayerSnapshot {
    if (!includeArmies || !this.ledger) {
      return { ...pose, soldiers: undefined, ships: undefined };
    }
    const prof = this.ledger.playersById[pose.id];
    const smap = this.playerSoldierPoses.get(pose.id);
    const soldiers: RemoteSoldierSnapshot[] = [];
    if (prof && !pose.isSailing && prof.soldiers.length > 0) {
      const limit = Math.min(prof.soldiers.length, 160);
      for (let i = 0; i < limit; i++) {
        const rs = prof.soldiers[i];
        const spos = smap?.get(rs.id);
        const fallbackA = (i / Math.max(1, limit)) * Math.PI * 2;
        soldiers.push({
          id: rs.id,
          type: rs.type,
          x: Math.round(spos ? spos.x : pose.x + Math.cos(fallbackA) * 36),
          y: Math.round(spos ? spos.y : pose.y + Math.sin(fallbackA) * 36),
          angle: Math.round((spos ? spos.angle : pose.angle) * 100) / 100,
          hp: rs.hp,
          maxHp: rs.maxHp,
          swinging: spos?.swinging || undefined,
        });
      }
    }
    const rawShips = this.playerEscortShips.get(pose.id);
    const ships: RemoteEscortShipSnapshot[] = rawShips
      ? rawShips.slice(0, 60).map((sh) => ({
          id: sh.id,
          x: Math.round(sh.x),
          y: Math.round(sh.y),
          angle: Math.round(sh.angle * 100) / 100,
          hp: sh.hp,
          maxHp: sh.maxHp,
        }))
      : [];
    return {
      ...pose,
      soldiers,
      ships,
    };
  }

  private broadcastSnapshots(now: number) {
    if (!this.ledger || !this.identity) return;
    const allPoses = Array.from(this.playerPoses.values());
    const hostId = this.identity.playerId;
    const hostPose = this.playerPoses.get(hostId);
    const hx = hostPose ? (hostPose.isSailing ? hostPose.boatX : hostPose.x) : 0;
    const hy = hostPose ? (hostPose.isSailing ? hostPose.boatY : hostPose.y) : 0;

    // Deliver local host view (all other players, with armies when within interest radius)
    this.callbacks.onSnapshot(
      allPoses
        .filter((p) => p.id !== hostId)
        .map((p) => {
          const px = p.isSailing ? p.boatX : p.x;
          const py = p.isSailing ? p.boatY : p.y;
          return this.buildReplicatedPose(p, dist(hx, hy, px, py) <= INTEREST_RADIUS);
        }),
      this.projectiles
    );

    // Send interest-culled snapshots to each connected client
    for (const [pid, conn] of this.playerToConn.entries()) {
      if (!conn.open) continue;
      const viewer = this.playerPoses.get(pid);
      const vx = viewer ? (viewer.isSailing ? viewer.boatX : viewer.x) : 0;
      const vy = viewer ? (viewer.isSailing ? viewer.boatY : viewer.y) : 0;

      // Always send compact poses for active players so World Map works,
      // and include armies/projectiles within INTEREST_RADIUS to save bandwidth
      const culledProjectiles = this.projectiles.filter(
        (pr) => dist(vx, vy, pr.x, pr.y) <= INTEREST_RADIUS
      );
      const viewerPlayers = allPoses
        .filter((p) => p.id !== pid)
        .map((p) => {
          const px = p.isSailing ? p.boatX : p.x;
          const py = p.isSailing ? p.boatY : p.y;
          return this.buildReplicatedPose(p, dist(vx, vy, px, py) <= INTEREST_RADIUS);
        });
      conn.send({
        type: 'world:snapshot',
        t: now,
        players: viewerPlayers,
        projectiles: culledProjectiles,
      } satisfies HostToClientMessage);
    }
  }

  private syncProfileToPlayer(pid: string, prof: PlayerProfileLedger) {
    if (this.identity && pid === this.identity.playerId) {
      this.callbacks.onProfileSync(prof);
      return;
    }
    const conn = this.playerToConn.get(pid);
    if (conn?.open) {
      conn.send({ type: 'player:profile_sync', profile: prof } satisfies HostToClientMessage);
    }
  }

  private broadcastLobbyState() {
    if (!this.ledger) return;
    const allPoses = Array.from(this.playerPoses.values());
    const warDecl = this.ledger.warDeclarations ?? {};
    this.callbacks.onLobbyUpdate(this.ledger.roomInfo, allPoses, this.ledger.starterSlots);
    this.callbacks.onWarSync({ ...warDecl });
    this.broadcastToClients({
      type: 'lobby:state',
      roomInfo: this.ledger.roomInfo,
      players: allPoses,
      starterSlots: this.ledger.starterSlots,
      warDeclarations: warDecl,
    });
  }

  private emitAndBroadcastEvent(event: OnlineWorldEvent) {
    this.callbacks.onWorldEvent(event);
    if (event.type === 'chat:msg') {
      this.callbacks.onChat(event.payload as unknown as OnlineChatMessage);
    }
    this.broadcastToClients({ type: 'world:event', event });
  }

  private broadcastToClients(msg: HostToClientMessage, excludePlayerId?: string) {
    for (const [pid, conn] of this.playerToConn.entries()) {
      if (excludePlayerId && pid === excludePlayerId) continue;
      if (conn.open) conn.send(msg);
    }
  }

  private sendToHost(msg: ClientToHostMessage) {
    if (this.hostConn?.open) {
      this.hostConn.send(msg);
    }
  }

  private handleHostMessage(msg: HostToClientMessage) {
    if (msg.type === 'pong') {
      this.callbacks.onPingUpdate(Math.max(1, Math.round(performance.now() - msg.ts)));
      return;
    }
    if (msg.type === 'welcome') {
      this.setStatus(msg.roomInfo.started ? 'PLAYING' : 'LOBBY');
      this.callbacks.onWelcome(msg);
      return;
    }
    if (msg.type === 'lobby:state') {
      this.callbacks.onLobbyUpdate(msg.roomInfo, msg.players, msg.starterSlots);
      if (msg.warDeclarations) {
        this.callbacks.onWarSync(msg.warDeclarations);
      }
      return;
    }
    if (msg.type === 'game:started') {
      this.setStatus('PLAYING');
      this.callbacks.onGameStarted(msg.roomInfo, msg.starterSlots);
      return;
    }
    if (msg.type === 'world:starter_added') {
      this.callbacks.onStarterAdded(msg.slot);
      return;
    }
    if (msg.type === 'war:sync') {
      this.callbacks.onWarSync(msg.warDeclarations);
      return;
    }
    if (msg.type === 'player:profile_sync') {
      this.callbacks.onProfileSync(msg.profile);
      return;
    }
    if (msg.type === 'world:snapshot') {
      this.callbacks.onSnapshot(msg.players, msg.projectiles);
      return;
    }
    if (msg.type === 'world:event') {
      this.callbacks.onWorldEvent(msg.event);
      if (msg.event.type === 'chat:msg') {
        this.callbacks.onChat(msg.event.payload as unknown as OnlineChatMessage);
      }
      return;
    }
    if (msg.type === 'error') {
      this.setStatus('ERROR', msg.message);
    }
  }

  public disconnect() {
    this.destroyed = true;
    if (this.hostTickTimer !== null) {
      window.clearInterval(this.hostTickTimer);
      this.hostTickTimer = null;
    }
    if (this.hostSaveTimer !== null) {
      window.clearInterval(this.hostSaveTimer);
      this.hostSaveTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ledger) {
      void saveRoomLedger(this.ledger);
    }
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        // Ignore
      }
    }
    this.connections.clear();
    this.peerToPlayerId.clear();
    this.playerToConn.clear();
    this.playerPoses.clear();
    this.playerSoldierPoses.clear();
    this.playerEscortShips.clear();
    this.projectiles = [];
    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        // Ignore
      }
      this.hostConn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore
      }
      this.peer = null;
    }
    this.role = null;
    this.ledger = null;
    this.setStatus('IDLE');
  }
}
