import Peer, { MediaConnection } from 'peerjs';
import { RemotePlayerView, VoicePeerInfo } from '../types/online';
import { dist } from '../utils/prng';

export type VoiceMode = 'PROXIMITY' | 'ROOM';

export interface VoiceStateSnapshot {
  enabled: boolean;
  muted: boolean;
  mode: VoiceMode;
  connecting: boolean;
  error: string | null;
  activeSpeakerIds: string[];
  connectedVoicePeerCount: number;
}

interface ActiveMediaPeer {
  playerId: string;
  peerId: string;
  call: MediaConnection;
  audioEl: HTMLAudioElement;
  currentGain: number;
  mediaSource?: MediaStreamAudioSourceNode;
  gainNode?: GainNode;
  analyser?: AnalyserNode;
  dataArr?: Uint8Array<ArrayBuffer>;
}

const PROXIMITY_MAX_DIST = 1450;

export class VoiceChatManager {
  private peer: Peer | null = null;
  private selfPlayerId = '';
  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localData: Uint8Array<ArrayBuffer> | null = null;

  private peersByPlayerId = new Map<string, ActiveMediaPeer>();
  private knownPeers: VoicePeerInfo[] = [];

  private enabled = false;
  private muted = false;
  private mode: VoiceMode = 'PROXIMITY';
  private connecting = false;
  private error: string | null = null;
  private activeSpeakerIds = new Set<string>();
  private meterTimer: number | null = null;
  private boundPeerCallListener: ((call: MediaConnection) => void) | null = null;

  private onChange: (snapshot: VoiceStateSnapshot) => void;

  constructor(onChange: (snapshot: VoiceStateSnapshot) => void) {
    this.onChange = onChange;
  }

  public getSnapshot(): VoiceStateSnapshot {
    return {
      enabled: this.enabled,
      muted: this.muted,
      mode: this.mode,
      connecting: this.connecting,
      error: this.error,
      activeSpeakerIds: Array.from(this.activeSpeakerIds),
      connectedVoicePeerCount: this.peersByPlayerId.size,
    };
  }

  private emit() {
    this.onChange(this.getSnapshot());
  }

  public attachPeer(peer: Peer | null, selfPlayerId: string) {
    if (this.peer && this.boundPeerCallListener) {
      this.peer.off('call', this.boundPeerCallListener);
    }
    this.peer = peer;
    this.selfPlayerId = selfPlayerId;
    if (peer) {
      this.boundPeerCallListener = (call: MediaConnection) => {
        this.handleIncomingCall(call);
      };
      peer.on('call', this.boundPeerCallListener);
      if (this.enabled && this.localStream) {
        this.syncOutgoingCalls();
      }
    }
  }

  public updateKnownPeers(peers: VoicePeerInfo[]) {
    this.knownPeers = peers;
    const validIds = new Set(peers.map((p) => p.playerId));
    for (const [pid] of this.peersByPlayerId.entries()) {
      if (!validIds.has(pid)) {
        this.closeMediaPeer(pid);
      }
    }
    if (this.enabled && this.localStream) {
      this.syncOutgoingCalls();
    }
    this.emit();
  }

  public async enable(peer: Peer | null, selfPlayerId: string, peers: VoicePeerInfo[]): Promise<boolean> {
    if (this.enabled || this.connecting) return this.enabled;
    this.attachPeer(peer, selfPlayerId);
    this.knownPeers = peers;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error = 'Tarayıcı mikrofon erişimini desteklemiyor.';
      this.emit();
      return false;
    }

    this.connecting = true;
    this.error = null;
    this.emit();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.enabled = true;
      this.muted = false;
      this.connecting = false;

      this.setupLocalAnalyser(stream);
      this.startMeterLoop();
      this.syncOutgoingCalls();
      this.emit();
      return true;
    } catch {
      this.connecting = false;
      this.enabled = false;
      this.error = 'Mikrofon izni reddedildi veya cihaz bulunamadı.';
      this.emit();
      return false;
    }
  }

  public disable() {
    this.enabled = false;
    this.connecting = false;
    this.muted = false;
    this.activeSpeakerIds.clear();

    if (this.meterTimer !== null) {
      window.clearInterval(this.meterTimer);
      this.meterTimer = null;
    }

    for (const pid of Array.from(this.peersByPlayerId.keys())) {
      this.closeMediaPeer(pid);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore
        }
      });
      this.localStream = null;
    }

    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
      this.localAnalyser = null;
      this.localData = null;
    }

    this.emit();
  }

  public toggleMute(): boolean {
    if (!this.enabled || !this.localStream) return this.muted;
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !this.muted;
    });
    if (this.muted) {
      this.activeSpeakerIds.delete(this.selfPlayerId);
    }
    this.emit();
    return this.muted;
  }

  public setMode(mode: VoiceMode) {
    this.mode = mode;
    if (mode === 'ROOM') {
      for (const mp of this.peersByPlayerId.values()) {
        this.applyPeerVolume(mp, 1);
      }
    }
    this.emit();
  }

  public clearError() {
    if (this.error) {
      this.error = null;
      this.emit();
    }
  }

  public resumePlaybackOnGesture() {
    if (!this.enabled) return;
    if (this.audioCtx && (this.audioCtx.state as string) !== 'running') {
      this.audioCtx.resume().catch(() => {});
    }
    for (const mp of this.peersByPlayerId.values()) {
      if (mp.audioEl.srcObject && mp.audioEl.paused) {
        void mp.audioEl.play().catch(() => {});
      }
    }
  }

  private ensureVoiceAudioContext(): AudioContext | null {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      if ((this.audioCtx.state as string) !== 'running') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private applyPeerVolume(mp: ActiveMediaPeer, vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    mp.currentGain = clamped;
    if (mp.gainNode && this.audioCtx) {
      try {
        mp.gainNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.04);
      } catch {
        // Ignore scheduling error
      }
    } else if (!mp.gainNode) {
      mp.audioEl.muted = false;
      mp.audioEl.volume = clamped;
    }
  }

  public updateProximityVolumes(
    selfX: number,
    selfY: number,
    remotePlayers: Map<string, RemotePlayerView>
  ) {
    if (!this.enabled) return;
    for (const [pid, mp] of this.peersByPlayerId.entries()) {
      if (this.mode === 'ROOM') {
        this.applyPeerVolume(mp, 1);
        continue;
      }
      const rp = remotePlayers.get(pid);
      if (!rp || !rp.connected) {
        this.applyPeerVolume(mp, 0.25);
        continue;
      }
      const rx = rp.isSailing ? rp.boatX : rp.x;
      const ry = rp.isSailing ? rp.boatY : rp.y;
      const d = dist(selfX, selfY, rx, ry);
      if (d >= PROXIMITY_MAX_DIST) {
        this.applyPeerVolume(mp, 0);
      } else {
        const ratio = 1 - d / PROXIMITY_MAX_DIST;
        this.applyPeerVolume(mp, Math.max(0.05, Math.min(1, ratio * ratio)));
      }
    }
  }

  private setupLocalAnalyser(stream: MediaStream) {
    try {
      const ctx = this.ensureVoiceAudioContext();
      if (!ctx) return;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      this.localAnalyser = analyser;
      this.localData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      // Ignore analyser errors gracefully
    }
  }

  private setupRemoteAudioGraph(mp: ActiveMediaPeer, stream: MediaStream) {
    try {
      const ctx = this.ensureVoiceAudioContext();
      if (!ctx) return;
      const src = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = mp.currentGain;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      mp.mediaSource = src;
      mp.gainNode = gainNode;
      mp.analyser = analyser;
      mp.dataArr = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      mp.audioEl.muted = true;
    } catch {
      mp.audioEl.muted = false;
      mp.audioEl.volume = mp.currentGain;
    }
  }

  private startMeterLoop() {
    if (this.meterTimer !== null) window.clearInterval(this.meterTimer);
    this.meterTimer = window.setInterval(() => {
      if (!this.enabled) return;
      const prevKey = Array.from(this.activeSpeakerIds).sort().join(',');
      const next = new Set<string>();

      if (!this.muted && this.localAnalyser && this.localData) {
        this.localAnalyser.getByteTimeDomainData(this.localData);
        let sum = 0;
        for (let i = 0; i < this.localData.length; i++) {
          const v = (this.localData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.localData.length);
        if (rms > 0.032) next.add(this.selfPlayerId);
      }

      for (const [pid, mp] of this.peersByPlayerId.entries()) {
        if (mp.analyser && mp.dataArr && mp.currentGain > 0.02) {
          mp.analyser.getByteTimeDomainData(mp.dataArr);
          let sum = 0;
          for (let i = 0; i < mp.dataArr.length; i++) {
            const v = (mp.dataArr[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / mp.dataArr.length);
          if (rms > 0.028) next.add(pid);
        }
      }

      this.activeSpeakerIds = next;
      const nextKey = Array.from(next).sort().join(',');
      if (nextKey !== prevKey) {
        this.emit();
      }
    }, 180);
  }

  private syncOutgoingCalls() {
    if (!this.peer || !this.localStream || !this.enabled || !this.selfPlayerId) return;
    for (const info of this.knownPeers) {
      if (info.playerId === this.selfPlayerId || !info.peerId) continue;
      if (this.peersByPlayerId.has(info.playerId)) continue;
      // Deterministic tie-breaker so only one peer initiates the call
      if (this.selfPlayerId < info.playerId) {
        try {
          const call = this.peer.call(info.peerId, this.localStream, {
            metadata: { playerId: this.selfPlayerId, voice: true },
          });
          this.registerMediaCall(info.playerId, info.peerId, call);
        } catch {
          // Ignore single-peer call failure
        }
      }
    }
  }

  private handleIncomingCall(call: MediaConnection) {
    if (!this.enabled || !this.localStream) {
      try {
        call.close();
      } catch {
        // Ignore
      }
      return;
    }
    const meta = (call.metadata ?? {}) as { playerId?: string };
    const matched =
      this.knownPeers.find((p) => p.peerId === call.peer) ??
      (meta.playerId ? this.knownPeers.find((p) => p.playerId === meta.playerId) : undefined);
    const pid = matched?.playerId || meta.playerId || call.peer;

    if (this.peersByPlayerId.has(pid)) {
      this.closeMediaPeer(pid);
    }

    try {
      call.answer(this.localStream);
      this.registerMediaCall(pid, call.peer, call);
    } catch {
      // Ignore
    }
  }

  private registerMediaCall(playerId: string, peerId: string, call: MediaConnection) {
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.muted = true;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.setAttribute('webkit-playsinline', 'true');
    const mp: ActiveMediaPeer = { playerId, peerId, call, audioEl, currentGain: 1 };
    this.peersByPlayerId.set(playerId, mp);

    call.on('stream', (remoteStream: MediaStream) => {
      audioEl.srcObject = remoteStream;
      void audioEl.play().catch(() => {
        // Autoplay policy fallback handled on user gesture
      });
      this.setupRemoteAudioGraph(mp, remoteStream);
      this.emit();
    });

    call.on('close', () => {
      this.closeMediaPeer(playerId);
      this.emit();
    });

    call.on('error', () => {
      this.closeMediaPeer(playerId);
      this.emit();
    });

    this.emit();
  }

  private closeMediaPeer(playerId: string) {
    const mp = this.peersByPlayerId.get(playerId);
    if (!mp) return;
    try {
      mp.mediaSource?.disconnect();
      mp.gainNode?.disconnect();
      mp.analyser?.disconnect();
    } catch {
      // Ignore
    }
    try {
      mp.call.close();
    } catch {
      // Ignore
    }
    try {
      mp.audioEl.pause();
      mp.audioEl.srcObject = null;
    } catch {
      // Ignore
    }
    this.peersByPlayerId.delete(playerId);
    this.activeSpeakerIds.delete(playerId);
  }
}
